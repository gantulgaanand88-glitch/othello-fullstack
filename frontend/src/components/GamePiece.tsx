/**
 * GamePiece — an SVG Othello piece with 3D sphere appearance and flip animation.
 * Rendered as an SVG <g> element for embedding inside the SvgBoard SVG.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Player } from '../lib/gameEngine';

interface GamePieceProps {
  cx:            number;
  cy:            number;
  r:             number;       // radius
  color:         Player;
  isFlipped:     boolean;
  flipDelay:     number;       // ms — wave stagger
  isLastPlaced:  boolean;
  uid:           string;       // unique for SVG gradient IDs
}

export const GamePiece = React.memo(function GamePiece({
  cx, cy, r,
  color,
  isFlipped,
  flipDelay,
  isLastPlaced,
  uid,
}: GamePieceProps) {
  const [displayColor, setDisplayColor] = useState<Player>(color);
  const [phase, setPhase]               = useState<'idle' | 'flip-out' | 'flip-in' | 'placed'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timers on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Place animation on mount
  useEffect(() => {
    if (isLastPlaced) setPhase('placed');
    const t = setTimeout(() => setPhase('idle'), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flip animation
  useEffect(() => {
    if (!isFlipped) return;

    timerRef.current = setTimeout(() => {
      setPhase('flip-out');

      // Midpoint — swap color
      const mid = setTimeout(() => {
        setDisplayColor(color);
        setPhase('flip-in');

        const end = setTimeout(() => setPhase('idle'), 280);
        timerRef.current = end;
      }, 275);

      timerRef.current = mid;
    }, flipDelay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped, flipDelay]);

  // Update display color immediately when not animating
  useEffect(() => {
    if (phase === 'idle') setDisplayColor(color);
  }, [color, phase]);

  // ── Transform based on phase ────────────────────────────────────────
  const scaleX = phase === 'flip-out' ? 0 : phase === 'flip-in' ? 1 : 1;
  const scaleY = phase === 'placed'   ? 1 : 1;
  const scale  = phase === 'placed'   ? 1.08 : 1;

  const isDark     = displayColor === 'black';
  const gradId     = `${uid}-grad`;
  const glintId    = `${uid}-glint`;

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      style={{
        transform: `translate(${cx}px, ${cy}px) scaleX(${scaleX}) scale(${scale})`,
        transformOrigin: `${cx}px ${cy}px`,
        transition:
          phase === 'flip-out' ? 'transform 275ms cubic-bezier(0.4,0,1,1)' :
          phase === 'flip-in'  ? 'transform 275ms cubic-bezier(0,0,0.6,1)' :
          phase === 'placed'   ? 'transform 250ms cubic-bezier(0.34,1.56,0.64,1)' :
          'none',
      }}
    >
      <defs>
        {/* Sphere gradient */}
        <radialGradient id={gradId} cx="35%" cy="28%" r="65%" gradientUnits="objectBoundingBox">
          {isDark ? (
            <>
              <stop offset="0%"   stopColor="#303030" />
              <stop offset="60%"  stopColor="#111111" />
              <stop offset="100%" stopColor="#090909" />
            </>
          ) : (
            <>
              <stop offset="0%"   stopColor="#f7f3ec" />
              <stop offset="60%"  stopColor="#ddd5c5" />
              <stop offset="100%" stopColor="#c4baa9" />
            </>
          )}
        </radialGradient>

        {/* Specular glint */}
        <radialGradient id={glintId} cx="28%" cy="22%" r="40%" gradientUnits="objectBoundingBox">
          <stop offset="0%"  stopColor="white" stopOpacity={isDark ? 0.07 : 0.65} />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Drop shadow circle */}
      <ellipse
        cx="0" cy={r * 0.18}
        rx={r * 0.9} ry={r * 0.2}
        fill="rgba(0,0,0,0.55)"
        style={{ filter: 'blur(3px)' }}
      />

      {/* Main sphere */}
      <circle
        cx="0" cy="0"
        r={r}
        fill={`url(#${gradId})`}
      />

      {/* Specular highlight */}
      <circle
        cx="0" cy="0"
        r={r}
        fill={`url(#${glintId})`}
      />

      {/* Rim light (subtle) */}
      <circle
        cx="0" cy="0"
        r={r}
        fill="none"
        stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.35)'}
        strokeWidth="0.8"
      />
    </g>
  );
});

export default GamePiece;
