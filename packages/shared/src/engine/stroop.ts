import { ALL_COLORS, STROOP_FIRST_LEVEL } from '../constants/index';
import type { Color } from '../types/index';
import { nextRandom } from './rng';

/**
 * Efek Stroop: nama warna dicetak dengan tinta warna lain.
 *
 * Dari STROOP_FIRST_LEVEL, indikator target berhenti menampilkan kotak warna dan
 * menampilkan KATA — misalnya "RED" yang dicetak biru. Yang memberi poin tetap
 * warna yang DISEBUT kata itu, bukan warna tintanya.
 *
 * Kenapa ini menambah kesulitan yang berbeda jenis dari semua level sebelumnya:
 * membaca kata itu otomatis dan lebih cepat daripada menamai warna, jadi kedua
 * proses itu berlomba di kepala dan yang salah harus ditahan secara sadar. Itu
 * bukan soal refleks tangan lagi — semua level sebelum ini menguji kecepatan
 * mata dan jempol, yang ini menguji kemampuan menahan jawaban yang lebih cepat
 * tapi salah.
 *
 * PENTING: aturan permainan tidak berubah sedikit pun. `board.targetColors`
 * tetap satu-satunya sumber kebenaran soal warna mana yang memberi poin, dan
 * `applyClick` tidak tahu Stroop itu ada. Yang berubah hanya CARA target itu
 * disampaikan ke pemain. Itu sebabnya mode ini aman untuk multiplayer papan
 * rebutan tanpa satu pun perubahan di resolusi klik.
 */
export function isStroopActive(level: number): boolean {
  return level >= STROOP_FIRST_LEVEL;
}

/**
 * Warna tinta untuk setiap kata target.
 *
 * Dijamin TIDAK PERNAH sama dengan warna yang disebut katanya — kalau sama,
 * konfliknya hilang dan indikatornya kembali jadi petunjuk biasa. Warna target
 * yang lain juga dikecualikan: "RED" bertinta hijau saat hijau juga sedang
 * menjadi target akan membuat pemain benar dua kali dengan alasan yang salah,
 * dan tidak mungkin tahu mana yang ia baca.
 *
 * Deterministik dari `seed` supaya semua pemain di satu room melihat pengecoh
 * yang sama. Kalau tintanya diacak per client, dua orang mengerjakan soal yang
 * berbeda sambil memperebutkan papan yang sama.
 */
export function stroopInkFor(targetColors: readonly Color[], seed: number): readonly Color[] {
  const decoys = ALL_COLORS.filter((color) => !targetColors.includes(color));
  // Tidak mungkin kosong dengan 6 warna dan maksimal 2 target, tapi kalau
  // konstanta itu berubah drastis nanti, lebih baik tintanya sama dengan
  // warnanya daripada melempar di tengah game loop.
  if (decoys.length === 0) return targetColors;

  let state = seed;
  return targetColors.map((_, index) => {
    // Index ikut masuk supaya dua kata pada satu periode tidak selalu
    // mendapat tinta yang sama.
    const rolled = nextRandom(state + index * 7919);
    state = rolled.state;
    return decoys[Math.floor(rolled.value * decoys.length) % decoys.length]!;
  });
}
