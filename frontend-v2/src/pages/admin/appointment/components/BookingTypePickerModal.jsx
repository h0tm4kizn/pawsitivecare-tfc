import { CalendarPlus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getWalkInUnavailableReason } from '../../dashboard/adminDashboardUtils';

export default function BookingTypePickerModal({ isOpen, dateLabel = '', onClose, onSelect, shopHours = {}, shopHoursLoading = false, shopHoursError = false }) {
  if (!isOpen) return null;

  const walkInUnavailableReason = getWalkInUnavailableReason(dateLabel, shopHours, shopHoursLoading, shopHoursError);
  const walkInAvailable = !walkInUnavailableReason;

  return createPortal(
    <div className="fixed inset-0 z-[170] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-white">Choose Booking Type</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-white/80">
              {dateLabel ? `For ${dateLabel}` : 'Select how this customer is arriving.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close booking type picker">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect?.('appointment')}
            className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-brand-teal/25 bg-brand-teal/5 px-4 py-5 text-center transition hover:border-brand-teal hover:bg-brand-teal/10"
          >
            <CalendarPlus className="mb-3 text-brand-teal" size={28} />
            <span className="text-sm font-extrabold text-brand-dark">Schedule Appointment</span>
            <span className="mt-1 text-[11px] font-medium text-brand-dark-soft">Reserve a specific service time.</span>
          </button>
          <button
            type="button"
            disabled={!walkInAvailable}
            onClick={() => onSelect?.('walk_in')}
            className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-amber-200 disabled:hover:bg-amber-50"
          >
            <i className="fa-solid fa-person-walking-arrow-right mb-3 text-2xl text-amber-600" />
            <span className="text-sm font-extrabold text-brand-dark">Walk-In Service</span>
            <span className="mt-1 text-[11px] font-medium text-brand-dark-soft">{walkInAvailable ? 'For customers visiting today, during shop hours.' : walkInUnavailableReason}</span>
          </button>
        </div>
        <div className="border-t border-brand-dark-light px-5 py-3 text-center text-[10px] font-semibold text-brand-dark-soft">
          Existing appointments open directly when selected.
        </div>
      </div>
    </div>,
    document.body,
  );
}
