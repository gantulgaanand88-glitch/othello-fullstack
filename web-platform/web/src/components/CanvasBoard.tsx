import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArenaGameState, Cell, Player } from '../game/types';

interface CanvasBoardProps {
  game: ArenaGameState;
  onMove?: (square: number) => void;
  compact?: boolean;
  id?: string;
  interactive?: boolean;
  showLegalMoves?: boolean;
}

interface DiscTransition {
  square: number;
  from: Cell;
  to: Cell;
  delay: number;
}

interface BoardAnimation {
  startedAt: number;
  duration: number;
  transitions: DiscTransition[];
}

const COLORS = {
  board: '#0b7a50',
  boardLight: '#119260',
  boardDark: '#075f3f',
  grid: 'rgba(2, 43, 28, 0.58)',
  hint: '#d5ff63',
  black: '#0a0e0b',
  white: '#f5f2e8',
};

export function CanvasBoard({
  game,
  onMove,
  compact = false,
  id = 'arena-board',
  interactive = true,
  showLegalMoves = true,
}: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const previousBoardRef = useRef<Cell[]>(game.board);
  const animationRef = useRef<BoardAnimation | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const [cursor, setCursor] = useState(game.legalMoves[0] ?? 27);

  const draw = useCallback((now = performance.now()) => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return false;

    const size = Math.max(280, Math.floor(frame.getBoundingClientRect().width));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(size * dpr) || canvas.height !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }

    const context = canvas.getContext('2d');
    if (!context) return false;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);

    const padding = compact ? size * 0.028 : size * 0.052;
    const boardSize = size - padding * 2;
    const cell = boardSize / 8;

    drawBoardSurface(context, padding, boardSize, cell, compact);

    const animation = animationRef.current;
    const transitionBySquare = new Map(animation?.transitions.map((transition) => [transition.square, transition]));
    const elapsed = animation ? now - animation.startedAt : Number.POSITIVE_INFINITY;

    for (let square = 0; square < 64; square += 1) {
      const row = Math.floor(square / 8);
      const col = square % 8;
      const x = padding + col * cell + cell / 2;
      const y = padding + row * cell + cell / 2;
      const piece = game.board[square];
      const transition = transitionBySquare.get(square);

      if (transition && transition.to) {
        const local = clamp01((elapsed - transition.delay) / (animation?.duration ?? 1));
        if (transition.from === null) {
          const scale = easeOutCubic(local);
          drawDisc(context, x, y, cell * 0.39, transition.to, square === game.lastMove, scale, 1, 1 - scale);
        } else if (transition.from !== transition.to) {
          const flip = easeInOutCubic(local);
          const visiblePiece = flip < 0.5 ? transition.from : transition.to;
          const scaleX = Math.max(0.055, Math.abs(Math.cos(Math.PI * flip)));
          drawDisc(context, x, y - Math.sin(Math.PI * flip) * cell * 0.045, cell * 0.39, visiblePiece, square === game.lastMove && local === 1, 1, scaleX, Math.sin(Math.PI * flip) * 0.5);
        } else {
          drawDisc(context, x, y, cell * 0.39, transition.to, square === game.lastMove);
        }
      } else if (piece) {
        drawDisc(context, x, y, cell * 0.39, piece, square === game.lastMove);
      } else if (interactive && showLegalMoves && game.legalMoves.includes(square)) {
        drawLegalMove(context, x, y, cell, game.turn, hovered === square || cursor === square, pressed === square);
      }
    }

    if (!compact) drawCoordinates(context, padding, cell, size);
    return Boolean(animation && elapsed < animation.duration + Math.max(0, ...animation.transitions.map((item) => item.delay)));
  }, [compact, cursor, game, hovered, interactive, pressed, showLegalMoves]);

  useEffect(() => {
    const previous = previousBoardRef.current;
    const changed = game.board.flatMap((piece, square) => previous[square] === piece ? [] : [{
      square,
      from: previous[square],
      to: piece,
      delay: game.lastMove === null ? 0 : Math.min(105, manhattan(square, game.lastMove) * 22),
    }]);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (changed.length && !reduceMotion) {
      animationRef.current = {
        startedAt: performance.now(),
        duration: 245,
        transitions: changed,
      };
    } else if (changed.length) {
      animationRef.current = null;
    }
    previousBoardRef.current = game.board;

    const render = (now: number) => {
      const active = draw(now);
      if (active) animationFrameRef.current = requestAnimationFrame(render);
    };
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(render);

    const observer = new ResizeObserver(() => draw());
    if (frameRef.current) observer.observe(frameRef.current);
    return () => {
      observer.disconnect();
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [draw, game.board, game.lastMove]);

  useEffect(() => {
    if (game.legalMoves.includes(cursor)) return;
    setCursor(game.legalMoves[0] ?? 27);
  }, [cursor, game.legalMoves]);

  useEffect(() => {
    const onFullscreen = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || !frameRef.current) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void frameRef.current.requestFullscreen();
    };
    window.addEventListener('keydown', onFullscreen);
    return () => window.removeEventListener('keydown', onFullscreen);
  }, []);

  function squareFromPointer(clientX: number, clientY: number): number | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    const padding = compact ? bounds.width * 0.028 : bounds.width * 0.052;
    const boardSize = bounds.width - padding * 2;
    const x = clientX - bounds.left - padding;
    const y = clientY - bounds.top - padding;
    if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return null;
    return Math.floor(y / (boardSize / 8)) * 8 + Math.floor(x / (boardSize / 8));
  }

  const canPlay = (square: number | null): square is number => Boolean(
    interactive && square !== null && game.legalMoves.includes(square),
  );

  return (
    <div ref={frameRef} className={`board-frame${compact ? ' board-frame-compact' : ''}`} id={id}>
      <canvas
        ref={canvasRef}
        role="grid"
        tabIndex={interactive ? 0 : -1}
        aria-label={`Reversi board. ${game.turn} to move. ${game.legalMoves.length} legal moves.`}
        aria-disabled={!interactive}
        style={{ cursor: canPlay(hovered) ? 'pointer' : 'default' }}
        onPointerMove={(event) => setHovered(squareFromPointer(event.clientX, event.clientY))}
        onPointerLeave={() => { setHovered(null); setPressed(null); }}
        onPointerDown={(event) => {
          const square = squareFromPointer(event.clientX, event.clientY);
          setPressed(canPlay(square) ? square : null);
        }}
        onPointerUp={() => setPressed(null)}
        onClick={(event) => {
          const square = squareFromPointer(event.clientX, event.clientY);
          if (canPlay(square)) onMove?.(square);
        }}
        onKeyDown={(event) => {
          if (!interactive) return;
          const row = Math.floor(cursor / 8);
          const col = cursor % 8;
          if (event.key === 'ArrowLeft') setCursor(row * 8 + Math.max(0, col - 1));
          else if (event.key === 'ArrowRight') setCursor(row * 8 + Math.min(7, col + 1));
          else if (event.key === 'ArrowUp') setCursor(Math.max(0, row - 1) * 8 + col);
          else if (event.key === 'ArrowDown') setCursor(Math.min(7, row + 1) * 8 + col);
          else if ((event.key === 'Enter' || event.key === ' ') && game.legalMoves.includes(cursor)) onMove?.(cursor);
          else return;
          event.preventDefault();
        }}
      >
        Interactive Reversi board
      </canvas>
      {!compact && <span className="fullscreen-hint">F · fullscreen</span>}
    </div>
  );
}

function drawBoardSurface(context: CanvasRenderingContext2D, padding: number, boardSize: number, cell: number, compact: boolean) {
  context.save();
  context.shadowColor = 'rgba(5, 27, 18, 0.25)';
  context.shadowBlur = compact ? 10 : 22;
  context.shadowOffsetY = compact ? 4 : 10;
  context.fillStyle = COLORS.boardDark;
  roundRect(context, padding - 4, padding - 4, boardSize + 8, boardSize + 8, compact ? 9 : 16);
  context.fill();
  context.restore();

  const gradient = context.createLinearGradient(padding, padding, padding + boardSize, padding + boardSize);
  gradient.addColorStop(0, COLORS.boardLight);
  gradient.addColorStop(0.56, COLORS.board);
  gradient.addColorStop(1, COLORS.boardDark);
  context.fillStyle = gradient;
  roundRect(context, padding, padding, boardSize, boardSize, compact ? 6 : 11);
  context.fill();

  context.strokeStyle = COLORS.grid;
  context.lineWidth = Math.max(1, boardSize / 620);
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

  context.fillStyle = 'rgba(1, 38, 24, 0.64)';
  for (const [col, row] of [[2, 2], [5, 2], [2, 5], [5, 5]]) {
    context.beginPath();
    context.arc(padding + (col + 0.5) * cell, padding + (row + 0.5) * cell, Math.max(2, cell * 0.045), 0, Math.PI * 2);
    context.fill();
  }
}

function drawLegalMove(context: CanvasRenderingContext2D, x: number, y: number, cell: number, player: Player, active: boolean, pressed: boolean) {
  const radius = active ? cell * 0.34 : cell * 0.075;
  context.save();
  context.globalAlpha = active ? (pressed ? 0.62 : 0.28) : 0.72;
  context.fillStyle = active ? (player === 'black' ? COLORS.black : COLORS.white) : COLORS.hint;
  context.beginPath();
  context.arc(x, y, radius * (pressed ? 0.92 : 1), 0, Math.PI * 2);
  context.fill();
  if (active) {
    context.globalAlpha = 0.78;
    context.strokeStyle = COLORS.hint;
    context.lineWidth = Math.max(2, cell * 0.035);
    context.stroke();
  }
  context.restore();
}

function drawDisc(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  piece: Player,
  isLastMove: boolean,
  scale = 1,
  scaleX = 1,
  lift = 0,
) {
  context.save();
  context.translate(x, y);
  context.scale(scale * scaleX, scale);
  context.shadowColor = piece === 'black' ? 'rgba(0,0,0,.46)' : 'rgba(3,38,24,.3)';
  context.shadowBlur = radius * (0.3 + lift * 0.25);
  context.shadowOffsetY = radius * (0.15 + lift * 0.08);
  const gradient = context.createRadialGradient(-radius * 0.32, -radius * 0.38, radius * 0.08, 0, 0, radius);
  if (piece === 'black') {
    gradient.addColorStop(0, '#4a554e');
    gradient.addColorStop(0.32, '#1d251f');
    gradient.addColorStop(1, COLORS.black);
  } else {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.55, COLORS.white);
    gradient.addColorStop(1, '#c9c7bd');
  }
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = 'transparent';
  context.strokeStyle = piece === 'black' ? 'rgba(255,255,255,.13)' : 'rgba(20,45,31,.18)';
  context.lineWidth = Math.max(1, radius * 0.055);
  context.beginPath();
  context.arc(0, 0, radius * 0.91, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  if (isLastMove && scale > 0.9) {
    context.save();
    context.strokeStyle = COLORS.hint;
    context.lineWidth = Math.max(2, radius * 0.075);
    context.beginPath();
    context.arc(x, y, radius * 0.2, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function drawCoordinates(context: CanvasRenderingContext2D, padding: number, cell: number, size: number) {
  context.fillStyle = 'rgba(6, 47, 31, 0.74)';
  context.font = `700 ${Math.max(9, size / 62)}px ui-monospace, SFMono-Regular, monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let index = 0; index < 8; index += 1) {
    context.fillText(String.fromCharCode(65 + index), padding + cell * (index + 0.5), padding * 0.42);
    context.fillText(String(index + 1), padding * 0.42, padding + cell * (index + 0.5));
  }
}

function manhattan(first: number, second: number) {
  return Math.abs(Math.floor(first / 8) - Math.floor(second / 8)) + Math.abs((first % 8) - (second % 8));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
