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

Papan digambar dengan **Skia** (`@shopify/react-native-skia`), yang menggambar
langsung ke GPU seperti Phaser di web.

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
cd apps/mobile/android && ./gradlew assembleDebug
```

`apps/mobile/android/local.properties` menunjuk ke Android SDK dan **tidak
ikut di-commit** — isinya path lokal tiap mesin.

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

## Apa yang dijaga test, dan apa yang tidak

`src/theme.test.ts` membaca `apps/web/src/app/globals.css` **langsung** lalu
membandingkannya dengan token di `src/theme.ts`. Itu yang membuat janji
"design-nya sama" berarti sesuatu lebih dari satu hari: warna di web sudah tiga
kali disetel ulang karena audit kontras, dan tanpa test ini versi Android akan
tertinggal tanpa satu pun tanda.

Test yang sama juga menjaga bahwa **palet papan tidak pernah disalin** ke
`theme.ts`. Enam warna papan adalah bagian dari aturan main — server memakainya
untuk memutuskan pixel mana yang benar — jadi ia harus datang dari
`@pixelmatrix/shared`.

**Yang TIDAK diuji di sini: apa pun yang butuh perangkat.** Tata letak,
sentuhan, dan animasi tidak dipalsukan dengan renderer tiruan. Test yang
berpura-pura menguji tampilan lebih berbahaya daripada tidak ada test, karena ia
memberi rasa aman yang tidak berdasar.

> **Konsekuensinya harus disebut jujur.** Berbeda dengan versi web — yang tiap
> patch-nya dibuktikan lewat match sungguhan di browser sungguhan — bagian
> tampilan aplikasi Android hanya bisa diverifikasi di HP. Yang bisa dijamin
> dari sisi ini: kodenya lulus typecheck, token design-nya cocok, dan Gradle
> benar-benar menghasilkan APK.

## Sisa jalan menuju Play Store

- [x] Proyek Android + integrasi monorepo, `pnpm install` bersih
- [x] Token design terkunci ke CSS web lewat test
- [x] Halaman awal (logo beranimasi, menu, palet papan dari shared)
- [ ] Papan permainan dengan Skia + mode solo (offline)
- [ ] Multiplayer lewat Socket.IO ke `apps/game-server`
- [ ] Audio: musik latar + efek suara
- [ ] Font Fredoka & Nunito dipaketkan — **sampai ini selesai, tampilannya
      belum boleh disebut sama persis dengan web**
- [ ] Ikon adaptif + splash screen
- [ ] Keystore penandatanganan — **dibuat di mesin pemilik, tidak pernah masuk
      repo publik ini**
- [ ] Play Console: listing, privacy policy, content rating, 12 tester × 14 hari

### Nama paket

`com.pixelmatrix.game`, di `apps/mobile/android/app/build.gradle`.

**Permanen setelah rilis pertama** — Google Play tidak mengizinkan
penggantiannya. Ganti sekarang kalau ada nama domain yang lebih tepat.
