/**
 * SvgBoard — renders the 8×8 Othello board as a single SVG element.
 * Scales perfectly at any DPI via viewBox. No pixel-fitting issues.
 */
import React, { useId } from 'react';
import type { Cell, Player } from '../lib/gameEngine';
import GamePiece from './GamePiece';

interface SvgBoardProps {
  board:           Cell[][];
  legalMoves:      [number, number][];
  lastMove:        { row: number; col: number } | null;
  flippedPieces:   [number, number][];
  currentPlayer:   Player;
  yourColor:       Player | null;
  onSquareClick:   (row: number, col: number) => void;
}

const VB      = 800;          // viewBox dimension
const PADDING = 28;           // space for coordinate labels
const INNER   = VB - PADDING * 2;
const CELL    = INNER / 8;
const COL_LABELS = ['a','b','c','d','e','f','g','h'];
const ROW_LABELS = ['8','7','6','5','4','3','2','1'];

// Chebyshev distance for wave-delay on flips
function waveDelay(
  flipped: [number, number][],
  origin: { row: number; col: number } | null,
  row: number, col: number,
): number {
  if (!origin || flipped.length === 0) return 0;
  const dist = Math.max(Math.abs(row - origin.row), Math.abs(col - origin.col));
  return dist * 55; // ms per step
}

function coordKey(r: number, c: number) { return `${r}-${c}`; }

export const SvgBoard = React.memo(function SvgBoard({
  board,
  legalMoves,
  lastMove,
  flippedPieces,
  currentPlayer,
  yourColor,
  onSquareClick,
}: SvgBoardProps) {
  const uid       = useId();
  const dropId    = `${uid}-drop`;
  const feltId    = `${uid}-felt`;
  const legalSet  = new Set(legalMoves.map(([r,c]) => coordKey(r,c)));
  const flippedSet = new Set(flippedPieces.map(([r,c]) => coordKey(r,c)));
  const isYourTurn = currentPlayer === yourColor;

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      className="w-full h-full select-none"
      role="grid"
      aria-label="Othello board"
      style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.65))' }}
    >
      <defs>
        {/* Board drop shadow */}
        <filter id={dropId} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#000" floodOpacity="0.5" />
        </filter>

        {/* Felt texture gradient */}
        <radialGradient id={feltId} cx="40%" cy="35%" r="70%">
          <stop offset="0%"   stopColor="#142014" />
          <stop offset="100%" stopColor="#0a130a" />
        </radialGradient>
      </defs>

      {/* ── Outer frame ─────────────────────────────────────────────── */}
      <rect
        x="1" y="1"
        width={VB - 2} height={VB - 2}
        rx="6"
        fill="#0d150d"
        stroke="#1e2e1e"
        strokeWidth="2"
        filter={`url(#${dropId})`}
      />

      {/* ── Felt surface ─────────────────────────────────────────────── */}
      <rect
        x={PADDING} y={PADDING}
        width={INNER} height={INNER}
        fill={`url(#${feltId})`}
      />

      {/* ── Grid cells ───────────────────────────────────────────────── */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => {
          const x    = PADDING + col * CELL;
          const y    = PADDING + row * CELL;
          const key  = coordKey(row, col);
          const isLegal   = legalSet.has(key) && board[row][col] === null;
          const isLast    = lastMove?.row === row && lastMove?.col === col;
          const isFlipped = flippedSet.has(key);
          const cell      = board[row][col];
          const isAlt     = (row + col) % 2 === 1;

          return (
            <g key={key} role="gridcell" aria-label={`${COL_LABELS[col]}${ROW_LABELS[row]}`}>
              {/* Cell background */}
              <rect
                x={x} y={y}
                width={CELL} height={CELL}
                fill={isAlt ? '#0f1c0f' : '#0d1a0d'}
                stroke="#172417"
                strokeWidth="0.5"
              />

              {/* Last-move accent — thin inner border */}
              {isLast && (
                <rect
                  x={x + 2} y={y + 2}
                  width={CELL - 4} height={CELL - 4}
                  fill="none"
                  stroke="#c9a84c"
                  strokeWidth="1.5"
                  opacity="0.55"
                />
              )}

              {/* Legal move indicator */}
              {isLegal && isYourTurn && (
                <circle
                  cx={x + CELL / 2}
                  cy={y + CELL / 2}
                  r={CELL * 0.13}
                  fill="#c9a84c"
                  opacity="0.45"
                  className="animate-legal-pulse"
                />
              )}

              {/* Clickable overlay (entire cell) */}
              <rect
                x={x} y={y}
                width={CELL} height={CELL}
                fill="transparent"
                className={isLegal && isYourTurn ? 'cursor-pointer' : 'cursor-default'}
                onClick={() => isLegal && isYourTurn && onSquareClick(row, col)}
              />

              {/* Piece */}
              {cell && (
                <GamePiece
                  cx={x + CELL / 2}
                  cy={y + CELL / 2}
                  r={CELL * 0.36}
                  color={cell}
                  isFlipped={isFlipped}
                  flipDelay={waveDelay(flippedPieces, lastMove, row, col)}
                  isLastPlaced={isLast && !isFlipped}
                  uid={`${uid}-${key}`}
                />
              )}
            </g>
          );
        })
      )}

      {/* ── Coordinate labels ─────────────────────────────────────────── */}
      {COL_LABELS.map((label, col) => (
        <text
          key={`col-${col}`}
          x={PADDING + col * CELL + CELL / 2}
          y={PADDING - 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'DM Mono', monospace"
          fontSize="10"
          fill="#2a3d2a"
          letterSpacing="0.5"
        >
          {label}
        </text>
      ))}
      {ROW_LABELS.map((label, row) => (
        <text
          key={`row-${row}`}
          x={PADDING - 10}
          y={PADDING + row * CELL + CELL / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'DM Mono', monospace"
          fontSize="10"
          fill="#2a3d2a"
        >
          {label}
        </text>
      ))}

      {/* ── Grid border ──────────────────────────────────────────────── */}
      <rect
        x={PADDING} y={PADDING}
        width={INNER} height={INNER}
        fill="none"
        stroke="#1e2e1e"
        strokeWidth="1"
      />
    </svg>
  );
});

export default SvgBoard;
