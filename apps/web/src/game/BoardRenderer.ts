// Hanya tipe yang dipakai di sini — objek Phaser dibuat lewat `scene` yang
// diberikan pemanggil, jadi modulnya tidak perlu ikut masuk ke bundle.
import type * as Phaser from 'phaser';
import { GRID_SIZE, remainingRatio } from '@pixelmatrix/shared';
import type { Cell, Pixel } from '@pixelmatrix/shared';
import { GRID_LINE, pixelStyle } from './palette';

/** Resolusi internal papan. Phaser men-scale-nya ke ukuran layar (Scale.FIT). */
export const BOARD_SIZE = 640;
export const CELL = BOARD_SIZE / GRID_SIZE;
const PIXEL_INSET = 6;
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

  constructor(private readonly scene: Phaser.Scene) {}

  drawGrid(): void {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(1, GRID_LINE, 1);
    for (let index = 1; index < GRID_SIZE; index += 1) {
      const offset = index * CELL;
      graphics.lineBetween(offset, 0, offset, BOARD_SIZE);
      graphics.lineBetween(0, offset, BOARD_SIZE, offset);
    }
  }

  /** Ubah koordinat pointer menjadi sel papan; `null` kalau di luar papan. */
  cellAt(x: number, y: number): Cell | null {
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
    return { row, col };
  }

  add(pixel: Pixel, hideGlyph: boolean): void {
    const centerX = pixel.cell.col * CELL + CELL / 2;
    const centerY = pixel.cell.row * CELL + CELL / 2;
    const size = CELL - PIXEL_INSET * 2;
    const style = pixelStyle(pixel);

    const rect = this.scene.add.rectangle(centerX, centerY, size, size, style.fill);
    rect.setStrokeStyle(style.strokeWidth, style.stroke, style.strokeAlpha);

    // Glyph = pembeda warna untuk pemain buta warna (GDD §2), dan untuk pixel
    // spesial ia yang membedakan bom dari pixel biasa. Ukurannya sengaja besar:
    // di layar HP papan ini menyusut ke ~45% ukuran internalnya.
    const glyph = this.scene.add.text(centerX, centerY, hideGlyph ? '' : style.glyph, {
      fontFamily: 'monospace',
      fontSize: '40px',
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

    this.scene.tweens.add({
      targets: [view.rect, view.glyph],
      scale: style === 'pop' ? 1.4 : 0.7,
      alpha: 0,
      duration: style === 'pop' ? 130 : 180,
      onComplete: () => {
        view.rect.destroy();
        view.glyph.destroy();
      },
    });
  }

  floatingScore(cell: Cell, text: string, color = '#fffffe'): void {
    const label = this.scene.add.text(
      cell.col * CELL + CELL / 2,
      cell.row * CELL + CELL / 2,
      text,
      { fontFamily: 'monospace', fontSize: '26px', color, fontStyle: 'bold' },
    );
    label.setOrigin(0.5);
    this.scene.tweens.add({
      targets: label,
      y: label.y - CELL * 0.7,
      alpha: 0,
      duration: 520,
      onComplete: () => label.destroy(),
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

    const emitter = this.scene.add.particles(
      cell.col * CELL + CELL / 2,
      cell.row * CELL + CELL / 2,
      PARTICLE_TEXTURE,
      {
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
      },
    );
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
    const mark = this.scene.add.text(
      cell.col * CELL + CELL / 2,
      cell.row * CELL + CELL / 2,
      glyph,
      { fontFamily: 'sans-serif', fontSize: `${Math.round(CELL * 0.62)}px` },
    );
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

  redraw(pixels: readonly Pixel[], hideGlyph: boolean): void {
    this.clear();
    for (const pixel of pixels) this.add(pixel, hideGlyph);
  }
}
