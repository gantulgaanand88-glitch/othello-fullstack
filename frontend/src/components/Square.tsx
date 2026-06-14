import React, { useEffect, useState } from 'react';
import type { Cell } from '../types';

interface SquareProps {
  row: number;
  col: number;
  cell: Cell;
  isLegalMove: boolean;
  isLastMove: boolean;
  isFlipped: boolean;
  flipDelay: number;
  onClick: () => void;
}

export const Square = React.memo(function Square({
  row,
  col,
  cell,
  isLegalMove,
  isLastMove,
  isFlipped,
  flipDelay,
  onClick,
}: SquareProps) {
  const [animating, setAnimating] = useState(false);
  const [showOldColor, setShowOldColor] = useState(false);

  // When a piece first flips, briefly show the OLD color (the opposite),
  // then swap to the new color at the midpoint of the animation.
  useEffect(() => {
    if (!isFlipped || !cell) {
      setAnimating(false);
      setShowOldColor(false);
      return;
    }

    const startDelay = setTimeout(() => {
      setAnimating(true);
      setShowOldColor(true);

      const midSwap = setTimeout(() => {
        setShowOldColor(false);
      }, 300);

      const endTimer = setTimeout(() => {
        setAnimating(false);
      }, 620);

      return () => {
        clearTimeout(midSwap);
        clearTimeout(endTimer);
      };
    }, flipDelay);

    return () => clearTimeout(startDelay);
  }, [isFlipped, flipDelay, cell]);

  const colLetter = String.fromCharCode(97 + col).toUpperCase(); // A-H
  const rowNumber = 8 - row; // Othello standard: rows are numbered 1-8 starting from the bottom
  const label = `${colLetter}${rowNumber}: ${
    cell
      ? `${cell} piece`
      : isLegalMove
        ? 'empty, legal move available'
        : 'empty'
  }`;

  // Determine the displayed color: if animating and showing old color, invert
  let pieceColor = cell;
  if (animating && showOldColor && cell) {
    pieceColor = cell === 'black' ? 'white' : 'black';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'relative',
        aspectRatio: '1',
        width: '100%',
        background: isLastMove
          ? 'rgba(0,229,160,0.06)'
          : 'var(--board-bg)',
        border: '1px solid var(--board-line)',
        outline: 'none',
        cursor: cell ? 'default' : isLegalMove ? 'pointer' : 'default',
        transition: 'background 0.15s',
        perspective: '200px',
        // Subtle last-move accent: top-left corner highlight
        boxShadow: isLastMove
          ? 'inset 2px 2px 0 0 rgba(0,229,160,0.4)'
          : 'none',
      }}
      onMouseEnter={(e) => {
        if (isLegalMove && !cell) {
          (e.currentTarget as HTMLButtonElement).style.background =
            'rgba(0,229,160,0.05)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = isLastMove
          ? 'rgba(0,229,160,0.06)'
          : 'var(--board-bg)';
      }}
    >
      {/* Legal move indicator — minimal dot */}
      {isLegalMove && !cell ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: '18%',
              aspectRatio: '1',
              borderRadius: '50%',
              background: 'var(--accent)',
              opacity: 0.35,
            }}
          />
        </span>
      ) : null}

      {/* Piece */}
      {cell ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className={animating ? 'animate-piece-flip-3d' : ''}
            style={{
              width: '68%',
              aspectRatio: '1',
              borderRadius: '50%',
              background:
                pieceColor === 'black'
                  ? 'radial-gradient(circle at 35% 35%, #2a2a2a, #080808)'
                  : 'radial-gradient(circle at 35% 35%, #f5f0e8, #c8bfaf)',
              boxShadow:
                pieceColor === 'black'
                  ? '0 2px 8px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.06)'
                  : '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 3px rgba(255,255,255,0.6)',
              transition: 'box-shadow 0.2s',
            }}
          />
        </span>
      ) : null}
    </button>
  );
});

export default Square;
