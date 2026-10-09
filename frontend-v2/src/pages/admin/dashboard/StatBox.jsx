import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

const labelByKey = {
  today_total: 'Today Timeline',
  in_progress_today: 'In Progress Today',
  grooming_today: 'Grooming Appointments',
  hotelsuite_available: 'Hotel Occupancy',
  daycare_today: 'Daycare Appointments',
};

const emptyByKey = {
  today_total: 'No appointments for today.',
  in_progress_today: 'No in-progress appointments today.',
  grooming_today: 'No grooming appointments today.',
  hotelsuite_available: 'No hotel bookings for today.',
  daycare_today: 'No daycare appointments today.',
};

const focusByKey = {
  today_total: 'Shows all appointments scheduled today, sorted by time.',
  in_progress_today: 'Shows pets currently checked in or in progress today.',
  grooming_today: 'Shows only grooming appointments for today. Use this to review groomer workload and completion status.',
  daycare_today: 'Shows only daycare appointments for today. Use this to review daycare attendance and occupancy.',
  hotelsuite_available: 'Shows shared inventory status for hotel suites today.',
};

const CLUSTER_META = {
  A: { label: 'Cluster A (Cozy)', total: 6, details: 'Shared by: Cozy Paw (Dog) & Cozy Whiskers (Cat)' },
  B: { label: 'Cluster B (Happy/Purr)', total: 6, details: 'Shared by: Happy Paws (Dog) & Grand Purr (Cat)' },
  C: { label: 'Cluster C (Grand)', total: 3, details: 'Reserved for: Grand Paw (Dog) & VIPaws (Dog Upcharge)' },
  D: { label: 'Cluster D (VIPurr)', total: 3, details: 'Reserved for: VIPurr Villa (Cat)' },
};

const normalizeStatus = (status) => String(status || '').toLowerCase().replace(/-/g, '_');

const formatOccupancyTime = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const statusLabel = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'in_progress' || normalized === 'checkin' || normalized === 'checked_in') return 'In Progress';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'no_show') return 'Cancelled';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Pending';
};

function MetricStrip({ items = [] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-brand-dark-light px-1 pb-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark-soft">{item.label}</p>
          <p className={`mt-1 text-3xl font-bold leading-none ${item.valueClass || 'text-brand-dark'}`}>{item.value}</p>
          {item.subtitle ? <p className="mt-1 text-[11px] font-semibold text-brand-dark-soft">{item.subtitle}</p> : null}
        </div>
      ))}
    </div>
  );
}

function SpeciesPill({ label, value, tone }) {
  const toneClass = tone === 'dog'
    ? 'border-brand-teal/25 bg-brand-teal/10 text-brand-teal-dark'
    : 'border-brand-orange/30 bg-brand-orange/10 text-brand-orange';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
      {label}
      <span>{value}</span>
    </span>
  );
}

function StatBoxCard({ title, value, note, onClick }) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="group flex min-h-[112px] w-full flex-col items-start justify-start rounded-xl border border-brand-teal/20 bg-white px-4 py-3 text-left shadow-[0_6px_12px_rgba(23,53,81,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(23,53,81,0.14)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
    >
      <h2 className="min-h-8 text-xs font-semibold text-brand-dark">{title}</h2>
      <p className="mt-3 text-3xl font-bold leading-none text-brand-teal">{value}</p>
      <p className="mt-3 text-xs font-medium text-brand-teal-dark/90">{note}</p>
    </Wrapper>
  );
}

function StatBoxDetailsModal({ isOpen, item, appointments = [], hotelOverview = {}, onClose }) {
  useBodyScrollLock(!!isOpen && !!item);
  if (!isOpen || !item) return null;
  const isHotel = item.key === 'hotelsuite_available';
  const isTodayTimeline = item.key === 'today_total';
  const shouldHideAppointmentList = isTodayTimeline || item.key === 'in_progress_today';

  const counts = appointments.reduce((acc, appointment) => {
    const normalized = normalizeStatus(appointment?.status);
    if (normalized === 'completed') acc.completed += 1;
    else if (normalized === 'cancelled') acc.cancelled += 1;
    else if (normalized === 'in_progress' || normalized === 'checkin' || normalized === 'checked_in') acc.inProgress += 1;
    else acc.approved += 1;
    return acc;
  }, { approved: 0, inProgress: 0, completed: 0, cancelled: 0 });

  const hotel = {
    hotel_total: Number(hotelOverview?.hotel_total || 0),
    hotel_available: Number(hotelOverview?.hotel_available || 0),
    hotel_occupied: Number(hotelOverview?.hotel_occupied || 0),
    hotel_dogs: Number(hotelOverview?.hotel_dogs || hotelOverview?.hotel_species_counts?.dog || 0),
    hotel_cats: Number(hotelOverview?.hotel_cats || hotelOverview?.hotel_species_counts?.cat || 0),
    cluster_breakdown: Array.isArray(hotelOverview?.cluster_breakdown) ? hotelOverview.cluster_breakdown : [],
  };
  const currentOccupants = hotel.cluster_breakdown.flatMap((cluster) => (
    Array.isArray(cluster?.occupants) ? cluster.occupants : []
  ));

  return createPortal(
    <div className="fixed inset-0 z-[76] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40" onClick={onClose}>
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
          <h3 className="text-base font-extrabold text-white">{labelByKey[item.key] || item.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20"
            aria-label="Close stats modal"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isHotel ? (
            <>
              <MetricStrip
                items={[
                  { label: 'Available', value: hotel.hotel_available, subtitle: 'Open now', valueClass: 'text-brand-teal' },
                  { label: 'Occupied', value: hotel.hotel_occupied, subtitle: 'In use', valueClass: 'text-brand-dark' },
                  { label: 'Dogs', value: hotel.hotel_dogs, subtitle: 'Current', valueClass: 'text-brand-teal' },
                  { label: 'Cats', value: hotel.hotel_cats, subtitle: 'Current', valueClass: 'text-brand-orange' },
                ]}
              />

              <div className="divide-y divide-brand-dark-light border-b border-brand-dark-light">
                {hotel.cluster_breakdown.length === 0 && (
                  <p className="px-4 py-4 text-xs font-semibold text-brand-dark-soft">No cluster breakdown data yet.</p>
                )}

                {hotel.cluster_breakdown.map((cluster) => {
                  const key = String(cluster?.cluster || '').toUpperCase();
                  const meta = CLUSTER_META[key];
                  const total = Number(cluster?.capacity ?? meta?.total ?? 0);
                  const available = Number(cluster?.available ?? 0);
                  const occupied = Math.max(0, total - available);
                  const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;
                  const speciesCounts = cluster?.species_counts || {};
                  return (
                    <div key={key} className="px-1 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                        <p className="text-sm font-semibold text-brand-dark">{meta?.label || `Cluster ${key}`}</p>
                        <p className="text-[11px] font-medium text-brand-dark-soft">{meta?.details || 'Hotel suites'}</p>
                        </div>
                        <p className="shrink-0 text-[11px] font-semibold text-brand-dark">
                          {available}/{total} free
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <SpeciesPill label="Dog" value={speciesCounts.dog ?? 0} tone="dog" />
                        <SpeciesPill label="Cat" value={speciesCounts.cat ?? 0} tone="cat" />
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-dark-light">
                        <div
                          className="h-full rounded-full bg-brand-teal"
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-x-auto border-b border-brand-dark-light bg-white">
                <div className="min-w-[620px]">
                <div className="grid grid-cols-[1fr_1.25fr_1fr_1fr] gap-3 border-b border-brand-dark-light px-1 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Pet</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Suite/Service</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Checked in</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Expected out</p>
                </div>

                {currentOccupants.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm font-semibold text-brand-dark-soft">
                    No pets are currently checked in.
                  </p>
                )}

                {currentOccupants.map((occupant) => (
                  <div key={occupant.appointment_id} className="grid grid-cols-[1fr_1.25fr_1fr_1fr] gap-3 border-b border-brand-dark-light px-1 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-dark">{occupant.pet_name || '--'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-brand-dark-soft">{occupant.suite_name || '--'}</p>
                    </div>
                    <p className="text-xs font-semibold text-brand-dark">{formatOccupancyTime(occupant.checked_in_at)}</p>
                    <p className="text-xs font-semibold text-brand-dark">
                      {formatOccupancyTime(occupant.expected_out_at)}
                      {occupant.overdue && <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Overdue</span>}
                    </p>
                  </div>
                ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <MetricStrip
                items={[
                  { label: 'Total', value: appointments.length, valueClass: 'text-brand-teal' },
                  { label: 'Approved', value: counts.approved },
                  { label: 'Completed', value: counts.completed },
                  { label: 'Cancelled', value: counts.cancelled },
                ]}
              />

              <div className="border-b border-brand-dark-light px-1 pb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-dark-soft">Card Focus</p>
                <p className="mt-1 text-sm text-brand-dark">{focusByKey[item.key] || 'Review today appointment details for this card.'}</p>
              </div>

              {!shouldHideAppointmentList && (
                <div className="max-h-[46vh] overflow-y-auto border-b border-brand-dark-light bg-white">
                  {appointments.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm font-semibold text-brand-dark-soft">
                      {emptyByKey[item.key] || 'No data available.'}
                    </p>
                  )}

                  {appointments.length > 0 && (
                    <div className="grid grid-cols-[1fr_1fr_80px] gap-3 border-b border-brand-dark-light bg-white px-1 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Pet</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Service</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Time</p>
                    </div>
                  )}

                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="grid grid-cols-[1fr_1fr_80px] gap-3 border-b border-brand-dark-light px-1 py-3 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-dark">{appointment.pet || '--'}</p>
                        <p className="mt-0.5 truncate text-[11px] text-brand-dark-soft">{appointment.owner || '--'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs text-brand-dark-soft">{appointment.service || `Service #${appointment?._raw?.service_id || '--'}`}</p>
                        <p className="mt-1 text-[11px] font-semibold text-brand-teal-dark">{statusLabel(appointment.status)}</p>
                      </div>
                      <p className="text-right text-xs font-semibold text-brand-dark">{appointment.time || '--:--'}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function StatBox(props) {
  if (props?.variant === 'modal') {
    return <StatBoxDetailsModal {...props} />;
  }
  return <StatBoxCard {...props} />;
}
