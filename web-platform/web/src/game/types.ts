export type Player = 'black' | 'white';
export type Cell = Player | null;

export interface MoveRecord {
  ply: number;
  player: Player;
  square: number;
  notation: string;
  flipped: number[];
}

export interface ArenaGameState {
  board: Cell[];
  turn: Player;
  legalMoves: number[];
  winner: Player | 'draw' | null;
  status: 'playing' | 'finished';
  history: MoveRecord[];
  lastMove: number | null;
  blackMs: number;
  whiteMs: number;
}
