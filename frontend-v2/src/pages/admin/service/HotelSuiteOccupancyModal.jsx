import { useMemo } from 'react';
import { Minus, Plus, X } from 'lucide-react';

const HOTEL_CLUSTER_META = {
  A: { label: 'Cluster A (Cozy)', details: 'Shared by: Cozy Paw (Dog) & Cozy Whiskers (Cat)' },
  B: { label: 'Cluster B (Happy/Purr)', details: 'Shared by: Happy Paws (Dog) & Grand Purr (Cat)' },
  C: { label: 'Cluster C (Grand)', details: 'Reserved for: Grand Paw (Dog) & VIPaws (Dog Upcharge)' },
  D: { label: 'Cluster D (VIPurr)', details: 'Reserved for: VIPurr Villa (Cat)' },
};

function SpeciesBadge({ label, value, tone }) {
  const toneClass = tone === 'dog'
    ? 'border-brand-teal/25 bg-brand-teal/10 text-brand-teal-dark'
    : tone === 'cat'
      ? 'border-brand-orange/30 bg-brand-orange/10 text-brand-orange'
      : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClass}`}>
      {label}
      <span>{value}</span>
    </span>
  );
}

function SummaryMetric({ label, value, tone = 'default', showDivider = false }) {
  return (
    <div className={`min-w-0 ${showDivider ? 'border-r border-brand-teal/20 pr-4' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold leading-none ${tone === 'success' ? 'text-emerald-600' : 'text-brand-dark'}`}>{value}</p>
    </div>
  );
}

function formatOccupancyTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function HotelSuiteOccupancyModal({
  isOpen = false,
  onClose,
  live,
  loading,
  error,
  busy,
  onAdjust,
}) {
  const clusters = useMemo(
    () => (Array.isArray(live?.cluster_breakdown) ? live.cluster_breakdown : []),
    [live],
  );
  const occupants = useMemo(
    () => clusters.flatMap((cluster) => (Array.isArray(cluster?.occupants) ? cluster.occupants : [])),
    [clusters],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-sm bg-brand-dark/40"
        aria-label="Close hotel occupancy modal"
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-brand-teal px-6 py-5">
          <div>
            <h3 className="text-xl font-extrabold text-white">Hotel Occupancy</h3>
            <p className="mt-1 text-xs font-medium text-white/75">Suite availability and current booked pets by cluster.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label="Close hotel occupancy modal"
          >
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="no-scrollbar max-h-[62vh] overflow-y-auto px-6 py-4">
          {loading && <p className="text-xs text-brand-dark-soft">Loading live inventory...</p>}
          {!loading && error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {!loading && !error && (
            <div className="grid grid-cols-5 gap-4 rounded-lg bg-brand-teal/5 px-4 py-3">
              <SummaryMetric label="Total" value={live?.hotel_total ?? 0} showDivider />
              <SummaryMetric label="Available" value={live?.hotel_available ?? 0} tone="success" showDivider />
              <SummaryMetric label="Occupied" value={live?.hotel_occupied ?? 0} showDivider />
              <SummaryMetric label="Dogs" value={live?.hotel_dogs ?? live?.hotel_species_counts?.dog ?? 0} showDivider />
              <SummaryMetric label="Cats" value={live?.hotel_cats ?? live?.hotel_species_counts?.cat ?? 0} />
            </div>
          )}

          {clusters.length === 0 && !loading && !error && (
            <p className="py-5 text-center text-xs font-semibold text-brand-dark-soft">
              No cluster data yet.
            </p>
          )}

          {clusters.map((cluster) => {
            const key = String(cluster?.cluster || '').toUpperCase();
            const meta = HOTEL_CLUSTER_META[key];
            const capacity = Number(cluster?.capacity || 0);
            const speciesCounts = cluster?.species_counts || {};
            return (
              <div key={key} className="grid gap-4 border-b border-brand-teal/10 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_150px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-brand-dark">{meta?.label || `Cluster ${key}`}</p>
                    <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold text-brand-teal-dark">
                      {cluster?.available ?? 0}/{capacity} free
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-brand-dark-soft">{meta?.details || 'Hotel suites'}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SpeciesBadge label="Dog" value={speciesCounts.dog ?? 0} tone="dog" />
                    <SpeciesBadge label="Cat" value={speciesCounts.cat ?? 0} tone="cat" />
                    {(speciesCounts.unknown ?? 0) > 0 && <SpeciesBadge label="Unknown" value={speciesCounts.unknown ?? 0} />}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 md:flex-col md:items-center md:justify-start">
                  <p className="text-center text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Capacity</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAdjust(key, -1)}
                      disabled={busy || capacity <= 0}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-brand-teal/25 text-brand-dark transition-colors hover:bg-brand-teal/10 disabled:opacity-40"
                      aria-label={`Decrease Cluster ${key} capacity`}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="min-w-[28px] text-center text-sm font-extrabold text-brand-dark">{capacity}</span>
                    <button
                      type="button"
                      onClick={() => onAdjust(key, 1)}
                      disabled={busy}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-brand-teal/25 text-brand-dark transition-colors hover:bg-brand-teal/10 disabled:opacity-40"
                      aria-label={`Increase Cluster ${key} capacity`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="border-t border-brand-teal/10 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-brand-dark">Current Occupancy</h4>
                <p className="mt-0.5 text-[11px] text-brand-dark-soft">Pets with an actual active hotel check-in.</p>
              </div>
              <span className="rounded-full bg-brand-teal/10 px-2 py-1 text-[10px] font-bold text-brand-teal-dark">
                {occupants.length} pet{occupants.length === 1 ? '' : 's'}
              </span>
            </div>
            {occupants.length === 0 ? (
              <p className="rounded-lg border border-brand-teal/10 bg-brand-teal/5 px-3 py-4 text-center text-xs font-semibold text-brand-dark-soft">
                No pets are currently checked in.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-brand-teal/10">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr] gap-3 bg-brand-teal/5 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-brand-dark-soft">
                    <span>Pet</span>
                    <span>Suite / Service</span>
                    <span>Checked in</span>
                    <span>Expected out</span>
                  </div>
                  {occupants.map((occupant) => (
                    <div key={occupant.appointment_id} className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr] gap-3 border-t border-brand-teal/10 px-3 py-3 text-xs">
                      <div>
                        <p className="font-bold text-brand-dark">{occupant.pet_name || 'Unknown pet'}</p>
                        <p className="mt-0.5 text-[10px] capitalize text-brand-dark-soft">{occupant.species || 'unknown'}</p>
                      </div>
                      <span className="text-brand-dark">{occupant.suite_name || 'Hotel suite'}</span>
                      <span className="text-brand-dark">{formatOccupancyTime(occupant.checked_in_at)}</span>
                      <div className="text-brand-dark">
                        <span>{formatOccupancyTime(occupant.expected_out_at)}</span>
                        {occupant.overdue && <span className="ml-2 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Overdue</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
