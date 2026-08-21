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
 * Empat noda warna di latar halaman.
 *
 * Disalin dari aturan `html { background: ... }` di `globals.css`, termasuk
 * posisi, ukuran, dan opasitasnya. Tanpa ini latarnya krem polos — dan itu
 * perbedaan yang paling cepat terlihat saat versi web dan versi Android
 * disandingkan, karena nodanya memenuhi seperempat layar bagian atas.
 *
 * Ukuran di web ditulis dalam `vw` (48vw, 54vw, …), satuan yang tidak ada di
 * React Native, jadi ia dihitung dari lebar layar sungguhan — hasilnya sama.
 *
 * Satu penyimpangan yang disengaja: perhentian terakhir tiap gradien memakai
 * warna yang sama dengan alpha 0, bukan kata `transparent`. `transparent`
 * adalah hitam-tembus-pandang, dan mesin yang menginterpolasi tanpa
 * premultiply akan menyeret warnanya lewat abu-abu — jadi noda birunya
 * berpinggiran kotor. Menulis alpha 0 pada warna yang sama membuat hasilnya
 * benar di mesin mana pun.
 */
export function latarGradien(lebarLayar: number) {
  const r = (persen: number) => (lebarLayar * persen) / 100;

  const noda = (
    ukuranPersen: number,
    kiri: string,
    atas: string,
    rgb: string,
    alpha: number,
    akhir: string,
  ) =>
    ({
      type: 'radial-gradient',
      shape: 'ellipse',
      size: { x: r(ukuranPersen), y: r(ukuranPersen) },
      position: { left: kiri, top: atas },
      colorStops: [
        { color: `rgba(${rgb}, ${alpha})` },
        { color: `rgba(${rgb}, 0)`, positions: [akhir] },
      ],
    }) as const;

  return [
    noda(48, '10%', '4%', '173, 216, 255', 0.85, '70%'),
    noda(54, '94%', '20%', '255, 205, 232', 0.8, '68%'),
    noda(46, '88%', '78%', '255, 238, 170', 0.7, '70%'),
    noda(60, '46%', '106%', '186, 242, 214', 0.85, '70%'),
  ];
}

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
  /** `--lift` di CSS — dipakai tombol. */
  tombol: { offsetY: 4, warna: 'rgba(53, 41, 107, 0.28)' },
  /** `--lift-lg` di CSS — lebih tinggi dan lebih pucat, dipakai kartu. */
  kartu: { offsetY: 6, warna: 'rgba(53, 41, 107, 0.22)' },
} as const;

/**
 * Fredoka (judul, tombol, angka) dan Nunito (kalimat) — dua font yang sama
 * persis dengan versi web.
 *
 * Berkasnya ada di `android/app/src/main/assets/fonts`, dan diambil dari woff2
 * Google Fonts yang SAMA dengan yang diunduh `next/font` untuk web, cuma dibuka
 * pembungkusnya jadi TTF (lihat catatan di ANDROID-NATIVE.md). Jadi bentuk
 * hurufnya identik, bukan sekadar mirip.
 *
 * **Satu berkas per bobot, dan `fontWeight` TIDAK dipakai bersamanya.** React
 * Native di Android mencocokkan `fontFamily` ke nama berkas; kalau `fontWeight`
 * ikut disetel, Android akan mencoba menebalkan sendiri font yang sudah tebal
 * dan hasilnya huruf yang gepeng dan kotor. Karena itu bobot dipilih dengan
 * MEMILIH FONT-nya, bukan dengan menambah properti.
 */
export const font = {
  judul: 'Fredoka-Regular',
  judulSedang: 'Fredoka-Medium',
  judulTebal: 'Fredoka-SemiBold',
  judulTebalSekali: 'Fredoka-Bold',
  badan: 'Nunito-Regular',
  badanTebal: 'Nunito-SemiBold',
  badanTebalSekali: 'Nunito-Bold',
  badanPaling: 'Nunito-ExtraBold',
} as const;
