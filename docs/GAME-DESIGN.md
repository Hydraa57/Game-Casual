# Game Design Document — Pixel Pulse

> Dokumen ini mengelaborasi FR-07 (Core Gameplay) dari [PRD.md](./PRD.md) menjadi spesifikasi yang bisa langsung diimplementasikan. Semua angka di sini adalah **hipotesis awal untuk balancing** — divalidasi lewat playtest di Fase 4, bukan angka final.

## 1. Konsep Inti

Pixel Pulse adalah game refleks arcade dengan sentuhan brain-training: pemain harus mencocokkan **warna target** dengan pixel yang menyala di papan, secepat dan seakurat mungkin. Tantangan mentalnya datang dari pergantian warna target yang memaksa otak "switch context" berulang kali — sederhana dipelajari, sulit dikuasai.

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
| Gaya | Retro pixel art: kotak berwarna + border 1px, font "Press Start 2P" |
| HUD | Warna target (besar, tengah atas), skor, combo meter, nyawa (solo) / leaderboard live (MP), timer |

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
| Pixel expire tanpa diklik | Tidak ada penalti poin, tapi **memutus combo** |

Rasional: speed bonus menghargai refleks, combo menghargai konsistensi, dan penalti klik salah membuat spam-click merugikan (juga bagian dari mitigasi cheat di MP).

## 4. Solo Mode (Endless)

- **3 nyawa**. Klik salah = −1 nyawa. Nyawa habis = game over (sesuai FR-03).
- Pixel yang expire **tidak** mengurangi nyawa (hanya memutus combo) — game over selalu terasa "salahku sendiri".
- **Pause/resume** kapan saja; seluruh state (papan, timer, skor) dibekukan dan dilanjutkan persis (FR-04).
- High score: MVP disimpan di `localStorage`; setelah fase akun, tersinkron ke server via `POST /api/v1/solo-scores`.

### Kurva kesulitan

Level naik setiap **15 klik benar**:

| Parameter | Awal (Lv 1) | Per level | Batas |
|---|---|---|---|
| Interval spawn | 1.2 dtk | −8% | min 0.4 dtk |
| Lifetime pixel | 3.0 dtk | −5% | min 1.2 dtk |
| Warna aktif | 3 | +1 di Lv 3, Lv 5, Lv 7 | maks 6 |

Semakin banyak warna aktif = semakin banyak distraktor = beban kognitif naik, bukan cuma kecepatan.

## 5. Multiplayer — Papan Rebutan (2–4 pemain)

### Prinsip

Semua pemain melihat **papan yang sama** dan berebut pixel yang sama. **Server otoritatif**: server yang men-spawn pixel, dan server yang memutuskan siapa pemenang klik berdasarkan urutan kedatangan (first-arrival). Client hanya merender dan mengirim intent klik.

### Aturan khusus MP

- Klik benar pertama yang sampai di server mengklaim pixel; pemain lain yang telat mendapat feedback `clickRejected` (pixel tetap hilang dari papan).
- Klik salah: **−5 poin** + **cooldown input lokal 500 ms** (layar berkedip merah singkat). Tidak ada sistem nyawa di MP.
- Server melakukan **rate limit ~8 klik/detik/pemain** — klik berlebih diabaikan (mitigasi spam & cheat, sesuai analisis risiko PRD).
- Combo dan speed bonus berlaku sama seperti solo.

### Pengaturan room (dipilih host)

| Setting | Pilihan | Default |
|---|---|---|
| Max players | 2 / 3 / 4 | 4 |
| Target skor | 100 / 150 / 200 | 150 |
| Batas waktu | 60 / 90 / 120 / 180 dtk | 120 dtk |

**Kondisi menang**: pemain pertama yang mencapai target skor, ATAU skor tertinggi saat waktu habis (FR-08). **Seri → sudden death**: papan dikosongkan, satu pixel warna target muncul — siapa cepat dia menang.

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

## 6. Game Feel / Juice (Fase 4)

- Partikel burst + SFX "ding" chiptune saat klik benar; nada naik seiring combo.
- Screen shake kecil + flash merah saat klik salah.
- Popup teks combo ("×1.5!", "×2!") dan popup poin melayang di posisi klik.
- SFX via jsfxr / asset chiptune gratis; BGM opsional dengan toggle mute.

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
