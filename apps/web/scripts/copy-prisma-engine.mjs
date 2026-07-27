// Salin binary query engine Prisma ke tempat yang dicari Prisma saat runtime.
//
// Masalahnya bukan "prisma generate tidak jalan" — binary-nya ada di
// packages/db/generated/client setelah install. Yang tidak terjadi adalah
// penyalinannya ke bundle fungsi serverless: Next mem-bundle file .js dari
// paket workspace, tapi tidak mengikuti `require` ke file .node yang dimuat
// secara dinamis. Hasilnya di produksi:
//
//   PrismaClientInitializationError: could not locate the Query Engine for
//   runtime "rhel-openssl-3.0.x"
//
// Lokasi pertama yang dicari Prisma di dalam lambda adalah
// <cwd>/generated/client — yaitu apps/web/generated/client. Jadi binary-nya
// ditaruh di sana, lalu `outputFileTracingIncludes` di next.config.ts yang
// memastikan file itu benar-benar ikut ke output build.
//
// Nama file binary sengaja tidak dipatok (`libquery_engine-*.node`): target
// platformnya berbeda-beda — debian di image Docker game-server, rhel di
// build Vercel. Menyalin apa pun yang dibangkitkan membuat langkah ini benar
// di kedua tempat tanpa perlu mendaftarkan binaryTargets dan mengunduh
// binary kedua yang tidak akan pernah dipakai.

import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(webDir, '..', '..', 'packages', 'db', 'generated', 'client');
const target = join(webDir, 'generated', 'client');

let engines;
try {
  engines = readdirSync(source).filter((name) => /^libquery_engine-.*\.node$/.test(name));
} catch {
  // Tanpa DATABASE_URL, build tetap harus jalan — seluruh persistensi opsional
  // (lihat schema.prisma). Client yang belum dibangkitkan bukan kegagalan build.
  console.warn('[prisma] generated/client belum ada, lewati penyalinan engine');
  process.exit(0);
}

if (engines.length === 0) {
  console.warn('[prisma] tidak ada libquery_engine-*.node untuk disalin');
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const engine of engines) {
  copyFileSync(join(source, engine), join(target, engine));
  console.log(`[prisma] engine disalin: ${engine}`);
}
