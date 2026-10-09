import { CalendarPlus } from 'lucide-react';

export default function ScheduleAppointmentButton({ onClick, label = 'Schedule an Appointment', className = '', showIcon = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${showIcon ? 'flex items-center gap-1.5' : ''} rounded-xl bg-brand-teal px-4 py-2 text-[11px] font-bold text-white transition-colors hover:bg-brand-teal-dark ${className}`}
    >
      {showIcon && <CalendarPlus size={13} />}
      {label}
    </button>
  );
}
