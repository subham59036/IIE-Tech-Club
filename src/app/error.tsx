/**
 * app/error.tsx
 * Client-side error boundary for unexpected runtime errors.
 * Must be a Client Component (Next.js requirement).
 */

"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development; swap for a real error tracker in production
    // ► CHANGE: replace console.error with your error monitoring service (e.g. Sentry)
    console.error("[TechOS Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-white text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">
        An unexpected error occurred. Please try again. If the problem persists, contact your administrator.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
