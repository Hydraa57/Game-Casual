import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  CHAT_HISTORY_LIMIT,
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
} from '@pixelmatrix/shared';
import type { BotDifficulty, ChatMessage } from '@pixelmatrix/shared';
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

describe('lawan bot', () => {
  const withBot = (difficulty: BotDifficulty = 'medium') => {
    const room = new Room('ABC123', 'p1', 'Budi', 'fox');
    room.addBot('bot-1', 'Bot 1', 'robot', difficulty);
    return room;
  };

  it('bot menempati kursi sungguhan, bukan daftar terpisah', () => {
    // Kalau bot ada di daftar sendiri, setiap aturan lobby harus ditulis dua
    // kali — dan yang kedua pasti akan tertinggal.
    const room = withBot();
    expect(room.playerCount).toBe(2);
    expect(room.has('bot-1')).toBe(true);
    expect(room.humanPlayers()).toHaveLength(1);
    expect(room.botPlayers()).toHaveLength(1);
  });

  it('bot selalu siap, karena tidak punya tombol untuk menekannya', () => {
    const room = withBot();
    expect(room.get('bot-1')?.isReady).toBe(true);

    // Termasuk setelah match selesai: reset kesiapan tidak boleh membuat
    // rematch mustahil dimulai.
    room.resetReady();
    expect(room.get('bot-1')?.isReady).toBe(true);
    expect(room.get('p1')?.isReady).toBe(false);
  });

  it('satu manusia + satu bot sudah cukup untuk mulai', () => {
    // Ini seluruh alasan fitur ini ada.
    const room = withBot();
    room.setReady('p1', true);
    expect(room.canStart()).toBe(true);
  });

  it('room berisi bot saja TIDAK bisa memulai match', () => {
    // Tanpa syarat ini, match antar-bot bisa berjalan terus memakan tick
    // server tanpa ada seorang pun yang menontonnya.
    const room = new Room('ABC123', 'p1', 'Budi', 'fox');
    room.addBot('bot-1', 'Bot 1', 'robot', 'medium');
    room.addBot('bot-2', 'Bot 2', 'bee', 'hard');
    room.remove('p1');
    expect(room.playerCount).toBe(2);
    expect(room.canStart()).toBe(false);
  });

  it('host tidak pernah jatuh ke bot', () => {
    // Bot tidak bisa menekan "mulai" maupun mengubah pengaturan; menyerahkan
    // host kepadanya mengunci room secara permanen.
    const room = new Room('ABC123', 'p1', 'Budi', 'fox');
    room.addBot('bot-1', 'Bot 1', 'robot', 'medium');
    room.add('p2', 'Siti', 'cat');

    room.remove('p1');
    expect(room.host).toBe('p2');

    // Sama saat host cuma terputus, bukan keluar.
    room.setConnected('p2', false);
    expect(room.host).toBe('p2');
  });

  it('chat tetap tertutup kalau yang menemani cuma bot', () => {
    // Bot tidak membaca apa pun. Membuka chat karena ada bot di lobby sama
    // saja dengan menyuruh pemain bicara sendiri.
    const room = withBot();
    expect(room.canChat()).toBe('tooFewPlayers');

    room.add('p2', 'Siti', 'cat');
    expect(room.canChat()).toBe('ok');
  });

  it('removeBot menolak id manusia', () => {
    // Kalau tidak, event `room:removeBot` menjadi pintu belakang buat host
    // menendang pemain manusia.
    const room = withBot();
    expect(room.removeBot('p1')).toBe(false);
    expect(room.has('p1')).toBe(true);
    expect(room.removeBot('bot-1')).toBe(true);
    expect(room.has('bot-1')).toBe(false);
  });

  it('tingkat kesulitannya ikut disiarkan ke semua orang', () => {
    // Menyembunyikan bahwa lawanmu bukan orang berarti skor yang kamu
    // kalahkan tidak berarti apa-apa.
    const state = withBot('hard').toState();
    expect(state.players.find((p) => p.id === 'bot-1')?.bot).toBe('hard');
    expect(state.players.find((p) => p.id === 'p1')?.bot).toBeNull();
  });
});

describe('regu', () => {
  /** Room beregu berisi `total` pemain, semuanya siap. */
  function beregu(total: number, maxPlayers = total): Room {
    const room = new Room('AAA111', 'p1', 'Budi', 'fox', { maxPlayers, teamMode: 'teams' });
    for (let i = 2; i <= total; i += 1) room.add(`p${i}`, `Pemain${i}`, 'cat');
    for (const player of room.allPlayers()) room.setReady(player.id, true);
    return room;
  }

  it('membagi pemain rata saat mereka masuk', () => {
    expect(beregu(4).teamCounts()).toEqual({ a: 2, b: 2 });
    expect(beregu(6).teamCounts()).toEqual({ a: 3, b: 3 });
    expect(beregu(8).teamCounts()).toEqual({ a: 4, b: 4 });
  });

  /**
   * Bot lewat jalur penyeimbang yang SAMA dengan manusia.
   *
   * Kalau bot punya aturannya sendiri, ia akan jadi kasus khusus yang cepat
   * atau lambat lupa diperbarui — dan hasilnya lobby timpang yang tidak bisa
   * dimulai tanpa ada yang tahu kenapa.
   */
  it('bot ikut diseimbangkan seperti pemain biasa', () => {
    const room = new Room('AAA111', 'p1', 'Budi', 'fox', { maxPlayers: 4, teamMode: 'teams' });
    room.addBot('bot-1', 'Bot 1', 'cat', 'medium');
    room.addBot('bot-2', 'Bot 2', 'frog', 'medium');
    room.addBot('bot-3', 'Bot 3', 'owl', 'medium');
    expect(room.teamCounts()).toEqual({ a: 2, b: 2 });
  });

  it('pindah regu ditolak kalau tujuannya penuh', () => {
    const room = beregu(4);
    // a sudah berisi 2 dari kapasitas 2.
    const diB = room.allPlayers().find((p) => p.team === 'b')!;
    expect(room.setTeam(diB.id, 'a')).toBe('rejected');
    expect(room.get(diB.id)?.team).toBe('b');
  });

  it('pindah regu membatalkan kesiapan', () => {
    // Susunan regu bagian dari apa yang disetujui saat menekan "siap".
    const room = beregu(4, 8);
    const diA = room.allPlayers().find((p) => p.team === 'a')!;
    expect(room.get(diA.id)?.isReady).toBe(true);
    // Lewat handler kesiapan direset; di sini yang diuji perpindahannya sendiri.
    expect(room.setTeam(diA.id, 'b')).toBe('moved');
    expect(room.get(diA.id)?.team).toBe('b');
  });

  it('pindah regu ditolak saat match berjalan', () => {
    const room = beregu(4);
    room.setStatus('playing');
    const diA = room.allPlayers().find((p) => p.team === 'a')!;
    expect(room.setTeam(diA.id, 'b')).toBe('rejected');
  });

  /**
   * Bug yang ditemukan verifikasi end-to-end, bukan oleh unit test.
   *
   * Versi pertama mengembalikan boolean, jadi "pindah ke regu yang sudah
   * kutempati" terbaca sebagai perpindahan yang berhasil — dan handler
   * membatalkan kesiapan pemain itu. Lobby 4v4 yang sudah siap semua tiba-tiba
   * kembali menunggu satu orang, tanpa ada satu pun yang berubah di layar.
   */
  it('pindah ke regu sendiri bukan perpindahan', () => {
    const room = beregu(4);
    const diA = room.allPlayers().find((p) => p.team === 'a')!;
    expect(room.setTeam(diA.id, 'a')).toBe('unchanged');
    expect(room.get(diA.id)?.team).toBe('a');
  });

  it('tidak bisa mulai kalau regunya timpang', () => {
    const room = beregu(4, 8);
    expect(room.canStart()).toBe(true);
    const diA = room.allPlayers().find((p) => p.team === 'a')!;
    room.setTeam(diA.id, 'b');
    room.setReady(diA.id, true);
    expect(room.teamCounts()).toEqual({ a: 1, b: 3 });
    expect(room.canStart()).toBe(false);
    expect(room.startBlocker()).toBe('unevenTeams');
  });

  /**
   * Kenapa alasannya dibedakan: lobby 3v1 yang sudah penuh akan menampilkan
   * "kurang pemain" kalau keduanya memakai kode yang sama, dan tidak ada
   * seorang pun yang akan menebak bahwa yang harus dilakukan adalah pindah sisi.
   */
  it('membedakan regu timpang dari kurang pemain', () => {
    const kurang = new Room('AAA111', 'p1', 'Budi', 'fox', { teamMode: 'teams' });
    kurang.setReady('p1', true);
    expect(kurang.startBlocker()).toBe('tooFewPlayers');

    const belumSiap = beregu(4);
    belumSiap.setReady('p2', false);
    expect(belumSiap.startBlocker()).toBe('notAllReady');
  });

  it('mode ffa tidak peduli susunan regu', () => {
    const room = new Room('AAA111', 'p1', 'Budi', 'fox', { maxPlayers: 4 });
    room.add('p2', 'Siti', 'cat');
    room.add('p3', 'Agus', 'frog');
    for (const player of room.allPlayers()) room.setReady(player.id, true);
    // 2v1 — tidak sah untuk beregu, tapi ffa memang tidak memakai regu.
    expect(room.currentSettings.teamMode).toBe('ffa');
    expect(room.canStart()).toBe(true);
  });

  it('regu tidak dikirim ke client saat mode ffa', () => {
    const room = new Room('AAA111', 'p1', 'Budi', 'fox');
    expect(room.toState().players[0]?.team).toBeNull();
    room.updateSettings({ teamMode: 'teams' });
    expect(room.toState().players[0]?.team).toBe('a');
  });

  it('kapasitas ganjil dibulatkan ke atas di mode beregu', () => {
    // Ke ATAS: host yang memilih 5 hampir pasti berpikir "lima orang mau main",
    // dan menurunkannya ke 4 menutup pintu untuk orang kelima diam-diam.
    expect(normalizeSettings({ teamMode: 'teams', maxPlayers: 5 }).maxPlayers).toBe(6);
    expect(normalizeSettings({ teamMode: 'teams', maxPlayers: 7 }).maxPlayers).toBe(8);
    expect(normalizeSettings({ teamMode: 'teams', maxPlayers: 3 }).maxPlayers).toBe(4);
    // Sudah genap: dibiarkan.
    expect(normalizeSettings({ teamMode: 'teams', maxPlayers: 6 }).maxPlayers).toBe(6);
  });
});
