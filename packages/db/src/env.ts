/**
 * Menangkap `DATABASE_URL` SEBELUM klien Prisma sempat menyentuh `process.env`.
 *
 * Ini bukan kehati-hatian berlebihan. Klien Prisma yang dibangkitkan memuat
 * file `.env` di dekat schema-nya ke dalam `process.env` saat modulnya
 * di-import. Akibatnya, pemeriksaan `process.env.DATABASE_URL` yang dilakukan
 * SESUDAH import akan melihat nilai yang tidak pernah diset oleh siapa pun di
 * lingkungan itu — dan persistensi menyala diam-diam.
 *
 * Itu bukan masalah teoretis: saat diuji, satu match tetap tertulis ke database
 * padahal server dijalankan tanpa `DATABASE_URL` sama sekali. Di produksi, efek
 * yang sama berarti server menulis ke database dev seseorang hanya karena
 * sebuah file `.env` ikut tersalin.
 *
 * Modul ini sengaja TIDAK meng-import apa pun. Ia harus berada di urutan import
 * paling atas di `index.ts`, karena ESM mengevaluasi modul sesuai urutan
 * pernyataan import — jadi nilainya terbaca sebelum Prisma mengubahnya.
 */
export const DATABASE_URL: string | null = process.env.DATABASE_URL ?? null;
