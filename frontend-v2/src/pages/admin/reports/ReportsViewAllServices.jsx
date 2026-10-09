import { X } from 'lucide-react';
import { formatCancellationReason } from '../../../utils/recordFormatters';

const formatCategory = (category) => {
  const value = String(category || '').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Other';
};

const categoryTone = (category) => {
  switch (String(category).toLowerCase()) {
    case 'grooming': return 'bg-brand-grooming-soft text-brand-grooming';
    case 'daycare': return 'bg-brand-daycare-soft text-brand-daycare';
    case 'hotel': return 'bg-brand-hotel-soft text-brand-hotel';
    default: return 'bg-slate-100 text-slate-600';
  }
};

export default function ReportsViewAllServices({ isOpen, onClose, services = [], pawsomeExtras = [], cancellationReasons = [], period = '' }) {
  if (!isOpen) return null;

  const packageRows = Array.isArray(services) ? services : [];
  const extraRows = (Array.isArray(pawsomeExtras) ? pawsomeExtras : []).map((extra) => ({
    service: extra.name,
    category: 'grooming',
    breakdownType: 'extras',
    total: Number(extra.count || 0),
    completed: null,
    cancelled: null,
  }));
  const rows = [...packageRows, ...extraRows];
  const totalBookings = packageRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const groups = Object.values(rows.reduce((all, service) => {
    const category = formatCategory(service.category);
    const breakdownType = service.breakdownType || 'package';
    const key = `${category}-${breakdownType}`;
    if (!all[key]) all[key] = { category, breakdownType, rows: [], total: 0 };
    all[key].rows.push(service);
    all[key].total += Number(service.total || 0);
    return all;
  }, {})).sort((a, b) => a.category.localeCompare(b.category));

  return (
    <div className="fixed inset-0 z-[320] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-brand-teal/10 bg-brand-teal px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Service Usage Breakdown</h2>
            <p className="text-sm text-white/80">{period ? `Bookings for ${period}` : 'Booked services and packages'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close service usage breakdown" className="rounded-lg p-2 text-white hover:bg-white/20"><X size={20} /></button>
        </header>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto px-5 pb-5 pt-4 sm:px-6">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-brand-teal/10 px-4 py-10 text-center text-sm text-brand-dark-soft">No service bookings for this period.</div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.category} className="overflow-hidden rounded-xl border border-brand-teal/10">
                  <div className="flex items-center justify-between gap-3 border-b border-brand-teal/10 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryTone(group.category)}`}>{group.breakdownType === 'extras' ? 'Pawsome Extras' : group.category}</span>
                      <span className="text-xs text-brand-dark-soft">{group.breakdownType === 'duration' ? 'By duration' : group.breakdownType === 'extras' ? 'Individual grooming services' : 'By package'}</span>
                    </div>
                    <span className="text-xs font-semibold text-brand-dark">{group.total} {group.breakdownType === 'extras' ? 'use' : 'booking'}{group.total === 1 ? '' : 's'}</span>
                  </div>

                  <div className="hidden md:block">
                    <div className="grid grid-cols-[minmax(200px,1fr)_100px_110px_100px_80px] gap-3 border-b border-brand-teal/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">
                      <span>{group.breakdownType === 'duration' ? 'Duration' : group.breakdownType === 'extras' ? 'Individual Service' : 'Service / Package'}</span><span className="text-right">{group.breakdownType === 'extras' ? 'Uses' : 'Bookings'}</span><span className="text-right">Completed</span><span className="text-right">Cancelled</span><span className="text-right">Share</span>
                    </div>
                    {group.rows.map((service) => {
                      const total = Number(service.total || 0);
                      const isExtra = group.breakdownType === 'extras';
                      const share = isExtra ? '—' : totalBookings ? `${Math.round((total / totalBookings) * 100)}%` : '0%';
                      return <div key={`${group.category}-${service.service}`} className="grid grid-cols-[minmax(200px,1fr)_100px_110px_100px_80px] items-center gap-3 border-b border-brand-teal/5 px-4 py-3 text-sm last:border-b-0">
                        <p className="font-semibold text-brand-dark">{service.service || 'Unknown service'}</p><p className="text-right font-semibold text-brand-dark">{total}</p><p className="text-right font-semibold text-emerald-600">{isExtra ? '—' : Number(service.completed || 0)}</p><p className="text-right font-semibold text-red-500">{isExtra ? '—' : Number(service.cancelled || 0)}</p><p className="text-right font-semibold text-brand-teal">{share}</p>
                      </div>;
                    })}
                  </div>

                  <div className="space-y-2 p-3 md:hidden">
                    {group.rows.map((service) => {
                      const total = Number(service.total || 0);
                      const isExtra = group.breakdownType === 'extras';
                      const share = isExtra ? '—' : totalBookings ? `${Math.round((total / totalBookings) * 100)}%` : '0%';
                      return <article key={`${group.category}-${service.service}`} className="rounded-lg bg-slate-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3"><p className="font-semibold text-brand-dark">{service.service || 'Unknown service'}</p><span className="shrink-0 text-xs font-semibold text-brand-teal">{share}</span></div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><span className="text-brand-dark-soft">{isExtra ? 'Uses' : 'Booked'} <b className="ml-1 text-brand-dark">{total}</b></span><span className="text-brand-dark-soft">Complete <b className="ml-1 text-emerald-600">{isExtra ? '—' : Number(service.completed || 0)}</b></span><span className="text-brand-dark-soft">Cancelled <b className="ml-1 text-red-500">{isExtra ? '—' : Number(service.cancelled || 0)}</b></span></div>
                      </article>;
                    })}
                  </div>
                </section>
              ))}
              {cancellationReasons.length > 0 && <section className="rounded-xl border border-red-100 bg-red-50/50 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-red-600">Cancellation reasons</h3><div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">{cancellationReasons.map((item) => <div key={`${item.cancellation_type}-${item.reason}`} className="flex items-center justify-between border-t border-red-100 py-2 text-xs"><span className="text-brand-dark">{String(item.cancellation_type || 'unknown').replace(/_/g, ' ')}: {formatCancellationReason(item.reason)}</span><span className="font-bold text-red-500">{item.count}</span></div>)}</div></section>}
              <p className="text-right text-[11px] italic text-brand-dark-soft">{rows.length} service package{rows.length === 1 ? '' : 's'} shown</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
