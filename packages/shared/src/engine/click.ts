import { WRONG_CLICK_PENALTY } from '../constants/index';
import type { ClickRejectReason, GameEvent } from './events';
import { levelFor } from './difficulty';
import { applyPenalty, comboMultiplier, pointsForClick, remainingRatio } from './scoring';
import { checkpointFor } from './state';
import type { GameState } from './state';

export interface ClickResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** True hanya kalau pixel berhasil diklaim (klik benar). */
  readonly claimed: boolean;
}

/**
 * Proses satu klik/tap pada sebuah pixel.
 *
 * Di multiplayer, fungsi ini dijalankan di server dan pemanggilan pertama yang
 * masuk untuk sebuah `pixelId` adalah pemenangnya — pemain lain otomatis dapat
 * `notFound` karena pixel-nya sudah hilang dari papan (GDD §5).
 */
export function applyClick(state: GameState, pixelId: string): ClickResult {
  if (state.status !== 'running') {
    return rejectWithoutPenalty(state, pixelId, 'notRunning');
  }

  const pixel = state.board.pixels.find((candidate) => candidate.id === pixelId);
  if (!pixel) {
    // Pixel sudah pudar atau sudah diklaim orang lain. Tidak dihukum: di HP,
    // tap ganda atau tap yang datang telat sedikit itu wajar, bukan kesalahan.
    return rejectWithoutPenalty(state, pixelId, 'notFound');
  }

  const ratio = remainingRatio(pixel, state.elapsedMs);
  if (ratio <= 0) {
    return rejectWithoutPenalty(state, pixelId, 'tooLate');
  }

  if (pixel.color !== state.board.targetColor) {
    return applyWrongColor(state, pixelId);
  }

  return applyCorrectClick(state, pixelId, ratio);
}

function rejectWithoutPenalty(
  state: GameState,
  pixelId: string,
  reason: ClickRejectReason,
): ClickResult {
  return {
    state,
    events: [
      {
        type: 'clickRejected',
        pixelId,
        reason,
        penalty: 0,
        livesLeft: state.score.lives,
      },
    ],
    claimed: false,
  };
}

function applyWrongColor(state: GameState, pixelId: string): ClickResult {
  const events: GameEvent[] = [];
  const previousCombo = state.score.combo;

  // Pixel-nya sengaja TIDAK dihapus: kalau klik salah membersihkan papan, klik
  // ngawur jadi strategi untuk menyingkirkan distraktor.
  const lives = state.score.lives === null ? null : Math.max(0, state.score.lives - 1);

  let score = {
    ...state.score,
    score: applyPenalty(state.score.score),
    combo: 0,
    wrongClicks: state.score.wrongClicks + 1,
    lives,
  };

  events.push({
    type: 'clickRejected',
    pixelId,
    reason: 'wrongColor',
    penalty: WRONG_CLICK_PENALTY,
    livesLeft: lives,
  });

  if (previousCombo > 0) {
    events.push({ type: 'comboBroken', previousCombo });
  }

  let status = state.status;
  if (lives !== null && lives <= 0) {
    status = 'gameOver';
    events.push({ type: 'gameOver', score: score.score });
    score = { ...score, combo: 0 };
  }

  return { state: { ...state, status, score }, events, claimed: false };
}

function applyCorrectClick(state: GameState, pixelId: string, ratio: number): ClickResult {
  const events: GameEvent[] = [];
  const pixel = state.board.pixels.find((candidate) => candidate.id === pixelId)!;

  const combo = state.score.combo + 1;
  const points = pointsForClick(ratio, combo, state.board.level);
  const correctClicks = state.score.correctClicks + 1;

  const score = {
    ...state.score,
    score: state.score.score + points,
    combo,
    bestCombo: Math.max(state.score.bestCombo, combo),
    correctClicks,
  };

  // Di solo, level papan mengikuti progres pemain. Di multiplayer nanti server
  // yang menentukan level papan, jadi nilainya dibiarkan apa adanya.
  const previousLevel = levelFor(state.score.correctClicks);
  const newLevel = levelFor(correctClicks);
  const boardLevel =
    state.config.mode === 'solo' ? Math.max(state.board.level, newLevel) : state.board.level;

  const board = {
    ...state.board,
    level: boardLevel,
    pixels: state.board.pixels.filter((candidate) => candidate.id !== pixelId),
    correctClicksSinceTargetChange: state.board.correctClicksSinceTargetChange + 1,
  };

  events.push({
    type: 'pixelClaimed',
    pixelId,
    cell: pixel.cell,
    points,
    combo,
    multiplier: comboMultiplier(combo),
    score: score.score,
  });

  if (newLevel > previousLevel) {
    events.push({ type: 'levelUp', level: newLevel });
  }

  let status = state.status;
  if (state.config.targetScore !== null && score.score >= state.config.targetScore) {
    status = 'finished';
    events.push({ type: 'targetScoreReached', score: score.score });
  }

  const next: GameState = { ...state, status, board, score };

  // Checkpoint direkam setelah skor klik ini masuk, jadi melanjutkan dari
  // checkpoint mengembalikanmu ke keadaan tepat saat level itu tercapai.
  const checkpoint = checkpointFor(next, newLevel);
  if (checkpoint !== null) {
    events.push({ type: 'checkpointReached', level: checkpoint.level, score: checkpoint.score });
    return { state: { ...next, checkpoint }, events, claimed: true };
  }

  return { state: next, events, claimed: true };
}
