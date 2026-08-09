import type { BotDifficulty } from '../engine/bot';

export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

/**
 * Karakter yang dipilih pemain sebelum masuk room.
 *
 * Gunanya bukan hiasan: glyph-nya dicap di sel yang baru direbut, jadi kamu
 * langsung tahu SIAPA yang menyerobot pixel itu. Karena itu setiap pemain di
 * satu room harus punya avatar yang berbeda.
 */
export type AvatarId =
  | 'fox'
  | 'cat'
  | 'frog'
  | 'owl'
  | 'panda'
  | 'bee'
  | 'shark'
  | 'robot'
  | 'dog'
  | 'monkey'
  | 'lion'
  | 'penguin'
  | 'unicorn'
  | 'octopus'
  | 'dino'
  | 'dragon';

/**
 * Regu di match beregu. Dua sisi, dan hanya dua.
 *
 * Bukan `number`: id yang bertipe angka mengundang tim ketiga masuk diam-diam
 * lewat aritmetika (`(t + 1) % n`), sementara seluruh aturan di bawahnya —
 * "tinggal satu tim yang hidup", "seri di puncak", pembagian target — ditulis
 * untuk dua sisi. Kalau suatu saat mau tiga tim, tipe ini yang harus diubah
 * lebih dulu, dan setiap tempat yang belum siap akan ketahuan dari compiler.
 */
export type TeamId = 'a' | 'b';

/**
 * Cara match dimainkan.
 *
 * `ffa` (free-for-all) adalah mode yang sudah ada sejak awal: semua lawan
 * semua. `teams` membagi pemain jadi dua regu dan menjumlahkan poin mereka.
 * Disimpan sebagai string, bukan boolean `isTeams`, supaya mode berikutnya
 * (misalnya tiga regu, atau co-op lawan papan) tidak perlu membongkar
 * seluruh pengaturan room.
 */
export type TeamMode = 'ffa' | 'teams';

export interface RoomSettings {
  readonly maxPlayers: number;
  readonly targetScore: number;
  readonly timeLimitSec: number;
  readonly teamMode: TeamMode;
}

export interface Player {
  readonly id: string;
  readonly nickname: string;
  readonly avatar: AvatarId;
  readonly isHost: boolean;
  readonly isReady: boolean;
  readonly score: number;
  readonly combo: number;
  readonly connected: boolean;
  /**
   * Latensi bolak-balik dalam ms, `null` kalau belum sempat terukur.
   *
   * DIUKUR SERVER, bukan dilaporkan client. Kalau client yang melapor, angkanya
   * jadi klaim yang tidak bisa diperiksa — dan di papan rebutan, latensi adalah
   * hal yang paling masuk akal untuk dibohongi.
   */
  readonly latencyMs: number | null;
  /**
   * Tingkat kesulitan kalau kursi ini diisi bot; `null` untuk manusia.
   *
   * Selalu ditampilkan di UI. Menyembunyikan bahwa lawanmu bukan orang berarti
   * skor yang kamu kalahkan tidak berarti apa-apa — dan pemain akan tahu
   * sendiri dalam dua ronde, lalu berhenti percaya pada papan skornya.
   */
  readonly bot: BotDifficulty | null;
  /**
   * Regu pemain ini; `null` di mode `ffa`.
   *
   * Tetap dikirim ke client walau mode-nya ffa (sebagai `null`) alih-alih
   * dihilangkan dari payload — UI yang harus memeriksa "ada field ini atau
   * tidak" sebelum memakainya akan salah menampilkan pemain tanpa regu sebagai
   * regu pertama begitu ada satu tempat yang lupa memeriksanya.
   */
  readonly team: TeamId | null;
}

export interface RoomState {
  readonly roomCode: string;
  readonly hostId: string;
  readonly players: readonly Player[];
  readonly settings: RoomSettings;
  readonly status: RoomStatus;
}

/** Satu baris regu di layar hasil match beregu. */
export interface TeamResultEntry {
  readonly team: TeamId;
  readonly rank: number;
  /** Jumlah poin seluruh anggota — inilah yang menentukan menang atau kalah. */
  readonly score: number;
  readonly eliminated: boolean;
}

/** Satu baris di layar hasil match (GDD §5). */
export interface MatchResultEntry {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: AvatarId;
  readonly score: number;
  readonly rank: number;
  /** 0..1 — klik benar dibagi total klik. */
  readonly accuracy: number;
  readonly bestCombo: number;
  /** Berapa kali nyawanya habis sepanjang match. */
  readonly knockouts: number;
  /**
   * Tereliminasi sebelum match usai.
   *
   * Pemain yang tereliminasi SELALU berada di bawah pemain yang bertahan,
   * berapa pun skornya — keluar dari permainan lebih berat daripada kalah
   * angka, dan tanpa aturan ini "bunuh diri sambil unggul skor" jadi strategi.
   */
  readonly eliminated: boolean;
  /**
   * Akun pemilik hasil ini, kalau pemainnya login. `null` untuk guest.
   *
   * Tidak dikirim ke client mana pun — hanya dipakai server saat menulis
   * riwayat. Lihat catatan di `matchStore`.
   */
  readonly userId?: string | null;
}
