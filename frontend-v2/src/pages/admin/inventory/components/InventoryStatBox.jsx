import { X } from 'lucide-react';
import { useState } from 'react';

function AnalyticsTile({ label, value, note, tone = 'brand' }) {
  const toneClass = {
    brand:   'border-brand-dark-light bg-white text-brand-dark',
    emerald: 'border-emerald-200 bg-emerald-50/70 text-brand-dark',
    sky:     'border-sky-200 bg-sky-50/70 text-brand-dark',
    amber:   'border-amber-200 bg-amber-50/70 text-brand-dark',
    red:     'border-red-200 bg-red-50/75 text-brand-dark',
  }[tone] || 'border-brand-dark-light bg-white text-brand-dark';

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft">{label}</p>
      <p className="mt-1 text-4xl font-extrabold leading-none text-brand-dark">{value}</p>
      {note && <p className="mt-2 text-xs font-semibold text-brand-dark-soft">{note}</p>}
    </div>
  );
}

function BreakdownModal({ isOpen, title, subtitle, tiles, insight, customContent, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${customContent ? 'max-w-3xl' : 'max-w-2xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-5 py-3.5">
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

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {customContent ? customContent : (
            <>
              <div className={`grid grid-cols-1 gap-3 ${(tiles || []).length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                {(tiles || []).map((tile, idx) => (
                  <AnalyticsTile key={`${tile.label}-${idx}`} {...tile} />
                ))}
              </div>
              {insight && (
                <div className="rounded-xl border border-brand-teal/20 bg-brand-teal-light/20 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Insight</p>
                  <p className="mt-1 text-sm text-brand-dark">{insight}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InventoryStatBox({ title, value, note, modalTitle, modalSubtitle, tiles, insight, customContent }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group min-h-[112px] w-full rounded-xl border border-brand-teal/25 bg-white px-4 py-3 text-left shadow-[0_6px_12px_rgba(23,53,81,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(23,53,81,0.14)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
      >
        <h2 className="text-xs font-extrabold text-brand-dark">{title}</h2>
        <p className="mt-3 text-3xl font-extrabold leading-none text-brand-teal">{value}</p>
        {note && <p className="mt-3 text-xs font-medium text-brand-teal-dark/90">{note}</p>}
      </button>

      <BreakdownModal
        isOpen={open}
        title={modalTitle || title}
        subtitle={modalSubtitle}
        tiles={tiles}
        insight={insight}
        customContent={customContent}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
