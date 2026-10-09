import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

export function ConfirmBookingStatusModal({ appointment, loading = false, onClose, onConfirm }) {
  useBodyScrollLock(!!appointment);
  if (!appointment) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/45" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h3 className="text-sm font-extrabold text-white">Booking Confirmation</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="h-1 bg-brand-teal-light" />

        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-brand-dark">Continue approving this booking?</p>
          <p className="mt-2 text-xs text-brand-dark-soft">
            {appointment.pet || 'Pet'} - {appointment.service || 'Service'} {appointment.date || appointment.dateIso ? `on ${appointment.date || appointment.dateIso}` : ''}
          </p>
        </div>

        <div className="flex gap-2 border-t border-brand-teal/15 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-brand-teal/20 py-2 text-sm font-bold text-brand-dark transition hover:bg-gray-50 disabled:opacity-50"
          >
            No
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-brand-teal py-2 text-sm font-bold text-white transition hover:bg-brand-teal-dark disabled:opacity-50"
          >
            {loading ? 'Confirming...' : 'Yes'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
