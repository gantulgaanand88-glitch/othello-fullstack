/**
 * Othello / Reversi — Pure Game Engine
 * Shared between frontend (optimistic UI) and backend (authoritative validation).
 * Zero dependencies. No side effects. All functions are pure.
 */

export type Player     = 'black' | 'white';
export type Cell       = Player | null;
export type Board      = Cell[][];
export type GameStatus = 'playing' | 'finished';

export interface MoveRecord {
  player:          Player;
  row:             number;
  col:             number;
  flipped:         [number, number][];
  resultingPlayer: Player | null;
  blackScore:      number;
  whiteScore:      number;
  timestamp:       string;
}

export interface GameState {
  board:         Cell[][];
  currentPlayer: Player;
  legalMoves:    [number, number][];
  moveHistory:   MoveRecord[];
  blackScore:    number;
  whiteScore:    number;
  gameStatus:    GameStatus;
  winner:        Player | 'draw' | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BOARD_SIZE = 8;

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function opponent(player: Player): Player {
  return player === 'black' ? 'white' : 'black';
}

function cloneBoard(board: Board): Board {
  return board.map(row => [...row]);
}

function isFull(board: Board): boolean {
  return board.every(row => row.every(cell => cell !== null));
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array<Cell>(BOARD_SIZE).fill(null),
  );
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';
  return board;
}

/**
 * Returns all pieces that would flip if `player` places at (row, col).
 * Returns an empty array if the move is illegal.
 */
export function getFlippedPieces(
  board: Board,
  row: number,
  col: number,
  player: Player,
): [number, number][] {
  if (!inBounds(row, col) || board[row][col] !== null) return [];

  const opp    = opponent(player);
  const flipped: [number, number][] = [];

  for (const [dr, dc] of DIRECTIONS) {
    const line: [number, number][] = [];
    let r = row + dr;
    let c = col + dc;

    while (inBounds(r, c) && board[r][c] === opp) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }

    // Only commit the line if it ends on one of our pieces
    if (line.length > 0 && inBounds(r, c) && board[r][c] === player) {
      flipped.push(...line);
    }
  }

  return flipped;
}

/**
 * Returns all legal moves for `player` on the current board.
 */
export function getLegalMoves(board: Board, player: Player): [number, number][] {
  const moves: [number, number][] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null && getFlippedPieces(board, r, c, player).length > 0) {
        moves.push([r, c]);
      }
    }
  }

  return moves;
}

/**
 * Counts pieces for each player.
 */
export function countPieces(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') black++;
      else if (cell === 'white') white++;
    }
  }
  return { black, white };
}

/**
 * Applies a move to the game state and returns the new state.
 * Returns `{ valid: false }` if the move is illegal.
 *
 * This is the single source of truth for move processing.
 */
export function applyMove(
  state: GameState,
  row: number,
  col: number,
): { newState: GameState; flipped: [number, number][]; valid: true } | { valid: false } {
  const flipped = getFlippedPieces(state.board, row, col, state.currentPlayer);

  if (flipped.length === 0) return { valid: false };

  // Build new board
  const newBoard = cloneBoard(state.board);
  newBoard[row][col] = state.currentPlayer;
  for (const [r, c] of flipped) {
    newBoard[r][c] = state.currentPlayer;
  }

  const { black: blackScore, white: whiteScore } = countPieces(newBoard);

  // Determine next player — skip if opponent has no moves
  const opp        = opponent(state.currentPlayer);
  let nextPlayer: Player = opp;
  let nextLegal    = getLegalMoves(newBoard, opp);

  if (nextLegal.length === 0) {
    // Opponent has no moves — check if current player can continue
    nextLegal = getLegalMoves(newBoard, state.currentPlayer);
    if (nextLegal.length === 0) {
      // Nobody can move → game over
      const winner: Player | 'draw' | null =
        blackScore > whiteScore ? 'black'
        : whiteScore > blackScore ? 'white'
        : 'draw';

      const record: MoveRecord = {
        player:          state.currentPlayer,
        row, col,
        flipped,
        resultingPlayer: null,
        blackScore,
        whiteScore,
        timestamp:       new Date().toISOString(),
      };

      return {
        valid: true,
        flipped,
        newState: {
          board:         newBoard,
          currentPlayer: state.currentPlayer,
          legalMoves:    [],
          moveHistory:   [...state.moveHistory, record],
          blackScore,
          whiteScore,
          gameStatus:    'finished',
          winner,
        },
      };
    }
    // Current player continues
    nextPlayer = state.currentPlayer;
  }

  // Also handle board-full termination
  if (isFull(newBoard)) {
    const winner: Player | 'draw' | null =
      blackScore > whiteScore ? 'black'
      : whiteScore > blackScore ? 'white'
      : 'draw';

    const record: MoveRecord = {
      player:          state.currentPlayer,
      row, col,
      flipped,
      resultingPlayer: null,
      blackScore,
      whiteScore,
      timestamp:       new Date().toISOString(),
    };

    return {
      valid: true,
      flipped,
      newState: {
        board:         newBoard,
        currentPlayer: state.currentPlayer,
        legalMoves:    [],
        moveHistory:   [...state.moveHistory, record],
        blackScore,
        whiteScore,
        gameStatus:    'finished',
        winner,
      },
    };
  }

  const record: MoveRecord = {
    player:          state.currentPlayer,
    row, col,
    flipped,
    resultingPlayer: nextPlayer,
    blackScore,
    whiteScore,
    timestamp:       new Date().toISOString(),
  };

  return {
    valid: true,
    flipped,
    newState: {
      board:         newBoard,
      currentPlayer: nextPlayer,
      legalMoves:    nextLegal,
      moveHistory:   [...state.moveHistory, record],
      blackScore,
      whiteScore,
      gameStatus:    'playing',
      winner:        null,
    },
  };
}

/**
 * Creates a fresh initial game state for a new match.
 */
export function createInitialGameState(): GameState {
  const board      = createInitialBoard();
  const legalMoves = getLegalMoves(board, 'black');
  const { black: blackScore, white: whiteScore } = countPieces(board);

  return {
    board,
    currentPlayer: 'black',
    legalMoves,
    moveHistory:   [],
    blackScore,
    whiteScore,
    gameStatus:    'playing',
    winner:        null,
  };
}

// ─── Alias for backend compatibility ─────────────────────────────────────────
// The backend calls processMove() — re-export applyMove under that name.
export const processMove = (
  state: GameState,
  row: number,
  col: number,
) => applyMove(state, row, col);
