import { describe, expect, it } from 'vitest';
import { signPlayerToken, verifyPlayerToken } from '@pixelmatrix/shared';
import { RoomManager } from './RoomManager';

const SECRET = 'rahasia-uji';

/**
 * Menjaga janji "guest tidak tersimpan, akun tersimpan" pada tingkat room.
 * Verifikasi tanda tangannya sendiri diuji di packages/shared.
 */
describe('identitas pemain di room', () => {
  it('guest masuk dengan userId null', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Budi', 'fox');
    expect(room.get('host')?.userId).toBeNull();
  });

  it('pemain berakun membawa userId-nya', () => {
    const manager = new RoomManager();
    const room = manager.create('host', 'Hafidz', 'panda', undefined, 'user-1');
    manager.join(room.code, 'p2', 'Laila', 'cat', 'user-2');

    expect(room.get('host')?.userId).toBe('user-1');
    expect(room.get('p2')?.userId).toBe('user-2');
  });

  it('guest dan pemain berakun bisa satu room', () => {
    // Ini yang membuat "buka link, langsung main" tetap hidup setelah akun ada.
    const manager = new RoomManager();
    const room = manager.create('host', 'Hafidz', 'panda', undefined, 'user-1');
    manager.join(room.code, 'p2', 'TamuBudi', 'cat', null);

    expect(room.allPlayers().map((player) => player.userId)).toEqual(['user-1', null]);
  });

  it('token sah membuka identitas, token palsu tidak', async () => {
    const asli = await signPlayerToken(
      { userId: 'user-1', username: 'Hafidz', avatar: 'panda' },
      SECRET,
    );
    expect(await verifyPlayerToken(asli, SECRET)).toEqual({
      userId: 'user-1',
      username: 'Hafidz',
      avatar: 'panda',
    });

    // Inti keamanannya: tanpa token yang sah, tidak ada cara mengaku punya akun.
    for (const palsu of ['ff.ff', 'bukan-token', '']) {
      expect(await verifyPlayerToken(palsu, SECRET)).toBeNull();
    }
  });
});
