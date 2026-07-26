import { COLOR_HEX } from '@pixelpulse/shared';
import type { Color } from '@pixelpulse/shared';

/** Warna papan dalam bentuk string CSS, untuk HUD di DOM. */
export function cssColor(color: Color): string {
  return `#${COLOR_HEX[color].toString(16).padStart(6, '0')}`;
}

export const BOARD_BACKGROUND = 0x1c1b2a;
export const GRID_LINE = 0x2a2840;
