import type { BotDifficulty } from '../engine/bot';
import type {
  AvatarId,
  Cell,
  ChaosModifier,
  Color,
  MatchResultEntry,
  Pixel,
  PixelKind,
  RoomSettings,
  RoomState,
  TeamId,
  TeamResultEntry,
} from '../types/index';

/**
 * Kontrak Socket.IO antara web dan game-server.
 *
 * Nama event-nya sengaja sama dengan nama event engine di `engine/events.ts`,
 * jadi server bisa meneruskan hasil `step()`/`applyClick()` hampir langsung
 * tanpa lapisan penerjemah.
 */

export type RoomErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NICKNAME_TAKEN'
  | 'NICKNAME_INVALID'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_IN_ROOM'
  | 'RATE_LIMITED'
  | 'INVALID_PAYLOAD'
  /** Regu tujuan sudah penuh — pindahnya ditolak, pemain tetap di regu lamanya. */
  | 'TEAM_FULL'
  /**
   * Mode beregu, tapi regunya belum simetris (misal 3v1 atau 2v0).
   *
   * DIBEDAKAN dari NOT_ENOUGH_PLAYERS dengan sengaja: keduanya sama-sama
   * "belum bisa mulai", tapi yang satu berarti "tunggu temanmu masuk" dan yang
   * satu berarti "ada yang harus pindah sisi". Satu kode untuk keduanya membuat
   * lobby 3v1 yang sudah penuh menampilkan "kurang pemain", dan tidak ada
   * seorang pun yang akan tahu harus berbuat apa.
   */
  | 'UNEVEN_TEAMS';

export interface SocketError {
  readonly code: RoomErrorCode;
  readonly message: string;
}

/** Balasan ack: sukses membawa data, gagal membawa kode error yang bisa diterjemahkan. */
export type Ack<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: SocketError };

// ---------------------------------------------------------------------------
// Payload client → server
// ---------------------------------------------------------------------------

export interface CreateRoomPayload {
  readonly nickname: string;
  readonly avatar: AvatarId;
  readonly settings?: Partial<RoomSettings>;
  /**
   * Bukti identitas dari web (lihat `signPlayerToken`). Opsional: guest tidak
   * punya, dan tanpa AUTH_SECRET di game-server semua orang dianggap guest.
   *
   * Kalau sah, server memakai username dari TOKEN — bukan `nickname` di atas.
   * Kalau tidak, riwayat match bisa tercatat atas nama yang berbeda dari akun
   * yang mengklaimnya.
   */
  readonly playerToken?: string;
}

export interface JoinRoomPayload {
  readonly roomCode: string;
  readonly nickname: string;
  /**
   * Pilihan pemain. Server boleh MENGGANTINYA kalau sudah dipakai orang lain di
   * room itu — avatar yang kembar akan membuat cap di sel papan tidak berarti.
   * Nilai yang benar-benar dipakai selalu ada di `roomState`.
   */
  readonly avatar: AvatarId;
  /** Lihat `CreateRoomPayload.playerToken`. */
  readonly playerToken?: string;
}

export interface UpdateSettingsPayload {
  readonly settings: Partial<RoomSettings>;
}

export interface SetTeamPayload {
  readonly team: TeamId;
}

export interface ReadyPayload {
  readonly ready: boolean;
}

export interface ClickPayload {
  readonly pixelId: string;
  /** Waktu client saat tap; hanya untuk telemetri, TIDAK dipercaya untuk skor. */
  readonly clientTs: number;
}

export interface JoinedRoom {
  readonly roomCode: string;
  /**
   * Id pemain ini di dalam room — dipakai client untuk menyorot dirinya di
   * leaderboard.
   *
   * BUKAN id socket. Id socket berganti setiap kali koneksi terputus, dan kalau
   * kursi pemain dipatok padanya maka reconnect tidak mungkin ada: pemain yang
   * kembali akan selalu dianggap orang baru. Yang ini bertahan selama kursinya
   * masih ada di room.
   */
  readonly playerId: string;
  readonly roomState: RoomState;
  /**
   * Kunci untuk mengklaim kursi ini lagi setelah koneksi putus. Client
   * menyimpannya dan mengirimkannya lewat `room:reconnect`.
   *
   * Rahasia dan hanya dikirim ke pemiliknya — siapa pun yang memegangnya
   * ADALAH pemain itu. Karena itu ia tidak pernah ikut di `RoomState`, yang
   * disiarkan ke seluruh room.
   */
  readonly sessionKey: string;
  /**
   * Beberapa pesan chat terakhir di room ini.
   *
   * Dikirim di ack join/reconnect, BUKAN sebagai event terpisah. Event yang
   * dikirim server tepat setelah join bisa tiba sebelum komponen lobby terpasang
   * dan listener-nya siap — persis masalah yang sama dengan potret papan. Di
   * dalam ack, urutannya tidak mungkin salah.
   */
  readonly chat: readonly ChatMessage[];
}

/**
 * Satu pesan chat lobby.
 *
 * Nickname dan avatar ikut disalin, tidak dirujuk dari daftar pemain: pesan
 * harus tetap terbaca setelah pengirimnya keluar dari room.
 */
export interface ChatMessage {
  readonly id: string;
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: AvatarId;
  readonly text: string;
  /** Epoch ms saat server menerimanya — jam server, bukan jam pengirim. */
  readonly at: number;
}

export interface ChatSendPayload {
  readonly text: string;
}

export interface ReconnectPayload {
  readonly sessionKey: string;
}

export interface AddBotPayload {
  readonly difficulty: BotDifficulty;
}

export interface RemoveBotPayload {
  readonly botId: string;
}

/**
 * Keadaan papan lengkap untuk pemain yang baru kembali di tengah match.
 *
 * Ada karena `game:started` sudah lewat dan tidak akan terulang: pemain yang
 * kembali melewatkan seluruh riwayat spawn, jadi tanpa potret utuh papannya
 * akan kosong sampai pixel-pixel yang sekarang hidup kedaluwarsa satu per satu.
 */
export interface ResyncPayload {
  readonly pixels: readonly Pixel[];
  /**
   * Ikut dikirim di sini, bukan hanya di `game:started`.
   *
   * Justru di sinilah ia paling penting: pemain yang reconnect di tengah match
   * MELEWATKAN `game:started` sepenuhnya. Tanpa angka ini ia menggambar papan
   * 8×8 di atas match 10×10 — papannya terlihat wajar, tapi setiap ketukan
   * mendarat di sel yang berbeda dari yang dilihatnya, dan tidak ada satu pun
   * error yang menandainya.
   */
  readonly gridSize: number;
  readonly targetColors: readonly Color[];
  readonly stroopInk: readonly Color[] | null;
  readonly level: number;
  readonly chaos: ChaosModifier | null;
  readonly remainingMs: number | null;
  readonly suddenDeath: boolean;
  readonly scoreboard: readonly ScoreboardEntry[];
  /** Keadaan kedua regu; array kosong di match ffa. */
  readonly teams: readonly TeamScoreEntry[];
}

// ---------------------------------------------------------------------------
// Payload server → client
// ---------------------------------------------------------------------------

export interface GameStartedPayload {
  readonly targetColors: readonly Color[];
  readonly targetScore: number;
  readonly timeLimitSec: number;
  readonly level: number;
  /**
   * Jumlah sel per sisi papan match ini — 8, atau 10 kalau pemainnya ramai.
   *
   * Dikirim, bukan dihitung ulang client dari jumlah pemain di lobby. Server
   * menetapkannya sekali saat match dibuat, dan sejak itu daftar pemain bisa
   * berubah (ada yang putus, ada yang keluar). Client yang menghitung sendiri
   * akan menggambar papan dengan jumlah sel yang berbeda dari papan server —
   * dan di papan rebutan itu berarti ketukannya mendarat di sel yang salah.
   */
  readonly gridSize: number;
}

export interface PixelSpawnedPayload {
  readonly pixel: Pixel;
}

export interface PixelClaimedPayload {
  readonly pixelId: string;
  readonly cell: Cell;
  readonly byPlayerId: string;
  readonly points: number;
  readonly combo: number;
  readonly score: number;
  /**
   * Jenis pixel yang direbut.
   *
   * ADA karena ketiadaannya adalah bug yang bisa didengar: tanpa ini client
   * multiplayer tidak punya cara membedakan pixel biasa dari ♥ atau ★, jadi
   * mengambil nyawa di multiplayer sama sekali tidak berbunyi — padahal di solo
   * ia punya bunyinya sendiri. Pemain yang bermain di kedua mode akan mengira
   * nyawanya tidak bertambah.
   */
  readonly kind: PixelKind;
}

export interface ClickRejectedPayload {
  readonly pixelId: string;
  readonly reason: 'wrongColor' | 'tooLate' | 'notFound' | 'rateLimited' | 'notRunning';
  readonly penalty: number;
}

export interface BombHitPayload {
  readonly pixelId: string;
  readonly byPlayerId: string;
  readonly scorePenalty: number;
  readonly livesLeft: number | null;
}

export interface TargetChangedPayload {
  readonly colors: readonly Color[];
  readonly previousColors: readonly Color[];
  /** Lihat `TickPayload.stroopInk`. */
  readonly stroopInk: readonly Color[] | null;
}

export interface ScoreboardEntry {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: AvatarId;
  readonly score: number;
  readonly combo: number;
  /** Sisa nyawa; `null` hanya kalau mode-nya memang tanpa nyawa. */
  readonly lives: number | null;
  /**
   * Sisa waktu beku dalam ms setelah nyawa habis; 0 = sedang bermain.
   *
   * Durasi, bukan timestamp: jam client dan server tidak pernah persis sama,
   * dan selisihnya akan terlihat sebagai hitungan mundur yang salah.
   */
  readonly frozenMs: number;
  /** Berapa kali pemain ini sudah KO; MP_MAX_KNOCKOUTS berarti tereliminasi. */
  readonly knockouts: number;
  /** Sudah keluar dari permainan dan hanya bisa menonton. */
  readonly eliminated: boolean;
  readonly connected: boolean;
  /** Lihat `Player.latencyMs`. */
  readonly latencyMs: number | null;
  /** Lihat `Player.bot` — ditampilkan juga di scoreboard saat match berjalan. */
  readonly bot: BotDifficulty | null;
  /** Regu pemain ini; `null` di match ffa. */
  readonly team: TeamId | null;
}

/**
 * Keadaan satu regu selama match beregu.
 *
 * Dikirim TERPISAH dari daftar pemain, bukan diulang di tiap baris pemain.
 * Nyawa dan KO di mode beregu memang milik regu, bukan milik orang: menempelkan
 * angka yang sama ke empat baris membuatnya terbaca sebagai empat kolam yang
 * kebetulan sama besar, dan pemain akan mengira ia punya cadangan sendiri.
 */
export interface TeamScoreEntry {
  readonly team: TeamId;
  /** Jumlah poin seluruh anggota. Ini yang menentukan siapa menang. */
  readonly score: number;
  /** Sisa nyawa BERSAMA. Salah tap siapa pun mengurangi angka yang sama ini. */
  readonly lives: number;
  /** Isi penuh kolamnya — MP_STARTING_LIVES × jumlah anggota. */
  readonly maxLives: number;
  /** Target poin regu ini: target per pemain × jumlah anggotanya. */
  readonly targetScore: number;
  /** Sisa waktu beku SEREGU dalam ms; 0 = sedang bermain. */
  readonly frozenMs: number;
  readonly knockouts: number;
  readonly eliminated: boolean;
}

export interface TickPayload {
  readonly remainingMs: number;
  readonly level: number;
  /**
   * 0..1 menuju level berikutnya.
   *
   * Dikirim server dan tidak dihitung client dari `remainingMs`: level MP naik
   * dari waktu YANG SUDAH BERJALAN, sementara `remainingMs` menghitung mundur
   * batas waktu match. Menurunkan yang satu dari yang lain butuh batas waktu
   * room, dan itu tidak ada di payload ini.
   */
  readonly levelFraction: number;
  /** Sisa milidetik menuju level berikutnya. */
  readonly levelRemainingMs: number;
  readonly chaos: ChaosModifier | null;
  readonly scoreboard: readonly ScoreboardEntry[];
  /** Keadaan kedua regu; array kosong di match ffa. */
  readonly teams: readonly TeamScoreEntry[];
  /**
   * Warna target ikut di setiap tick, tidak hanya di `targetChanged`.
   *
   * Sengaja diulang: kalau satu event `targetChanged` hilang (koneksi seluler
   * putus sekejap), pemain akan mengejar warna yang salah tanpa tahu kenapa.
   * Tick membuat HUD selalu bisa pulih sendiri.
   */
  readonly targetColors: readonly Color[];
  /**
   * Tinta tiap kata target saat mode Stroop aktif; `null` sebelum itu.
   *
   * Dihitung SERVER dan disiarkan, tidak diturunkan tiap client: kalau setiap
   * client mengacak tintanya sendiri, dua pemain mengerjakan soal yang berbeda
   * sambil memperebutkan papan yang sama.
   */
  readonly stroopInk: readonly Color[] | null;
  /** Warna target akan berganti sebentar lagi — HUD memberi peringatan. */
  readonly targetImminent: boolean;
}

export interface MatchEndedPayload {
  readonly ranking: readonly MatchResultEntry[];
  /**
   * Hasil per regu, terurut dari yang menang; kosong di match ffa.
   *
   * `ranking` tetap berisi seluruh pemain apa adanya — statistik pribadi
   * (akurasi, combo terbaik) tidak berhenti berarti hanya karena menangnya
   * bersama-sama, dan orang tetap ingin tahu siapa penyumbang terbesar di
   * timnya.
   */
  readonly teams: readonly TeamResultEntry[];
  /** `elimination`: pemain tersisa tinggal satu karena yang lain tereliminasi. */
  readonly reason: 'targetScore' | 'timeUp' | 'suddenDeath' | 'elimination';
  /**
   * Lama match berjalan, dihitung dari akhir hitung mundur.
   *
   * Yang membuat match terasa seperti balapan: peringkat memberi tahu SIAPA
   * yang menang, angka ini memberi tahu SECEPAT APA — dan itu yang bisa dikejar
   * di ronde berikutnya. Selalu dikirim, tapi hanya bermakna sebagai catatan
   * waktu ketika `reason` adalah `targetScore`; kalau match habis waktu,
   * angkanya cuma sama dengan batas waktunya.
   */
  readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Map event — dipakai untuk mengetik Server & Socket di kedua sisi
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (result: Ack<JoinedRoom>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (result: Ack<JoinedRoom>) => void) => void;
  /**
   * Klaim kembali kursi yang masih ditahan setelah koneksi putus.
   *
   * Dibuat event tersendiri, bukan menumpang `room:join`: join yang gagal
   * karena room penuh atau match sudah jalan adalah keadaan normal yang perlu
   * ditampilkan ke pemain, sementara reconnect yang gagal berarti kursinya
   * sudah hangus dan pemain harus masuk dari awal. Menyatukan keduanya membuat
   * kedua kegagalan itu tidak bisa dibedakan.
   */
  'room:reconnect': (payload: ReconnectPayload, ack: (result: Ack<JoinedRoom>) => void) => void;
  /**
   * Minta potret papan saat ini. DIMINTA client, bukan dikirim server begitu
   * reconnect berhasil — kalau server yang mendorong, potretnya bisa tiba
   * sebelum komponen match terpasang dan listener-nya siap, lalu hilang.
   */
  'game:requestResync': (ack: (result: Ack<ResyncPayload | null>) => void) => void;
  /**
   * Kirim pesan ke lobby.
   *
   * Server yang memutuskan boleh atau tidak (lihat `Room.canChat`), bukan UI:
   * tombol yang dinonaktifkan di client bukan aturan, cuma petunjuk.
   */
  'chat:send': (payload: ChatSendPayload, ack: (result: Ack<null>) => void) => void;
  /**
   * Isi satu kursi kosong dengan lawan buatan. Host saja, dan hanya di lobby.
   *
   * Ada supaya kurang pemain tidak berarti tidak bisa main. Bot menempati kursi
   * SUNGGUHAN — ia ikut menghabiskan kapasitas room, jadi tidak ada cara
   * menumpuk lawan buatan di luar batas yang sama dengan pemain manusia.
   */
  'room:addBot': (payload: AddBotPayload, ack: (result: Ack<RoomState>) => void) => void;
  'room:removeBot': (payload: RemoveBotPayload, ack: (result: Ack<RoomState>) => void) => void;
  'room:leave': () => void;
  /**
   * Pemain selesai melihat layar hasil dan mau kembali ke lobby.
   *
   * Dibuat eksplisit karena server TIDAK boleh mengembalikan room ke `waiting`
   * begitu match selesai: client akan berpindah ke lobby sebelum sempat
   * menampilkan hasilnya.
   */
  'room:backToLobby': () => void;
  'room:updateSettings': (
    payload: UpdateSettingsPayload,
    ack: (result: Ack<RoomState>) => void,
  ) => void;
  /**
   * Pindah regu sendiri. Bukan hak host — pemain memilih sisinya sendiri.
   *
   * Hanya berarti di mode beregu dan hanya di lobby. Server tetap menolak
   * kalau regunya penuh, jadi client boleh menampilkan tombolnya dengan
   * optimis tanpa risiko menghasilkan keadaan yang tidak sah.
   */
  'room:setTeam': (payload: SetTeamPayload, ack: (result: Ack<RoomState>) => void) => void;
  'player:ready': (payload: ReadyPayload) => void;
  'game:start': (ack: (result: Ack<null>) => void) => void;
  'game:click': (payload: ClickPayload) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'chat:message': (message: ChatMessage) => void;
  /**
   * Server akan mati sebentar lagi (deploy ulang / restart).
   *
   * Dikirim SEBELUM koneksinya diputus, supaya client bisa menjelaskan apa yang
   * terjadi. Tanpa ini pemain hanya melihat "server tidak terjangkau" dan
   * menyimpulkan gamenya rusak.
   */
  'server:shutdown': () => void;
  /**
   * Pengukuran latensi. Client cukup memanggil ack-nya secepat mungkin; SERVER
   * yang menghitung selisihnya.
   *
   * Arahnya sengaja server → client. Kalau client yang mengukur lalu melapor,
   * angkanya jadi klaim yang tidak bisa diperiksa siapa pun.
   */
  'net:ping': (ack: () => void) => void;
  'game:countdown': (payload: { readonly seconds: number }) => void;
  'game:started': (payload: GameStartedPayload) => void;
  'game:pixelSpawned': (payload: PixelSpawnedPayload) => void;
  'game:pixelExpired': (payload: { readonly pixelId: string }) => void;
  'game:pixelClaimed': (payload: PixelClaimedPayload) => void;
  'game:clickRejected': (payload: ClickRejectedPayload) => void;
  'game:bombHit': (payload: BombHitPayload) => void;
  'game:targetChanged': (payload: TargetChangedPayload) => void;
  'game:boardShuffled': (payload: { readonly pixels: readonly Pixel[] }) => void;
  'game:tick': (payload: TickPayload) => void;
  'game:suddenDeath': () => void;
  /** Hanya ke pemain yang bersangkutan: dia keluar dari permainan. */
  'game:eliminated': () => void;
  'game:ended': (payload: MatchEndedPayload) => void;
  error: (payload: SocketError) => void;
}
