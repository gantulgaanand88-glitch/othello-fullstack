import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const gameIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const setGameId = useCallback((gameId: string | null) => {
    gameIdRef.current = gameId;
  }, []);

  const connect = useCallback((token: string): Socket => {
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
        autoConnect: false,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        auth: { token }, // Pass token directly in handshake auth
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('[useSocket] Connection error:', err.message);
        setIsConnected(false);
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        // Automatically rejoin game on reconnect if one is in progress
        if (gameIdRef.current) {
          socketRef.current?.emit('rejoinGame', { gameId: gameIdRef.current });
        }
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });
    }

    // If handshake token has changed, update it
    if (socketRef.current.auth) {
      socketRef.current.auth = { token };
    }

    if (!socketRef.current.connected) {
      socketRef.current.connect();
    }

    return socketRef.current;
  }, []);

  const disconnect = useCallback((): void => {
    socketRef.current?.disconnect();
    setIsConnected(false);
  }, []);

  const emit = useCallback((event: string, payload?: unknown): void => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, payload);
    } else {
      console.warn(`[useSocket] Discarded emit: event "${event}" because socket is not connected.`);
    }
  }, []);

  const on = useCallback(<T,>(event: string, handler: (payload: T) => void): (() => void) => {
    const listener = (payload: T) => handler(payload);
    socketRef.current?.on(event, listener);

    return () => {
      socketRef.current?.off(event, listener);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    setGameId, // Expose to let game component track current gameId
  };
}

export default useSocket;
