import { describe, expect, it, vi } from 'vitest';
import { MP_MAX_KNOCKOUTS, MP_STARTING_LIVES, WRONG_CLICK_PENALTY } from '@pixelmatrix/shared';
import { Match } from './Match';
import { Room } from '../rooms/Room';
import type { GameServer } from '../net/handlers';

/**
 * Aturan beregu yang benar-benar mengubah permainan: nyawa satu kolam, beku
 * seregu, eliminasi seregu, dan skor yang dijumlahkan.
 *
 * Diuji lewat `Match` sungguhan dengan Socket.IO tiruan, bukan lewat fungsi
 * kecil di `team.ts`. Fungsi-fungsi itu sudah punya testnya sendiri; yang
 * belum teruji adalah bagaimana keduanya bertemu — dan justru di situ semua
 * kesalahan yang mahal berada.
 */

/** Socket.IO tiruan yang mencatat siapa menerima event apa. */
function fakeIo() {
  const emitted: { to: string; event: string; payload?: unknown }[] = [];
  const io = {
    to(target: string) {
      return {
        emit(event: string, payload?: unknown) {
          emitted.push({ to: target, event, payload });
        },
      };
    },
  };
  return { io: io as unknown as GameServer, emitted };
}

function roomBeregu(anggotaPerRegu = 2): Room {
  const total = anggotaPerRegu * 2;
  const room = new Room('AAA111', 'p1', 'Pemain1', 'fox', {
    maxPlayers: total,
    teamMode: 'teams',
    targetScore: 1000,
  });
  const avatars = ['cat', 'frog', 'owl', 'panda', 'bee', 'shark', 'robot'] as const;
  for (let i = 2; i <= total; i += 1) {
    room.add(`p${i}`, `Pemain${i}`, avatars[i - 2]!);
  }
  return room;
}

/** Match yang sudah berjalan, tanpa menunggu hitung mundur sungguhan. */
function matchBerjalan(room: Room) {
  const { io, emitted } = fakeIo();
  const match = new Match(room, io, () => {});
  vi.useFakeTimers();
  match.start();
  // Hitung mundur COUNTDOWN_SECONDS detik, lalu papan mulai.
  vi.advanceTimersByTime(4000);
  return { match, emitted, selesai: () => vi.useRealTimers() };
}

/**
 * Satu salah tap oleh `playerId`, memakai pixel yang ditaruh khusus untuk itu.
 *
 * Waktunya DIMAJUKAN 200 ms setiap ketukan. Tanpa itu semua klik jatuh di
 * milidetik yang sama dan rate limiter (8 klik/detik) menelan sebagian besarnya
 * — rangkaian 18 salah tap hanya menghasilkan 8 yang benar-benar diproses, dan
 * testnya gagal dengan alasan yang sama sekali tidak berhubungan dengan regu.
 * 200 ms = 5 klik/detik, jauh di bawah batas, dan masih di bawah masa beku 5
 * detik untuk satu rangkaian KO.
 */
function salahTap(match: Match, playerId: string): void {
  vi.advanceTimersByTime(200);
  match.handleClick(playerId, match.debugPlaceWrongPixel());
}

describe('match beregu', () => {
  it('nyawa awal regu = jatah per pemain × jumlah anggota', () => {
    // Jatah per orang PERSIS sama dengan ffa; yang berbeda hanya bahwa
    // jatahnya dikumpulkan jadi satu.
    for (const anggota of [2, 3, 4]) {
      const { match, selesai } = matchBerjalan(roomBeregu(anggota));
      const regu = match.debugTeams();
      expect(regu.find((t) => t.team === 'a')?.maxLives).toBe(MP_STARTING_LIVES * anggota);
      expect(regu.find((t) => t.team === 'b')?.maxLives).toBe(MP_STARTING_LIVES * anggota);
      selesai();
    }
  });

  it('target regu = target per pemain × jumlah anggota', () => {
    const { match, selesai } = matchBerjalan(roomBeregu(3));
    expect(match.debugTeams()[0]?.targetScore).toBe(3000);
    selesai();
  });

  /**
   * Inti dari "nyawa dibagi satu tim".
   *
   * Satu pemain salah tap, dan yang berkurang adalah angka yang juga dipakai
   * ketiga temannya. Kalau ini gagal, mode beregu hanya mode ffa berwarna.
   */
  it('salah tap satu anggota mengurangi kolam SEREGU', () => {
    const room = roomBeregu(2);
    const { match, selesai } = matchBerjalan(room);
    const awal = match.debugTeams().find((t) => t.team === 'a')!.lives;

    salahTap(match, 'p1');

    const sesudah = match.debugTeams().find((t) => t.team === 'a')!.lives;
    expect(sesudah).toBe(awal - 1);
    // Regu seberang tidak ikut berkurang.
    expect(match.debugTeams().find((t) => t.team === 'b')!.lives).toBe(MP_STARTING_LIVES * 2);
    selesai();
  });

  it('skor regu adalah jumlah poin anggotanya', () => {
    const room = roomBeregu(2);
    const { match, selesai } = matchBerjalan(room);
    salahTap(match, 'p1');

    const skorRegu = match.debugTeams().find((t) => t.team === 'a')!.score;
    const jumlahAnggota = match
      .debugScoreboard()
      .filter((e) => e.team === 'a')
      .reduce((total, e) => total + e.score, 0);
    expect(skorRegu).toBe(jumlahAnggota);
    // Skor tidak pernah negatif (`applyPenalty` menjepitnya di 0), jadi satu
    // salah tap dari nol tidak mengubah angkanya — yang berkurang adalah
    // nyawanya. Ditulis eksplisit supaya sifat ini tidak diam-diam hilang.
    expect(skorRegu).toBe(0);
    expect(WRONG_CLICK_PENALTY).toBeGreaterThan(0);
    selesai();
  });

  /**
   * Kolam habis membekukan SELURUH regu, bukan cuma yang menghabiskannya.
   *
   * Ini konsekuensi yang paling terasa dari nyawa bersama, dan yang paling
   * mudah salah diimplementasikan sebagai "yang terakhir salah yang dihukum".
   */
  it('kolam habis membekukan seluruh regu', () => {
    const room = roomBeregu(2);
    const { match, selesai } = matchBerjalan(room);

    // 6 salah tap menghabiskan kolam 2 anggota (3 × 2).
    for (let i = 0; i < MP_STARTING_LIVES * 2; i += 1) {
      salahTap(match, i % 2 === 0 ? 'p1' : 'p3');
    }

    const regu = match.debugTeams().find((t) => t.team === 'a')!;
    expect(regu.knockouts).toBe(1);
    expect(regu.frozenMs).toBeGreaterThan(0);

    // Anggota yang TIDAK menghabiskan nyawa terakhir pun ikut beku.
    const board = match.debugScoreboard();
    for (const id of ['p1', 'p3']) {
      expect(board.find((e) => e.playerId === id)?.frozenMs).toBeGreaterThan(0);
    }
    selesai();
  });

  it('ketukan saat regu beku diabaikan', () => {
    const room = roomBeregu(2);
    const { match, selesai } = matchBerjalan(room);
    for (let i = 0; i < MP_STARTING_LIVES * 2; i += 1) {
      salahTap(match, 'p1');
    }
    const skorSebelum = match.debugTeams().find((t) => t.team === 'a')!.score;

    // Rekannya mencoba mengetuk saat regunya beku.
    salahTap(match, 'p3');
    expect(match.debugTeams().find((t) => t.team === 'a')!.score).toBe(skorSebelum);
    selesai();
  });

  /**
   * Jatah kesalahan per pemain SAMA PERSIS dengan mode ffa.
   *
   * 3 nyawa × 3 KO = 9 salah tap sebelum keluar, entah sendirian atau
   * berempat. Ini yang membuat mode beregu tidak perlu diseimbangkan ulang dari
   * nol — yang berubah hanya siapa yang menanggung kesalahan siapa.
   */
  it('regu tereliminasi setelah KO ke-3, dengan jatah yang sama seperti ffa', () => {
    const room = roomBeregu(2);
    const { match, selesai } = matchBerjalan(room);
    const perKo = MP_STARTING_LIVES * 2;

    for (let ko = 0; ko < MP_MAX_KNOCKOUTS; ko += 1) {
      for (let i = 0; i < perKo; i += 1) salahTap(match, 'p1');
      // Cairkan bekunya supaya KO berikutnya bisa terjadi.
      match.debugThaw();
    }

    const regu = match.debugTeams().find((t) => t.team === 'a')!;
    expect(regu.knockouts).toBe(MP_MAX_KNOCKOUTS);
    expect(regu.eliminated).toBe(true);

    // Total salah tap = 3 nyawa × 3 KO × 2 anggota = 18, yaitu 9 per orang —
    // sama dengan jatah satu pemain di mode ffa.
    expect(perKo * MP_MAX_KNOCKOUTS).toBe(MP_STARTING_LIVES * MP_MAX_KNOCKOUTS * 2);
    selesai();
  });

  it('setiap anggota diberi tahu saat regunya tereliminasi', () => {
    // Pesan yang hanya sampai ke satu orang membuat rekannya melihat papan
    // yang mendadak tidak merespons tanpa penjelasan apa pun.
    const room = roomBeregu(2);
    const { match, emitted, selesai } = matchBerjalan(room);
    for (let ko = 0; ko < MP_MAX_KNOCKOUTS; ko += 1) {
      for (let i = 0; i < MP_STARTING_LIVES * 2; i += 1) salahTap(match, 'p1');
      match.debugThaw();
    }
    const diberiTahu = emitted.filter((e) => e.event === 'game:eliminated').map((e) => e.to);
    expect(diberiTahu).toContain('p1');
    expect(diberiTahu).toContain('p3');
    selesai();
  });

  it('nyawa pribadi dikirim null supaya UI tidak salah membacanya', () => {
    // Nilai palsu yang kelihatan masuk akal jauh lebih berbahaya daripada
    // tidak ada nilai sama sekali.
    const { match, selesai } = matchBerjalan(roomBeregu(2));
    for (const entry of match.debugScoreboard()) expect(entry.lives).toBeNull();
    selesai();
  });

  it('mode ffa tidak menumbuhkan regu sama sekali', () => {
    const room = new Room('AAA111', 'p1', 'Pemain1', 'fox', { maxPlayers: 4 });
    room.add('p2', 'Pemain2', 'cat');
    const { match, selesai } = matchBerjalan(room);
    expect(match.debugTeams()).toEqual([]);
    // Dan nyawanya kembali jadi milik pribadi.
    expect(match.debugScoreboard()[0]?.lives).toBe(MP_STARTING_LIVES);
    selesai();
  });
});
