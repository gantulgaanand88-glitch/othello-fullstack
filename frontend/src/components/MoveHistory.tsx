import { useEffect, useRef } from 'react';
import type { MoveRecord } from '../types';

interface MoveHistoryProps {
  moves: MoveRecord[];
}

function toNotation(row: number, col: number): string {
  return `${String.fromCharCode(97 + col)}${row + 1}`;
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest move
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  return (
    <div className="rounded-3xl border border-gray-700 bg-gray-800/90 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Moves</h3>
        <span className="rounded-full bg-gray-700/60 px-3 py-0.5 text-xs tabular-nums text-gray-400">
          {moves.length}
        </span>
      </div>

      <div ref={scrollRef} className="max-h-80 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
        {moves.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">Moves will appear here once the match begins.</p>
        ) : null}

        {moves.map((move, index) => (
          <div
            key={`${move.timestamp}-${index}`}
            className="flex items-center justify-between rounded-xl bg-gray-900/50 px-3 py-2 text-sm transition-colors hover:bg-gray-900/70"
          >
            <span className="flex items-center gap-2">
              <span className="w-6 text-right tabular-nums text-gray-600">{index + 1}.</span>
              <span
                className={[
                  'inline-block h-3 w-3 rounded-full',
                  move.player === 'black'
                    ? 'bg-gradient-to-br from-zinc-600 to-zinc-950'
                    : 'bg-gradient-to-br from-white to-gray-300',
                ].join(' ')}
              />
              <span className="font-mono text-gray-200">{toNotation(move.row, move.col)}</span>
            </span>
            <span className="text-xs text-gray-500">+{move.flipped.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MoveHistory;
