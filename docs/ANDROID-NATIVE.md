# Aplikasi Android Native (`apps/mobile`)

Klien Android sungguhan — **bukan situs yang dibungkus**. Tidak ada WebView di
mana pun; setiap hal yang terlihat di layar adalah komponen Android.

## Kenapa React Native, bukan yang lain

Tiga alasan pemain meminta native: ingin produk Android asli, mode solo harus
jalan **offline**, dan ingin terasa lebih mulus. Alasan kedua yang menentukan
teknologinya.

Solo offline berarti **engine aturan main harus jalan di HP**. Ada dua cara:

| | Engine di HP | Risikonya |
|---|---|---|
| **React Native** | `@pixelmatrix/shared` yang SAMA, apa adanya | — |
| Flutter / Kotlin | 3.697 baris diport ke Dart/Kotlin | Dua salinan aturan main yang harus dijaga sinkron selamanya |

Salinan kedua adalah tempat bug diam-diam masuk: nilai yang meleset sedikit di
klien membuat tampilan tidak cocok dengan server, dan gejalanya muncul sebagai
"kok skorku beda" berbulan-bulan kemudian. React Native menghapus seluruh kelas
masalah itu — bukan karena lebih mudah, tapi karena tidak ada yang disalin.

### Papan digambar dengan apa

Rencana awalnya **Skia** (`@shopify/react-native-skia`) — penggambar GPU yang
setara Phaser di web — dan paketnya sempat ikut dipasang. Ia **dikeluarkan lagi
sebelum dipakai**: satu pun barisnya tidak pernah diimpor, tapi `librnskia.so`
tetap ikut ke dalam APK dan memakan ~14 MB. Bayarannya nyata, manfaatnya belum
ada.

Papannya kemudian **dibuat dengan `View` biasa**, dan itu ternyata memang cukup:
isinya paling banyak 64 kotak berwarna dengan satu huruf di tengahnya. Pudarnya
pixel digambar lewat `opacity` yang dihitung ulang tiap frame dari
`remainingRatio` — perhitungan yang sama persis dengan yang dipakai web.

Efeknya sekarang sudah ada — semburan saat klaim, angka poin melayang,
guncangan, kilatan bom, gelombang pelangi naik level — dan **semuanya tetap
`View` biasa plus Reanimated**, yang sudah ikut dipaketkan untuk keperluan lain.
Jadi Skia tidak dibutuhkan untuk sampai ke titik ini.

Yang paling berat di antaranya adalah gelombang pelangi: ia membuat 64 View
tambahan selama 0,9 detik, sekali tiap naik level. Angka itu ditulis di sini
supaya jelas apa yang harus dicurigai duluan kalau nanti tersendat.

Skia baru dipertimbangkan lagi kalau ada **bukti dari perangkat sungguhan**
bahwa ini tersendat di HP kelas bawah — bukan firasat. Menambahkannya kembali
cuma butuh satu `pnpm add`.

### Font: jalan yang berputar, dan kenapa

Web memakai **Fredoka** (judul, tombol, angka) dan **Nunito** (kalimat) lewat
`next/font`. Selama keduanya belum ikut dipaketkan, versi Android memakai font
sistem — dan itu perbedaan yang paling cepat terlihat saat kedua versi
disandingkan, karena judulnya jadi terbaca sebagai aplikasi biasa alih-alih
sebagai game.

Android hanya bisa membaca **.ttf/.otf** dari `assets/fonts`. Google Fonts tidak
menyajikan .ttf ke sembarang klien — yang keluar tergantung `User-Agent`:

| Yang dikirim | Yang diterima | Bisa dipakai Android? |
|---|---|---|
| UA Internet Explorer lama | **EOT** | Tidak |
| UA Firefox 3.6 | **WOFF** | Tidak |
| UA peramban modern | **woff2** | Tidak langsung |

Keduanya yang pertama sempat terunduh dan tampak benar — namanya berakhiran
`.ttf` dan ukurannya masuk akal — padahal isinya bukan TrueType sama sekali.
Yang membongkarnya cuma memeriksa empat byte pertama berkasnya.

Jalan yang dipakai: ambil **woff2**, lalu buka pembungkusnya jadi TTF dengan
`fontTools`. Ini justru pilihan yang paling tepat, bukan sekadar jalan pintas —
woff2 adalah berkas yang SAMA persis dengan yang diunduh `next/font` untuk web,
jadi bentuk hurufnya identik dan bukan sekadar "font dengan nama yang sama".

Delapan bobot, subset latin, **total 304 KB**. Nama internal tiap berkas ditulis
ulang jadi unik per bobot (`Nunito SemiBold`, bukan `Nunito`), karena Android
juga membaca tabel nama di dalam font — empat berkas yang sama-sama mengaku
bernama "Nunito" bisa membuat sistem memilih salah satunya dan bobot lain
diam-diam tidak pernah terpakai.

> **`fontWeight` sengaja tidak dipakai bersama font ini.** Bobot dipilih dengan
> memilih BERKAS-nya (`fontFamily: 'Nunito-Bold'`). Kalau `fontWeight: '700'`
> ikut disetel di atas font yang memang sudah tebal, Android menebalkannya lagi
> secara sintetis dan hurufnya jadi gepeng dan kotor.

Lisensinya **OFL 1.1** — boleh dipaketkan ke aplikasi, termasuk yang dijual.
Teks lisensinya ikut di `assets/fonts/OFL-*.txt`, sebagaimana yang diminta.

### Audio: yang dipindah bukan aset, melainkan sintesisnya

Versi web **tidak memakai satu pun berkas audio**. Musik latar dan seluruh efek
suaranya disintesis lewat Web Audio — osilator, filter lowpass, buffer derau.
Jadi yang perlu dibawa ke Android bukan aset, melainkan kodenya.

`sfx.ts` dan `music.ts` pindah dari `apps/web` ke `packages/shared`, dan Android
memakainya lewat **`react-native-audio-api`**, yang mengimplementasikan
spesifikasi Web Audio yang sama.

Itu penting karena setiap angka di kedua berkas itu adalah keputusan yang sudah
ditala lewat playtest: tangga nada C mayor pentatonik (diganti dari A minor
karena pemain melaporkan musiknya terdengar menegangkan alih-alih ceria),
progresi I–V–vi–IV, timbre marimba alih-alih gelombang kotak, dan arpeggio yang
membedakan "dapat nyawa" dari "naik level". Menyalinnya berarti dua game yang
lama-lama berbeda bunyinya.

Konteks audio, penjadwal, dan penggetar **disuntik** lewat antarmuka
`KonteksAudio` yang ditulis sendiri — bukan tipe DOM. `packages/shared` juga
dikompilasi untuk Node (game server), dan menyebut tipe DOM di sana akan memaksa
`lib: ["DOM"]` masuk ke tempat yang tidak punya peramban.

> **Konvensi array getar web dan React Native BERLAWANAN, dan itu jebakan yang
> tidak menghasilkan error apa pun.** `navigator.vibrate([50, 40, 90])` berarti
> getar 50, diam 40, getar 90. `Vibration.vibrate([50, 40, 90])` berarti **diam**
> 50, getar 40, diam 90. Pola yang sama diteruskan apa adanya bergeser satu
> langkah: getaran 50 ms yang paling penting hilang, dan yang terasa di tangan
> justru jeda-jedanya. Konversinya ada di `polaGetar.ts`, dipisah dari kode yang
> mengimpor React Native supaya bisa diuji — dan test-nya memeriksa indeks
> genap/ganjil hasilnya, bukan sekadar bentuk arraynya.

### Main bareng: server tidak disentuh sama sekali

Klien Android masuk ke room yang sama dengan pemain web dan merebutkan papan
yang sama. Seluruh aturan rebutan, skor, nyawa, dan bot sudah otoritatif di
`apps/game-server`; yang dilakukan sisi Android hanya menggambar apa yang
dikirim server dan meneruskan ketukan.

Yang dikirim saat menap adalah **ID pixel, bukan koordinat sel**. Papannya
rebutan: pixel di sel itu bisa sudah direbut orang lain sepersekian detik lalu,
dan server yang memutuskan siapa yang lebih dulu.

Kode penyambungnya memang ditulis dua kali — `apps/mobile/src/net/useRoom.ts`
dan `apps/web/src/hooks/useRoom.ts` — dan itu keputusan sadar. Yang TIDAK boleh
menyimpang adalah kontraknya, dan kontrak itu sudah ada di `packages/shared`
sebagai `ClientToServerEvents`/`ServerToClientEvents`: nama event yang salah
atau payload yang kurang satu field gagal typecheck di kedua sisi. Menyatukan
sisa glue-nya butuh paket React bersama, dan itu biaya arsitektur yang belum
sepadan untuk dua layar.

> **`ALAMAT_GAME_SERVER` di `src/net/socket.ts` sengaja kosong dan harus diisi
> sebelum rilis.** Versi web menebak alamat game-server dari halaman yang sedang
> dibuka; aplikasi Android tidak punya "halaman yang sedang dibuka", jadi
> alamatnya wajib dibawa di dalam aplikasi. Diisi tebakan, gejalanya adalah
> tombol yang berputar lalu gagal tanpa alasan yang jelas; dibiarkan kosong,
> aplikasinya mengenali keadaan itu dan menjelaskannya. **Mode solo tidak
> terpengaruh sama sekali** — ia memang tidak butuh server.

## Yang dipakai bersama, dan yang tidak

| Bagian | Nasib |
|---|---|
| `packages/shared` (aturan main, 3.697 baris) | **Dipakai apa adanya** lewat pnpm workspace |
| `apps/game-server` (multiplayer) | **Tidak berubah sama sekali** — server sudah otoritatif |
| Klien web (React + Phaser, 8.294 baris) | Ditulis ulang sebagai komponen Android |
| CSS (3.374 baris) | Ditulis ulang; warnanya disalin persis, dijaga test |

Server yang otoritatif adalah keberuntungan besar di sini: seluruh aturan
rebutan pixel, skor, tim, dan bot sudah diputuskan di server, jadi klien Android
"hanya" perlu menggambar dan mengirim ketukan.

## Menjalankan & membangun

```bash
pnpm install                                  # dari akar monorepo
pnpm --filter @pixelmatrix/mobile test        # test yang tidak butuh HP
pnpm --filter @pixelmatrix/mobile typecheck

# APK debug (butuh Android SDK; lihat local.properties)
pnpm --filter @pixelmatrix/mobile apk:debug
pnpm --filter @pixelmatrix/mobile apk     # APK release
pnpm --filter @pixelmatrix/mobile aab     # AAB — ini yang diunggah ke Play Store
```

`apps/mobile/android/local.properties` menunjuk ke Android SDK dan **tidak
ikut di-commit** — isinya path lokal tiap mesin.

### Mengambil APK tanpa Android SDK

APK adalah hasil build, jadi ia **tidak ada di dalam repo** — `.gitignore`
mengecualikan seluruh `android/app/build/`, dan memang harus begitu: berkas
20-an MB yang berubah tiap build akan menggelembungkan riwayat git selamanya,
dan GitHub sendiri menolak berkas di atas 100 MB.

Yang menggantikannya: workflow **`.github/workflows/android-apk.yml`**.
Jalankan dari tab **Actions → APK Android → Run workflow**, pilih ABI-nya
(`arm64-v8a` untuk hampir semua HP modern), lalu unduh berkasnya dari bagian
**Artifacts** di halaman run itu setelah selesai. Artefaknya kedaluwarsa dalam
14 hari.

Dua hal yang perlu diketahui sebelum mencoba:

- **Yang diunduh adalah .zip, bukan .apk.** GitHub selalu membungkus artefak
  jadi ZIP; APK-nya ada di dalamnya dan harus diekstrak dulu. Di HP itu berarti
  butuh aplikasi pengelola berkas yang bisa membuka ZIP.
- **APK-nya ditandatangani debug keystore** bawaan template, jadi Android akan
  meminta izin "pasang dari sumber tidak dikenal". Cukup untuk mencoba sendiri,
  **tidak bisa** diunggah ke Play Store.

Sekali jalan memakan ~7 menit di runner GitHub, hampir semuanya di langkah
Gradle. Test dan typecheck sengaja ditaruh sebelum langkah itu: kalau token
design sudah menyimpang dari CSS web, lebih baik ketahuan dalam hitungan detik
daripada setelah tujuh menit kompilasi native.

Workflow ini **manual (`workflow_dispatch`), bukan tiap push** — sengaja. Build
Android mengunduh Android SDK dan makan ~7 menit; menjalankannya di tiap push
memperlambat CI biasa (typecheck/lint/test) yang justru perlu cepat, tanpa
memberi apa pun, karena APK hanya dibutuhkan saat memang mau dicoba di HP.

## Jebakan kelima: audio-api vs worklets

Ditemukan setelah audio masuk, dan bentuknya berbeda dari empat yang di bawah —
ini bukan soal pnpm, melainkan soal dua pustaka yang saling menuntut versi yang
tidak bisa dipenuhi bersamaan.

`react-native-audio-api` memanggil `worklets::WorkletRuntime::executeSync`.
Method itu **tidak ada** di `react-native-worklets` 0.12.x. Dan 0.12.x tidak
bisa dihindari: `react-native-reanimated` 4.6 memakukan worklets ke `0.12.x`
tepat, sementara 0.12.1 adalah versi terbaru yang ada. Menurunkan audio-api juga
tidak menolong — 0.11.7 pun sudah memanggilnya.

Yang membuatnya lolos sampai jauh: skrip validasi audio-api hanya memeriksa
**batas bawah** (`>= 0.6.0`). Worklets 0.12.1 lulus, Gradle menyalakan
integrasinya, lalu kompilasi native menabrak method yang tidak ada — **setelah
enam menit build**, bukan saat `pnpm install`.

Diperbaiki lewat `pnpm patch` yang menambahkan batas atas ke skrip itu. Gradle
lalu menyetel `RN_AUDIO_API_ENABLE_WORKLETS=false`, dan audio-api memakai
implementasi worklets tiruan miliknya sendiri — yang memang sudah disiapkan
untuk keadaan ini.

Yang hilang hanya **worklet node**: menjalankan pemrosesan audio di runtime
worklet, yang tidak dipakai game ini sama sekali. `AudioContext`, osilator,
gain, filter lowpass, dan buffer derau tetap jalan penuh — dan itu seluruh Web
Audio yang dipakai `packages/shared/src/audio`.

Patch-nya tercatat di `pnpm-workspace.yaml` dan bisa dibuang begitu audio-api
memperbaiki pemanggilannya.

## Empat jebakan pnpm + React Native

Keempatnya sudah kena dan sudah diperbaiki. Ditulis di sini karena akan kembali
setiap kali versi RN naik.

Polanya sama di keempatnya, dan itu yang paling berguna diingat: **React Native
mengasumsikan `node_modules` yang datar ala npm.** pnpm tidak datar, jadi setiap
tempat yang menuliskan lokasi paket sebagai PATH akan meleset. Perbaikannya
selalu ke arah yang sama — biarkan Node yang menjawab di mana paketnya, atau
jadikan paketnya dependensi langsung supaya benar-benar ada di
`apps/mobile/node_modules`.

1. **Metro tidak melihat `packages/shared`.** Metro hanya mengawasi folder
   aplikasinya. Diperbaiki di `metro.config.js`: `watchFolders` memuat akar
   monorepo, `nodeModulesPaths` memuat node_modules akar, dan
   `unstable_enableSymlinks` menyala — tanpa yang terakhir Metro menolak
   mengikuti symlink pnpm.
2. **Gradle tidak menemukan paket RN-nya sendiri.** `settings.gradle` mencari
   `../node_modules/@react-native/gradle-plugin` dengan path relatif, sementara
   pnpm tidak meng-hoist dependensi transitif. Diperbaiki dengan menjadikan
   `@react-native/gradle-plugin` dan `@react-native/codegen` **dependensi
   langsung** `apps/mobile` — bukan dengan mengubah `node-linker` seluruh
   monorepo, yang akan ikut mengubah cara web dan server dipasang.
3. **Plugin worklets harus TERAKHIR di `babel.config.js`.** Ia menulis ulang
   fungsi yang berjalan di thread UI; plugin lain sesudahnya membuatnya bekerja
   pada kode yang sudah berubah bentuk, dan gagalnya muncul saat runtime, bukan
   saat build.
4. **Hermes tidak ditemukan saat build RELEASE.** Sejak RN 0.87 kompiler
   `hermesc` pindah ke paket npm terpisah (`hermes-compiler`), sementara nilai
   baku plugin Gradle masih menunjuk `node_modules/react-native/sdks/hermesc/`.
   Dengan npm yang datar paket barunya kebetulan ter-hoist ke tempat yang bisa
   ditemukan, jadi bug ini tidak pernah muncul di setup biasa. Diperbaiki di
   `app/build.gradle` dengan `require.resolve` lewat Node, BUKAN dengan
   menuliskan path — path ke store pnpm memuat hash versi dan akan rusak setiap
   kali versinya naik.

   Yang sengaja TIDAK dilakukan: menyetel `hermesEnabled=false` supaya build-nya
   lewat. Itu membuat layar hijau dengan harga mesin JS yang lebih lambat dan
   APK yang lebih besar — menukar sifat produk demi centang.

## Ukuran build — angka yang sebenarnya

Diukur dari build sungguhan, bukan diperkirakan. Semuanya MiB (seperti yang
ditampilkan pengelola berkas), diukur ulang **setelah Skia dikeluarkan**:

| Berkas | Ukuran | Untuk apa |
|---|---|---|
| `app-release.aab` | **60,6 MiB** | **Ini yang diunggah ke Play Store.** Memuat keempat ABI |
| `app-release.apk` (arm64) | **26,7 MiB** | Yang dipakai mencoba di HP |
| `app-release.apk` (4 ABI) | 61,8 MiB | _Belum diukur ulang sejak audio & main bareng masuk_ |
| `app-debug.apk` | 287 MiB | _Belum diukur ulang._ Pengembangan saja — empat ABI + simbol debug |

**Yang benar-benar diunduh pemain jauh lebih kecil**, karena satu HP hanya butuh
satu ABI. Diukur dari APK yang dibangun per-ABI
(`-PreactNativeArchitectures=…`, persis yang dilakukan workflow CI):

| Perangkat | APK per-ABI |
|---|---|
| arm64-v8a (hampir semua HP modern) | **26,7 MiB** |
| armeabi-v7a (HP lama) | ~21 MiB _(diperkirakan; belum diukur ulang)_ |

Unduhan lewat Play sedikit lebih kecil lagi — Play memotong AAB bukan cuma per
ABI tapi juga per kerapatan layar dan per bahasa, yang tidak dilakukan APK di
atas. Jadi angka ini batas atas, bukan perkiraan optimistis.

Pustaka native terbesar di APK arm64, semuanya diukur dari berkas jadi:

| Pustaka | arm64 | Untuk apa |
|---|---|---|
| `libreactnative.so` | 6,58 MiB | React Native itu sendiri |
| `libreact-native-audio-api.so` | 2,52 MiB | Mesin Web Audio |
| `libhermesvm.so` | 2,36 MiB | Mesin JavaScript |
| `libreanimated.so` | 1,53 MiB | Animasi |
| `libc++_shared.so` | 1,23 MiB | Runtime C++ |
| `libsqliteJni.so` | 1,05 MiB | Penyimpanan rekor offline |

> **FFmpeg dimatikan lewat `disableAudioapiFFmpeg=true`.** Ia ikut terpaket
> secara baku dan menambah **5,7 MiB** (`libavformat.so` 5,12 + `libavcodec.so`
> 0,59) untuk MEMUTAR dan MENDEKODE berkas audio — kemampuan yang game ini tidak
> pakai sama sekali, karena seluruh bunyinya disintesis.
>
> Kasus yang sama persis dengan Skia: megabyte yang diunduh tiap pemain untuk
> sesuatu yang tidak pernah dipanggil. Ditemukan dengan cara yang sama juga —
> **membongkar isi APK-nya**, bukan menebak dari ukurannya.

> **Tuas terbesar sudah ditarik: Skia dikeluarkan, dan itu memangkas separuh.**
> AAB turun dari 86,1 → 43,9 MiB dan APK arm64 dari 35,1 → 21,2 MiB. Yang
> tersisa di daftar atas semuanya adalah React Native itu sendiri — tidak ada
> yang bisa dibuang tanpa mengganti fondasinya. Artinya penghematan berikutnya
> harus datang dari R8 (di bawah), bukan dari mengurangi dependensi.

Dua hal yang sengaja BELUM disetel, dan keduanya akan mengubah angka di atas:

Dua hal yang sengaja BELUM disetel, dan keduanya akan mengubah angka di atas:

- `enableProguardInReleaseBuilds = false` — R8/minifikasi mati. Menyalakannya
  memangkas `classes.dex`, tapi juga bisa membuang kelas yang dipakai lewat
  refleksi, jadi ia butuh pengujian di HP sungguhan lebih dulu.
- Build release masih ditandatangani **debug keystore** bawaan template. Cukup
  untuk memasang dan menguji sendiri, **tidak bisa** dipakai rilis Play Store.

## Izin yang diminta aplikasi

Diperiksa dari APK release yang sudah jadi, bukan dari niat:

| Izin | Untuk apa | Jenis |
|---|---|---|
| `INTERNET` | Multiplayer nanti. **Mode solo tidak memakainya sama sekali** | normal |
| `VIBRATE` | Getar saat klik salah dan kena bom | normal |
| `…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Dibuat sendiri oleh AndroidX, bukan diminta aplikasi ini | tanda tangan |

Cuma itu. Ketiganya "normal" atau internal: Android memberikannya saat
pemasangan tanpa satu pun dialog, dan tidak satu pun bisa dipakai membaca data
pemain. Tapi keduanya yang pertama **tetap muncul di daftar izin di halaman
Play Store**, jadi keduanya disebut apa adanya di sini dan di manifest — bukan
diselipkan diam-diam.

`SYSTEM_ALERT_WINDOW` yang muncul di build DEBUG berasal dari layar merah error
React Native dan **tidak ikut ke build rilis** — itu perlu diperiksa, bukan
diasumsikan, karena Google Play memeriksa izin "gambar di atas aplikasi lain"
dengan ketat.

## Ikon peluncur

Dibuat `apps/mobile/scripts/buat-ikon.py` dari **ikon PWA web yang sama**
(`apps/web/public/icon-maskable-512.png`), bukan gambar baru yang kebetulan
mirip. Jalankan ulang skripnya kalau ikon web berubah.

Ikon **adaptif** (Android 8+) dipakai, bukan cuma PNG persegi: latar satu warna
plus lapisan isi yang digeser peluncur saat animasi. Latarnya sengaja warna
polos — gambar sebagai latar akan memperlihatkan tepinya begitu digeser. Isinya
ditaruh di dalam 72 dp tengah dari kanvas 108 dp, karena sisanya bisa terpotong
bentuk apa pun yang dipakai peluncur.

PNG lama untuk Android 7 tetap dibuat: `minSdk` proyek ini 24, jadi masih ada
perangkat yang tidak mengenal ikon adaptif.

> Ikon yang sebelumnya terpasang adalah **logo React Native bawaan template**.
> Selain terbaca sebagai aplikasi yang belum jadi, memakai logo pihak lain di
> aplikasi yang diterbitkan bukan hal yang layak dibiarkan sampai rilis.

## Penandatanganan rilis

**Kunci rilis tidak pernah masuk repo ini, dan tidak boleh.** Repo ini publik;
siapa pun yang memegang keystore-nya bisa menerbitkan pembaruan palsu atas nama
aplikasi ini. Google Play tidak mengizinkan penggantian kunci penandatanganan
aplikasi yang sudah rilis — **satu kali bocor berarti aplikasinya tidak bisa
diperbarui lagi selamanya.**

Karena itu `app/build.gradle` membaca kuncinya dari
`android/keystore.properties`, yang di-gitignore bersama `*.jks` dan
`*.keystore`. Berkas itu dibuat di mesin pemilik. Langkahnya ada di
[PLAY-STORE.md](./PLAY-STORE.md).

Kalau berkasnya tidak ada — di CI, atau di mesin yang baru meng-clone — build
rilisnya **tetap jalan** memakai kunci debug, supaya APK untuk dicoba sendiri
tetap bisa dibuat. Gradle meneriakkan peringatan saat itu terjadi, karena
menandatangani rilis dengan kunci debug tidak menggagalkan build: ia
menghasilkan berkas yang tampak benar dan baru ditolak berjam-jam kemudian di
Play Console.

## Versi

`pmVersionCode` dan `pmVersionName` ada di `android/gradle.properties`, bukan
tertanam di `build.gradle`, supaya menaikkan versi cukup mengubah satu berkas
dan diff-nya jelas terlihat saat direview.

`pmVersionCode` **wajib naik tiap unggahan**. Play menolak angka yang sama atau
lebih kecil dari yang pernah diunggah, selamanya — termasuk kalau rilis lamanya
sudah dihapus.

## Apa yang dijaga test, dan apa yang tidak

`src/theme.test.ts` membaca `apps/web/src/app/globals.css` **langsung** lalu
membandingkannya dengan token di `src/theme.ts`. Itu yang membuat janji
"design-nya sama" berarti sesuatu lebih dari satu hari: warna di web sudah tiga
kali disetel ulang karena audit kontras, dan tanpa test ini versi Android akan
tertinggal tanpa satu pun tanda.

Test kedua menjaga **font-nya**: ia membaca array `weight: [...]` milik
`Fredoka()` dan `Nunito()` dari `layout.tsx` web, lalu memastikan tiap bobot
punya berkas `.ttf`-nya di `assets/fonts`. Menambah bobot di web cuma butuh
mengetik satu angka; di Android ia butuh berkas baru — dan tanpa test ini,
teks yang memakai bobot yang tidak ada akan diam-diam jatuh ke bobot lain,
dengan gejala "kok hurufnya agak beda", bukan sebuah error.

Test yang sama juga menjaga bahwa **palet papan tidak pernah disalin** ke
`theme.ts`. Enam warna papan adalah bagian dari aturan main — server memakainya
untuk memutuskan pixel mana yang benar — jadi ia harus datang dari
`@pixelmatrix/shared`.

Test ketiga — dan yang paling berguna — memainkan **satu ronde solo sungguhan,
frame demi frame**, lewat `MesinSolo`. Mesin itu sengaja tidak tahu apa-apa soal
React atau cara menggambar, dan justru pemisahan itu yang membuat seluruh alur
permainan bisa dibuktikan tanpa perangkat: menap warna target menambah skor dan
combo, menap warna salah mengurangi nyawa dan memutus combo, menap sel kosong
tidak dihukum sama sekali, nyawa habis mengakhiri ronde, jeda membekukan waktu,
bom di Lv 8 mengurangi nyawa, dan seed yang sama menghasilkan papan yang sama.

**Yang TIDAK diuji di sini: apa pun yang butuh perangkat.** Tata letak,
sentuhan, dan animasi tidak dipalsukan dengan renderer tiruan. Test yang
berpura-pura menguji tampilan lebih berbahaya daripada tidak ada test, karena ia
memberi rasa aman yang tidak berdasar.

> **Konsekuensinya harus disebut jujur.** Berbeda dengan versi web — yang tiap
> patch-nya dibuktikan lewat match sungguhan di browser sungguhan — bagian
> tampilan aplikasi Android hanya bisa diverifikasi di HP. Yang bisa dijamin
> dari sisi ini: kodenya lulus typecheck, token design-nya cocok, berkas
> font-nya ada dan benar-benar TrueType, dan Gradle menghasilkan APK yang
> memuatnya.
>
> Yang TIDAK bisa dijamin dari sini, dan karena itu tidak diklaim: bahwa
> hasilnya benar-benar terlihat sama. Angka yang sama tidak otomatis berarti
> tata letak yang sama — `clamp()`, pembungkusan baris, dan tinggi baris
> ditangani mesin yang berbeda. Perbandingan sungguhannya adalah menyandingkan
> screenshot web dan screenshot HP, dan itu butuh HP.

## Sisa jalan menuju Play Store

- [x] Proyek Android + integrasi monorepo, `pnpm install` bersih
- [x] Token design terkunci ke CSS web lewat test
- [x] Font Fredoka & Nunito dipaketkan (8 bobot, 304 KB) + lisensi OFL ikut serta
- [x] Halaman awal sepadan dengan web: logo bergaris tepi, tagline, kartu "Cara
      main", menu berwarna, dan empat noda gradien di latar
- [x] APK debug, APK release, dan AAB terbukti benar-benar jadi
- [x] Workflow CI yang membangun APK per-ABI tanpa perlu Android SDK lokal
- [x] **Papan permainan + mode solo, jalan sepenuhnya offline** — digambar
      dengan `View` biasa, disetir `MesinSolo` yang diuji 22 test
- [x] Rekor solo tersimpan di HP, jeda otomatis saat aplikasi ditinggalkan, getar
- [x] Ikon adaptif dari ikon PWA web (logo React Native bawaan template dibuang)
- [x] Penandatanganan rilis membaca kunci dari luar repo + peringatan Gradle
- [x] `versionCode`/`versionName` pindah ke `gradle.properties`
- [x] **Audio**: musik latar + efek suara, disintesis dari kode yang SAMA dengan web
- [x] **Main bareng** lewat Socket.IO ke `apps/game-server` — masuk room, lobby,
      papan rebutan, papan skor live, hasil
- [x] Splash screen
- [x] Workflow CI yang membangun AAB
- [x] **Efek papan** sepadan dengan web: semburan saat klaim (berwarna sesuai
      pixel yang diambil), angka poin melayang, guncangan saat salah klik,
      kilatan bom, gelombang pelangi diagonal saat naik level, popup combo,
      kedip saat target berganti, dan pixel yang melompat masuk. Dipicu lewat
      ref imperatif karena ini KEJADIAN, bukan keadaan
- [x] Setelan **"Hapus animasi"** Android dihormati — yang dimatikan hanya
      gerak (guncangan, gelombang, lompatan pixel); kilatan dan teks tetap
      jalan supaya umpan baliknya tidak ikut hilang
- [ ] Alamat game-server diisi (`ALAMAT_GAME_SERVER`) — tanpa ini main bareng
      menampilkan penjelasan, bukan mencoba menyambung ke alamat kosong
- [ ] Chat lobby, mode beregu, ubah pengaturan room, reconnect mid-match —
      keempatnya sudah jalan di web dan sudah didukung server
- [ ] Layar Papan Skor & Pengaturan
- [x] Kebijakan privasi terbit di `/privacy` (id + en)
- [ ] Keystore penandatanganan — **dibuat di mesin pemilik, tidak pernah masuk
      repo publik ini**
- [ ] Play Console: listing, Data safety, content rating, 12 penguji × 14 hari

Langkah demi langkahnya, termasuk yang hanya bisa dikerjakan pemilik sendiri,
ada di [PLAY-STORE.md](./PLAY-STORE.md).

### Nama paket

`com.pixelmatrix.game`, di `apps/mobile/android/app/build.gradle`.

**Permanen setelah rilis pertama** — Google Play tidak mengizinkan
penggantiannya. Ganti sekarang kalau ada nama domain yang lebih tepat.
