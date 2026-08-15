import type { Cell, Player } from '../game/types';

export const PROTOCOL_VERSION = 1 as const;

export type QueueMode = 'casual' | 'ranked';
export type ColorChoice = Player | 'random';

export interface ClockSnapshot {
  black_ms: number;
  white_ms: number;
  running: Player | null;
  server_now: number;
}

export interface MoveSnapshot {
  ply: number;
  player: Player;
  square: number;
  flipped: number[];
  played_at: number;
}

export interface GameSnapshot {
  game_id: string;
  revision: number;
  board: Cell[];
  turn: Player;
  legal_moves: number[];
  black_score: number;
  white_score: number;
  winner: Player | 'draw' | null;
  last_move: MoveSnapshot | null;
  clock: ClockSnapshot;
}

export interface PlayerSummary {
  id: string;
  username: string;
  rating: number;
  title: string | null;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  sent_at: number;
}

export interface LiveGame {
  game_id: string;
  black: PlayerSummary;
  white: PlayerSummary;
  black_score: number;
  white_score: number;
  spectators: number;
}

export type ClientMessage =
  | { type: 'ping'; payload: { sent_at: number } }
  | { type: 'queue_join'; payload: { mode: QueueMode } }
  | { type: 'queue_leave' }
  | { type: 'room_create' }
  | { type: 'room_join'; payload: { code: string } }
  | { type: 'bot_start'; payload: { level: number; color: ColorChoice } }
  | { type: 'game_resume'; payload: { game_id: string; last_revision: number } }
  | { type: 'move'; payload: { square: number; command_id: string } }
  | { type: 'resign'; payload: { command_id: string } }
  | { type: 'draw_offer'; payload: { command_id: string } }
  | { type: 'draw_response'; payload: { accept: boolean; command_id: string } }
  | { type: 'rematch'; payload: { command_id: string } }
  | { type: 'chat'; payload: { body: string; command_id: string } }
  | { type: 'spectate'; payload: { game_id: string } }
  | { type: 'list_live_games' };

export type ServerMessage =
  | { type: 'connected'; payload: { protocol: number; connection_id: string; role?: Player | null } }
  | { type: 'pong'; payload: { sent_at: number } }
  | { type: 'error'; payload: { code: string; message: string; command_id: string | null } }
  | { type: 'queue_joined'; payload: { joined_at: number; mode: QueueMode } }
  | { type: 'queue_left' }
  | { type: 'room_created'; payload: { code: string } }
  | { type: 'match_found'; payload: { game_id: string; ticket: string; color: Player; opponent: PlayerSummary; snapshot: GameSnapshot } }
  | { type: 'snapshot'; payload: GameSnapshot }
  | { type: 'game_finished'; payload: { snapshot: GameSnapshot; reason: string } }
  | { type: 'presence'; payload: { user_id: string; online: boolean; reconnect_deadline: number | null } }
  | { type: 'chat'; payload: ChatMessage }
  | { type: 'draw_offered'; payload: { by: Player } }
  | { type: 'draw_declined' }
  | { type: 'rematch_requested'; payload: { by: Player } }
  | { type: 'live_games'; payload: { games: LiveGame[] } };

export function isServerMessage(value: unknown): value is ServerMessage {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}
