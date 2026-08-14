import type { ConnectionState } from './ArenaSocket';
import type { ClientMessage, ColorChoice, QueueMode, ServerMessage } from './protocol';
import { isServerMessage, PROTOCOL_VERSION } from './protocol';

export interface LobbySocketHandlers {
  onState?: (state: ConnectionState) => void;
  onMessage?: (message: ServerMessage) => void;
  onError?: (message: string) => void;
}

function websocketOrigin(origin: string) {
  const url = new URL(origin, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}

export class LobbySocket {
  private readonly handlers: LobbySocketHandlers;
  private readonly endpoint: string;
  private socket: WebSocket | null = null;
  private pending: ClientMessage | null = null;
  private reconnectTimer: number | null = null;
  private retry = 0;
  private closed = false;

  constructor(handlers: LobbySocketHandlers = {}, origin = import.meta.env.VITE_ARENA_ORIGIN ?? window.location.origin) {
    this.handlers = handlers;
    this.endpoint = `${websocketOrigin(origin)}/ws/lobby`;
  }

  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.closed = false;
    this.handlers.onState?.(this.retry ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(this.endpoint, [`othello.v${PROTOCOL_VERSION}`]);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.retry = 0;
      this.handlers.onState?.('open');
      if (this.pending) socket.send(JSON.stringify(this.pending));
    });
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || event.data.length > 256_000) return;
      try {
        const message: unknown = JSON.parse(event.data);
        if (!isServerMessage(message)) return;
        this.handlers.onMessage?.(message);
        if (message.type === 'connected' && message.payload.protocol !== PROTOCOL_VERSION) {
          this.handlers.onError?.(`Protocol mismatch: server v${message.payload.protocol}, client v${PROTOCOL_VERSION}`);
          this.close();
        }
        if (message.type === 'error') this.handlers.onError?.(message.payload.message);
        if (message.type === 'match_found') this.pending = null;
      } catch {
        this.handlers.onError?.('The lobby sent an unreadable message.');
      }
    });
    socket.addEventListener('close', () => {
      this.socket = null;
      if (this.closed) return;
      this.handlers.onState?.('reconnecting');
      const delay = Math.min(8_000, 400 * 2 ** this.retry) * (0.8 + Math.random() * 0.4);
      this.retry += 1;
      this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
    });
    socket.addEventListener('error', () => this.handlers.onError?.('Lobby connection interrupted.'));
  }

  joinQueue(mode: QueueMode) {
    this.sendOrRemember({ type: 'queue_join', payload: { mode } });
  }

  startBot(level: number, color: ColorChoice = 'random') {
    this.sendOrRemember({ type: 'bot_start', payload: { level, color } });
  }

  createRoom() {
    this.sendOrRemember({ type: 'room_create' });
  }

  joinRoom(code: string) {
    this.sendOrRemember({ type: 'room_join', payload: { code } });
  }

  close() {
    this.closed = true;
    this.pending = null;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, 'client closed');
    this.socket = null;
    this.handlers.onState?.('closed');
  }

  private sendOrRemember(message: ClientMessage) {
    this.pending = message;
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
