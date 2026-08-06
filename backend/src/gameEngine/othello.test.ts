import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMove,
  calculateScore,
  checkGameOver,
  createInitialBoard,
  createInitialGameState,
  getFlippedPieces,
  getLegalMoves,
  hasValidMoves,
  processMove,
  type Board,
  type GameState,
} from './othello';

function createFilledBoard(cell: 'black' | 'white' | null): Board {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => cell));
}

test('createInitialBoard sets standard opening pieces', () => {
  const board = createInitialBoard();

  assert.equal(board.length, 8);
  assert.equal(board[0].length, 8);
  assert.equal(board[3][3], 'white');
  assert.equal(board[3][4], 'black');
  assert.equal(board[4][3], 'black');
  assert.equal(board[4][4], 'white');

  const scores = calculateScore(board);
  assert.deepEqual(scores, { black: 2, white: 2 });
});

test('getFlippedPieces returns expected flips for legal move and empty for invalid target', () => {
  const board = createInitialBoard();

  assert.deepEqual(getFlippedPieces(board, 2, 3, 'black'), [[3, 3]]);
  assert.deepEqual(getFlippedPieces(board, 3, 3, 'black'), []);
  assert.deepEqual(getFlippedPieces(board, -1, 0, 'black'), []);
});

test('getLegalMoves returns expected opening legal moves for black', () => {
  const board = createInitialBoard();
  const moves = getLegalMoves(board, 'black');

  const normalized = moves.map(([row, col]) => `${row},${col}`).sort();
  assert.deepEqual(normalized, ['2,3', '3,2', '4,5', '5,4']);
});

test('applyMove flips pieces and does not mutate original board', () => {
  const board = createInitialBoard();
  const nextBoard = applyMove(board, 2, 3, 'black');

  assert.equal(board[2][3], null);
  assert.equal(board[3][3], 'white');
  assert.equal(nextBoard[2][3], 'black');
  assert.equal(nextBoard[3][3], 'black');
});

test('applyMove throws on invalid move', () => {
  const board = createInitialBoard();

  assert.throws(() => applyMove(board, 0, 0, 'black'), /Invalid move/);
});

test('calculateScore and hasValidMoves handle simple boards', () => {
  const board = createFilledBoard('black');
  board[0][0] = 'white';

  assert.deepEqual(calculateScore(board), { black: 63, white: 1 });
  assert.equal(hasValidMoves(board, 'black'), false);
  assert.equal(hasValidMoves(board, 'white'), false);
});

test('checkGameOver identifies ongoing game, winner, and draw', () => {
  const opening = createInitialBoard();
  assert.deepEqual(checkGameOver(opening), { isOver: false, winner: null });

  const blackBoard = createFilledBoard('black');
  assert.deepEqual(checkGameOver(blackBoard), { isOver: true, winner: 'black' });

  const drawBoard = createFilledBoard('black');
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      drawBoard[row][col] = 'white';
    }
  }
  assert.deepEqual(checkGameOver(drawBoard), { isOver: true, winner: 'draw' });
});

test('processMove rejects invalid coordinates and finished games', () => {
  const initialState = createInitialGameState();
  const invalidCoordsResult = processMove(initialState, 9, 0);

  assert.equal(invalidCoordsResult.valid, false);
  assert.equal(invalidCoordsResult.newState, initialState);

  const finishedState: GameState = { ...initialState, gameStatus: 'finished' };
  const finishedResult = processMove(finishedState, 2, 3);

  assert.equal(finishedResult.valid, false);
  assert.equal(finishedResult.newState, finishedState);
});

test('processMove applies valid move and updates history/scores', () => {
  const initialState = createInitialGameState();
  const result = processMove(initialState, 2, 3);

  assert.equal(result.valid, true);
  assert.deepEqual(result.flipped, [[3, 3]]);
  assert.equal(result.newState.board[2][3], 'black');
  assert.equal(result.newState.board[3][3], 'black');
  assert.equal(result.newState.currentPlayer, 'white');
  assert.equal(result.newState.gameStatus, 'playing');
  assert.equal(result.newState.blackScore, 4);
  assert.equal(result.newState.whiteScore, 1);
  assert.equal(result.newState.moveHistory.length, 1);
  assert.equal(result.newState.moveHistory[0].player, 'black');
  assert.equal(result.newState.moveHistory[0].resultingPlayer, 'white');
  assert.ok(Number.isFinite(Date.parse(result.newState.moveHistory[0].timestamp)));
});

test('processMove enforces pass turn when opponent has no legal move', () => {
  const board = createFilledBoard('black');
  board[0][1] = 'white';
  board[0][2] = null;
  board[7][6] = 'white';
  board[7][7] = null;

  const state: GameState = {
    board,
    currentPlayer: 'black',
    legalMoves: getLegalMoves(board, 'black'),
    moveHistory: [],
    blackScore: calculateScore(board).black,
    whiteScore: calculateScore(board).white,
    gameStatus: 'playing',
    winner: null,
  };

  const result = processMove(state, 0, 2);

  assert.equal(result.valid, true);
  assert.equal(result.newState.currentPlayer, 'black');
  assert.equal(result.newState.gameStatus, 'playing');
  assert.ok(result.newState.legalMoves.length > 0);
  assert.equal(getLegalMoves(result.newState.board, 'white').length, 0);
});

test('createInitialGameState provides consistent default state', () => {
  const state = createInitialGameState();

  assert.equal(state.currentPlayer, 'black');
  assert.equal(state.gameStatus, 'playing');
  assert.equal(state.winner, null);
  assert.equal(state.moveHistory.length, 0);
  assert.deepEqual(state.legalMoves.map(([r, c]) => `${r},${c}`).sort(), ['2,3', '3,2', '4,5', '5,4']);
});
