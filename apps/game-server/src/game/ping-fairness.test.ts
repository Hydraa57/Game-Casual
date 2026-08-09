import { describe, expect, it, vi } from 'vitest';
import { MP_PING_EQUALIZE_CAP_MS, SERVER_TICK_MS } from '@pixelmatrix/shared';
import { Match } from './Match';
import { Room } from '../rooms/Room';
import type { GameServer } from '../net/handlers';

/**
 * Penyetaraan ping diuji lewat `Match` sungguhan, bukan lewat `fairness.ts`.
 *
 * Aritmetikanya sudah punya testnya sendiri. Yang belum teruji — dan yang
 * benar-benar dikeluhkan pemain — adalah apakah ia mengubah SIAPA YANG MENANG
 * rebutan. Itu hanya kelihatan kalau dua ketukan sungguhan diadu di papan yang
 * sama, lewat rate limiter dan tick loop yang sama dengan produksi.
 */

function fakeIo() {
  const io = {
    to() {
      return { emit() {} };
    },
  };
  return io as unknown as GameServer;
}

/** Room dua pemain, dengan ping yang bisa diatur per orang. */
function roomDuaPemain(pingP1: number | null, pingP2: number | null): Room {
  const room = new Room('AAA111', 'p1', 'Cepat', 'fox', { maxPlayers: 2, targetScore: 1000 });
  room.add('p2', 'Lambat', 'cat');

  // `setLatency` meratakan sampel, jadi satu sampel saja belum sampai ke
  // angkanya. Diberi berkali-kali supaya nilainya mendekati yang dimaksud —
  // sama seperti koneksi sungguhan yang stabil di angka itu.
  for (let i = 0; i < 20; i += 1) {
    if (pingP1 !== null) room.setLatency('p1', pingP1);
    if (pingP2 !== null) room.setLatency('p2', pingP2);
  }
  return room;
}

function matchBerjalan(room: Room) {
  const match = new Match(room, fakeIo(), () => {});
  vi.useFakeTimers();
  match.start();
  vi.advanceTimersByTime(4000);
  return match;
}

const skorDari = (match: Match, playerId: string): number =>
  match.debugScoreboard().find((entry) => entry.playerId === playerId)?.score ?? 0;

describe('penyetaraan ping di papan rebutan', () => {
  it('pemain berping tinggi bisa memenangkan rebutan walau menekan belakangan', () => {
    /*
      Inti keluhannya, dalam satu skenario.

      Yang pingnya 40 ms mengetuk LEBIH DULU. Tanpa penyetaraan ia menang setiap
      kali — dan itu memang yang terjadi sebelumnya, karena server menyelesaikan
      rebutan menurut urutan kedatangan. Dengan penyetaraan, ketukannya ditahan,
      dan yang pingnya 240 ms sempat merebut pixelnya.
    */
    const room = roomDuaPemain(40, 240);
    const match = matchBerjalan(room);
    const pixelId = match.debugPlaceTargetPixel();

    match.handleClick('p1', pixelId);
    // Belum apa-apa: ketukan si cepat sedang ditahan.
    expect(skorDari(match, 'p1')).toBe(0);

    match.handleClick('p2', pixelId);
    expect(skorDari(match, 'p2')).toBeGreaterThan(0);

    // Penahanan si cepat berakhir, dan pixelnya sudah tidak ada lagi.
    vi.advanceTimersByTime(MP_PING_EQUALIZE_CAP_MS + SERVER_TICK_MS * 2);
    expect(skorDari(match, 'p1')).toBe(0);

    vi.useRealTimers();
  });

  it('ketukan yang ditahan tetap dihitung kalau tidak ada yang merebutnya', () => {
    // Penyetaraan MENUNDA, bukan membuang. Kalau tidak diuji, versi yang
    // "adil" tapi diam-diam menelan ketukan akan lolos.
    const room = roomDuaPemain(40, 240);
    const match = matchBerjalan(room);
    const pixelId = match.debugPlaceTargetPixel();

    match.handleClick('p1', pixelId);
    expect(skorDari(match, 'p1')).toBe(0);

    vi.advanceTimersByTime(MP_PING_EQUALIZE_CAP_MS + SERVER_TICK_MS * 2);
    expect(skorDari(match, 'p1')).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('tidak menahan siapa pun saat semua pingnya mirip', () => {
    // Room yang semua pemainnya satu WiFi. Penahanan di situ murni kerugian —
    // tidak ada jurang untuk diperkecil.
    const room = roomDuaPemain(45, 50);
    const match = matchBerjalan(room);
    const pixelId = match.debugPlaceTargetPixel();

    match.handleClick('p1', pixelId);
    expect(skorDari(match, 'p1')).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('bot ikut ditahan, karena ia justru yang paling tidak berjaringan', () => {
    // Bot berjalan di dalam proses server. Kalau ia dikecualikan, penyetaraan
    // ini malah membuat lawan buatan lebih sulit dikalahkan daripada sebelumnya.
    const room = new Room('BBB222', 'p1', 'Lambat', 'fox', { maxPlayers: 2, targetScore: 1000 });
    room.addBot('bot1', 'Bot 1', 'robot', 'medium');
    for (let i = 0; i < 20; i += 1) room.setLatency('p1', 240);

    const match = matchBerjalan(room);
    const papan = match.debugScoreboard();
    const botEntry = papan.find((entry) => entry.playerId === 'bot1');
    const manusia = papan.find((entry) => entry.playerId === 'p1');

    expect(botEntry?.fairDelayMs).toBe(MP_PING_EQUALIZE_CAP_MS);
    expect(manusia?.fairDelayMs).toBe(0);

    vi.useRealTimers();
  });

  it('pemain yang terputus tidak menyeret seisi room ke pingnya', () => {
    /*
      Ping terakhir seseorang yang koneksinya putus biasanya buruk justru karena
      itulah ia putus. Kalau angka itu tetap jadi acuan, seluruh room ditahan
      demi orang yang sudah tidak mengetuk apa pun sampai masa tenggangnya
      habis.
    */
    const room = roomDuaPemain(40, 900);
    const match = matchBerjalan(room);
    expect(match.debugScoreboard().find((e) => e.playerId === 'p1')?.fairDelayMs).toBe(
      MP_PING_EQUALIZE_CAP_MS,
    );

    room.setConnected('p2', false);
    expect(match.debugScoreboard().find((e) => e.playerId === 'p1')?.fairDelayMs).toBe(0);

    vi.useRealTimers();
  });
});
