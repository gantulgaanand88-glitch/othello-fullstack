import type { GameState, Player } from '../types';

import Square from './Square';

interface GameBoardProps {
  state: GameState;
  yourColor: Player | null;
  lastMove: { row: number; col: number } | null;
  flipped: [number, number][];
  onSquareClick: (row: number, col: number) => void;
}

function coordinateKey(row: number, col: number): string {
  return `${row}-${col}`;
}

/**
 * Compute a stagger delay for each flipped piece based on its
 * Chebyshev distance ("king move" distance) from the placed piece.
 * This makes the animation ripple outward like water flowing through
 * every direction simultaneously — diagonal, horizontal, vertical
 * all advance at the same pace per step.
 */
function computeWaveDelays(
  flipped: [number, number][],
  origin: { row: number; col: number } | null,
): Map<string, number> {
  const delays = new Map<string, number>();
  if (!origin || flipped.length === 0) return delays;

  const MS_PER_STEP = 60;

  for (const [r, c] of flipped) {
    const dist = Math.max(Math.abs(r - origin.row), Math.abs(c - origin.col));
    delays.set(coordinateKey(r, c), dist * MS_PER_STEP);
  }

  return delays;
}

export function GameBoard({ state, yourColor, lastMove, flipped, onSquareClick }: GameBoardProps) {
  const legalMoveSet = new Set(
    state.currentPlayer === yourColor
      ? state.legalMoves.map(([row, col]) => coordinateKey(row, col))
      : [],
  );
  const flippedSet = new Set(flipped.map(([row, col]) => coordinateKey(row, col)));
  const waveDelays = computeWaveDelays(flipped, lastMove);

  return (
    <div className="rounded-3xl border border-gray-700 bg-gray-800/80 p-3 shadow-board backdrop-blur">
      <div className="mb-3 flex items-center justify-between px-1 text-xs uppercase tracking-[0.3em] text-gray-400">
        <span>Othello Arena</span>
        <span>{state.currentPlayer} to move</span>
      </div>

      <div
        role="grid"
        aria-label="Othello game board"
        className="grid grid-cols-8 overflow-hidden rounded-2xl border border-black/20"
      >
        {state.board.map((rowCells, rowIndex) =>
          rowCells.map((cell, colIndex) => {
            const key = coordinateKey(rowIndex, colIndex);
            const isFlip = flippedSet.has(key);
            return (
              <Square
                key={key}
                cell={cell}
                isLegalMove={legalMoveSet.has(key)}
                isLastMove={lastMove?.row === rowIndex && lastMove.col === colIndex}
                isFlipped={isFlip}
                flipDelay={isFlip ? (waveDelays.get(key) ?? 0) : 0}
                onClick={() => onSquareClick(rowIndex, colIndex)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

export default GameBoard;
