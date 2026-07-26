# Riset Pembanding — Juli 2026

> Dokumen ini dibuat untuk menjawab satu pertanyaan: **sudah ada game yang persis seperti ini belum?** Jawabannya: untuk solo mode, ya — beberapa. Untuk multiplayer papan-rebutan lewat kode room, tidak ditemukan padanannya. Itu yang menentukan prioritas pengembangan.

## Kesimpulan utama

### 1. Solo mode tidak akan membedakan produk ini

**[Tappy Tiles Colors Rush](https://apps.apple.com/gb/app/tappy-tiles-colors-rush/id6746653767)** dideskripsikan harfiah sebagai *"tap the tiles that match the target color before they disappear"* — itu Pixel Matrix solo mode. Sudah rilis, dan fiturnya lebih banyak: grid tumbuh dari 3×3 ke 6×6, combo sampai ×5, power-up Slow Motion & Auto Match.

Konsekuensi praktis: **jangan berharap solo mode jadi daya tarik utama.** Memperdalamnya tetap perlu supaya orang mau kembali dan supaya ada yang dimainkan sendirian, tapi bukan itu yang membuat game ini punya alasan untuk ada.

### 2. Pembedanya ada di multiplayer yang belum dibangun

Game tap kompetitif yang ditemukan semuanya **satu-perangkat-dua-pemain** atau berbasis aplikasi:

| Game | Bentuk kompetisinya |
|---|---|
| [Tap Clash](https://play.google.com/store/apps/details?id=com.flutteroid.taptapwin&hl=en_US) | 2 pemain berbagi satu HP (atas/bawah), rebut teritori, ada power-up **STEAL** |
| [Taptix](https://apps.apple.com/us/app/taptix/id6744813766) | "Shared-arena races", head-to-head online atau lokal |
| [Tap Color Battle](https://en.androidayuda.com/tap-color-battle-el-juego-de-reflejos-para-uno-o-dos-jugadores/) | 2 pemain satu HP |

Platform party berbasis kode room ada banyak — [GameBuddies.io](https://gamebuddies.io/), [PartyRoomGames](https://partyroomgames.com/), [Room For Games](https://roomforgames.com/), [PadlessBox](https://padlessbox.com/) (punya Tic Tac Toe refleks) — tapi isinya kuis, gambar-menggambar, dan social deduction, bukan game refleks papan-bersama.

**Tidak ditemukan: browser + kode room + 2–4 HP terpisah + satu papan bersama yang direbutkan.** Itu kombinasi yang dimiliki rencana ini dan tidak dimiliki yang lain. Karena itu Fase 2 (multiplayer) adalah pekerjaan paling bernilai di roadmap, bukan sekadar fitur tambahan.

## Pembanding terdekat (solo)

| Game | Mekanik | Beda dari Pixel Matrix |
|---|---|---|
| [Tappy Tiles Colors Rush](https://apps.apple.com/gb/app/tappy-tiles-colors-rush/id6746653767) | Tap tile yang cocok warna target sebelum hilang; grid 3×3 → 6×6; combo ×5; power-up | Praktis identik. Grid tumbuh (kita tidak), ada power-up (kita tidak), aplikasi & offline (kita browser & multiplayer) |
| [Quick Color Tap](https://www.crazygamesonline.com/game/quick-color-tap) | Cocokkan kotak warna dengan distraksi latar berkedip | Distraksinya visual/latar, bukan pergantian aturan |
| [TapSquare](https://tap-square.vercel.app/) | Tap kotak sebelum hilang; makin cepat **dan makin kecil** | Tidak ada pencocokan warna; kesulitan lewat presisi |
| [Tap the Right Color](https://taptherightcolor.web.app/) | Refleks pencocokan warna | Lebih sederhana, tanpa kurva level |

## Leluhur genre (yang memvalidasi desain kita)

**[Gridshot / Aim Lab](https://sweatygaming.com/how-to-improve-your-gridshot-score-and-get-100k-in-aim-lab/)** — 3 target selalu hidup di grid; **100 poin × combo multiplier, cap ×2 di streak 20, satu miss reset combo**.

Dua hal yang dikonfirmasi:
1. Arsitektur skor kita (poin dasar × combo, cap ×2, miss reset) **konvensional dan sehat** — bukan karangan.
2. Mereka menjaga jumlah target hidup **konstan**. Itu mendukung perbaikan kurva di Patch 4: jumlah pixel hidup harus konstan atau menurun, tidak boleh naik.

**[Lumosity Color Match](https://www.lumosity.com/en/brain-games/color-match/)** (turunan Stroop test, melatih *response inhibition*) dan **[Brain Shift](https://www.lumosity.com/en/brain-games/brain-shift/)** (*task switching*) — inilah pedigree "brain training" yang diklaim PRD. Klaimnya berdasar: pergantian warna target melatih task switching, dan pixel bom melatih response inhibition.

**[Piano Tiles / Don't Tap The White Tile](https://grokipedia.com/page/Piano_Tiles)** (2014, 50 juta+ unduhan per toko) — tap kotak hitam, **hindari** yang putih. Satu game sebesar itu dibangun persis di atas mekanik menahan diri. Ini pembenaran kuat untuk pixel bom di Patch 6, dan alasan untuk tidak menganggapnya fitur sampingan.

## Kandidat yang dicatat tapi belum diambil

Keduanya di luar empat mekanik yang sudah dipilih, jadi **tidak diimplementasikan** — dicatat di sini supaya tidak hilang:

1. **Papan yang membesar** sebagai tuas kesulitan kelima (Tappy Tiles: 3×3 → 6×6). Aman untuk multiplayer karena pembesarannya identik untuk semua pemain, dan menyerang dimensi yang belum tersentuh: jarak jelajah mata dan jempol, bukan kecepatan. Perlu hati-hati di HP — sel yang mengecil bisa turun di bawah ambang target sentuh 44 px.
2. **Power-up sabotase** ala STEAL di Tap Clash, untuk multiplayer. Cocok dengan keinginan "biar makin kompetitif", tapi menambah asimetri yang harus diadili server — pertimbangkan setelah papan-rebutan dasar terbukti seru.

## Soal nama

"Pixel Pulse" (nama awal) **sudah dipakai**: [game rhythm/bullethell di itch.io](https://fornan-ii.itch.io/pixel-pulse), publisher "Pixel Pulse Studio", repo GitHub, dan channel YouTube. Bukan masalah hukum untuk proyek hobi, tapi buruk untuk ditemukan orang.

Diganti menjadi **Pixel Matrix** (Juli 2026), yang sudah diperiksa bersih dari bentrokan nama game. `pixelmatrix.com` sudah dipakai; `pixelmatrix.app` dan `pixelmatrix.games` tersedia kalau nanti perlu domain.

Kandidat lain yang diperiksa dan ditolak: *Chromatap* (sudah ada [Chroma Tap di Android](https://apkpure.com/chroma-tap/com.sencompany.chromatap.google)), *Warnain* (tidak bentrok persis, tapi ruang "warna/mewarnai" dikuasai [aplikasi mewarnai anak-anak](https://play.google.com/store/apps/details?id=com.casualgamesempire.coloringmastery&hl=en_US) sehingga menyesatkan). Kandidat yang sempat direkomendasikan dan masih bebas: *Rebutan* (`.io`), *Adu Warna*, *Sikat Warna*, *Hueshot* (`.io`).
