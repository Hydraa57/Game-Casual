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
