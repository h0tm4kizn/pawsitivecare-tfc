import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import UpcomingAppointmentCard from './UpcomingAppointmentCard';

export default function AllUpcomingAppointmentsModal({ isOpen, appointments, onClose, onSelect }) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-6 py-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-calendar-check text-white text-sm" />
            <div>
              <h3 className="text-base font-bold text-white">Upcoming Appointments</h3>
              <p className="mt-0.5 text-[11px] font-medium text-white/75">
                {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors">
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>
        <div className="h-1 bg-white" />
        <div className="max-h-[70dvh] space-y-2 overflow-y-auto scrollbar-teal bg-white px-4 py-4">
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <i className="fa-regular fa-calendar-xmark text-2xl text-brand-dark-soft/30 mb-2" />
              <p className="text-xs text-brand-dark-soft">No upcoming appointments.</p>
            </div>
          ) : (
            appointments.map((apt) => (
              <UpcomingAppointmentCard
                key={apt.id}
                apt={apt}
                onClick={() => {
                  onClose();
                  onSelect(apt);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
