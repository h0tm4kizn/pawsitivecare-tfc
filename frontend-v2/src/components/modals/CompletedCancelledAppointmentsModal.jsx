import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCancellationReason } from '../../utils/recordFormatters';

const titleByType = {
  total: 'This Month Appointments',
  pending: 'Pending Bookings',
  in_progress: 'In Progress Appointments',
  approved: 'Approved Appointments',
  completed: 'Completed Appointments',
  cancelled: 'Cancelled Appointments',
};

const emptyByType = {
  total: 'No appointments found this month.',
  pending: 'No pending bookings found.',
  in_progress: 'No in progress appointments found.',
  approved: 'No approved appointments found.',
  completed: 'No completed appointments found.',
  cancelled: 'No cancelled appointments found.',
};

const getCancellationReason = (item) =>
  formatCancellationReason(
    item?._raw?.cancellation_reason ||
    item?._raw?.cancel_reason ||
    item?._raw?.reason ||
    '-',
  );

const getCancellationType = (item) => {
  const raw = item?._raw || {};
  const type = String(raw?.cancellation_type || '').toLowerCase();
  if (type === 'late' || String(raw?.cancellation_reason || '').startsWith('[LATE CANCELLATION]')) return 'Late';
  if (type === 'normal') return 'Normal';
  return null;
};

const normalizeStatus = (value) => String(value || '').toLowerCase().replace(/-/g, '_');

const statusBadgeMeta = (value) => {
  const status = normalizeStatus(value);
  if (status === 'completed') return { label: 'Completed', cls: 'text-emerald-700' };
  if (status === 'cancelled') return { label: 'Cancelled', cls: 'text-red-600' };
  if (status === 'no_show') return { label: 'Cancelled', cls: 'text-red-600' };
  if (status === 'in_progress' || status === 'checkin' || status === 'checked_in') {
    return { label: 'In Progress', cls: 'text-amber-700' };
  }
  if (status === 'approved') return { label: 'Approved', cls: 'text-blue-700' };
  if (status === 'pending') return { label: 'Pending', cls: 'text-slate-700' };
  return { label: 'Unknown', cls: 'text-gray-600' };
};

export default function CompletedCancelledAppointmentsModal({
  isOpen,
  type = 'completed',
  appointments = [],
  onClose,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const key = search.trim().toLowerCase();
    if (!key) return appointments;
    return appointments.filter((item) => {
      const bag = [
        item?.owner,
        item?.pet,
        item?.service,
        item?.date,
        item?.time,
        item?.displayId,
        getCancellationReason(item),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return bag.includes(key);
    });
  }, [appointments, search]);

  if (!isOpen) return null;

  const isCancelled = type === 'cancelled';

  return createPortal(
    <div
      className="fixed inset-0 z-[82] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
          <h3 className="text-base font-extrabold text-white">
            {titleByType[type] || titleByType.completed}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Close appointment list modal"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4 sm:p-5">
          <label className="flex items-center gap-2 rounded-xl border border-brand-teal/30 bg-white px-3 py-2">
            <Search size={14} className="text-brand-dark-soft" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search owner, pet, service..."
              className="w-full bg-transparent text-sm font-medium text-brand-dark placeholder:text-brand-dark-soft focus:outline-none"
            />
          </label>

          <div className="min-h-0 overflow-hidden rounded-xl border border-brand-teal/20">
            <div className={`hidden gap-2 border-b border-brand-teal/20 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft sm:grid ${
              isCancelled ? 'grid-cols-[1.05fr_0.85fr_1fr_0.85fr_0.8fr_1.35fr]' : 'grid-cols-[1fr_0.8fr_1fr_0.85fr_0.8fr_0.8fr]'
            }`}>
              <span>Owner</span>
              <span>Pet</span>
              <span>Service</span>
              <span>Date</span>
              <span>Status</span>
              {isCancelled ? <span>Reason</span> : <span>Total</span>}
            </div>

            <div className="max-h-[62dvh] overflow-y-auto sm:max-h-[52vh]">
              {filtered.length === 0 && (
                <p className="px-4 py-7 text-center text-sm font-semibold text-brand-dark-soft">
                  {emptyByType[type] || emptyByType.completed}
                </p>
              )}

              {filtered.map((item) => {
                const raw = item?._raw || {};
                const badge = statusBadgeMeta(raw?.status || item?.status);
                const addons = Array.isArray(raw?.appointmentAddons) ? raw.appointmentAddons : [];
                const basePrice = Number(raw?.total_price || 0);
                const addonsTotal = addons.reduce((s, a) => s + Number(a.price_charged || 0), 0);
                const grandTotal = basePrice + addonsTotal;

                return (
                  <div key={item.id} className="border-b border-brand-teal/15 last:border-b-0">
                    <div className="px-3 py-3 sm:hidden">
                      <div className="rounded-xl border border-brand-teal/15 bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-brand-dark">{item.pet || '-'}</p>
                            <p className="mt-0.5 truncate text-[11px] font-semibold text-brand-dark-soft">{item.owner || '-'}</p>
                          </div>
                          <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-extrabold text-brand-teal-dark">{item.service || '-'}</p>
                            <p className="mt-1 truncate text-[10px] font-semibold text-brand-dark-soft">
                              {item.date || '-'}{item.time ? ` - ${item.time}` : ''}
                            </p>
                            <p className="mt-1 truncate text-[10px] font-medium text-brand-dark-soft">{item.displayId || item.id}</p>
                          </div>
                          {isCancelled ? (
                            <div className="min-w-0 text-right">
                              {getCancellationType(item) && (
                                <p className="mb-1 inline-flex rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
                                  {getCancellationType(item)}
                                </p>
                              )}
                              <p className="max-w-[120px] truncate text-[10px] font-semibold text-red-600">{getCancellationReason(item)}</p>
                            </div>
                          ) : (
                            <p className="truncate text-xs font-bold text-emerald-700">
                              {grandTotal > 0 ? `PHP ${grandTotal.toFixed(2)}` : '-'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`hidden gap-2 px-4 py-3 text-xs text-brand-dark sm:grid ${
                      isCancelled ? 'grid-cols-[1.05fr_0.85fr_1fr_0.85fr_0.8fr_1.35fr]' : 'grid-cols-[1fr_0.8fr_1fr_0.85fr_0.8fr_0.8fr]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.owner || '-'}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <p className="truncate text-[10px] font-medium text-brand-dark-soft">{item.displayId || item.id}</p>
                        </div>
                      </div>
                      <p className="truncate font-semibold">{item.pet || '-'}</p>
                      <p className="truncate text-[11px] font-semibold text-brand-teal-dark">{item.service || '-'}</p>
                      <p className="text-[11px] font-semibold text-brand-dark-soft">
                        <span className="block">{item.date || '-'}</span>
                        {item.time && <span className="block text-[10px]">{item.time}</span>}
                      </p>
                      <span className={`w-fit text-[9px] font-bold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>
                      {isCancelled ? (
                        <div className="min-w-0">
                          {getCancellationType(item) && (
                            <p className="mb-0.5 inline-flex rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">
                              {getCancellationType(item)}
                            </p>
                          )}
                          <p className="break-words text-[11px] font-semibold leading-snug text-red-600">{getCancellationReason(item)}</p>
                        </div>
                      ) : (
                        <p className="truncate font-bold text-emerald-700">
                          {grandTotal > 0 ? `PHP ${grandTotal.toFixed(2)}` : '-'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
