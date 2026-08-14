import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArenaGameState } from '../game/types';

interface CanvasBoardProps {
  game: ArenaGameState;
  onMove?: (square: number) => void;
  compact?: boolean;
  id?: string;
}

const BOARD_COLORS = {
  felt: '#0d8055',
  feltDark: '#086a46',
  grid: 'rgba(4, 49, 32, 0.54)',
  legal: '#ccff56',
  ink: '#111813',
  paper: '#f5f2e9',
};

export function CanvasBoard({ game, onMove, compact = false, id = 'arena-board' }: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [cursor, setCursor] = useState(27);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const size = Math.max(280, Math.floor(frame.getBoundingClientRect().width));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);

    const padding = compact ? size * 0.035 : size * 0.055;
    const boardSize = size - padding * 2;
    const cell = boardSize / 8;

    context.save();
    context.shadowColor = 'rgba(4, 24, 15, 0.24)';
    context.shadowBlur = compact ? 10 : 24;
    context.shadowOffsetY = compact ? 5 : 12;
    context.fillStyle = BOARD_COLORS.feltDark;
    roundRect(context, padding - 4, padding - 4, boardSize + 8, boardSize + 8, compact ? 10 : 18);
    context.fill();
    context.restore();

    const gradient = context.createLinearGradient(padding, padding, padding + boardSize, padding + boardSize);
    gradient.addColorStop(0, '#169564');
    gradient.addColorStop(0.58, BOARD_COLORS.felt);
    gradient.addColorStop(1, '#086744');
    context.fillStyle = gradient;
    roundRect(context, padding, padding, boardSize, boardSize, compact ? 7 : 13);
    context.fill();

    context.strokeStyle = BOARD_COLORS.grid;
    context.lineWidth = Math.max(1, size / 620);
    for (let index = 1; index < 8; index += 1) {
      const offset = padding + index * cell;
      context.beginPath();
      context.moveTo(offset, padding);
      context.lineTo(offset, padding + boardSize);
      context.stroke();
      context.beginPath();
      context.moveTo(padding, offset);
      context.lineTo(padding + boardSize, offset);
      context.stroke();
    }

    for (let square = 0; square < 64; square += 1) {
      const row = Math.floor(square / 8);
      const col = square % 8;
      const x = padding + col * cell + cell / 2;
      const y = padding + row * cell + cell / 2;
      const piece = game.board[square];

      if (piece) {
        drawDisc(context, x, y, cell * 0.385, piece, square === game.lastMove);
      } else if (game.legalMoves.includes(square)) {
        const active = hovered === square || cursor === square;
        context.beginPath();
        context.fillStyle = active ? BOARD_COLORS.legal : 'rgba(211, 255, 106, 0.55)';
        context.arc(x, y, active ? cell * 0.13 : cell * 0.075, 0, Math.PI * 2);
        context.fill();
        if (active) {
          context.strokeStyle = 'rgba(9, 48, 31, 0.7)';
          context.lineWidth = 2;
          context.stroke();
        }
      }
    }

    if (!compact) {
      context.fillStyle = 'rgba(8, 45, 30, 0.76)';
      context.font = `600 ${Math.max(9, size / 60)}px ui-monospace, SFMono-Regular, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (let index = 0; index < 8; index += 1) {
        context.fillText(String.fromCharCode(65 + index), padding + cell * (index + 0.5), padding * 0.48);
        context.fillText(String(index + 1), padding * 0.48, padding + cell * (index + 0.5));
      }
    }
  }, [compact, cursor, game, hovered]);

  useEffect(() => {
    draw();
    const observer = new ResizeObserver(draw);
    if (frameRef.current) observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    const onFullscreen = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f' && frameRef.current) {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void frameRef.current.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onFullscreen);
    return () => window.removeEventListener('keydown', onFullscreen);
  }, []);

  function squareFromPointer(clientX: number, clientY: number): number | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    const padding = compact ? bounds.width * 0.035 : bounds.width * 0.055;
    const boardSize = bounds.width - padding * 2;
    const x = clientX - bounds.left - padding;
    const y = clientY - bounds.top - padding;
    if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return null;
    return Math.floor(y / (boardSize / 8)) * 8 + Math.floor(x / (boardSize / 8));
  }

  return (
    <div ref={frameRef} className={`board-frame${compact ? ' board-frame-compact' : ''}`} id={id}>
      <canvas
        ref={canvasRef}
        role="grid"
        tabIndex={0}
        aria-label={`Othello board. ${game.turn} to move. ${game.legalMoves.length} legal moves.`}
        onPointerMove={(event) => setHovered(squareFromPointer(event.clientX, event.clientY))}
        onPointerLeave={() => setHovered(null)}
        onClick={(event) => {
          const square = squareFromPointer(event.clientX, event.clientY);
          if (square !== null && game.legalMoves.includes(square)) onMove?.(square);
        }}
        onKeyDown={(event) => {
          const row = Math.floor(cursor / 8);
          const col = cursor % 8;
          if (event.key === 'ArrowLeft') setCursor(row * 8 + Math.max(0, col - 1));
          else if (event.key === 'ArrowRight') setCursor(row * 8 + Math.min(7, col + 1));
          else if (event.key === 'ArrowUp') setCursor(Math.max(0, row - 1) * 8 + col);
          else if (event.key === 'ArrowDown') setCursor(Math.min(7, row + 1) * 8 + col);
          else if (event.key === 'Enter' || event.key === ' ') onMove?.(cursor);
          else return;
          event.preventDefault();
        }}
      >
        Interactive Othello board
      </canvas>
      {!compact && <span className="fullscreen-hint">Press F for fullscreen</span>}
    </div>
  );
}

function drawDisc(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  piece: 'black' | 'white',
  isLastMove: boolean,
) {
  context.save();
  context.shadowColor = piece === 'black' ? 'rgba(0,0,0,.42)' : 'rgba(3,38,24,.28)';
  context.shadowBlur = radius * 0.35;
  context.shadowOffsetY = radius * 0.18;
  const gradient = context.createRadialGradient(
    x - radius * 0.32,
    y - radius * 0.38,
    radius * 0.12,
    x,
    y,
    radius,
  );
  if (piece === 'black') {
    gradient.addColorStop(0, '#4d5750');
    gradient.addColorStop(0.35, '#1c241f');
    gradient.addColorStop(1, '#070a08');
  } else {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.55, '#f4f0e5');
    gradient.addColorStop(1, '#c8c6bd');
  }
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.beginPath();
  context.strokeStyle = piece === 'black' ? 'rgba(255,255,255,.14)' : 'rgba(22,44,31,.2)';
  context.lineWidth = Math.max(1, radius * 0.055);
  context.arc(x, y, radius * 0.91, 0, Math.PI * 2);
  context.stroke();

  if (isLastMove) {
    context.beginPath();
    context.fillStyle = piece === 'black' ? '#d2ff68' : '#116d49';
    context.arc(x, y, radius * 0.13, 0, Math.PI * 2);
    context.fill();
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
