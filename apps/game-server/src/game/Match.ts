import {
  ALL_COLORS,
  applyClick,
  chaosModifierFor,
  COUNTDOWN_SECONDS,
  createGameState,
  createScoreState,
  equalizeDelayMs,
  gridSizeFor,
  isStroopActive,
  isTargetChangeImminent,
  MP_FREEZE_MS,
  MP_LEVEL_DURATION_MS,
  MP_MAX_KNOCKOUTS,
  MP_STARTING_LIVES,
  MP_TICK_BROADCAST_MS,
  referenceLatencyMs,
  mpLevelProgress,
  SERVER_TICK_MS,
  spawnCrowdFactor,
  step,
  TEAM_IDS,
  teamTargetScore,
  stroopInkFor,
  SUDDEN_DEATH_LIFETIME_MS,
} from '@pixelmatrix/shared';
import type {
  AvatarId,
  BotDifficulty,
  Color,
  GameConfig,
  MatchEndedPayload,
  GameEvent,
  GameState,
  MatchResultEntry,
  Pixel,
  ResyncPayload,
  ScoreboardEntry,
  ScoreState,
  TeamId,
  TeamResultEntry,
  TeamScoreEntry,
} from '@pixelmatrix/shared';
import type { Room } from '../rooms/Room';
import { BotDriver } from './BotDriver';
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
  /** Tingkat kesulitan kalau ini bot; `null` untuk manusia. */
  bot: BotDifficulty | null;
  /** Regu pemain ini; `null` di match ffa. */
  team: TeamId | null;
}

/**
 * Keadaan satu regu selama match beregu.
 *
 * Nyawa, beku, KO, dan eliminasi pindah KE SINI dari pemain — di mode beregu
 * keempatnya memang milik regu. Skor tetap dicatat per pemain dan dijumlahkan
 * saat dibutuhkan, bukan diakumulasi di sini: statistik pribadi (akurasi, combo
 * terbaik, siapa penyumbang terbesar) tetap harus bisa ditampilkan di layar
 * hasil, dan angka yang sudah terlanjur dijumlahkan tidak bisa dipecah lagi.
 */
interface TeamStats {
  /** Kolam nyawa BERSAMA. Salah tap siapa pun mengurangi angka yang sama ini. */
  lives: number;
  /** Isi penuh kolamnya — MP_STARTING_LIVES × jumlah anggota. */
  maxLives: number;
  /** Kapan seluruh anggota boleh mengetuk lagi; 0 berarti tidak beku. */
  frozenUntil: number;
  knockouts: number;
  eliminated: boolean;
  readonly members: string[];
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
  /** Satu penggerak per bot, digerakkan dari tick yang sama dengan papannya. */
  private readonly bots: BotDriver[] = [];
  private readonly limiter = new RateLimiter();
  /**
   * Ketukan yang sedang ditahan demi penyetaraan ping.
   *
   * Isinya selalu sangat sedikit — penahanannya paling lama
   * `MP_PING_EQUALIZE_CAP_MS` (80 ms), jadi tidak ada entri yang bertahan
   * lebih dari dua tick.
   */
  private pendingClicks: { playerId: string; pixelId: string; applyAtMs: number }[] = [];
  private status: MatchStatus = 'countdown';
  private timer: NodeJS.Timeout | null = null;
  private lastTickAt = 0;
  private lastBroadcastAt = 0;
  private countdownLeft = COUNTDOWN_SECONDS;
  private suddenDeathSeq = 0;
  private startedAt: Date | null = null;
  /** Match ini beregu. Dibekukan saat match dibuat, tidak dibaca ulang dari room. */
  private readonly beregu: boolean;
  private readonly teams = new Map<TeamId, TeamStats>();

  constructor(
    private readonly room: Room,
    private readonly io: GameServer,
    private readonly onFinished: (room: Room) => void,
  ) {
    this.board = createGameState({
      seed: Date.now(),
      config: boardConfig(room.playerCount),
    });
    // Susunan regu DIBEKUKAN di sini, saat match dibuat. Sesudah ini daftar
    // pemain masih bisa berubah (ada yang putus, ada yang keluar), tapi regunya
    // tidak — kalau kolam nyawa ikut menyusut saat ada yang pergi, regu yang
    // ditinggal anggotanya akan langsung KO tanpa satu pun kesalahan.
    this.beregu = room.currentSettings.teamMode === 'teams';

    for (const player of room.allPlayers()) {
      const team = this.beregu ? player.team : null;
      this.players.set(player.id, {
        nickname: player.nickname,
        avatar: player.avatar,
        userId: player.userId,
        score: createScoreState(MP_STARTING_LIVES),
        frozenUntil: 0,
        knockouts: 0,
        eliminated: false,
        bot: player.bot,
        team,
      });
      if (team !== null) this.teamOf(team).members.push(player.id);
      if (player.bot !== null) this.bots.push(new BotDriver(player.id, player.bot));
    }

    for (const team of TEAM_IDS) {
      const stats = this.teams.get(team);
      if (!stats) continue;
      // Jatah per pemain PERSIS sama dengan mode ffa: 3 nyawa masing-masing,
      // 3 KO sebelum keluar. Yang berbeda hanya bahwa jatahnya dikumpulkan jadi
      // satu — pemain ceroboh menghabiskan jatah temannya, dan itulah seluruh
      // isi dari "satu regu".
      stats.maxLives = MP_STARTING_LIVES * Math.max(1, stats.members.length);
      stats.lives = stats.maxLives;
    }
  }

  /** Ambil (atau buat) catatan regu. */
  private teamOf(team: TeamId): TeamStats {
    const ada = this.teams.get(team);
    if (ada) return ada;
    const baru: TeamStats = {
      lives: MP_STARTING_LIVES,
      maxLives: MP_STARTING_LIVES,
      frozenUntil: 0,
      knockouts: 0,
      eliminated: false,
      members: [],
    };
    this.teams.set(team, baru);
    return baru;
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
    // Ketukannya yang masih ditahan ikut dibuang: pemain yang sudah pergi tidak
    // boleh tiba-tiba merebut pixel 80 ms kemudian.
    this.pendingClicks = this.pendingClicks.filter((entry) => entry.playerId !== playerId);
    if (!this.players.has(playerId)) return;

    // Match yang tidak lagi ditonton siapa pun harus berhenti.
    //
    // Dua syarat, dan keduanya perlu sejak ada bot. `remaining < 2` menjaga
    // agar match satu peserta tidak berjalan sendirian seperti sebelumnya —
    // tapi itu saja akan membiarkan satu bot terus mengetuk papan setelah
    // manusia terakhir menutup tabnya, sampai batas waktunya habis, memakan
    // tick server untuk pertandingan tanpa penonton.
    const remaining = this.room.allPlayers().filter((player) => player.id !== playerId);
    const humansLeft = remaining.filter((player) => player.bot === null).length;
    if ((remaining.length < 2 || humansLeft === 0) && this.status !== 'ended') {
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
    //
    // Di mode beregu yang beku dan tereliminasi adalah REGUNYA, jadi keduanya
    // diperiksa lewat `frozenOf`/`eliminatedOf` — pemain yang sehat pun ikut
    // berhenti kalau kolam nyawa regunya habis, dan itu memang inti aturannya.
    if (this.eliminatedOf(player) || isFrozen(this.frozenUntilOf(player), Date.now())) return;

    if (!this.limiter.allow(playerId, Date.now())) {
      this.io.to(playerId).emit('game:clickRejected', {
        pixelId,
        reason: 'rateLimited',
        penalty: 0,
      });
      return;
    }

    /*
      Penyetaraan ping — lihat `engine/fairness` untuk alasannya.

      Ditaruh SETELAH rate limiter, dan itu disengaja: pembatas laju adalah
      penjaga anti-spam dan harus menghitung ketukan pada saat ia benar-benar
      tiba. Kalau ia dipindahkan ke belakang penahanan, seseorang bisa
      mengirim badai ketukan dan hanya sebagian yang terhitung.

      Yang ditahan cuma penyelesaiannya, bukan pemeriksaannya.
    */
    const tahan = this.equalizeDelayFor(playerId);
    if (tahan > 0) {
      this.pendingClicks.push({ playerId, pixelId, applyAtMs: Date.now() + tahan });
      return;
    }
    this.resolveClick(playerId, pixelId);
  }

  /**
   * Ketukan yang penahanannya sudah lewat, dijalankan di awal tick.
   *
   * Dikuras di tick dan bukan lewat `setTimeout` per ketukan supaya urutannya
   * tetap satu jalur dengan spawn, kenaikan level, dan bot — timer terpisah
   * bisa menyisipkan klik di TENGAH `step()`, dan papan yang setengah diperbarui
   * adalah sumber bug yang tidak akan pernah bisa direproduksi.
   *
   * Harganya: penahanannya membulat ke atas sampai satu tick (50 ms). Itu
   * berlaku sama untuk semua yang ditahan, jadi ia tidak menggeser
   * keadilannya — cuma membuat angka penahanannya tidak persis.
   */
  private drainPendingClicks(now: number): void {
    if (this.pendingClicks.length === 0) return;

    const siap = this.pendingClicks.filter((entry) => entry.applyAtMs <= now);
    if (siap.length === 0) return;
    this.pendingClicks = this.pendingClicks.filter((entry) => entry.applyAtMs > now);

    for (const entry of siap) {
      if (this.status !== 'running' && this.status !== 'suddenDeath') return;
      const player = this.players.get(entry.playerId);
      if (!player) continue;
      /*
        Beku dan eliminasi diperiksa LAGI di sini, bukan cuma saat ketukannya
        tiba. Ketukan yang ditahan diselesaikan seolah-olah ia memang datang
        selambat itu, jadi keadaan yang berlaku adalah keadaan saat ia
        diselesaikan — persis seperti yang dialami pemain berping tinggi yang
        sedang disetarai.
      */
      if (this.eliminatedOf(player) || isFrozen(this.frozenUntilOf(player), now)) continue;
      this.resolveClick(entry.playerId, entry.pixelId);
    }
  }

  /** Berapa lama ketukan pemain ini ditahan supaya setara dengan yang terlambat. */
  private equalizeDelayFor(playerId: string): number {
    return equalizeDelayMs(this.room.get(playerId)?.latencyMs ?? null, this.referenceLatencyMs());
  }

  /**
   * Ping acuan match ini: yang terburuk di antara pemain yang MASIH TERSAMBUNG.
   *
   * Yang terputus tidak ikut. Pemain yang koneksinya hilang meninggalkan angka
   * ping terakhirnya yang biasanya buruk justru karena itulah ia terputus —
   * dan membiarkannya menjadi acuan berarti seluruh room ditahan demi seseorang
   * yang sudah tidak mengetuk apa pun.
   */
  private referenceLatencyMs(): number {
    return referenceLatencyMs(
      [...this.players.keys()].map((id) => {
        const seat = this.room.get(id);
        return seat && seat.connected ? seat.latencyMs : null;
      }),
    );
  }

  private resolveClick(playerId: string, pixelId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // Engine dipanggil dengan papan bersama + skor pemain ini. Karena `applyClick`
    // pure, papan hasilnya (dengan pixel yang sudah dihapus) langsung jadi papan
    // bersama yang baru — dan itulah yang membuat "siapa cepat dia dapat" bekerja
    // tanpa penguncian apa pun.
    const carrier: GameState = { ...this.board, score: player.score };
    const result = applyClick(carrier, pixelId);

    this.board = { ...this.board, board: result.state.board };

    /*
      Nyawa yang TERPAKAI dihitung sebagai selisih, lalu dibebankan ke kolam
      regu — bukan dihitung ulang di sini dari jenis kliknya.

      Alasannya: engine sudah tahu semua aturannya (salah warna −1, bom −2,
      pixel ♥ +1, batas MAX_LIVES) dan aturan itu masih akan berubah. Menyalin
      tabelnya ke sini berarti dua sumber kebenaran, dan yang kedua pasti akan
      tertinggal begitu ada pixel spesial baru. Dengan selisih, mekanik apa pun
      yang menyentuh nyawa otomatis ikut bekerja di mode beregu.

      Nyawa pribadi lalu DIISI ULANG penuh. Di mode beregu ia bukan lagi angka
      yang berarti — ia cuma alat hitung supaya engine bisa mengeluarkan selisih
      tadi. Yang ditampilkan ke pemain adalah kolam regunya.
    */
    const team = this.teamStatsOf(player);
    if (team) {
      const sebelum = player.score.lives ?? MP_STARTING_LIVES;
      const sesudah = result.state.score.lives ?? MP_STARTING_LIVES;
      const terpakai = sebelum - sesudah;
      player.score = { ...result.state.score, lives: MP_STARTING_LIVES };
      team.lives = Math.max(0, Math.min(team.maxLives, team.lives - terpakai));
    } else {
      player.score = result.state.score;
    }

    this.forwardClickEvents(playerId, result.events);

    const sisaNyawa = team ? team.lives : player.score.lives;
    const bekuSampai = team ? team.frozenUntil : player.frozenUntil;

    if (shouldFreeze(sisaNyawa, bekuSampai)) {
      const korban = team ?? player;
      korban.knockouts += 1;

      if (isEliminatedAfter(korban.knockouts, MP_MAX_KNOCKOUTS)) {
        korban.eliminated = true;
        // Diberi tahu ke SETIAP anggota, bukan cuma ke yang menghabiskan nyawa
        // terakhir. Tiga orang lain juga berhenti bermain saat itu juga, dan
        // papan yang mendadak tidak merespons tanpa penjelasan akan terbaca
        // sebagai gamenya rusak.
        for (const id of this.membersOf(player)) this.io.to(id).emit('game:eliminated');
      } else {
        // KO yang belum terakhir hanya membekukan — regunya kembali dengan
        // kolam nyawa penuh, jadi match tetap ramai sampai batas KO tercapai.
        korban.frozenUntil = Date.now() + MP_FREEZE_MS;
      }

      // Disiarkan langsung, tidak menunggu tick terjadwal: pemain harus tahu
      // nasibnya dalam milidetik yang sama, bukan sampai 250 ms kemudian.
      this.broadcastTick();

      // "Main berdua, tereliminasi = langsung kalah" tidak butuh kasus khusus:
      // dari berapa pun pemain, match berhenti begitu yang masih bermain
      // tinggal satu — dan di mode beregu, begitu tinggal satu REGU.
      if (shouldEndByElimination(this.activeSideCount())) {
        this.finish('elimination');
        return;
      }
    }

    if (this.status === 'suddenDeath' && result.claimed) {
      this.finish('suddenDeath');
      return;
    }
    // Yang dibandingkan dengan target adalah SKOR REGU di mode beregu, dan
    // targetnya ikut dikali jumlah anggota — kalau tidak, match 4v4 selesai
    // kira-kira empat kali lebih cepat daripada 2v2 padahal host memilih angka
    // yang sama.
    if (this.status === 'running') {
      const capai = team
        ? this.teamScore(player.team!) >= this.teamTargetOf(player.team!)
        : player.score.score >= this.targetScore;
      if (capai) this.finish('targetScore');
    }
  }

  // ----------------------------------------------------------- kait pengujian
  //
  // Membaca keadaan dalam, bukan mengubahnya — kecuali `debugThaw`, yang
  // memajukan waktu beku supaya rangkaian KO bisa diuji tanpa menunggu 5 detik
  // sungguhan tiga kali. Semuanya hanya dipakai `*.test.ts`; tidak ada satu pun
  // jalur produksi yang memanggilnya, dan tidak ada yang memberi jalan pintas
  // ke aturan permainan.

  debugBoard(): GameState {
    return this.board;
  }

  debugTeams(): readonly TeamScoreEntry[] {
    return this.teamBoard();
  }

  debugScoreboard(): readonly ScoreboardEntry[] {
    return this.scoreboard();
  }

  /**
   * Taruh satu pixel berwarna BUKAN-target di papan, lalu kembalikan id-nya.
   *
   * Menyediakan INPUT, bukan melewati aturan: kliknya tetap masuk lewat
   * `handleClick` dan melewati rate limiter, pemeriksaan beku, `applyClick`,
   * dan seluruh perhitungan nyawa persis seperti ketukan sungguhan. Yang
   * dilewati hanyalah menunggu penjadwal spawn — papan hanya menahan ~2,4 pixel
   * sekaligus, jadi rangkaian 18 salah tap yang dibutuhkan untuk menguji tiga
   * KO tidak mungkin dijalankan tanpa ini.
   */
  debugPlaceWrongPixel(): string {
    const { board } = this.board;
    const salah = ALL_COLORS.find((color) => !board.targetColors.includes(color));
    const pixel: Pixel = {
      id: `dbg${board.nextPixelSeq}`,
      cell: { row: 0, col: 0 },
      color: salah ?? board.targetColors[0]!,
      kind: 'normal',
      spawnedAtMs: this.board.elapsedMs,
      lifetimeMs: 60_000,
    };
    this.board = {
      ...this.board,
      board: {
        ...board,
        pixels: [...board.pixels, pixel],
        nextPixelSeq: board.nextPixelSeq + 1,
      },
    };
    return pixel.id;
  }

  /**
   * Taruh satu pixel BERWARNA TARGET, lalu kembalikan id-nya.
   *
   * Pasangan `debugPlaceWrongPixel`, dipakai untuk menguji rebutan: dua pemain
   * mengincar pixel yang sama dan hanya satu yang boleh mendapatkannya. Papan
   * sungguhan memang memunculkan pixel target sendiri, tapi kapan tepatnya
   * tidak bisa diketahui dari luar — dan test rebutan harus tahu persis pixel
   * mana yang sedang diperebutkan.
   */
  debugPlaceTargetPixel(): string {
    const { board } = this.board;
    const pixel: Pixel = {
      id: `dbgt${board.nextPixelSeq}`,
      cell: { row: 1, col: 1 },
      color: board.targetColors[0]!,
      kind: 'normal',
      spawnedAtMs: this.board.elapsedMs,
      lifetimeMs: 60_000,
    };
    this.board = {
      ...this.board,
      board: {
        ...board,
        pixels: [...board.pixels, pixel],
        nextPixelSeq: board.nextPixelSeq + 1,
      },
    };
    return pixel.id;
  }

  /** Akhiri masa beku sekarang juga, lewat jalur pencairan yang sesungguhnya. */
  debugThaw(): void {
    for (const stats of this.teams.values()) {
      if (stats.frozenUntil !== 0) stats.frozenUntil = 1;
    }
    for (const player of this.players.values()) {
      if (player.frozenUntil !== 0) player.frozenUntil = 1;
    }
    this.reviveThawedPlayers(Date.now());
  }

  // -------------------------------------------------------------------- regu

  /** Catatan regu pemain ini; `null` di match ffa. */
  private teamStatsOf(player: PlayerStats): TeamStats | null {
    return player.team === null ? null : (this.teams.get(player.team) ?? null);
  }

  /**
   * Siapa saja yang ikut terkena nasib pemain ini.
   *
   * Di ffa hanya dirinya; di mode beregu seluruh anggota regunya. Dipakai untuk
   * mengirim `game:eliminated` — pesan yang hanya sampai ke satu orang membuat
   * tiga orang lain melihat papan yang mendadak tidak merespons.
   */
  private membersOf(player: PlayerStats): readonly string[] {
    const team = this.teamStatsOf(player);
    if (team) return team.members;
    for (const [id, p] of this.players) if (p === player) return [id];
    return [];
  }

  private eliminatedOf(player: PlayerStats): boolean {
    return this.teamStatsOf(player)?.eliminated ?? player.eliminated;
  }

  private frozenUntilOf(player: PlayerStats): number {
    return this.teamStatsOf(player)?.frozenUntil ?? player.frozenUntil;
  }

  /** Jumlah poin seluruh anggota regu. */
  private teamScore(team: TeamId): number {
    let total = 0;
    for (const player of this.players.values()) {
      if (player.team === team) total += player.score.score;
    }
    return total;
  }

  private teamTargetOf(team: TeamId): number {
    const anggota = this.teams.get(team)?.members.length ?? 1;
    return teamTargetScore(this.targetScore, Math.max(1, anggota));
  }

  /**
   * Berapa "pihak" yang masih bermain — regu di mode beregu, pemain di ffa.
   *
   * Satu fungsi untuk keduanya supaya aturan akhir match tidak ditulis dua
   * kali. `shouldEndByElimination` tidak perlu tahu bedanya: yang penting
   * berapa pihak yang masih bisa mengetuk.
   */
  private activeSideCount(): number {
    if (!this.beregu) return this.activePlayerCount();
    let count = 0;
    for (const stats of this.teams.values()) {
      if (stats.eliminated) continue;
      // Regu yang seluruh anggotanya sudah pergi dari room tidak lagi "bermain"
      // walau belum pernah tereliminasi — tanpa ini, satu regu yang menutup tab
      // bersama-sama akan menahan match berjalan sampai waktunya habis.
      if (stats.members.some((id) => this.room.has(id))) count += 1;
    }
    return count;
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
      gridSize: this.board.config.gridSize,
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
    /*
      Ketukan manusia yang ditahan diselesaikan SEBELUM bot digerakkan.

      Urutan ini yang membuat penyetaraan ping ada gunanya. Bot berjalan di
      dalam proses server tanpa jaringan sama sekali, jadi ia pihak yang paling
      diuntungkan di papan rebutan; kalau ia mengetuk lebih dulu di tick yang
      sama, pixel yang seharusnya jadi milik manusia yang sudah menunggu
      penahanannya keburu diambil.
    */
    this.drainPendingClicks(now);
    this.driveBots();

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

  /**
   * Match sudah usai.
   *
   * Metode, bukan pembacaan `this.status` langsung: di dalam `driveBots` status
   * sudah dipersempit TypeScript ke 'running' | 'suddenDeath' oleh penjaga di
   * awal loop, padahal `handleClick` di tengah loop bisa mengubahnya. Pembacaan
   * langsung di sana akan dianggap perbandingan yang mustahil dan dihapus dari
   * pikiran pembaca berikutnya — padahal justru itu yang menahan bot mengetuk
   * papan yang sudah selesai.
   */
  private hasEnded(): boolean {
    return this.status === 'ended';
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

    // Regu dicairkan sebagai satu kesatuan: kolam nyawanya diisi penuh sekali,
    // lalu combo setiap anggotanya diputus. Combo memang milik pribadi, tapi
    // yang membekukan mereka adalah kejadian bersama.
    for (const stats of this.teams.values()) {
      if (stats.eliminated || !hasThawed(stats.frozenUntil, now)) continue;
      stats.frozenUntil = 0;
      stats.lives = stats.maxLives;
      revived = true;
      for (const id of stats.members) {
        const anggota = this.players.get(id);
        if (anggota) anggota.score = { ...anggota.score, lives: MP_STARTING_LIVES, combo: 0 };
      }
    }

    for (const player of this.players.values()) {
      // Di mode beregu nyawa pribadi tidak pernah habis (selalu diisi ulang di
      // `handleClick`), jadi cabang ini hanya berjalan di ffa.
      if (player.team !== null) continue;
      if (player.eliminated || !hasThawed(player.frozenUntil, now)) continue;
      player.frozenUntil = 0;
      player.score = { ...player.score, lives: MP_STARTING_LIVES, combo: 0 };
      revived = true;
    }

    if (revived) this.broadcastTick();
  }

  /**
   * Beri tiap bot satu kesempatan mengetuk, memakai papan tick ini.
   *
   * Urutannya diacak setiap tick. Kalau tidak, dengan dua bot setingkat yang
   * mengincar pixel yang sama, bot pertama di daftar akan SELALU menang —
   * bukan karena lebih cepat, tapi karena ia lebih dulu diiterasi. Papan
   * rebutan yang hasilnya ditentukan urutan array bukan perlombaan.
   */
  private driveBots(): void {
    if (this.bots.length === 0) return;
    if (this.status !== 'running' && this.status !== 'suddenDeath') return;

    const order = this.bots.length === 1 ? this.bots : shuffled(this.bots);
    for (const bot of order) {
      const pixelId = bot.step(
        this.board.board.pixels,
        this.board.board.targetColors,
        this.board.elapsedMs,
      );
      if (pixelId === null) continue;
      // Jalur yang SAMA dengan klik manusia — termasuk rate limiter, aturan
      // beku, dan penalti bom. Tidak ada pintu belakang untuk bot.
      this.handleClick(bot.botId, pixelId);
      // `handleClick` bisa mengakhiri match (target tercapai / eliminasi).
      // Melanjutkan loop setelah itu berarti mengetuk papan yang sudah selesai.
      if (this.hasEnded()) return;
    }
  }

  private onTimeUp(): void {
    // Hanya pihak yang masih bermain yang boleh memicu sudden death. Yang
    // tereliminasi tidak bisa mengetuk apa pun, jadi seri dengannya akan
    // membuat match menggantung selamanya.
    //
    // Di mode beregu yang dibandingkan adalah skor REGU: dua pemain dengan
    // skor pribadi yang kebetulan sama bukan seri, dan memakai skor pribadi di
    // sini akan memicu sudden death untuk match yang sebenarnya sudah ada
    // pemenangnya.
    const activeScores = this.beregu
      ? [...this.teams.entries()]
          .filter(([, stats]) => !stats.eliminated)
          .map(([team]) => this.teamScore(team))
          .sort((a, b) => b - a)
      : [...this.players.values()]
          .filter((player) => !player.eliminated)
          .map((player) => player.score.score)
          .sort((a, b) => b - a);

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
    // Dibaca dari config papan ini, bukan dari konstanta: match ramai memakai
    // papan 10×10, dan menaruh pixel sudden death memakai angka 8 akan
    // mengurung penentu kemenangan di sudut kiri atas papan.
    const grid = this.board.config.gridSize;
    const cell = {
      row: Math.floor(Math.random() * grid),
      col: Math.floor(Math.random() * grid),
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
            stroopInk: this.stroopInk(),
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
            kind: event.kind,
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

  private scoreboard(): ScoreboardEntry[] {
    return [...this.players.entries()].map(([id, player]) => ({
      playerId: id,
      nickname: player.nickname,
      avatar: player.avatar,
      score: player.score.score,
      combo: player.score.combo,
      // Di mode beregu nyawa milik regu, dan angka pribadi di sini tidak
      // berarti apa-apa. Dikirim `null` supaya UI tidak punya pilihan selain
      // membaca kolam regunya — nilai palsu yang kelihatan masuk akal jauh
      // lebih berbahaya daripada tidak ada nilai sama sekali.
      lives: player.team === null ? player.score.lives : null,
      knockouts: this.teamStatsOf(player)?.knockouts ?? player.knockouts,
      eliminated: this.eliminatedOf(player),
      team: player.team,
      // Sisa beku dikirim sebagai durasi, bukan timestamp: jam client dan
      // server tidak pernah sama, dan selisihnya akan terlihat sebagai
      // hitungan mundur yang salah.
      //
      // Dibaca lewat `frozenUntilOf`, BUKAN dari `player.frozenUntil`. Di mode
      // beregu yang membeku adalah regunya dan angka pribadi ini selamanya 0 —
      // versi pertama memakainya langsung, dan akibatnya seluruh regu berhenti
      // bisa mengetuk sementara scoreboard menampilkan semua orang baik-baik
      // saja. Ditemukan test, bukan mata.
      frozenMs: Math.max(0, this.frozenUntilOf(player) - Date.now()),
      // Kursi yang masih ada TIDAK berarti koneksinya hidup. Selama masa
      // tenggang reconnect, pemain tetap ada di room justru karena socket-nya
      // putus — memakai `room.has(id)` di sini akan menampilkan semua orang
      // sebagai tersambung dan menyembunyikan satu-satunya hal yang ingin
      // diketahui pemain lain.
      connected: this.room.get(id)?.connected === true,
      latencyMs: this.room.get(id)?.latencyMs ?? null,
      // Penahanan penyetaraan ping. Dikirim ke SEMUA pemain, bukan hanya ke
      // yang ditahan: kalau angkanya disembunyikan, pemain berping bagus cuma
      // merasakan permainannya jadi lebih lamban tanpa penjelasan apa pun, dan
      // itu terbaca sebagai server yang buruk — bukan sebagai keadilan.
      fairDelayMs: this.equalizeDelayFor(id),
      bot: player.bot,
    }));
  }

  /**
   * Keadaan kedua regu untuk disiarkan; kosong di match ffa.
   *
   * Urutannya mengikuti TEAM_IDS dan bukan skor, sengaja: kolom regu di layar
   * pemain tidak boleh bertukar tempat setiap kali salah satu menyalip. Yang
   * diurutkan menurut skor hanya layar hasil, ketika match sudah selesai.
   */
  private teamBoard(): TeamScoreEntry[] {
    if (!this.beregu) return [];
    const now = Date.now();
    const out: TeamScoreEntry[] = [];
    for (const team of TEAM_IDS) {
      const stats = this.teams.get(team);
      if (!stats) continue;
      out.push({
        team,
        score: this.teamScore(team),
        lives: stats.lives,
        maxLives: stats.maxLives,
        targetScore: this.teamTargetOf(team),
        // Durasi, bukan timestamp — alasannya sama dengan `frozenMs` pemain.
        frozenMs: Math.max(0, stats.frozenUntil - now),
        knockouts: stats.knockouts,
        eliminated: stats.eliminated,
      });
    }
    return out;
  }

  /**
   * Peringkat regu untuk layar hasil.
   *
   * Aturan urutannya sama dengan peringkat pemain: yang tereliminasi SELALU di
   * bawah yang bertahan, berapa pun skornya. Tanpa itu, menghabiskan nyawa
   * sendiri sambil unggul angka menjadi strategi yang sah.
   */
  private teamRanking(): TeamResultEntry[] {
    if (!this.beregu) return [];
    return [...this.teams.keys()]
      .map((team) => ({
        team,
        score: this.teamScore(team),
        eliminated: this.teams.get(team)?.eliminated === true,
        rank: 0,
      }))
      .sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  /**
   * Tinta Stroop untuk periode target sekarang.
   *
   * Satu tempat untuk ketiga pemakainya (tick, targetChanged, snapshot): kalau
   * dihitung ulang di masing-masing, tiga jalur itu bisa mengirim tinta yang
   * berbeda untuk periode yang sama dan HUD akan berkedip antara dua pengecoh.
   */
  private stroopInk(): readonly Color[] | null {
    const { board } = this.board;
    if (!isStroopActive(board.level)) return null;
    return stroopInkFor(board.targetColors, board.targetChangesAtMs + board.chaosSeed);
  }

  private remainingMs(): number {
    return Math.max(0, this.timeLimitMs - this.board.elapsedMs);
  }

  /**
   * Potret papan untuk pemain yang baru kembali di tengah match.
   *
   * `game:started` sudah lewat dan seluruh riwayat spawn hilang bersama koneksi
   * lamanya, jadi tanpa ini papannya akan kosong sampai pixel yang sekarang
   * hidup kedaluwarsa satu per satu — dan selama itu ia tidak punya apa pun
   * untuk ditekan.
   */
  snapshot(): ResyncPayload {
    return {
      pixels: this.board.board.pixels,
      gridSize: this.board.config.gridSize,
      targetColors: this.board.board.targetColors,
      stroopInk: this.stroopInk(),
      level: this.board.board.level,
      chaos: chaosModifierFor(this.board.board.chaosSeed, this.board.board.level),
      remainingMs: this.remainingMs(),
      suddenDeath: this.status === 'suddenDeath',
      scoreboard: this.scoreboard(),
      teams: this.teamBoard(),
    };
  }

  private broadcastTick(): void {
    this.io.to(this.room.code).emit('game:tick', {
      remainingMs: this.remainingMs(),
      level: this.board.board.level,
      levelFraction: mpLevelProgress(this.board.elapsedMs).fraction,
      levelRemainingMs: mpLevelProgress(this.board.elapsedMs).remaining,
      chaos: chaosModifierFor(this.board.board.chaosSeed, this.board.board.level),
      targetColors: this.board.board.targetColors,
      stroopInk: this.stroopInk(),
      // Saat sudden death warna tidak berganti lagi, jadi peringatannya
      // dimatikan supaya tidak berkedip sia-sia di momen paling menegangkan.
      targetImminent: this.status === 'running' && isTargetChangeImminent(this.board),
      scoreboard: this.scoreboard(),
      teams: this.teamBoard(),
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
            knockouts: this.teamStatsOf(player)?.knockouts ?? player.knockouts,
            eliminated: this.eliminatedOf(player),
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
    // Ketukan yang masih ditahan dibuang. Menerapkannya sesudah match usai akan
    // mengubah papan skor yang sudah disiarkan sebagai hasil akhir.
    this.pendingClicks = [];

    const ranking = this.ranking();

    // Id akun dibuang sebelum disiarkan. Layar hasil tidak membutuhkannya, dan
    // mengirimkannya berarti setiap pemain di room bisa membaca id internal
    // lawannya — data yang tidak pernah perlu keluar dari server.
    const publicRanking = ranking.map(({ userId: _userId, ...entry }) => entry);
    // Diambil dari jam papan, bukan dari selisih Date: papan itulah yang
    // menentukan kapan target tercapai, jadi hanya angka ini yang benar-benar
    // cocok dengan apa yang dilihat pemain di layar.
    const durationMs = this.board.elapsedMs;
    this.io.to(this.room.code).emit('game:ended', {
      ranking: publicRanking,
      teams: this.teamRanking(),
      reason,
      durationMs,
    });

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

/** Salinan teracak — Fisher-Yates. Lihat `driveBots`. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
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
 *
 * Ukuran papan dan kederasan spawn diputuskan SEKALI di sini dari jumlah pemain,
 * lalu dikirim ke semua client lewat `game:started`. Bukan dihitung ulang di
 * client: papan rebutan yang tiap pemainnya memakai jumlah sel berbeda berarti
 * koordinat sel yang sama menunjuk pixel yang berbeda.
 */
function boardConfig(playerCount: number): GameConfig {
  return {
    mode: 'multiplayer',
    gridSize: gridSizeFor(playerCount),
    spawnCrowdFactor: spawnCrowdFactor(playerCount),
    startingLives: null,
    timeLimitMs: null,
    targetScore: null,
  };
}
