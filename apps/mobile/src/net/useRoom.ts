import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Ack,
  AvatarId,
  Cell,
  BotDifficulty,
  Color,
  JoinedRoom,
  MatchEndedPayload,
  Pixel,
  RoomErrorCode,
  RoomState,
  ScoreboardEntry,
} from '@pixelmatrix/shared';
import { buatSoket } from './socket';
import type { SoketGame } from './socket';

export type StatusKoneksi = 'menyambung' | 'tersambung' | 'putus';

/** Keadaan match yang sedang berjalan, dirakit dari event server. */
export interface KeadaanMatch {
  readonly pixels: readonly Pixel[];
  readonly targetColors: readonly Color[];
  readonly gridSize: number;
  readonly level: number;
  readonly levelFraction: number;
  readonly remainingMs: number;
  readonly scoreboard: readonly ScoreboardEntry[];
  readonly suddenDeath: boolean;
  readonly hitungMundur: number | null;
}

const MATCH_KOSONG: KeadaanMatch = {
  pixels: [],
  targetColors: [],
  gridSize: 8,
  level: 1,
  levelFraction: 0,
  remainingMs: 0,
  scoreboard: [],
  suddenDeath: false,
  hitungMundur: null,
};

/**
 * Satu koneksi Socket.IO untuk seluruh alur main bareng.
 *
 * **Server tidak diubah sama sekali.** Seluruh aturan rebutan pixel, skor,
 * nyawa, dan bot sudah diputuskan di `apps/game-server`; yang dilakukan hook
 * ini hanya menggambar apa yang dikirim server dan meneruskan ketukan pemain.
 * Itu juga yang membuat pemain Android dan pemain web bisa bermain di papan
 * yang sama tanpa satu baris pun kode server berubah.
 *
 * Bentuk event-nya diketik `ClientToServerEvents`/`ServerToClientEvents` dari
 * `@pixelmatrix/shared` — paket yang sama yang dipakai server dan klien web.
 * Jadi walaupun kode penyambungnya ditulis dua kali (di sini dan di
 * `apps/web/src/hooks/useRoom.ts`), KONTRAKNYA tidak bisa menyimpang: nama
 * event yang salah atau payload yang kurang satu field akan gagal typecheck.
 */
/**
 * Kejadian match yang layak digambar atau dibunyikan.
 *
 * Diteruskan sebagai callback, bukan disimpan di state: ini KEJADIAN. Menaruhnya
 * di state berarti layar harus menebak dari perubahan nilai kapan sesuatu baru
 * saja terjadi, dan tebakan itu gagal untuk dua kejadian identik berurutan.
 */
export interface PendengarMatch {
  onKlaim?: (
    cell: Cell,
    kind: Pixel['kind'],
    warna: Color,
    poin: number,
    olehSaya: boolean,
  ) => void;
  onSalah?: () => void;
  onBom?: () => void;
  onGantiTarget?: () => void;
}

export function useRoom(dengar: PendengarMatch = {}) {
  /*
    Pendengarnya dipegang di ref, bukan dipakai langsung di dalam effect.

    Effect koneksi sengaja hanya jalan SEKALI (dependensi kosong) — memasang
    ulang seluruh listener socket tiap render akan memutus dan menyambung
    kembali di tengah match. Ref membuat callback terbaru selalu terpakai tanpa
    effect itu perlu dijalankan ulang.
  */
  const dengarRef = useRef(dengar);
  dengarRef.current = dengar;

  const soketRef = useRef<SoketGame | null>(null);

  const [status, setStatus] = useState<StatusKoneksi>('menyambung');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  /** Dibaca dari dalam listener socket, yang tidak ikut render. */
  const idSayaRef = useRef<string | null>(null);
  const [kodeGalat, setKodeGalat] = useState<RoomErrorCode | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [match, setMatch] = useState<KeadaanMatch>(MATCH_KOSONG);
  const [hasil, setHasil] = useState<MatchEndedPayload | null>(null);

  // ------------------------------------------------------------------ koneksi

  useEffect(() => {
    const soket = buatSoket();
    soketRef.current = soket;

    soket.on('connect', () => setStatus('tersambung'));
    soket.on('disconnect', () => setStatus('putus'));
    soket.on('connect_error', () => setStatus('putus'));
    soket.on('room:state', setRoom);
    soket.on('error', (payload) => setKodeGalat(payload.code));

    // Server yang mengukur latensi, client cukup membalas secepat mungkin.
    // Kalau client yang mengukur lalu melapor, angkanya jadi klaim yang tidak
    // bisa diperiksa siapa pun.
    soket.on('net:ping', (ack) => ack());

    soket.on('game:countdown', ({ seconds }) => setMatch((m) => ({ ...m, hitungMundur: seconds })));

    soket.on('game:started', (p) => {
      setHasil(null);
      setMatch({
        ...MATCH_KOSONG,
        targetColors: p.targetColors,
        gridSize: p.gridSize,
        level: p.level,
        hitungMundur: null,
      });
    });

    soket.on('game:pixelSpawned', ({ pixel }) =>
      setMatch((m) => ({ ...m, pixels: [...m.pixels, pixel] })),
    );

    soket.on('game:pixelExpired', ({ pixelId }) =>
      setMatch((m) => ({ ...m, pixels: m.pixels.filter((p) => p.id !== pixelId) })),
    );

    soket.on('game:pixelClaimed', (p) => {
      setMatch((m) => {
        const diambil = m.pixels.find((x) => x.id === p.pixelId);
        // Jenis DAN warna pixelnya dibaca dari papan LOKAL: membacanya dari
        // papan yang sedang digambar menjamin semburannya berwarna sama dengan
        // pixel yang benar-benar dilihat pemain sesaat sebelumnya.
        //
        // Cadangannya warna target pertama, bukan warna tetap — pixel yang
        // direbut PASTI salah satu warna target, jadi tebakan itu benar
        // kecuali saat modifier dua-target sedang aktif. Cadangan ini baru
        // terpakai kalau eventnya mendahului papan lokalnya sendiri.
        dengarRef.current.onKlaim?.(
          p.cell,
          diambil?.kind ?? 'normal',
          diambil?.color ?? m.targetColors[0] ?? 'red',
          p.points,
          p.byPlayerId === idSayaRef.current,
        );
        return { ...m, pixels: m.pixels.filter((x) => x.id !== p.pixelId) };
      });
    });

    soket.on('game:bombHit', ({ pixelId }) => {
      dengarRef.current.onBom?.();
      setMatch((m) => ({ ...m, pixels: m.pixels.filter((p) => p.id !== pixelId) }));
    });

    // Ditolak karena warnanya salah: satu-satunya penolakan yang benar-benar
    // kesalahan pemain. `notFound` dan `tooLate` itu tap yang datang telat
    // sedikit — wajar di papan rebutan, dan menghukumnya terasa tidak adil.
    soket.on('game:clickRejected', (p) => {
      if (p.reason === 'wrongColor') dengarRef.current.onSalah?.();
    });

    soket.on('game:targetChanged', ({ colors }) => {
      dengarRef.current.onGantiTarget?.();
      setMatch((m) => ({ ...m, targetColors: colors }));
    });

    soket.on('game:boardShuffled', ({ pixels }) => setMatch((m) => ({ ...m, pixels })));

    soket.on('game:tick', (p) =>
      setMatch((m) => ({
        ...m,
        remainingMs: p.remainingMs,
        level: p.level,
        levelFraction: p.levelFraction,
        scoreboard: p.scoreboard,
        hitungMundur: null,
      })),
    );

    soket.on('game:suddenDeath', () => setMatch((m) => ({ ...m, suddenDeath: true })));

    soket.on('game:ended', (p) => {
      setHasil(p);
      setMatch((m) => ({ ...m, pixels: [] }));
    });

    return () => {
      soket.removeAllListeners();
      soket.disconnect();
      soketRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------ perintah

  /**
   * Bungkus satu perintah ber-ack supaya `sibuk` dan galatnya seragam.
   *
   * Bentuk balasannya `Ack<T>` dari paket bersama — sama persis dengan yang
   * dikirim server, jadi cabang gagalnya tidak mungkin salah dibaca.
   */
  const minta = useCallback(<T>(jalankan: (s: SoketGame, balas: (a: Ack<T>) => void) => void) => {
    const soket = soketRef.current;
    if (!soket) return Promise.resolve<T | null>(null);

    setSibuk(true);
    setKodeGalat(null);

    return new Promise<T | null>((resolve) => {
      jalankan(soket, (balasan) => {
        setSibuk(false);
        if (balasan.ok) {
          resolve(balasan.data);
          return;
        }
        setKodeGalat(balasan.error.code);
        resolve(null);
      });
    });
  }, []);

  const buatRoom = useCallback(
    async (nickname: string, avatar: AvatarId) => {
      const data = await minta<JoinedRoom>((s, balas) =>
        s.emit('room:create', { nickname, avatar }, balas),
      );
      if (data !== null) {
        setPlayerId(data.playerId);
        idSayaRef.current = data.playerId;
        setRoom(data.roomState);
      }
      return data !== null;
    },
    [minta],
  );

  const gabungRoom = useCallback(
    async (roomCode: string, nickname: string, avatar: AvatarId) => {
      const data = await minta<JoinedRoom>((s, balas) =>
        // Kode room selalu huruf besar di server; membiarkan pemain mengetik
        // huruf kecil lalu menolaknya adalah kegagalan yang tidak perlu ada.
        s.emit('room:join', { roomCode: roomCode.trim().toUpperCase(), nickname, avatar }, balas),
      );
      if (data !== null) {
        setPlayerId(data.playerId);
        idSayaRef.current = data.playerId;
        setRoom(data.roomState);
      }
      return data !== null;
    },
    [minta],
  );

  const setSiap = useCallback((siap: boolean) => {
    soketRef.current?.emit('player:ready', { ready: siap });
  }, []);

  const tambahBot = useCallback(
    (difficulty: BotDifficulty) => {
      void minta<RoomState>((s, balas) => s.emit('room:addBot', { difficulty }, balas));
    },
    [minta],
  );

  const mulaiMatch = useCallback(async () => {
    // `data` untuk perintah ini memang `null` saat sukses, jadi keberhasilannya
    // tidak bisa dibaca dari nilainya. Yang menandai gagal adalah kode galat.
    setKodeGalat(null);
    await minta<null>((s, balas) => s.emit('game:start', balas));
  }, [minta]);

  const tap = useCallback((pixelId: string) => {
    // `clientTs` hanya telemetri — server TIDAK memercayainya untuk skor, dan
    // memang tidak boleh: waktu yang dikirim client bisa dikarang.
    soketRef.current?.emit('game:click', { pixelId, clientTs: Date.now() });
  }, []);

  const kembaliKeLobby = useCallback(() => {
    setHasil(null);
    soketRef.current?.emit('room:backToLobby');
  }, []);

  const keluarRoom = useCallback(() => {
    soketRef.current?.emit('room:leave');
    setRoom(null);
    setPlayerId(null);
    setHasil(null);
    setMatch(MATCH_KOSONG);
  }, []);

  const bersihkanGalat = useCallback(() => setKodeGalat(null), []);

  return {
    status,
    room,
    playerId,
    kodeGalat,
    sibuk,
    match,
    hasil,
    buatRoom,
    gabungRoom,
    setSiap,
    tambahBot,
    mulaiMatch,
    tap,
    kembaliKeLobby,
    keluarRoom,
    bersihkanGalat,
  };
}
