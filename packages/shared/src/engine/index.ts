export {
  chaosBombFactor,
  chaosHidesGlyphs,
  chaosModifierFor,
  chaosShufflesBoard,
  chaosSpawnFactor,
  isChaosLevel,
} from './chaos';

export { applyClick } from './click';
export type { ClickResult } from './click';

export { gridSizeFor, spawnCrowdFactor } from './crowd';

export {
  balancedTeamFor,
  canJoinTeam,
  otherTeam,
  teamCapacity,
  teamsReady,
  teamTargetScore,
} from './team';

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
  isComboMilestone,
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
  isTargetColor,
  isTargetChangeImminent,
  multiplayerConfig,
  pauseGame,
  remainingTimeMs,
  resumeGame,
  soloConfig,
  startGame,
  supportsContinues,
  targetColorCount,
} from './state';
export type {
  BoardState,
  Checkpoint,
  CreateGameStateOptions,
  GameConfig,
  GameState,
  ScoreState,
} from './state';

export { matchIntensity, soloIntensity } from './intensity';
export {
  BOT_NAME_PREFIX,
  BOT_DIFFICULTIES,
  BOT_PROFILES,
  botDisplayName,
  botReactionMs,
  pickBotTarget,
} from './bot';
export type { BotChoice, BotDifficulty, BotProfile } from './bot';
export { LATENCY_FAIR_MAX_MS, LATENCY_GOOD_MAX_MS, latencyQuality, smoothLatency } from './latency';
export type { LatencyQuality } from './latency';
export { equalizeDelayMs, referenceLatencyMs } from './fairness';
export { mpLevelProgress, soloLevelProgress } from './levelProgress';
export type { LevelProgress } from './levelProgress';
export { isStroopActive, stroopInkFor } from './stroop';
export { pendingTutorial, TUTORIAL_LEVELS, tutorialForLevel } from './tutorial';
export type { TutorialTopic } from './tutorial';
export { bombChance, breakCombo, step } from './step';
export type { StepResult } from './step';
