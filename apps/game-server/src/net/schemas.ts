import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
} from '@pixelmatrix/shared';
import { z } from 'zod';

/**
 * Validasi setiap payload yang masuk dari client.
 *
 * Server otoritatif berarti tidak ada satu pun nilai dari client yang dipakai
 * apa adanya — termasuk bentuk objeknya. Tanpa lapisan ini, satu payload cacat
 * bisa melempar exception di dalam game loop dan mematikan match orang lain.
 */

const nickname = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH)
  .max(NICKNAME_MAX_LENGTH)
  // Tanpa karakter kontrol supaya nickname tidak bisa merusak tampilan HUD.
  .regex(/^[\p{L}\p{N} _.-]+$/u);

const settings = z
  .object({
    maxPlayers: z.number().int().min(MIN_PLAYERS_TO_START).max(MAX_PLAYERS_LIMIT).optional(),
    targetScore: z.literal(ALLOWED_TARGET_SCORES).optional(),
    timeLimitSec: z.literal(ALLOWED_TIME_LIMITS_SEC).optional(),
  })
  .optional();

export const createRoomSchema = z.object({ nickname, settings });

export const joinRoomSchema = z.object({
  // Panjangnya lebih longgar dari 6 karena kode dinormalisasi dulu (spasi/tanda
  // hubung dibuang) sebelum diuji sah atau tidak.
  roomCode: z.string().trim().min(1).max(24),
  nickname,
});

export const updateSettingsSchema = z.object({
  settings: z.object({
    maxPlayers: z.number().int().min(MIN_PLAYERS_TO_START).max(MAX_PLAYERS_LIMIT).optional(),
    targetScore: z.literal(ALLOWED_TARGET_SCORES).optional(),
    timeLimitSec: z.literal(ALLOWED_TIME_LIMITS_SEC).optional(),
  }),
});

export const readySchema = z.object({ ready: z.boolean() });

export const clickSchema = z.object({
  pixelId: z.string().min(1).max(32),
  clientTs: z.number().finite(),
});
