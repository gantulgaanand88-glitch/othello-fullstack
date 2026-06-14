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
// Standard Othello/Chess: row 8 is at the top, row 1 is at the bottom
const ROW_LABELS = ['8', '7', '6', '5', '4', '3', '2', '1'];

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

  // Handles arrow-key grid navigation for accessibility (a11y)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      e.currentTarget.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const active = document.activeElement as HTMLButtonElement;
    const activeIndex = buttons.indexOf(active);

    if (activeIndex === -1) return;

    const row = Math.floor(activeIndex / 8);
    const col = activeIndex % 8;

    let nextRow = row;
    let nextCol = col;

    switch (e.key) {
      case 'ArrowUp':
        nextRow = Math.max(0, row - 1);
        e.preventDefault();
        break;
      case 'ArrowDown':
        nextRow = Math.min(7, row + 1);
        e.preventDefault();
        break;
      case 'ArrowLeft':
        nextCol = Math.max(0, col - 1);
        e.preventDefault();
        break;
      case 'ArrowRight':
        nextCol = Math.min(7, col + 1);
        e.preventDefault();
        break;
      default:
        return;
    }

    const nextIndex = nextRow * 8 + nextCol;
    buttons[nextIndex]?.focus();
  };

  const currentPlayerDot =
    state.currentPlayer === 'black'
      ? 'var(--piece-dark)'
      : 'var(--piece-light)';

  return (
    <div className="board-shell">
      {/* Board header */}
      <div className="board-topbar">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Othello Arena
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: currentPlayerDot,
              border: state.currentPlayer === 'white' ? '1px solid #555' : 'none',
            }}
          />
          {state.currentPlayer} to move
        </span>
      </div>

      {/* Column labels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          paddingLeft: '0',
          marginBottom: '4px',
        }}
      >
        {COL_LABELS.map((label) => (
          <span key={label} className="board-coordinate">
            {label}
          </span>
        ))}
      </div>

      {/* Board + row labels */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div
          role="grid"
          aria-label="Othello game board"
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            border: '1px solid var(--rule)',
          }}
        >
          {state.board.map((rowCells, rowIndex) =>
            rowCells.map((cell, colIndex) => {
              const key = coordinateKey(rowIndex, colIndex);
              const isFlip = flippedSet.has(key);
              return (
                <Square
                  key={key}
                  row={rowIndex}
                  col={colIndex}
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            marginLeft: '6px',
          }}
        >
          {ROW_LABELS.map((label) => (
            <span key={label} className="board-coordinate" style={{ textAlign: 'left' }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GameBoard;
