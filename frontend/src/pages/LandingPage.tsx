import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchLeaderboard } from '../services/api';
import type { LeaderboardEntry } from '../types';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { num: '01', title: 'Rated Matchmaking',  desc: 'Elo-based pairing with intelligent window expansion. No waiting forever.' },
  { num: '02', title: 'Live ELO Rankings',  desc: 'Every result updates your rating instantly using standard chess Elo math.' },
  { num: '03', title: 'Move Analysis',       desc: 'Full move history with board-coordinate notation and flip animations.' },
  { num: '04', title: 'Private Rooms',       desc: 'Generate a 6-digit code and play directly with a friend.' },
];

const RANK_COLORS: Record<string, string> = {
  Beginner: '#4b5563', Intermediate: '#4c7fc9',
  Advanced: '#9b6bbf', Expert: '#c87c3e', Master: '#c9a84c',
};

export function LandingPage() {
  const { user, openAuthModal, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loadingGuest, setLoadingGuest] = useState(false);

  useEffect(() => {
    fetchLeaderboard()
      .then(e => setLeaders(e.slice(0, 5)))
      .catch(() => setLeaders([]));
  }, []);

  const handleGuest = async () => {
    setLoadingGuest(true);
    try { await loginAsGuest(); navigate('/game'); }
    catch { openAuthModal('login'); }
    finally { setLoadingGuest(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-5">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="grid lg:grid-cols-[1.35fr_0.65fr] gap-12 py-20 border-b border-border">
        <div>
          <p className="font-mono text-2xs tracking-widest uppercase text-gold">Competitive Reversi</p>
          <h1 className="font-serif text-5xl lg:text-7xl text-ink leading-none tracking-tight mt-3">
            Ranked<br />
            <em className="not-italic text-gold">Othello</em>,<br />
            live.
          </h1>
          <p className="text-ink-muted text-base leading-relaxed mt-6 max-w-prose">
            Challenge players online, climb the leaderboard, and review every
            move in a multiplayer arena built for serious play.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/game" className="btn-gold">Play Now</Link>
            {!user && (
              <>
                <button type="button" onClick={() => openAuthModal('register')} className="btn-outline">
                  Create Account
                </button>
                <button type="button" onClick={handleGuest} disabled={loadingGuest} className="btn-ghost">
                  {loadingGuest ? 'Starting…' : 'Play as Guest →'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Profile card */}
        <div className="border-l border-border pl-10 hidden lg:block">
          <p className="font-mono text-2xs tracking-widest uppercase text-ink-faint">Your Status</p>
          {user ? (
            <div className="mt-4">
              <p className="font-serif text-2xl text-ink">{user.username}</p>
              <p className="font-mono text-xs text-ink-muted mt-1 nums">
                {user.isGuest ? 'Guest Player' : `${user.rank} · ${user.rating} ELO`}
              </p>
              {!user.isGuest && (
                <div className="mt-6 divide-y divide-border">
                  {[
                    { label: 'Games',  value: user.gamesPlayed },
                    { label: 'Wins',   value: user.wins,   color: 'text-success' },
                    { label: 'Losses', value: user.losses, color: 'text-danger' },
                    { label: 'Draws',  value: user.draws },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="py-3 flex items-center justify-between">
                      <span className="font-mono text-2xs uppercase tracking-widest text-ink-faint">{label}</span>
                      <span className={`font-mono text-xl nums ${color ?? 'text-ink'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-ink-muted leading-relaxed max-w-[24ch]">
                Sign in to unlock rated matchmaking, persistent rankings, and full match history.
              </p>
              <button type="button" onClick={() => openAuthModal('login')} className="btn-outline mt-5">
                Sign In
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="grid lg:grid-cols-2 gap-x-16 py-16 border-b border-border">
        <div>
          <p className="font-mono text-2xs tracking-widest uppercase text-gold">What's Included</p>
          <h2 className="font-serif text-4xl text-ink leading-tight mt-2">Built for<br />serious play.</h2>
        </div>
        <div className="divide-y divide-border mt-6 lg:mt-0">
          {FEATURES.map(f => (
            <div key={f.num} className="py-5 grid grid-cols-[2rem_1fr] gap-4">
              <span className="font-mono text-2xs text-ink-faint pt-0.5">{f.num}</span>
              <div>
                <div className="text-sm font-medium text-ink">{f.title}</div>
                <div className="text-sm text-ink-muted mt-1 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Leaderboard preview ────────────────────────────────────────── */}
      <section className="py-16">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <p className="font-mono text-2xs tracking-widest uppercase text-gold">Global Rankings</p>
            <h2 className="font-serif text-4xl text-ink mt-1">Top Players</h2>
          </div>
          <Link to="/leaderboard" className="font-mono text-2xs text-ink-faint hover:text-gold uppercase tracking-wider transition-colors">
            Full Table →
          </Link>
        </div>

        {leaders.length === 0 ? (
          <p className="font-mono text-sm text-ink-faint py-8">No ranked players yet — be the first.</p>
        ) : (
          <table className="lb-table">
            <thead><tr><th>#</th><th>Player</th><th>Rank</th><th className="text-right">ELO</th></tr></thead>
            <tbody>
              {leaders.map((l, i) => (
                <tr key={l.id}>
                  <td className="font-mono text-ink-faint nums w-12">
                    {i < 3 && (
                      <span
                        className="inline-block w-0.5 h-4 mr-2 rounded-sm align-middle"
                        style={{ background: i === 0 ? '#c9a84c' : i === 1 ? '#9ca3af' : '#8b6a3e' }}
                      />
                    )}
                    {l.position}
                  </td>
                  <td className="font-medium text-ink">{l.username}</td>
                  <td
                    className="font-mono text-2xs uppercase tracking-wider"
                    style={{ color: RANK_COLORS[l.rank] ?? '#6b7280' }}
                  >
                    {l.rank}
                  </td>
                  <td className="font-mono text-gold nums text-right font-medium">{l.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-2xs text-ink-faint uppercase tracking-wider">
          Othello Arena · © {new Date().getFullYear()}
        </p>
        <div className="flex gap-5">
          {[{ to: '/privacy', label: 'Privacy' }, { to: '/terms', label: 'Terms' }].map(({ to, label }) => (
            <Link key={to} to={to} className="font-mono text-2xs text-ink-faint hover:text-ink-muted uppercase tracking-wider transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
