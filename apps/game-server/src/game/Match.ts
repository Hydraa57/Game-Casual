import {
  applyClick,
  chaosModifierFor,
  COUNTDOWN_SECONDS,
  createGameState,
  createScoreState,
  GRID_SIZE,
  isTargetChangeImminent,
  MP_LEVEL_DURATION_MS,
  MP_TICK_BROADCAST_MS,
  SERVER_TICK_MS,
  step,
  SUDDEN_DEATH_LIFETIME_MS,
} from '@pixelmatrix/shared';
import type {
  GameConfig,
  GameEvent,
  GameState,
  MatchResultEntry,
  Pixel,
  ScoreState,
} from '@pixelmatrix/shared';
import type { Room } from '../rooms/Room';
import type { GameServer } from '../net/handlers';
import { RateLimiter } from './RateLimiter';

type MatchStatus = 'countdown' | 'running' | 'suddenDeath' | 'ended';

interface PlayerStats {
  nickname: string;
  score: ScoreState;
}

/**
 * Satu match papan-rebutan.
 *
 * Papannya SATU dan dimiliki server; skor dipegang per pemain. Klik pertama yang
 * sampai ke sini mengklaim pixel — klik pemain lain sesudahnya menemukan pixel
 * yang sudah hilang dan ditolak sebagai `notFound` tanpa penalti (GDD §5).
 *
 * Client tidak pernah mengirim skor: ia hanya mengirim `pixelId`, dan seluruh
 * perhitungan terjadi di sini memakai engine yang sama dengan solo mode.
 */
export class Match {
  private board: GameState;
  private readonly players = new Map<string, PlayerStats>();
  private readonly limiter = new RateLimiter();
  private status: MatchStatus = 'countdown';
  private timer: NodeJS.Timeout | null = null;
  private lastTickAt = 0;
  private lastBroadcastAt = 0;
  private countdownLeft = COUNTDOWN_SECONDS;
  private suddenDeathSeq = 0;

  constructor(
    private readonly room: Room,
    private readonly io: GameServer,
    private readonly onFinished: (room: Room) => void,
  ) {
    this.board = createGameState({ seed: Date.now(), config: boardConfig() });
    for (const player of room.allPlayers()) {
      this.players.set(player.id, {
        nickname: player.nickname,
        score: createScoreState(null),
      });
    }
  }

  get targetScore(): number {
    return this.room.currentSettings.targetScore;
  }

  get timeLimitMs(): number {
    return this.room.currentSettings.timeLimitSec * 1000;
  }

  /** Skor terkini per pemain, untuk disisipkan ke `room:state`. */
  scores(): ReadonlyMap<string, { score: number; combo: number }> {
    const out = new Map<string, { score: number; combo: number }>();
    for (const [id, player] of this.players) {
      out.set(id, { score: player.score.score, combo: player.score.combo });
    }
    return out;
  }

  start(): void {
    this.room.setStatus('countdown');
    this.broadcastRoomState();
    this.runCountdown();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Pemain keluar/terputus: skornya dibekukan tapi tetap masuk hasil akhir. */
  removePlayer(playerId: string): void {
    this.limiter.forget(playerId);
    if (!this.players.has(playerId)) return;

    // Kalau tinggal satu (atau nol) pemain tersisa, match tidak ada artinya lagi.
    const remaining = this.room.allPlayers().filter((player) => player.id !== playerId);
    if (remaining.length < 2 && this.status !== 'ended') {
      this.finish('timeUp');
    }
  }

  handleClick(playerId: string, pixelId: string): void {
    if (this.status !== 'running' && this.status !== 'suddenDeath') return;

    const player = this.players.get(playerId);
    if (!player) return;

    if (!this.limiter.allow(playerId, Date.now())) {
      this.io.to(playerId).emit('game:clickRejected', {
        pixelId,
        reason: 'rateLimited',
        penalty: 0,
      });
      return;
    }

    // Engine dipanggil dengan papan bersama + skor pemain ini. Karena `applyClick`
    // pure, papan hasilnya (dengan pixel yang sudah dihapus) langsung jadi papan
    // bersama yang baru — dan itulah yang membuat "siapa cepat dia dapat" bekerja
    // tanpa penguncian apa pun.
    const carrier: GameState = { ...this.board, score: player.score };
    const result = applyClick(carrier, pixelId);

    this.board = { ...this.board, board: result.state.board };
    player.score = result.state.score;

    this.forwardClickEvents(playerId, result.events);

    if (this.status === 'suddenDeath' && result.claimed) {
      this.finish('suddenDeath');
      return;
    }
    if (this.status === 'running' && player.score.score >= this.targetScore) {
      this.finish('targetScore');
    }
  }

  // ------------------------------------------------------------------ internal

  private runCountdown(): void {
    this.io.to(this.room.code).emit('game:countdown', { seconds: this.countdownLeft });

    this.timer = setInterval(() => {
      this.countdownLeft -= 1;
      if (this.countdownLeft > 0) {
        this.io.to(this.room.code).emit('game:countdown', { seconds: this.countdownLeft });
        return;
      }
      this.stop();
      this.beginPlay();
    }, 1000);
  }

  private beginPlay(): void {
    this.status = 'running';
    this.room.setStatus('playing');
    this.board = { ...this.board, status: 'running' };
    this.lastTickAt = Date.now();
    this.lastBroadcastAt = 0;

    this.io.to(this.room.code).emit('game:started', {
      targetColors: this.board.board.targetColors,
      targetScore: this.targetScore,
      timeLimitSec: this.room.currentSettings.timeLimitSec,
      level: this.board.board.level,
    });
    this.broadcastRoomState();

    this.timer = setInterval(() => this.tick(), SERVER_TICK_MS);
  }

  private tick(): void {
    const now = Date.now();
    const delta = now - this.lastTickAt;
    this.lastTickAt = now;

    // Level naik menurut waktu, bukan klik — lihat MP_LEVEL_DURATION_MS.
    const level = 1 + Math.floor(this.board.elapsedMs / MP_LEVEL_DURATION_MS);
    if (level !== this.board.board.level && this.status === 'running') {
      this.board = { ...this.board, board: { ...this.board.board, level } };
    }

    const result = step(this.board, delta);
    this.board = result.state;
    this.forwardBoardEvents(result.events);

    if (this.status === 'running' && this.board.elapsedMs >= this.timeLimitMs) {
      this.onTimeUp();
      return;
    }
    if (this.status === 'suddenDeath') {
      this.keepSuddenDeathPixelAlive();
    }

    if (now - this.lastBroadcastAt >= MP_TICK_BROADCAST_MS) {
      this.lastBroadcastAt = now;
      this.broadcastTick();
    }
  }

  private onTimeUp(): void {
    if (!tiedAtTop(this.ranking().map((entry) => entry.score))) {
      this.finish('timeUp');
      return;
    }

    // Seri di puncak → sudden death: papan dikosongkan, satu pixel warna target.
    this.status = 'suddenDeath';
    this.board = {
      ...this.board,
      board: { ...this.board.board, pixels: [], nextSpawnAtMs: Number.MAX_SAFE_INTEGER },
    };
    this.io.to(this.room.code).emit('game:suddenDeath');
    this.spawnSuddenDeathPixel();
  }

  private keepSuddenDeathPixelAlive(): void {
    if (this.board.board.pixels.length === 0) this.spawnSuddenDeathPixel();
  }

  private spawnSuddenDeathPixel(): void {
    const color = this.board.board.targetColors[0]!;
    const cell = {
      row: Math.floor(Math.random() * GRID_SIZE),
      col: Math.floor(Math.random() * GRID_SIZE),
    };
    this.suddenDeathSeq += 1;

    const pixel: Pixel = {
      id: `sd${this.suddenDeathSeq}`,
      cell,
      color,
      kind: 'normal',
      spawnedAtMs: this.board.elapsedMs,
      lifetimeMs: SUDDEN_DEATH_LIFETIME_MS,
    };

    this.board = {
      ...this.board,
      board: { ...this.board.board, pixels: [pixel] },
    };
    this.io.to(this.room.code).emit('game:pixelSpawned', { pixel });
  }

  private forwardBoardEvents(events: readonly GameEvent[]): void {
    const code = this.room.code;
    let missedTarget = false;

    for (const event of events) {
      switch (event.type) {
        case 'pixelSpawned':
          this.io.to(code).emit('game:pixelSpawned', { pixel: event.pixel });
          break;
        case 'pixelExpired':
          if (event.wasTarget) missedTarget = true;
          this.io.to(code).emit('game:pixelExpired', { pixelId: event.pixelId });
          break;
        case 'targetChanged':
          this.io.to(code).emit('game:targetChanged', {
            colors: event.colors,
            previousColors: event.previousColors,
          });
          break;
        case 'boardShuffled':
          this.io.to(code).emit('game:boardShuffled', { pixels: this.board.board.pixels });
          break;
        default:
          break;
      }
    }

    // Pixel warna target yang lewat tanpa diklaim siapa pun memutus combo SEMUA
    // pemain — tidak ada yang berhasil mengambilnya.
    if (missedTarget) {
      for (const player of this.players.values()) {
        if (player.score.combo > 0) player.score = { ...player.score, combo: 0 };
      }
    }
  }

  private forwardClickEvents(playerId: string, events: readonly GameEvent[]): void {
    const code = this.room.code;

    for (const event of events) {
      switch (event.type) {
        case 'pixelClaimed':
          this.io.to(code).emit('game:pixelClaimed', {
            pixelId: event.pixelId,
            cell: event.cell,
            byPlayerId: playerId,
            points: event.points,
            combo: event.combo,
            score: event.score,
          });
          break;

        case 'clickRejected':
          // Hanya dikirim ke pengirimnya: pemain lain tidak perlu tahu, dan ini
          // yang membuat kalah cepat merebut pixel tidak terasa seperti hukuman.
          this.io.to(playerId).emit('game:clickRejected', {
            pixelId: event.pixelId,
            reason: event.reason === 'rateLimited' ? 'rateLimited' : event.reason,
            penalty: event.penalty,
          });
          break;

        case 'bombHit':
          this.io.to(code).emit('game:bombHit', {
            pixelId: event.pixelId,
            byPlayerId: playerId,
            scorePenalty: event.scorePenalty,
          });
          break;

        default:
          break;
      }
    }
  }

  private broadcastTick(): void {
    this.io.to(this.room.code).emit('game:tick', {
      remainingMs: Math.max(0, this.timeLimitMs - this.board.elapsedMs),
      level: this.board.board.level,
      chaos: chaosModifierFor(this.board.board.chaosSeed, this.board.board.level),
      targetColors: this.board.board.targetColors,
      // Saat sudden death warna tidak berganti lagi, jadi peringatannya
      // dimatikan supaya tidak berkedip sia-sia di momen paling menegangkan.
      targetImminent: this.status === 'running' && isTargetChangeImminent(this.board),
      scoreboard: [...this.players.entries()].map(([id, player]) => ({
        playerId: id,
        nickname: player.nickname,
        score: player.score.score,
        combo: player.score.combo,
        connected: this.room.has(id),
      })),
    });
  }

  private broadcastRoomState(): void {
    this.io.to(this.room.code).emit('room:state', this.room.toState(this.scores()));
  }

  private ranking(): MatchResultEntry[] {
    return [...this.players.entries()]
      .map(([id, player]) => {
        const total = player.score.correctClicks + player.score.wrongClicks;
        return {
          playerId: id,
          nickname: player.nickname,
          score: player.score.score,
          rank: 0,
          accuracy: total === 0 ? 1 : player.score.correctClicks / total,
          bestCombo: player.score.bestCombo,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  private finish(reason: 'targetScore' | 'timeUp' | 'suddenDeath'): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.stop();

    this.io.to(this.room.code).emit('game:ended', { ranking: this.ranking(), reason });

    // Room DITAHAN di `finished`, bukan langsung `waiting`: kalau langsung, client
    // berpindah ke lobby sebelum sempat menampilkan layar hasil. Pemain sendiri
    // yang menutupnya lewat `room:backToLobby`.
    this.room.setStatus('finished');
    this.room.resetReady();
    this.broadcastRoomState();
    this.onFinished(this.room);
  }
}

/**
 * Apakah puncak klasemen seri — satu-satunya syarat sudden death.
 *
 * Seri di posisi bawah tidak memicu apa pun: yang diperebutkan hanya juara.
 * Skor sudah terurut menurun saat masuk ke sini.
 */
export function tiedAtTop(scores: readonly number[]): boolean {
  const top = scores[0];
  if (top === undefined) return false;
  return scores.filter((score) => score === top).length > 1;
}

/**
 * Config papan untuk multiplayer.
 *
 * `timeLimitMs` dan `targetScore` sengaja `null`: kalau engine yang memutuskan
 * akhir match, ia akan menghentikan papan tepat saat waktu habis — padahal
 * sudden death justru harus berjalan melewati batas itu. Match yang memutuskan.
 */
function boardConfig(): GameConfig {
  return {
    mode: 'multiplayer',
    gridSize: GRID_SIZE,
    startingLives: null,
    timeLimitMs: null,
    targetScore: null,
  };
}
