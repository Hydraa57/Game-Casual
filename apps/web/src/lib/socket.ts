import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@pixelmatrix/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Alamat game-server. Di development default-nya host yang sama dengan halaman
 * ini pada port 3001 — itu yang membuat game bisa dibuka dari HP di jaringan
 * yang sama tanpa mengubah konfigurasi apa pun.
 *
 * Tebakan ":3001" itu HANYA benar untuk development. Begitu web-nya di-deploy,
 * `NEXT_PUBLIC_GAME_SERVER_URL` wajib diisi alamat game-server yang sebenarnya
 * — lihat README bagian Deployment. Nilainya dibaca saat build, jadi mengubah
 * env di hosting harus diikuti deploy ulang.
 */
export function gameServerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (configured) return configured;
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export function createSocket(): GameSocket {
  return io(gameServerUrl(), {
    // WebSocket dulu karena latensinya paling rendah, tapi kalau ada proxy yang
    // tidak mengizinkan upgrade, `tryAllTransports` membuat koneksi tetap jadi
    // lewat polling alih-alih gagal total.
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    autoConnect: true,
    // Reconnect otomatis: koneksi seluler sering terputus sebentar, dan pemain
    // tidak seharusnya kehilangan lobby karena itu.
    reconnection: true,
    reconnectionDelay: 500,
  });
}
