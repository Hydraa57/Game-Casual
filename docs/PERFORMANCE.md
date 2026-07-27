# Pengukuran Performa

> Catatan hasil ukur, bukan target. Gunanya supaya perubahan berikutnya bisa dibandingkan dengan angka nyata, bukan dengan perasaan. Target aslinya ada di [PRD.md](./PRD.md): **load pertama < 3 detik** dan **respons aksi < 150 ms**.

## Cara mengukurnya

Skrip Playwright terhadap **build produksi** (`next build` + `next start`), bukan dev server — dev menyajikan modul tanpa minifikasi dan angkanya tidak ada artinya.

| Kondisi | Nilai |
|---|---|
| Jaringan | 4G sedang: 4 Mbps turun, 1 Mbps naik, RTT 120 ms |
| CPU | Throttle 4× (meniru HP kelas menengah, bukan laptop) |
| Viewport | 390×844, mode mobile + touch |
| Ukuran transfer | `encodedDataLength` dari CDP — byte nyata di kabel, sudah terkompresi |

Profil ini sengaja pesimistis. HP kelas atas di WiFi akan jauh lebih cepat.

## Hasil (Juli 2026)

| Jalur | Transfer | Waktu | < 3 dtk? |
|---|---|---|---|
| Landing (`/id`) | 171 KB | load 918 ms | ✅ |
| Lobby multiplayer (`/play/room`) | 192 KB | load 1015 ms | ✅ |
| Landing → tap "Main Solo" | 508 KB total | **papan siap 1332 ms** | ✅ |
| Langsung ke `/play/solo` (link dalam) | 508 KB | **papan siap 3482 ms** | ❌ |
| Lobby → tekan "Mulai" → canvas siap | — | **821 ms** (countdown 3000 ms) | ✅ |

### Yang perlu diketahui dari tabel itu

**Satu jalur meleset dari target: membuka `/play/solo` langsung**, misalnya dari bookmark atau link dalam. Rata-rata 3482 ms, di atas ambang 3 detik. Penyebabnya berantai dan serial: HTML → JS route (~164 KB) → hidrasi → baru Phaser (~330 KB) diunduh → papan dibuat. Phaser tidak bisa diimpor di level modul karena ia menyentuh `window` saat di-import, sehingga akan merusak render di server.

Jalur ini **bukan** jalur yang biasa ditempuh pemain: link yang dibagikan mengarah ke landing atau ke `/play/room?code=`. Tapi angkanya tetap dicatat apa adanya, bukan disembunyikan.

**Code splitting bekerja.** Landing 171 KB vs halaman solo 508 KB — Phaser hanya ikut di halaman yang benar-benar memakainya. Lobby multiplayer juga 192 KB, artinya Phaser tidak dimuat sampai match dimulai.

**Prefetch saat idle memangkas separuh waktu.** Sebelum `PrefetchGame` ada, jalur landing → solo butuh 2567 ms; sesudahnya 1332 ms. Modulnya dihangatkan saat pemain membaca cara main — waktu tunggu yang memang sudah ada, bukan waktu tambahan.

**Di multiplayer, ini yang paling penting.** Tanpa prefetch di lobby, ~330 KB Phaser baru mulai diunduh saat countdown 3-2-1 sudah berjalan, dan di 4G itu berarti pemain kehilangan detik-detik pertama match. Dengan prefetch, canvas siap 821 ms setelah tombol "Mulai" — selesai jauh sebelum countdown habis.

Prefetch dilewati kalau browser melaporkan Data Saver aktif atau koneksi 2G: di sana mengunduh 330 KB yang belum tentu dipakai justru merugikan.

## Respons aksi (< 150 ms)

**Solo mode memenuhi target secara struktural, bukan kebetulan.** Engine-nya berjalan di client, jadi tap → skor berubah terjadi dalam frame yang sama tanpa menyentuh jaringan sama sekali.

**Multiplayer beda dan angkanya perlu dibaca hati-hati.** Klaim pixel diputus server, jadi konfirmasi skor tidak mungkin lebih cepat dari satu perjalanan bolak-balik ditambah jeda siaran skor (`MP_TICK_BROADCAST_MS`, 250 ms). Yang dijaga di bawah 150 ms adalah **umpan balik lokal** — pixel langsung hilang dari papan, partikel dan suara main saat itu juga — bukan angka di leaderboard.

Ini keputusan desain, bukan kekurangan: menampilkan poin secara optimistis lalu menariknya kembali saat server bilang pemain lain lebih cepat akan terasa jauh lebih buruk daripada menunggu 250 ms.

## Yang belum diukur

- **HP nyata.** Semua angka di atas hasil emulasi. Android Chrome dan iOS Safari sungguhan bisa berbeda, terutama soal jitter dan perilaku audio.
- **Latensi ke server produksi.** Diukur dengan RTT buatan 120 ms; angka sebenarnya ke Render Singapura dari jaringan seluler Indonesia belum pernah diambil.
- **Beban banyak room sekaligus.** Satu match dua pemain saja yang diuji; load test ada di Fase 5.

## Menjalankan ulang

Skripnya ada di scratchpad sesi, tidak di repo — sengaja, karena ia bergantung pada Playwright dan port lokal. Untuk mengulang: `pnpm build`, jalankan `next start`, lalu ukur dengan CDP (`Network.emulateNetworkConditions` + `Emulation.setCPUThrottlingRate`) sambil menunggu selector `.board canvas`.
