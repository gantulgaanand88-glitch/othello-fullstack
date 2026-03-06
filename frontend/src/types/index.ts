export type Player = 'black' | 'white';
export type Cell = Player | null;

export interface MoveRecord {
  player: Player;
  row: number;
  col: number;
  flipped: [number, number][];
  resultingPlayer: Player | null;
  blackScore: number;
  whiteScore: number;
  timestamp: string;
}

export interface GameState {
  board: Cell[][];
  currentPlayer: Player;
  legalMoves: [number, number][];
  moveHistory: MoveRecord[];
  blackScore: number;
  whiteScore: number;
  gameStatus: 'playing' | 'finished';
  winner: Player | 'draw' | null;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  rating: number;
  rank: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  isGuest?: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface LeaderboardEntry {
  id: string;
  position: number;
  username: string;
  rating: number;
  rank: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface OpponentSummary {
  id: string;
  username: string;
  rating: number;
}

export interface QueueJoinedEvent {
  joinedAt: number;
}

export interface GameFoundEvent {
  gameId: string;
  yourColor: Player;
  opponent: OpponentSummary;
  state: GameState;
}

export interface GameUpdateEvent {
  state: GameState;
  lastMove: MoveRecord | null;
  flipped: [number, number][];
}

export interface GameOverEvent {
  result: 'win' | 'loss' | 'draw';
  reason: string;
  winner: Player | 'draw' | null;
  finalState: GameState;
}

export interface RatingUpdateEvent {
  newRating: number;
  ratingChange: number;
}

export interface StoredGameResponse {
  _id: string;
  blackPlayer: {
    _id: string;
    username: string;
    rating: number;
  };
  whitePlayer: {
    _id: string;
    username: string;
    rating: number;
  };
  moves: Array<{
    player: Player;
    row: number;
    col: number;
    flipped: [number, number][];
    blackScore: number;
    whiteScore: number;
    timestamp: string;
  }>;
  result: Player | 'draw' | null;
  status: 'active' | 'finished' | 'abandoned';
  startTime: string;
  endTime: string | null;
  blackRatingChange: number;
  whiteRatingChange: number;
}

export function getPlayerRankLabel(rating: number): string {
  if (rating < 1000) {
    return 'Beginner';
  }

  if (rating < 1400) {
    return 'Intermediate';
  }

  if (rating < 1800) {
    return 'Advanced';
  }

  if (rating < 2200) {
    return 'Expert';
  }

  return 'Master';
}
