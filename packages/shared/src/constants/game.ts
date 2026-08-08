import type { AvatarId, Color, GameMode, PixelKind, RoomSettings, TeamId } from '../types/index';

// ---------------------------------------------------------------------------
// Papan (GDD §2)
// ---------------------------------------------------------------------------

/**
 * Ukuran papan baku: 8 × 8. Dipakai solo dan multiplayer sampai 4 pemain.
 *
 * Ukurannya TIDAK boleh berubah per device — papan multiplayer harus identik
 * untuk semua pemain di satu match, dan high score solo harus sebanding. Yang
 * menyesuaikan layar adalah ukuran pixel-nya (canvas di-scale), bukan jumlah
 * selnya. Yang boleh mengubahnya hanyalah JUMLAH PEMAIN, dan itu diputuskan
 * sekali di server saat match dimulai lalu dikirim ke semua client.
 */
export const GRID_SIZE = 8;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

/** Papan besar untuk match ramai — lihat `gridSizeFor`. */
export const BIG_GRID_SIZE = 10;

/** Mulai dari sekian pemain, papannya memakai BIG_GRID_SIZE. */
export const BIG_GRID_MIN_PLAYERS = 5;

/**
 * Sampai berapa pemain kepadatan pixel dibiarkan apa adanya.
 *
 * Di bawah/sama dengan angka ini, `spawnCrowdFactor` bernilai 1 — mode 2–4
 * pemain yang sudah dimainkan orang tidak berubah sedikit pun oleh fitur tim.
 */
export const CROWD_REFERENCE_PLAYERS = 4;

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
 * Level tempat indikator target berubah menjadi KATA bertinta warna lain.
 *
 * Ditaruh setelah DUAL_TARGET_FIRST_LEVEL, bukan sebelum: dua beban baru yang
 * datang bersamaan tidak terasa sebagai tantangan, terasa sebagai game yang
 * rusak. Pemain diberi tiga level untuk membiasakan melacak dua warna dulu.
 *
 * Masih di bawah MAX_CURVE_LEVEL supaya mode ini benar-benar dialami sebelum
 * kurvanya mentok — kalau ia ditaruh di 21+ ia akan bertumpuk dengan chaos dan
 * hampir tidak ada yang pernah sampai ke sana.
 */
export const STROOP_FIRST_LEVEL = 15;

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
 * Berapa kali pemain boleh kehabisan nyawa sebelum tereliminasi.
 *
 * KO pertama dan kedua hanya membekukan; yang ketiga mengeluarkannya dari
 * permainan dan ia hanya bisa menonton. Ini yang memberi match ujung yang
 * tegas — tanpa batas, pemain yang kesulitan akan KO berulang kali sampai
 * waktu habis tanpa pernah ada konsekuensi yang terasa.
 */
export const MP_MAX_KNOCKOUTS = 3;

/**
 * Klik warna salah memotong satu nyawa — di solo MAUPUN multiplayer.
 *
 * Di MP itu berarti tiga hukuman menumpuk untuk satu kesalahan: −5 poin,
 * cooldown input 500 ms, dan −1 nyawa. Konsekuensinya harus disadari saat
 * mengulik angka: dengan 3 nyawa, tiga klik salah sudah cukup untuk KO, dan
 * MP_MAX_KNOCKOUTS KO membuat pemain tereliminasi. Jadi ~9 klik salah dalam
 * satu match berarti keluar dari permainan.
 *
 * Kalau ternyata terlalu keras saat playtest, tuas yang paling tepat diputar
 * adalah MP_MAX_KNOCKOUTS atau MP_STARTING_LIVES — bukan menghapus penalti
 * nyawanya, karena justru itu yang membuat menahan diri punya arti.
 */
export function wrongClickCostsLife(_mode: GameMode): boolean {
  return true;
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

/**
 * Berapa lama kursi pemain ditahan setelah socket-nya putus.
 *
 * Selama tenggang ini pemain masih ada di room, skornya utuh, dan match jalan
 * terus tanpa dia. Kalau ia kembali sebelum waktunya habis, ia melanjutkan
 * match yang sama — bukan memulai dari awal.
 *
 * 45 detik dipilih dari tiga hal yang benar-benar terjadi di HP: berpindah
 * aplikasi sebentar, WiFi berganti ke seluler, dan layar mati lalu dinyalakan
 * lagi. Ketiganya biasanya selesai jauh di bawah setengah menit.
 *
 * Kenapa tidak lebih lama: papannya rebutan. Pemain yang tersisa menunggu
 * lawan yang mungkin tidak akan kembali, dan di match 2 orang itu berarti
 * bermain sendirian. Batas waktu match tetap berjalan selama tenggang, jadi
 * situasinya selalu selesai sendiri — tapi 45 detik menjaga agar tidak ada
 * yang menunggu lebih lama dari yang wajar.
 */
export const RECONNECT_GRACE_MS = 45_000;

/** Seberapa sering scoreboard & sisa waktu disiarkan (loop tetap 20Hz). */
export const MP_TICK_BROADCAST_MS = 250;

/**
 * Jarak antar pengukuran latensi.
 *
 * 3 detik: cukup rapat untuk menangkap koneksi yang memburuk di tengah match,
 * cukup jarang untuk tidak menambah beban yang justru ingin diukur. Satu
 * pengukuran hanyalah paket kosong bolak-balik, tapi mengirimnya tiap 250 ms
 * (seirama tick) berarti menambah lalu lintas di jalur yang sedang sesak —
 * pengukurannya sendiri akan memperburuk angkanya.
 */
export const PING_INTERVAL_MS = 3000;

/**
 * Berapa lama server menunggu balasan ping sebelum menyerah untuk sampel itu.
 *
 * ADA karena ketiadaannya adalah bug sungguhan: versi pertama menahan satu ping
 * "di udara" sampai balasannya datang, dan kalau balasan itu TIDAK PERNAH datang
 * — HP yang layarnya mati, tab yang dibekukan browser, paket yang hilang —
 * pengukuran untuk pemain itu berhenti selamanya. Angkanya membeku di nilai
 * terakhir dan tidak pulih bahkan setelah koneksinya kembali normal.
 *
 * 8 detik: jauh di atas latensi terburuk yang masih bisa disebut bermain
 * (koneksi seluler yang parah pun jarang di atas 2 detik), jadi tidak ada
 * gangguan wajar yang menyentuhnya. Balasan yang datang setelah ini diabaikan,
 * bukan dipakai — HP yang bangun setelah 40 detik akan melaporkan RTT 40 detik,
 * dan itu bukan ukuran koneksinya, itu ukuran berapa lama layarnya mati.
 */
export const PING_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Peringatan akhir match (multiplayer)
// ---------------------------------------------------------------------------

/**
 * Sisa waktu yang membuat match masuk "babak akhir".
 *
 * Satu angka untuk DUA hal — tampilan dan musik — dengan sengaja. Kalau
 * masing-masing punya ambangnya sendiri, angka di layar akan berkedip merah di
 * detik yang berbeda dari saat musiknya berubah, dan keduanya berhenti terasa
 * sebagai satu kejadian.
 *
 * 15 detik: cukup lama untuk mengubah cara main (berhenti mengincar combo,
 * mulai menyerobot apa saja), cukup pendek untuk tidak melelahkan.
 */
export const MP_TIME_WARNING_MS = 15_000;

/**
 * Seberapa dekat ke target sebelum match dianggap hampir usai.
 *
 * Dipakai untuk pihak MANA PUN yang paling depan, bukan hanya pemain sendiri:
 * yang sedang tertinggal justru paling perlu tahu bahwa waktunya hampir habis.
 */
export const MP_SCORE_WARNING_RATIO = 0.85;

/** Sudden death: papan dikosongkan, satu pixel target, siapa cepat dia menang. */
export const SUDDEN_DEATH_LIFETIME_MS = 4000;

export const SERVER_TICK_HZ = 20;
export const SERVER_TICK_MS = 1000 / SERVER_TICK_HZ;

export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS_TO_START = 2;

/**
 * Batas atas kursi di satu room: 8, karena 4v4 butuh delapan.
 *
 * Angka ini juga batas jumlah avatar — setiap pemain di satu room harus punya
 * avatar berbeda supaya cap di sel papan berarti sesuatu, dan kebetulan
 * avatarnya memang tepat delapan. Ada test di `game.test.ts` yang gagal kalau
 * batas ini dinaikkan tanpa menambah avatar.
 *
 * Papan menyesuaikan sendiri: dari 5 pemain ia menjadi 10×10 dan jeda spawnnya
 * diperpendek. Lihat `crowd.ts` — menaikkan angka ini tanpa keduanya akan
 * membuat delapan orang berebut satu pixel.
 */
export const MAX_PLAYERS_LIMIT = 8;
export const COUNTDOWN_SECONDS = 3;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;

// ---------------------------------------------------------------------------
// Chat lobby
// ---------------------------------------------------------------------------

/**
 * Chat hanya hidup di lobby, bukan saat match berjalan.
 *
 * Ini game refleks yang menuntut mata tetap di papan; kotak pesan yang bergerak
 * di tengah ronde bukan fitur, itu gangguan. Lobby justru sebaliknya — di situ
 * orang menunggu, dan menunggu tanpa bisa bicara adalah alasan orang keluar.
 */
export const CHAT_MAX_LENGTH = 120;

/**
 * Berapa pesan terakhir yang disimpan per room.
 *
 * Ada supaya pemain yang baru masuk — atau baru kembali setelah koneksinya
 * putus — tidak melihat lobby yang sunyi padahal barusan ada percakapan.
 * Sengaja kecil: ini bukan riwayat obrolan, cuma konteks beberapa detik terakhir,
 * dan semuanya hilang begitu room bubar.
 */
export const CHAT_HISTORY_LIMIT = 30;

/**
 * Batas kirim: CHAT_RATE_MAX pesan per CHAT_RATE_WINDOW_MS.
 *
 * Longgar untuk orang yang mengobrol, ketat untuk yang membanjiri. Tanpa ini
 * satu orang bisa menenggelamkan seluruh riwayat dalam sedetik dan membuat
 * lobby tidak terbaca oleh semua orang lain.
 */
export const CHAT_RATE_MAX = 5;
export const CHAT_RATE_WINDOW_MS = 5000;

/**
 * Target skor multiplayer, diukur bukan ditebak.
 *
 * Angka lama (100/150/200) membuat match selesai dalam 23 detik di level 2 —
 * kurva kesulitannya tidak pernah sempat jalan sama sekali, dan pemain tidak
 * pernah melihat warna keempat, bom, apalagi dua warna target. Level MP naik
 * tiap MP_LEVEL_DURATION_MS, jadi panjang match ADALAH kurva kesulitannya:
 * menaikkan target skor satu-satunya cara memberi papan waktu untuk berkembang.
 *
 * Diukur dengan mensimulasikan engine yang sama persis dengan server, pemain
 * berebut satu papan dengan urutan kedatangan acak, 8 seed, nilai median:
 *
 * | target | 2 pemain      | 4 pemain       |
 * |--------|---------------|----------------|
 * |    500 |  50 dtk, Lv 4 |  76 dtk, Lv 6  |
 * |   1000 |  93 dtk, Lv 7 | 123 dtk, Lv 9  |
 * |   1500 | 122 dtk, Lv 9 | 173 dtk, Lv 12 |
 */
export const ALLOWED_TARGET_SCORES = [500, 1000, 1500] as const;

/**
 * Batas waktu di sini adalah JARING PENGAMAN, bukan cara normal match berakhir.
 *
 * Kalau batasnya lebih pendek dari waktu yang dibutuhkan untuk mencapai target,
 * hampir semua match akan berakhir karena kehabisan waktu — dan "siapa yang
 * lebih cepat" tidak pernah terjawab. Karena itu 300 ditambahkan: target 1500
 * dengan 4 pemain butuh ~173 dtk dan bisa menyentuh 188 dtk, jadi 180 saja
 * akan memotong sebagian match tepat sebelum garis finis.
 */
export const ALLOWED_TIME_LIMITS_SEC = [90, 120, 180, 300] as const;

/**
 * Laju skor pemain TERDEPAN di match rebutan — hasil pengukuran, bukan desain.
 *
 * Diperoleh dari simulasi engine yang sama dengan server (pemain berebut satu
 * papan, urutan kedatangan acak, 8 seed): 1000 poin tercapai di 93 detik dengan
 * 2 pemain. Dipakai HANYA untuk menerjemahkan target skor menjadi perkiraan
 * durasi match, dan dari situ menjadi level yang tercapai.
 *
 * Ada di sini supaya hubungan "target skor → level yang tercapai" bisa diuji.
 * Tanpa angka ini, tidak ada cara menahan seseorang menurunkan target skor
 * kembali ke nilai yang membuat match berakhir sebelum kurvanya jalan — dan itu
 * persis kegagalan yang pernah terjadi. Bukan untuk dipakai logika permainan:
 * pemain sungguhan lebih cepat atau lebih lambat dari ini.
 */
export const MP_LEADER_POINTS_PER_SECOND = 10.7;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  targetScore: 1000,
  timeLimitSec: 180,
  // Room baru selalu mulai sebagai semua-lawan-semua. Beregu dinyalakan host
  // dengan sengaja — bukan tebakan dari jumlah pemain, karena 4 orang yang
  // ingin main bebas sama wajarnya dengan 4 orang yang ingin 2v2.
  teamMode: 'ffa',
};

// ---------------------------------------------------------------------------
// Beregu (2v2 / 3v3 / 4v4)
// ---------------------------------------------------------------------------

export const TEAM_IDS = ['a', 'b'] as const satisfies readonly TeamId[];

/**
 * Jumlah pemain yang sah untuk match beregu.
 *
 * Hanya yang genap dan simetris. Regu yang timpang bukan sekadar tidak adil —
 * di mode ini poin seluruh anggota dijumlahkan, jadi regu bertiga mengumpulkan
 * poin lebih cepat daripada regu berdua sepanjang match, dan tidak ada
 * keterampilan yang bisa menutupinya.
 */
export const TEAM_MATCH_SIZES = [4, 6, 8] as const;

// ---------------------------------------------------------------------------
// Batas kewajaran skor solo
// ---------------------------------------------------------------------------
//
// Skor solo dihitung di browser, jadi server TIDAK bisa memverifikasinya —
// yang bisa dilakukan hanya menolak yang mustahil. Angka-angka ini tinggal di
// shared, bukan di route API, supaya sisi client dan server memakai definisi
// "mustahil" yang sama persis.

/**
 * Batas atas poin per detik bermain.
 *
 * Dihitung dari kasus terbaik yang mungkin: klik emas (poin ×5) dengan speed
 * bonus penuh, combo tertinggi, DAN bonus level tertinggi, pada kecepatan tap
 * tercepat yang diakui game ini. Sengaja longgar: menolak skor jujur karena
 * batasnya terlalu ketat jauh lebih merusak di game hobi daripada meloloskan
 * satu skor palsu.
 *
 * Setiap faktor dirujuk dari konstantanya, bukan ditulis sebagai angka.
 * Versi pertama rumus ini mengalikan dengan `2` yang ditulis langsung, dan
 * `2` itu hanya mewakili SALAH SATU dari combo atau bonus level — yang lain
 * terlewat, sehingga batasnya meleset setengah dari maksimum yang sebenarnya
 * bisa dicapai. Tidak pernah ketahuan karena skor asli jauh di bawahnya, tapi
 * artinya ronde yang sangat bagus bisa ditolak sebagai "mustahil".
 * `game.test.ts` sekarang mengunci batas ini terhadap `pointsForClick` yang
 * sesungguhnya, jadi buff skor di kemudian hari tidak bisa diam-diam
 * menghidupkan lagi bug yang sama.
 *
 * Kecepatan tap-nya memakai MAX_CLICKS_PER_SECOND — rate limit yang sudah
 * ditegakkan server di multiplayer — bukan angka baru yang dikarang khusus di
 * sini. Dengan begitu hanya ada SATU definisi "secepat apa manusia menap" di
 * seluruh proyek.
 */
export const MAX_POINTS_PER_SECOND =
  (BASE_POINTS + MAX_SPEED_BONUS) *
  Math.max(...COMBO_MULTIPLIERS) *
  MAX_LEVEL_BONUS_MULTIPLIER *
  GOLD_POINT_MULTIPLIER *
  MAX_CLICKS_PER_SECOND;

/**
 * Durasi satu ronde solo terpanjang yang masih masuk akal.
 *
 * Dipakai hanya untuk membatasi rekor guest yang dibawa ke akun baru, di mana
 * durasi ronde-nya tidak diketahui — lihat MAX_CLAIMABLE_SOLO_SCORE.
 */
export const MAX_PLAUSIBLE_SOLO_SECONDS = 1800;

/**
 * Plafon rekor guest yang boleh dibawa ke akun.
 *
 * Ini BUKAN pengaman anti-curang, dan tidak berpura-pura begitu: siapa pun
 * yang mau memalsukan skor bisa melakukannya lewat endpoint solo biasa dengan
 * durasi yang dibuat cocok, karena skornya memang dihitung di client. Gunanya
 * cuma satu — mencegah angka absurd (miliaran) nyangkut permanen di puncak
 * leaderboard. Pengaman yang sebenarnya adalah aturan sekali-pakai di endpoint
 * klaim: rekor hanya bisa dibawa selagi akunnya belum punya skor sama sekali.
 */
export const MAX_CLAIMABLE_SOLO_SCORE = MAX_POINTS_PER_SECOND * MAX_PLAUSIBLE_SOLO_SECONDS;

// ---------------------------------------------------------------------------
// Identitas rilis
// ---------------------------------------------------------------------------

/**
 * Versi yang ditampilkan di halaman About.
 *
 * Ditaruh di `shared` dan bukan dibaca dari package.json: paket-paket di
 * monorepo ini semuanya `private` dengan versi 0.0.0 yang tidak pernah
 * dinaikkan, dan membaca dari sana berarti menampilkan angka yang tidak
 * berarti apa-apa. Yang ini dinaikkan manual saat ada rilis yang layak
 * disebut rilis.
 */
export const APP_VERSION = '1.0.0';

/** Repositori sumber — ditautkan dari halaman About. */
export const GITHUB_OWNER = 'Hydraa57';
export const GITHUB_REPO = 'Game-Casual';
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_PROFILE_URL = `https://github.com/${GITHUB_OWNER}`;

/** Portofolio pembuat game — ditautkan dari halaman About. */
export const PORTFOLIO_URL = 'https://hfdz.my.id';
