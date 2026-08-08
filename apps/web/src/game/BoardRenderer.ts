// Hanya tipe yang dipakai di sini — objek Phaser dibuat lewat `scene` yang
// diberikan pemanggil, jadi modulnya tidak perlu ikut masuk ke bundle.
import type * as Phaser from 'phaser';
import { ALL_COLORS, COLOR_HEX, GRID_SIZE, remainingRatio } from '@pixelmatrix/shared';
import type { Cell, Pixel } from '@pixelmatrix/shared';
import { GRID_LINE, pixelStyle } from './palette';

/**
 * Resolusi internal papan. Phaser men-scale-nya ke ukuran layar (Scale.FIT).
 *
 * TETAP 640 berapa pun jumlah selnya. Papan 10×10 tidak membuat kanvasnya lebih
 * besar di layar — ia hanya membuat tiap selnya lebih kecil (80 px → 64 px di
 * koordinat internal). Jadi tata letak halaman main tidak berubah sama sekali
 * saat match ramai, dan itu memang yang diinginkan: papannya sudah pas memenuhi
 * layar HP.
 */
export const BOARD_SIZE = 640;

/**
 * Ukuran yang dulunya konstanta, sekarang diturunkan dari `cell`.
 *
 * Semua angka di bawah ditulis sebagai PECAHAN dari lebar sel, dengan nilai yang
 * dipilih supaya papan 8×8 (sel 80 px) menghasilkan angka yang sama persis
 * dengan versi sebelumnya: inset 6 px, glyph 40 px, angka poin 26 px. Jadi
 * papan 8×8 dirender identik dengan sebelum patch ini, dan papan 10×10 ikut
 * mengecil secara proporsional alih-alih memakai ukuran yang tiba-tiba
 * kebesaran dan saling tindih.
 */
const INSET_RATIO = 6 / 80;
const GLYPH_RATIO = 40 / 80;
const SCORE_RATIO = 26 / 80;
const CLAIM_MARK_RATIO = 0.62;

const PARTICLE_TEXTURE = 'pm-particle';
const PARTICLE_COUNT = 10;

interface PixelView {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly glyph: Phaser.GameObjects.Text;
}

/**
 * Menggambar papan di dalam sebuah scene Phaser.
 *
 * Dipisah dari scene supaya solo mode (yang menjalankan engine sendiri) dan
 * multiplayer (yang hanya menerima event dari server) memakai tampilan yang
 * benar-benar sama — bukan dua salinan kode gambar yang lama-lama menyimpang.
 */
export class BoardRenderer {
  private readonly views = new Map<string, PixelView>();
  /** Tekstur partikel dibuat sekali per scene, bukan per ledakan. */
  private particleTextureReady = false;
  /** Ditahan supaya kisinya bisa dibuang saat ukuran papan berganti. */
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;

  /**
   * Pemain meminta gerakan dikurangi lewat setelan sistemnya.
   *
   * Dibaca sekali saat renderer dibuat, bukan tiap efek: nilainya praktis tidak
   * pernah berubah di tengah ronde, dan memanggil matchMedia puluhan kali per
   * detik di jalur terpanas permainan itu pemborosan.
   *
   * Ini bukan kosmetik opsional. Guncangan kamera dan kilatan layar bisa
   * memicu mual dan, pada sebagian orang, kejang. Sisi CSS sudah menghormati
   * setelan ini sejak kartu tutorial; canvas-nya belum sama sekali.
   */
  private readonly reducedMotion: boolean;

  /** Lebar satu sel dalam koordinat internal papan. */
  private readonly cell: number;
  private readonly inset: number;

  /**
   * `gridSize` diberikan pemanggil, tidak dibaca dari konstanta.
   *
   * Solo selalu memakai GRID_SIZE; multiplayer memakai angka yang dikirim server
   * lewat `game:started`/`resync`, karena match ramai bermain di papan 10×10.
   * Nilainya tidak pernah berubah selama satu ronde — kalau berubah, seluruh
   * pixel yang sudah digambar akan berada di koordinat yang salah, jadi ia
   * `readonly` dan renderer-nya dibuat ulang bersama scene-nya.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly gridSize: number = GRID_SIZE,
  ) {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.cell = BOARD_SIZE / gridSize;
    this.inset = this.cell * INSET_RATIO;
  }

  /** Titik tengah sel dalam koordinat internal papan. */
  private centerOf(cell: Cell): { readonly x: number; readonly y: number } {
    return {
      x: cell.col * this.cell + this.cell / 2,
      y: cell.row * this.cell + this.cell / 2,
    };
  }

  /** Guncangan kamera yang menghormati setelan gerakan pemain. */
  shake(durationMs: number, intensity: number): void {
    if (this.reducedMotion) return;
    this.scene.cameras.main.shake(durationMs, intensity);
  }

  /**
   * Kilatan layar. Pada mode gerakan-dikurangi tetap ada tapi jauh lebih redup:
   * ini penanda "kamu kehilangan nyawa" dan menghapusnya sepenuhnya berarti
   * menghapus informasi, bukan cuma hiasan.
   */
  flash(durationMs: number, r: number, g: number, b: number): void {
    this.scene.cameras.main.flash(this.reducedMotion ? 90 : durationMs, r, g, b, false);
  }

  drawGrid(): void {
    // Garis lama dibuang dulu. Renderer multiplayer bisa diganti di tengah
    // hidup scene (papan 8×8 berubah jadi 10×10 begitu `game:started` datang),
    // dan tanpa ini kedua kisi tergambar bertumpuk — terlihat seperti papan
    // 8×8 dan 10×10 yang saling menembus.
    this.gridGraphics?.destroy();
    const graphics = this.scene.add.graphics();
    this.gridGraphics = graphics;

    /*
      Digambar sebagai KOTAK ISI, bukan garis — dan tebalnya bukan 1 px.

      Versi sebelumnya memakai `lineBetween` dengan `lineStyle(1, ...)`, dan
      sebagian garisnya benar-benar hilang di layar: papan 640 px internal
      menyusut ke ~370 px (skala 0,58), Phaser berjalan dengan
      `antialias: false` + `pixelArt: true`, dan garis setebal 1 px yang jatuh
      di antara dua piksel perangkat dibulatkan sampai lenyap. Yang muncul
      adalah kisi berlubang-lubang — sebagian garis ada, sebagian tidak, tanpa
      pola yang masuk akal.

      Dua hal yang memperbaikinya:

      1. `fillRect` alih-alih `lineBetween`. Garis ber-`lineStyle` dipusatkan
         PADA koordinatnya, jadi garis 1 px menempati x−0,5 sampai x+0,5 —
         setengah piksel di kedua sisi, persis bentuk yang paling mudah hilang
         saat dibulatkan. Kotak isi menempati piksel yang utuh.
      2. Tebalnya dihitung dari skala TERBURUK yang mungkin. Papan tidak pernah
         lebih kecil dari `--board-min` (223 px), jadi skala terburuknya
         640/223 ≈ 2,87 — dan tebal 3 px internal menjamin sedikitnya 1 px di
         layar di setiap ukuran papan yang bisa terjadi.
    */
    const tebal = 3;
    graphics.fillStyle(GRID_LINE, 1);
    for (let index = 1; index < this.gridSize; index += 1) {
      const offset = Math.round(index * this.cell - tebal / 2);
      graphics.fillRect(offset, 0, tebal, BOARD_SIZE);
      graphics.fillRect(0, offset, BOARD_SIZE, tebal);
    }
  }

  /** Buang semua yang digambar renderer ini, termasuk kisinya. */
  destroy(): void {
    this.clear();
    this.gridGraphics?.destroy();
    this.gridGraphics = null;
  }

  /** Ubah koordinat pointer menjadi sel papan; `null` kalau di luar papan. */
  cellAt(x: number, y: number): Cell | null {
    const col = Math.floor(x / this.cell);
    const row = Math.floor(y / this.cell);
    if (col < 0 || col >= this.gridSize || row < 0 || row >= this.gridSize) return null;
    return { row, col };
  }

  add(pixel: Pixel, hideGlyph: boolean): void {
    const { x: centerX, y: centerY } = this.centerOf(pixel.cell);
    const size = this.cell - this.inset * 2;
    const style = pixelStyle(pixel);

    const rect = this.scene.add.rectangle(centerX, centerY, size, size, style.fill);
    rect.setStrokeStyle(style.strokeWidth, style.stroke, style.strokeAlpha);

    // Glyph = pembeda warna untuk pemain buta warna (GDD §2), dan untuk pixel
    // spesial ia yang membedakan bom dari pixel biasa. Ukurannya sengaja besar:
    // di layar HP papan ini menyusut ke ~45% ukuran internalnya.
    const glyph = this.scene.add.text(centerX, centerY, hideGlyph ? '' : style.glyph, {
      fontFamily: 'monospace',
      fontSize: `${Math.round(this.cell * GLYPH_RATIO)}px`,
      color: style.glyphColor,
    });
    glyph.setOrigin(0.5);

    this.views.set(pixel.id, { rect, glyph });

    // Muncul dengan sedikit "pop" supaya mata langsung tertarik.
    rect.setScale(0.6);
    glyph.setScale(0.6);
    this.scene.tweens.add({
      targets: [rect, glyph],
      scale: 1,
      duration: 110,
      ease: 'Back.easeOut',
    });
  }

  remove(pixelId: string, style: 'fade' | 'pop'): void {
    const view = this.views.get(pixelId);
    if (!view) return;
    this.views.delete(pixelId);

    /**
     * Dua cara pixel hilang, dua kurva yang berbeda — dan bedanya bukan hiasan.
     *
     * `pop` (direbut) memakai easeOut: cepat di awal lalu melambat, terbaca
     * sebagai sesuatu yang MELEDAK keluar karena tindakanmu. `fade` (kedaluwarsa)
     * memakai easeIn: pelan di awal lalu menghilang, terbaca sebagai sesuatu
     * yang LOLOS begitu saja. Sebelumnya keduanya linier dan karena itu terasa
     * sama — padahal yang satu hadiah dan yang satu kehilangan.
     */
    this.scene.tweens.add({
      targets: [view.rect, view.glyph],
      scale: style === 'pop' ? 1.4 : 0.7,
      alpha: 0,
      duration: style === 'pop' ? 130 : 180,
      ease: style === 'pop' ? 'Quad.easeOut' : 'Quad.easeIn',
      onComplete: () => {
        view.rect.destroy();
        view.glyph.destroy();
      },
    });
  }

  floatingScore(cell: Cell, text: string, color = '#fffffe'): void {
    const at = this.centerOf(cell);
    const label = this.scene.add.text(at.x, at.y, text, {
      fontFamily: 'monospace',
      fontSize: `${Math.round(this.cell * SCORE_RATIO)}px`,
      color,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);

    /**
     * Angka poin melesat lalu mengambang, bukan naik dengan kecepatan tetap.
     *
     * Kenaikan linier terbaca sebagai animasi; `Cubic.easeOut` terbaca sebagai
     * REAKSI terhadap ketukan. Bedanya kecil di satu klik dan besar setelah
     * ratusan — ini elemen paling sering muncul di seluruh permainan.
     *
     * Alpha meredup lebih cepat daripada geraknya berhenti, jadi angkanya sudah
     * tidak terbaca sebelum benar-benar berhenti — kalau tidak, angka lama
     * menumpuk di atas pixel berikutnya yang harus diketuk.
     */
    if (this.reducedMotion) {
      this.scene.tweens.add({
        targets: label,
        alpha: 0,
        duration: 420,
        onComplete: () => label.destroy(),
      });
      return;
    }

    label.setScale(0.7);
    this.scene.tweens.add({
      targets: label,
      y: label.y - this.cell * 0.7,
      scale: 1,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      duration: 340,
      delay: 180,
      ease: 'Quad.easeIn',
    });
  }

  /**
   * Semburan partikel di sel yang baru diklaim.
   *
   * Teksturnya dibuat program, bukan file gambar: satu kotak putih 8×8 yang
   * diwarnai lewat tint. Menambah aset unduhan cuma untuk ini akan melawan
   * target load < 3 detik di jaringan seluler (NFR).
   */
  burstAt(pixelId: string, cell: Cell): void {
    // Warna diambil dari view yang sedang tampil, bukan dari event: baik engine
    // solo maupun payload server tidak membawa warna di event klaim, dan
    // menambahkannya di sana berarti melebarkan kontrak cuma demi efek visual.
    const tint = this.views.get(pixelId)?.rect.fillColor ?? 0xffffff;
    this.burst(cell, tint);
  }

  burst(cell: Cell, tint: number): void {
    if (!this.particleTextureReady) {
      const key = PARTICLE_TEXTURE;
      if (!this.scene.textures.exists(key)) {
        const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(0, 0, 8, 8);
        graphics.generateTexture(key, 8, 8);
        graphics.destroy();
      }
      this.particleTextureReady = true;
    }

    const at = this.centerOf(cell);
    const emitter = this.scene.add.particles(at.x, at.y, PARTICLE_TEXTURE, {
      // Sedikit dan pendek: papan ini dilihat di layar HP, dan partikel yang
      // berlebihan justru menutupi pixel berikutnya yang harus diketuk.
      lifespan: 380,
      speed: { min: 70, max: 190 },
      // Papan 640px internal menyusut ke ~360px di layar HP, jadi partikel
      // berukuran "wajar" di koordinat internal jadi bintik tak terbaca.
      scale: { start: 1.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
      quantity: PARTICLE_COUNT,
      emitting: false,
    });
    emitter.explode(PARTICLE_COUNT);
    // Emitter dibuang setelah partikel terakhir mati; kalau tidak, satu ronde
    // panjang meninggalkan ratusan emitter menganggur di scene.
    this.scene.time.delayedCall(400, () => emitter.destroy());
  }

  /**
   * Cap avatar di sel yang baru direbut — inti dari "rasa main bareng".
   *
   * Ditahan sebentar sebelum memudar (bukan langsung naik seperti angka poin)
   * supaya pemain punya waktu membacanya: yang ingin diketahui bukan "ada poin
   * keluar", tapi "SIAPA yang menyerobot pixel itu".
   */
  claimMark(cell: Cell, glyph: string, byMe: boolean): void {
    const at = this.centerOf(cell);
    const mark = this.scene.add.text(at.x, at.y, glyph, {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(this.cell * CLAIM_MARK_RATIO)}px`,
    });
    mark.setOrigin(0.5);
    // Cap sendiri lebih tegas daripada cap lawan: kamu perlu bisa membedakan
    // keduanya dalam sekejap tanpa membaca nama.
    mark.setAlpha(byMe ? 1 : 0.75);
    mark.setScale(byMe ? 0.6 : 0.5);

    this.scene.tweens.add({
      targets: mark,
      scale: byMe ? 1 : 0.85,
      duration: 140,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: mark,
          alpha: 0,
          delay: 260,
          duration: 240,
          onComplete: () => mark.destroy(),
        });
      },
    });
  }

  /**
   * Popup combo di tengah papan, hanya pada kelipatan tertentu.
   *
   * Dibatasi ke milestone (bukan tiap klik benar) dengan sengaja: kalau muncul
   * terus-menerus ia berhenti terasa sebagai pencapaian dan mulai menghalangi
   * pandangan ke papan.
   */
  comboPopup(combo: number): void {
    const label = this.scene.add.text(BOARD_SIZE / 2, BOARD_SIZE / 2, `COMBO ×${combo}`, {
      fontFamily: 'monospace',
      fontSize: '46px',
      color: '#ffb703',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setAlpha(0);
    label.setScale(0.6);

    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1.15,
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          alpha: 0,
          scale: 1.4,
          delay: 220,
          duration: 260,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  /** Pixel meredup seiring umurnya, jadi urgensi terlihat tanpa perlu timer. */
  refreshFade(pixels: readonly Pixel[], elapsedMs: number): void {
    for (const pixel of pixels) {
      const view = this.views.get(pixel.id);
      if (!view) continue;

      const ratio = remainingRatio(pixel, elapsedMs);
      // Bom sengaja tidak pernah memudar sejauh pixel lain. Warnanya gelap dan
      // hampir menyatu dengan latar papan, jadi kalau ia sampai nyaris tembus
      // pandang pemain bisa menyangka selnya kosong lalu menap-nya — hukuman
      // untuk sesuatu yang tidak terlihat.
      const floor = pixel.kind === 'bomb' ? 0.7 : 0.3;
      const alpha = floor + (1 - floor) * ratio;

      view.rect.setAlpha(alpha);
      view.glyph.setAlpha(alpha);
    }
  }

  clear(): void {
    for (const view of this.views.values()) {
      view.rect.destroy();
      view.glyph.destroy();
    }
    this.views.clear();
  }

  /**
   * Perayaan naik level: seluruh papan menyala warna-warni, lalu spanduk
   * "LEVEL N" muncul di tengahnya.
   *
   * Satu keputusan yang menentukan seluruh desainnya: kotak-kotak ini digambar
   * DI BAWAH pixel yang sedang hidup (depth -1). Perayaan yang menutupi papan
   * akan merampas peluang ketuk tepat di momen pemain paling bersemangat —
   * hadiah yang justru menghukum. Dengan di bawah, ia murni hiasan: pixel asli
   * tetap terlihat, tetap bisa diketuk, dan permainan tidak berhenti sedetik pun.
   *
   * Nyalanya menyapu diagonal (delay dari row + col) alih-alih serentak. Kilatan
   * serentak terbaca sebagai kedipan/kesalahan render; sapuan terbaca sebagai
   * sesuatu yang disengaja dan punya arah.
   */
  levelCelebration(level: number): void {
    const palette = ALL_COLORS;
    const cells: Phaser.GameObjects.Rectangle[] = [];

    for (let row = 0; row < this.gridSize; row += 1) {
      for (let col = 0; col < this.gridSize; col += 1) {
        const at = this.centerOf({ row, col });
        const tile = this.scene.add.rectangle(
          at.x,
          at.y,
          this.cell - this.inset * 2,
          this.cell - this.inset * 2,
          COLOR_HEX[palette[(row + col) % palette.length]!],
        );
        // Di bawah pixel permainan, di atas latar. Ini barisnya.
        tile.setDepth(-1);
        tile.setAlpha(0);
        cells.push(tile);

        const wave = (row + col) * 18;
        this.scene.tweens.add({
          targets: tile,
          alpha: this.reducedMotion ? 0.35 : 0.55,
          duration: this.reducedMotion ? 200 : 140,
          delay: this.reducedMotion ? 0 : wave,
          yoyo: true,
          hold: this.reducedMotion ? 260 : 200,
          ease: 'Sine.easeOut',
        });
      }
    }

    // Dibersihkan setelah sapuan terjauh selesai. Sudut terjauh menunggu
    // (n-1)+(n-1) kali 18 ms sebelum mulai, jadi angkanya dihitung dari situ —
    // bukan ditebak, supaya tidak ada kotak yang terhapus selagi masih terlihat.
    // Ikut jumlah sel papan ini: di papan 10×10 sapuannya lebih panjang, dan
    // angka tetap akan memotong perayaannya di tengah jalan.
    const longestWave = this.reducedMotion ? 0 : (this.gridSize - 1) * 2 * 18;
    const total = longestWave + 140 * 2 + 260;
    this.scene.time.delayedCall(total, () => {
      for (const tile of cells) tile.destroy();
    });

    // Spanduk menyusul di tengah sapuan, bukan di awalnya: kalau muncul
    // bersamaan, keduanya berebut perhatian dan tidak ada yang terbaca.
    this.scene.time.delayedCall(this.reducedMotion ? 0 : 160, () => this.levelBanner(level));
  }

  /**
   * Spanduk singkat di tengah papan saat level naik.
   *
   * Engine sudah memancarkan `levelUp` sejak Patch 4 dan sampai sekarang tidak
   * pernah digambar — kenaikan level hanya terlihat kalau pemain sempat melirik
   * HUD, yang justru tidak dilakukan siapa pun di tengah ronde. Progres yang
   * tidak terasa sama dengan progres yang tidak ada.
   */
  levelBanner(level: number): void {
    const label = this.scene.add.text(BOARD_SIZE / 2, BOARD_SIZE * 0.34, `LEVEL ${level}`, {
      fontFamily: 'monospace',
      fontSize: '44px',
      color: '#ff8906',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setAlpha(0);

    if (this.reducedMotion) {
      // Tanpa gerakan: muncul, tertahan, hilang. Informasinya tetap sampai.
      this.scene.tweens.add({
        targets: label,
        alpha: { from: 0, to: 1 },
        duration: 160,
        hold: 520,
        yoyo: true,
        onComplete: () => label.destroy(),
      });
      return;
    }

    label.setScale(0.6);
    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          alpha: 0,
          y: label.y - this.cell * 0.5,
          duration: 420,
          delay: 380,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  /**
   * Combo panjang yang putus.
   *
   * Hanya dari ambang tertentu: combo 2 yang putus itu kejadian biasa, dan
   * memberi umpan balik untuk setiap kejadian biasa membuat umpan balik itu
   * berhenti berarti apa-apa. Yang layak terasa adalah kehilangan yang mahal.
   */
  comboBroken(previousCombo: number): void {
    const label = this.scene.add.text(
      BOARD_SIZE / 2,
      BOARD_SIZE / 2,
      `COMBO ${previousCombo} HILANG`,
      { fontFamily: 'monospace', fontSize: '24px', color: '#e43b44', fontStyle: 'bold' },
    );
    label.setOrigin(0.5);
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      y: this.reducedMotion ? label.y : label.y + this.cell * 0.4,
      duration: 620,
      onComplete: () => label.destroy(),
    });
  }

  /**
   * Denyut tipis di seluruh papan saat warna target berganti.
   *
   * HUD sudah memberi peringatan, tapi mata pemain ada di PAPAN — dan itu
   * justru satu-satunya tempat yang tidak memberi tanda apa pun saat aturannya
   * berubah. Sengaja tipis: ini pengingat, bukan gangguan.
   */
  targetPulse(): void {
    if (this.reducedMotion) return;
    for (const view of this.views.values()) {
      this.scene.tweens.add({
        targets: view.rect,
        scale: { from: 1, to: 1.08 },
        duration: 130,
        yoyo: true,
      });
    }
  }

  redraw(pixels: readonly Pixel[], hideGlyph: boolean): void {
    this.clear();
    for (const pixel of pixels) this.add(pixel, hideGlyph);
  }
}
