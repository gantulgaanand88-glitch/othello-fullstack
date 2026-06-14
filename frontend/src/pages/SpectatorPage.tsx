import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import GameBoard from '../components/GameBoard';
import type { GameState } from '../types';

interface ActiveGame {
  gameId: string;
  blackPlayer: { username: string; rating: number };
  whitePlayer: { username: string; rating: number };
  score: { black: number; white: number };
  currentPlayer: 'black' | 'white';
}

export function SpectatorPage() {
  const { token } = useAuth();
  const { isConnected, connect, disconnect, emit, on } = useSocket();
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [spectatingGameId, setSpectatingGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    connect(token);

    const unsubscribers = [
      on<ActiveGame[]>('activeGamesList', (games) => {
        setActiveGames(games);
        setLoading(false);
      }),
      on<{ gameId: string; state: GameState }>('spectateSuccess', ({ gameId, state }) => {
        setSpectatingGameId(gameId);
        setGameState(state);
      }),
      on<{ state: GameState }>('gameUpdate', ({ state }) => {
        setGameState(state);
      }),
      on('spectatorGameOver', () => {
        setSpectatingGameId(null);
        setGameState(null);
        emit('listActiveGames');
      }),
    ];

    emit('listActiveGames');

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      disconnect();
    };
  }, [token, connect, disconnect, emit, on]);

  const handleSpectate = useCallback((gameId: string) => {
    emit('spectateGame', { gameId });
  }, [emit]);

  const handleStopSpectating = useCallback(() => {
    setSpectatingGameId(null);
    setGameState(null);
    emit('listActiveGames');
  }, [emit]);

  if (!token) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-gray-800 bg-gray-800/80 p-10 text-center shadow-xl">
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">Spectate</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Sign in to spectate</h1>
        <p className="mt-4 text-gray-300">Log in or play as a guest to watch live games.</p>
      </div>
    );
  }

  // Spectating a game
  if (spectatingGameId && gameState) {
    const activeGame = activeGames.find((g) => g.gameId === spectatingGameId);
    return (
      <div className="space-y-6 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-green-400">Spectating</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {activeGame?.blackPlayer.username ?? 'Black'} vs {activeGame?.whitePlayer.username ?? 'White'}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleStopSpectating}
            className="rounded-full border border-gray-600 px-5 py-2 text-sm font-medium text-gray-200 transition hover:border-red-400 hover:text-red-300 active:scale-95"
          >
            Stop Watching
          </button>
        </div>

        <div className="mx-auto max-w-lg">
          <GameBoard
            state={gameState}
            yourColor={null}
            lastMove={null}
            flipped={[]}
            onSquareClick={() => {/* Read-only for spectators */}}
          />
        </div>

        <div className="flex justify-center gap-6 text-center">
          <div className="rounded-2xl border border-gray-700 bg-gray-800/80 px-6 py-4">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Black ({activeGame?.blackPlayer.username})</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">{gameState.blackScore}</p>
          </div>
          <div className="rounded-2xl border border-gray-700 bg-gray-800/80 px-6 py-4">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">White ({activeGame?.whitePlayer.username})</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">{gameState.whiteScore}</p>
          </div>
        </div>
      </div>
    );
  }

  // Game list
  return (
    <section className="rounded-[2rem] border border-gray-800 bg-gray-800/80 p-6 shadow-xl sm:p-8 text-left">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-green-400">Spectate</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Live Games</h1>
        </div>
        {isConnected ? (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse-soft" />
            Live
          </span>
        ) : (
          <span className="text-xs text-yellow-400">Connecting...</span>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
            <span className="ml-3 text-sm text-gray-400">Loading active games...</span>
          </div>
        ) : null}

        {!loading && activeGames.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-800 text-2xl">
              👀
            </div>
            <p className="text-sm text-gray-400">No active games right now. Check back soon!</p>
          </div>
        ) : null}

        {activeGames.map((game) => (
          <div
            key={game.gameId}
            className="flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-900/50 px-5 py-4 transition hover:border-green-500/30 hover:bg-gray-900/70"
          >
            <div className="flex items-center gap-6">
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-white">{game.blackPlayer.username}</p>
                <p className="text-xs text-gray-500">{game.blackPlayer.rating}</p>
              </div>
              <div className="flex items-center gap-2 text-gray-500 font-semibold">
                <span className="text-lg font-bold tabular-nums text-white">{game.score.black}</span>
                <span>—</span>
                <span className="text-lg font-bold tabular-nums text-white">{game.score.white}</span>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-white">{game.whitePlayer.username}</p>
                <p className="text-xs text-gray-500">{game.whitePlayer.rating}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSpectate(game.gameId)}
              className="rounded-full bg-green-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-green-500 active:scale-95"
            >
              Watch
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SpectatorPage;
