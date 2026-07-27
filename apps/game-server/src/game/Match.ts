import {
  applyClick,
  chaosModifierFor,
  COUNTDOWN_SECONDS,
  createGameState,
  createScoreState,
  GRID_SIZE,
  isTargetChangeImminent,
  MP_FREEZE_MS,
  MP_LEVEL_DURATION_MS,
  MP_MAX_KNOCKOUTS,
  MP_STARTING_LIVES,
  MP_TICK_BROADCAST_MS,
  SERVER_TICK_MS,
  step,
  SUDDEN_DEATH_LIFETIME_MS,
} from '@pixelmatrix/shared';
import type {
  AvatarId,
  GameConfig,
  MatchEndedPayload,
  GameEvent,
  GameState,
  MatchResultEntry,
  Pixel,
  ScoreState,
} from '@pixelmatrix/shared';
import type { Room } from '../rooms/Room';
import type { GameServer } from '../net/handlers';
import { saveMatch } from '../persistence/matchStore';
import {
  hasThawed,
  isEliminatedAfter,
  isFrozen,
  shouldEndByElimination,
  shouldFreeze,
} from './freeze';
import { RateLimiter } from './RateLimiter';

type MatchStatus = 'countdown' | 'running' | 'suddenDeath' | 'ended';

interface PlayerStats {
  nickname: string;
  avatar: AvatarId;
  /** Akun pemilik, atau null untuk guest. */
  userId: string | null;
  score: ScoreState;
  /**
   * Waktu (epoch ms) sampai pemain bisa mengetuk lagi setelah nyawanya habis;
   * 0 berarti tidak beku.
   */
  frozenUntil: number;
  /** Berapa kali nyawanya sudah habis sepanjang match ini. */
  knockouts: number;
  /** Sudah keluar dari permainan; hanya bisa menonton sampai match usai. */
  eliminated: boolean;
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
  private startedAt: Date | null = null;

  constructor(
    private readonly room: Room,
    private readonly io: GameServer,
    private readonly onFinished: (room: Room) => void,
  ) {
    this.board = createGameState({ seed: Date.now(), config: boardConfig() });
    for (const player of room.allPlayers()) {
      this.players.set(player.id, {
        nickname: player.nickname,
        avatar: player.avatar,
        userId: player.userId,
        score: createScoreState(MP_STARTING_LIVES),
        frozenUntil: 0,
        knockouts: 0,
        eliminated: false,
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

    // Pemain yang beku atau tereliminasi: ketukannya diabaikan sepenuhnya,
    // bahkan sebelum rate limiter, supaya menggeprek layar tidak menghabiskan
    // jatah klik untuk saat dia hidup lagi.
    if (player.eliminated || isFrozen(player.frozenUntil, Date.now())) return;

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

    if (shouldFreeze(player.score.lives, player.frozenUntil)) {
      player.knockouts += 1;

      if (isEliminatedAfter(player.knockouts, MP_MAX_KNOCKOUTS)) {
        player.eliminated = true;
        this.io.to(playerId).emit('game:eliminated');
      } else {
        // KO yang belum terakhir hanya membekukan — pemain kembali dengan
        // nyawa penuh, jadi match tetap ramai sampai batas KO tercapai.
        player.frozenUntil = Date.now() + MP_FREEZE_MS;
      }

      // Disiarkan langsung, tidak menunggu tick terjadwal: pemain harus tahu
      // nasibnya dalam milidetik yang sama, bukan sampai 250 ms kemudian.
      this.broadcastTick();

      // "Main berdua, tereliminasi = langsung kalah" tidak butuh kasus khusus:
      // dari berapa pun pemain, match berhenti begitu yang masih bermain
      // tinggal satu.
      if (shouldEndByElimination(this.activePlayerCount())) {
        this.finish('elimination');
        return;
      }
    }

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
    this.startedAt = new Date();
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

    this.reviveThawedPlayers(now);

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

  /** Pemain yang masih boleh bermain — belum tereliminasi dan masih terhubung. */
  private activePlayerCount(): number {
    let count = 0;
    for (const [id, player] of this.players) {
      if (!player.eliminated && this.room.has(id)) count += 1;
    }
    return count;
  }

  /**
   * Kembalikan pemain yang masa bekunya habis, dengan nyawa penuh.
   *
   * Skor dan combo terbaiknya TIDAK direset: yang hilang karena kehabisan nyawa
   * adalah waktu bermain, bukan poin yang sudah diperoleh. Kalau skor ikut
   * hangus, satu bom di detik terakhir bisa menghapus dua menit permainan.
   */
  private reviveThawedPlayers(now: number): void {
    let revived = false;
    for (const player of this.players.values()) {
      if (player.eliminated || !hasThawed(player.frozenUntil, now)) continue;
      player.frozenUntil = 0;
      player.score = { ...player.score, lives: MP_STARTING_LIVES, combo: 0 };
      revived = true;
    }
    if (revived) this.broadcastTick();
  }

  private onTimeUp(): void {
    // Hanya pemain yang masih bermain yang boleh memicu sudden death. Pemain
    // tereliminasi tidak bisa mengetuk apa pun, jadi seri dengannya akan
    // membuat match menggantung selamanya.
    const active = [...this.players.values()].filter((player) => !player.eliminated);
    const activeScores = active.map((player) => player.score.score).sort((a, b) => b - a);
    if (!tiedAtTop(activeScores)) {
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
            livesLeft: event.livesLeft,
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
        avatar: player.avatar,
        score: player.score.score,
        combo: player.score.combo,
        lives: player.score.lives,
        knockouts: player.knockouts,
        eliminated: player.eliminated,
        // Sisa beku dikirim sebagai durasi, bukan timestamp: jam client dan
        // server tidak pernah sama, dan selisihnya akan terlihat sebagai
        // hitungan mundur yang salah.
        frozenMs: Math.max(0, player.frozenUntil - Date.now()),
        connected: this.room.has(id),
      })),
    });
  }

  private broadcastRoomState(): void {
    this.io.to(this.room.code).emit('room:state', this.room.toState(this.scores()));
  }

  private ranking(): MatchResultEntry[] {
    return (
      [...this.players.entries()]
        .map(([id, player]) => {
          const total = player.score.correctClicks + player.score.wrongClicks;
          return {
            playerId: id,
            nickname: player.nickname,
            avatar: player.avatar,
            score: player.score.score,
            rank: 0,
            accuracy: total === 0 ? 1 : player.score.correctClicks / total,
            bestCombo: player.score.bestCombo,
            knockouts: player.knockouts,
            eliminated: player.eliminated,
            // Ikut ke sini semata-mata supaya `saveMatch` bisa menautkan baris
            // riwayat ke akun. Tidak pernah dikirim ke client mana pun.
            userId: player.userId,
          };
        })
        // Yang bertahan SELALU di atas yang tereliminasi, berapa pun skornya.
        // Tanpa ini, "bunuh diri sambil unggul skor" jadi strategi yang menang —
        // dan aturan "main berdua, tereliminasi = kalah" tidak akan terpenuhi.
        .sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
    );
  }

  private finish(reason: MatchEndedPayload['reason']): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.stop();

    const ranking = this.ranking();

    // Id akun dibuang sebelum disiarkan. Layar hasil tidak membutuhkannya, dan
    // mengirimkannya berarti setiap pemain di room bisa membaca id internal
    // lawannya — data yang tidak pernah perlu keluar dari server.
    const publicRanking = ranking.map(({ userId: _userId, ...entry }) => entry);
    this.io.to(this.room.code).emit('game:ended', { ranking: publicRanking, reason });

    // Sengaja tidak di-await: pemain sudah melihat hasilnya, dan menunggu
    // round-trip database di sini hanya akan menunda layar hasil. Kegagalannya
    // ditangani di dalam saveMatch dan tidak pernah menjatuhkan match.
    void saveMatch({
      roomCode: this.room.code,
      settings: this.room.currentSettings,
      endReason: reason,
      startedAt: this.startedAt ?? new Date(),
      endedAt: new Date(),
      ranking,
    });

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
