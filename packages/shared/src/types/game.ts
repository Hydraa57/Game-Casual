/** Warna pixel yang mungkin muncul di papan. */
export type Color = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

/** Posisi sel di papan, 0-indexed dari kiri atas. */
export interface Cell {
  readonly row: number;
  readonly col: number;
}

/**
 * Jenis pixel. `normal` mengikuti aturan warna target; sisanya punya aturannya
 * sendiri dan tidak peduli warna target (GDD §4.1).
 */
export type PixelKind =
  /** Pixel biasa — hanya memberi poin kalau warnanya sama dengan warna target. */
  | 'normal'
  /** Jangan ditap: mengurangi nyawa. Aman kalau dibiarkan pudar. */
  | 'bomb'
  /** Bonus poin besar, warna apa pun boleh ditap. */
  | 'gold'
  /** Menambah satu nyawa. */
  | 'life';

/** Pixel yang sedang hidup di papan. */
export interface Pixel {
  readonly id: string;
  readonly cell: Cell;
  readonly color: Color;
  readonly kind: PixelKind;
  /**
   * Waktu spawn dalam ms relatif terhadap awal match (`state.elapsedMs`),
   * BUKAN `Date.now()` — supaya state deterministik dan bisa di-replay di test.
   */
  readonly spawnedAtMs: number;
  readonly lifetimeMs: number;
}

export type GameMode = 'solo' | 'multiplayer';

/**
 * `gameOver` dipakai solo (nyawa habis), `finished` dipakai multiplayer
 * (target skor tercapai atau waktu habis).
 */
export type GameStatus = 'idle' | 'running' | 'paused' | 'gameOver' | 'finished';
