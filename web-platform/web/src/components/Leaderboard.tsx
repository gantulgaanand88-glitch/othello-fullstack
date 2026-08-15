import { useEffect, useState } from 'react';

interface RankingRow {
  handle: string;
  display_name: string;
  country_code: string | null;
  title: string | null;
  rating: number;
  games_played: number;
}

export function Leaderboard({ pool = 'rapid', compact = false }: { pool?: string; compact?: boolean }) {
  const [players, setPlayers] = useState<RankingRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    if (import.meta.env.VITE_ENABLE_REALTIME !== 'true') {
      setStatus('ready');
      return () => controller.abort();
    }
    setStatus('loading');
    fetch(`/api/rankings?pool=${encodeURIComponent(pool)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Rankings unavailable')))
      .then((rows: RankingRow[]) => {
        setPlayers(rows);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [pool]);

  if (status === 'loading') {
    return <div className="data-empty" aria-live="polite"><span className="loading-line" />Loading verified results…</div>;
  }
  if (status === 'error') {
    return <div className="data-empty"><strong>Rankings are temporarily unavailable.</strong><span>The game service is still available.</span></div>;
  }
  if (players.length === 0) {
    return <div className="data-empty"><strong>The ladder is ready for its first result.</strong><span>No fabricated players, ratings, or records.</span></div>;
  }

  return (
    <div className={`leaderboard${compact ? ' leaderboard-compact' : ''}`}>
      <div className="leaderboard-head"><span>Rank</span><span>Player</span><span>Rating</span><span>Games</span></div>
      {players.map((player, index) => (
        <div className="leaderboard-row" key={player.handle}>
          <strong className="rank-number">{String(index + 1).padStart(2, '0')}</strong>
          <div className="rank-player">
            <span className="avatar avatar-dark">{player.handle.slice(0, 2).toUpperCase()}</span>
            <div><strong>{player.display_name || player.handle}</strong><span>{[player.country_code, player.title].filter(Boolean).join(' · ') || 'Player'}</span></div>
          </div>
          <strong>{Math.round(player.rating)}</strong>
          <span>{player.games_played}</span>
        </div>
      ))}
    </div>
  );
}
