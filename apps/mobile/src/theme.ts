/**
 * Token design Pixel Matrix untuk Android.
 *
 * Angkanya DISALIN PERSIS dari `apps/web/src/app/globals.css`, bukan
 * dicocokkan dengan mata. Itu satu-satunya cara "design-nya sama" bisa berarti
 * sesuatu: warna yang ditebak dari screenshot akan meleset beberapa digit, dan
 * meleset beberapa digit di warna teks adalah selisih antara lulus dan gagal
 * kontras WCAG — jebakan yang sudah tiga kali kena di sisi web (lihat catatan
 * `--accent-ink`, `--success-ink`, dan `--bubblegum-ink` di CSS-nya).
 *
 * Aturan yang ikut terbawa dari sana, dan yang paling mudah dilanggar di sini:
 * **warna untuk MENGISI dan warna untuk MENULIS itu dua hal berbeda.** Oranye
 * `accent` bekerja sebagai latar tombol dengan teks gelap, tapi sebagai warna
 * teks di halaman krem ia cuma 2,18:1 — tidak terbaca. Yang berakhiran `Ink`
 * adalah versi untuk menulis.
 */

export const warna = {
  // --- permukaan -----------------------------------------------------------
  bg: '#fff6e9',
  surface: '#ffffff',
  surfaceRaised: '#fdf3ff',
  border: '#e6dcf5',
  /** Bingkai tegas untuk kartu & tombol chunky. */
  borderStrong: '#35296b',

  // --- teks (semua >= 4,5:1 di krem maupun putih) ---------------------------
  text: '#35296b',
  textDim: '#5e5289',
  textOnDeep: '#ffffff',

  // --- palet ceria: isi vs tulis --------------------------------------------
  accent: '#ff8b3d',
  accentInk: '#b54d0a',
  sky: '#2a72b8',
  mint: '#1f9e6b',
  lemon: '#ffc531',
  grape: '#7238dd',
  danger: '#cc2a34',
  bubblegum: '#d12e72',
  bubblegumInk: '#b82a63',
  successInk: '#147a51',

  /** Latar papan permainan. */
  papan: '#2b1b53',
} as const;

/**
 * Enam warna papan.
 *
 * Nilainya sengaja tidak ditulis ulang di sini — diambil dari `COLOR_HEX` di
 * `@pixelmatrix/shared` supaya papan Android dan papan web tidak mungkin
 * berbeda warna. Yang ada di file ini hanya warna CHROME (menu, kartu,
 * tombol), yang memang tidak dipakai server.
 */

export const radius = {
  sm: 12,
  md: 18,
} as const;

/**
 * Bayangan padat ala stiker, bukan blur.
 *
 * Android punya `elevation` yang menggambar bayangan lembut Material. Itu
 * bahasa visual yang BERBEDA dari game ini — di web bayangannya keras dan
 * bergeser ke bawah tanpa blur sama sekali, dan itu yang membuat tombolnya
 * terasa seperti balok yang bisa ditekan. Ditiru dengan View berlapis, bukan
 * dengan elevation.
 */
export const bayangan = {
  offsetY: 4,
  warna: 'rgba(53, 41, 107, 0.22)',
} as const;

export const font = {
  /**
   * Fredoka (judul) dan Nunito (teks) belum ikut dipaketkan.
   *
   * Sengaja dibiarkan sebagai satu tempat yang jelas, bukan disebar sebagai
   * `fontFamily` di puluhan komponen: begitu kedua berkas .ttf-nya masuk ke
   * `android/app/src/main/assets/fonts`, cukup satu berkas ini yang berubah.
   * Sampai itu terjadi, sistem font Android yang dipakai — dan itu terlihat
   * berbeda dari web, jadi bagian ini BELUM boleh disebut "sama persis".
   */
  judul: undefined as string | undefined,
  badan: undefined as string | undefined,
} as const;
