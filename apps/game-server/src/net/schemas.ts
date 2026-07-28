import {
  ALLOWED_TARGET_SCORES,
  BOT_DIFFICULTIES,
  CHAT_MAX_LENGTH,
  AVATAR_IDS,
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

/**
 * Avatar dibatasi ke daftar yang dikenal, bukan string bebas. Kalau tidak,
 * client bisa mengirim teks apa pun dan teks itu akan dicap di papan pemain
 * lain — jalan pintas paling gampang untuk merusak tampilan orang.
 */
const avatar = z.enum(AVATAR_IDS);

const settings = z
  .object({
    maxPlayers: z.number().int().min(MIN_PLAYERS_TO_START).max(MAX_PLAYERS_LIMIT).optional(),
    targetScore: z.literal(ALLOWED_TARGET_SCORES).optional(),
    timeLimitSec: z.literal(ALLOWED_TIME_LIMITS_SEC).optional(),
  })
  .optional();

/** Token identitas dari web. Panjangnya dibatasi supaya payload raksasa tidak
 *  ikut diproses; isinya tetap diverifikasi tanda tangannya. */
const playerToken = z.string().max(2048).optional();

export const createRoomSchema = z.object({ nickname, avatar, settings, playerToken });

export const joinRoomSchema = z.object({
  // Panjangnya lebih longgar dari 6 karena kode dinormalisasi dulu (spasi/tanda
  // hubung dibuang) sebelum diuji sah atau tidak.
  roomCode: z.string().trim().min(1).max(24),
  nickname,
  avatar,
  playerToken,
});

export const updateSettingsSchema = z.object({
  settings: z.object({
    maxPlayers: z.number().int().min(MIN_PLAYERS_TO_START).max(MAX_PLAYERS_LIMIT).optional(),
    targetScore: z.literal(ALLOWED_TARGET_SCORES).optional(),
    timeLimitSec: z.literal(ALLOWED_TIME_LIMITS_SEC).optional(),
  }),
});

export const readySchema = z.object({ ready: z.boolean() });

/**
 * Kunci sesi untuk mengklaim ulang kursi.
 *
 * Panjangnya dibatasi ketat: kunci yang sah selalu 48 karakter heksadesimal
 * (24 byte acak), jadi tidak ada alasan memproses string yang lebih panjang.
 * Bentuknya juga diperiksa supaya percobaan menebak dengan payload aneh
 * berhenti di sini, bukan di pencarian peta.
 */
export const reconnectSchema = z.object({
  sessionKey: z
    .string()
    .length(48)
    .regex(/^[0-9a-f]+$/),
});

/**
 * Pesan chat.
 *
 * Karakter kontrol dibuang, bukan ditolak: `\n` dan `\t` yang ikut ter-paste
 * dari tempat lain adalah kecelakaan yang wajar, dan menolak seluruh pesan
 * karenanya lebih menjengkelkan daripada membersihkannya. Yang TIDAK boleh
 * lolos adalah efeknya di layar orang lain — satu pesan berisi puluhan baris
 * baru bisa mendorong seluruh lobby keluar dari viewport.
 *
 * `trim` lalu `min(1)` menutup pesan yang isinya cuma spasi.
 */
export const chatSchema = z.object({
  text: z
    .string()
    .max(CHAT_MAX_LENGTH)
    // eslint-disable-next-line no-control-regex -- karakter kontrol memang yang disasar di sini
    .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim())
    .refine((value) => value.length >= 1),
});

export const addBotSchema = z.object({ difficulty: z.enum(BOT_DIFFICULTIES) });

/** Id bot selalu dibuat server (`bot-<uuid>`); panjangnya dibatasi seperlunya. */
export const removeBotSchema = z.object({ botId: z.string().min(1).max(64) });

export const clickSchema = z.object({
  pixelId: z.string().min(1).max(32),
  clientTs: z.number().finite(),
});
