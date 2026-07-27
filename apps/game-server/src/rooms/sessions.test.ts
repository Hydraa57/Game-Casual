import { describe, expect, it } from 'vitest';
import { SessionRegistry } from './sessions';

describe('SessionRegistry', () => {
  it('kunci dan id kursi adalah nilai yang BERBEDA', () => {
    // Ini bukan detail gaya. `playerId` disiarkan ke seluruh room lewat
    // RoomState; `sessionKey` adalah bukti pemilik kursi. Kalau keduanya sama,
    // setiap pemain menerima kunci semua pemain lain di room-nya dan bisa
    // mengambil alih kursi siapa pun.
    const registry = new SessionRegistry();
    const seat = registry.open();
    expect(seat.sessionKey).not.toBe(seat.playerId);
  });

  it('kunci menunjuk ke kursinya', () => {
    const registry = new SessionRegistry();
    const seat = registry.open();
    expect(registry.resolve(seat.sessionKey)).toBe(seat.playerId);
  });

  it('setiap kursi mendapat id dan kunci yang unik', () => {
    const registry = new SessionRegistry();
    const seats = Array.from({ length: 50 }, () => registry.open());
    expect(new Set(seats.map((s) => s.playerId)).size).toBe(50);
    expect(new Set(seats.map((s) => s.sessionKey)).size).toBe(50);
  });

  it('kunci yang tidak dikenal tidak menunjuk ke mana pun', () => {
    const registry = new SessionRegistry();
    registry.open();
    expect(registry.resolve('bukan-kunci')).toBeUndefined();
  });

  it('kursi yang ditutup tidak bisa diklaim lagi', () => {
    const registry = new SessionRegistry();
    const seat = registry.open();
    registry.close(seat.playerId);
    expect(registry.resolve(seat.sessionKey)).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it('menutup kursi yang sama dua kali tidak melempar', () => {
    // Terjadi di praktik: pemain menekan keluar tepat sebelum masa tenggangnya
    // habis, jadi dua jalur berbeda memanggil close untuk kursi yang sama.
    const registry = new SessionRegistry();
    const seat = registry.open();
    registry.close(seat.playerId);
    expect(() => registry.close(seat.playerId)).not.toThrow();
  });

  it('menutup satu kursi tidak menyentuh kursi lain', () => {
    const registry = new SessionRegistry();
    const first = registry.open();
    const second = registry.open();
    registry.close(first.playerId);
    expect(registry.resolve(second.sessionKey)).toBe(second.playerId);
  });
});
