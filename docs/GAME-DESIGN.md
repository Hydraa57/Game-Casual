# Game Design Document — Pixel Matrix

> Dokumen ini mengelaborasi FR-07 (Core Gameplay) dari [PRD.md](./PRD.md) menjadi spesifikasi yang bisa langsung diimplementasikan. Semua angka di sini adalah **hipotesis awal untuk balancing** — divalidasi lewat playtest di Fase 4, bukan angka final.
>
> **Catatan nama:** PRD masih menyebut gamenya "Pixel Pulse" karena dokumen itu dibiarkan verbatim sebagai blueprint asli. Nama itu ternyata sudah dipakai game lain (ada game rhythm di itch.io, plus "Pixel Pulse Studio"), jadi sejak Juli 2026 gamenya bernama **Pixel Matrix**. Bacalah "Pixel Pulse" di PRD sebagai nama lama dari game yang sama.

## 1. Konsep Inti

Pixel Matrix adalah game refleks arcade dengan sentuhan brain-training: pemain harus mencocokkan **warna target** dengan pixel yang menyala di papan, secepat dan seakurat mungkin. Tantangan mentalnya datang dari pergantian warna target yang memaksa otak "switch context" berulang kali — sederhana dipelajari, sulit dikuasai.

- **Solo mode**: endless, kejar high score, kesulitan naik bertahap.
- **Multiplayer (2–4 pemain)**: satu papan bersama, semua pemain berebut pixel yang sama — siapa cepat dia dapat.

Game harus nyaman dimainkan **di HP maupun desktop** — skenario utamanya orang ngumpul dan semua pegang ponsel masing-masing. Detail di §7.

## 2. Papan & Elemen Visual

| Elemen | Spesifikasi |
|---|---|
| Grid | **8×8** (64 sel) — jumlah sel **tetap di semua device** (lihat §7 Mobile) |
| Canvas | Persegi, responsif: mengisi lebar layar hingga maksimum 640×640 px |
| Warna pixel | 6 warna: merah, biru, hijau, kuning, ungu, oranye |
| Aksesibilitas | Setiap warna punya **glyph unik** kecil di dalam pixel (dukungan buta warna) |
| Gaya | UI ceria bergaya game anak: halaman terang berwarna, huruf membulat, tombol chunky (lihat "Arah visual" di bawah) |
| HUD | Warna target (besar, tengah atas), skor, combo meter, nyawa (solo) / leaderboard live (MP), timer |

### Arah visual (dirombak setelah masukan pemain)

Tema gelap bergaya terminal diganti total menjadi UI ceria: latar krem hangat dengan noda-noda pastel, kartu putih bersudut besar, tombol chunky yang benar-benar tertekan, dan huruf membulat (**Fredoka** untuk judul/tombol, **Nunito** untuk kalimat) — keduanya di-*host* sendiri lewat `next/font`, jadi tidak ada permintaan ke server font pihak ketiga saat pemain membuka game.

**Satu pengecualian yang disengaja: papannya TETAP berlatar dalam (`--board`, nila #2b1b53).**

Ini bukan sisa tema lama yang lupa diganti. Enam warna pixel game ini ditala untuk latar gelap, dan diukur terhadap latar terang hasilnya:

| warna | kontras di latar terang |
|---|---|
| kuning | 1,25:1 |
| emas ★ | 1,40:1 |
| hijau | 2,14:1 |
| oranye | 2,77:1 |
| biru | 2,94:1 |

Di bawah 3:1 pixelnya praktis lenyap ke latarnya — dan membedakan warna ADALAH gamenya. Nila #2b1b53 menjaga semua warna yang bisa ditap di atas 3,2:1 sekaligus terasa jauh lebih ceria daripada abu-abu tua yang lama. Papannya lalu dibingkai tebal putih dengan sudut besar supaya terbaca sebagai **layar mainan yang ditempel di halaman**, bukan lubang gelap di tengahnya. Prinsipnya standar di desain game: turunkan saturasi/luminansi latar untuk mendorong maju objek yang bisa disentuh.

Konsekuensi yang mudah dilanggar tanpa sadar: **komponen yang sama bisa muncul di halaman terang MAUPUN di atas papan.** Overlay, tutorial, dan layar hasil semuanya menempel di papan, jadi `.overlay` menimpa `--text`, `--text-dim`, dan kawan-kawannya menjadi versi terang untuk seluruh isinya sekaligus. Tombol yang warnanya harus tetap gelap (`.btn--primary`, `.btn--lemon`) memakai nilai yang **dipatok**, bukan `var(--text)` — kalau tidak, teksnya ikut memutih di dalam overlay dan jatuh ke 2,33:1.

Aturan kedua yang sama pentingnya: **`--accent` untuk MENGISI, `--accent-ink` untuk MENULIS.** Oranye cerah bekerja baik sebagai latar tombol dengan teks gelap (5,36:1), tapi sebagai warna teks di halaman krem ia cuma 2,18:1. Palet ceria selalu punya jebakan ini.

Seluruh pasangan teks/latar diperiksa otomatis dengan menyapu setiap elemen berteks yang benar-benar dirender di lima halaman, bukan dengan memeriksa palet di atas kertas — versi pertama patch ini lolos di atas kertas dan gagal di enam tempat saat disapu.

### Siklus hidup pixel

1. **Spawn** — pixel menyala di sel kosong acak dengan satu warna.
2. **Hidup** — selama `lifetime`; sisa umur divisualkan (pixel meredup bertahap).
3. **Expire** — pudar dan hilang jika tidak diklik.

### Warna target

- Ditampilkan besar di HUD; hanya pixel berwarna ini yang memberi poin.
- Berganti setiap **8–12 detik** (acak) ATAU setelah **8 klik benar**, mana yang lebih dulu.
- Ada **animasi peringatan 1 detik** sebelum ganti (HUD berkedip) supaya pergantian terasa adil, bukan jebakan.

## 3. Sistem Skor

| Aksi | Efek |
|---|---|
| Klik benar (warna = target) | `poin = (10 + speedBonus) × comboMultiplier` |
| Speed bonus | 0–10 poin, proporsional sisa umur pixel: `round(10 × sisaUmur / lifetime)` |
| Combo multiplier | Naik tiap **5 klik benar beruntun**: ×1 → ×1.5 → ×2 (maksimum) |
| Klik salah (warna ≠ target) | **−5 poin** (skor tidak bisa di bawah 0), combo reset ke ×1 |
| Pixel warna target expire tanpa diklik | Tidak ada penalti poin, tapi **memutus combo** |

Rasional: speed bonus menghargai refleks, combo menghargai konsistensi, dan penalti klik salah membuat spam-click merugikan (juga bagian dari mitigasi cheat di MP).

### Detail aturan yang diputuskan saat implementasi engine

Lima hal ini awalnya ambigu di draf pertama; keputusannya dikunci di kode dan unit test:

1. **Hanya pixel warna target yang memutus combo saat expire.** Pixel warna lain memang seharusnya diabaikan — kalau distraktor yang pudar ikut memutus combo, menjaga combo jadi mustahil begitu 6 warna aktif.
2. **Klik salah tidak menghapus pixel-nya.** Kalau dihapus, klik ngawur jadi strategi untuk membersihkan distraktor dari papan. Pemain kehilangan poin dan nyawa, papan tidak berubah.
3. **Multiplier berlaku pada klik yang menyentuh kelipatan 5**, bukan klik sesudahnya — jadi mencapai combo terasa langsung berhadiah. Klik ke-5 bernilai ×1.5.
4. **Tap pada pixel yang sudah hilang tidak dihukum** (`notFound` / `tooLate`, penalti 0). Di HP, tap ganda atau tap yang datang telat beberapa milidetik itu wajar — bukan kesalahan pemain. Ini juga yang membuat multiplayer adil: pemain yang kalah cepat merebut pixel tidak ikut dihukum.
5. **Spawn di-bias ke warna target** (`TARGET_COLOR_SPAWN_WEIGHT`, awalnya 0.5). Kalau warna dipilih merata dari 6 warna, hanya ~1/6 pixel yang bisa diklik dan papan terasa mati. Ini konstanta paling berpengaruh ke "rasa" permainan — yang pertama diulik saat balancing.

## 4. Solo Mode (Endless)

- **3 nyawa**. Klik salah = −1 nyawa. Nyawa habis = game over (sesuai FR-03).
- Pixel yang expire **tidak** mengurangi nyawa (hanya memutus combo) — game over selalu terasa "salahku sendiri".
- **Pause/resume** kapan saja; seluruh state (papan, timer, skor) dibekukan dan dilanjutkan persis (FR-04).
- High score: MVP disimpan di `localStorage`; setelah fase akun, tersinkron ke server via `POST /api/v1/solo-scores`.

### Kurva kesulitan

Level naik setiap **15 klik benar**. Kurvanya **diinterpolasi eksplisit dari Lv 1 ke Lv 20** — bukan peluruhan per level — supaya ujungnya tepat di "Lv 20 = MAX" dan angkanya bisa dibaca langsung:

| Parameter | Lv 1 | Lv 20 (MAX) |
|---|---|---|
| Interval spawn | 1200 ms | 500 ms |
| Lifetime pixel | 3000 ms | 1000 ms |
| Warna aktif | 3 | 6 (penuh sejak Lv 8: +1 di Lv 3, 5, 8) |
| Bonus poin level | ×1 | ×2 |

Angka nyata per level:

| Lv | spawn | lifetime | warna | pixel hidup | target hidup | bonus | poin maks/klik |
|---|---|---|---|---|---|---|---|
| 1 | 1200 | 3000 | 3 | 2,50 | 1,25 | ×1,00 | 40 |
| 5 | 1053 | 2579 | 5 | 2,45 | 1,22 | ×1,21 | 48 |
| 10 | 868 | 2053 | 6 | 2,37 | 1,18 | ×1,47 | 59 |
| 15 | 684 | 1526 | 6 | 2,23 | 1,12 | ×1,74 | 69 |
| 20 | 500 | 1000 | 6 | 2,00 | 1,00 | ×2,00 | 80 |

### ⚠️ Aturan yang tidak boleh dilanggar saat mengulik kurva

**Umur pixel harus menyusut dengan rasio LEBIH BESAR daripada jeda spawn.** Versi pertama game ini melanggarnya (spawn −8%/level, lifetime −5%/level), akibatnya papan justru makin padat dan pixel warna target yang tersedia **naik** dari 1,25 (Lv 1) ke 1,83 (Lv 15) — sebagian kenaikan kesulitan saling meniadakan, dan gamenya terasa hambar di level tinggi.

Sekarang lifetime menjadi 1/3 sementara spawn menjadi 5/12, jadi "pixel hidup" menurun 2,50 → 2,00. Ada unit test (`difficulty.test.ts`, blok "arah kesulitan") yang gagal kalau arahnya terbalik lagi.

Kesulitan datang dari tiga arah sekaligus: **jendela reaksi menyusut 3×** (3000 → 1000 ms), **distraktor bertambah** (3 → 6 warna), dan **sasaran makin langka** (1,25 → 1,00 pixel target hidup). Plus mekanik di §4.1 dan §4.2.

### 4.1 Pixel spesial

Selain pixel biasa, papan bisa memunculkan tiga jenis pixel yang **tidak peduli warna target**:

| Jenis | Muncul | Peluang | Umur | Efek di-tap | Dibiarkan pudar |
|---|---|---|---|---|---|
| **Bom ☠** | Lv 8+ | 8% → 15% di Lv 20 | normal | **−2 nyawa**, combo putus, shake + flash + getar. Sama di solo dan MP | Tidak apa-apa — memang harus dihindari |
| **Emas ★** | Lv 3+ | 4% | 60% dari normal | Poin **×5**, combo +1, warna apa pun boleh | Tidak ada penalti |
| **Nyawa ♥** | Lv 5+ | 3%, hanya jika nyawa < 5 | 70% dari normal | **+1 nyawa** (maks 5), combo +1 | Tidak ada penalti (tapi sayang) |

Pixel biasa tetap >70% dari seluruh spawn bahkan di Lv 20 — pixel spesial adalah bumbu, bukan mekanik utama.

**Bom memotong DUA nyawa, klik warna salah hanya satu.** Dengan 3 nyawa awal, dua bom menghabisimu. Kalau harganya sama dengan klik salah biasa, menahan diri tidak pernah terasa penting — dan justru itu satu-satunya hal baru yang dibawa bom ke gameplay.

**Bom adalah satu-satunya pixel yang menghukum karena DISENTUH**, bukan karena diabaikan. Ini yang menambah dimensi menahan diri (*response inhibition*) ke gameplay yang tadinya murni refleks, dan yang paling mendekatkan game ini ke klaim "brain training" di PRD.

Dua keputusan visual yang wajib dipertahankan, keduanya soal keadilan di layar HP:

1. **Bom tidak boleh mungkin dikira pixel biasa** — warna gelap khusus di luar palet 6 warna, border merah tebal 4px, dan glyph ☠.
2. **Bom tidak memudar sejauh pixel lain** (alpha minimum 0,7 vs 0,3). Warnanya gelap dan hampir menyatu dengan latar papan; kalau ia sampai nyaris tembus pandang, pemain bisa menyangka selnya kosong lalu menap-nya — dihukum untuk sesuatu yang tidak terlihat.

Karena ★ direservasi untuk pixel emas, **glyph kuning dipindah dari ★ ke ▼**. Ada test yang gagal kalau glyph warna dan glyph pixel spesial bertabrakan lagi.

### 4.2 Dua warna target (Lv 12+)

Sejak **Lv 12** ada **dua warna target aktif bersamaan**, keduanya memberi poin, dan HUD menampilkan dua swatch berdampingan.

Yang penting: **bobot spawn total ke warna target tetap 0,5** — dibagi di antara kedua warna. Jadi kepadatan pixel yang bisa diklik tidak berubah sama sekali; kesulitan tambahannya **murni** karena pemain harus melacak dua warna sekaligus (beban memori kerja), bukan karena papan jadi lebih sibuk.

Satu detail implementasi yang wajib dipertahankan: **jumlah warna target disinkronkan begitu level berubah**, bukan menunggu pergantian terjadwal berikutnya. Tanpa ini, pemain yang baru naik ke Lv 12 masih melihat satu warna target sampai 12 detik kemudian — levelnya naik tapi gamenya belum berubah, dan itu terasa seperti bug.

### 4.3 Mode chaos (Lv 21+)

Setelah menaklukkan seluruh kurva (Lv 20 = MAX), tiap level berikutnya mengaktifkan **satu modifier acak**. Ini yang menggantikan "tidak ada apa pun yang berubah lagi" di versi lama.

| Modifier | Efek |
|---|---|
| **Serbuan** (`rush`) | Jeda spawn ×0,7 untuk level itu |
| **Gelap** (`blackout`) | Glyph disembunyikan — murni bedakan warna. **Bom dikecualikan**: menyembunyikannya berarti menghukum pemain untuk sesuatu yang tidak bisa dilihat |
| **Hujan Bom** (`bombRain`) | Peluang bom ×2 |
| **Acak** (`shuffle`) | Posisi pixel yang hidup diacak setiap 4 detik |

Modifier dipilih **deterministik dari seed match + level**, jadi ronde bisa di-replay dan nanti semua pemain multiplayer melihat modifier yang sama. Seed-nya (`board.chaosSeed`) dipisah dari `rngState` yang terus berubah, dan **dipertahankan saat continue** supaya modifier per level tidak berubah di tengah ronde.

Progres utama (Lv 1–20) sengaja **selalu tanpa modifier** — pemain harus bisa mempelajari kurva dasarnya dulu sebelum dilempar ke keacakan.

## 5. Multiplayer — Papan Rebutan (2–4 pemain)

### Prinsip

Semua pemain melihat **papan yang sama** dan berebut pixel yang sama. **Server otoritatif**: server yang men-spawn pixel, dan server yang memutuskan siapa pemenang klik berdasarkan urutan kedatangan (first-arrival). Client hanya merender dan mengirim intent klik.

### Aturan khusus MP

- Klik benar pertama yang sampai di server mengklaim pixel; pemain lain yang telat mendapat feedback `clickRejected` (pixel tetap hilang dari papan).
- **3 nyawa, sama seperti solo.** Bom memotong 2, klik warna salah memotong 1, pixel ♥ mengembalikan 1.
- Klik salah: **−5 poin** + **−1 nyawa** + **cooldown input lokal 500 ms** (layar berkedip merah singkat). Tiga hukuman menumpuk untuk satu kesalahan — itu disengaja dan membuat ketelitian sama pentingnya dengan kecepatan.
- Server melakukan **rate limit ~8 klik/detik/pemain** — klik berlebih diabaikan (mitigasi spam & cheat, sesuai analisis risiko PRD).
- Combo dan speed bonus berlaku sama seperti solo.
- **Tidak ada checkpoint/continue di MP** — itu fitur solo, dan digating dari mode (bukan dari keberadaan nyawa).

### KO, respawn, dan eliminasi

| Kejadian | Akibat |
|---|---|
| Nyawa habis (KO ke-1 dan ke-2) | **Beku 5 detik** (`MP_FREEZE_MS`), lalu hidup lagi dengan **nyawa penuh** |
| KO ke-3 (`MP_MAX_KNOCKOUTS`) | **Tereliminasi** — hanya bisa menonton sampai match usai |
| Pemain aktif tersisa ≤ 1 | Match langsung selesai, `endReason: elimination` |

Aturan terakhir itu yang membuat **"kalau main berdua, tereliminasi = langsung kalah"** bekerja tanpa kasus khusus untuk dua pemain: dari berapa pun pemain, match berhenti begitu yang masih bermain tinggal satu.

**Pemain tereliminasi SELALU diperingkat di bawah pemain yang bertahan, berapa pun skornya.** Tanpa aturan ini, "bunuh diri sambil unggul skor" jadi strategi yang menang — dan janji "yang tereliminasi kalah" tidak akan terpenuhi.

Yang **tidak** direset saat hidup lagi dari KO: skor dan combo terbaik. Yang hilang karena kehabisan nyawa adalah waktu bermain, bukan poin yang sudah dikumpulkan.

**Pixel ♥ selalu boleh muncul di MP**, tidak peduli nyawa siapa pun. Papannya bersama — kalau spawn-nya bergantung pada nyawa satu pemain, pemain yang sekarat justru tidak akan pernah melihatnya muncul karena lawannya kebetulan penuh.

#### ⚠️ Angka yang perlu diperhatikan saat playtest

Dengan aturan sekarang, **3 klik warna salah = 1 KO**, dan **3 KO = tereliminasi**. Artinya ~9 klik salah dalam satu match berarti keluar dari permainan — dan bom mempercepatnya karena satu bom setara dua klik salah.

Itu keras, dan memang dimaksudkan keras. Tapi kalau saat main bareng ternyata ada yang tereliminasi di menit pertama secara rutin, tuas yang paling tepat diputar adalah **`MP_MAX_KNOCKOUTS`** (3 → 4/5) atau **`MP_STARTING_LIVES`** — bukan menghapus penalti nyawa pada klik salah, karena justru itu yang membuat ketelitian punya arti.

**Simulasi lawan bot memberi bukti angka untuk peringatan di atas.** `apps/game-server/scripts/sim-bot.mts` mengadu profil bot melawan dua acuan manusia dengan aturan MP lengkap.

> **Catatan revisi — dua bug, bukan satu sifat aturan.**
>
> Versi sebelumnya dokumen ini menyimpulkan bahwa "hampir setiap match berakhir karena eliminasi dalam 30–55 detik" adalah sifat aturannya, dan menyarankan memutar `MP_MAX_KNOCKOUTS` kalau terasa terlalu keras. Kesimpulan itu **salah alamat**, dan dua hal yang berbeda menyembunyikannya:
>
> 1. **`BotDriver` mengundi peluang salahnya per TICK, bukan per ketukan.** Selama papan hanya berisi warna yang salah, `pickBotTarget` dipanggil ulang 20× per detik dan tiap panggilan mengundi lagi. Akurasi 98,5% yang tertulis di profil praktis jadi 37% salah di permainan sungguhan — 9 klik salah dari 25 ketukan, cukup untuk 3 KO dan eliminasi sebelum menit pertama lewat.
> 2. **`sim-bot.mts` sendiri sudah lama rusak.** Ia menyusun `GameConfig`-nya sendiri dan melewatkan `spawnCrowdFactor` yang belakangan ditambahkan, jadi `spawnIntervalMs(level) / undefined` = NaN dan papannya **tidak pernah memunculkan satu pixel pun**. Skripnya tetap mencetak tabel — skor 3–9 poin setelah 180 detik — dan tabel itu ikut dikutip di sini. Folder `scripts` tidak masuk `tsconfig`, jadi tidak ada yang menangkapnya. Sekarang masuk.
>
> Setelah keduanya diperbaiki (`sim-durasi.mts`, 8 seed, median): match yang tadinya berhenti di **~60 dtk pada Lv 4–5 dengan 0% menyentuh target** kini berjalan **94 dtk Lv 7 (2 pemain) sampai 307 dtk Lv 21 (4 pemain, target 4000)**, dan seluruh match bertarget ≤1500 benar-benar berakhir di garis finis. Diperiksa juga di aplikasi yang berjalan: match default 1500 dengan dua bot `medium` berlangsung **155 detik sampai level 11**.

Dengan `sim-bot.mts` yang sudah benar, tangga kesulitannya juga akhirnya bisa dibaca — dan ia sesuai dengan yang dimaksudkan:

| Tingkat | vs pemain kasual | vs pemain lancar |
|---|---|---|
| `easy` | menang 8% | menang 0% |
| `medium` | menang 62% | menang 0% |
| `hard` | menang 100% | menang 60% |

Eliminasi tetap keras, dan tetap perlu diperiksa di playtest dengan manusia — tapi ia bukan lagi hal yang mengakhiri hampir semua match sebelum kurva kesulitannya sempat jalan (0–22% match berakhir karena eliminasi, bukan ~100%).

### Lawan bot (`easy` / `medium` / `hard`)

Ada supaya "kurang pemain" tidak berarti "tidak bisa main". Host mengisi kursi kosong dari lobby; bot menempati **kursi sungguhan** — ikut menghabiskan kapasitas room, punya avatar unik, dan muncul di scoreboard seperti pemain lain.

Aturan yang menentukan seluruh rancangannya: **bot bermain lewat jalur yang sama persis dengan manusia.** Ketukannya masuk lewat `Match.handleClick`, jadi ia tunduk pada rate limiter, aturan beku, penalti bom, dan rumus skor yang sama. Tidak ada jalur khusus — kalau ada, mengalahkannya tidak berarti apa-apa.

Yang membedakan tingkat kesulitan hanya dua hal yang juga membedakan manusia satu dengan lainnya: **seberapa cepat ia bereaksi** dan **seberapa sering ia salah**. Angkanya ada di `BOT_PROFILES` (`packages/shared/src/engine/bot.ts`), lengkap dengan tabel hasil penalaannya.

Empat hal yang mudah dilanggar tanpa sadar saat mengubahnya:

1. **Minimal satu manusia untuk memulai match.** Tanpa syarat ini, room yang ditinggal pemiliknya bisa menjalankan match antar-bot yang memakan tick server tanpa penonton.
2. **Host tidak pernah jatuh ke bot.** Bot tidak bisa menekan "mulai" maupun mengubah pengaturan; menyerahkan host kepadanya mengunci room permanen.
3. **Room yang tinggal berisi bot langsung bubar.** `isEmpty` saja tidak cukup sejak bot menempati kursi — manusia terakhir yang keluar akan meninggalkan room yang tidak akan pernah kosong sendiri.
4. **Chat tetap menghitung manusia saja.** Bot tidak membaca apa pun; membuka chat karena ada bot di lobby sama saja menyuruh pemain bicara sendiri.

Bot juga **tidak menampilkan lencana ping**: ia tidak punya jaringan untuk diukur, dan "0 ms" akan terbaca sebagai lawan berkoneksi sempurna. Tapi ia **ikut ditahan penyetaraan ping** (di bawah) — justru karena ia tidak berjaringan, ia pihak yang paling diuntungkan di papan rebutan.

### Penyetaraan ping

Dilaporkan pemain, dan memang bisa dihitung: server yang otoritatif menyelesaikan rebutan menurut **urutan kedatangan** ketukan. Dua pemain yang bereaksi di milidetik yang persis sama, satu berping 40 ms dan satu 240 ms, sampai ke server terpaut 100 ms — dan yang lambat kalah setiap kali, tanpa satu pun hubungannya dengan refleksnya. Di game yang seluruh isinya refleks, itu bukan gangguan kecil.

Ketukan pemain berkoneksi cepat karena itu **ditahan sebentar** sampai kira-kira setara dengan pemain terlambat di match yang sama (`engine/fairness.ts`). Teknik yang sama dengan delay-based netcode di game fighting.

Empat aturan yang menjaganya tidak berubah jadi masalah baru:

| Aturan | Kenapa |
|---|---|
| Penahanan **dibatasi 80 ms** (`MP_PING_EQUALIZE_CAP_MS`) | Tujuannya memperkecil jurang, bukan meratakan semua orang ke koneksi terburuk di room. 80 ms masih di bawah ambang rasa (~100 ms). Contoh: 40 vs 240 ms → jurang satu arah 100 ms turun jadi 20 ms |
| Penahanan **di bawah satu tick server (50 ms) tidak dijalankan** | Antrean dikuras di awal tick, jadi permintaan menahan 3 ms pada praktiknya menahan sampai 50 ms. Membulatkannya ke atas justru MEMPERBESAR jurang: dua orang di WiFi yang sama (45 dan 50 ms) akan bertukar posisi |
| **Acuannya hanya pemain yang masih tersambung** | Ping terakhir orang yang koneksinya putus biasanya buruk justru karena itulah ia putus. Membiarkannya jadi acuan berarti seisi room ditahan demi orang yang sudah tidak mengetuk apa pun |
| **Rate limiter tetap di titik kedatangan** | Ia penjaga anti-spam. Kalau ikut dipindahkan ke belakang penahanan, badai ketukan hanya sebagian yang terhitung |

Angkanya **ditampilkan, bukan disembunyikan** — lencana ping pemain yang sedang ditahan diberi penanda, dan keterangannya menyebut berapa ms. Tanpa itu, pemain berping bagus cuma merasakan permainannya jadi lebih lamban, dan rasa itu terbaca sebagai server yang buruk alih-alih sebagai keadilan.

**Yang tidak dipilih:** mengurutkan rebutan menurut cap waktu dari client. Itu tidak memperlambat siapa pun dan lebih adil di atas kertas, tapi cap waktunya berasal dari mesin pemain — siapa pun yang mau curang tinggal mengaku menekan lebih awal dan memenangkan setiap rebutan. Di room yang kodenya bisa dibagikan ke siapa saja, itu bukan risiko teoretis.

### Avatar & umpan balik "siapa yang merebut"

Ditambahkan setelah playtest pertama di HP. Keluhannya: papannya terasa seperti main sendiri-sendiri, karena tidak ada tanda apa pun bahwa pixel yang hilang itu direbut orang lain.

- Sebelum masuk room, pemain memilih satu dari **16 avatar** (🦊 🐱 🐸 🦉 🐼 🐝 🦈 🤖 🐶 🐵 🦁 🐧 🦄 🐙 🦖 🐲). Pilihannya diingat di `localStorage`.
  Jumlahnya **dua kali** `MAX_PLAYERS_LIMIT`, bukan sama dengannya. Kalau jumlahnya pas, pemain terakhir yang masuk ke room penuh tidak punya pilihan sama sekali — apa pun yang ia tekan sudah diambil, dan server memberinya satu-satunya sisa. Dengan dua kali lipat, room berdelapan pun masih menyisakan delapan avatar bebas.
- Saat sebuah pixel diklaim, **glyph avatar perebutnya dicap di sel itu** selama ±0,6 detik. Cap sendiri tampil penuh dan lebih besar; cap lawan diredupkan — supaya bisa dibedakan sekejap tanpa membaca nama.
- Avatar juga tampil di daftar lobby, leaderboard, dan layar hasil.

Dua aturan yang tidak boleh dilanggar:

1. **Avatar wajib unik dalam satu room.** Kalau kembar, cap di sel berhenti menjawab "siapa" dan justru menyesatkan. Kalau pilihan pemain sudah diambil, server **menggantinya** dengan avatar bebas pertama — bukan menolak join. Menolak hanya karena teman lebih dulu menekan tombol yang sama itu gesekan yang tidak ada gunanya di tongkrongan. Avatar yang benar-benar dipakai selalu dikirim balik lewat `room:state`.
2. **Avatar memakai emoji, bukan bentuk geometris.** Capnya muncul di atas papan yang sudah penuh ▲●■▼◆✚☠★♥; avatar berbentuk geometris akan terbaca sebagai warna target atau pixel spesial. Dijaga oleh test tabrakan glyph di `constants/game.test.ts`.

Avatar tidak dikirim di dalam `game:pixelClaimed`. Client memetakan `byPlayerId` → avatar dari `room:state`, supaya jalur terpanas permainan tetap ringan.

### Pengaturan room (dipilih host)

| Setting | Pilihan | Default |
|---|---|---|
| Max players | 2 / 3 / 4 | 4 |
| Target skor | 500 / 1000 / 1500 / 2500 / 4000 | 1500 |
| Batas waktu | 90s / 2m / 3m / 5m / 7m / 10m | 5m |

**Kondisi menang**: pemain pertama yang mencapai target skor, ATAU skor tertinggi saat waktu habis (FR-08). **Seri → sudden death**: papan dikosongkan, satu pixel warna target muncul — siapa cepat dia menang. Layar hasil menampilkan **waktu tempuh** match (M:SS) — itu yang membuat setiap ronde jadi rekor yang bisa dikejar ronde berikutnya, bukan cuma daftar angka.

#### Kenapa angkanya sebesar itu — panjang match ADALAH kurva kesulitan

Level multiplayer naik menurut waktu (`MP_LEVEL_DURATION_MS`, 15 dtk/level), bukan menurut klik. Konsekuensinya langsung: **target skor menentukan seberapa jauh kurva kesulitan sempat berjalan.**

Angka pertama (100/150/200, default 150) melewatkan itu sepenuhnya: match berakhir di level 2, dan warna keempat (Lv 3), bom (Lv 8), serta dua warna target (Lv 12) **tidak pernah muncul sama sekali di multiplayer**.

Diukur ulang dengan `apps/game-server/scripts/sim-durasi.mts` — engine yang sama persis dengan server, satu papan diperebutkan, urutan giliran diacak tiap tick, ukuran papan dan pasokan pixel mengikuti jumlah pemain, aturan nyawa/beku/eliminasi lengkap, 8 seed, profil pemain lancar, nilai median. "target%" = berapa persen match yang benar-benar berakhir di garis finis, bukan karena eliminasi:

| Target | 2 pemain | 4 pemain | 8 pemain | target% |
|---|---|---|---|---|
| 500 | 62 dtk → Lv 5 | 105 dtk → Lv 7 | 88 dtk → Lv 6 | 100% |
| 1000 | 94 dtk → Lv 7 | 154 dtk → Lv 11 | 143 dtk → Lv 10 | 100% |
| **1500** (default) | **127 dtk → Lv 9** | **206 dtk → Lv 14** | **196 dtk → Lv 14** | 88–100% |
| 2500 | 195 dtk → Lv 13 | 274 dtk → Lv 19 | 222 dtk → Lv 15 | 75–88% |
| 4000 | 229 dtk → Lv 16 | 307 dtk → Lv 21 | 283 dtk → Lv 19 | 38–75% |

Dua hal yang dibaca dari tabel ini:

1. **Target tinggi memang membawa ke level tinggi** — 4000 dengan 4 pemain menembus Lv 21, yaitu mode chaos. Itu sebabnya keduanya ditambahkan.
2. **Tapi makin tinggi targetnya, makin sering match justru berakhir karena eliminasi.** Pada 4000 hanya 38–75% match yang sampai garis finis. Target yang jarang tersentuh berhenti berarti sebagai target — karena itu default tetap di 1500, bukan di angka tertinggi.

Batas waktu adalah **jaring pengaman, bukan cara normal match berakhir**. Kalau batasnya lebih pendek dari waktu yang dibutuhkan untuk mencapai target, hampir semua match habis waktu dan "siapa yang lebih cepat" tidak pernah terjawab. Yang harus ditampung adalah seed **terlambat**, bukan mediannya: target 2500 bisa memakan 296 dtk dan 4000 sampai 334 dtk, jadi 300 dtk saja akan memotong sebagian match tepat sebelum garis finis. 7 menit menampung keduanya; 10 menit disediakan untuk pemain sungguhan, yang lebih lambat daripada simulasi.

### Alur match

```
Lobby (room code 6 karakter, ready check semua pemain)
  → Countdown 3-2-1
  → Match berjalan (leaderboard live di sisi papan)
  → Layar hasil (peringkat + statistik: akurasi, combo terbaik)
  → Rematch (kembali ke lobby, pengaturan dipertahankan)
```

- Pemain **tidak bisa join saat match berjalan** (`GAME_IN_PROGRESS`); harus menunggu di luar atau join setelah selesai.
- **Disconnect = keluar dari match**; skor terakhirnya tetap tampil di hasil. Reconnect mid-match dicatat sebagai *stretch goal*, bukan MVP.
- Multiplayer **tidak bisa di-pause** (sesuai constraint PRD).

### Detail yang diputuskan saat implementasi server

Semua ini muncul dari pertanyaan yang tidak terjawab oleh rencana awal, dan sengaja ditulis di sini karena mudah dilanggar tanpa sadar saat mengubah kode.

1. **Level naik menurut waktu, bukan klik.** Satu level tiap `MP_LEVEL_DURATION_MS` (15 dtk). Kalau ikut jumlah klik seperti solo, kesulitan papan bersama akan ditentukan oleh pemain yang paling rajin mengetuk — pemain yang lebih santai dihukum atas kecepatan lawannya.
2. **Papan bersama, skor terpisah.** Server memanggil engine yang sama dengan solo, dengan papan bersama dipasangkan sementara ke skor pemain yang mengklik; papan hasilnya langsung menjadi papan bersama yang baru. Itulah yang membuat first-arrival bekerja tanpa penguncian apa pun.
3. **Kalah cepat bukan kesalahan.** Klik yang datang setelah pixelnya diklaim orang lain dijawab `notFound` **tanpa penalti apa pun** — tidak memotong skor, tidak memutus combo. Kalau tidak, pemain dengan koneksi lebih lambat dihukum dua kali.
4. **Pixel target yang lewat tanpa diklaim siapa pun memutus combo SEMUA pemain.** Tidak ada yang berhasil mengambilnya, jadi tidak adil kalau hanya sebagian yang kehilangan combo.
5. **Checkpoint/continue tidak berlaku di MP** — itu fitur solo, digating dari mode. (Catatan ini sebelumnya berbunyi "tidak ada sistem nyawa di MP"; itu sudah tidak benar sejak nyawa, KO, dan eliminasi ditambahkan — lihat tabel di atas.)
6. **Batas akhir match dipegang `Match`, bukan engine.** Config papan MP memakai `timeLimitMs: null` dan `targetScore: null`. Kalau engine yang menghentikan papan saat waktu habis, sudden death — yang justru harus berjalan melewati batas itu — ikut mati.
7. **Sudden death hanya dipicu seri di puncak.** Seri di posisi 2–3 tidak menahan match; yang diperebutkan hanya juara. Pixelnya berumur `SUDDEN_DEATH_LIFETIME_MS` (4 dtk) dan langsung diganti kalau habis, jadi tidak mungkin buntu.
8. **Room ditahan di status `finished` sampai pemain menutup layar hasil.** Mengembalikannya ke `waiting` begitu match selesai membuat client berpindah ke lobby sebelum sempat menggambar hasilnya. Penutupnya event eksplisit `room:backToLobby`.
9. **Tick 20 Hz, siaran skor 4 Hz.** Papan disimulasikan tiap `SERVER_TICK_MS` (50 ms) supaya spawn/expire presisi, tapi leaderboard hanya dikirim tiap `MP_TICK_BROADCAST_MS` (250 ms) — cukup untuk mata, jauh lebih hemat di jaringan seluler.
10. **Waktu spawn diselaraskan ulang di client.** Pixel dari server dicatat memakai jam scene lokal, supaya animasi memudarnya tetap benar walau `elapsedMs` server dan client tidak persis sama.

## 6. Game Feel / Juice

- [x] Partikel burst + SFX chiptune saat klik benar; nada naik seiring combo.
- [x] Screen shake kecil + flash merah saat klik salah; getar (`navigator.vibrate`) di HP.
- [x] Popup poin melayang di posisi klik, dan popup combo di tengah papan.
- [x] Toggle mute — **satu preferensi untuk solo dan multiplayer**, disimpan di `localStorage`.
- [ ] BGM (belum ada; SFX saja untuk sekarang).

Tiga keputusan yang diambil saat mengerjakannya:

1. **Tidak ada satu pun file aset.** SFX dibangkitkan WebAudio, tekstur partikel digambar program saat runtime. Menambah unduhan hanya demi efek akan melawan target load < 3 detik di jaringan seluler (NFR).
2. **Popup combo hanya di kelipatan 5**, bukan tiap klik benar — dan kelipatan itu dipilih karena selaras dengan tangga multiplier, jadi popup-nya menandai sesuatu yang benar-benar berubah. Kalau muncul terus-menerus, ia berhenti terasa sebagai pencapaian dan mulai menghalangi pandangan ke papan.
3. **Di multiplayer, popup combo hanya untuk combo sendiri.** Combo lawan yang menutupi papanmu adalah hukuman untuk pemain yang sedang tertinggal — persis kebalikan dari yang seharusnya.

Ukuran partikel disetel di koordinat papan internal (640px) yang menyusut ke ~360px di layar HP; nilai yang terlihat wajar saat mengembangkan di desktop menjadi bintik tak terbaca di HP.

## 7. Mobile & Touch (wajib, bukan opsional)

Skenario utama game ini adalah **nongkrong**: semua orang pegang HP, tidak ada yang buka laptop. Karena itu HP adalah target kelas satu, bukan afterthought. Ini **memperluas** constraint Usability di PRD yang semula menyebut desktop saja — game tetap jalan di desktop, tapi layout dirancang **mobile-first**.

### Aturan desain

| Aspek | Keputusan |
|---|---|
| Grid | **Tetap 8×8 di semua ukuran layar.** Yang di-scale adalah ukuran pixel-nya, bukan jumlah selnya — papan multiplayer wajib identik untuk semua pemain, dan high score solo harus sebanding antar device |
| Target sentuh | Di HP 360 px, satu sel ≈ 44 px — tepat di ambang minimum target sentuh. Gap antar pixel dibuat tipis supaya area tap maksimal |
| Orientasi | **Portrait-first**: HUD di atas, papan persegi di tengah, kontrol di bawah. Landscape tetap jalan (papan di tengah) |
| HUD | Dibuat sebagai **DOM/React, bukan digambar di dalam canvas** — teks ikut ukuran font sistem, rapi di layar kecil, dan mudah di-i18n |
| Kontrol | Tombol pause & mute minimal 44×44 px di zona jempol (bawah). Tidak ada interaksi yang butuh hover atau keyboard |
| Gestur | `touch-action: none` di area papan supaya tap tidak memicu scroll; double-tap zoom dinonaktifkan; tap highlight dimatikan |
| Notch | Padding mengikuti `env(safe-area-inset-*)` |
| Feedback | Getar (`navigator.vibrate`) singkat saat klik salah, kalau device mendukung |

### Konsekuensi untuk gameplay

- **Tidak ada mekanik yang butuh presisi kursor** — semua interaksi adalah tap pada sel berukuran jempol.
- Karena tap di HP sedikit lebih lambat dari klik mouse, angka balancing (spawn/lifetime) **divalidasi di HP dulu**, bukan di desktop. Kalau di HP terasa mustahil, angkanya yang salah — bukan pemainnya.
- Multiplayer campuran HP + desktop: perbedaan kecepatan input antar device diterima sebagai bagian dari permainan santai (bukan game esport). Dicatat sebagai hal yang diamati saat playtest Fase 4.

## 8. Ide Lanjutan (Fase 5+, dicatat saja — bukan komitmen)

- **Power-up**: color bomb (klaim semua pixel satu warna), freeze lawan 2 dtk, shuffle papan.
- **Mode papan-terpisah**: tiap pemain papan identik (seeded sama), murni adu kecepatan — varian yang lebih "adil".
- **Daily challenge**: seed harian yang sama untuk semua pemain, leaderboard harian.
