// Build ESM Phaser 3 hanya punya named export (tidak ada default), jadi harus
// namespace import — `import Phaser from 'phaser'` gagal saat di-bundle.
import * as Phaser from 'phaser';
import {
  applyClick,
  canContinue,
  CLICKS_PER_LEVEL,
  continueFromCheckpoint,
  COMBO_STEP,
  comboMultiplier,
  createGameState,
  currentLevel,
  isStroopActive,
  soloLevelProgress,
  stroopInkFor,
  chaosHidesGlyphs,
  isComboMilestone,
  chaosModifierFor,
  isAtMaxLevel,
  isTargetChangeImminent,
  isSameSnapshot,
  pauseGame,
  resumeGame,
  startGame,
  step,
} from '@pixelmatrix/shared';
import type { GameEvent, GameState, HudSnapshot, Pixel } from '@pixelmatrix/shared';
import { BoardRenderer } from './BoardRenderer';
import { BOARD_BACKGROUND } from './palette';
import type { Sfx } from './sfx';

/**
 * Kalau tab di-background, `delta` bisa melompat detik-detikan. Dijepit supaya
 * pemain tidak kembali ke papan yang sudah kacau.
 */
const MAX_FRAME_MS = 100;

export interface BoardSceneOptions {
  readonly onHud: (snapshot: HudSnapshot) => void;
  readonly sfx: Sfx;
  /**
   * Mulai ronde dari level ini, bukan dari level 1. Hanya dipakai di
   * development (lihat `?level=` di halaman solo) untuk mengulik balancing dan
   * menguji mekanik level tinggi tanpa harus main sepuluh menit dulu.
   */
  readonly startLevel?: number;
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
  private boardView!: BoardRenderer;
  private lastSnapshot: HudSnapshot | null = null;

  constructor(private readonly options: BoardSceneOptions) {
    super('board');
    this.gameState = createGameState({ seed: Date.now() });
  }

  // `create` bukan bagian dari tipe Phaser.Scene (dipanggil lewat konvensi),
  // jadi tidak boleh diberi `override` — beda dengan `update` di bawah.
  create(): void {
    this.cameras.main.setBackgroundColor(BOARD_BACKGROUND);
    this.boardView = new BoardRenderer(this);
    this.boardView.drawGrid();

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
    this.boardView?.clear();
    this.gameState = applyStartLevel(startGame(this.gameState), this.options.startLevel);
    this.emitSnapshot();
  }

  /** Lanjut dari checkpoint terakhir tanpa mengulang ronde dari awal. */
  continueRound(): void {
    this.options.sfx.unlock();
    this.boardView?.clear();
    this.gameState = continueFromCheckpoint(this.gameState);
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

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameState.status !== 'running') return;

    const cell = this.boardView.cellAt(pointer.x, pointer.y);
    if (!cell) return;

    const pixel = this.gameState.board.pixels.find(
      (candidate) => candidate.cell.row === cell.row && candidate.cell.col === cell.col,
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
          this.addPixelView(event.pixel);
          break;

        case 'pixelExpired':
          this.boardView.remove(event.pixelId, 'fade');
          break;

        case 'pixelClaimed':
          // Semburan dipanggil SEBELUM remove: warnanya dibaca dari view yang
          // masih ada di papan.
          this.boardView.burstAt(event.pixelId, event.cell);
          this.boardView.remove(event.pixelId, 'pop');
          this.boardView.floatingScore(event.cell, `+${event.points}`);
          if (isComboMilestone(event.combo)) this.boardView.comboPopup(event.combo);
          this.options.sfx.correct(event.combo);
          break;

        case 'clickRejected':
          if (event.reason === 'wrongColor') {
            this.options.sfx.wrong();
            this.boardView.shake(140, 0.008);
          }
          break;

        case 'bombHit':
          // Guncangan lebih keras daripada klik salah biasa: bom itu kesalahan
          // yang paling mahal, dan pemain harus langsung tahu tanpa lihat HUD.
          this.boardView.remove(event.pixelId, 'pop');
          this.options.sfx.bomb();
          this.boardView.shake(260, 0.016);
          this.boardView.flash(160, 228, 59, 68);
          break;

        case 'lifeGained':
          this.options.sfx.life();
          break;

        case 'boardShuffled':
          // Pixel dipindah oleh engine; view lama dibuang dan digambar ulang.
          this.redraw();
          break;

        case 'gameOver':
          this.options.sfx.gameOver();
          break;

        case 'levelUp':
          // Engine memancarkan ini sejak Patch 4 dan sampai sekarang tidak
          // pernah digambar. Kenaikan level cuma terlihat kalau pemain melirik
          // HUD — yang tidak dilakukan siapa pun di tengah ronde.
          this.boardView.levelCelebration(event.level);
          this.options.sfx.levelUp();
          break;

        case 'comboBroken':
          // Hanya combo yang sudah bernilai. Umpan balik untuk setiap kejadian
          // biasa membuat umpan balik itu berhenti berarti apa-apa.
          if (event.previousCombo >= COMBO_STEP) {
            this.boardView.comboBroken(event.previousCombo);
          }
          break;

        case 'targetChanged':
          // Mata pemain ada di PAPAN, dan papan itu satu-satunya tempat yang
          // tidak memberi tanda apa pun saat aturannya berubah.
          this.boardView.targetPulse();
          break;

        default:
          // targetScoreReached ditampilkan lewat HUD di React.
          break;
      }
    }
  }

  /** Glyph disembunyikan oleh modifier chaos `blackout` — kecuali untuk bom. */
  private hidesGlyph(pixel: Pixel): boolean {
    return (
      pixel.kind === 'normal' &&
      chaosHidesGlyphs(chaosModifierFor(this.gameState.board.chaosSeed, this.gameState.board.level))
    );
  }

  private addPixelView(pixel: Pixel): void {
    this.boardView.add(pixel, this.hidesGlyph(pixel));
  }

  private redraw(): void {
    this.boardView.clear();
    for (const pixel of this.gameState.board.pixels) this.addPixelView(pixel);
  }

  private refreshFade(): void {
    this.boardView.refreshFade(this.gameState.board.pixels, this.gameState.elapsedMs);
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
      atMaxLevel: isAtMaxLevel(this.gameState),
      targetColors: board.targetColors,
      // Seed-nya waktu ganti target berikutnya: tintanya tetap selama satu
      // periode target lalu berubah bersamaan dengan warnanya. Kalau seed-nya
      // ikut jam berjalan, tintanya akan berkedip-kedip tiap frame.
      levelFraction: soloLevelProgress(score.correctClicks).fraction,
      clicksToNextLevel: soloLevelProgress(score.correctClicks).remaining,
      stroopInk: isStroopActive(currentLevel(this.gameState))
        ? stroopInkFor(board.targetColors, board.targetChangesAtMs + board.chaosSeed)
        : null,
      chaos: chaosModifierFor(board.chaosSeed, board.level),
      targetImminent: status === 'running' && isTargetChangeImminent(this.gameState),
      accuracy: totalClicks === 0 ? 1 : score.correctClicks / totalClicks,
      elapsedMs: this.gameState.elapsedMs,
      checkpointLevel: this.gameState.checkpoint?.level ?? null,
      continuesLeft: this.gameState.continuesLeft,
      canContinue: canContinue(this.gameState),
    };

    // Hanya kabari React kalau ada yang benar-benar berubah — kalau tidak,
    // HUD akan re-render 60× per detik tanpa alasan.
    if (this.lastSnapshot !== null && isSameSnapshot(this.lastSnapshot, snapshot)) return;
    this.lastSnapshot = snapshot;
    this.options.onHud(snapshot);
  }
}

/**
 * Geser state ke level tertentu dengan menyetel jumlah klik benar seolah pemain
 * sudah sampai di sana, supaya `levelFor()` dan `board.level` tetap sepakat.
 */
function applyStartLevel(state: GameState, startLevel: number | undefined): GameState {
  if (startLevel === undefined || startLevel <= 1) return state;

  return {
    ...state,
    board: { ...state.board, level: startLevel },
    score: { ...state.score, correctClicks: (startLevel - 1) * CLICKS_PER_LEVEL },
  };
}
