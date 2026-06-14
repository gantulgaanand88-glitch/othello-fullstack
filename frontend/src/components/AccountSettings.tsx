import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import {
  exportUserData,
  deleteUserAccount,
  recordConsent,
  fetchConsentStatus,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export function AccountSettings() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [consent, setConsent] = useState({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    async function loadConsent() {
      try {
        const status = await fetchConsentStatus();
        setConsent({
          analytics: status.analytics?.granted ?? false,
          marketing: status.marketing?.granted ?? false,
        });
      } catch (err) {
        console.error('Failed to load consent preferences:', err);
      }
    }
    loadConsent();
  }, []);

  const handleExportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await exportUserData();
      // Generate JSON download
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', 'othello_arena_my_data.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      setError('Failed to export data.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleConsent = async (type: 'analytics' | 'marketing') => {
    const nextVal = !consent[type];
    // Optimistic update
    setConsent((prev) => ({ ...prev, [type]: nextVal }));

    try {
      await recordConsent({
        consentType: type,
        granted: nextVal,
        policyVersion: '1.0',
      });
    } catch (err) {
      // Revert on failure
      setConsent((prev) => ({ ...prev, [type]: !nextVal }));
      console.error(`Failed to update consent for ${type}:`, err);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteUserAccount();
      logout();
      navigate('/');
    } catch (err) {
      setError('Failed to delete account.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-white">Privacy & Account Settings</h2>
        <p className="text-xs text-gray-400 mt-1">
          Manage your GDPR data privacy rights and account parameters.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Consent Section */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Cookie & Privacy Consents</h3>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-white">Essential Local Storage</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Used to persist secure session tokens. Mandatory for registered gameplay.
            </p>
          </div>
          <span className="text-[10px] uppercase font-bold text-green-400 select-none bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
            Always Active
          </span>
        </div>

        <div className="h-px bg-gray-800" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-white">Analytics Consent</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Allows us to collect anonymized usage details to make platform improvements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleConsent('analytics')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              consent.analytics ? 'bg-green-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                consent.analytics ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="h-px bg-gray-800" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-white">Marketing Consent</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Enables platform newsletter announcements (unimplemented, placeholder).
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleConsent('marketing')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              consent.marketing ? 'bg-green-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                consent.marketing ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="rounded-2xl border border-red-500/25 bg-red-950/10 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-white">Export My Personal Data</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Download your profile details and full game records as a standard JSON file.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={handleExportData}
            className="rounded-full bg-gray-700 hover:bg-gray-650 px-5 py-2.5 text-xs font-semibold text-white transition disabled:opacity-60 active:scale-95 whitespace-nowrap"
          >
            Download Data (JSON)
          </button>
        </div>

        <div className="h-px bg-red-950/40" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-white">Delete My Account</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Permanently delete your profile. Your game statistics will be anonymized.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full bg-red-600 hover:bg-red-500 px-5 py-2.5 text-xs font-semibold text-white transition active:scale-95 whitespace-nowrap"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-2xl animate-fade-in-up"
          >
            <h3 className="text-lg font-bold text-white">Are you absolutely sure?</h3>
            <p className="mt-3 text-xs text-gray-400 leading-relaxed">
              This action cannot be undone. You will lose your rank, ELO ratings, wins, and all account data. Your past games will remain but will be listed under &quot;Deleted User&quot; to keep historical records valid.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-full border border-gray-600 bg-transparent py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-gray-750 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDeleteAccount}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-xs font-semibold text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-60"
              >
                {loading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountSettings;
