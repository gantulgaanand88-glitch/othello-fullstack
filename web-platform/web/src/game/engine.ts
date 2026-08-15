import type { ArenaGameState, Cell, Player } from './types';

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
] as const;

export function createOpeningState(): ArenaGameState {
  const board: Cell[] = Array.from({ length: 64 }, () => null);
  board[27] = 'white';
  board[28] = 'black';
  board[35] = 'black';
  board[36] = 'white';

  return {
    board,
    turn: 'black',
    legalMoves: legalMoves(board, 'black'),
    winner: null,
    status: 'playing',
    history: [],
    lastMove: null,
    blackMs: 300_000,
    whiteMs: 300_000,
  };
}

export function legalMoves(board: Cell[], player: Player): number[] {
  const moves: number[] = [];
  for (let square = 0; square < 64; square += 1) {
    if (flipsFor(board, square, player).length > 0) moves.push(square);
  }
  return moves;
}

export function flipsFor(board: Cell[], square: number, player: Player): number[] {
  if (square < 0 || square > 63 || board[square] !== null) return [];
  const opponent = player === 'black' ? 'white' : 'black';
  const row = Math.floor(square / 8);
  const col = square % 8;
  const flipped: number[] = [];

  for (const [rowDelta, colDelta] of DIRECTIONS) {
    let nextRow = row + rowDelta;
    let nextCol = col + colDelta;
    const captured: number[] = [];

    while (nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8) {
      const nextSquare = nextRow * 8 + nextCol;
      const cell = board[nextSquare];
      if (cell === opponent) {
        captured.push(nextSquare);
      } else {
        if (cell === player && captured.length > 0) flipped.push(...captured);
        break;
      }
      nextRow += rowDelta;
      nextCol += colDelta;
    }
  }

  return flipped;
}

export function playMove(state: ArenaGameState, square: number): ArenaGameState {
  if (state.status !== 'playing' || !state.legalMoves.includes(square)) return state;
  const flipped = flipsFor(state.board, square, state.turn);
  if (flipped.length === 0) return state;

  const board = [...state.board];
  board[square] = state.turn;
  for (const captured of flipped) board[captured] = state.turn;

  const opponent: Player = state.turn === 'black' ? 'white' : 'black';
  const opponentMoves = legalMoves(board, opponent);
  const currentMoves = legalMoves(board, state.turn);
  const boardFull = board.every(Boolean);
  const complete = boardFull || (opponentMoves.length === 0 && currentMoves.length === 0);
  const turn = opponentMoves.length > 0 ? opponent : state.turn;
  const counts = score(board);
  const winner = complete
    ? counts.black === counts.white
      ? 'draw'
      : counts.black > counts.white
        ? 'black'
        : 'white'
    : null;

  return {
    ...state,
    board,
    turn,
    legalMoves: complete ? [] : opponentMoves.length > 0 ? opponentMoves : currentMoves,
    winner,
    status: complete ? 'finished' : 'playing',
    history: [
      ...state.history,
      {
        ply: state.history.length + 1,
        player: state.turn,
        square,
        notation: squareToNotation(square),
        flipped,
      },
    ],
    lastMove: square,
  };
}

export function score(board: Cell[]): { black: number; white: number } {
  return board.reduce(
    (counts, cell) => {
      if (cell) counts[cell] += 1;
      return counts;
    },
    { black: 0, white: 0 },
  );
}

export function squareToNotation(square: number): string {
  return `${String.fromCharCode(65 + (square % 8))}${Math.floor(square / 8) + 1}`;
}
