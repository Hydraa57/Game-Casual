'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Ack,
  AvatarId,
  BotDifficulty,
  ChatMessage,
  JoinedRoom,
  RoomErrorCode,
  RoomSettings,
  RoomState,
} from '@pixelmatrix/shared';
import { CHAT_HISTORY_LIMIT } from '@pixelmatrix/shared';
import { clearRoomSession, readRoomSession, writeRoomSession } from '@/lib/roomSession';
import { createSocket } from '@/lib/socket';
import type { GameSocket } from '@/lib/socket';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface UseRoom {
  readonly status: ConnectionStatus;
  readonly room: RoomState | null;
  readonly playerId: string | null;
  readonly errorCode: RoomErrorCode | null;
  readonly busy: boolean;
  readonly socket: GameSocket | null;
  /**
   * Pemain baru saja kembali ke match yang sudah berjalan.
   *
   * Dipakai UI untuk memberi tahu bahwa ia melanjutkan, bukan memulai — tanpa
   * itu, papan yang tiba-tiba terisi di tengah permainan terasa seperti bug.
   */
  readonly reconnected: boolean;
  acknowledgeReconnect(): void;
  /** Server memberi tahu ia sedang di-restart; koneksi akan putus sebentar. */
  readonly restarting: boolean;
  readonly chat: readonly ChatMessage[];
  sendChat(text: string): void;
  createRoom(
    nickname: string,
    avatar: AvatarId,
    settings?: Partial<RoomSettings>,
  ): Promise<boolean>;
  joinRoom(code: string, nickname: string, avatar: AvatarId): Promise<boolean>;
  leaveRoom(): void;
  backToLobby(): void;
  setReady(ready: boolean): void;
  updateSettings(settings: Partial<RoomSettings>): void;
  /** Isi satu kursi kosong dengan lawan buatan (host saja, hanya di lobby). */
  addBot(difficulty: BotDifficulty): void;
  removeBot(botId: string): void;
  startMatch(): Promise<boolean>;
  clearError(): void;
}

/**
 * Mengelola satu koneksi Socket.IO untuk seluruh alur multiplayer.
 *
 * Sengaja tidak ada navigasi halaman antara "gabung" dan "lobby": pindah route
 * akan memutus socket dan memaksa join ulang. Kode room hanya muncul di URL
 * sebagai `?code=` untuk link undangan.
 */
export function useRoom(): UseRoom {
  const socketRef = useRef<GameSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<RoomErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [chat, setChat] = useState<readonly ChatMessage[]>([]);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    /**
     * Coba klaim kembali kursi lama SETIAP kali socket tersambung.
     *
     * Bukan sekali saat mount: Socket.IO menyambung ulang sendiri setelah
     * jaringan pulih, dan socket baru itu tidak tahu apa-apa soal kursi lama.
     * Tanpa dijalankan di setiap `connect`, pemain yang kehilangan sinyal
     * sebentar akan tetap terlihat "online" tapi tidak lagi terhubung ke
     * match-nya — keadaan paling membingungkan dari semua kemungkinan.
     */
    const reclaimSeat = (): void => {
      const saved = readRoomSession();
      if (saved === null) return;

      socket.emit('room:reconnect', { sessionKey: saved.sessionKey }, (result) => {
        if (!result.ok) {
          // Kursinya sudah hangus (masa tenggang habis, atau server restart).
          // Sisa sesi dibuang supaya tidak dicoba lagi setiap kali menyambung.
          clearRoomSession();
          return;
        }
        setPlayerId(result.data.playerId);
        setRoom(result.data.roomState);
        setChat(result.data.chat);
        setReconnected(true);
      });
    };

    socket.on('connect', () => {
      setStatus('online');
      // Kalau kita sampai di sini, restart-nya sudah selesai.
      setRestarting(false);
      reclaimSeat();
    });
    // Dikirim server sebelum ia menutup diri. Bedanya dengan `disconnect`
    // biasa: kita TAHU ini sementara dan disengaja, jadi pemain bisa diberi
    // tahu alih-alih dibiarkan menyimpulkan gamenya rusak.
    socket.on('server:shutdown', () => setRestarting(true));
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', () => setStatus('offline'));
    socket.on('room:state', setRoom);
    socket.on('chat:message', (message) => {
      // Dipotong di sisi client juga: server memang membatasi riwayat yang
      // DIKIRIM saat join, tapi lobby yang dibuka lama bisa mengumpulkan jauh
      // lebih banyak dari itu lewat event.
      setChat((current) => [...current, message].slice(-CHAT_HISTORY_LIMIT));
    });
    socket.on('error', (payload) => setErrorCode(payload.code));
    // Balas secepat mungkin dan jangan kerjakan apa pun di sini: apa pun yang
    // ditambahkan sebelum `ack()` akan ikut terhitung sebagai latensi jaringan
    // padahal itu waktu pemrosesan kita sendiri.
    socket.on('net:ping', (ack) => ack());

    if (process.env.NODE_ENV !== 'production') {
      // Kait uji end-to-end; tidak ada di build produksi.
      (window as unknown as { __pmSocket?: GameSocket }).__pmSocket = socket;
    }

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /**
   * Ambil token identitas sesaat sebelum create/join.
   *
   * Diambil di titik pemakaian, bukan disimpan saat mount: umurnya cuma satu
   * menit, dan pemain bisa duduk di halaman ini jauh lebih lama dari itu
   * sebelum menekan tombolnya.
   */
  const playerToken = useCallback(async (): Promise<string | undefined> => {
    try {
      const response = await fetch('/api/auth/socket-token');
      const data = (await response.json()) as { token: string | null };
      return data.token ?? undefined;
    } catch {
      // Gagal mengambil token = main sebagai guest. Bukan alasan untuk
      // menggagalkan pembuatan room.
      return undefined;
    }
  }, []);

  /** Bungkus satu panggilan ber-ack: kelola flag busy dan kode error di satu tempat. */
  const request = useCallback(
    async <T>(
      send: (socket: GameSocket, resolve: (result: Ack<T>) => void) => void,
    ): Promise<Ack<T> | null> => {
      const socket = socketRef.current;
      if (!socket) return null;

      setBusy(true);
      setErrorCode(null);
      try {
        const result = await new Promise<Ack<T>>((resolve) => send(socket, resolve));
        if (!result.ok) setErrorCode(result.error.code);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const createRoom = useCallback(
    async (nickname: string, avatar: AvatarId, settings?: Partial<RoomSettings>) => {
      const token = await playerToken();
      const result = await request<JoinedRoom>((socket, resolve) =>
        socket.emit('room:create', { nickname, avatar, settings, playerToken: token }, resolve),
      );
      if (!result?.ok) return false;
      setPlayerId(result.data.playerId);
      setRoom(result.data.roomState);
      writeRoomSession({ sessionKey: result.data.sessionKey, roomCode: result.data.roomCode });
      setChat(result.data.chat);
      return true;
    },
    [request, playerToken],
  );

  const joinRoom = useCallback(
    async (code: string, nickname: string, avatar: AvatarId) => {
      const token = await playerToken();
      const result = await request<JoinedRoom>((socket, resolve) =>
        socket.emit('room:join', { roomCode: code, nickname, avatar, playerToken: token }, resolve),
      );
      if (!result?.ok) return false;
      setPlayerId(result.data.playerId);
      setRoom(result.data.roomState);
      writeRoomSession({ sessionKey: result.data.sessionKey, roomCode: result.data.roomCode });
      setChat(result.data.chat);
      return true;
    },
    [request, playerToken],
  );

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave');
    // Sesi dibuang di sini dan BUKAN saat disconnect: keluar atas kemauan
    // sendiri berarti kursinya memang dilepas, sementara koneksi yang putus
    // justru kasus yang sesi ini ada untuk menanganinya.
    clearRoomSession();
    setRoom(null);
    setPlayerId(null);
    setErrorCode(null);
    setReconnected(false);
    setChat([]);
  }, []);

  /**
   * Menutup layar hasil. Server menahan room di status `finished` sampai ini
   * dikirim — kalau tidak, lobby muncul kembali sebelum hasilnya sempat dibaca.
   */
  const backToLobby = useCallback(() => {
    socketRef.current?.emit('room:backToLobby');
  }, []);

  const setReady = useCallback((ready: boolean) => {
    socketRef.current?.emit('player:ready', { ready });
  }, []);

  const updateSettings = useCallback(
    (settings: Partial<RoomSettings>) => {
      void request<RoomState>((socket, resolve) =>
        socket.emit('room:updateSettings', { settings }, resolve),
      );
    },
    [request],
  );

  const addBot = useCallback(
    (difficulty: BotDifficulty) => {
      void request<RoomState>((socket, resolve) =>
        socket.emit('room:addBot', { difficulty }, resolve),
      );
    },
    [request],
  );

  const removeBot = useCallback(
    (botId: string) => {
      void request<RoomState>((socket, resolve) =>
        socket.emit('room:removeBot', { botId }, resolve),
      );
    },
    [request],
  );

  const startMatch = useCallback(async () => {
    const result = await request<null>((socket, resolve) => socket.emit('game:start', resolve));
    return result?.ok ?? false;
  }, [request]);

  const clearError = useCallback(() => setErrorCode(null), []);

  const acknowledgeReconnect = useCallback(() => setReconnected(false), []);

  /**
   * Kirim pesan tanpa menunggu ack-nya.
   *
   * Pesan yang berhasil kembali sebagai `chat:message` ke seluruh room, termasuk
   * ke pengirimnya — jadi tidak ada gunanya menambahkannya dua kali secara
   * optimistis. Kalau server menolak (rate limit, match sudah mulai), yang
   * terjadi adalah pesannya tidak muncul, dan itu umpan balik yang cukup.
   */
  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit('chat:send', { text }, () => {});
  }, []);

  return useMemo(
    () => ({
      status,
      room,
      playerId,
      errorCode,
      busy,
      socket: socketRef.current,
      reconnected,
      acknowledgeReconnect,
      restarting,
      chat,
      sendChat,
      createRoom,
      joinRoom,
      leaveRoom,
      backToLobby,
      setReady,
      updateSettings,
      addBot,
      removeBot,
      startMatch,
      clearError,
    }),
    [
      status,
      room,
      playerId,
      errorCode,
      busy,
      reconnected,
      acknowledgeReconnect,
      restarting,
      chat,
      sendChat,
      createRoom,
      joinRoom,
      leaveRoom,
      backToLobby,
      setReady,
      updateSettings,
      addBot,
      removeBot,
      startMatch,
      clearError,
    ],
  );
}
