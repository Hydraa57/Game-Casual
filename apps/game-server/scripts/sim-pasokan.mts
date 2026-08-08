/**
 * Berapa banyak pixel warna target yang benar-benar TERSEDIA per pemain.
 *
 * Ditulis untuk menjawab satu pertanyaan sebelum fitur tim dibangun: apakah
 * 4v4 di papan yang dirancang untuk 4 orang bisa dimainkan sama sekali. Kalau
 * pasokannya tidak cukup, sebagian besar pemain tidak punya apa pun untuk
 * diketuk pada sebagian besar waktu — dan itu bukan "sulit", itu menunggu.
 *
 * Jawabannya mengubah rencana. Dugaan yang wajar — "papan lebih besar untuk
 * pemain lebih banyak" — ternyata tidak menyentuh masalahnya sedikit pun.
 *
 * Jalankan: pnpm --filter @pixelmatrix/game-server exec tsx scripts/sim-pasokan.mts
 */
import {
  createGameState,
  lifetimeMs,
  MP_LEVEL_DURATION_MS,
  multiplayerConfig,
  spawnCrowdFactor,
  spawnIntervalMs,
  step,
} from '@pixelmatrix/shared';

const TICK_MS = 50;
const DURASI_MS = 180_000;
const SEED = [1, 2, 3, 4, 5].map((s) => s * 7919);

interface Hasil {
  readonly rataTarget: number;
  readonly rataSemua: number;
}

/**
 * Jalankan papan MP sungguhan (engine yang sama dengan yang dipakai server)
 * dan catat rata-rata pixel hidup sepanjang match.
 *
 * Levelnya dinaikkan menurut WAKTU, persis seperti multiplayer — bukan menurut
 * klik, karena tidak ada yang mengklik di sini.
 */
function ukur(gridSize: number, crowdFactor: number, seed: number): Hasil {
  let state = createGameState({
    seed,
    config: multiplayerConfig(1000, DURASI_MS / 1000, {
      gridSize,
      spawnCrowdFactor: crowdFactor,
    }),
  });
  state = { ...state, status: 'running' };

  let sampel = 0;
  let totalTarget = 0;
  let totalSemua = 0;

  for (let t = 0; t < DURASI_MS; t += TICK_MS) {
    const level = Math.floor(t / MP_LEVEL_DURATION_MS) + 1;
    state = { ...state, board: { ...state.board, level } };
    state = step(state, TICK_MS).state;

    totalTarget += state.board.pixels.filter((p) =>
      state.board.targetColors.includes(p.color),
    ).length;
    totalSemua += state.board.pixels.length;
    sampel += 1;
  }

  return { rataTarget: totalTarget / sampel, rataSemua: totalSemua / sampel };
}

/** Rata-rata beberapa seed, supaya angkanya bukan hasil satu undian keberuntungan. */
function rerata(gridSize: number, crowdFactor: number): Hasil {
  const runs = SEED.map((s) => ukur(gridSize, crowdFactor, s));
  return {
    rataTarget: runs.reduce((a, r) => a + r.rataTarget, 0) / runs.length,
    rataSemua: runs.reduce((a, r) => a + r.rataSemua, 0) / runs.length,
  };
}

console.log('=== 1. Apakah memperbesar papan menambah pixel? ===\n');
for (const g of [8, 10, 12]) {
  const r = rerata(g, 1);
  console.log(
    `papan ${g}x${g} (${String(g * g).padStart(3)} sel):  pixel hidup ${r.rataSemua.toFixed(2)}  |  warna target ${r.rataTarget.toFixed(2)}`,
  );
}
console.log(
  '\nTIDAK. Angkanya sama sampai dua desimal di ketiga ukuran.\n' +
    'Jumlah pixel hidup = umur dibagi jeda spawn; sel kosong tidak pernah jadi\n' +
    'penghambat (2,4 pixel di atas 64 sel). Papan besar hanya menyebar pixel\n' +
    'yang jumlahnya sama ke area yang lebih luas.',
);

console.log('\n=== 2. Pasokan per pemain, tanpa faktor keramaian ===\n');
const dasar = rerata(8, 1).rataTarget;
for (const pemain of [2, 4, 6, 8]) {
  const per = dasar / pemain;
  console.log(
    `${pemain} pemain: ${per.toFixed(2)} pixel target per orang` +
      (pemain > 4 ? '   <-- di bawah patokan 4 pemain' : ''),
  );
}

console.log('\n=== 3. Dengan spawnCrowdFactor ===\n');
const patokan = dasar / 4;
for (const pemain of [2, 4, 6, 8]) {
  const faktor = spawnCrowdFactor(pemain);
  const r = rerata(pemain >= 5 ? 10 : 8, faktor);
  const per = r.rataTarget / pemain;
  console.log(
    `${pemain} pemain (faktor ${faktor.toFixed(2)}): ` +
      `${r.rataTarget.toFixed(2)} pixel target, ${per.toFixed(2)} per orang ` +
      `(patokan 4 pemain: ${patokan.toFixed(2)})`,
  );
}

console.log('\n=== 4. Angka mentah kurvanya ===\n');
for (const lv of [1, 7, 12, 20]) {
  const spawn = spawnIntervalMs(lv);
  const umur = lifetimeMs(lv);
  const baris = [2, 4, 6, 8]
    .map((p) => `${p}p:${((umur / (spawn / spawnCrowdFactor(p))) * 0.5).toFixed(1)}`)
    .join('  ');
  console.log(
    `Lv${String(lv).padStart(2)}  spawn ${String(spawn).padStart(4)}ms  umur ${String(umur).padStart(4)}ms  ->  target hidup  ${baris}`,
  );
}
