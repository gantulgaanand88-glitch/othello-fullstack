import { useMemo } from 'react';

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

const COL_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ROW_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * Compute a stagger delay for each flipped piece based on its
 * Chebyshev distance ("king move" distance) from the placed piece.
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
  const legalMoveSet = useMemo(() => {
    return new Set(
      state.currentPlayer === yourColor
        ? state.legalMoves.map(([row, col]) => coordinateKey(row, col))
        : [],
    );
  }, [state.currentPlayer, yourColor, state.legalMoves]);

  const flippedSet = useMemo(() => {
    return new Set(flipped.map(([row, col]) => coordinateKey(row, col)));
  }, [flipped]);

  const waveDelays = useMemo(() => {
    return computeWaveDelays(flipped, lastMove);
  }, [flipped, lastMove]);

  return (
    <div className="rounded-3xl border border-gray-700 bg-gray-800/80 p-3 shadow-board backdrop-blur sm:p-4">
      <div className="mb-3 flex items-center justify-between px-1 text-xs uppercase tracking-[0.3em] text-gray-400">
        <span>Othello Arena</span>
        <span className="flex items-center gap-2">
          <span
            className={[
              'inline-block h-2.5 w-2.5 rounded-full',
              state.currentPlayer === 'black'
                ? 'bg-gradient-to-br from-zinc-600 to-zinc-950'
                : 'bg-gradient-to-br from-white to-gray-300',
            ].join(' ')}
          />
          {state.currentPlayer} to move
        </span>
      </div>

      {/* Column labels */}
      <div className="mb-1 grid grid-cols-8 gap-0 px-0">
        {COL_LABELS.map((label) => (
          <span key={label} className="text-center text-[10px] font-medium text-gray-600 uppercase">
            {label}
          </span>
        ))}
      </div>

      <div className="flex">
        <div
          role="grid"
          aria-label="Othello game board"
          className="grid flex-1 grid-cols-8 overflow-hidden rounded-2xl border border-black/20"
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

        {/* Row labels */}
        <div className="ml-1.5 flex flex-col justify-around">
          {ROW_LABELS.map((label) => (
            <span key={label} className="text-[10px] font-medium text-gray-600">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GameBoard;
