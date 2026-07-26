// Build ESM Phaser 3 hanya punya named export (tidak ada default), jadi harus
// namespace import — `import Phaser from 'phaser'` gagal saat di-bundle.
import * as Phaser from 'phaser';
import {
  applyClick,
  COLOR_GLYPH,
  COLOR_HEX,
  comboMultiplier,
  createGameState,
  currentLevel,
  GRID_SIZE,
  isTargetChangeImminent,
  pauseGame,
  remainingRatio,
  resumeGame,
  startGame,
  step,
} from '@pixelmatrix/shared';
import type { GameEvent, GameState, Pixel } from '@pixelmatrix/shared';
import { isSameSnapshot } from './hudSnapshot';
import type { HudSnapshot } from './hudSnapshot';
import { BOARD_BACKGROUND, GRID_LINE } from './palette';
import type { Sfx } from './sfx';

/** Resolusi internal papan. Phaser men-scale-nya ke ukuran layar (Scale.FIT). */
export const BOARD_SIZE = 640;
const CELL = BOARD_SIZE / GRID_SIZE;
const PIXEL_INSET = 6;

/**
 * Kalau tab di-background, `delta` bisa melompat detik-detikan. Dijepit supaya
 * pemain tidak kembali ke papan yang sudah kacau.
 */
const MAX_FRAME_MS = 100;

export interface BoardSceneOptions {
  readonly onHud: (snapshot: HudSnapshot) => void;
  readonly sfx: Sfx;
}

interface PixelView {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly glyph: Phaser.GameObjects.Text;
}

interface DebugWindow {
  __pmScene?: BoardScene;
}

/**
 * Scene ini HANYA menggambar papan dan menerima tap. Seluruh aturan main
 * berasal dari `@pixelmatrix/shared` — persis engine yang nanti dijalankan game
 * server untuk multiplayer.
 */
export class BoardScene extends Phaser.Scene {
  private gameState: GameState;
  private readonly views = new Map<string, PixelView>();
  private lastSnapshot: HudSnapshot | null = null;

  constructor(private readonly options: BoardSceneOptions) {
    super('board');
    this.gameState = createGameState({ seed: Date.now() });
  }

  // `create` bukan bagian dari tipe Phaser.Scene (dipanggil lewat konvensi),
  // jadi tidak boleh diberi `override` — beda dengan `update` di bawah.
  create(): void {
    this.cameras.main.setBackgroundColor(BOARD_BACKGROUND);
    this.drawGridLines();

    // Satu handler untuk seluruh papan, bukan hit-area per pixel: tap dianggap
    // mengenai seluruh sel, jadi target sentuh tetap selebar sel walau
    // gambarnya punya jarak antar-pixel.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);

    if (process.env.NODE_ENV !== 'production') {
      // Kait untuk uji end-to-end: tes perlu tahu pixel mana yang berwarna
      // target supaya bisa mengetuk sel yang benar. Tidak ada di build produksi.
      (window as unknown as DebugWindow).__pmScene = this;
    }

    this.emitSnapshot();
  }

  /** Hanya untuk uji end-to-end (lihat `create`). */
  debugState(): GameState {
    return this.gameState;
  }

  override update(_time: number, delta: number): void {
    const result = step(this.gameState, Math.min(delta, MAX_FRAME_MS));
    this.gameState = result.state;
    this.applyEvents(result.events);
    this.refreshFade();
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------- kontrol

  startRound(): void {
    this.options.sfx.unlock();
    this.clearViews();
    this.gameState = startGame(this.gameState);
    this.emitSnapshot();
  }

  pauseRound(): void {
    this.gameState = pauseGame(this.gameState);
    this.emitSnapshot();
  }

  resumeRound(): void {
    this.options.sfx.unlock();
    this.gameState = resumeGame(this.gameState);
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------- internal

  private drawGridLines(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, GRID_LINE, 1);
    for (let index = 1; index < GRID_SIZE; index += 1) {
      const offset = index * CELL;
      graphics.lineBetween(offset, 0, offset, BOARD_SIZE);
      graphics.lineBetween(0, offset, BOARD_SIZE, offset);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameState.status !== 'running') return;

    const col = Math.floor(pointer.x / CELL);
    const row = Math.floor(pointer.y / CELL);
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return;

    const pixel = this.gameState.board.pixels.find(
      (candidate) => candidate.cell.row === row && candidate.cell.col === col,
    );
    // Tap di sel kosong sengaja tidak dihukum — di HP jempol sering meleset
    // sedikit, dan menghukumnya bikin game terasa jahat.
    if (!pixel) return;

    const result = applyClick(this.gameState, pixel.id);
    this.gameState = result.state;
    this.applyEvents(result.events);
    this.emitSnapshot();
  }

  private applyEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'pixelSpawned':
          this.createView(event.pixel);
          break;

        case 'pixelExpired':
          this.removeView(event.pixelId, 'fade');
          break;

        case 'pixelClaimed':
          this.removeView(event.pixelId, 'pop');
          this.showFloatingScore(event.cell, event.points);
          this.options.sfx.correct(event.combo);
          break;

        case 'clickRejected':
          if (event.reason === 'wrongColor') {
            this.options.sfx.wrong();
            this.cameras.main.shake(140, 0.008);
          }
          break;

        case 'gameOver':
          this.options.sfx.gameOver();
          break;

        default:
          // targetChanged / comboBroken / levelUp / targetScoreReached
          // ditampilkan lewat HUD di React, tidak perlu efek di canvas.
          break;
      }
    }
  }

  private createView(pixel: Pixel): void {
    const centerX = pixel.cell.col * CELL + CELL / 2;
    const centerY = pixel.cell.row * CELL + CELL / 2;
    const size = CELL - PIXEL_INSET * 2;

    const rect = this.add.rectangle(centerX, centerY, size, size, COLOR_HEX[pixel.color]);
    rect.setStrokeStyle(2, 0x000000, 0.35);

    // Glyph = pembeda warna untuk pemain buta warna (GDD §2). Ukurannya sengaja
    // besar: di layar HP papan ini menyusut ke ~45% ukuran internalnya.
    const glyph = this.add.text(centerX, centerY, COLOR_GLYPH[pixel.color], {
      fontFamily: 'monospace',
      fontSize: '40px',
      color: 'rgba(0,0,0,0.6)',
    });
    glyph.setOrigin(0.5);

    this.views.set(pixel.id, { rect, glyph });

    // Muncul dengan sedikit "pop" supaya mata langsung tertarik.
    rect.setScale(0.6);
    glyph.setScale(0.6);
    this.tweens.add({
      targets: [rect, glyph],
      scale: 1,
      duration: 110,
      ease: 'Back.easeOut',
    });
  }

  private removeView(pixelId: string, style: 'fade' | 'pop'): void {
    const view = this.views.get(pixelId);
    if (!view) return;
    this.views.delete(pixelId);

    const targets = [view.rect, view.glyph];
    this.tweens.add({
      targets,
      scale: style === 'pop' ? 1.4 : 0.7,
      alpha: 0,
      duration: style === 'pop' ? 130 : 180,
      onComplete: () => {
        view.rect.destroy();
        view.glyph.destroy();
      },
    });
  }

  private showFloatingScore(cell: Pixel['cell'], points: number): void {
    const label = this.add.text(
      cell.col * CELL + CELL / 2,
      cell.row * CELL + CELL / 2,
      `+${points}`,
      { fontFamily: 'monospace', fontSize: '26px', color: '#fffffe', fontStyle: 'bold' },
    );
    label.setOrigin(0.5);
    this.tweens.add({
      targets: label,
      y: label.y - CELL * 0.7,
      alpha: 0,
      duration: 520,
      onComplete: () => label.destroy(),
    });
  }

  /** Pixel meredup seiring umurnya, jadi urgensi terlihat tanpa perlu timer. */
  private refreshFade(): void {
    for (const pixel of this.gameState.board.pixels) {
      const view = this.views.get(pixel.id);
      if (!view) continue;
      const ratio = remainingRatio(pixel, this.gameState.elapsedMs);
      const alpha = 0.3 + 0.7 * ratio;
      view.rect.setAlpha(alpha);
      view.glyph.setAlpha(alpha);
    }
  }

  private clearViews(): void {
    for (const view of this.views.values()) {
      view.rect.destroy();
      view.glyph.destroy();
    }
    this.views.clear();
  }

  private emitSnapshot(): void {
    const { score, board, status } = this.gameState;
    const totalClicks = score.correctClicks + score.wrongClicks;

    const snapshot: HudSnapshot = {
      status,
      score: score.score,
      combo: score.combo,
      multiplier: comboMultiplier(score.combo),
      bestCombo: score.bestCombo,
      lives: score.lives,
      level: currentLevel(this.gameState),
      targetColor: board.targetColor,
      targetImminent: status === 'running' && isTargetChangeImminent(this.gameState),
      accuracy: totalClicks === 0 ? 1 : score.correctClicks / totalClicks,
    };

    // Hanya kabari React kalau ada yang benar-benar berubah — kalau tidak,
    // HUD akan re-render 60× per detik tanpa alasan.
    if (this.lastSnapshot !== null && isSameSnapshot(this.lastSnapshot, snapshot)) return;
    this.lastSnapshot = snapshot;
    this.options.onHud(snapshot);
  }
}
