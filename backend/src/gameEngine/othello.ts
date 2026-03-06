export type Player = 'black' | 'white';
export type Cell = Player | null;
export type Board = Cell[][];
export type GameStatus = 'playing' | 'finished';

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
  gameStatus: GameStatus;
  winner: Player | 'draw' | null;
}

const BOARD_SIZE = 8;
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): Cell => null),
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function isWithinBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getOpponent(player: Player): Player {
  return player === 'black' ? 'white' : 'black';
}

function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

export function createInitialBoard(): Board {
  const board = createEmptyBoard();

  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';

  return board;
}

export function getFlippedPieces(
  board: Board,
  row: number,
  col: number,
  player: Player,
): [number, number][] {
  if (!isWithinBounds(row, col) || board[row][col] !== null) {
    return [];
  }

  const opponent = getOpponent(player);
  const flipped: [number, number][] = [];

  for (const [rowDelta, colDelta] of DIRECTIONS) {
    const line: [number, number][] = [];
    let currentRow = row + rowDelta;
    let currentCol = col + colDelta;

    while (isWithinBounds(currentRow, currentCol)) {
      const currentCell = board[currentRow][currentCol];

      if (currentCell === opponent) {
        line.push([currentRow, currentCol]);
        currentRow += rowDelta;
        currentCol += colDelta;
        continue;
      }

      if (currentCell === player && line.length > 0) {
        flipped.push(...line);
      }

      break;
    }
  }

  return flipped;
}

export function getLegalMoves(board: Board, player: Player): [number, number][] {
  const legalMoves: [number, number][] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== null) {
        continue;
      }

      if (getFlippedPieces(board, row, col, player).length > 0) {
        legalMoves.push([row, col]);
      }
    }
  }

  return legalMoves;
}

export function applyMove(board: Board, row: number, col: number, player: Player): Board {
  const flipped = getFlippedPieces(board, row, col, player);

  if (flipped.length === 0) {
    throw new Error(`Invalid move at (${row}, ${col}) for player ${player}.`);
  }

  const nextBoard = cloneBoard(board);
  nextBoard[row][col] = player;

  for (const [flippedRow, flippedCol] of flipped) {
    nextBoard[flippedRow][flippedCol] = player;
  }

  return nextBoard;
}

export function hasValidMoves(board: Board, player: Player): boolean {
  return getLegalMoves(board, player).length > 0;
}

export function calculateScore(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;

  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') {
        black += 1;
      } else if (cell === 'white') {
        white += 1;
      }
    }
  }

  return { black, white };
}

export function checkGameOver(board: Board): {
  isOver: boolean;
  winner: Player | 'draw' | null;
} {
  const blackHasMoves = hasValidMoves(board, 'black');
  const whiteHasMoves = hasValidMoves(board, 'white');

  if (!isBoardFull(board) && (blackHasMoves || whiteHasMoves)) {
    return { isOver: false, winner: null };
  }

  const { black, white } = calculateScore(board);

  if (black === white) {
    return { isOver: true, winner: 'draw' };
  }

  return {
    isOver: true,
    winner: black > white ? 'black' : 'white',
  };
}

export function processMove(
  state: GameState,
  row: number,
  col: number,
): {
  newState: GameState;
  flipped: [number, number][];
  valid: boolean;
} {
  if (state.gameStatus !== 'playing') {
    return {
      newState: state,
      flipped: [],
      valid: false,
    };
  }

  const flipped = getFlippedPieces(state.board, row, col, state.currentPlayer);

  if (flipped.length === 0) {
    return {
      newState: state,
      flipped: [],
      valid: false,
    };
  }

  const updatedBoard = applyMove(state.board, row, col, state.currentPlayer);
  const scores = calculateScore(updatedBoard);
  const opponent = getOpponent(state.currentPlayer);
  const opponentLegalMoves = getLegalMoves(updatedBoard, opponent);
  const currentPlayerLegalMoves = getLegalMoves(updatedBoard, state.currentPlayer);

  let nextPlayer = opponent;
  let nextLegalMoves = opponentLegalMoves;

  if (opponentLegalMoves.length === 0 && currentPlayerLegalMoves.length > 0) {
    nextPlayer = state.currentPlayer;
    nextLegalMoves = currentPlayerLegalMoves;
  }

  const gameOver = checkGameOver(updatedBoard);
  const newState: GameState = {
    board: updatedBoard,
    currentPlayer: nextPlayer,
    legalMoves: gameOver.isOver ? [] : nextLegalMoves,
    moveHistory: [
      ...state.moveHistory,
      {
        player: state.currentPlayer,
        row,
        col,
        flipped,
        resultingPlayer: gameOver.isOver ? null : nextPlayer,
        blackScore: scores.black,
        whiteScore: scores.white,
        timestamp: new Date().toISOString(),
      },
    ],
    blackScore: scores.black,
    whiteScore: scores.white,
    gameStatus: gameOver.isOver ? 'finished' : 'playing',
    winner: gameOver.winner,
  };

  return {
    newState,
    flipped,
    valid: true,
  };
}

export function createInitialGameState(): GameState {
  const board = createInitialBoard();
  const scores = calculateScore(board);

  return {
    board,
    currentPlayer: 'black',
    legalMoves: getLegalMoves(board, 'black'),
    moveHistory: [],
    blackScore: scores.black,
    whiteScore: scores.white,
    gameStatus: 'playing',
    winner: null,
  };
}
