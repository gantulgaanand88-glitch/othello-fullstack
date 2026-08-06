import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const COOKIE_CONSENT_KEY = 'othello-cookie-consent';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const hasConsented = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!hasConsented) {
      // Small delay for clean entrance animation
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 animate-slide-up">
      <div className="mx-auto max-w-4xl rounded-2xl sm:rounded-3xl border border-gray-800 bg-gray-900/95 p-4 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-2 0c0 .993-.24 1.93-.66 2.76A4.482 4.482 0 0012 11h-1a1 1 0 00-1 1v2a1 1 0 001 1h.3c-.88.63-1.95 1-3.12 1-2.9 0-5.32-2.07-5.87-4.83A4.5 4.5 0 017.5 7.5c1.47 0 2.73-.85 3.34-2.1A4.49 4.49 0 0013.5 7c.83 0 1.58-.23 2.22-.63.18.51.28 1.05.28 1.63z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">We value your privacy</p>
            <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">
              We use only essential local storage cookies for account authentication to provide a secure gaming experience. No tracking or third-party cookies are used. Learn more in our{' '}
              <Link to="/privacy" className="text-green-400 underline hover:text-green-300">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex w-full sm:w-auto shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="w-full sm:w-auto rounded-full bg-green-600 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 active:scale-95"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
