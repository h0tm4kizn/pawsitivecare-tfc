import { AdminStatSkeleton } from '../../../../components/admin/AdminLoading';
import { X } from 'lucide-react';
import { useState } from 'react';

function MiniStat({ label = '', value, subtitle = '', note = '', tone = 'default', forceSingleLine = false, onClick = null, compact = false }) {
  const detail = subtitle || note;
  const toneClass =
    tone === 'total'
      ? 'border-brand-teal/25 bg-brand-teal/5'
    : tone === 'success'
        ? 'border-brand-teal/20 bg-brand-teal/10'
      : tone === 'dog'
        ? 'border-brand-teal/20 bg-brand-teal/10'
      : tone === 'cat'
        ? 'border-brand-orange/20 bg-brand-orange-light/45'
      : tone === 'danger'
        ? 'border-red-200 bg-red-50/75'
      : tone === 'red'
        ? 'border-red-200 bg-red-50/75'
      : tone === 'emerald'
        ? 'border-brand-teal/20 bg-brand-teal/10'
      : tone === 'sky'
        ? 'border-brand-teal/20 bg-brand-teal/5'
      : tone === 'brand'
        ? 'border-brand-teal/20 bg-brand-teal/5'
        : 'border-brand-dark-light bg-white';
  const valueClass =
    tone === 'danger' || tone === 'red'
      ? 'text-red-600'
      : tone === 'cat'
        ? 'text-brand-orange-dark'
        : tone === 'default'
          ? 'text-brand-dark'
          : 'text-brand-teal-dark';
  const subtitleClass =
    tone === 'success'
      ? 'text-brand-teal-dark/75'
      : tone === 'danger' || tone === 'red'
        ? 'text-red-600/75'
      : tone === 'total'
        ? 'text-brand-teal-dark/75'
        : 'text-brand-dark-soft';

  return (
    <button
      type="button"
      onClick={onClick || undefined}
      className={`${compact ? 'min-h-[96px] px-3 py-3' : 'min-h-[112px] px-3.5 py-3.5'} w-full rounded-xl border text-left transition ${toneClass} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(23,53,81,0.10)]' : ''}`}
    >
      {label ? (
        <p className={`font-bold uppercase text-brand-dark-soft ${forceSingleLine ? 'whitespace-nowrap text-[9px] leading-none tracking-normal' : 'text-[10px] leading-relaxed tracking-wider'}`}>
          {label}
        </p>
      ) : null}
      <p className={`${label ? (compact ? 'mt-1' : 'mt-1.5') : 'mt-0'} ${compact ? 'text-[42px]' : 'text-3xl'} font-extrabold leading-none ${valueClass}`}>{value}</p>
      {detail ? <p className={`${compact ? 'mt-1.5' : 'mt-2'} text-[10px] font-semibold ${subtitleClass}`}>{detail}</p> : null}
    </button>
  );
}

function BreakdownModal({ isOpen, title, subtitle, tiles, insight, customContent, onClose }) {
  if (!isOpen) return null;
  const tileCount = (tiles || []).length;
  const tileGridClass = tileCount === 2
    ? 'sm:grid-cols-2'
    : tileCount === 3
      ? 'sm:grid-cols-3'
      : 'sm:grid-cols-4';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className={`w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${customContent ? 'max-w-4xl' : 'max-w-2xl'}`} onClick={(e) => e.stopPropagation()}>
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
          {customContent ? customContent : (
            <>
              <div className={`grid grid-cols-1 gap-3 ${tileGridClass}`}>
                {(tiles || []).map((tile, idx) => (
                  <MiniStat key={`${tile.label}-${idx}`} {...tile} compact />
                ))}
              </div>
              {insight && (
                <div className="rounded-lg border border-brand-teal/20 bg-white px-4 py-3">
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

export default function CustomerStatBox({ loading = false, title, value, note, modalTitle, modalSubtitle, tiles, insight, customContent }) {
  const [open, setOpen] = useState(false);

  if (loading) return <AdminStatSkeleton />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group min-h-[112px] w-full rounded-xl border border-brand-teal/25 bg-white px-4 py-3 text-left font-poppins shadow-[0_6px_12px_rgba(23,53,81,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(23,53,81,0.14)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
      >
        <h2 className="text-xs font-semibold text-brand-dark">{title}</h2>
        <p className="mt-3 text-3xl font-extrabold leading-none text-brand-teal">{value}</p>
        <p className="mt-3 text-xs font-medium text-brand-teal-dark/90">{note}</p>
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
