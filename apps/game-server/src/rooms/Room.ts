import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
} from '@pixelmatrix/shared';
import type { AvatarId, Player, RoomSettings, RoomState, RoomStatus } from '@pixelmatrix/shared';

export interface RoomPlayer {
  readonly id: string;
  nickname: string;
  avatar: AvatarId;
  isReady: boolean;
  connected: boolean;
  /**
   * Akun pemilik, kalau identitasnya terbukti lewat token bertanda tangan.
   * `null` untuk guest — dan guest adalah cara main yang sepenuhnya sah.
   */
  userId: string | null;
}

/**
 * Satu room: daftar pemain, pengaturan, dan status lobby.
 *
 * Kelas ini sengaja TIDAK tahu apa pun soal Socket.IO. Semua penyiaran event
 * dilakukan di lapisan `net/`, supaya aturan lobby bisa diuji tanpa jaringan.
 */
export class Room {
  readonly code: string;
  private readonly players = new Map<string, RoomPlayer>();
  private hostId: string;
  private settings: RoomSettings;
  private status: RoomStatus = 'waiting';

  constructor(
    code: string,
    hostId: string,
    hostNickname: string,
    hostAvatar: AvatarId,
    settings?: Partial<RoomSettings>,
    hostUserId: string | null = null,
  ) {
    this.code = code;
    this.hostId = hostId;
    this.settings = normalizeSettings(settings);
    this.players.set(hostId, {
      id: hostId,
      nickname: hostNickname,
      avatar: hostAvatar,
      isReady: false,
      connected: true,
      userId: hostUserId,
    });
  }

  get playerCount(): number {
    return this.players.size;
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  get isFull(): boolean {
    return this.players.size >= this.settings.maxPlayers;
  }

  get currentStatus(): RoomStatus {
    return this.status;
  }

  get currentSettings(): RoomSettings {
    return this.settings;
  }

  get host(): string {
    return this.hostId;
  }

  isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  has(playerId: string): boolean {
    return this.players.has(playerId);
  }

  get(playerId: string): RoomPlayer | undefined {
    return this.players.get(playerId);
  }

  allPlayers(): readonly RoomPlayer[] {
    return [...this.players.values()];
  }

  /**
   * Pemain yang socket-nya sedang hidup.
   *
   * Dibedakan dari `allPlayers()` karena pemain yang sedang putus TETAP menempati
   * kursinya — itu inti dari reconnect. Tapi ia tidak bisa menekan tombol siap,
   * jadi setiap aturan lobby yang menuntut tindakan pemain harus memakai daftar
   * ini, bukan daftar semua.
   */
  connectedPlayers(): readonly RoomPlayer[] {
    return this.allPlayers().filter((player) => player.connected);
  }

  /**
   * Tandai koneksi pemain. Mengembalikan `false` kalau pemainnya sudah tidak ada.
   *
   * Host yang putus DIPINDAHKAN ke pemain lain yang masih tersambung: kalau
   * tidak, seluruh room macet menunggu orang yang tidak bisa menekan apa pun.
   * Ia tidak mendapatkannya kembali saat reconnect — merebut host dari orang
   * yang sudah memegangnya justru lebih mengagetkan daripada membiarkannya.
   */
  setConnected(playerId: string, connected: boolean): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.connected = connected;
    if (!connected) {
      // Pemain yang putus tidak bisa membatalkan kesiapannya sendiri. Dibiarkan
      // "siap", match yang belum mulai bisa berjalan tanpa dia hadir.
      player.isReady = false;
      if (this.hostId === playerId) {
        const next = this.connectedPlayers()[0];
        if (next) this.hostId = next.id;
      }
    }
    return true;
  }

  hasNickname(nickname: string): boolean {
    const wanted = nickname.trim().toLowerCase();
    return this.allPlayers().some((player) => player.nickname.trim().toLowerCase() === wanted);
  }

  /** Avatar yang sudah dipakai di room ini — dipakai untuk menjaga keunikannya. */
  takenAvatars(): readonly AvatarId[] {
    return this.allPlayers().map((player) => player.avatar);
  }

  add(playerId: string, nickname: string, avatar: AvatarId, userId: string | null = null): void {
    this.players.set(playerId, {
      id: playerId,
      nickname,
      avatar,
      isReady: false,
      connected: true,
      userId,
    });
  }

  /**
   * Keluarkan pemain. Kalau yang keluar adalah host, host dipindahkan ke pemain
   * berikutnya supaya room tidak macet tanpa siapa pun yang bisa memulai match.
   */
  remove(playerId: string): void {
    this.players.delete(playerId);
    if (this.hostId === playerId) {
      // Yang tersambung didahulukan: menyerahkan host ke pemain yang sedang
      // putus akan membuat room macet sampai masa tenggangnya habis.
      const next = this.connectedPlayers()[0] ?? this.allPlayers()[0];
      if (next) this.hostId = next.id;
    }
  }

  setReady(playerId: string, ready: boolean): void {
    const player = this.players.get(playerId);
    if (player) player.isReady = ready;
  }

  updateSettings(patch: Partial<RoomSettings>): RoomSettings {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    return this.settings;
  }

  setStatus(status: RoomStatus): void {
    this.status = status;
  }

  /**
   * Semua pemain siap dan jumlahnya cukup — syarat host boleh memulai.
   *
   * Hanya pemain yang TERSAMBUNG yang dihitung. Kalau tidak, satu orang yang
   * kehilangan sinyal di lobby akan menyandera seluruh room selama masa
   * tenggang: ia tidak bisa menekan siap, dan tidak ada yang bisa memulai.
   */
  canStart(): boolean {
    const ready = this.connectedPlayers();
    return (
      this.status === 'waiting' &&
      ready.length >= MIN_PLAYERS_TO_START &&
      ready.every((player) => player.isReady)
    );
  }

  /** Reset kesiapan setelah match selesai, supaya rematch butuh konfirmasi ulang. */
  resetReady(): void {
    for (const player of this.players.values()) player.isReady = false;
  }

  toState(scores: ReadonlyMap<string, { score: number; combo: number }> = new Map()): RoomState {
    const players: Player[] = this.allPlayers().map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      isHost: player.id === this.hostId,
      isReady: player.isReady,
      score: scores.get(player.id)?.score ?? 0,
      combo: scores.get(player.id)?.combo ?? 0,
      connected: player.connected,
    }));

    return {
      roomCode: this.code,
      hostId: this.hostId,
      players,
      settings: this.settings,
      status: this.status,
    };
  }
}

/**
 * Jepit pengaturan ke rentang yang sah — client tidak pernah dipercaya.
 *
 * Batasnya DITURUNKAN dari daftar pilihan yang diizinkan, bukan ditulis sebagai
 * angka. Versi pertama memakai angka langsung (`50, 1000` untuk target skor),
 * dan begitu daftar pilihannya dinaikkan sampai 1500, batas atas 1000 itu
 * diam-diam menurunkan pilihan host tanpa satu pun error: zod meloloskan 1500
 * karena ia ada di daftar, lalu clamp memotongnya ke 1000. Host memilih 1500,
 * mendapat 1000, dan tidak ada apa pun yang memberi tahu.
 *
 * Dua sumber kebenaran untuk hal yang sama selalu berakhir seperti itu. Sekarang
 * hanya ada satu, dan `Room.test.ts` menjaga agar setiap pilihan yang diizinkan
 * benar-benar lolos tanpa berubah nilainya.
 */
export function normalizeSettings(patch?: Partial<RoomSettings>): RoomSettings {
  const merged = { ...DEFAULT_ROOM_SETTINGS, ...patch };
  return {
    maxPlayers: clamp(merged.maxPlayers, MIN_PLAYERS_TO_START, MAX_PLAYERS_LIMIT),
    targetScore: clamp(
      merged.targetScore,
      Math.min(...ALLOWED_TARGET_SCORES),
      Math.max(...ALLOWED_TARGET_SCORES),
    ),
    timeLimitSec: clamp(
      merged.timeLimitSec,
      Math.min(...ALLOWED_TIME_LIMITS_SEC),
      Math.max(...ALLOWED_TIME_LIMITS_SEC),
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
