/**
 * app/not-found.tsx
 * Custom 404 page shown when a route does not exist.
 */

import Link  from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="relative w-12 h-12 mb-6">
        <Image src="/logo.png" alt="TechOS" fill className="object-contain opacity-50" />
      </div>
      <h1 className="text-6xl font-bold text-indigo-500 mb-3">404</h1>
      <p className="text-white text-lg font-medium mb-2">Page Not Found</p>
      <p className="text-slate-500 text-sm mb-8 max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
      >
        ← Back to Login
      </Link>
    </div>
  );
}
