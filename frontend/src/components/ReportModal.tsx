import { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { submitReport } from '../services/api';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUsername: string;
  gameId?: string;
}

type ReportReason = 'cheating' | 'harassment' | 'inappropriate_name' | 'stalling' | 'other';

export function ReportModal({ isOpen, onClose, reportedUserId, reportedUsername, gameId }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>('cheating');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('cheating');
      setDescription('');
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Focus trap and escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    // Basic focus trapping
    const modalEl = document.getElementById('report-modal');
    const focusable = modalEl?.querySelectorAll<HTMLElement>('button, select, textarea');
    focusable?.[0]?.focus();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await submitReport({
        reportedUserId,
        gameId,
        reason,
        description: description.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Failed to submit report. Rate limit might be exceeded.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
    >
      <div
        id="report-modal"
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl animate-fade-in-up text-left"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-red-400">Safety</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Report {reportedUsername}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-white focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="mt-6 flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-white">Report Submitted Successfully</p>
            <p className="mt-1 text-xs text-gray-400">Our moderators will review this shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-gray-300">Reason</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
              >
                <option value="cheating">Cheating / Engine Use</option>
                <option value="harassment">Harassment / Abusive Chat</option>
                <option value="inappropriate_name">Inappropriate Username</option>
                <option value="stalling">Intentional Stalling</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-gray-300">Description (Optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full h-24 rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none resize-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                maxLength={500}
              />
              <span className="text-right block text-[10px] text-gray-500 mt-1">
                {description.length}/500 chars
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-gray-600 bg-transparent py-3 text-xs font-semibold text-gray-300 transition hover:bg-gray-700 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-full bg-red-600 py-3 text-xs font-semibold text-white transition hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 disabled:opacity-60"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ReportModal;
