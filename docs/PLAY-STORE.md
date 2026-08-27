# Rilis ke Google Play Store

Apa yang sudah dipenuhi, apa yang **hanya bisa dikerjakan pemilik sendiri**, dan
urutannya. Sisi teknis aplikasinya ada di [ANDROID-NATIVE.md](./ANDROID-NATIVE.md).

## Pembagian yang tidak bisa ditawar

Sebagian syarat rilis ada di dalam kode dan bisa diselesaikan di repo ini.
Sebagian lagi **tidak boleh** — bukan karena sulit, tapi karena mengerjakannya
di sini justru merusak keamanannya.

| Bisa di repo | Harus pemilik sendiri |
|---|---|
| `targetSdk`, izin, ikon, versi | Membuat & menyimpan keystore |
| Konfigurasi penandatanganan yang membaca kunci dari luar | Akun Play Console (biaya sekali $25) |
| Halaman kebijakan privasi | Mengisi formulir Data safety & content rating |
| Dokumen ini | Menjalankan tes tertutup 12 penguji × 14 hari |

**Keystore tidak pernah masuk repo ini, dan itu bukan kehati-hatian berlebihan.**
Repo ini publik. Siapa pun yang memegang kuncinya bisa menerbitkan pembaruan
palsu atas nama aplikasi ini, dan Google Play **tidak mengizinkan penggantian
kunci penandatanganan aplikasi yang sudah rilis** — satu kali bocor berarti
aplikasinya tidak bisa diperbarui lagi selamanya. Tidak ada pemulihan.

## Yang sudah beres

- [x] **`targetSdk` 36.** Sejak **31 Agustus 2026** aplikasi baru dan pembaruan
      wajib menargetkan Android 16 (API 36); yang lama minimal API 35 supaya
      tetap terlihat di perangkat baru.
- [x] **`minSdk` 24** (Android 7). Menjangkau hampir semua HP yang masih dipakai.
- [x] **Izin seminimal mungkin**: `INTERNET` dan `VIBRATE`, keduanya "normal".
      Tidak ada lokasi, kontak, penyimpanan, atau ID iklan.
      `SYSTEM_ALERT_WINDOW` sudah dipastikan **tidak ikut** ke build rilis.
- [x] **Ikon adaptif** dari ikon PWA web, bukan logo bawaan template.
- [x] **`versionCode`/`versionName`** di `gradle.properties`, satu tempat.
- [x] **Penandatanganan** membaca kunci dari `android/keystore.properties` yang
      di-gitignore; Gradle memperingatkan keras kalau build rilis jatuh ke kunci
      debug.
- [x] **Kebijakan privasi** di `/privacy` (id + en), ditulis dari skema database
      dan manifest yang sebenarnya.
- [x] **AAB bisa dibuat** (`pnpm --filter @pixelmatrix/mobile aab`).

## Langkah 1 — Buat keystore (di mesinmu, sekali seumur aplikasi)

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore pixelmatrix-rilis.jks \
  -alias pixelmatrix \
  -keyalg RSA -keysize 4096 \
  -validity 10000
```

`-validity 10000` (±27 tahun) bukan angka asal: Play menolak kunci yang masa
berlakunya habis sebelum **22 Oktober 2033**, dan kunci yang kedaluwarsa tidak
bisa diganti.

Lalu buat `apps/mobile/android/keystore.properties`:

```properties
storeFile=/path/mutlak/ke/pixelmatrix-rilis.jks
storePassword=...
keyAlias=pixelmatrix
keyPassword=...
```

Berkas itu dan seluruh `*.jks` sudah masuk `.gitignore` — sudah diuji
menangkapnya, bukan diasumsikan.

> **Simpan tiga hal ini di tempat yang tidak bisa hilang** (pengelola sandi,
> atau cadangan terenkripsi di luar komputer): berkas `.jks`, kedua sandinya,
> dan nama alias-nya. Kehilangan salah satunya = aplikasi tidak bisa diperbarui
> lagi, selamanya.
>
> Play App Signing (dinyalakan saat rilis pertama) memberi jaring pengaman untuk
> kunci penandatanganan APK, tapi **kunci unggah tetap milikmu** — dan mengganti
> kunci unggah butuh proses banding ke Google yang tidak dijamin berhasil.

Sesudah itu, `pnpm --filter @pixelmatrix/mobile aab` menghasilkan AAB yang
benar-benar bisa diunggah. Peringatan kuning Gradle akan hilang dengan
sendirinya — itu penanda paling cepat bahwa kuncinya terbaca.

## Langkah 2 — Akun Play Console

- Biaya pendaftaran **$25, sekali seumur akun**.
- **Akun pribadi yang dibuat setelah 13 November 2023** wajib melewati tes
  tertutup lebih dulu: **minimal 12 penguji yang ikut selama 14 hari
  BERTURUT-TURUT** saat kamu mengajukan akses produksi. Akun organisasi (badan
  usaha berbadan hukum, butuh nomor DUNS) dikecualikan sepenuhnya.
- Tiga hal yang paling sering membuat hitungannya batal:
  - Penguji yang keluar lalu masuk lagi **mengulang hitungan dari nol** —
    14 harinya harus tanpa putus.
  - Sejak 2026 Google juga memeriksa bahwa penguji **benar-benar memakai**
    aplikasinya. Dua belas orang yang cuma menekan "opt in" tidak cukup.
  - Jumlahnya sempat 20 dan diturunkan jadi 12 pada Desember 2024 — panduan
    lama yang masih menyebut 20 sudah kedaluwarsa.
- Siapkan 12 orangnya **sebelum** mulai. Yang bikin tertunda berminggu-minggu
  biasanya bukan aplikasinya, melainkan mengumpulkan penguji yang benar-benar
  memasang dan membukanya secara berkala.

## Langkah 3 — Isi listing

| Yang diminta | Catatan |
|---|---|
| Nama aplikasi | `Pixel Matrix` (maks 30 karakter) |
| Deskripsi singkat | Maks 80 karakter |
| Deskripsi panjang | Maks 4.000 karakter |
| Ikon | **512×512 PNG** — pakai `apps/web/public/icon-512.png` |
| Feature graphic | **1024×500** — belum ada, harus dibuat |
| Screenshot HP | Minimal 2, disarankan 4–8 |
| URL kebijakan privasi | `https://<domain-mu>/id/privacy` |
| Email kontak | **Belum diisi** — lihat catatan di bawah |

> **Dua hal yang belum ada dan tidak bisa saya buatkan sendiri:**
>
> 1. **Email kontak.** `SUPPORT_EMAIL` di `packages/shared` sengaja dibiarkan
>    kosong. Play mewajibkan alamat kontak di listing, dan kebijakan penghapusan
>    data mengharapkan jalur yang tidak memaksa orang menulis di tempat umum —
>    tapi alamat yang ditulis ke sana akan ikut terbit di repo publik ini
>    selamanya. Itu keputusanmu. Isi konstantanya, dan halaman privasi otomatis
>    menampilkan tautannya.
> 2. **Screenshot & feature graphic.** Keduanya butuh tampilan aplikasi yang
>    sudah jalan di HP sungguhan.

## Langkah 4 — Formulir Data safety

Diisi di Play Console, dan **harus cocok dengan kebijakan privasi** — Google
membandingkan keduanya, dan selisihnya adalah salah satu penyebab penolakan
paling umum.

> **Jawabannya BERUBAH sejak main bareng masuk ke aplikasi Android.** Sebelum
> itu aplikasinya murni offline dan jawaban yang benar adalah "tidak
> mengumpulkan apa pun". Sekarang tidak lagi: begitu pemain masuk room, nickname
> dan skornya dikirim ke game-server. Mengisi formulir dengan jawaban lama
> adalah pernyataan yang tidak benar, bukan sekadar dokumen yang tertinggal.

| Pertanyaan | Jawaban |
|---|---|
| Mengumpulkan data pengguna? | **Ya** — tapi hanya saat pemain memilih main bareng |
| Data apa? | **Personal info → Name** (nickname yang diketik pemain) dan **App activity → Other actions** (skor, akurasi, hasil match) |
| Wajib atau opsional? | **Opsional** — mode solo tidak mengirim apa pun |
| Dipakai untuk apa? | **App functionality** saja. Bukan iklan, bukan analitik, bukan personalisasi |
| Dibagikan ke pihak ketiga? | **Tidak** |
| Dienkripsi saat transit? | **Ya** (HTTPS/WSS) |
| Bisa diminta hapus? | **Ya**, lewat kontak di kebijakan privasi |

Dua hal yang mudah salah diisi dan layak dibaca ulang sebelum mengirim:

- **Nickname dihitung sebagai "Name"**, bukan sebagai data anonim. Ia diketik
  pemain dan bisa saja berisi nama aslinya; Play menilai dari apa yang BISA
  dikirim, bukan dari apa yang biasanya dikirim.
- **Akun (username + password + email) belum ada di aplikasi Android.** Itu
  masih fitur web saja. Begitu ia masuk, formulir ini wajib diperbarui di rilis
  yang sama — bukan sesudahnya.

## Langkah 5 — Content rating

Kuesioner otomatis. Untuk game ini jawabannya "tidak" untuk hampir semuanya —
tidak ada kekerasan, tidak ada konten dewasa, tidak ada judi, tidak ada
pembelian dalam aplikasi.

Satu yang **harus dijawab jujur "ya"**: game ini punya **fitur interaksi
pengguna** — nickname yang terlihat pemain lain di lobby dan di papan skor.
Menyembunyikannya adalah pelanggaran kebijakan yang bisa membuat aplikasi
diturunkan.

Chat lobby belum ada di aplikasi Android (masih web saja), tapi nickname
sendiri sudah cukup untuk membuat jawabannya "ya": ia teks bebas yang dilihat
orang lain.

## Sisa jalan sebelum layak dikirim

Yang berikut ini bukan syarat Play, tapi menerbitkan tanpanya berarti
menerbitkan sesuatu yang belum layak dinilai orang:

- [x] Audio (musik latar + efek suara)
- [x] Main bareng di aplikasi Android
- [x] Splash screen
- [ ] **`ALAMAT_GAME_SERVER` diisi** di `apps/mobile/src/net/socket.ts` — tanpa
      ini tombol main bareng menampilkan penjelasan, bukan lobby. Mode solo
      tidak terpengaruh
- [ ] **Aplikasi diuji di HP sungguhan** — belum pernah; tidak ada emulator di
      lingkungan pengembangan ini
- [ ] Uji di layar kecil (320 dp) dan layar besar (tablet)

> **Yang paling penting dari daftar ini adalah baris "diuji di HP sungguhan".**
> Semua yang lain bisa diperiksa dari sini; yang itu tidak. Google menjalankan
> aplikasinya di perangkat sungguhan saat meninjau, dan aplikasi yang crash di
> sana ditolak — sementara satu-satunya bukti yang ada sekarang adalah bahwa
> kodenya lulus typecheck, testnya hijau, dan Gradle menghasilkan berkas.

## Kalau ditolak

Penolakan pertama itu biasa. Yang paling sering kena untuk aplikasi seperti ini:

| Penyebab | Cara menghindarinya |
|---|---|
| Data safety tidak cocok dengan kebijakan privasi | Perbarui **keduanya** di rilis yang sama |
| URL kebijakan privasi tidak bisa dibuka | Pastikan situsnya hidup sebelum mengajukan |
| Screenshot memperlihatkan fitur yang belum ada | Ambil dari build yang benar-benar dikirim |
| Aplikasi crash di perangkat penguji Google | Uji di HP sungguhan lebih dulu |
