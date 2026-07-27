/**
 * Kunci kursi multiplayer yang bertahan melewati reload dan koneksi yang putus.
 *
 * Disimpan di `localStorage`, bukan `sessionStorage`: kasus yang paling sering
 * terjadi di HP justru yang tidak ditangani sessionStorage — tab ditutup karena
 * kehabisan memori saat berpindah aplikasi, lalu dibuka lagi dari home screen.
 *
 * Nama room ikut disimpan supaya UI bisa memberi tahu ke mana ia mencoba
 * kembali, dan supaya sisa sesi dari room yang sudah lama bubar bisa dikenali
 * tanpa menanyakannya ke server dulu.
 */
const STORAGE_KEY = 'pm.room.session.v1';

export interface RoomSession {
  readonly sessionKey: string;
  readonly roomCode: string;
}

export function readRoomSession(): RoomSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;

    const parsed = JSON.parse(raw) as Partial<RoomSession>;
    // Bentuknya diperiksa, tidak dipercaya: isi localStorage bisa berasal dari
    // versi lama aplikasi ini, dan `sessionKey: undefined` yang lolos ke socket
    // akan ditolak server dengan error yang tidak menjelaskan apa pun.
    if (typeof parsed.sessionKey !== 'string' || typeof parsed.roomCode !== 'string') return null;
    return { sessionKey: parsed.sessionKey, roomCode: parsed.roomCode };
  } catch {
    // Safari mode privat bisa melempar, dan JSON rusak juga berakhir di sini.
    return null;
  }
}

export function writeRoomSession(session: RoomSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Gagal menyimpan berarti reconnect tidak akan bekerja, tapi permainannya
    // tetap jalan penuh. Bukan alasan untuk menggagalkan apa pun.
  }
}

export function clearRoomSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sama seperti di atas.
  }
}
