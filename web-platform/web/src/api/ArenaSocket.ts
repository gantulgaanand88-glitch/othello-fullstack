import type { ClientMessage, GameSnapshot, ServerMessage } from './protocol';
import { isServerMessage, PROTOCOL_VERSION } from './protocol';
import type { Player } from '../game/types';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ArenaSocketHandlers {
  onState?: (state: ConnectionState) => void;
  onMessage?: (message: ServerMessage) => void;
  onSnapshot?: (snapshot: GameSnapshot) => void;
  onRole?: (role: Player | null) => void;
  onError?: (message: string) => void;
}

const MAX_BACKOFF_MS = 10_000;
const OUTBOX_LIMIT = 64;

function websocketOrigin(origin: string) {
  const url = new URL(origin, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}

export class ArenaSocket {
  readonly gameId: string;
  private readonly handlers: ArenaSocketHandlers;
  private readonly endpoint: string;
  private socket: WebSocket | null = null;
  private outbox: ClientMessage[] = [];
  private retry = 0;
  private retryTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private intentionallyClosed = false;
  private revision = 0;

  constructor(gameId: string, handlers: ArenaSocketHandlers = {}, origin = import.meta.env.VITE_ARENA_ORIGIN ?? window.location.origin) {
    this.gameId = gameId;
    this.handlers = handlers;
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get('ticket');
    const credentials = ticket ? `?ticket=${encodeURIComponent(ticket)}` : '';
    this.endpoint = `${websocketOrigin(origin)}/ws/game/${encodeURIComponent(gameId)}${credentials}`;
  }

  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.intentionallyClosed = false;
    this.handlers.onState?.(this.retry ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(this.endpoint, [`othello.v${PROTOCOL_VERSION}`]);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.retry = 0;
      this.handlers.onState?.('open');
      this.sendNow({ type: 'game_resume', payload: { game_id: this.gameId, last_revision: this.revision } });
      for (const message of this.outbox.splice(0)) this.sendNow(message);
      this.scheduleHeartbeat();
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || event.data.length > 256_000) return;
      try {
        const message: unknown = JSON.parse(event.data);
        if (!isServerMessage(message)) return;
        this.handlers.onMessage?.(message);
        if (message.type === 'snapshot') this.acceptSnapshot(message.payload);
        if (message.type === 'game_finished') this.acceptSnapshot(message.payload.snapshot);
        if (message.type === 'connected') this.handlers.onRole?.(message.payload.role ?? null);
        if (message.type === 'connected' && message.payload.protocol !== PROTOCOL_VERSION) {
          this.handlers.onError?.(`Protocol mismatch: server v${message.payload.protocol}, client v${PROTOCOL_VERSION}`);
          this.close();
        }
        if (message.type === 'error') this.handlers.onError?.(message.payload.message);
      } catch {
        this.handlers.onError?.('The server sent an unreadable realtime message.');
      }
    });

    socket.addEventListener('close', () => {
      this.clearHeartbeat();
      this.socket = null;
      if (this.intentionallyClosed) {
        this.handlers.onState?.('closed');
        return;
      }
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      this.handlers.onError?.('Realtime connection interrupted. Reconnecting…');
    });
  }

  move(square: number) {
    if (!Number.isInteger(square) || square < 0 || square > 63) return;
    this.send({ type: 'move', payload: { square, command_id: crypto.randomUUID() } });
  }

  resign() {
    this.send({ type: 'resign', payload: { command_id: crypto.randomUUID() } });
  }

  offerDraw() {
    this.send({ type: 'draw_offer', payload: { command_id: crypto.randomUUID() } });
  }

  chat(body: string) {
    const normalized = body.trim().slice(0, 500);
    if (normalized) this.send({ type: 'chat', payload: { body: normalized, command_id: crypto.randomUUID() } });
  }

  close() {
    this.intentionallyClosed = true;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.clearHeartbeat();
    this.socket?.close(1000, 'client closed');
    this.socket = null;
    this.handlers.onState?.('closed');
  }

  private acceptSnapshot(snapshot: GameSnapshot) {
    if (snapshot.game_id !== this.gameId || snapshot.revision < this.revision) return;
    this.revision = snapshot.revision;
    this.handlers.onSnapshot?.(snapshot);
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendNow(message);
      return;
    }
    if (this.outbox.length >= OUTBOX_LIMIT) this.outbox.shift();
    this.outbox.push(message);
  }

  private sendNow(message: ClientMessage) {
    this.socket?.send(JSON.stringify(message));
  }

  private scheduleReconnect() {
    const delay = Math.min(MAX_BACKOFF_MS, 400 * 2 ** this.retry) * (0.8 + Math.random() * 0.4);
    this.retry += 1;
    this.handlers.onState?.('reconnecting');
    this.retryTimer = window.setTimeout(() => this.connect(), delay);
  }

  private scheduleHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.sendNow({ type: 'ping', payload: { sent_at: Date.now() } });
    }, 25_000);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
