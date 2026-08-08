import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  balancedTeamFor,
  canJoinTeam,
  CHAT_HISTORY_LIMIT,
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
  smoothLatency,
  TEAM_IDS,
  teamsReady,
} from '@pixelmatrix/shared';
import type {
  AvatarId,
  BotDifficulty,
  ChatMessage,
  Player,
  RoomSettings,
  RoomState,
  RoomStatus,
  TeamId,
} from '@pixelmatrix/shared';

/**
 * Kenapa chat boleh atau tidak — bukan sekadar `boolean`.
 *
 * Pemanggilnya harus menerjemahkan ini menjadi kode error yang dilihat pemain,
 * dan dua penolakan ini berarti hal yang sepenuhnya berbeda: "tunggu temanmu
 * masuk" versus "tidak bisa saat ronde berjalan". Versi pertama mengembalikan
 * boolean, dan akibatnya keduanya dilaporkan sebagai GAME_IN_PROGRESS — pemain
 * yang sedang menunggu sendirian di lobby diberi tahu bahwa ada match berjalan.
 */
export type ChatVerdict = 'ok' | 'playing' | 'tooFewPlayers';

export interface RoomPlayer {
  readonly id: string;
  nickname: string;
  avatar: AvatarId;
  isReady: boolean;
  connected: boolean;
  /** Latensi bolak-balik hasil pengukuran server; `null` sebelum sampel pertama. */
  latencyMs: number | null;
  /**
   * Tingkat kesulitan kalau kursi ini diisi bot; `null` untuk manusia.
   *
   * Bot menempati kursi yang SAMA dengan manusia — bukan daftar terpisah. Itu
   * keputusan yang menghemat seluruh sisa fitur ini: kapasitas room, keunikan
   * avatar, entri di scoreboard, dan perhitungan skor di Match semuanya bekerja
   * tanpa satu pun kasus khusus. Daftar terpisah berarti setiap aturan lobby
   * harus ditulis dua kali, dan yang kedua pasti akan tertinggal.
   */
  bot: BotDifficulty | null;
  /**
   * Akun pemilik, kalau identitasnya terbukti lewat token bertanda tangan.
   * `null` untuk guest — dan guest adalah cara main yang sepenuhnya sah.
   */
  userId: string | null;
  /**
   * Regu pemain ini.
   *
   * Diisi untuk SEMUA pemain, termasuk saat mode-nya masih `ffa`. Alasannya
   * praktis: host bisa menyalakan mode beregu kapan saja selagi di lobby, dan
   * kalau regunya baru dibagikan pada saat itu, empat orang yang sudah duduk
   * tenang tiba-tiba dilempar ke sisi acak. Dengan selalu terisi, menyalakan
   * mode beregu hanya menampilkan pembagian yang sudah terbentuk sejak mereka
   * masuk satu per satu — dan itu sudah seimbang dengan sendirinya.
   *
   * Yang menentukan tampil atau tidaknya di UI adalah `settings.teamMode`,
   * bukan ada/tidaknya nilai ini.
   */
  team: TeamId;
}

/**
 * Satu room: daftar pemain, pengaturan, dan status lobby.
 *
 * Kelas ini sengaja TIDAK tahu apa pun soal Socket.IO. Semua penyiaran event
 * dilakukan di lapisan `net/`, supaya aturan lobby bisa diuji tanpa jaringan.
 */
export class Room {
  readonly code: string;
  private readonly players = new Map<string, RoomPlayer>();
  private hostId: string;
  private settings: RoomSettings;
  private status: RoomStatus = 'waiting';
  /** Beberapa pesan terakhir; hilang bersama room-nya. */
  private readonly chatLog: ChatMessage[] = [];

  constructor(
    code: string,
    hostId: string,
    hostNickname: string,
    hostAvatar: AvatarId,
    settings?: Partial<RoomSettings>,
    hostUserId: string | null = null,
  ) {
    this.code = code;
    this.hostId = hostId;
    this.settings = normalizeSettings(settings);
    this.players.set(hostId, {
      id: hostId,
      nickname: hostNickname,
      avatar: hostAvatar,
      isReady: false,
      connected: true,
      latencyMs: null,
      bot: null,
      userId: hostUserId,
      team: 'a',
    });
  }

  // ------------------------------------------------------------------- regu

  /** Berapa anggota di tiap regu sekarang. */
  teamCounts(): Record<TeamId, number> {
    const counts: Record<TeamId, number> = { a: 0, b: 0 };
    for (const player of this.players.values()) counts[player.team] += 1;
    return counts;
  }

  /**
   * Pindahkan pemain ke regu lain.
   *
   * Hasilnya TIGA keadaan, bukan boolean. `unchanged` dibedakan dari `moved`
   * karena pemanggilnya harus memperlakukan keduanya berbeda: berpindah regu
   * membatalkan kesiapan pemain, dan menganggap "pindah ke regu yang sudah
   * kutempati" sebagai perpindahan berarti membatalkan kesiapan orang tanpa ada
   * satu pun hal yang berubah. Versi pertama memakai boolean dan melakukan
   * persis itu — lobby yang sudah siap semua tiba-tiba menunggu satu orang
   * menekan "siap" lagi, tanpa ada yang bisa melihat penyebabnya.
   *
   * `rejected` menutupi tiga hal sekaligus: pemainnya tidak ada, regunya penuh,
   * atau match sudah berjalan. Yang terakhir bukan formalitas — regu menentukan
   * ke mana poin mengalir dan nyawa siapa yang terpakai bersama, jadi berpindah
   * di tengah match berarti memindahkan skor yang sudah terkumpul.
   */
  setTeam(playerId: string, team: TeamId): 'moved' | 'unchanged' | 'rejected' {
    if (this.status !== 'waiting') return 'rejected';
    const player = this.players.get(playerId);
    if (!player) return 'rejected';
    if (player.team === team) return 'unchanged';
    if (!canJoinTeam(this.teamCounts(), team, this.settings.maxPlayers)) return 'rejected';
    player.team = team;
    return 'moved';
  }

  get playerCount(): number {
    return this.players.size;
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  get isFull(): boolean {
    return this.players.size >= this.settings.maxPlayers;
  }

  get currentStatus(): RoomStatus {
    return this.status;
  }

  get currentSettings(): RoomSettings {
    return this.settings;
  }

  get host(): string {
    return this.hostId;
  }

  isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  has(playerId: string): boolean {
    return this.players.has(playerId);
  }

  get(playerId: string): RoomPlayer | undefined {
    return this.players.get(playerId);
  }

  allPlayers(): readonly RoomPlayer[] {
    return [...this.players.values()];
  }

  /**
   * Pemain yang socket-nya sedang hidup.
   *
   * Dibedakan dari `allPlayers()` karena pemain yang sedang putus TETAP menempati
   * kursinya — itu inti dari reconnect. Tapi ia tidak bisa menekan tombol siap,
   * jadi setiap aturan lobby yang menuntut tindakan pemain harus memakai daftar
   * ini, bukan daftar semua.
   */
  connectedPlayers(): readonly RoomPlayer[] {
    return this.allPlayers().filter((player) => player.connected);
  }

  /**
   * Tandai koneksi pemain. Mengembalikan `false` kalau pemainnya sudah tidak ada.
   *
   * Host yang putus DIPINDAHKAN ke pemain lain yang masih tersambung: kalau
   * tidak, seluruh room macet menunggu orang yang tidak bisa menekan apa pun.
   * Ia tidak mendapatkannya kembali saat reconnect — merebut host dari orang
   * yang sudah memegangnya justru lebih mengagetkan daripada membiarkannya.
   */
  setConnected(playerId: string, connected: boolean): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.connected = connected;
    if (!connected) {
      // Pemain yang putus tidak bisa membatalkan kesiapannya sendiri. Dibiarkan
      // "siap", match yang belum mulai bisa berjalan tanpa dia hadir.
      player.isReady = false;
      if (this.hostId === playerId) {
        // Host HARUS manusia. Bot tidak bisa menekan "mulai", tidak bisa
        // mengubah pengaturan, dan tidak bisa mengeluarkan dirinya sendiri —
        // menyerahkan host kepadanya akan mengunci room secara permanen.
        const next = this.connectedPlayers().find((player) => player.bot === null);
        if (next) this.hostId = next.id;
      }
    }
    return true;
  }

  /**
   * Catat hasil pengukuran latensi, diratakan supaya lencana tidak berkedip.
   *
   * Diredam DI SINI dan bukan di UI: kalau tiap client meratakan sendiri,
   * pemain yang baru masuk melihat angka mentah sementara yang sudah lama
   * melihat angka halus — untuk koneksi yang sama.
   */
  setLatency(playerId: string, sampleMs: number): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.latencyMs = smoothLatency(player.latencyMs, sampleMs);
  }

  /**
   * Lupakan latensi pemain ini — kita tidak lagi tahu berapa.
   *
   * Dipakai saat ping tidak dibalas dalam batas waktu. Menahan angka lama akan
   * menampilkan koneksi yang sudah tidak terukur seolah masih baik-baik saja,
   * dan justru saat itulah pemain lain paling perlu tahu ada yang tidak beres.
   */
  clearLatency(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) player.latencyMs = null;
  }

  hasNickname(nickname: string): boolean {
    const wanted = nickname.trim().toLowerCase();
    return this.allPlayers().some((player) => player.nickname.trim().toLowerCase() === wanted);
  }

  /** Avatar yang sudah dipakai di room ini — dipakai untuk menjaga keunikannya. */
  takenAvatars(): readonly AvatarId[] {
    return this.allPlayers().map((player) => player.avatar);
  }

  add(playerId: string, nickname: string, avatar: AvatarId, userId: string | null = null): void {
    this.players.set(playerId, {
      id: playerId,
      nickname,
      avatar,
      isReady: false,
      connected: true,
      latencyMs: null,
      bot: null,
      userId,
      // Diseimbangkan saat masuk, bukan saat mode beregu dinyalakan. Lihat
      // catatan di `RoomPlayer.team`.
      team: balancedTeamFor(this.teamCounts()),
    });
  }

  // -------------------------------------------------------------------- bot

  /**
   * Pemain manusia. Sengaja dipisah dari `allPlayers()`.
   *
   * Setiap aturan yang menanyakan "apakah ada orang di sini" harus memakai ini,
   * bukan jumlah total. Bot tidak membaca chat, tidak bisa menekan tombol
   * mulai, dan tidak ada gunanya menunggu — room berisi bot saja bukan room
   * yang hidup, itu proses yang lupa dimatikan.
   */
  humanPlayers(): readonly RoomPlayer[] {
    return this.allPlayers().filter((player) => player.bot === null);
  }

  botPlayers(): readonly RoomPlayer[] {
    return this.allPlayers().filter((player) => player.bot !== null);
  }

  /**
   * Tambahkan lawan buatan ke kursi kosong.
   *
   * Selalu `isReady: true` dan `connected: true`: bot tidak punya tombol siap,
   * dan menunggu kesiapan sesuatu yang tidak bisa menekan apa pun akan membuat
   * room macet selamanya.
   */
  addBot(botId: string, nickname: string, avatar: AvatarId, difficulty: BotDifficulty): void {
    this.players.set(botId, {
      id: botId,
      nickname,
      avatar,
      isReady: true,
      connected: true,
      latencyMs: null,
      bot: difficulty,
      userId: null,
      // Lewat jalur penyeimbang yang SAMA dengan manusia. Bot yang punya aturan
      // regunya sendiri akan menjadi kasus khusus yang cepat atau lambat lupa
      // ikut diperbarui — dan hasilnya lobby 3v1 yang tidak bisa dimulai tanpa
      // ada yang tahu kenapa.
      team: balancedTeamFor(this.teamCounts()),
    });
  }

  /** Keluarkan bot. `false` kalau id-nya bukan bot — manusia dikeluarkan lewat jalur lain. */
  removeBot(botId: string): boolean {
    const player = this.players.get(botId);
    if (!player || player.bot === null) return false;
    this.players.delete(botId);
    return true;
  }

  /**
   * Keluarkan pemain. Kalau yang keluar adalah host, host dipindahkan ke pemain
   * berikutnya supaya room tidak macet tanpa siapa pun yang bisa memulai match.
   */
  remove(playerId: string): void {
    this.players.delete(playerId);
    if (this.hostId === playerId) {
      // Yang tersambung didahulukan: menyerahkan host ke pemain yang sedang
      // putus akan membuat room macet sampai masa tenggangnya habis.
      // Lihat catatan di `setConnected`: host tidak boleh jatuh ke bot.
      const humans = this.humanPlayers();
      const next = humans.find((player) => player.connected) ?? humans[0];
      if (next) this.hostId = next.id;
    }
  }

  setReady(playerId: string, ready: boolean): void {
    const player = this.players.get(playerId);
    if (player) player.isReady = ready;
  }

  updateSettings(patch: Partial<RoomSettings>): RoomSettings {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    return this.settings;
  }

  setStatus(status: RoomStatus): void {
    this.status = status;
  }

  /**
   * Semua pemain siap dan jumlahnya cukup — syarat host boleh memulai.
   *
   * Hanya pemain yang TERSAMBUNG yang dihitung. Kalau tidak, satu orang yang
   * kehilangan sinyal di lobby akan menyandera seluruh room selama masa
   * tenggang: ia tidak bisa menekan siap, dan tidak ada yang bisa memulai.
   */
  canStart(): boolean {
    const ready = this.connectedPlayers();
    // Minimal satu manusia. Tanpa syarat ini, room yang ditinggal pemiliknya
    // bisa memulai match antar-bot dan berjalan terus memakan tick server
    // tanpa ada seorang pun yang menontonnya.
    const anyHuman = ready.some((player) => player.bot === null);
    const dasar =
      this.status === 'waiting' &&
      anyHuman &&
      ready.length >= MIN_PLAYERS_TO_START &&
      ready.every((player) => player.isReady);
    if (!dasar) return false;
    if (this.settings.teamMode !== 'teams') return true;

    // Regunya dihitung dari pemain yang TERSAMBUNG saja, sejalan dengan sisa
    // syarat di atas. Kalau memakai semua pemain, satu orang yang kehilangan
    // sinyal di lobby akan membuat regunya terlihat penuh padahal ia tidak akan
    // ikut bermain — dan match 3v3 sesungguhnya berjalan 3v2.
    const counts: Record<TeamId, number> = { a: 0, b: 0 };
    for (const player of ready) counts[player.team] += 1;
    return teamsReady(counts);
  }

  /**
   * Kenapa match belum bisa dimulai — untuk ditampilkan, bukan untuk diputuskan.
   *
   * `canStart` menjawab ya/tidak; ini menjawab "kenapa tidak". Dipisah karena
   * lobby yang cuma bisa menampilkan tombol mati membuat pemain menebak: apakah
   * kurang orang, ada yang belum siap, atau regunya timpang? Ketiganya butuh
   * tindakan yang berbeda.
   */
  startBlocker(): 'ok' | 'playing' | 'tooFewPlayers' | 'notAllReady' | 'unevenTeams' {
    if (this.status !== 'waiting') return 'playing';
    const ready = this.connectedPlayers();
    if (ready.length < MIN_PLAYERS_TO_START || !ready.some((player) => player.bot === null)) {
      return 'tooFewPlayers';
    }
    if (!ready.every((player) => player.isReady)) return 'notAllReady';
    if (this.settings.teamMode === 'teams') {
      const counts: Record<TeamId, number> = { a: 0, b: 0 };
      for (const player of ready) counts[player.team] += 1;
      if (!teamsReady(counts)) return 'unevenTeams';
    }
    return 'ok';
  }

  /** Reset kesiapan setelah match selesai, supaya rematch butuh konfirmasi ulang. */
  resetReady(): void {
    // Bot tetap siap. Ia tidak punya tombol untuk menekannya lagi, jadi
    // meresetnya berarti rematch tidak akan pernah bisa dimulai.
    for (const player of this.players.values()) player.isReady = player.bot !== null;
  }

  // ------------------------------------------------------------------- chat

  /**
   * Boleh chat atau tidak.
   *
   * Dua syarat, keduanya diminta dan keduanya punya alasan:
   *
   * 1. **Bukan saat match berjalan.** Ini game refleks yang menuntut mata tetap
   *    di papan; teks yang bergerak di tengah ronde bukan fitur, itu gangguan.
   * 2. **Minimal dua pemain tersambung.** Mengirim pesan ke ruang kosong hanya
   *    membuat orang bertanya-tanya apakah chat-nya rusak. Yang dihitung adalah
   *    yang TERSAMBUNG — teman yang sedang reconnect tidak sedang membaca.
   */
  canChat(): ChatVerdict {
    if (this.status === 'playing' || this.status === 'countdown') return 'playing';
    // Yang dihitung MANUSIA yang tersambung. Bot tidak membaca apa pun, jadi
    // membuka chat karena ada dua bot di lobby sama saja dengan bicara sendiri.
    const humans = this.humanPlayers().filter((player) => player.connected);
    if (humans.length < MIN_PLAYERS_TO_START) return 'tooFewPlayers';
    return 'ok';
  }

  /**
   * Simpan pesan dan kembalikan bentuk yang siap disiarkan.
   *
   * Riwayatnya dipotong di CHAT_HISTORY_LIMIT: room bisa hidup lama lewat
   * berkali-kali rematch, dan menyimpan seluruh percakapan berarti kebocoran
   * memori yang tumbuh selama room itu ada.
   */
  addChatMessage(message: ChatMessage): void {
    this.chatLog.push(message);
    if (this.chatLog.length > CHAT_HISTORY_LIMIT) {
      this.chatLog.splice(0, this.chatLog.length - CHAT_HISTORY_LIMIT);
    }
  }

  recentChat(): readonly ChatMessage[] {
    return [...this.chatLog];
  }

  toState(scores: ReadonlyMap<string, { score: number; combo: number }> = new Map()): RoomState {
    const players: Player[] = this.allPlayers().map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      isHost: player.id === this.hostId,
      isReady: player.isReady,
      score: scores.get(player.id)?.score ?? 0,
      combo: scores.get(player.id)?.combo ?? 0,
      connected: player.connected,
      latencyMs: player.latencyMs,
      bot: player.bot,
      // `null` di mode ffa: regunya memang tersimpan terus di server, tapi
      // mengirimkannya ke client saat mode-nya bukan beregu akan membuat UI
      // menggambar dua kolom regu untuk match yang bukan beregu.
      team: this.settings.teamMode === 'teams' ? player.team : null,
    }));

    return {
      roomCode: this.code,
      hostId: this.hostId,
      players,
      settings: this.settings,
      status: this.status,
    };
  }
}

/**
 * Jepit pengaturan ke rentang yang sah — client tidak pernah dipercaya.
 *
 * Batasnya DITURUNKAN dari daftar pilihan yang diizinkan, bukan ditulis sebagai
 * angka. Versi pertama memakai angka langsung (`50, 1000` untuk target skor),
 * dan begitu daftar pilihannya dinaikkan sampai 1500, batas atas 1000 itu
 * diam-diam menurunkan pilihan host tanpa satu pun error: zod meloloskan 1500
 * karena ia ada di daftar, lalu clamp memotongnya ke 1000. Host memilih 1500,
 * mendapat 1000, dan tidak ada apa pun yang memberi tahu.
 *
 * Dua sumber kebenaran untuk hal yang sama selalu berakhir seperti itu. Sekarang
 * hanya ada satu, dan `Room.test.ts` menjaga agar setiap pilihan yang diizinkan
 * benar-benar lolos tanpa berubah nilainya.
 */
export function normalizeSettings(patch?: Partial<RoomSettings>): RoomSettings {
  const merged = { ...DEFAULT_ROOM_SETTINGS, ...patch };
  const teamMode = merged.teamMode === 'teams' ? 'teams' : 'ffa';
  return {
    // Beregu butuh kursi yang bisa dibagi dua. `maxPlayers` ganjil di mode
    // beregu berarti satu kursi yang tidak akan pernah bisa dipakai — dan
    // lobby yang menunggu pemain kedelapan di room berkapasitas 7 akan
    // menunggu selamanya tanpa pernah menjelaskan kenapa.
    maxPlayers:
      teamMode === 'teams'
        ? clampGenap(merged.maxPlayers)
        : clamp(merged.maxPlayers, MIN_PLAYERS_TO_START, MAX_PLAYERS_LIMIT),
    targetScore: clamp(
      merged.targetScore,
      Math.min(...ALLOWED_TARGET_SCORES),
      Math.max(...ALLOWED_TARGET_SCORES),
    ),
    timeLimitSec: clamp(
      merged.timeLimitSec,
      Math.min(...ALLOWED_TIME_LIMITS_SEC),
      Math.max(...ALLOWED_TIME_LIMITS_SEC),
    ),
    teamMode,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Kapasitas yang sah untuk match beregu: 4, 6, atau 8.
 *
 * Dibulatkan KE ATAS ke angka genap terdekat, bukan ke bawah. Host yang
 * memilih 5 hampir pasti berpikir "lima orang mau main", dan menurunkannya ke 4
 * diam-diam menutup pintu untuk orang kelima yang sedang dalam perjalanan
 * masuk. Menaikkan ke 6 paling buruk menyisakan satu kursi kosong yang terlihat
 * jelas di lobby.
 */
function clampGenap(value: number): number {
  const dasar = clamp(value, TEAM_IDS.length * 2, MAX_PLAYERS_LIMIT);
  return dasar % 2 === 0 ? dasar : Math.min(dasar + 1, MAX_PLAYERS_LIMIT);
}
