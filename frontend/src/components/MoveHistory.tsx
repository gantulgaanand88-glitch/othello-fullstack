import type { MoveRecord } from '../types';

interface MoveHistoryProps {
  moves: MoveRecord[];
}

function toNotation(row: number, col: number): string {
  return `${String.fromCharCode(97 + col)}${row + 1}`;
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  return (
    <div className="rounded-3xl border border-gray-700 bg-gray-800/90 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Move History</h3>
        <span className="text-sm text-gray-400">{moves.length} moves</span>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {moves.length === 0 ? (
          <p className="text-sm text-gray-400">Moves will appear here once the match begins.</p>
        ) : null}

        {moves.map((move, index) => (
          <div
            key={`${move.timestamp}-${index}`}
            className="flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-300"
          >
            <span>
              {index + 1}. {move.player} → {toNotation(move.row, move.col)}
            </span>
            <span className="text-gray-500">+{move.flipped.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MoveHistory;
