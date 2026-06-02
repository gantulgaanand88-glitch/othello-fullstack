import { useEffect, useState } from 'react';

interface MoveTimerProps {
  totalMs: number;
  remainingMs: number;
  isActive: boolean;
}

export function MoveTimer({ totalMs, remainingMs, isActive }: MoveTimerProps) {
  const [currentMs, setCurrentMs] = useState(remainingMs);

  // Sync with prop changes (e.g. on new moves) and run internal countdown when active
  useEffect(() => {
    setCurrentMs(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (!isActive || currentMs <= 0) return;

    const timer = setInterval(() => {
      setCurrentMs((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(timer);
  }, [isActive, currentMs]);

  const seconds = Math.ceil(currentMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const displaySecs = seconds % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${displaySecs.toString().padStart(2, '0')}`;

  // SVG circular path setup
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = totalMs > 0 ? currentMs / totalMs : 0;
  const strokeDashoffset = circumference - progress * circumference;

  // Determine color and animations based on remaining time
  let colorClass = 'text-green-500';
  let pulseClass = '';

  if (seconds <= 10) {
    colorClass = 'text-red-500';
    pulseClass = isActive ? 'animate-pulse' : '';
  } else if (seconds <= 30) {
    colorClass = 'text-red-400';
  } else if (seconds <= 60) {
    colorClass = 'text-yellow-400';
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-gray-700 bg-gray-800/50 px-4 py-2 shadow-lg backdrop-blur transition-opacity duration-200 ${
        isActive ? 'opacity-100 ring-1 ring-green-500/30' : 'opacity-60'
      }`}
    >
      <div className="relative flex h-12 w-12 items-center justify-center">
        {/* Background Track */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            className="stroke-gray-700 fill-none"
            strokeWidth="5"
          />
          {/* Progress Circle */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            className={`fill-none transition-[stroke-dashoffset] duration-100 ease-linear ${colorClass}`}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Pulse Dot in center */}
        {isActive && (
          <span className={`absolute h-2 w-2 rounded-full bg-current ${colorClass} ${pulseClass}`} />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          {isActive ? 'Your Turn' : 'Waiting'}
        </span>
        <span className={`font-mono text-lg font-semibold tracking-tight text-white ${seconds <= 10 && isActive ? 'text-red-500 animate-pulse' : ''}`}>
          {timeString}
        </span>
      </div>
    </div>
  );
}

export default MoveTimer;
