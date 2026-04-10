/**
 * app/student/loading.tsx
 * Shown while the student dashboard chunk is loading.
 */

export default function StudentLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="spinner w-7 h-7" style={{ borderWidth: 2 }} />
        <p className="text-slate-500 text-xs">Loading dashboard…</p>
      </div>
    </div>
  );
}
