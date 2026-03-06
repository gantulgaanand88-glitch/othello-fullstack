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

/** Compute a staggered delay (ms) for each flipped piece based on distance from the placed piece. */
function computeWaveDelays(
  flipped: [number, number][],
  origin: { row: number; col: number } | null,
): Map<string, number> {
  const delays = new Map<string, number>();
  if (!origin || flipped.length === 0) return delays;

  const DELAY_PER_CELL = 80; // ms per unit distance

  for (const [r, c] of flipped) {
    const dist = Math.sqrt((r - origin.row) ** 2 + (c - origin.col) ** 2);
    delays.set(coordinateKey(r, c), Math.round(dist * DELAY_PER_CELL));
  }

  return delays;
}

const COL_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function GameBoard({ state, yourColor, lastMove, flipped, onSquareClick }: GameBoardProps) {
  const legalMoveSet = new Set(
    state.currentPlayer === yourColor
      ? state.legalMoves.map(([row, col]) => coordinateKey(row, col))
      : [],
  );
  const flippedSet = new Set(flipped.map(([row, col]) => coordinateKey(row, col)));
  const waveDelays = computeWaveDelays(flipped, lastMove);

  const isYourTurn = state.currentPlayer === yourColor && state.gameStatus === 'playing';

  return (
    <div className="game-board-container rounded-3xl border border-gray-700 bg-gray-800/80 p-3 shadow-board backdrop-blur">
      {/* Turn indicator bar */}
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs uppercase tracking-[0.3em] text-gray-500">Othello Arena</span>
        <span
          className={[
            'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors duration-300',
            isYourTurn
              ? 'bg-green-500/15 text-green-400'
              : 'bg-gray-700/50 text-gray-400',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-2 w-2 rounded-full',
              isYourTurn ? 'bg-green-400 animate-pulse-soft' : 'bg-gray-500',
            ].join(' ')}
          />
          {isYourTurn ? 'Your turn' : `${state.currentPlayer} to move`}
        </span>
      </div>

      {/* Column labels */}
      <div className="mb-1 grid grid-cols-8 px-0.5">
        {COL_LABELS.map((label) => (
          <span key={label} className="text-center text-[10px] font-medium text-gray-600">
            {label}
          </span>
        ))}
      </div>

      <div className="flex">
        {/* Row labels */}
        <div className="mr-1 flex flex-col justify-around">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="text-[10px] font-medium leading-none text-gray-600">
              {i + 1}
            </span>
          ))}
        </div>

        <div
          role="grid"
          aria-label="Othello game board"
          className="grid flex-1 grid-cols-8 overflow-hidden rounded-2xl border border-black/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
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
                  isPlaced={lastMove?.row === rowIndex && lastMove.col === colIndex && !!cell}
                  flipDelay={isFlip ? (waveDelays.get(key) ?? 0) : 0}
                  onClick={() => onSquareClick(rowIndex, colIndex)}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

export default GameBoard;
