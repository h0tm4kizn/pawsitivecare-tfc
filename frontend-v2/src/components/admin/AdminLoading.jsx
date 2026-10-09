export function SkeletonBlock({ className = '' }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-md bg-brand-teal/10 ${className}`} />;
}

export function AdminSkeleton({ variant = 'table', label = 'Loading records', rows = 5 }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 rounded-xl bg-white p-4">
      <span className="sr-only">{label}</span>
      {variant === 'calendar' ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => <SkeletonBlock key={i} className="h-16 sm:h-24" />)}
        </div>
      ) : variant === 'cards' ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} className="h-24" />)}
        </div>
      ) : (
        Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-brand-teal/10 py-3">
            <SkeletonBlock className="h-9 w-9 shrink-0" />
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="ml-auto h-4 w-1/4" />
          </div>
        ))
      )}
    </div>
  );
}

export function AdminLoadState({ loading, error, onRetry }) {
  // Keep the current page usable while a refresh is in flight. A transient
  // timeout should never replace details the admin is already viewing.
  if (loading) return <p role="status" className="px-4 py-2 text-xs font-semibold text-brand-teal">Updating…</p>;
  if (String(error || '').toLowerCase().includes('taking too long')) return null;
  if (!error) return null;
  return (
    <div role="alert" className="my-2 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{error}</span>
      {onRetry && <button type="button" onClick={onRetry} className="rounded border border-red-300 px-3 py-1 font-semibold">Retry</button>}
    </div>
  );
}

export function AdminStatSkeleton() {
  return <div role="status" aria-label="Loading statistic" className="min-h-[112px] rounded-xl border border-brand-teal/25 bg-white p-4">
    <SkeletonBlock className="h-3 w-2/3" />
    <SkeletonBlock className="mt-3 h-7 w-12" />
    <SkeletonBlock className="mt-3 h-3 w-3/4" />
  </div>;
}
