/**
 * Adu bot melawan "pemain lancar" di papan rebutan yang sama.
 *
 * Versi pertama mengukur laju bot SENDIRIAN di papan, dan angkanya menyesatkan:
 * papan hanya memunculkan sekian pixel per detik, jadi begitu bot cukup cepat
 * untuk mengambil hampir semuanya, mempercepatnya lagi tidak mengubah apa pun.
 * `medium` dan `hard` sama-sama menabrak langit-langit itu dan terlihat mirip.
 *
 * Yang sebenarnya ingin diketahui pemain bukan "berapa poin per detik", tapi
 * "bisa nggak saya menang". Itu pertanyaan tentang REBUTAN — dua peserta
 * memperebutkan pixel yang sama — jadi itu yang disimulasikan di sini.
 *
 * Lawan tandingnya adalah profil manusia yang lancar: reaksi 380 ms (waktu
 * reaksi visual sederhana ~250 ms ditambah waktu memutuskan warna), akurasi
 * 0,93. Bukan pemain terbaik, tapi orang yang sudah paham permainannya.
 *
 * Bukan file produksi — dijalankan manual dengan `pnpm exec tsx scripts/sim-bot.mts`.
 */
import {
  applyClick,
  createGameState,
  createScoreState,
  gridSizeFor,
  MP_FREEZE_MS,
  MP_LEVEL_DURATION_MS,
  MP_MAX_KNOCKOUTS,
  MP_STARTING_LIVES,
  multiplayerConfig,
  SERVER_TICK_MS,
  spawnCrowdFactor,
  step,
} from '@pixelmatrix/shared';
import type { BotDifficulty, GameState, ScoreState } from '@pixelmatrix/shared';
import { BotDriver } from '../src/game/BotDriver';

/** Batas waktu match terpanjang yang bisa dipilih host, dan target skor tengah. */
const DURATION_MS = 180_000;
const TARGET_SCORE = 1000;
const RUNS = 60;

/**
 * Dua acuan manusia, bukan satu.
 *
 * Satu acuan membuat penalaan bergantung sepenuhnya pada tebakan tentang
 * "manusia" yang mana. Angkanya diambil dari literatur waktu reaksi: reaksi
 * PILIHAN (membedakan beberapa stimulus lalu merespons) ~380-450 ms, ditambah
 * waktu mengarahkan jari di layar sentuh. Laju ketuk terarah dengan pencarian
 * visual sekitar 2-2,5 per detik.
 */
const REFERENCES = {
  kasual: {
    reactionMs: 700,
    reactionJitterMs: 240,
    tapIntervalMs: 600,
    accuracy: 0.96,
    bombAwareness: 0.9,
    goldPriority: 0.5,
  },
  lancar: {
    reactionMs: 450,
    reactionJitterMs: 160,
    tapIntervalMs: 400,
    accuracy: 0.985,
    bombAwareness: 0.97,
    goldPriority: 0.75,
  },
} as const;

const HUMAN: BotDifficulty = 'human' as BotDifficulty;
const { BOT_PROFILES } = await import('@pixelmatrix/shared');

interface Side {
  score: ScoreState;
  frozenUntilMs: number;
  knockouts: number;
  eliminated: boolean;
  bombHits: number;
}

interface Duel {
  readonly bot: Side;
  readonly human: Side;
  /** Kapan match berhenti, dan kenapa. */
  readonly endedAtMs: number;
  readonly reason: 'targetScore' | 'timeUp' | 'elimination';
}

function duel(difficulty: BotDifficulty, reference: keyof typeof REFERENCES): Duel {
  (BOT_PROFILES as Record<string, unknown>)[HUMAN] = REFERENCES[reference];
  /*
    Config dibangun lewat `multiplayerConfig`, BUKAN ditulis tangan.

    Versi sebelumnya menyusun objeknya sendiri dan — sejak `spawnCrowdFactor`
    ditambahkan ke `GameConfig` — melewatkan field itu. Akibatnya
    `spawnIntervalMs(level) / undefined` menghasilkan NaN, `nextSpawnAtMs` jadi
    NaN, dan papan tidak pernah memunculkan pixel sama sekali. Skripnya tetap
    jalan dan tetap mencetak tabel, cuma seluruh angkanya sampah: skor 3-9 poin
    setelah 180 detik, dan 0% eliminasi.

    Tidak ketahuan karena `tsconfig.json` game-server hanya menyertakan berkas
    di dalam `src` — folder `scripts` tidak pernah di-typecheck.
  */
  let state: GameState = {
    ...createGameState({
      seed: Math.floor(Math.random() * 1e9),
      config: multiplayerConfig(TARGET_SCORE, DURATION_MS / 1000, {
        gridSize: gridSizeFor(2),
        spawnCrowdFactor: spawnCrowdFactor(2),
        // Batas match ditegakkan oleh loop di bawah, bukan oleh engine: skrip
        // ini perlu tahu ALASAN berhentinya, dan engine hanya melaporkan
        // statusnya.
        timeLimitMs: null,
        targetScore: null,
      }),
    }),
    status: 'running',
  };

  const fresh = (): Side => ({
    score: createScoreState(MP_STARTING_LIVES),
    frozenUntilMs: 0,
    knockouts: 0,
    eliminated: false,
    bombHits: 0,
  });
  const sides: Record<'bot' | 'human', Side> = { bot: fresh(), human: fresh() };
  const drivers = {
    bot: new BotDriver('bot', difficulty),
    human: new BotDriver('human', HUMAN),
  };

  while (state.elapsedMs < DURATION_MS) {
    const level = 1 + Math.floor(state.elapsedMs / MP_LEVEL_DURATION_MS);
    if (level !== state.board.level) state = { ...state, board: { ...state.board, level } };
    state = step(state, SERVER_TICK_MS).state;

    // Urutannya diacak tiap tick, persis seperti `Match.driveBots` — kalau
    // tidak, yang pertama diiterasi selalu menang rebutan dan hasilnya bohong.
    const order: ('bot' | 'human')[] = Math.random() < 0.5 ? ['bot', 'human'] : ['human', 'bot'];
    for (const who of order) {
      const side = sides[who];

      // Nyawa, beku, dan eliminasi — aturan yang justru paling menentukan di
      // multiplayer, dan yang tidak dimodelkan versi pertama simulasi ini.
      // Di MP satu klik salah memotong SATU nyawa, jadi profil dengan akurasi
      // 96% pun bisa habis nyawanya berkali-kali dan tereliminasi sebelum
      // match separuh jalan. Tanpa bagian ini, penalaan akurasi menghasilkan
      // bot yang di atas kertas seimbang tapi di permainan sungguhan cuma
      // duduk beku.
      if (side.eliminated) continue;
      if (side.frozenUntilMs > 0) {
        if (state.elapsedMs < side.frozenUntilMs) continue;
        side.frozenUntilMs = 0;
        side.score = { ...side.score, lives: MP_STARTING_LIVES, combo: 0 };
      }

      const pixelId = drivers[who].step(
        state.board.pixels,
        state.board.targetColors,
        state.elapsedMs,
      );
      if (pixelId === null) continue;

      const kindBefore = state.board.pixels.find((px) => px.id === pixelId)?.kind;
      const result = applyClick({ ...state, score: side.score }, pixelId);
      if (kindBefore === 'bomb') side.bombHits += 1;
      state = { ...state, board: result.state.board };
      side.score = result.state.score;

      if ((side.score.lives ?? 1) <= 0) {
        side.knockouts += 1;
        if (side.knockouts >= MP_MAX_KNOCKOUTS) side.eliminated = true;
        else side.frozenUntilMs = state.elapsedMs + MP_FREEZE_MS;
      }

      // Match SUNGGUHAN berhenti di sini, bukan berjalan sampai waktu habis.
      // Versi sebelumnya membiarkannya terus dan melaporkan "100% tereliminasi"
      // untuk semua tingkat — angka yang benar secara harfiah tapi tidak
      // menjawab apa pun, karena yang menentukan hasil adalah SIAPA yang habis
      // lebih dulu.
      if (side.eliminated) {
        return {
          bot: sides.bot,
          human: sides.human,
          endedAtMs: state.elapsedMs,
          reason: 'elimination',
        };
      }
      if (side.score.score >= TARGET_SCORE) {
        return {
          bot: sides.bot,
          human: sides.human,
          endedAtMs: state.elapsedMs,
          reason: 'targetScore',
        };
      }
    }
  }

  return { bot: sides.bot, human: sides.human, endedAtMs: state.elapsedMs, reason: 'timeUp' };
}

for (const reference of ['kasual', 'lancar'] as const) {
  const profile = REFERENCES[reference];
  console.log(
    `\nlawan: pemain ${reference} (reaksi ${profile.reactionMs} ms, ketuk tiap ${profile.tapIntervalMs} ms, akurasi ${(profile.accuracy * 100).toFixed(0)}%)`,
  );
  console.log('tingkat  bot menang  skor bot  skor manusia  bot habis  lama  alasan');
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const runs = Array.from({ length: RUNS }, () => duel(difficulty, reference));
    // Yang bertahan selalu di atas yang tereliminasi — aturan `Match.ranking`.
    const wins = runs.filter(
      (r) =>
        (!r.bot.eliminated && r.human.eliminated) ||
        (r.bot.eliminated === r.human.eliminated && r.bot.score.score > r.human.score.score),
    ).length;
    const avg = (pick: (r: Duel) => number) => runs.reduce((s, r) => s + pick(r), 0) / runs.length;
    const eliminated = runs.filter((r) => r.bot.eliminated).length;
    const byReason = (reason: Duel['reason']) =>
      `${((runs.filter((r) => r.reason === reason).length / RUNS) * 100).toFixed(0)}%`;
    console.log(
      `${difficulty.padEnd(8)} ${`${((wins / RUNS) * 100).toFixed(0)}%`.padStart(10)}  ${avg(
        (r) => r.bot.score.score,
      )
        .toFixed(0)
        .padStart(8)}  ${avg((r) => r.human.score.score)
        .toFixed(0)
        .padStart(
          12,
        )}  ${`${((eliminated / RUNS) * 100).toFixed(0)}%`.padStart(9)}  ${`${(avg((r) => r.endedAtMs) / 1000).toFixed(0)}s`.padStart(5)}  habis ${byReason('elimination')} / target ${byReason('targetScore')} / waktu ${byReason('timeUp')}`,
    );
  }
}
