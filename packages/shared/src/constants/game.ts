import type { AvatarId, Color, GameMode, PixelKind, RoomSettings } from '../types/index';

// ---------------------------------------------------------------------------
// Papan (GDD §2)
// ---------------------------------------------------------------------------

/**
 * Papan selalu GRID_SIZE × GRID_SIZE, termasuk di layar HP. Ukurannya TIDAK
 * boleh berubah per device: papan multiplayer harus identik untuk semua pemain,
 * dan high score solo harus sebanding. Di mobile yang menyesuaikan adalah
 * ukuran pixel-nya (canvas di-scale), bukan jumlah selnya.
 */
export const GRID_SIZE = 8;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

export const ALL_COLORS = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
] as const satisfies readonly Color[];

/** Palet retro untuk renderer. */
export const COLOR_HEX: Record<Color, number> = {
  red: 0xe43b44,
  blue: 0x4d9be6,
  green: 0x63c74d,
  yellow: 0xfee761,
  purple: 0xb55088,
  orange: 0xf77622,
};

/**
 * Glyph pembeda warna, dukungan buta warna (GDD §2).
 *
 * Kuning memakai ▼ dan bukan ★: ★ direservasi untuk pixel emas, dan dua bentuk
 * yang mirip di papan yang sama akan merusak justru fungsi glyph itu sendiri.
 */
export const COLOR_GLYPH: Record<Color, string> = {
  red: '▲',
  blue: '●',
  green: '■',
  yellow: '▼',
  purple: '◆',
  orange: '✚',
};

/**
 * Glyph untuk pixel spesial. Harus tidak bertabrakan dengan COLOR_GLYPH —
 * dijaga oleh test keunikan di `game.test.ts`.
 */
export const KIND_GLYPH: Record<Exclude<PixelKind, 'normal'>, string> = {
  bomb: '☠',
  gold: '★',
  life: '♥',
};

// ---------------------------------------------------------------------------
// Avatar pemain (multiplayer)
// ---------------------------------------------------------------------------

/**
 * Urutannya menentukan tampilan pemilih DAN urutan pencarian avatar pengganti
 * saat pilihan pemain sudah dipakai orang lain di room yang sama.
 */
export const AVATAR_IDS = [
  'fox',
  'cat',
  'frog',
  'owl',
  'panda',
  'bee',
  'shark',
  'robot',
] as const satisfies readonly AvatarId[];

/**
 * Emoji, bukan glyph geometris seperti COLOR_GLYPH.
 *
 * Alasannya justru supaya TIDAK bisa tertukar: avatar dicap di atas sel papan
 * yang penuh bentuk ▲●■▼◆✚☠★♥, dan kalau avatarnya juga bentuk geometris,
 * pemain akan salah membacanya sebagai warna target atau pixel spesial.
 */
export const AVATAR_GLYPH: Record<AvatarId, string> = {
  fox: '🦊',
  cat: '🐱',
  frog: '🐸',
  owl: '🦉',
  panda: '🐼',
  bee: '🐝',
  shark: '🦈',
  robot: '🤖',
};

/** Jumlah avatar harus ≥ MAX_PLAYERS_LIMIT — dijaga test di `game.test.ts`. */
export const DEFAULT_AVATAR: AvatarId = 'fox';

// ---------------------------------------------------------------------------
// Skor (GDD §3)
// ---------------------------------------------------------------------------

export const BASE_POINTS = 10;
export const MAX_SPEED_BONUS = 10;
export const WRONG_CLICK_PENALTY = 5;

/** Multiplier naik satu tingkat setiap COMBO_STEP klik benar beruntun. */
export const COMBO_STEP = 5;
export const COMBO_MULTIPLIERS = [1, 1.5, 2] as const;

// ---------------------------------------------------------------------------
// Solo & kurva kesulitan (GDD §4)
// ---------------------------------------------------------------------------

export const SOLO_STARTING_LIVES = 3;
export const CLICKS_PER_LEVEL = 15;

/**
 * Level di mana kurva kesulitan mencapai ujungnya. Di atas level ini semua
 * angka sudah maksimal dan yang bertambah hanyalah modifier chaos.
 *
 * Kurva dihitung dengan interpolasi eksplisit dari nilai Lv 1 ke nilai Lv
 * MAX_CURVE_LEVEL, BUKAN dengan faktor peluruhan per level. Versi pertama game
 * ini memakai faktor (0.92 dan 0.95) dan akibatnya titik mentoknya tersebar
 * tak terduga di level 15 dan 19 — sulit dilihat dari kodenya, dan bikin
 * "Level 20 = MAX" tidak mungkin dijanjikan dengan tepat.
 */
export const MAX_CURVE_LEVEL = 20;

export const INITIAL_SPAWN_INTERVAL_MS = 1200;
export const MIN_SPAWN_INTERVAL_MS = 500;

export const INITIAL_LIFETIME_MS = 3000;
export const MIN_LIFETIME_MS = 1000;

export const INITIAL_ACTIVE_COLORS = 3;
/** Level di mana satu warna baru diaktifkan (3 → 4 → 5 → 6 warna). */
export const COLOR_UNLOCK_LEVELS = [3, 5, 8] as const;

/**
 * Bonus poin karena bertahan di level tinggi: ×1 di Lv 1 sampai ×2 di Lv 20.
 *
 * Tanpa ini, klik di Lv 20 (yang jauh lebih sulit) dibayar sama dengan klik di
 * Lv 1, sehingga bertahan lama tidak terasa dihargai dan skor tinggi murni soal
 * ketahanan mengulang. Setel ke 1 untuk mematikan efeknya.
 */
export const MAX_LEVEL_BONUS_MULTIPLIER = 2;

// ---------------------------------------------------------------------------
// Pixel spesial (GDD §4.1)
// ---------------------------------------------------------------------------

/** Warna papan untuk pixel bom — gelap dan jelas berbeda dari 6 warna biasa. */
export const BOMB_HEX = 0x181425;
export const BOMB_BORDER_HEX = 0xe43b44;
export const GOLD_HEX = 0xffd700;
export const LIFE_HEX = 0xff6b9d;

/** Nyawa maksimum yang bisa dikumpulkan lewat pixel ♥. */
export const MAX_LIVES = 5;

export const BOMB_FIRST_LEVEL = 8;
/** Peluang bom di BOMB_FIRST_LEVEL, naik mulus sampai BOMB_MAX_CHANCE di Lv MAX. */
export const BOMB_MIN_CHANCE = 0.08;
export const BOMB_MAX_CHANCE = 0.15;
/** Kehilangan skor saat bom ditap di mode tanpa nyawa (multiplayer). */
export const BOMB_SCORE_PENALTY = 15;

/**
 * Bom memotong DUA nyawa, bukan satu.
 *
 * Dengan 3 nyawa awal, itu berarti dua bom menghabisimu. Sengaja: bom adalah
 * satu-satunya pixel yang menghukum karena disentuh, dan kalau harganya sama
 * dengan klik warna salah, menahan diri tidak pernah terasa penting.
 */
export const BOMB_LIFE_COST = 2;

export const GOLD_FIRST_LEVEL = 3;
export const GOLD_CHANCE = 0.04;
export const GOLD_POINT_MULTIPLIER = 5;
/** Umur pixel emas relatif pixel biasa — pendek supaya terasa "rebutan waktu". */
export const GOLD_LIFETIME_FACTOR = 0.6;

export const LIFE_FIRST_LEVEL = 5;
export const LIFE_CHANCE = 0.03;
export const LIFE_LIFETIME_FACTOR = 0.7;

// ---------------------------------------------------------------------------
// Checkpoint & continue (solo)
// ---------------------------------------------------------------------------

/** Checkpoint tercatat setiap kali level naik ke kelipatan angka ini. */
export const CHECKPOINT_EVERY_LEVELS = 5;

/**
 * Berapa kali pemain boleh lanjut dari checkpoint dalam satu ronde.
 *
 * Dibatasi supaya rondenya tetap punya ujung: dengan continue tak terbatas,
 * skor tinggi cuma soal kesabaran dan rekor jadi tidak berarti. Dua kali cukup
 * untuk menghilangkan rasa "mati di level 7 harus ulang dari level 1", yang
 * memakan 2-3 menit bagian mudah setiap kali.
 */
export const MAX_CONTINUES = 2;

/**
 * Peluang sebuah pixel baru berwarna sama dengan warna target.
 *
 * Kalau warna dipilih merata dari 6 warna, hanya ~1/6 pixel yang bisa diklik —
 * papan terasa mati dan pemain cuma menunggu. Spawn di-bias ke warna target
 * supaya selalu ada sesuatu untuk dikejar, tapi tetap di bawah 100% supaya
 * pemain benar-benar harus membedakan warna. Angka paling berpengaruh ke
 * "rasa" permainan — ini yang pertama diulik saat balancing.
 */
export const TARGET_COLOR_SPAWN_WEIGHT = 0.5;

// ---------------------------------------------------------------------------
// Warna target (GDD §2)
// ---------------------------------------------------------------------------

/** Level di mana warna target kedua mulai aktif (GDD §4.2). */
export const DUAL_TARGET_FIRST_LEVEL = 12;

/**
 * Level pertama mode chaos. Di bawah ini progres selalu bisa diprediksi; di atas
 * ini tiap level mengaktifkan satu modifier acak.
 */
export const CHAOS_FIRST_LEVEL = MAX_CURVE_LEVEL + 1;

/** Modifier chaos yang mungkin aktif. Urutannya menentukan hasil undian. */
export const CHAOS_MODIFIERS = ['rush', 'blackout', 'bombRain', 'shuffle'] as const;

/** `rush`: jeda spawn dikali angka ini. */
export const CHAOS_RUSH_SPAWN_FACTOR = 0.7;
/** `bombRain`: peluang bom dikali angka ini. */
export const CHAOS_BOMB_MULTIPLIER = 2;
/** `shuffle`: posisi pixel hidup diacak setiap selang ini. */
export const CHAOS_SHUFFLE_INTERVAL_MS = 4000;

export const TARGET_MIN_DURATION_MS = 8000;
export const TARGET_MAX_DURATION_MS = 12000;
export const TARGET_CHANGE_AFTER_CORRECT_CLICKS = 8;
/** Durasi HUD berkedip sebelum warna target benar-benar berganti. */
export const TARGET_WARNING_MS = 1000;

// ---------------------------------------------------------------------------
// Multiplayer (GDD §5)
// ---------------------------------------------------------------------------

export const MP_WRONG_CLICK_COOLDOWN_MS = 500;

/** Nyawa awal di multiplayer — sama dengan solo. */
export const MP_STARTING_LIVES = SOLO_STARTING_LIVES;

/**
 * Lama pemain beku setelah nyawanya habis di multiplayer, sebelum hidup lagi
 * dengan nyawa penuh.
 *
 * Dipilih membekukan, bukan mengeliminasi: match cuma 2 menit dan gamenya
 * dibuat untuk dimainkan bareng di tongkrongan. Pemain yang tereliminasi di
 * menit pertama akan duduk bengong 90 detik — dan biasanya membuka aplikasi
 * lain, lalu tidak kembali.
 */
export const MP_FREEZE_MS = 5000;

/**
 * Apakah klik warna salah ikut memotong nyawa.
 *
 * Di solo: ya, itu satu-satunya cara kalah. Di multiplayer: TIDAK — klik salah
 * di sana sudah dihukum −5 poin DAN cooldown input 500 ms, dan menumpuk
 * penalti ketiga membuat pemain beku terus-menerus di permainan yang justru
 * memaksa mengetuk cepat. Nyawa di MP murni taruhan untuk bom.
 *
 * Satu tempat kalau mau diubah.
 */
export function wrongClickCostsLife(mode: GameMode): boolean {
  return mode === 'solo';
}
export const MAX_CLICKS_PER_SECOND = 8;

/**
 * Di multiplayer level papan naik menurut WAKTU, bukan jumlah klik.
 *
 * Papannya bersama sementara `correctClicks` milik masing-masing pemain, jadi
 * menurunkan level dari klik akan membuat kesulitan bergantung pada siapa yang
 * paling rajin — dan pemain yang tertinggal justru dihukum dua kali. Dengan
 * waktu, semua orang menghadapi papan yang sama persis.
 *
 * Match 120 detik mencapai Lv 9; match 180 detik menembus Lv 12 sehingga dua
 * warna target sempat aktif di menit terakhir.
 */
export const MP_LEVEL_DURATION_MS = 15_000;

/** Seberapa sering scoreboard & sisa waktu disiarkan (loop tetap 20Hz). */
export const MP_TICK_BROADCAST_MS = 250;

/** Sudden death: papan dikosongkan, satu pixel target, siapa cepat dia menang. */
export const SUDDEN_DEATH_LIFETIME_MS = 4000;

export const SERVER_TICK_HZ = 20;
export const SERVER_TICK_MS = 1000 / SERVER_TICK_HZ;

export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS_TO_START = 2;
export const MAX_PLAYERS_LIMIT = 4;
export const COUNTDOWN_SECONDS = 3;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;

export const ALLOWED_TARGET_SCORES = [100, 150, 200] as const;
export const ALLOWED_TIME_LIMITS_SEC = [60, 90, 120, 180] as const;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  targetScore: 150,
  timeLimitSec: 120,
};
