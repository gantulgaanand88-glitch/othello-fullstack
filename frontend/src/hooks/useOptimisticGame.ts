/**
 * useOptimisticGame — wraps the Socket.io game events with optimistic local
 * state updates. When the user clicks a valid tile:
 *   1. Instantly update local board (optimistic)
 *   2. Trigger flip animation
 *   3. Emit makeMove to server
 *   4. On gameUpdate → replace with authoritative state
 *   5. On moveRejected → snap back to last good state
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  applyMove,
  getLegalMoves,
  type GameState,
  type Player,
} from '../lib/gameEngine';

export interface GameFoundPayload {
  gameId:    string;
  yourColor: Player;
  opponent:  { id: string; username: string; rating: number };
  state:     GameState;
}

export interface GameUpdatePayload {
  state:         GameState;
  lastMove:      { row: number; col: number } | null;
  flipped:       [number, number][];
  remainingTime: number;
}

export interface GameOverPayload {
  winner:       Player | 'draw' | null;
  reason:       string;
  blackRating?: number;
  whiteRating?: number;
  ratingDelta?: number;
}

export interface UseOptimisticGameReturn {
  gameState:       GameState | null;
  yourColor:       Player | null;
  gameId:          string | null;
  opponent:        { id: string; username: string; rating: number } | null;
  lastMove:        { row: number; col: number } | null;
  flippedPieces:   [number, number][];
  remainingTime:   number;
  isOptimistic:    boolean;   // true while waiting for server confirmation
  gameOver:        GameOverPayload | null;
  handleSquareClick: (row: number, col: number) => void;
}

const WAVE_BASE_DELAY_MS = 55; // ms per Chebyshev step

export function computeWaveDelays(
  flipped: [number, number][],
  origin: { row: number; col: number } | null,
): Map<string, number> {
  const delays = new Map<string, number>();
  if (!origin || flipped.length === 0) return delays;

  for (const [r, c] of flipped) {
    const dist = Math.max(Math.abs(r - origin.row), Math.abs(c - origin.col));
    delays.set(`${r}-${c}`, dist * WAVE_BASE_DELAY_MS);
  }
  return delays;
}

export function useOptimisticGame(socket: Socket | null): UseOptimisticGameReturn {
  const [gameState,     setGameState]     = useState<GameState | null>(null);
  const [yourColor,     setYourColor]     = useState<Player | null>(null);
  const [gameId,        setGameId]        = useState<string | null>(null);
  const [opponent,      setOpponent]      = useState<{ id: string; username: string; rating: number } | null>(null);
  const [lastMove,      setLastMove]      = useState<{ row: number; col: number } | null>(null);
  const [flippedPieces, setFlippedPieces] = useState<[number, number][]>([]);
  const [remainingTime, setRemainingTime] = useState<number>(300_000);
  const [isOptimistic,  setIsOptimistic]  = useState(false);
  const [gameOver,      setGameOver]      = useState<GameOverPayload | null>(null);

  // Snapshot of last confirmed server state — used for rollback
  const confirmedState = useRef<GameState | null>(null);

  // ── Socket event listeners ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onGameFound = (payload: GameFoundPayload) => {
      setGameState(payload.state);
      setYourColor(payload.yourColor);
      setGameId(payload.gameId);
      setOpponent(payload.opponent);
      setLastMove(null);
      setFlippedPieces([]);
      setIsOptimistic(false);
      setGameOver(null);
      confirmedState.current = payload.state;
    };

    const onGameUpdate = (payload: GameUpdatePayload) => {
      // Server is authoritative — always replace optimistic state
      setGameState(payload.state);
      setLastMove(payload.lastMove);
      setFlippedPieces(payload.flipped);
      setRemainingTime(payload.remainingTime);
      setIsOptimistic(false);
      confirmedState.current = payload.state;

      if (payload.state.gameStatus === 'finished') {
        // gameOver will be sent separately via 'gameOver' event
      }
    };

    const onMoveRejected = () => {
      // Server rejected our optimistic move — snap back
      if (confirmedState.current) {
        setGameState(confirmedState.current);
      }
      setIsOptimistic(false);
      setFlippedPieces([]);
    };

    const onGameOver = (payload: GameOverPayload) => {
      setGameOver(payload);
    };

    const onGameAbandoned = (payload: GameOverPayload) => {
      setGameOver(payload);
    };

    socket.on('gameFound',      onGameFound);
    socket.on('gameUpdate',     onGameUpdate);
    socket.on('moveRejected',   onMoveRejected);
    socket.on('gameOver',       onGameOver);
    socket.on('gameAbandoned',  onGameAbandoned);

    return () => {
      socket.off('gameFound',     onGameFound);
      socket.off('gameUpdate',    onGameUpdate);
      socket.off('moveRejected',  onMoveRejected);
      socket.off('gameOver',      onGameOver);
      socket.off('gameAbandoned', onGameAbandoned);
    };
  }, [socket]);

  // ── Click handler ─────────────────────────────────────────────────────
  const handleSquareClick = useCallback(
    (row: number, col: number) => {
      if (!gameState || !yourColor || !socket || !gameId) return;
      if (gameState.currentPlayer !== yourColor) return;
      if (gameState.gameStatus !== 'playing') return;

      // Check legal
      const isLegal = gameState.legalMoves.some(([r, c]) => r === row && c === col);
      if (!isLegal) return;

      // Optimistic apply
      const result = applyMove(gameState, row, col);
      if (!result.valid) return;

      setGameState(result.newState);
      setLastMove({ row, col });
      setFlippedPieces(result.flipped);
      setIsOptimistic(true);

      // Emit to server
      socket.emit('makeMove', { gameId, row, col });
    },
    [gameState, yourColor, socket, gameId],
  );

  return {
    gameState,
    yourColor,
    gameId,
    opponent,
    lastMove,
    flippedPieces,
    remainingTime,
    isOptimistic,
    gameOver,
    handleSquareClick,
  };
}
