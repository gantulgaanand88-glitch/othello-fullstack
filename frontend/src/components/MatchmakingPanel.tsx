import { useEffect, useState } from 'react';

interface MatchmakingPanelProps {
  queueStartTime: number;
  onCancel: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function MatchmakingPanel({ queueStartTime, onCancel }: MatchmakingPanelProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((now - queueStartTime) / 1000));
  const isExpanded = elapsedSeconds >= 10;

  return (
    <div className="rounded-3xl border border-gray-700 bg-gray-800/90 p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-green-400">Matchmaking</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Searching for an opponent</h3>
        </div>
        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-lg font-semibold text-green-300">
          {formatSeconds(elapsedSeconds)}
        </span>
      </div>

      <p className="mt-4 text-sm text-gray-300">
        Matching by rating with a precise range first, then widening to speed up game start.
      </p>

      {isExpanded ? <p className="mt-3 text-sm text-yellow-300">Expanding range...</p> : null}

      <button
        type="button"
        onClick={onCancel}
        className="mt-6 inline-flex items-center justify-center rounded-full border border-gray-600 px-5 py-3 text-sm font-medium text-gray-200 transition hover:border-red-400 hover:text-red-300"
      >
        Cancel Search
      </button>
    </div>
  );
}

export default MatchmakingPanel;
