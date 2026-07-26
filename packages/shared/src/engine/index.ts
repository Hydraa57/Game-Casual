export { applyClick } from './click';
export type { ClickResult } from './click';

export {
  activeColorCount,
  activeColors,
  curveProgress,
  expectedPixelsAlive,
  isMaxCurveLevel,
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
  levelBonusMultiplier,
  pointsForClick,
  remainingRatio,
  speedBonus,
} from './scoring';

export {
  canContinue,
  checkpointFor,
  continueFromCheckpoint,
  createGameState,
  createScoreState,
  currentLevel,
  isAtMaxLevel,
  isCheckpointLevel,
  isPlayable,
  isTargetChangeImminent,
  multiplayerConfig,
  pauseGame,
  remainingTimeMs,
  resumeGame,
  soloConfig,
  startGame,
  supportsContinues,
} from './state';
export type {
  BoardState,
  Checkpoint,
  CreateGameStateOptions,
  GameConfig,
  GameState,
  ScoreState,
} from './state';

export { breakCombo, step } from './step';
export type { StepResult } from './step';
