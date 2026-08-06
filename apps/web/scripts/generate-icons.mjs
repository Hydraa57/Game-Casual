/**
 * Membuat ikon PNG untuk PWA dari desain yang sama dengan `app/icon.svg`.
 *
 * Kenapa digambar sendiri dan bukan pakai sharp/resvg: satu-satunya kebutuhan
 * di sini adalah beberapa persegi berwarna. Menambah dependensi native hanya
 * untuk itu memperberat instalasi semua orang, sementara encoder PNG tanpa
 * filter cuma butuh zlib yang sudah ada di Node.
 *
 * Jalankan: `node scripts/generate-icons.mjs` dari dalam apps/web.
 * Hasilnya di-commit, jadi build tidak perlu menjalankan ini.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, '..', 'public');

const BACKGROUND = [0x2b, 0x1b, 0x53];
const SQUARES = [
  [0xe4, 0x3b, 0x44],
  [0x4d, 0x9b, 0xe6],
  [0xfe, 0xe7, 0x61],
  [0x63, 0xc7, 0x4d],
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixelAt) {
  // Tiap baris diawali satu byte filter 0 ("None") — cukup untuk gambar
  // sesederhana ini dan membuat encoder-nya tetap bisa dibaca.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = 255;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * `safeZone` menyusutkan gambar ke bagian tengah.
 *
 * Untuk ikon maskable, Android boleh memotongnya jadi lingkaran atau
 * squircle — apa pun di luar ~80% bagian tengah bisa hilang. Menyusutkan
 * kotaknya lebih aman daripada ikon yang terpotong di sebagian HP.
 */
function painter(size, safeZone) {
  const inset = (size * (1 - safeZone)) / 2;
  const inner = size - inset * 2;
  const gap = inner * 0.09;
  const square = (inner - gap * 3) / 2;

  return (x, y) => {
    for (let index = 0; index < 4; index += 1) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const left = inset + gap + col * (square + gap);
      const top = inset + gap + row * (square + gap);
      if (x >= left && x < left + square && y >= top && y < top + square) {
        return SQUARES[index];
      }
    }
    return BACKGROUND;
  };
}

mkdirSync(PUBLIC_DIR, { recursive: true });

for (const [name, size, safeZone] of [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  // Maskable dipisah karena isinya harus lebih kecil, bukan sekadar di-resize.
  ['icon-maskable-512.png', 512, 0.8],
  // iOS Safari mengabaikan ikon di manifest dan hanya membaca apple-touch-icon.
  ['apple-icon.png', 180, 1],
]) {
  const file = join(PUBLIC_DIR, name);
  writeFileSync(file, encodePng(size, painter(size, safeZone)));
  console.log('tertulis', file);
}
