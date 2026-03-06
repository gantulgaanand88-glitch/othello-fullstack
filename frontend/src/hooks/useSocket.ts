import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const connect = useCallback((token: string): Socket => {
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
        autoConnect: false,
        transports: ['websocket'],
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        socketRef.current?.emit('authenticate', { token });
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });
    }

    if (!socketRef.current.connected) {
      socketRef.current.connect();
    } else {
      socketRef.current.emit('authenticate', { token });
    }

    return socketRef.current;
  }, []);

  const disconnect = useCallback((): void => {
    socketRef.current?.disconnect();
  }, []);

  const emit = useCallback((event: string, payload?: unknown): void => {
    socketRef.current?.emit(event, payload);
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
  };
}
