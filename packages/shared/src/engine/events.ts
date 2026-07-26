import type { Color, Pixel } from '../types/index';

export type ClickRejectReason =
  /** Warna pixel tidak sama dengan warna target — satu-satunya alasan yang berpenalti. */
  | 'wrongColor'
  /** Pixel sudah lewat umurnya saat klik diproses. */
  | 'tooLate'
  /** Pixel tidak ada (sudah diklaim / sudah pudar) — biasanya tap ganda. */
  | 'notFound'
  /** Terlalu banyak klik per detik (multiplayer, anti-spam). */
  | 'rateLimited'
  /** Game sedang pause / sudah selesai. */
  | 'notRunning';

/**
 * Event hasil `step()` dan `applyClick()`.
 *
 * Namanya sengaja sama dengan event Socket.IO di ARCHITECTURE.md §3, supaya
 * game server multiplayer nanti bisa meneruskan event ini langsung ke client
 * tanpa lapisan penerjemah.
 */
export type GameEvent =
  | { readonly type: 'pixelSpawned'; readonly pixel: Pixel }
  | {
      readonly type: 'pixelExpired';
      readonly pixelId: string;
      /** True kalau pixel ini warna target — berarti pemain melewatkannya. */
      readonly wasTarget: boolean;
    }
  | {
      readonly type: 'targetChanged';
      readonly color: Color;
      readonly previousColor: Color;
    }
  | {
      readonly type: 'pixelClaimed';
      readonly pixelId: string;
      readonly cell: Pixel['cell'];
      readonly points: number;
      readonly combo: number;
      readonly multiplier: number;
      readonly score: number;
    }
  | {
      readonly type: 'clickRejected';
      readonly pixelId: string;
      readonly reason: ClickRejectReason;
      readonly penalty: number;
      readonly livesLeft: number | null;
    }
  | { readonly type: 'levelUp'; readonly level: number }
  | {
      readonly type: 'checkpointReached';
      readonly level: number;
      readonly score: number;
    }
  | { readonly type: 'comboBroken'; readonly previousCombo: number }
  | { readonly type: 'gameOver'; readonly score: number }
  | { readonly type: 'targetScoreReached'; readonly score: number };
