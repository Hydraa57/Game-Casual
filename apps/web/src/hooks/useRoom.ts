'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ack, RoomErrorCode, RoomSettings, RoomState } from '@pixelmatrix/shared';
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
  createRoom(nickname: string, settings?: Partial<RoomSettings>): Promise<boolean>;
  joinRoom(code: string, nickname: string): Promise<boolean>;
  leaveRoom(): void;
  backToLobby(): void;
  setReady(ready: boolean): void;
  updateSettings(settings: Partial<RoomSettings>): void;
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

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => setStatus('online'));
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', () => setStatus('offline'));
    socket.on('room:state', setRoom);
    socket.on('error', (payload) => setErrorCode(payload.code));

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
    async (nickname: string, settings?: Partial<RoomSettings>) => {
      const result = await request<{ roomCode: string; playerId: string; roomState: RoomState }>(
        (socket, resolve) => socket.emit('room:create', { nickname, settings }, resolve),
      );
      if (!result?.ok) return false;
      setPlayerId(result.data.playerId);
      setRoom(result.data.roomState);
      return true;
    },
    [request],
  );

  const joinRoom = useCallback(
    async (code: string, nickname: string) => {
      const result = await request<{ roomCode: string; playerId: string; roomState: RoomState }>(
        (socket, resolve) => socket.emit('room:join', { roomCode: code, nickname }, resolve),
      );
      if (!result?.ok) return false;
      setPlayerId(result.data.playerId);
      setRoom(result.data.roomState);
      return true;
    },
    [request],
  );

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave');
    setRoom(null);
    setPlayerId(null);
    setErrorCode(null);
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

  const startMatch = useCallback(async () => {
    const result = await request<null>((socket, resolve) => socket.emit('game:start', resolve));
    return result?.ok ?? false;
  }, [request]);

  const clearError = useCallback(() => setErrorCode(null), []);

  return useMemo(
    () => ({
      status,
      room,
      playerId,
      errorCode,
      busy,
      socket: socketRef.current,
      createRoom,
      joinRoom,
      leaveRoom,
      backToLobby,
      setReady,
      updateSettings,
      startMatch,
      clearError,
    }),
    [
      status,
      room,
      playerId,
      errorCode,
      busy,
      createRoom,
      joinRoom,
      leaveRoom,
      backToLobby,
      setReady,
      updateSettings,
      startMatch,
      clearError,
    ],
  );
}
