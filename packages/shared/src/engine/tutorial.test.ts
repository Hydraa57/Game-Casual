import { describe, expect, it } from 'vitest';
import {
  BOMB_FIRST_LEVEL,
  CHAOS_FIRST_LEVEL,
  DUAL_TARGET_FIRST_LEVEL,
  GOLD_FIRST_LEVEL,
  LIFE_FIRST_LEVEL,
  STROOP_FIRST_LEVEL,
} from '../constants/index';
import { pendingTutorial, TUTORIAL_LEVELS, tutorialForLevel } from './tutorial';

describe('tutorial per mekanik', () => {
  it('setiap penjelasan dipicu tepat di level mekaniknya', () => {
    // Ini yang menjaga penjelasan tidak pernah muncul sebelum mekaniknya aktif.
    expect(tutorialForLevel(GOLD_FIRST_LEVEL)).toBe('gold');
    expect(tutorialForLevel(LIFE_FIRST_LEVEL)).toBe('life');
    expect(tutorialForLevel(BOMB_FIRST_LEVEL)).toBe('bomb');
    expect(tutorialForLevel(DUAL_TARGET_FIRST_LEVEL)).toBe('dualTarget');
    expect(tutorialForLevel(STROOP_FIRST_LEVEL)).toBe('stroop');
    expect(tutorialForLevel(CHAOS_FIRST_LEVEL)).toBe('chaos');
  });

  it('level 1 dan 2 tidak memicu apa pun', () => {
    // Awal permainan harus bersih: papan, tap, selesai.
    expect(tutorialForLevel(1)).toBeNull();
    expect(tutorialForLevel(2)).toBeNull();
  });

  it('tidak ada dua mekanik yang berbagi level yang sama', () => {
    // Kalau ada, satu penjelasan akan menutupi yang lain dan mekanik itu tidak
    // pernah dijelaskan sama sekali.
    const levels = Object.values(TUTORIAL_LEVELS);
    expect(new Set(levels).size).toBe(levels.length);
  });

  it('level di antara pembukaan tidak memicu apa pun', () => {
    const unlockLevels = new Set<number>(Object.values(TUTORIAL_LEVELS));
    for (let level = 1; level <= CHAOS_FIRST_LEVEL + 5; level += 1) {
      if (unlockLevels.has(level)) continue;
      expect(tutorialForLevel(level)).toBeNull();
    }
  });

  it('penjelasan yang sudah dilihat tidak muncul lagi', () => {
    expect(pendingTutorial(BOMB_FIRST_LEVEL, [])).toBe('bomb');
    expect(pendingTutorial(BOMB_FIRST_LEVEL, ['bomb'])).toBeNull();
  });

  it('sudah melihat satu penjelasan tidak membungkam yang lain', () => {
    expect(pendingTutorial(BOMB_FIRST_LEVEL, ['gold', 'life'])).toBe('bomb');
  });
});
