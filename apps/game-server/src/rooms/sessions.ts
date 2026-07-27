import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Menghubungkan kursi pemain yang bertahan dengan koneksi yang datang-pergi.
 *
 * Sebelum ini identitas pemain ADALAH `socket.id`. Itu bekerja sampai koneksi
 * terputus: socket baru berarti id baru, dan pemain yang kembali dianggap orang
 * asing yang mencoba masuk ke match yang sudah berjalan — lalu ditolak. Karena
 * itu setiap gangguan jaringan sekecil apa pun berarti mengulang dari awal.
 *
 * Ada dua identitas di sini, dan memisahkannya adalah inti dari modul ini:
 *
 * - `playerId` — id kursi. Dipakai di Room, Match, dan disiarkan ke semua orang
 *   lewat `RoomState`. Boleh dilihat siapa saja.
 * - `sessionKey` — bukti pemilik kursi. HANYA dikirim ke pemiliknya. Siapa pun
 *   yang memegangnya adalah pemain itu, jadi ia tidak boleh pernah masuk ke
 *   payload yang disiarkan ke seluruh room.
 *
 * Kalau keduanya digabung jadi satu nilai, `RoomState` akan membocorkan kunci
 * setiap pemain ke setiap pemain lain di room yang sama — dan siapa pun bisa
 * mengambil alih kursi orang lain hanya dengan membaca payload yang sudah
 * dikirim ke dia.
 */
export class SessionRegistry {
  private readonly seats = new Map<string, string>();
  private readonly keys = new Map<string, string>();

  constructor(
    private readonly newKey: () => string = () => randomBytes(24).toString('hex'),
    private readonly newId: () => string = () => randomUUID(),
  ) {}

  get size(): number {
    return this.seats.size;
  }

  /** Kursi baru: kembalikan id publiknya beserta kunci rahasianya. */
  open(): { playerId: string; sessionKey: string } {
    const playerId = this.newId();
    const sessionKey = this.newKey();
    this.seats.set(sessionKey, playerId);
    this.keys.set(playerId, sessionKey);
    return { playerId, sessionKey };
  }

  /** Kursi yang dirujuk kunci ini, atau `undefined` kalau sudah hangus. */
  resolve(sessionKey: string): string | undefined {
    return this.seats.get(sessionKey);
  }

  /**
   * Tutup kursi. Dipanggil ketika pemain benar-benar keluar — bukan saat
   * koneksinya putus, karena justru di situlah kursinya harus tetap ada.
   */
  close(playerId: string): void {
    const key = this.keys.get(playerId);
    if (key !== undefined) this.seats.delete(key);
    this.keys.delete(playerId);
  }
}
