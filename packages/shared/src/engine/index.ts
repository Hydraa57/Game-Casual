export { applyClick } from './click';
export type { ClickResult } from './click';

export {
  activeColorCount,
  activeColors,
  levelFor,
  lifetimeMs,
  spawnIntervalMs,
} from './difficulty';

export type { ClickRejectReason, GameEvent } from './events';

export { nextInRange, nextInt, nextRandom, pickOne, seedFromString } from './rng';
export type { RandomResult } from './rng';

export {
  applyPenalty,
  comboMultiplier,
  pointsForClick,
  remainingRatio,
  speedBonus,
} from './scoring';

export {
  createGameState,
  createScoreState,
  currentLevel,
  isPlayable,
  isTargetChangeImminent,
  multiplayerConfig,
  pauseGame,
  remainingTimeMs,
  resumeGame,
  soloConfig,
  startGame,
} from './state';
export type {
  BoardState,
  CreateGameStateOptions,
  GameConfig,
  GameState,
  ScoreState,
} from './state';

export { breakCombo, step } from './step';
export type { StepResult } from './step';
