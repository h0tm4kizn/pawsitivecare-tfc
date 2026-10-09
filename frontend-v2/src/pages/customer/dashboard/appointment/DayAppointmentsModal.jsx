import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import {
  categoryIconBg,
  fmtTime,
  statusMeta,
} from './appointmentHelpers';
import { serviceIcon } from './appointmentIcons';

export default function DayAppointmentsModal({ isOpen, date, appointments, onClose, onBookDate }) {
  useBodyScrollLock(isOpen);
  if (!isOpen || !date) return null;

  const [year, month, day] = date.split('-').map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const dayApts = appointments.filter((a) => String(a.appointment_date).slice(0, 10) === date && a.status !== 'cancelled');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-6 py-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-calendar-days text-white text-sm" />
            <div>
              <h2 className="text-base font-bold text-white">Appointments</h2>
              <p className="text-xs text-white/75 mt-0.5">{label}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors">
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>
        <div className="h-1 bg-white" />

        <div className="max-h-[50vh] overflow-y-auto scrollbar-teal px-4 py-4 space-y-2">
          {dayApts.map((apt) => (
            <div key={apt.id} className="flex items-center gap-3 rounded-xl border border-brand-dark-light px-4 py-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${categoryIconBg(apt)}`}>
                {serviceIcon(apt.service?.category)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-dark truncate">{apt.service?.name || '—'}</p>
                <p className="text-xs text-brand-dark-soft">
                  {apt.pet?.name || '—'}
                  {apt.start_time ? ` • ${fmtTime(apt.start_time)}` : ''}
                </p>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusMeta(apt).cls}`}>
                {statusMeta(apt).label}
              </span>
            </div>
          ))}
        </div>

        {/* Book for this date */}
        {onBookDate && (
          <div className="border-t border-brand-dark-light px-4 py-3">
            <button
              type="button"
              onClick={() => { onClose(); onBookDate(date); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-teal py-3 text-sm font-bold text-white hover:brightness-95 transition-colors"
            >
              <i className="fa-solid fa-calendar-plus text-xs" />
              Book for this date
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
