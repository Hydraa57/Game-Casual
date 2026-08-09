/**
 * Berapa lama match multiplayer BERJALAN, dan level berapa yang sempat dicapai.
 *
 * Ditulis untuk menjawab satu keluhan: "match-nya cepat selesai, jadi tidak
 * pernah ketemu level tinggi". Itu bukan soal selera — di multiplayer level
 * naik menurut WAKTU (MP_LEVEL_DURATION_MS), jadi target skor adalah satu-
 * satunya tuas yang menentukan seberapa jauh kurva kesulitan sempat berjalan.
 * Menambah pilihan target berarti menambah level yang bisa dijumpai, dan
 * hubungan itu bisa dihitung — tidak perlu ditebak.
 *
 * Yang disimulasikan adalah engine yang SAMA PERSIS dengan server: satu papan
 * diperebutkan, urutan giliran diacak tiap tick (kalau tidak, yang pertama
 * diiterasi selalu memenangkan rebutan dan hasilnya bohong), ukuran papan dan
 * pasokan pixel mengikuti jumlah pemain seperti `Match`, plus aturan nyawa,
 * beku, dan eliminasi.
 *
 * Yang TIDAK disimulasikan: latensi jaringan dan mode beregu. Keduanya
 * memperlambat, jadi angka di sini adalah batas CEPAT — match sungguhan sama
 * cepat atau lebih lambat, tidak pernah lebih cepat. Untuk memilih target skor
 * itu arah yang aman: kalau target ini saja sudah memberi level yang cukup
 * tinggi pada laju tercepat, ia tidak akan gagal pada laju yang lebih lambat.
 *
 * Jalankan: pnpm --filter @pixelmatrix/game-server exec tsx scripts/sim-durasi.mts
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
import type { BotDifficulty, BotProfile, GameState, ScoreState } from '@pixelmatrix/shared';
import { BotDriver } from '../src/game/BotDriver';

/**
 * Acuan pemain untuk simulasi ini: manusia yang sudah lancar.
 *
 * Sengaja yang lancar, bukan yang kasual. Yang menentukan kapan match berakhir
 * adalah pemain TERDEPAN, bukan rata-rata — jadi memakai profil kasual akan
 * melaporkan match yang lebih panjang daripada yang sebenarnya terjadi begitu
 * ada satu orang yang jago di room.
 */
const LANCAR: BotProfile = {
  reactionMs: 450,
  reactionJitterMs: 160,
  tapIntervalMs: 400,
  accuracy: 0.985,
  bombAwareness: 0.97,
  goldPriority: 0.75,
};

const { BOT_PROFILES } = await import('@pixelmatrix/shared');
const LANCAR_ID = 'lancar' as BotDifficulty;
(BOT_PROFILES as Record<string, BotProfile>)[LANCAR_ID] = LANCAR;

/** Jauh lebih panjang dari batas waktu mana pun, supaya batasnya tidak ikut mengukur. */
const CEILING_MS = 900_000;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => s * 7919);

const TARGETS = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
const PLAYER_COUNTS = [2, 4, 8];

interface Side {
  score: ScoreState;
  frozenUntilMs: number;
  knockouts: number;
  eliminated: boolean;
}

type Alasan = 'targetScore' | 'elimination' | 'ceiling';

interface Akhir {
  readonly ms: number;
  readonly alasan: Alasan;
  /** Skor pemain terdepan saat match berhenti. */
  readonly skorTerdepan: number;
}

/**
 * Jalankan satu match sampai BERHENTI, dengan aturan berhenti yang sama persis
 * dengan server: ada yang menyentuh target, ATAU tinggal satu pihak yang masih
 * aktif (`shouldEndByElimination`).
 *
 * Versi pertama skrip ini cuma mencari "kapan target tersentuh" dan menganggap
 * sisanya tidak menarik. Itu menyembunyikan justru temuan yang paling penting:
 * di target tinggi, match berakhir karena ELIMINASI jauh sebelum targetnya
 * tersentuh — jadi menaikkan target tidak otomatis memperpanjang permainan.
 */
function jalankan(playerCount: number, target: number, seed: number): Akhir {
  let state: GameState = {
    ...createGameState({
      seed,
      config: multiplayerConfig(target, CEILING_MS / 1000, {
        gridSize: gridSizeFor(playerCount),
        spawnCrowdFactor: spawnCrowdFactor(playerCount),
      }),
    }),
    status: 'running',
  };

  const sides: Side[] = Array.from({ length: playerCount }, () => ({
    score: createScoreState(MP_STARTING_LIVES),
    frozenUntilMs: 0,
    knockouts: 0,
    eliminated: false,
  }));
  const drivers = sides.map((_, i) => new BotDriver(`p${i}`, LANCAR_ID));

  while (state.elapsedMs < CEILING_MS) {
    const level = 1 + Math.floor(state.elapsedMs / MP_LEVEL_DURATION_MS);
    if (level !== state.board.level) state = { ...state, board: { ...state.board, level } };
    state = step(state, SERVER_TICK_MS).state;

    // Urutan diacak tiap tick, persis seperti `Match.driveBots`.
    const order = sides.map((_, i) => i).sort(() => Math.random() - 0.5);
    for (const i of order) {
      const side = sides[i]!;
      if (side.eliminated) continue;
      if (side.frozenUntilMs > 0) {
        if (state.elapsedMs < side.frozenUntilMs) continue;
        side.frozenUntilMs = 0;
        side.score = { ...side.score, lives: MP_STARTING_LIVES, combo: 0 };
      }

      const pixelId = drivers[i]!.step(
        state.board.pixels,
        state.board.targetColors,
        state.elapsedMs,
      );
      if (pixelId === null) continue;

      const result = applyClick({ ...state, score: side.score }, pixelId);
      state = { ...state, board: result.state.board };
      side.score = result.state.score;

      if ((side.score.lives ?? 1) <= 0) {
        side.knockouts += 1;
        if (side.knockouts >= MP_MAX_KNOCKOUTS) side.eliminated = true;
        else side.frozenUntilMs = state.elapsedMs + MP_FREEZE_MS;
      }
      if (side.score.score >= target) {
        return { ms: state.elapsedMs, alasan: 'targetScore', skorTerdepan: side.score.score };
      }
    }

    // `shouldEndByElimination`: tinggal satu pihak aktif, bukan nol.
    if (sides.filter((s) => !s.eliminated).length <= 1) {
      return {
        ms: state.elapsedMs,
        alasan: 'elimination',
        skorTerdepan: Math.max(...sides.map((s) => s.score.score)),
      };
    }
  }
  return {
    ms: CEILING_MS,
    alasan: 'ceiling',
    skorTerdepan: Math.max(...sides.map((s) => s.score.score)),
  };
}

const median = (values: number[]): number => {
  const urut = [...values].sort((a, b) => a - b);
  return urut[Math.floor(urut.length / 2)]!;
};

/** Level yang sedang berjalan pada detik ke-t, aturan yang sama dengan `Match`. */
const levelAt = (ms: number): number => 1 + Math.floor(ms / MP_LEVEL_DURATION_MS);

console.log(
  `Laju pemain LANCAR, papan diperebutkan, ${SEEDS.length} seed, nilai median.\n` +
    `Level naik tiap ${MP_LEVEL_DURATION_MS / 1000} dtk, jadi lama match ADALAH kurva kesulitannya.\n` +
    `"target%" = berapa persen match yang benar-benar berakhir di garis finis;\n` +
    `sisanya berakhir karena eliminasi (${MP_MAX_KNOCKOUTS} KO), yang TIDAK bisa dilewati\n` +
    `dengan menaikkan target skor.\n`,
);
console.log('target  ' + PLAYER_COUNTS.map((n) => `${n} pemain`.padStart(22)).join(''));

for (const target of TARGETS) {
  const kolom: string[] = [];
  for (const playerCount of PLAYER_COUNTS) {
    const hasil = SEEDS.map((seed) => jalankan(playerCount, target, seed));
    const ms = median(hasil.map((h) => h.ms));
    const terlama = Math.max(...hasil.map((h) => h.ms));
    const persenTarget =
      (hasil.filter((h) => h.alasan === 'targetScore').length / hasil.length) * 100;
    kolom.push(
      `${(ms / 1000).toFixed(0)}s Lv${levelAt(ms)} ≤${(terlama / 1000).toFixed(0)}s ${persenTarget.toFixed(0)}%`.padStart(
        22,
      ),
    );
  }
  console.log(`${String(target).padStart(6)}  ${kolom.join('')}`);
}

console.log(
  '\nKolom: median lama match, level saat itu, seed terlama, dan persen match yang\n' +
    'selesai karena target (bukan eliminasi). Batas waktu room harus di ATAS "seed\n' +
    'terlama", kalau tidak sebagian match habis waktu tepat sebelum garis finis.',
);
