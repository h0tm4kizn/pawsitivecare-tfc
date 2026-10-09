import {
  categoryTitle,
  fmtDate,
  fmtTime,
  statusMeta,
} from './appointmentHelpers';

export default function UpcomingAppointmentCard({ apt, onClick }) {
  const cat = String(apt.service?.category || '').toLowerCase();
  const borderColor = cat.includes('hotel') ? 'border-brand-hotel/30' : cat.includes('daycare') ? 'border-brand-daycare/30' : 'border-brand-grooming/30';
  const cardGradient = cat.includes('hotel')
    ? 'bg-gradient-to-r from-brand-hotel-soft/90 via-white to-white'
    : cat.includes('daycare')
      ? 'bg-gradient-to-r from-brand-daycare-soft/90 via-white to-white'
      : 'bg-gradient-to-r from-brand-grooming-soft/90 via-white to-white';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl border ${borderColor} ${cardGradient} px-4 py-3 text-left transition-all hover:brightness-[0.98]`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-brand-dark">{categoryTitle(apt)}</p>
        <p className="text-xs text-brand-dark-soft">
          <span className="font-semibold">{apt.pet?.name || '—'}</span>
          {apt.start_time ? ` • ${fmtTime(apt.start_time)}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className="text-xs text-brand-dark-soft">
          {apt.hotel_nights
            ? (() => {
                const [y, m, d] = String(apt.appointment_date).slice(0, 10).split('-').map(Number);
                const checkIn = new Date(y, m - 1, d);
                const checkOut = new Date(y, m - 1, d + apt.hotel_nights);
                const fmt = (dt) => dt.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric' });
                return `${fmt(checkIn)} • ${fmt(checkOut)}`;
              })()
            : fmtDate(apt.appointment_date)}
        </p>
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${statusMeta(apt).cls}`}>
          {statusMeta(apt).label}
        </span>
      </div>
      <i className="fa-solid fa-chevron-right text-brand-dark-soft/40 text-[10px] shrink-0" />
    </button>
  );
}
