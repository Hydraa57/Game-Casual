import {
  BOMB_FIRST_LEVEL,
  CHAOS_FIRST_LEVEL,
  DUAL_TARGET_FIRST_LEVEL,
  GOLD_FIRST_LEVEL,
  LIFE_FIRST_LEVEL,
  STROOP_FIRST_LEVEL,
} from '../constants/index';

/**
 * Mekanik yang punya penjelasan singkat saat pertama kali muncul.
 *
 * Semua ini ditambahkan di Fase 1.5 dan sampai sekarang tidak pernah
 * dijelaskan: pemain menemui pixel gelap berbingkai merah, menekannya karena
 * penasaran, kehilangan dua nyawa, dan tidak tahu apa yang baru saja terjadi.
 * Menemukan sendiri itu menyenangkan kalau harganya murah — di sini harganya
 * separuh nyawa awal.
 */
export type TutorialTopic = 'gold' | 'life' | 'bomb' | 'dualTarget' | 'stroop' | 'chaos';

/**
 * Level tempat setiap penjelasan dipicu.
 *
 * DITURUNKAN dari konstanta mekaniknya, tidak ditulis ulang. Kalau bom
 * dipindahkan ke level lain nanti, tutorialnya ikut pindah sendiri — dan tidak
 * ada kemungkinan penjelasan muncul di level tempat mekaniknya belum aktif.
 */
export const TUTORIAL_LEVELS: Readonly<Record<TutorialTopic, number>> = {
  gold: GOLD_FIRST_LEVEL,
  life: LIFE_FIRST_LEVEL,
  bomb: BOMB_FIRST_LEVEL,
  dualTarget: DUAL_TARGET_FIRST_LEVEL,
  stroop: STROOP_FIRST_LEVEL,
  chaos: CHAOS_FIRST_LEVEL,
};

/**
 * Penjelasan yang harus muncul saat pemain BARU SAJA naik ke `level`.
 *
 * `null` untuk level yang tidak membuka apa pun — mayoritas level.
 *
 * Sengaja memakai kesamaan tepat (`===`), bukan `>=`: fungsi ini dipanggil pada
 * transisi naik level, jadi yang ditanyakan adalah "apa yang baru dibuka level
 * ini", bukan "apa saja yang sudah aktif". Dengan `>=`, satu pemain yang
 * memulai dari level tinggi lewat `?level=` akan mendapat lima kartu bertumpuk.
 */
export function tutorialForLevel(level: number): TutorialTopic | null {
  for (const [topic, at] of Object.entries(TUTORIAL_LEVELS)) {
    if (at === level) return topic as TutorialTopic;
  }
  return null;
}

/**
 * Penjelasan yang harus muncul, dengan memperhitungkan mana yang sudah dilihat.
 *
 * Dipisah dari `tutorialForLevel` supaya aturan "sekali saja" bisa diuji tanpa
 * menyentuh localStorage.
 */
export function pendingTutorial(
  level: number,
  seen: readonly TutorialTopic[],
): TutorialTopic | null {
  const topic = tutorialForLevel(level);
  if (topic === null || seen.includes(topic)) return null;
  return topic;
}
