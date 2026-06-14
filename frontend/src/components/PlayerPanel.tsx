/**
 * PlayerPanel — displays one player's info above or below the board.
 * Adapts: top panel = opponent, bottom panel = you.
 */
import React from 'react';
import type { Player } from '../lib/gameEngine';

interface PlayerPanelProps {
  username:    string;
  rating:      number;
  rank:        string;
  score:       number;
  color:       Player;
  isActive:    boolean;   // is it this player's turn?
  isTop:       boolean;   // top = opponent, bottom = you
  timeMs:      number;    // remaining time in milliseconds
  isGuest?:    boolean;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getRankTier(rank: string): { label: string; color: string } {
  const tiers: Record<string, string> = {
    Beginner:     '#6b7280',
    Intermediate: '#4c7fc9',
    Advanced:     '#9b6bbf',
    Expert:       '#c87c3e',
    Master:       '#c9a84c',
  };
  return { label: rank, color: tiers[rank] ?? '#6b7280' };
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export const PlayerPanel = React.memo(function PlayerPanel({
  username, rating, rank, score, color, isActive, isTop, timeMs, isGuest,
}: PlayerPanelProps) {
  const isUrgent  = timeMs < 30_000 && timeMs > 0;
  const tier      = getRankTier(rank);

  const avatarBg  = color === 'black'
    ? 'bg-elevated border border-border-strong text-ink-muted'
    : 'bg-ink-faint border border-border-strong text-ink';

  const turnBarClass = isActive
    ? color === 'black'
      ? 'bg-ink'
      : 'bg-piece-light-hi'
    : 'bg-border';

  return (
    <div
      className={[
        'flex items-center gap-4 px-5 py-3 panel transition-all duration-300',
        isActive ? 'animate-pulse-gold' : '',
      ].join(' ')}
      style={{ boxShadow: isActive ? '0 0 0 1px rgba(201,168,76,0.2)' : undefined }}
    >
      {/* Turn indicator bar — left edge */}
      <div
        className={`w-0.5 self-stretch rounded-full transition-all duration-500 ${turnBarClass}`}
        style={{ minHeight: 36 }}
      />

      {/* Avatar */}
      <div className={`player-avatar text-sm ${avatarBg}`}>
        {getInitials(username)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink truncate">{username}</span>
          {isGuest && <span className="badge-muted">Guest</span>}
          {!isGuest && (
            <span
              className="badge"
              style={{
                background: `${tier.color}18`,
                color: tier.color,
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.6rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '1px 6px',
                borderRadius: '2px',
              }}
            >
              {tier.label}
            </span>
          )}
        </div>
        {!isGuest && (
          <div className="text-ink-faint font-mono text-2xs mt-0.5 nums">
            {rating} ELO
          </div>
        )}
      </div>

      {/* Score */}
      <div className="flex flex-col items-center">
        <span className="score-count text-ink nums">{score}</span>
        <span className="text-ink-faint font-mono text-2xs uppercase tracking-wider mt-0.5">
          {color === 'black' ? '●' : '○'}
        </span>
      </div>

      {/* Timer */}
      <div className="flex flex-col items-end">
        <span
          className={[
            'timer',
            isUrgent  ? 'urgent'   : '',
            !isActive ? 'inactive' : '',
          ].join(' ')}
          style={{ fontSize: '1.5rem' }}
        >
          {formatTime(timeMs)}
        </span>
        {isActive && (
          <span className="text-2xs font-mono text-gold uppercase tracking-widest">
            to move
          </span>
        )}
      </div>
    </div>
  );
});

export default PlayerPanel;
