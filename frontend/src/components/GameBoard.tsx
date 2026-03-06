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

export function GameBoard({ state, yourColor, lastMove, flipped, onSquareClick }: GameBoardProps) {
  const legalMoveSet = new Set(
    state.currentPlayer === yourColor
      ? state.legalMoves.map(([row, col]) => coordinateKey(row, col))
      : [],
  );
  const flippedSet = new Set(flipped.map(([row, col]) => coordinateKey(row, col)));

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
            return (
              <Square
                key={key}
                cell={cell}
                isLegalMove={legalMoveSet.has(key)}
                isLastMove={lastMove?.row === rowIndex && lastMove.col === colIndex}
                isFlipped={flippedSet.has(key)}
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
