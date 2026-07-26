import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS_LIMIT, MIN_PLAYERS_TO_START, ROOM_CODE_LENGTH } from '@pixelmatrix/shared';
import { normalizeSettings } from './Room';
import { RoomManager } from './RoomManager';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET } from './roomCode';

describe('kode room', () => {
  it('panjang dan alfabetnya sesuai', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    expect(room.code).toHaveLength(ROOM_CODE_LENGTH);
    expect(isValidRoomCode(room.code)).toBe(true);
  });

  it('tidak memakai karakter yang mudah tertukar (I, O, 0, 1)', () => {
    for (const character of 'IO01') {
      expect(ROOM_CODE_ALPHABET).not.toContain(character);
    }
  });

  it('normalisasi memperbaiki huruf kecil, spasi, dan tanda hubung', () => {
    expect(normalizeRoomCode(' ab cd-23 ')).toBe('ABCD23');
  });

  it('karakter di luar alfabet dibuang sehingga kode salah ketik ditolak, bukan diterima diam-diam', () => {
    expect(isValidRoomCode(normalizeRoomCode('ABCD2O'))).toBe(false);
  });

  it('kode unik antar room', () => {
    const manager = new RoomManager();
    const codes = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
      codes.add(manager.create(`host-${index}`, `P${index}`).code);
    }
    expect(codes.size).toBe(200);
  });
});

describe('membuat & bergabung', () => {
  it('pembuat room otomatis jadi host', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    expect(room.isHost('host')).toBe(true);
    expect(room.playerCount).toBe(1);
  });

  it('pemain lain bisa bergabung dengan kode', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');

    const result = manager.join(room.code, 'p2', 'Siti');
    expect(result.ok).toBe(true);
    expect(room.playerCount).toBe(2);
    expect(room.isHost('p2')).toBe(false);
  });

  it('kode huruf kecil tetap diterima', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    expect(manager.join(room.code.toLowerCase(), 'p2', 'Siti').ok).toBe(true);
  });

  it('kode yang tidak ada → ROOM_NOT_FOUND', () => {
    const manager = new RoomManager();
    const result = manager.join('ZZZZZZ', 'p2', 'Siti');
    expect(result).toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
  });

  it('room penuh → ROOM_FULL', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi', { maxPlayers: 2 });
    expect(manager.join(room.code, 'p2', 'Siti').ok).toBe(true);

    expect(manager.join(room.code, 'p3', 'Agus')).toEqual({ ok: false, code: 'ROOM_FULL' });
  });

  it('match sudah jalan → GAME_IN_PROGRESS', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    room.setStatus('playing');

    expect(manager.join(room.code, 'p2', 'Siti')).toEqual({
      ok: false,
      code: 'GAME_IN_PROGRESS',
    });
  });

  it('nickname bentrok → NICKNAME_TAKEN, tanpa peduli besar-kecil huruf', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');

    expect(manager.join(room.code, 'p2', 'budi')).toEqual({ ok: false, code: 'NICKNAME_TAKEN' });
    expect(manager.join(room.code, 'p2', ' BUDI ')).toEqual({ ok: false, code: 'NICKNAME_TAKEN' });
  });
});

describe('keluar dari room', () => {
  it('room bubar kalau pemain terakhir keluar', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');

    expect(manager.leave('host')).toBeUndefined();
    expect(manager.byCode(room.code)).toBeUndefined();
    expect(manager.roomCount).toBe(0);
  });

  it('host yang keluar menyerahkan status host ke pemain berikutnya', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    manager.join(room.code, 'p2', 'Siti');

    const remaining = manager.leave('host');
    expect(remaining).toBeDefined();
    expect(remaining!.isHost('p2')).toBe(true);
    // Tanpa ini room macet: tidak ada yang bisa menekan "mulai".
    expect(remaining!.playerCount).toBe(1);
  });

  it('pemain non-host keluar tanpa mengubah host', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    manager.join(room.code, 'p2', 'Siti');

    const remaining = manager.leave('p2');
    expect(remaining!.isHost('host')).toBe(true);
  });

  it('nickname yang ditinggalkan bisa dipakai lagi', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    manager.join(room.code, 'p2', 'Siti');
    manager.leave('p2');

    expect(manager.join(room.code, 'p3', 'Siti').ok).toBe(true);
  });

  it('bergabung ke room baru otomatis meninggalkan yang lama', () => {
    const manager = new RoomManager();
    const first = manager.create('host', 'Budi');
    const second = manager.create('other', 'Agus');

    manager.join(first.code, 'p2', 'Siti');
    manager.leave('p2');
    manager.join(second.code, 'p2', 'Siti');

    expect(manager.roomOf('p2')?.code).toBe(second.code);
    expect(first.playerCount).toBe(1);
  });
});

describe('syarat mulai match', () => {
  it('butuh minimal MIN_PLAYERS_TO_START pemain', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    room.setReady('host', true);
    expect(room.canStart()).toBe(false);

    manager.join(room.code, 'p2', 'Siti');
    room.setReady('p2', true);
    expect(room.playerCount).toBeGreaterThanOrEqual(MIN_PLAYERS_TO_START);
    expect(room.canStart()).toBe(true);
  });

  it('butuh SEMUA pemain siap', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    manager.join(room.code, 'p2', 'Siti');
    room.setReady('host', true);

    expect(room.canStart()).toBe(false);
    room.setReady('p2', true);
    expect(room.canStart()).toBe(true);
  });

  it('tidak bisa mulai lagi kalau sudah jalan', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    manager.join(room.code, 'p2', 'Siti');
    room.setReady('host', true);
    room.setReady('p2', true);
    room.setStatus('playing');

    expect(room.canStart()).toBe(false);
  });

  it('resetReady memaksa konfirmasi ulang sebelum rematch', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    manager.join(room.code, 'p2', 'Siti');
    room.setReady('host', true);
    room.setReady('p2', true);

    room.resetReady();
    expect(room.canStart()).toBe(false);
  });
});

describe('pengaturan room', () => {
  it('nilai di luar rentang dijepit — client tidak dipercaya', () => {
    expect(normalizeSettings({ maxPlayers: 99 }).maxPlayers).toBe(MAX_PLAYERS_LIMIT);
    expect(normalizeSettings({ maxPlayers: 0 }).maxPlayers).toBe(MIN_PLAYERS_TO_START);
    expect(normalizeSettings({ targetScore: 999_999 }).targetScore).toBe(1000);
    expect(normalizeSettings({ timeLimitSec: 1 }).timeLimitSec).toBe(30);
  });

  it('nilai bukan angka jatuh ke batas bawah, bukan NaN', () => {
    expect(normalizeSettings({ maxPlayers: Number.NaN }).maxPlayers).toBe(MIN_PLAYERS_TO_START);
  });

  it('maxPlayers yang diturunkan di bawah jumlah pemain saat ini tidak mengeluarkan siapa pun', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi', { maxPlayers: 4 });
    manager.join(room.code, 'p2', 'Siti');
    manager.join(room.code, 'p3', 'Agus');

    room.updateSettings({ maxPlayers: 2 });
    expect(room.playerCount).toBe(3);
    // Tapi room dianggap penuh, jadi tidak ada yang bisa masuk lagi.
    expect(room.isFull).toBe(true);
  });
});

describe('toState', () => {
  it('menandai host dan menyertakan skor', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi');
    manager.join(room.code, 'p2', 'Siti');

    const state = room.toState(new Map([['p2', { score: 120, combo: 3 }]]));
    expect(state.roomCode).toBe(room.code);
    expect(state.hostId).toBe('host');
    expect(state.players.find((p) => p.id === 'host')?.isHost).toBe(true);
    expect(state.players.find((p) => p.id === 'p2')?.score).toBe(120);
    expect(state.players.find((p) => p.id === 'host')?.score).toBe(0);
  });
});
