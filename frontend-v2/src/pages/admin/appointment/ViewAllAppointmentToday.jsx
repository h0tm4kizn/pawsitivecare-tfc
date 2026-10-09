import { BriefcaseBusiness, PawPrint, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const formatStatus = (status) => {
  const normalized = String(status || '').toLowerCase().replace(/-/g, '_');
  if (normalized === 'in_progress' || normalized === 'checkin' || normalized === 'checked_in') return 'In Progress';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled') return 'Cancelled';
  if (normalized === 'no_show') return 'Cancelled';
  return status || 'Pending';
};

const getServiceCardGradient = (appointment) => {
  const category = String(appointment?.serviceCategory || appointment?._raw?.service?.category || appointment?._raw?.service_category || '').toLowerCase();
  const name = String(appointment?._raw?.service?.name || appointment?.service || '').toLowerCase();
  const combined = `${category} ${name}`;
  if (combined.includes('hotel') || combined.includes('suite')) return 'bg-gradient-to-r from-brand-hotel-soft/90 via-white to-white';
  if (combined.includes('daycare') || combined.includes('day care')) return 'bg-gradient-to-r from-brand-daycare-soft/90 via-white to-white';
  return 'bg-gradient-to-r from-brand-grooming-soft/90 via-white to-white';
};

const getStatusTextClass = (status) => {
  const normalized = String(status || '').toLowerCase().replace(/-/g, '_');
  if (normalized === 'completed') return 'text-emerald-600';
  if (normalized === 'cancelled') return 'text-red-600';
  if (normalized === 'no_show') return 'text-red-600';
  if (normalized === 'in_progress' || normalized === 'checkin' || normalized === 'checked_in') return 'text-amber-700';
  return 'text-blue-700';
};

const getTimeMeta = (appointment) => {
  const rawTime = String(appointment?.time || '').trim();
  const normalizedTime = rawTime.toLowerCase();
  const normalizedStatus = String(appointment?.status || '').toLowerCase().replace(/-/g, '_');
  const isHotelStageLabel = ['check-in', 'check-out', 'staying'].includes(normalizedTime);
  const isCheckedIn = ['in_progress', 'checkin', 'checked_in'].includes(normalizedStatus);

  if (!isHotelStageLabel) return { label: 'Time', value: rawTime || '--:--' };
  if (isCheckedIn) return { label: 'Time', value: rawTime };
  return { label: 'Status', value: formatStatus(appointment?.status) };
};

export default function ViewAllAppointmentToday({
  isOpen,
  dateIso,
  appointments,
  onClose,
  onOpenDetails,
  onBookAppointment,
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const selectedDateLabel = dateIso
    ? new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', 
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Selected date';

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), 250);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    window.setTimeout(() => onClose?.(), 220);
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[78] h-[100dvh] min-h-[100dvh] w-screen bg-brand-dark/40 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`ml-auto flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-white shadow-[-18px_0_40px_rgba(23,53,81,0.24)] transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-white">Appointments</h2>
            <p className="mt-0.5 text-xs font-semibold text-white/85">{selectedDateLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Close appointments modal"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {appointments.length === 0 && (
            <p className="py-8 text-center text-sm font-semibold text-brand-dark-soft">
              No appointments for this date.
            </p>
          )}

          {appointments.map((appointment) => {
            const timeMeta = getTimeMeta(appointment);
            return (
              <div
                key={appointment.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDetails?.(appointment)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenDetails?.(appointment);
                  }
                }}
                className={`relative w-full cursor-pointer overflow-hidden rounded-xl border border-brand-teal/15 px-4 py-3 text-left shadow-sm transition hover:border-brand-teal/35 hover:brightness-[0.98] sm:grid sm:grid-cols-[86px_1fr_112px] sm:items-center sm:gap-3 sm:pr-8 ${getServiceCardGradient(appointment)}`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-brand-dark-light/80 pb-2 pl-1 pr-5 sm:block sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3 sm:text-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-brand-dark-soft">
                      {timeMeta.label}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-sm font-bold leading-none text-brand-dark">
                      {timeMeta.value}
                    </p>
                  </div>
                  <div className="text-right sm:hidden">
                    <p className="text-[10px] font-bold text-brand-teal-dark">{appointment.displayId || appointment.id || '--'}</p>
                    <p className={`mt-1 text-[10px] font-semibold ${getStatusTextClass(appointment.status)}`}>{formatStatus(appointment.status)}</p>
                  </div>
                </div>

                <div className="min-w-0 space-y-1 pt-2 sm:pt-0">
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold text-brand-dark">
                    <PawPrint size={13} className="shrink-0 text-brand-dark-soft" strokeWidth={2.5} />
                    <span className="truncate">{appointment.pet || '--'}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-brand-dark-soft">
                    <UserRound size={12} className="shrink-0 text-brand-dark-soft" strokeWidth={2.4} />
                    <span className="truncate">{appointment.owner || '--'}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-semibold text-brand-dark-soft">
                    <BriefcaseBusiness size={12} className="shrink-0 text-brand-dark-soft" strokeWidth={2.4} />
                    <span className="truncate">{appointment.service || `Service #${appointment?._raw?.service_id || '--'}`}</span>
                  </p>
                </div>

                <div className="mt-2 hidden min-w-0 flex-col items-end pr-1 text-right sm:mt-0 sm:flex">
                  <p className="text-[10px] font-bold text-brand-teal-dark">{appointment.displayId || appointment.id || '--'}</p>
                  <p className={`mt-1 text-[10px] font-semibold ${getStatusTextClass(appointment.status)}`}>{formatStatus(appointment.status)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {onBookAppointment && (
          <div className="border-t border-brand-teal/20 bg-white px-5 py-4">
            <button
              type="button"
              onClick={onBookAppointment}
              className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white transition hover:bg-brand-teal-dark"
            >
              Book an Appointment
            </button>
          </div>
        )}
      </div>
    </div>
    ,
    document.body
  );
}

