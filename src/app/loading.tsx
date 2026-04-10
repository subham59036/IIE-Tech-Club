/**
 * app/loading.tsx
 * Shown by Next.js while a page segment is loading (Suspense boundary).
 */

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="spinner w-8 h-8" style={{ borderWidth: 2 }} />
        <p className="text-slate-500 text-xs">Loading…</p>
      </div>
    </div>
  );
}
