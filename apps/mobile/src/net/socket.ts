import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@pixelmatrix/shared';

export type SoketGame = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Alamat game-server multiplayer.
 *
 * **Harus diisi sebelum rilis.** Versi web bisa menebak alamatnya dari halaman
 * yang sedang dibuka (`window.location.hostname` + port 3001); aplikasi Android
 * tidak punya "halaman yang sedang dibuka", jadi alamatnya wajib dibawa di
 * dalam aplikasinya sendiri.
 *
 * Sengaja kosong, bukan diisi tebakan `localhost` atau alamat contoh. Alamat
 * yang salah menghasilkan gejala yang membingungkan — tombol yang berputar lalu
 * gagal tanpa alasan yang jelas — sementara alamat yang kosong bisa dikenali
 * aplikasi dan dijelaskan apa adanya kepada pemain.
 *
 * Isi dengan alamat service game-server (lihat README bagian Deployment),
 * misalnya `https://pixelmatrix-game-server.onrender.com`, lalu bangun ulang
 * APK-nya — nilainya dibaca saat build, bukan saat aplikasi jalan.
 */
export const ALAMAT_GAME_SERVER: string = '';

export function adaGameServer(): boolean {
  return ALAMAT_GAME_SERVER.trim() !== '';
}

export function buatSoket(): SoketGame {
  return io(ALAMAT_GAME_SERVER, {
    // WebSocket dulu karena latensinya paling rendah, tapi kalau ada proxy yang
    // tidak mengizinkan upgrade, `tryAllTransports` membuat koneksi tetap jadi
    // lewat polling alih-alih gagal total.
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    autoConnect: true,
    // Koneksi seluler sering terputus sebentar, dan pemain tidak seharusnya
    // kehilangan lobby karena itu.
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    timeout: 8000,
  });
}
