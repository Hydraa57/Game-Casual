import {
  BIG_GRID_MIN_PLAYERS,
  BIG_GRID_SIZE,
  CROWD_REFERENCE_PLAYERS,
  GRID_SIZE,
} from '../constants/index';

/**
 * Bagaimana bentuk match menyesuaikan JUMLAH PEMAIN.
 *
 * Ada karena fitur tim menaikkan batas pemain dari 4 ke 8, dan papan yang
 * dirancang untuk 4 orang tidak bisa dipakai 8 orang begitu saja. Kedua fungsi
 * di sini menjawab dua masalah yang berbeda, dan itu penting dibedakan karena
 * salah satunya sempat dikira menyelesaikan yang lain.
 */

/**
 * Berapa sel papan untuk match dengan sekian pemain.
 *
 * Ini soal RUANG, bukan pasokan. Papan yang lebih besar tidak menambah satu pun
 * pixel — jumlah pixel hidup adalah umur dibagi jeda spawn, dan sel kosong tidak
 * pernah jadi penghambat (2,4 pixel di atas 64 sel). Diukur langsung lewat
 * simulasi 180 detik: papan 8×8, 10×10, dan 12×12 sama-sama menghasilkan 2,37
 * pixel hidup dan 1,13 di antaranya berwarna target — sama sampai dua angka di
 * belakang koma.
 *
 * Gunanya papan besar adalah supaya pixel yang jumlahnya SUDAH ditambah oleh
 * `spawnCrowdFactor` punya tempat, dan supaya delapan pasang jempol tidak
 * berebut sel yang sama. Tanpa faktor spawn, memperbesar papan justru
 * memperburuk keadaan: pixel yang sama sedikitnya jadi lebih jauh dicari.
 */
export function gridSizeFor(playerCount: number): number {
  return playerCount >= BIG_GRID_MIN_PLAYERS ? BIG_GRID_SIZE : GRID_SIZE;
}

/**
 * Pengali kecepatan spawn — jeda spawn DIBAGI angka ini.
 *
 * Ini yang benar-benar menambah pasokan. Patokannya match 4 pemain yang sudah
 * dimainkan orang dan terbukti seru: 1,13 pixel target untuk 4 orang, atau 0,28
 * per pemain. Angka itu yang dipertahankan untuk match yang lebih ramai.
 *
 * Di bawah 4 pemain nilainya SELALU 1, bukan `playerCount / 4`. Kalau dibiarkan
 * menskala ke bawah, match 2 pemain justru akan diperlambat menjadi setengah
 * pasokan sekarang — memperburuk mode yang tidak ada keluhannya sama sekali.
 * Fitur baru tidak boleh membayar dirinya dengan mode yang sudah jalan.
 */
export function spawnCrowdFactor(playerCount: number): number {
  return Math.max(1, playerCount / CROWD_REFERENCE_PLAYERS);
}
