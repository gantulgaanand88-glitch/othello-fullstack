import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-sm uppercase tracking-[0.35em] text-green-400">Error</p>
      <h1 className="mt-4 text-8xl font-extrabold tracking-tight text-white sm:text-9xl">404</h1>
      <p className="mt-4 text-xl text-gray-300">Page not found</p>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        Go Home
      </Link>
    </div>
  );
}

export default NotFoundPage;
