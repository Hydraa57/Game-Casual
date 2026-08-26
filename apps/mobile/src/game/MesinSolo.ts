import {
  applyClick,
  canContinue,
  chaosHidesGlyphs,
  chaosModifierFor,
  CLICKS_PER_LEVEL,
  comboMultiplier,
  continueFromCheckpoint,
  createGameState,
  currentLevel,
  isAtMaxLevel,
  isSameSnapshot,
  isStroopActive,
  isTargetChangeImminent,
  pauseGame,
  resumeGame,
  soloLevelProgress,
  startGame,
  step,
  stroopInkFor,
} from '@pixelmatrix/shared';
import type { GameEvent, GameState, HudSnapshot, Pixel } from '@pixelmatrix/shared';

/**
 * Kalau aplikasi ditaruh di latar belakang, jeda antar-frame bisa melompat
 * detik-detikan. Dijepit supaya pemain tidak kembali ke papan yang sudah
 * telanjur kacau — sama seperti yang dilakukan versi web.
 */
export const MAX_FRAME_MS = 100;

export interface OpsiMesinSolo {
  readonly onHud: (snapshot: HudSnapshot) => void;
  readonly onEvent: (event: GameEvent) => void;
  /** Diisi test supaya papannya bisa diulang persis. Produksi memakai jam. */
  readonly seed?: number;
  /**
   * Mulai dari level ini, bukan dari level 1.
   *
   * HANYA dipakai test: menguji bom (Lv 8+), dua warna target (Lv 12+), dan
   * mode chaos (Lv 21+) lewat permainan sungguhan berarti menunggu ratusan klik
   * benar lebih dulu. Tidak ada satu pun jalan dari UI ke sini.
   */
  readonly levelAwal?: number;
}

/**
 * Mesin mode solo untuk Android.
 *
 * **Tidak tahu apa-apa soal React, React Native, atau cara menggambar.** Ia
 * memegang `GameState` dan memajukannya; yang menggambar memanggil `majukan()`
 * tiap frame lalu membaca `pixels`. Pemisahan itu yang membuat seluruh alur
 * permainan bisa diuji di sini tanpa perangkat sama sekali — dan di proyek ini
 * itu bukan kemewahan, karena tidak ada emulator di lingkungan pengembangannya.
 *
 * Seluruh ATURAN mainnya tetap datang dari `@pixelmatrix/shared` — persis modul
 * yang dipakai klien web dan game server. Berkas ini cuma menyetir.
 */
export class MesinSolo {
  private state: GameState;
  private snapshotTerakhir: HudSnapshot | null = null;

  constructor(private readonly opsi: OpsiMesinSolo) {
    this.state = terapkanLevelAwal(
      createGameState({ seed: opsi.seed ?? Date.now() }),
      opsi.levelAwal,
    );
    this.pancarkanSnapshot();
  }

  // ------------------------------------------------------------------ kontrol

  mulai(): void {
    this.state = terapkanLevelAwal(startGame(this.state), this.opsi.levelAwal);
    this.pancarkanSnapshot();
  }

  /** Lanjut dari checkpoint terakhir tanpa mengulang ronde dari awal. */
  lanjutDariCheckpoint(): void {
    this.state = continueFromCheckpoint(this.state);
    this.pancarkanSnapshot();
  }

  jeda(): void {
    this.state = pauseGame(this.state);
    this.pancarkanSnapshot();
  }

  lanjutkan(): void {
    this.state = resumeGame(this.state);
    this.pancarkanSnapshot();
  }

  // -------------------------------------------------------------------- jalan

  /** Majukan permainan. Dipanggil tiap frame oleh yang menggambar. */
  majukan(deltaMs: number): void {
    const hasil = step(this.state, Math.min(deltaMs, MAX_FRAME_MS));
    this.state = hasil.state;
    this.teruskanEvent(hasil.events);
    this.pancarkanSnapshot();
  }

  /**
   * Tap pada satu SEL papan, bukan pada satu pixel.
   *
   * Sengaja per sel: target sentuhnya jadi selebar sel walau gambar pixelnya
   * lebih kecil dan punya jarak antar-pixel. Tap di sel kosong tidak dihukum —
   * di HP jempol sering meleset sedikit, dan menghukumnya bikin game terasa
   * jahat.
   */
  tapSel(row: number, col: number): void {
    if (this.state.status !== 'running') return;

    const pixel = this.state.board.pixels.find(
      (kandidat) => kandidat.cell.row === row && kandidat.cell.col === col,
    );
    if (!pixel) return;

    const hasil = applyClick(this.state, pixel.id);
    this.state = hasil.state;
    this.teruskanEvent(hasil.events);
    this.pancarkanSnapshot();
  }

  // -------------------------------------------------------------------- baca

  get pixels(): readonly Pixel[] {
    return this.state.board.pixels;
  }

  get elapsedMs(): number {
    return this.state.elapsedMs;
  }

  get status(): GameState['status'] {
    return this.state.status;
  }

  /** Hanya untuk test — supaya assert-nya tidak perlu menebak dari HUD. */
  get debugState(): GameState {
    return this.state;
  }

  /**
   * Glyph disembunyikan modifier chaos `blackout` — kecuali untuk pixel spesial.
   *
   * Bom, emas, dan nyawa tetap menampilkan tandanya: `blackout` dimaksudkan
   * untuk memaksa pemain membedakan WARNA, bukan untuk menyembunyikan bahaya.
   * Bom yang tidak bisa dibedakan dari pixel biasa bukan kesulitan, itu jebakan.
   */
  sembunyikanGlyph(pixel: Pixel): boolean {
    return (
      pixel.kind === 'normal' &&
      chaosHidesGlyphs(chaosModifierFor(this.state.board.chaosSeed, this.state.board.level))
    );
  }

  // ----------------------------------------------------------------- internal

  private teruskanEvent(events: readonly GameEvent[]): void {
    for (const event of events) this.opsi.onEvent(event);
  }

  private pancarkanSnapshot(): void {
    const snapshot = this.snapshot();

    // Hanya kabari yang menggambar kalau ada yang benar-benar berubah — kalau
    // tidak, HUD akan dirender ulang 60× per detik tanpa alasan.
    if (this.snapshotTerakhir !== null && isSameSnapshot(this.snapshotTerakhir, snapshot)) return;
    this.snapshotTerakhir = snapshot;
    this.opsi.onHud(snapshot);
  }

  private snapshot(): HudSnapshot {
    const { score, board, status } = this.state;
    const totalKlik = score.correctClicks + score.wrongClicks;
    const level = currentLevel(this.state);
    const progres = soloLevelProgress(score.correctClicks);

    return {
      status,
      score: score.score,
      combo: score.combo,
      multiplier: comboMultiplier(score.combo),
      bestCombo: score.bestCombo,
      lives: score.lives,
      level,
      atMaxLevel: isAtMaxLevel(this.state),
      targetColors: board.targetColors,
      // Seed-nya waktu ganti target berikutnya: tintanya tetap selama satu
      // periode target lalu berubah bersamaan dengan warnanya. Kalau seed-nya
      // ikut jam berjalan, tintanya akan berkedip-kedip tiap frame.
      stroopInk: isStroopActive(level)
        ? stroopInkFor(board.targetColors, board.targetChangesAtMs + board.chaosSeed)
        : null,
      levelFraction: progres.fraction,
      clicksToNextLevel: progres.remaining,
      chaos: chaosModifierFor(board.chaosSeed, board.level),
      targetImminent: status === 'running' && isTargetChangeImminent(this.state),
      accuracy: totalKlik === 0 ? 1 : score.correctClicks / totalKlik,
      elapsedMs: this.state.elapsedMs,
      checkpointLevel: this.state.checkpoint?.level ?? null,
      continuesLeft: this.state.continuesLeft,
      canContinue: canContinue(this.state),
    };
  }
}

/**
 * Geser state ke level tertentu dengan menyetel jumlah klik benar seolah pemain
 * sudah sampai di sana, supaya `levelFor()` dan `board.level` tetap sepakat.
 */
function terapkanLevelAwal(state: GameState, levelAwal: number | undefined): GameState {
  if (levelAwal === undefined || levelAwal <= 1) return state;

  return {
    ...state,
    board: { ...state.board, level: levelAwal },
    score: { ...state.score, correctClicks: (levelAwal - 1) * CLICKS_PER_LEVEL },
  };
}
