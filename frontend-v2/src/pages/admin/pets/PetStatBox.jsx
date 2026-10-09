import { AdminStatSkeleton } from '../../../components/admin/AdminLoading';
import { X } from 'lucide-react';
import { useState } from 'react';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

function AnalyticsTile({ label, value, note, tone = 'brand' }) {
  const toneClass = {
    brand:   { panel: 'border-brand-teal/20 bg-brand-teal/5', value: 'text-brand-teal-dark' },
    neutral: { panel: 'border-brand-dark-light bg-white', value: 'text-brand-dark' },
    dog:     { panel: 'border-brand-teal/20 bg-brand-teal/10', value: 'text-brand-teal-dark' },
    cat:     { panel: 'border-brand-orange/20 bg-brand-orange-light/45', value: 'text-brand-orange-dark' },
    red:     { panel: 'border-red-200 bg-red-50/75', value: 'text-red-600' },
    emerald: { panel: 'border-brand-teal/20 bg-brand-teal/10', value: 'text-brand-teal-dark' },
    amber:   { panel: 'border-brand-orange/20 bg-brand-orange-light/45', value: 'text-brand-orange-dark' },
    sky:     { panel: 'border-brand-teal/20 bg-brand-teal/5', value: 'text-brand-teal-dark' },
  }[tone] || { panel: 'border-brand-dark-light bg-white', value: 'text-brand-dark' };

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass.panel}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft">{label}</p>
          {note && <p className="mt-1 text-xs font-semibold text-brand-dark-soft">{note}</p>}
        </div>
        <p className={`shrink-0 text-3xl font-extrabold leading-none ${toneClass.value}`}>{value}</p>
      </div>
    </div>
  );
}

function BreakdownModal({ isOpen, title, subtitle, tiles, insight, onClose }) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-white">{title}</h2>
            {subtitle && <p className="text-[11px] font-semibold text-white/70">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="space-y-4 bg-brand-surface p-5">
          <div className={`grid grid-cols-1 gap-3 ${(tiles || []).length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            {(tiles || []).map((tile, idx) => (
              <AnalyticsTile key={`${tile.label}-${idx}`} {...tile} />
            ))}
          </div>
          {insight && (
            <div className="rounded-lg border border-brand-teal/20 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Insight</p>
              <p className="mt-1 text-sm text-brand-dark">{insight}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PetStatBox({ loading = false, title, value, note, modalTitle, modalSubtitle, tiles, insight }) {
  const [open, setOpen] = useState(false);

  if (loading) return <AdminStatSkeleton />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group min-h-[112px] w-full rounded-xl border border-brand-teal/25 bg-white px-4 py-3 text-left shadow-[0_6px_12px_rgba(23,53,81,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(23,53,81,0.14)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
      >
        <h2 className="text-xs font-semibold text-brand-dark">{title}</h2>
        <p className="mt-3 text-3xl font-extrabold leading-none text-brand-teal">{value}</p>
        <p className="mt-3 text-xs font-medium text-brand-teal-dark/90">{note}</p>
      </button>

      <BreakdownModal
        isOpen={open}
        title={modalTitle || title}
        subtitle={modalSubtitle}
        tiles={tiles || []}
        insight={insight}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
