import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  CHAT_HISTORY_LIMIT,
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
} from '@pixelmatrix/shared';
import type { ChatMessage } from '@pixelmatrix/shared';
import { normalizeSettings, Room } from './Room';

describe('normalizeSettings', () => {
  /**
   * Test yang paling penting di file ini.
   *
   * Kalau lapisan validasi meloloskan sebuah pilihan tapi normalisasi
   * mengubahnya, hasilnya adalah kegagalan yang paling buruk jenisnya: host
   * memilih sesuatu, mendapat yang lain, dan tidak ada error di mana pun. Itu
   * persis yang terjadi ketika daftar target skor dinaikkan sampai 1500
   * sementara batas atas clamp masih 1000 — dan tidak ada satu pun test yang
   * menangkapnya.
   */
  it('setiap pilihan yang diizinkan lolos tanpa berubah nilainya', () => {
    for (const targetScore of ALLOWED_TARGET_SCORES) {
      expect(normalizeSettings({ targetScore }).targetScore).toBe(targetScore);
    }
    for (const timeLimitSec of ALLOWED_TIME_LIMITS_SEC) {
      expect(normalizeSettings({ timeLimitSec }).timeLimitSec).toBe(timeLimitSec);
    }
    for (let maxPlayers = MIN_PLAYERS_TO_START; maxPlayers <= MAX_PLAYERS_LIMIT; maxPlayers += 1) {
      expect(normalizeSettings({ maxPlayers }).maxPlayers).toBe(maxPlayers);
    }
  });

  it('tanpa patch menghasilkan pengaturan default', () => {
    expect(normalizeSettings()).toEqual(DEFAULT_ROOM_SETTINGS);
  });

  it('nilai di luar rentang dijepit, bukan diterima', () => {
    // Zod sudah menolak nilai-nilai ini di lapisan net; clamp adalah jaring
    // kedua untuk pemanggil internal yang tidak lewat sana.
    expect(normalizeSettings({ maxPlayers: 99 }).maxPlayers).toBe(MAX_PLAYERS_LIMIT);
    expect(normalizeSettings({ maxPlayers: 0 }).maxPlayers).toBe(MIN_PLAYERS_TO_START);
    expect(normalizeSettings({ targetScore: 10_000 }).targetScore).toBe(
      Math.max(...ALLOWED_TARGET_SCORES),
    );
    expect(normalizeSettings({ timeLimitSec: 1 }).timeLimitSec).toBe(
      Math.min(...ALLOWED_TIME_LIMITS_SEC),
    );
  });

  it('nilai bukan-angka jatuh ke batas bawah, tidak menghasilkan NaN', () => {
    // NaN yang lolos ke pengaturan match akan membuat perbandingan skor selalu
    // false, dan match tidak akan pernah berakhir.
    const settings = normalizeSettings({
      maxPlayers: Number.NaN,
      targetScore: Number.POSITIVE_INFINITY,
      timeLimitSec: Number.NaN,
    });
    expect(settings.maxPlayers).toBe(MIN_PLAYERS_TO_START);
    expect(settings.targetScore).toBe(Math.min(...ALLOWED_TARGET_SCORES));
    expect(settings.timeLimitSec).toBe(Math.min(...ALLOWED_TIME_LIMITS_SEC));
  });
});

describe('koneksi pemain & masa tenggang', () => {
  const lobby = () => {
    const room = new Room('ABC123', 'p1', 'Budi', 'fox');
    room.add('p2', 'Siti', 'cat');
    return room;
  };

  it('pemain yang putus TETAP menempati kursinya', () => {
    // Inti dari reconnect. Kalau ia hilang dari room, tidak ada yang bisa
    // diklaim kembali dan skornya di match ikut lenyap.
    const room = lobby();
    room.setConnected('p2', false);
    expect(room.has('p2')).toBe(true);
    expect(room.playerCount).toBe(2);
    expect(room.get('p2')?.connected).toBe(false);
  });

  it('pemain yang putus tidak dihitung sebagai tersambung', () => {
    const room = lobby();
    room.setConnected('p2', false);
    expect(room.connectedPlayers().map((p) => p.id)).toEqual(['p1']);
  });

  /**
   * Test terpenting di blok ini.
   *
   * Kalau canStart menghitung SEMUA pemain, satu orang yang kehilangan sinyal
   * menyandera seluruh room selama masa tenggang: ia tidak bisa menekan siap,
   * dan tidak ada seorang pun yang bisa memulai match.
   */
  it('pemain yang putus tidak menghalangi match dimulai', () => {
    const room = new Room('ABC123', 'p1', 'Budi', 'fox');
    room.add('p2', 'Siti', 'cat');
    room.add('p3', 'Andi', 'frog');
    room.setReady('p1', true);
    room.setReady('p2', true);
    // p3 belum siap dan koneksinya putus.
    room.setConnected('p3', false);
    expect(room.canStart()).toBe(true);
  });

  it('match tidak bisa dimulai kalau yang tersambung kurang dari dua', () => {
    const room = lobby();
    room.setReady('p1', true);
    room.setReady('p2', true);
    room.setConnected('p2', false);
    expect(room.canStart()).toBe(false);
  });

  it('kesiapan dicabut saat koneksi putus', () => {
    // Pemain yang putus tidak bisa membatalkan kesiapannya sendiri. Dibiarkan
    // "siap", match bisa berjalan tanpa dia benar-benar hadir.
    const room = lobby();
    room.setReady('p2', true);
    room.setConnected('p2', false);
    expect(room.get('p2')?.isReady).toBe(false);
  });

  it('host yang putus dipindahkan ke pemain yang tersambung', () => {
    const room = lobby();
    room.setConnected('p1', false);
    expect(room.host).toBe('p2');
  });

  it('host tidak diambil kembali saat pemiliknya tersambung lagi', () => {
    const room = lobby();
    room.setConnected('p1', false);
    room.setConnected('p1', true);
    expect(room.host).toBe('p2');
  });

  it('host tidak diserahkan ke pemain yang juga sedang putus', () => {
    const room = new Room('ABC123', 'p1', 'Budi', 'fox');
    room.add('p2', 'Siti', 'cat');
    room.add('p3', 'Andi', 'frog');
    room.setConnected('p2', false);
    room.setConnected('p1', false);
    expect(room.host).toBe('p3');
  });

  it('menandai pemain yang tidak ada mengembalikan false', () => {
    expect(lobby().setConnected('hantu', false)).toBe(false);
  });

  it('toState membawa status koneksi ke client', () => {
    const room = lobby();
    room.setConnected('p2', false);
    const state = room.toState();
    expect(state.players.find((p) => p.id === 'p2')?.connected).toBe(false);
    expect(state.players.find((p) => p.id === 'p1')?.connected).toBe(true);
  });
});

describe('chat lobby', () => {
  const message = (text: string, playerId = 'p1'): ChatMessage => ({
    id: `m-${text}`,
    playerId,
    nickname: 'Budi',
    avatar: 'fox',
    text,
    at: Date.now(),
  });

  const twoPlayers = () => {
    const room = new Room('ABC123', 'p1', 'Budi', 'fox');
    room.add('p2', 'Siti', 'cat');
    return room;
  };

  it('chat mati kalau baru satu pemain', () => {
    // Mengirim pesan ke ruang kosong hanya membuat orang bertanya-tanya apakah
    // chat-nya rusak.
    expect(new Room('ABC123', 'p1', 'Budi', 'fox').canChat()).toBe('tooFewPlayers');
  });

  it('chat hidup begitu ada dua pemain di lobby', () => {
    expect(twoPlayers().canChat()).toBe('ok');
  });

  it('chat mati saat match berjalan', () => {
    // Game refleks: teks yang bergerak di tengah ronde bukan fitur.
    const room = twoPlayers();
    room.setStatus('playing');
    expect(room.canChat()).toBe('playing');
  });

  it('chat mati saat hitung mundur', () => {
    const room = twoPlayers();
    room.setStatus('countdown');
    expect(room.canChat()).toBe('playing');
  });

  it('chat hidup lagi di layar hasil', () => {
    // `finished` masih "di dalam room, tidak sedang bermain" — justru momen
    // orang paling ingin berkomentar soal hasilnya.
    const room = twoPlayers();
    room.setStatus('finished');
    expect(room.canChat()).toBe('ok');
  });

  it('pemain yang terputus tidak dihitung sebagai lawan bicara', () => {
    const room = twoPlayers();
    room.setConnected('p2', false);
    expect(room.canChat()).toBe('tooFewPlayers');
  });

  it('riwayat dipotong di CHAT_HISTORY_LIMIT', () => {
    // Room bisa hidup lama lewat berkali-kali rematch. Tanpa pemotongan ini,
    // riwayatnya tumbuh selama room itu ada.
    const room = twoPlayers();
    for (let i = 0; i < CHAT_HISTORY_LIMIT + 15; i += 1) room.addChatMessage(message(String(i)));

    const log = room.recentChat();
    expect(log).toHaveLength(CHAT_HISTORY_LIMIT);
    // Yang dibuang adalah yang PALING LAMA, bukan yang paling baru.
    expect(log.at(-1)?.text).toBe(String(CHAT_HISTORY_LIMIT + 14));
    expect(log[0]?.text).toBe('15');
  });

  it('riwayat yang dikembalikan adalah salinan', () => {
    // Kalau array internalnya yang dikembalikan, pemanggil bisa mengubah
    // riwayat room dari luar tanpa melewati addChatMessage.
    const room = twoPlayers();
    room.addChatMessage(message('halo'));
    const log = room.recentChat() as ChatMessage[];
    log.push(message('selundupan'));
    expect(room.recentChat()).toHaveLength(1);
  });
});
