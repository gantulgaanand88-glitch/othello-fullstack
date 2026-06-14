import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import SvgBoard from '../components/SvgBoard';
import GameOverModal from '../components/GameOverModal';
import MatchmakingPanel from '../components/MatchmakingPanel';
import MoveHistory from '../components/MoveHistory';
import PlayerPanel from '../components/PlayerPanel';
import GameChat from '../components/GameChat';
import ReportModal from '../components/ReportModal';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import {
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
import { applyMove } from '../lib/gameEngine';

export function GamePage() {
  const navigate = useNavigate();
  const { user, token, openAuthModal, updateUser } = useAuth();
  const { isConnected, connect, disconnect, emit, on, setGameId: setSocketGameId } = useSocket();

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
  const [activeTab, setActiveTab] = useState<'ranked' | 'bot' | 'friend'>('ranked');
  const [selectedBotLevel, setSelectedBotLevel] = useState<string>('5');
  const [selectedColor, setSelectedColor] = useState<'black' | 'white' | 'random'>('random');

  // Live countdown timer state (re-synced with turn changes)
  const [remainingTime, setRemainingTime] = useState(5 * 60_000);

  // Chat message state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; message: string; timestamp: string }>>([]);

  // Draw offer state
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);

  // Report player modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Skip turn notification alert
  const [showPassTurnAlert, setShowPassTurnAlert] = useState(false);

  // Custom room state
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Keep useSocket updated with the current gameId for auto-rejoin
  useEffect(() => {
    setSocketGameId(gameId);
  }, [gameId, setSocketGameId]);

  // Warn on page unload during active play
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== 'playing') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'If you leave, you will forfeit this game. Are you sure?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gameState]);

  // Skip turn detector
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== 'playing') {
      setShowPassTurnAlert(false);
      return;
    }
    const history = gameState.moveHistory;
    if (history.length === 0) return;

    const last = history[history.length - 1];
    const wasPassed = last.player === gameState.currentPlayer;

    if (wasPassed && gameState.currentPlayer === yourColor) {
      setShowPassTurnAlert(true);
      const timer = setTimeout(() => setShowPassTurnAlert(false), 3500);
      return () => clearTimeout(timer);
    } else {
      setShowPassTurnAlert(false);
    }
  }, [gameState, yourColor]);

  // Connect socket and listen to events
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
        setRemainingTime(5 * 60_000);
        setChatMessages([]);
        setDrawOfferSent(false);
        setDrawOfferReceived(false);
      }),
      on<GameUpdateEvent>('gameUpdate', ({ state, lastMove: move, flipped: nextFlipped, remainingTime: nextRemainingTime }) => {
        setGameState(state);
        setLastMove(move ? { row: move.row, col: move.col } : null);
        setFlipped(nextFlipped);
        setInvalidReason(null);
        setRemainingTime(nextRemainingTime ?? 5 * 60_000);
      }),
      on<{ gameId: string; yourColor: Player; state: GameState; remainingTime: number }>('gameRejoined', ({ gameId: nextGameId, yourColor: nextColor, state, remainingTime: nextRemaining }) => {
        setGameId(nextGameId);
        setYourColor(nextColor);
        setGameState(state);
        setRemainingTime(nextRemaining ?? 5 * 60_000);
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

        updateUser({
          ...currentUser,
          rating: newRating,
          rank: getPlayerRankLabel(newRating),
        });
      }),
      on('rematchRequested', () => {
        setRematchRequestedByOpponent(true);
      }),
      on<{ message: string }>('serverError', ({ message }) => {
        setInvalidReason(message);
        setTimeout(() => setInvalidReason(null), 4000);
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
      on<{ sender: string; message: string; timestamp: string }>('chatMessage', (message) => {
        setChatMessages((prev) => [...prev, message]);
      }),
      on('drawOffered', () => {
        setDrawOfferReceived(true);
      }),
      on('drawDeclined', () => {
        setDrawOfferSent(false);
        setInvalidReason('Draw offer was declined by your opponent.');
        setTimeout(() => setInvalidReason(null), 3000);
      }),
      on('opponentDisconnected', () => {
        setInvalidReason('Opponent disconnected. Grace period active (30s)...');
      }),
      on('opponentReconnected', () => {
        setInvalidReason('Opponent reconnected.');
        setTimeout(() => setInvalidReason(null), 3000);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      disconnect();
    };
  }, [connect, disconnect, on, token, updateUser]);

  if (!user || !token) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-gray-800 bg-gray-800/80 p-10 text-center shadow-xl">
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">Play Othello</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Sign in to start playing</h1>
        <p className="mt-4 text-gray-300 leading-relaxed">
          Create an account for ranked matchmaking with persistent ELO ratings, or play casually as a guest.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 active:scale-95"
          >
            Login / Register
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await useAuth().loginAsGuest();
              } catch {
                openAuthModal('login');
              }
            }}
            className="rounded-full border border-gray-600 bg-gray-700/50 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-700 active:scale-95"
          >
            ⚡ Play as Guest
          </button>
        </div>
      </div>
    );
  }

  const handleJoinQueue = () => {
    emit('joinQueue');
  };

  const handleLeaveQueue = () => {
    emit('leaveQueue');
    setQueueJoinedAt(null);
  };

  const handleMove = (row: number, col: number) => {
    if (!gameId || !gameState || gameState.gameStatus !== 'playing' || gameState.currentPlayer !== yourColor) {
      return;
    }

    const isLegal = gameState.legalMoves.some(([r, c]) => r === row && c === col);
    if (isLegal) {
      const result = applyMove(gameState, row, col);
      if (result.valid) {
        setGameState(result.newState);
        setLastMove({ row, col });
        setFlipped(result.flipped);
      }
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

  const handleOfferDraw = () => {
    if (!gameId) return;
    emit('offerDraw', { gameId });
    setDrawOfferSent(true);
  };

  const handleRespondDraw = (accept: boolean) => {
    if (!gameId) return;
    emit('respondDraw', { gameId, accept });
    setDrawOfferReceived(false);
  };

  const handleSendChat = (message: string) => {
    if (!gameId) return;
    emit('chatMessage', { gameId, message });
  };

  const handleCreateRoom = () => {
    emit('createRoom');
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) {
      setRoomError('Please enter a room code.');
      return;
    }
    setRoomError(null);
    emit('joinRoom', { roomCode: joinCode.trim() });
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
  const isBotGame = !!opponent?.id?.startsWith('bot_');

  const handleStartBotGame = () => {
    emit('startBotGame', {
      difficulty: selectedBotLevel,
      playerColor: selectedColor,
    });
  };

  return (
    <div className="space-y-6">
      {/* Connection status indicator */}
      {!isConnected && gameState ? (
        <div className="flex items-center gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-255 justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse-soft" />
          Reconnecting to server...
        </div>
      ) : null}

      {/* Skip Turn Toast Notification */}
      {showPassTurnAlert && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-green-500/35 bg-green-900/90 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-green-500/10 animate-slide-up">
          ⚠️ Opponent skipped! Turn passed to you!
        </div>
      )}

      {/* Draw Offer Notification */}
      {drawOfferReceived && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-950/20 p-4 flex items-center justify-between gap-4 animate-fade-in-up">
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Draw Offered</p>
            <p className="text-xs text-gray-400">Your opponent has proposed a draw.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleRespondDraw(false)}
              className="rounded-full border border-gray-650 bg-gray-800 px-4 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-gray-700"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleRespondDraw(true)}
              className="rounded-full bg-yellow-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-yellow-550"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {!gameState && !queueJoinedAt && !waitingForOpponent ? (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] text-left">
          <div className="space-y-6">
            {/* Tab Bar */}
            <div className="flex border-b border-gray-800">
              <button
                type="button"
                onClick={() => setActiveTab('ranked')}
                className={`border-b-2 px-6 py-3.5 text-sm font-semibold tracking-wide transition active:scale-95 ${
                  activeTab === 'ranked'
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-gray-250'
                }`}
              >
                🏆 Ranked Play
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bot')}
                className={`border-b-2 px-6 py-3.5 text-sm font-semibold tracking-wide transition active:scale-95 ${
                  activeTab === 'bot'
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-gray-250'
                }`}
              >
                🤖 Play vs Computer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('friend')}
                className={`border-b-2 px-6 py-3.5 text-sm font-semibold tracking-wide transition active:scale-95 ${
                  activeTab === 'friend'
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-gray-250'
                }`}
              >
                👥 Play vs Friend
              </button>
            </div>

            {/* Ranked Tab */}
            {activeTab === 'ranked' && (
              <div className="rounded-[2rem] border border-gray-800 bg-gradient-to-br from-gray-800 via-gray-900 to-green-950/70 p-8 shadow-2xl animate-fade-in">
                <p className="text-sm uppercase tracking-[0.25em] text-green-400">
                  {user.isGuest ? 'Quick Play' : 'Ranked Queue'}
                </p>
                <h1 className="mt-4 text-4xl font-semibold text-white">
                  {user.isGuest ? 'Find an opponent and play.' : 'Find a live opponent and start climbing.'}
                </h1>
                <p className="mt-4 max-w-xl text-gray-300 leading-relaxed">
                  {user.isGuest
                    ? 'Guest games are casual and do not affect ELO ratings. Create an account to play ranked.'
                    : 'Matchmaking pairs you by rating, expands search range after ten seconds, and records all ranked games.'}
                </p>
                <button
                  type="button"
                  onClick={handleJoinQueue}
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  {user.isGuest ? 'Find Match' : 'Find Ranked Match'}
                </button>
              </div>
            )}

            {/* Friend Tab */}
            {activeTab === 'friend' && (
              <div className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl animate-fade-in">
                <p className="text-sm uppercase tracking-[0.25em] text-green-400">Private Room</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Play with a friend</h2>
                <p className="mt-3 text-sm text-gray-300 leading-relaxed">
                  Create a room and share the code, or enter a code to join an existing room.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 active:scale-95"
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
                      className="rounded-full border border-gray-600 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:border-green-500 hover:text-white active:scale-95"
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
            )}

            {/* Bot Tab */}
            {activeTab === 'bot' && (
              <div className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl space-y-8 animate-fade-in">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-green-400">Casual Mode</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Play vs Computer</h2>
                  <p className="mt-2 text-sm text-gray-300 leading-relaxed">
                    Hone your skills against our custom engine. Select a difficulty below.
                  </p>
                </div>

                {/* Color Selector */}
                <div className="space-y-3">
                  <span className="text-sm font-semibold text-gray-300 block">Choose Your Color</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {[
                      { value: 'black', label: '⚫ Black (Plays First)' },
                      { value: 'white', label: '⚪ White (Plays Second)' },
                      { value: 'random', label: '🎲 Random' }
                    ].map((col) => (
                      <button
                        key={col.value}
                        type="button"
                        onClick={() => setSelectedColor(col.value as any)}
                        className={`flex-1 rounded-full border px-5 py-3 text-sm font-semibold transition active:scale-95 ${
                          selectedColor === col.value
                            ? 'border-green-500 bg-green-500/10 text-green-400'
                            : 'border-gray-700 bg-gray-900/50 text-gray-305 hover:border-gray-600'
                        }`}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Levels Card Grid */}
                <div className="space-y-3">
                  <span className="text-sm font-semibold text-gray-300 block">Select AI Difficulty Level</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { level: '1', name: 'Novice Nebula', rating: 200, color: 'text-green-400 border-green-500/20', desc: 'Level 1: 85% random moves' },
                      { level: '2', name: 'Comet Cadet', rating: 400, color: 'text-green-400 border-green-500/20', desc: 'Level 2: 50% random moves' },
                      { level: '3', name: 'Meteor Scout', rating: 600, color: 'text-yellow-400 border-yellow-500/20', desc: 'Level 3: Greedy capture strategy' },
                      { level: '4', name: 'Gravity Guard', rating: 900, color: 'text-yellow-400 border-yellow-500/20', desc: 'Level 4: Minimax lookahead depth 1' },
                      { level: '5', name: 'Orbit Officer', rating: 1200, color: 'text-blue-400 border-blue-500/20', desc: 'Level 5: Minimax lookahead depth 2' },
                      { level: '6', name: 'Proton Pilot', rating: 1500, color: 'text-blue-400 border-blue-500/20', desc: 'Level 6: Minimax lookahead depth 3' },
                      { level: '7', name: 'Sly Sentinel', rating: 1700, color: 'text-orange-400 border-orange-500/20', desc: 'Level 7: Corner-seeking lookahead depth 4' },
                      { level: '8', name: 'Nebula Knight', rating: 1900, color: 'text-orange-400 border-orange-500/20', desc: 'Level 8: Defensive search depth 5' },
                      { level: '9', name: 'Galaxy Guardian', rating: 2100, color: 'text-purple-400 border-purple-500/20', desc: 'Level 9: Expert lookahead depth 6' },
                      { level: '10', name: 'Grandmaster Orion', rating: 2400, color: 'text-red-400 border-red-500/20', desc: 'Level 10: Complete lookahead depth 6' }
                    ].map((bot) => (
                      <button
                        key={bot.level}
                        type="button"
                        onClick={() => setSelectedBotLevel(bot.level)}
                        className={`rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                          selectedBotLevel === bot.level
                            ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/5'
                            : 'border-gray-800 bg-gray-900/60 hover:border-gray-700 hover:bg-gray-900/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold ${bot.color.split(' ')[0]}`}>{bot.name}</span>
                          <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-bold font-mono text-gray-300 border border-gray-700">
                            {bot.rating}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400 leading-normal">{bot.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Game Button */}
                <button
                  type="button"
                  onClick={handleStartBotGame}
                  className="w-full rounded-full bg-green-600 py-4 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 active:scale-95 flex justify-center items-center gap-2"
                >
                  ⚡ Start Game Against Computer
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 shadow-xl">
            <h2 className="text-2xl font-semibold text-white">Session Snapshot</h2>
            {user.isGuest ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-6 text-sm text-gray-300 leading-relaxed">
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
        <div className="rounded-3xl border border-gray-700 bg-gray-800/90 p-6 shadow-xl text-left">
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

          <p className="mt-4 text-center text-sm text-gray-300 leading-relaxed">
            Share this code with your friend. They can enter it on the Play page to join.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 active:scale-95"
            >
              📋 Copy Code
            </button>
            <button
              type="button"
              onClick={handleCancelRoom}
              className="rounded-full border border-gray-600 px-5 py-3 text-sm font-medium text-gray-200 transition hover:border-red-400 hover:text-red-300 active:scale-95"
            >
              Cancel Room
            </button>
          </div>
        </div>
      ) : null}

      {queueJoinedAt ? <MatchmakingPanel queueStartTime={queueJoinedAt} onCancel={handleLeaveQueue} /> : null}

      {invalidReason ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 justify-center">
          {invalidReason}
        </div>
      ) : null}

      {gameState && yourColor && opponent ? (
        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px] text-left">
          {/* Left Column: Player Panels & Timers */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="space-y-3">
              <PlayerPanel
                username={opponent.username}
                rating={opponent.rating}
                rank={opponent.rank || getPlayerRankLabel(opponent.rating)}
                score={opponentScore}
                color={yourColor === 'black' ? 'white' : 'black'}
                isActive={gameState.currentPlayer !== yourColor && gameState.gameStatus === 'playing'}
                isTop={true}
                timeMs={gameState.currentPlayer !== yourColor ? remainingTime : 5 * 60_000}
                isGuest={opponent.id.startsWith('guest_') || opponent.id.startsWith('bot_')}
              />
              {!user.isGuest && !isBotGame && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(true)}
                    className="text-xs font-semibold text-gray-500 hover:text-red-400 transition bg-gray-900/40 border border-gray-800 rounded-full px-3 py-1.5 active:scale-95"
                  >
                    🚩 Report
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <PlayerPanel
                username={user.username}
                rating={user.rating}
                rank={user.rank}
                score={yourScore}
                color={yourColor}
                isActive={gameState.currentPlayer === yourColor && gameState.gameStatus === 'playing'}
                isTop={false}
                timeMs={gameState.currentPlayer === yourColor ? remainingTime : 5 * 60_000}
                isGuest={user.isGuest}
              />
            </div>
          </div>

          {/* Center Column: GameBoard & In-Game Controls */}
          <div className="space-y-4">
            <div className="w-full max-w-[600px] aspect-square mx-auto xl:mx-0">
              <SvgBoard
                board={gameState.board}
                legalMoves={gameState.legalMoves}
                lastMove={lastMove}
                flippedPieces={flipped}
                currentPlayer={gameState.currentPlayer}
                yourColor={yourColor}
                onSquareClick={handleMove}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {resignConfirmOpen ? (
                <div className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2">
                  <span className="text-sm text-red-200">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleResign}
                    className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 active:scale-95"
                  >
                    Yes, Resign
                  </button>
                  <button
                    type="button"
                    onClick={() => setResignConfirmOpen(false)}
                    className="rounded-full border border-gray-600 px-4 py-1.5 text-xs font-medium text-gray-300 transition hover:border-gray-500 active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResign}
                  disabled={gameState.gameStatus !== 'playing'}
                  className="rounded-full border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                >
                  Resign
                </button>
              )}

              <button
                type="button"
                onClick={handleOfferDraw}
                disabled={gameState.gameStatus !== 'playing' || drawOfferSent}
                className="rounded-full border border-yellow-500/30 px-5 py-2.5 text-sm font-medium text-yellow-250 transition hover:bg-yellow-500/10 disabled:opacity-50 active:scale-95"
              >
                {drawOfferSent ? 'Draw Offered' : 'Offer Draw'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-full border border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:bg-gray-800 active:scale-95"
              >
                Back Home
              </button>
            </div>

            {rematchPending ? (
              <p className="text-sm text-green-300 text-left">Rematch requested. Waiting for your opponent.</p>
            ) : null}
            {rematchRequestedByOpponent ? (
              <p className="text-sm text-yellow-300 text-left">Your opponent wants a rematch.</p>
            ) : null}
          </div>

          {/* Right Column: Move History & In-Game Live Chat / AI Dashboard */}
          <div className="space-y-6">
            <MoveHistory moves={gameState.moveHistory} />
            {isBotGame ? (
              <div className="flex h-[320px] flex-col justify-between rounded-3xl border border-gray-700 bg-gray-800/80 p-5 shadow-lg backdrop-blur text-left">
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 border-b border-gray-700/60 pb-2">
                    <span className="text-lg">🤖</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">AI Engine Info</span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-green-400">{opponent.username}</h4>
                    <p className="text-xs text-gray-450 font-mono">Opponent Type: Local AI</p>
                  </div>
                  <div className="rounded-xl bg-gray-900/40 p-3 border border-gray-850 text-xs text-gray-350 leading-relaxed font-sans">
                    <strong>Search Model:</strong> Uses alpha-beta minimax lookahead with dynamic weights evaluation.
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed italic">
                    💡 <strong>Tip:</strong> Corners are static and cannot be flipped. Prioritize taking corners and force the bot to play in the adjacent X/C squares.
                  </p>
                </div>
                <div className="text-[10px] text-gray-500 text-center border-t border-gray-700/40 pt-2 font-mono">
                  Casual Match • ELO Updates Disabled
                </div>
              </div>
            ) : (
              <GameChat
                messages={chatMessages}
                onSend={handleSendChat}
                opponentUsername={opponent.username}
              />
            )}
          </div>
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

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reportedUserId={opponent?.id ?? ''}
        reportedUsername={opponent?.username ?? ''}
        gameId={gameId ?? undefined}
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
