import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import GameBoard from '../components/GameBoard';
import GameOverModal from '../components/GameOverModal';
import MatchmakingPanel from '../components/MatchmakingPanel';
import MoveHistory from '../components/MoveHistory';
import PlayerPanel from '../components/PlayerPanel';
import { useSocket } from '../hooks/useSocket';
import { loginAsGuest, setAuthToken } from '../services/api';
import {
  AuthUser,
  GameFoundEvent,
  GameOverEvent,
  GameState,
  GameUpdateEvent,
  OpponentSummary,
  Player,
  QueueJoinedEvent,
  RatingUpdateEvent,
  getPlayerRankLabel,
} from '../types';

interface GamePageProps {
  user: AuthUser | null;
  token: string | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onUserUpdate: (user: AuthUser) => void;
}

export function GamePage({ user, token, onOpenAuth, onUserUpdate }: GamePageProps) {
  const navigate = useNavigate();
  const { isConnected, connect, disconnect, emit, on } = useSocket();
  const userRef = useRef<AuthUser | null>(user);
  const onUserUpdateRef = useRef(onUserUpdate);

  const [queueJoinedAt, setQueueJoinedAt] = useState<number | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [yourColor, setYourColor] = useState<Player | null>(null);
  const [opponent, setOpponent] = useState<OpponentSummary | null>(null);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);
  const [flipped, setFlipped] = useState<[number, number][]>([]);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  const [rematchPending, setRematchPending] = useState(false);
  const [rematchRequestedByOpponent, setRematchRequestedByOpponent] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [resignConfirmOpen, setResignConfirmOpen] = useState(false);

  // Custom room state
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    onUserUpdateRef.current = onUserUpdate;
  }, [onUserUpdate]);

  useEffect(() => {
    if (!token) {
      return;
    }

    connect(token);

    const unsubscribers = [
      on<QueueJoinedEvent>('queueJoined', ({ joinedAt }) => {
        setQueueJoinedAt(joinedAt);
        setInvalidReason(null);
      }),
      on('queueLeft', () => {
        setQueueJoinedAt(null);
      }),
      on<GameFoundEvent>('gameFound', ({ gameId: nextGameId, yourColor: nextColor, opponent: nextOpponent, state }) => {
        setQueueJoinedAt(null);
        setGameId(nextGameId);
        setYourColor(nextColor);
        setOpponent(nextOpponent);
        setGameState(state);
        setLastMove(null);
        setFlipped([]);
        setGameResult(null);
        setRatingChange(null);
        setRematchPending(false);
        setRematchRequestedByOpponent(false);
        setInvalidReason(null);
        setRoomCode(null);
        setWaitingForOpponent(false);
        setRoomError(null);
        setJoinCode('');
        setResignConfirmOpen(false);
      }),
      on<GameUpdateEvent>('gameUpdate', ({ state, lastMove: move, flipped: nextFlipped }) => {
        setGameState(state);
        setLastMove(move ? { row: move.row, col: move.col } : null);
        setFlipped(nextFlipped);
        setInvalidReason(null);
      }),
      on<{ reason: string }>('invalidMove', ({ reason }) => {
        setInvalidReason(reason);
      }),
      on<GameOverEvent>('gameOver', ({ result, finalState }) => {
        setGameState(finalState);
        setGameResult(result);
        setQueueJoinedAt(null);
        setRematchPending(false);
        setResignConfirmOpen(false);
      }),
      on<RatingUpdateEvent>('ratingUpdate', ({ newRating, ratingChange: nextRatingChange }) => {
        setRatingChange(nextRatingChange);
        const currentUser = userRef.current;

        if (!currentUser) {
          return;
        }

        onUserUpdateRef.current({
          ...currentUser,
          rating: newRating,
          rank: getPlayerRankLabel(newRating),
        });
      }),
      on('rematchRequested', () => {
        setRematchRequestedByOpponent(true);
      }),
      on<{ message: string }>('error', ({ message }) => {
        setInvalidReason(message);
      }),
      on<{ roomCode: string }>('roomCreated', ({ roomCode: code }) => {
        setRoomCode(code);
        setWaitingForOpponent(true);
        setRoomError(null);
      }),
      on<{ message: string }>('roomError', ({ message }) => {
        setRoomError(message);
      }),
      on('roomCancelled', () => {
        setRoomCode(null);
        setWaitingForOpponent(false);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      disconnect();
    };
  }, [connect, disconnect, on, token]);

  const handlePlayAsGuest = async () => {
    try {
      const response = await loginAsGuest();
      setAuthToken(response.token);
      window.localStorage.setItem('othello-auth', JSON.stringify(response));
      window.location.reload();
    } catch {
      onOpenAuth('login');
    }
  };

  if (!user || !token) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-gray-800 bg-gray-800/80 p-10 text-center shadow-xl">
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">Play Othello</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Sign in or play as a guest</h1>
        <p className="mt-4 text-gray-300">
          Create an account for ranked matchmaking with ELO, or jump in instantly as a guest.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
          >
            Login to Play
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="rounded-full border border-gray-600 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-500 hover:bg-gray-800"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={handlePlayAsGuest}
            className="rounded-full border border-gray-600 bg-gray-700/50 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-700"
          >
            ⚡ Play as Guest
          </button>
        </div>
      </div>
    );
  }

  const handleJoinQueue = () => {
    emit('joinQueue', { token, rating: user.rating });
  };

  const handleLeaveQueue = () => {
    emit('leaveQueue');
    setQueueJoinedAt(null);
  };

  const handleMove = (row: number, col: number) => {
    if (!gameId || !gameState || gameState.gameStatus !== 'playing' || gameState.currentPlayer !== yourColor) {
      return;
    }

    emit('makeMove', { gameId, row, col });
  };

  const handleResign = () => {
    if (!gameId) {
      return;
    }

    if (!resignConfirmOpen) {
      setResignConfirmOpen(true);
      return;
    }

    emit('resign', { gameId });
    setResignConfirmOpen(false);
  };

  const handleRematch = () => {
    if (!gameId) {
      return;
    }

    emit('requestRematch', { gameId });
    setRematchPending(true);
    setRematchRequestedByOpponent(false);
  };

  const handleCreateRoom = () => {
    emit('createRoom', { token });
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) {
      setRoomError('Please enter a room code.');
      return;
    }
    setRoomError(null);
    emit('joinRoom', { token, roomCode: joinCode.trim() });
  };

  const handleCancelRoom = () => {
    emit('cancelRoom');
    setRoomCode(null);
    setWaitingForOpponent(false);
  };

  const handleCopyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    }
  };

  const yourScore = yourColor === 'black' ? gameState?.blackScore ?? 2 : gameState?.whiteScore ?? 2;
  const opponentScore = yourColor === 'black' ? gameState?.whiteScore ?? 2 : gameState?.blackScore ?? 2;

  return (
    <div className="space-y-6">
      {/* Connection status indicator */}
      {!isConnected && gameState ? (
        <div className="flex items-center gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse-soft" />
          Reconnecting to server...
        </div>
      ) : null}

      {!gameState && !queueJoinedAt && !waitingForOpponent ? (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-gray-800 bg-gradient-to-br from-gray-800 via-gray-900 to-green-950/70 p-8 shadow-2xl">
              <p className="text-sm uppercase tracking-[0.25em] text-green-400">
                {user.isGuest ? 'Quick Play' : 'Ranked Queue'}
              </p>
              <h1 className="mt-4 text-4xl font-semibold text-white">
                {user.isGuest ? 'Find an opponent and play.' : 'Find a live opponent and start climbing.'}
              </h1>
              <p className="mt-4 max-w-xl text-gray-300">
                {user.isGuest
                  ? 'Guest games are casual and do not affect ELO ratings. Create an account to play ranked.'
                  : 'Matchmaking pairs you by rating, expands search intelligently after ten seconds, and records every result to your profile.'}
              </p>
              <button
                type="button"
                onClick={handleJoinQueue}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {user.isGuest ? 'Find Match' : 'Find Ranked Match'}
              </button>
            </div>

            {/* Custom Room Section */}
            <div className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-green-400">Private Room</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Play with a friend</h2>
              <p className="mt-3 text-sm text-gray-300">
                Create a room and share the code, or enter a code to join an existing room.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  Create Room
                </button>
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      setRoomError(null);
                    }}
                    placeholder="Enter room code"
                    maxLength={6}
                    className="flex-1 rounded-full border border-gray-700 bg-gray-900 px-4 py-3 text-center text-sm font-mono tracking-[0.3em] text-white uppercase outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleJoinRoom}
                    className="rounded-full border border-gray-600 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:border-green-500 hover:text-white"
                  >
                    Join
                  </button>
                </div>
              </div>

              {roomError ? (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                  {roomError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl">
            <h2 className="text-2xl font-semibold text-white">Session Snapshot</h2>
            {user.isGuest ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-6 text-sm text-gray-300">
                <p className="font-semibold text-white">Playing as {user.username}</p>
                <p className="mt-2">Guest games are unranked. Create an account to track stats and climb the leaderboard.</p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Rating</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{user.rating}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Games</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{user.gamesPlayed}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Wins</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-green-400">{user.wins}</p>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4 transition hover:border-gray-600">
                  <p className="text-sm text-gray-400">Draws</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-yellow-400">{user.draws}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Waiting for opponent in custom room */}
      {waitingForOpponent && roomCode ? (
        <div className="rounded-3xl border border-gray-700 bg-gray-800/90 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-green-400">Private Room</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Waiting for your friend to join</h3>
            </div>
            <span className="h-3 w-3 rounded-full bg-green-400 animate-pulse-soft" />
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-8 py-4">
              <p className="text-xs uppercase tracking-widest text-gray-400 text-center">Room Code</p>
              <p className="mt-2 text-4xl font-bold tracking-[0.4em] text-green-300 text-center">{roomCode}</p>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-gray-300">
            Share this code with your friend. They can enter it on the Play page to join.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              📋 Copy Code
            </button>
            <button
              type="button"
              onClick={handleCancelRoom}
              className="rounded-full border border-gray-600 px-5 py-3 text-sm font-medium text-gray-200 transition hover:border-red-400 hover:text-red-300"
            >
              Cancel Room
            </button>
          </div>
        </div>
      ) : null}

      {queueJoinedAt ? <MatchmakingPanel queueStartTime={queueJoinedAt} onCancel={handleLeaveQueue} /> : null}

      {invalidReason ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {invalidReason}
        </div>
      ) : null}

      {gameState && yourColor && opponent ? (
        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <PlayerPanel
              user={user}
              color={yourColor}
              score={yourScore}
              isActiveTurn={gameState.currentPlayer === yourColor && gameState.gameStatus === 'playing'}
              ratingChange={ratingChange}
            />
            <PlayerPanel
              user={opponent}
              color={yourColor === 'black' ? 'white' : 'black'}
              score={opponentScore}
              isActiveTurn={gameState.currentPlayer !== yourColor && gameState.gameStatus === 'playing'}
            />
          </div>

          <div className="space-y-4">
            <GameBoard
              state={gameState}
              yourColor={yourColor}
              lastMove={lastMove}
              flipped={flipped}
              onSquareClick={handleMove}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              {resignConfirmOpen ? (
                <div className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2">
                  <span className="text-sm text-red-200">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleResign}
                    className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                  >
                    Yes, Resign
                  </button>
                  <button
                    type="button"
                    onClick={() => setResignConfirmOpen(false)}
                    className="rounded-full border border-gray-600 px-4 py-1.5 text-xs font-medium text-gray-300 transition hover:border-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResign}
                  disabled={gameState.gameStatus !== 'playing'}
                  className="rounded-full border border-red-500/40 px-5 py-3 text-sm font-medium text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Resign
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-full border border-gray-600 px-5 py-3 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-800"
              >
                Back Home
              </button>
            </div>

            {rematchPending ? (
              <p className="text-sm text-green-300">Rematch requested. Waiting for your opponent.</p>
            ) : null}
            {rematchRequestedByOpponent ? (
              <p className="text-sm text-yellow-300">Your opponent wants a rematch.</p>
            ) : null}
          </div>

          <MoveHistory moves={gameState.moveHistory} />
        </section>
      ) : null}

      <GameOverModal
        isOpen={gameResult !== null}
        result={gameResult}
        finalState={gameState}
        ratingChange={ratingChange}
        onRematch={handleRematch}
        onHome={() => navigate('/')}
      />

      {/* Copy toast */}
      {showCopiedToast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-green-500/30 bg-green-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-green-500/20 animate-toast">
          ✓ Room code copied!
        </div>
      ) : null}
    </div>
  );
}

export default GamePage;
