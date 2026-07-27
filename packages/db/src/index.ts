// URUTAN IMPORT DI SINI PENTING: `./env.js` harus dievaluasi sebelum klien
// Prisma, karena klien itu menyuntikkan isi file .env ke process.env saat
// di-import. Lihat penjelasan lengkap di env.ts.
import { DATABASE_URL } from './env.js';
import { PrismaClient } from '../generated/client/index.js';

export type { PrismaClient } from '../generated/client/index.js';
export { Prisma } from '../generated/client/index.js';

/**
 * Klien database, atau `null` kalau `DATABASE_URL` tidak diset.
 *
 * Nilai `null` adalah keadaan yang SAH, bukan error. Pixel Matrix harus tetap
 * bisa dimainkan tanpa database sama sekali: room hidup di memori dan high
 * score solo di `localStorage`. Syarat "teman bisa langsung main tanpa
 * daftar" berlaku selamanya, jadi database tidak boleh pernah menjadi
 * prasyarat untuk bermain — ia hanya menambah riwayat dan profil.
 *
 * Konsekuensinya setiap pemanggil WAJIB memeriksa null. Itu disengaja: lebih
 * baik dipaksa memikirkannya oleh tipe daripada menemukan sendiri saat server
 * produksi mati karena env yang belum diisi.
 */
let client: PrismaClient | null | undefined;

export function db(): PrismaClient | null {
  if (client !== undefined) return client;

  if (DATABASE_URL === null) {
    client = null;
    return client;
  }

  // Di dev, hot reload membuat modul dievaluasi ulang berkali-kali. Tanpa
  // penyimpanan di globalThis, tiap reload membuka pool koneksi baru sampai
  // Postgres menolak koneksi berikutnya.
  const globalForPrisma = globalThis as typeof globalThis & {
    __pixelmatrixPrisma?: PrismaClient;
  };

  client =
    globalForPrisma.__pixelmatrixPrisma ??
    // URL diberikan eksplisit, tidak dibiarkan dibaca ulang dari env: yang
    // dipakai harus persis nilai yang tadi memutuskan persistensi menyala.
    new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__pixelmatrixPrisma = client;
  }
  return client;
}

/** Apakah persistensi aktif. Dipakai untuk melewati jalur DB tanpa try/catch. */
export function hasDatabase(): boolean {
  return db() !== null;
}
