import { Check, FileText, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import PaymentProofPreviewModal from './PaymentProofPreviewModal';
import { getNewBookingPaymentInfo } from './newBookingPaymentInfo';

export default function NewBookingsModal({ isOpen, appointments = [], confirmingId, onClose, onConfirm, onReject, onViewDetails }) {
  const [preview, setPreview] = useState(null);
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/45" onClick={onClose}>
      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4">
          <div>
            <h3 className="text-sm font-extrabold text-white">NEW BOOKINGS</h3>
            <p className="text-[11px] text-white/80 mt-0.5">Bookings not yet approved - approve to notify the customer</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {appointments.length === 0 && (
            <p className="py-10 text-center text-sm font-semibold text-brand-dark-soft">No pending bookings at the moment.</p>
          )}

          {appointments.length > 0 && (
            <div className="divide-y divide-brand-dark-light">
              <div className="hidden grid-cols-[1.05fr_0.85fr_0.9fr_0.6fr_300px] gap-4 bg-brand-surface px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft lg:grid">
                <span>Owner / Pet</span>
                <span>Service</span>
                <span>Date & Time</span>
                <span>Booking ID</span>
                <span className="text-center">Actions</span>
              </div>
              {appointments.map((appt) => {
                const isConfirming = confirmingId === appt.id;
                const raw = appt?._raw || {};
                const isHotel = String(appt?.serviceCategory || appt?.serviceType || raw?.service?.category || '')
                  .toLowerCase()
                  .includes('hotel');
                const paymentInfo = getNewBookingPaymentInfo(raw);
                const isRescheduleRequest = Boolean(appt?._raw?.reschedule_requested_at)
                  || String(appt?._raw?.notes || '').includes('[Reschedule Request]');
                return (
                  <div key={appt.id} className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-brand-surface/60 sm:px-5 lg:grid-cols-[1.05fr_0.85fr_0.9fr_0.6fr_300px] lg:items-center lg:py-3">
                    <button type="button" onClick={() => { onViewDetails?.(appt); onClose?.(); }} className="text-left min-w-0">
                      <p className="text-xs font-bold text-brand-dark truncate">{appt.owner || '-'}</p>
                      <p className="text-[10px] text-brand-dark-soft truncate">{appt.pet || '-'}</p>
                    </button>
                    <button type="button" onClick={() => { onViewDetails?.(appt); onClose?.(); }} className="text-left min-w-0">
                      <p className="text-xs text-brand-dark truncate">{appt.service || '-'}</p>
                      <p className="text-[10px] text-brand-dark-soft capitalize">{appt.serviceCategory || ''}</p>
                      {isRescheduleRequest && (
                        <p className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                          Reschedule Request
                        </p>
                      )}
                    </button>
                    <button type="button" onClick={() => { onViewDetails?.(appt); onClose?.(); }} className="text-left min-w-0">
                      <p className="text-xs font-semibold text-brand-dark">{appt.date || appt.dateIso || '-'}</p>
                      <p className="text-[10px] text-brand-dark-soft">{appt.time || '-'}</p>
                    </button>
                    <button type="button" onClick={() => { onViewDetails?.(appt); onClose?.(); }} className="text-left min-w-0">
                      <p className="font-mono text-[10px] text-brand-dark-soft truncate">{appt.displayId || appt.id}</p>
                    </button>
                    <div className="col-span-2 space-y-2 border-t border-brand-dark-light/70 pt-3 lg:col-span-1 lg:border-0 lg:pt-0">
                      {isHotel && (
                        <div className="space-y-1.5 rounded-lg border border-brand-dark-light/70 bg-white p-2.5 text-[10px] leading-snug">
                          <p><span className="font-bold text-brand-dark-soft">Payment From:</span> <span className="break-words text-brand-dark">{paymentInfo.paymentFrom}</span></p>
                          <p><span className="font-bold text-brand-dark-soft">Payment To:</span> <span className="break-words text-brand-dark">{paymentInfo.paymentTo}</span></p>
                          {paymentInfo.referenceNumber && <p><span className="font-bold text-brand-dark-soft">Reference Number:</span> <span className="break-all font-mono text-brand-dark">{paymentInfo.referenceNumber}</span></p>}
                          {paymentInfo.hasProof && (
                            <button
                              type="button"
                              onClick={() => setPreview({ appointmentId: appt.id, bookingId: appt.displayId || appt.id })}
                              className="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-brand-teal/25 bg-brand-surface px-2 py-1.5 text-[10px] font-bold text-brand-teal-dark transition hover:border-brand-teal hover:bg-brand-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                              title="Preview the customer's proof of payment"
                            >
                              <FileText size={13} /> Payment Proof · View
                            </button>
                          )}
                          {paymentInfo.showNoPaymentProof && (
                            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-center font-bold text-amber-700">No payment proof</p>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isConfirming || Boolean(confirmingId)}
                          onClick={() => onConfirm?.(appt)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-teal px-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-brand-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isConfirming ? <span>Saving...</span> : <><Check size={13} strokeWidth={3} /> Confirm</>}
                        </button>
                        <button
                          type="button"
                          disabled={isConfirming || Boolean(confirmingId)}
                          onClick={() => onReject?.(appt)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-[11px] font-bold text-red-600 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X size={13} strokeWidth={3} /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <PaymentProofPreviewModal isOpen={Boolean(preview)} appointmentId={preview?.appointmentId} bookingId={preview?.bookingId} onClose={() => setPreview(null)} />
      </div>
    </div>,
    document.body,
  );
}
