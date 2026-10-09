import { AlertTriangle, BriefcaseBusiness, CheckCircle2, PawPrint, Pencil, Trash2, UserRound } from 'lucide-react';

const getServiceBg = (item) => {
  const raw = String(item?.serviceType || item?.service_category || item?.service || '').toLowerCase();
  if (raw.includes('hotel') || raw.includes('suite')) return 'bg-brand-hotel';
  if (raw.includes('day')) return 'bg-brand-daycare';
  return 'bg-brand-grooming';
};

const getServiceBadgeClass = (item) => {
  const raw = String(item?.serviceType || item?.service_category || item?.service || '').toLowerCase();
  if (raw.includes('hotel') || raw.includes('suite')) return 'bg-brand-hotel-soft text-brand-hotel';
  if (raw.includes('day')) return 'bg-brand-daycare-soft text-brand-daycare';
  return 'bg-brand-grooming-soft text-brand-grooming';
};

const normalizeAppointmentStatus = (status = '') => {
  const value = String(status || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (value === 'pending_approval') return 'pending';
  if (value === 'inprogress') return 'in_progress';
  if (value === 'noshow' || value === 'no_show') return 'cancelled';
  if (value === 'canceled') return 'cancelled';
  return value;
};

const getStatusBadgeClass = (status, needsStatusUpdate = false) => {
  if (needsStatusUpdate) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (status === 'cancelled') return 'bg-red-50 text-red-600 ring-1 ring-red-200';
  if (status === 'in_progress') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  if (status === 'approved') return 'bg-teal-50 text-teal-700 ring-1 ring-teal-200';
  return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
};

const getStatusLabel = (status, needsStatusUpdate = false) => {
  if (needsStatusUpdate) return 'Needs Status Update';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'pending') return 'Pending Approval';
  return status || '-';
};

const getLateCheckoutMeta = (item) => {
  const raw = item?._raw || {};
  const isHotel = String(raw?.service?.category || item?.serviceType || '').toLowerCase().includes('hotel');
  if (!isHotel) return { late: false, text: '' };
  const diff = Number(raw?.checkout_time_difference_minutes ?? 0);
  if (!Number.isFinite(diff) || diff <= 0) return { late: false, text: 'Released On Time' };
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return { late: true, text: `Late by ${h > 0 ? `${h}h ` : ''}${m}m`.trim() };
};

const getLateCheckinMeta = (item) => {
  const raw = item?._raw || {};
  const isHotel = String(raw?.service?.category || item?.serviceType || '').toLowerCase().includes('hotel');
  if (!isHotel) return { late: false, text: '' };
  const diff = Number(raw?.checkin_time_difference_minutes ?? 0);
  if (!Number.isFinite(diff) || diff <= 0) return { late: false, text: 'Arrived On Time' };
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return { late: true, text: `Late by ${h > 0 ? `${h}h ` : ''}${m}m`.trim() };
};

export default function AppointmentList({
  listAppointments,
  todayIso,
  onOpenDetails,
  onRequestCancel,
  onEdit,
  onMarkComplete,
  variant = 'table',
}) {
  const isSidebar = variant === 'sidebar';
  const isCardList = variant === 'cards';

  return (
    <div className={isSidebar ? 'flex h-full flex-col overflow-hidden' : isCardList ? 'overflow-hidden' : 'overflow-x-auto'}>
      {!isSidebar && !isCardList && (
        <div className="grid min-w-[880px] grid-cols-[100px_1.25fr_1.2fr_130px_1fr_110px] gap-2 border-b border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">
        <span>Service ID</span>
        <span>Service</span>
        <span>Pet &amp; Owner</span>
        <span>Date &amp; Time</span>
        <span className="text-center">Status</span>
        <span className="text-center">Action</span>
        </div>
      )}

      {listAppointments.length === 0 && (
        <div className="py-10 text-center text-sm font-semibold text-brand-dark-soft">No appointments found.</div>
      )}

      <div className={isSidebar ? 'min-h-0 flex-1 space-y-2 overflow-y-auto p-3' : isCardList ? 'space-y-2 p-3' : ''}>
        {listAppointments.map((item) => {
        const normalizedStatus = normalizeAppointmentStatus(item.status);
        const isToday = item.dateIso === todayIso;
        const isPast = Boolean(item.dateIso && item.dateIso < todayIso);
        const needsStatusUpdate = isPast && ['approved', 'in_progress'].includes(normalizedStatus);
        const canEdit = normalizedStatus === 'approved';
        const canApprove = normalizedStatus === 'pending';
        const canCheckIn = isToday && normalizedStatus === 'approved';
        const canComplete = normalizedStatus === 'in_progress' || (isPast && normalizedStatus === 'approved');
        const canCancel = normalizedStatus !== 'completed' && normalizedStatus !== 'cancelled';
        const isPendingReschedule = normalizedStatus === 'pending' && (
          Boolean(item?._raw?.reschedule_requested_at)
          || String(item?._raw?.notes || '').includes('[Reschedule Request]')
        );
        const hasActions = canApprove || canCheckIn || canComplete || canCancel;
        const lateMeta = getLateCheckoutMeta(item);
        const lateCheckinMeta = getLateCheckinMeta(item);

        if (isSidebar || isCardList) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenDetails?.(item)}
              className="relative block w-full overflow-hidden rounded-xl border border-brand-teal/15 bg-white px-3.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className={`absolute left-0 top-0 h-full w-1.5 ${getServiceBg(item)}`} />

              <div className="min-w-0 space-y-1.5">
                <p className="text-[10px] font-semibold text-brand-dark-soft">{item.displayId}</p>
                <p className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-brand-teal-dark">
                  <BriefcaseBusiness size={13} className="shrink-0 text-brand-teal" strokeWidth={2.4} />
                  <span className="truncate">{item.service}</span>
                </p>
                <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-brand-dark">
                  <PawPrint size={12} className="shrink-0 text-gray-400" strokeWidth={2.5} />
                  <span className="truncate">{item.pet}</span>
                </p>
                <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-brand-dark-soft">
                  <UserRound size={11} className="shrink-0 text-brand-dark-soft" strokeWidth={2.4} />
                  <span className="truncate">{item.owner}</span>
                </p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                    needsStatusUpdate ? getStatusBadgeClass(normalizedStatus, true) : getServiceBadgeClass(item)
                  }`}>
                    {needsStatusUpdate && <AlertTriangle size={10} />}
                    {getStatusLabel(normalizedStatus, needsStatusUpdate)}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-brand-dark-soft">{item.date}{item.time ? ` • ${item.time}` : ''}</span>
                </div>
                {isPendingReschedule && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                    Reschedule request — pending approval
                  </p>
                )}
                {lateMeta.late && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                    Late Check-Out Recorded: {lateMeta.text}
                  </p>
                )}
                {lateCheckinMeta.late && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                    Late Check-In Recorded: {lateCheckinMeta.text}
                  </p>
                )}
              </div>

              <div className="mt-2 flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                {needsStatusUpdate ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onMarkComplete?.(item)}
                      title="Mark as complete"
                      aria-label="Mark as complete"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                    >
                      <CheckCircle2 size={12} />
                    </button>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => onRequestCancel?.(item)}
                        title="Cancel appointment"
                        aria-label="Cancel appointment"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {(canEdit || (!isToday && hasActions)) && (
                      <button
                        type="button"
                        onClick={() => onEdit?.(item)}
                        title="Edit appointment"
                        aria-label="Edit appointment"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => onRequestCancel?.(item)}
                        title="Cancel appointment"
                        aria-label="Cancel appointment"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        }

        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetails?.(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenDetails?.(item);
              }
            }}
            className="relative grid min-w-[880px] grid-cols-[100px_1.25fr_1.2fr_130px_1fr_110px] items-center gap-2 border-t border-brand-teal/15 bg-white px-4 py-3 text-xs text-brand-dark transition-colors hover:bg-brand-surface/70"
          >
            <span className={`absolute left-0 top-0 h-full w-1.5 ${getServiceBg(item)}`} />
            <span className="font-semibold text-brand-dark-soft">{item.displayId}</span>
            <span className="flex min-w-0 items-center gap-2">
              <BriefcaseBusiness size={13} className="shrink-0 text-brand-teal" strokeWidth={2.4} />
              <span className="truncate font-semibold text-brand-teal-dark">{item.service}</span>
            </span>
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                <PawPrint size={12} className="shrink-0 text-gray-400" strokeWidth={2.5} />
                <span className="truncate">{item.pet}</span>
              </p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[10px] text-brand-dark-soft">
                <UserRound size={11} className="shrink-0 text-brand-dark-soft" strokeWidth={2.4} />
                <span className="truncate">{item.owner}</span>
              </p>
            </div>
            <span className="text-[11px]">{item.date}{item.time ? ` • ${item.time}` : ''}</span>
            <div className="flex justify-center">
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${getStatusBadgeClass(normalizedStatus, needsStatusUpdate)}`}>
                {needsStatusUpdate && <AlertTriangle size={10} />}
                {getStatusLabel(normalizedStatus, needsStatusUpdate)}
              </span>
              {isPendingReschedule && (
                <span className="ml-1 inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Reschedule Request
                </span>
              )}
              {lateMeta.late && (
                <span className="ml-1 inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Late Check-Out
                </span>
              )}
              {lateCheckinMeta.late && (
                <span className="ml-1 inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Late Check-In
                </span>
              )}
            </div>
            <div className="flex items-center justify-center gap-1.5" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              {!hasActions ? null : needsStatusUpdate ? (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkComplete?.(item)}
                    title="Mark as complete"
                    aria-label="Mark as complete"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                  >
                    <CheckCircle2 size={12} />
                  </button>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onRequestCancel?.(item)}
                      title="Cancel appointment"
                      aria-label="Cancel appointment"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              ) : isToday ? (
                /* Today with actions — edit + cancel */
                <>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit?.(item)}
                      title="Edit appointment"
                      aria-label="Edit appointment"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onRequestCancel?.(item)}
                      title="Cancel appointment"
                      aria-label="Cancel appointment"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              ) : (
                /* Non-today with actions — edit + cancel */
                <>
                  <button
                    type="button"
                    onClick={() => onEdit?.(item)}
                    title="Edit appointment"
                    aria-label="Edit appointment"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20"
                  >
                    <Pencil size={12} />
                  </button>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onRequestCancel?.(item)}
                      title="Cancel appointment"
                      aria-label="Cancel appointment"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
        })}
      </div>

      <div className="border-t border-brand-teal/20 px-4 py-2 text-[11px] font-semibold text-brand-dark-soft">
        Showing {listAppointments.length} appointment{listAppointments.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
