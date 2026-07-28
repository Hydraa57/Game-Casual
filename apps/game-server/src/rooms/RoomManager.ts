import { randomUUID } from 'node:crypto';
import { botDisplayName } from '@pixelmatrix/shared';
import type { AvatarId, BotDifficulty, RoomSettings } from '@pixelmatrix/shared';
import { resolveAvatar } from './avatar';
import { Room } from './Room';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode';

export type JoinFailure = 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_IN_PROGRESS' | 'NICKNAME_TAKEN';

export type JoinResult = { ok: true; room: Room } | { ok: false; code: JoinFailure };

/**
 * Menyimpan seluruh room aktif di memori.
 *
 * Sengaja belum ada persistensi: room hidup selama match dan hilang begitu
 * kosong. Kalau nanti perlu lebih dari satu instance server, ini titik yang
 * diganti dengan Redis (lihat ARCHITECTURE.md §6) — pemanggilnya tidak berubah.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Peta pemain → kode room, supaya `leave` dan `disconnect` tidak perlu memindai. */
  private readonly playerRooms = new Map<string, string>();

  constructor(private readonly random: () => number = Math.random) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  get playerCount(): number {
    return this.playerRooms.size;
  }

  create(
    hostId: string,
    nickname: string,
    avatar: AvatarId,
    settings?: Partial<RoomSettings>,
    userId: string | null = null,
  ): Room {
    const room = new Room(this.nextCode(), hostId, nickname, avatar, settings, userId);
    this.rooms.set(room.code, room);
    this.playerRooms.set(hostId, room.code);
    return room;
  }

  join(
    rawCode: string,
    playerId: string,
    nickname: string,
    avatar: AvatarId,
    userId: string | null = null,
  ): JoinResult {
    const code = normalizeRoomCode(rawCode);
    if (!isValidRoomCode(code)) return { ok: false, code: 'ROOM_NOT_FOUND' };

    const room = this.rooms.get(code);
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };
    // Menyusul di tengah match tidak diizinkan: papannya rebutan, jadi masuk
    // belakangan berarti bermain dengan skor awal yang tidak sebanding.
    if (room.currentStatus !== 'waiting') return { ok: false, code: 'GAME_IN_PROGRESS' };
    if (room.isFull) return { ok: false, code: 'ROOM_FULL' };
    if (room.hasNickname(nickname)) return { ok: false, code: 'NICKNAME_TAKEN' };

    room.add(playerId, nickname, resolveAvatar(avatar, room.takenAvatars()), userId);
    this.playerRooms.set(playerId, room.code);
    return { ok: true, room };
  }

  /**
   * Isi satu kursi dengan lawan buatan.
   *
   * Nama dan avatarnya dipilih di sini supaya keduanya dijamin unik di room
   * ini — avatar kembar membuat cap di sel papan kehilangan artinya, dan nama
   * kembar membuat scoreboard mustahil dibaca. Keduanya masalah yang sudah
   * diselesaikan untuk manusia; bot memakai jalur yang sama.
   */
  addBot(room: Room, difficulty: BotDifficulty): string | null {
    if (room.isFull || room.currentStatus !== 'waiting') return null;

    const botId = `bot-${randomUUID()}`;
    const nickname = botDisplayName(room.allPlayers().map((player) => player.nickname));
    room.addBot(botId, nickname, resolveAvatar('robot', room.takenAvatars()), difficulty);
    this.playerRooms.set(botId, room.code);
    return botId;
  }

  /** Keluarkan bot dari room. `false` kalau id-nya bukan bot di room itu. */
  removeBot(room: Room, botId: string): boolean {
    if (!room.removeBot(botId)) return false;
    this.playerRooms.delete(botId);
    return true;
  }

  roomOf(playerId: string): Room | undefined {
    const code = this.playerRooms.get(playerId);
    return code === undefined ? undefined : this.rooms.get(code);
  }

  byCode(code: string): Room | undefined {
    return this.rooms.get(normalizeRoomCode(code));
  }

  /**
   * Keluarkan pemain dari room-nya. Mengembalikan room yang ditinggalkan supaya
   * pemanggil bisa menyiarkan state baru; `undefined` kalau room ikut bubar.
   */
  leave(playerId: string): Room | undefined {
    const room = this.roomOf(playerId);
    this.playerRooms.delete(playerId);
    if (!room) return undefined;

    room.remove(playerId);
    // Room yang tinggal berisi bot BUBAR, bukan bertahan.
    //
    // `isEmpty` saja tidak cukup sejak bot menempati kursi sungguhan: manusia
    // terakhir yang keluar akan meninggalkan room yang tidak akan pernah kosong
    // sendiri, dan proses server menyimpannya selamanya. Tidak ada yang bisa
    // masuk ke dalamnya juga — kodenya sudah tidak dibagikan siapa pun lagi.
    if (room.isEmpty || room.humanPlayers().length === 0) {
      for (const player of room.allPlayers()) this.playerRooms.delete(player.id);
      this.rooms.delete(room.code);
      return undefined;
    }
    return room;
  }

  /** Hapus room secara eksplisit (dipakai saat match dibatalkan). */
  destroy(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const player of room.allPlayers()) this.playerRooms.delete(player.id);
    this.rooms.delete(code);
  }

  private nextCode(): string {
    // Ruang kodenya 32^6 ≈ 1 miliar, jadi tabrakan praktis tidak terjadi — tapi
    // tetap diperiksa supaya dua room tidak pernah berbagi kode.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = generateRoomCode(this.random);
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Gagal membuat kode room unik setelah 50 percobaan');
  }
}
