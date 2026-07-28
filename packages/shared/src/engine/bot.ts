import type { Color, Pixel } from '../types/index';

/**
 * Lawan buatan untuk saat temannya belum datang.
 *
 * Satu aturan yang menentukan seluruh rancangan file ini: **bot bermain lewat
 * jalur yang sama persis dengan manusia.** Ia tidak punya rumus skor sendiri,
 * tidak kebal bom, dan tidak bisa mengetuk lebih cepat dari batas klik yang
 * berlaku untuk semua orang. Yang membedakannya cuma dua hal yang juga
 * membedakan manusia satu dengan lainnya: seberapa cepat ia bereaksi, dan
 * seberapa sering ia salah.
 *
 * Kalau bot diberi jalur khusus, mengalahkannya tidak berarti apa-apa — dan
 * satu-satunya alasan fitur ini ada adalah supaya ada lawan yang berarti.
 */
export type BotDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Urut dari termudah. `as const` supaya bentuknya tetap tuple literal — zod di
 * game-server memakainya langsung sebagai enum, jadi menambah tingkat baru di
 * sini otomatis membuatnya sah di validasi payload tanpa perlu diingat.
 */
export const BOT_DIFFICULTIES = [
  'easy',
  'medium',
  'hard',
] as const satisfies readonly BotDifficulty[];

export interface BotProfile {
  /**
   * Jeda sebelum bot "melihat" sebuah pixel, dihitung dari saat pixel itu
   * muncul. Ini tuas terpenting: di papan rebutan, yang menentukan siapa dapat
   * pixel adalah siapa yang sampai lebih dulu.
   *
   * Angka acuan manusia: waktu reaksi visual sederhana orang dewasa sekitar
   * 250 ms, dan itu belum termasuk memutuskan warna mana yang benar. Karena itu
   * bot `hard` pun tidak dibuat di bawah itu — bot yang bereaksi 100 ms bukan
   * lawan yang sulit, ia cuma mustahil, dan pemain akan berhenti mencoba.
   */
  readonly reactionMs: number;
  /**
   * Sebaran waktu reaksi. Bukan hiasan: bot dengan jeda yang persis sama setiap
   * kali terbaca sebagai mesin, dan pemain yang sudah hafal iramanya berhenti
   * merasa sedang berlomba.
   */
  readonly reactionJitterMs: number;
  /**
   * Jarak antar ketukan — seberapa cepat "jempolnya", terpisah dari seberapa
   * cepat "matanya".
   *
   * Awalnya ini diturunkan dari `reactionMs` (separuhnya), dan simulasi adu
   * langsung menunjukkan itu keliru: menurunkannya dari reaksi berarti setiap
   * penyesuaian kecepatan mata ikut menggandakan kecepatan tangan, dan
   * selisih reaksi 1,6x berubah menjadi selisih skor 100x. Waktu reaksi dan
   * kecepatan mengetuk adalah dua kemampuan manusia yang berbeda, jadi di sini
   * pun dibuat dua tuas yang berbeda.
   *
   * Acuannya ~3 ketukan per detik untuk pemain lancar; batas anti-curang
   * (`MAX_CLICKS_PER_SECOND`) jauh di atas itu dan tidak pernah tersentuh.
   */
  readonly tapIntervalMs: number;
  /** Peluang bot memilih pixel yang benar; sisanya jadi klik salah sungguhan. */
  readonly accuracy: number;
  /** Peluang bot mengenali bom dan tidak menyentuhnya. */
  readonly bombAwareness: number;
  /**
   * Peluang bot mengejar pixel emas saat ada.
   *
   * Emas bernilai lima kali lipat dan boleh warna apa pun, jadi mengenalinya
   * adalah tanda pemain yang sudah paham. Bot `easy` sering melewatkannya, dan
   * itu justru celah yang bisa dimanfaatkan pemain baru untuk mengejar.
   */
  readonly goldPriority: number;
}

/**
 * Tiga tingkat, ditala lewat simulasi adu langsung — bukan ditebak.
 *
 * Angkanya keluar dari `scripts/sim-bot.mts` di game-server, yang mengadu tiap
 * profil melawan dua acuan manusia di papan rebutan yang sama, 60 ronde per
 * pasangan, dengan aturan MP lengkap: nyawa, beku, KO, dan eliminasi.
 *
 * Acuan manusianya diturunkan dari waktu reaksi PILIHAN (~380-450 ms untuk
 * membedakan beberapa stimulus lalu merespons) ditambah waktu mengarahkan jari
 * di layar sentuh, dengan laju ketuk terarah ~2-2,5 per detik:
 *
 * - pemain kasual: reaksi 700 ms, ketuk tiap 600 ms, akurasi 96%
 * - pemain lancar: reaksi 450 ms, ketuk tiap 400 ms, akurasi 98,5%
 *
 * Hasil penalaan terakhir (peluang bot menang):
 *
 * | tingkat | vs kasual | vs lancar |
 * |---------|-----------|-----------|
 * | easy    | 42%       | 2%        |
 * | medium  | 87%       | 15%       |
 * | hard    | 100%      | 85%       |
 *
 * Dua hal yang keluar dari pengukuran ini dan tidak akan pernah ketahuan dari
 * menebak angka:
 *
 * 1. **Akurasi jauh lebih mahal di MP daripada di solo.** Satu klik salah
 *    memotong satu nyawa, dan 3 nyawa x 3 KO berarti hanya ada sembilan klik
 *    salah sebelum tereliminasi. Penalaan pertama memakai akurasi 78-96% —
 *    angka yang wajar untuk manusia — dan SETIAP profil habis nyawanya sebelum
 *    match separuh jalan. Karena itu ketiganya sekarang di atas 95%, dan
 *    selisih kesulitannya dipikul waktu reaksi, bukan ketelitian.
 * 2. **Selisih kecil di waktu reaksi menghasilkan selisih besar di hasil.** Di
 *    papan rebutan, yang melihat pixel lebih dulu mengambilnya dan yang lebih
 *    lambat hanya menemukan sisa. Tiap tingkat karena itu terasa seperti
 *    saklar, bukan geseran halus — itu sifat gamenya, bukan cacat botnya. (Ini
 *    juga alasan lencana ping penting: latensi bekerja persis seperti waktu
 *    reaksi tambahan.)
 *
 * Ketiganya dipetakan ke lawan, bukan ke persentase:
 *
 * - `easy` — pemain kasual menang lebih sering daripada kalah. Pemain baru
 *   harus bisa menang, kalau tidak fitur ini malah membuat orang berhenti main.
 *   Ia tetap mengetuk terus dan tetap mengumpulkan skor, jadi papannya hidup
 *   dan menang terasa seperti menang, bukan seperti menghadapi patung.
 * - `medium` — di atas pemain kasual, di bawah pemain lancar. Menang kalau
 *   kamu fokus.
 * - `hard` — mengungguli pemain yang sudah lancar. Tetap bisa kalah: ia kena
 *   bom, combonya putus, dan ia bisa KO seperti siapa pun.
 */
export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    reactionMs: 780,
    reactionJitterMs: 280,
    tapIntervalMs: 640,
    accuracy: 0.955,
    bombAwareness: 0.85,
    goldPriority: 0.25,
  },
  medium: {
    reactionMs: 700,
    reactionJitterMs: 240,
    tapIntervalMs: 600,
    accuracy: 0.975,
    bombAwareness: 0.93,
    goldPriority: 0.6,
  },
  hard: {
    reactionMs: 460,
    reactionJitterMs: 150,
    tapIntervalMs: 400,
    accuracy: 0.99,
    bombAwareness: 0.98,
    goldPriority: 0.9,
  },
};

/**
 * Berapa lama bot ini butuh sebelum menyadari sebuah pixel.
 *
 * Diundi SEKALI per pixel, bukan sekali per bot: kalau jedanya tetap, dua bot
 * dengan tingkat sama akan selalu mengetuk pixel yang sama di milidetik yang
 * sama, dan yang satu selalu kalah dari yang lain karena urutan iterasi.
 */
export function botReactionMs(profile: BotProfile, random: () => number): number {
  const spread = (random() * 2 - 1) * profile.reactionJitterMs;
  // Dijaga tidak pernah lebih cepat dari separuh reaksi dasarnya — undian yang
  // kebetulan ekstrem tidak boleh menghasilkan refleks yang bukan manusia.
  return Math.max(profile.reactionMs / 2, Math.round(profile.reactionMs + spread));
}

export interface BotChoice {
  readonly pixelId: string;
  /**
   * Bot tahu ini pilihan yang salah. Dipakai server untuk telemetri saja —
   * hasilnya tetap dihitung engine seperti klik manusia yang meleset.
   */
  readonly mistake: boolean;
}

/**
 * Pilih satu pixel untuk diketuk, atau `null` kalau tidak ada yang layak.
 *
 * Yang masuk ke sini hanyalah pixel yang SUDAH terlihat oleh bot (jeda
 * reaksinya sudah lewat) — penyaringan itu dilakukan pemanggil, karena ia yang
 * menyimpan kapan tiap pixel muncul.
 *
 * Perhatikan bahwa fungsi ini bisa mengembalikan pilihan yang buruk dengan
 * sengaja: pixel salah warna, bahkan bom. Itu bukan cacat, itu isi dari
 * "tingkat kesulitan" — bot yang tidak pernah salah bukan lawan, ia dinding.
 */
export function pickBotTarget(
  visible: readonly Pixel[],
  targetColors: readonly Color[],
  profile: BotProfile,
  random: () => number,
): BotChoice | null {
  if (visible.length === 0) return null;

  const bombs = visible.filter((pixel) => pixel.kind === 'bomb');
  const gold = visible.filter((pixel) => pixel.kind === 'gold');
  const lives = visible.filter((pixel) => pixel.kind === 'life');
  const correct = visible.filter(
    (pixel) => pixel.kind === 'normal' && targetColors.includes(pixel.color),
  );
  const wrong = visible.filter(
    (pixel) => pixel.kind === 'normal' && !targetColors.includes(pixel.color),
  );

  // Bom lebih dulu: kesalahan yang paling mahal harus diputuskan sebelum apa
  // pun yang lain, kalau tidak ia hanya akan terpilih saat kebetulan tidak ada
  // pilihan lain — dan itu bukan kelalaian, itu keputusasaan.
  if (bombs.length > 0 && random() > profile.bombAwareness) {
    return { pixelId: pick(bombs, random).id, mistake: true };
  }

  // Nyawa selalu diambil kalau terlihat. Tidak ada tingkat kesulitan yang perlu
  // membuat bot menolak nyawa gratis — melewatkannya cuma terlihat rusak.
  if (lives.length > 0) return { pixelId: pick(lives, random).id, mistake: false };

  if (gold.length > 0 && random() < profile.goldPriority) {
    return { pixelId: pick(gold, random).id, mistake: false };
  }

  // Kesalahan hanya mungkin kalau ada pixel salah untuk diketuk. Kalau papan
  // kebetulan cuma berisi warna target, bot yang "salah" tidak punya cara
  // untuk salah — dan memaksanya diam justru membuatnya terlihat menganggur.
  if (wrong.length > 0 && random() > profile.accuracy) {
    return { pixelId: pick(wrong, random).id, mistake: true };
  }

  if (correct.length > 0) return { pixelId: pick(correct, random).id, mistake: false };
  if (gold.length > 0) return { pixelId: pick(gold, random).id, mistake: false };
  return null;
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0]!;
}

/**
 * Nama yang ditampilkan untuk bot.
 *
 * Sengaja NETRAL BAHASA dan tanpa menyebut tingkat kesulitan, dan keduanya
 * adalah perbaikan dari percobaan pertama ("Bot Santai"/"Bot Jago"/"Bot
 * Sangar"):
 *
 * 1. Nama dibuat SEKALI di server dan dilihat semua orang di room itu. Nama
 *    berbahasa Indonesia akan muncul apa adanya di layar pemain yang memilih
 *    English — dan tidak ada cara memperbaikinya belakangan, karena saat itu
 *    yang tersimpan tinggal string-nya.
 * 2. Tingkat kesulitannya sudah dibawa lencana di sebelah nama, yang
 *    diterjemahkan per pemain. Menaruhnya di nama juga membuat barisnya
 *    terbaca "Bot Sangar [SANGAR]".
 *
 * Nomornya urut dari kursi yang belum terpakai — nama kembar membuat
 * scoreboard mustahil dibaca.
 */
export const BOT_NAME_PREFIX = 'Bot';

export function botDisplayName(taken: readonly string[]): string {
  for (let n = 1; n <= 99; n += 1) {
    const candidate = `${BOT_NAME_PREFIX} ${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${BOT_NAME_PREFIX} ${Math.floor(Math.random() * 900) + 100}`;
}
