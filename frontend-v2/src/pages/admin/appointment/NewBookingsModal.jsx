import { Check, FileText, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { formatHotelCheckInLabel, formatHotelCheckOutLabel } from '../../../utils/recordFormatters';
import PaymentProofPreviewModal from './PaymentProofPreviewModal';
import { getNewBookingPaymentInfo } from './newBookingPaymentInfo';

const SERVICE_TYPE_LABELS = {
  hotel: 'Hotel',
  grooming: 'Grooming',
  daycare: 'Daycare',
};

function Detail({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg bg-brand-surface/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">{label}</p>
      <p className="mt-0.5 break-words text-xs font-semibold text-brand-dark">{value || '—'}</p>
    </div>
  );
}

function getBookingDetails(appointment) {
  const raw = appointment?._raw || {};
  const category = String(
    raw?.service?.category || raw?.service_category || appointment?.serviceCategory || '',
  ).trim().toLowerCase();
  const serviceTypeLabel = SERVICE_TYPE_LABELS[category]
    || category.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    || 'Unknown';
  const appointmentDate = raw?.appointment_date || appointment?.dateIso || '';
  const appointmentTime = raw?.start_time || appointment?.time || '';
  const bookingId = raw?.appointment_code || appointment?.displayId || appointment?.id || '—';
  const owner = appointment?.owner
    || raw?.pet?.owner?.name
    || `${raw?.pet?.owner?.first_name || ''} ${raw?.pet?.owner?.last_name || ''}`.trim()
    || '—';
  const petName = appointment?.pet || raw?.pet?.name || '—';
  const serviceName = raw?.service?.name || raw?.service_name || appointment?.service || '—';
  const hotelSuite = raw?.hotel_suite?.name || raw?.hotelSuite?.name || raw?.suite?.name || '';
  const rawStatus = String(raw?.status || appointment?.status || '').trim();
  const status = rawStatus
    ? rawStatus.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : '—';
  const nights = Number(raw?.hotel_nights || 0);
  const hotelCheckIn = appointmentDate && appointmentTime
    ? formatHotelCheckInLabel({ appointmentDate, startTime: appointmentTime })
    : '—';
  const hotelCheckOut = appointmentDate && appointmentTime && nights > 0
    ? formatHotelCheckOutLabel({ appointmentDate, startTime: appointmentTime, hotelNights: nights })
    : '—';
  const daycareDuration = String(raw?.daycare_duration || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const petSize = raw?.pet_size || raw?.size_label || '';

  return {
    raw,
    category,
    serviceTypeLabel,
    bookingId,
    owner,
    petName,
    serviceName,
    hotelSuite,
    appointmentDate: appointment?.date || appointmentDate || '—',
    appointmentTime: appointment?.time || appointmentTime || '—',
    hotelCheckIn,
    hotelCheckOut,
    nights,
    daycareDuration,
    petSize,
    status,
  };
}

export default function NewBookingsModal({ isOpen, appointments = [], confirmingId, onClose, onConfirm, onReject, onViewDetails }) {
  const [preview, setPreview] = useState(null);
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-brand-dark/45 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between gap-3 bg-brand-teal px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white">NEW BOOKINGS</h3>
            <p className="mt-0.5 text-[11px] text-white/85">Bookings not yet approved — approve to notify the customer</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30" aria-label="Close new bookings">
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-brand-surface/50 p-3 sm:space-y-4 sm:p-5">
          {appointments.length === 0 ? (
            <p className="rounded-xl bg-white py-10 text-center text-sm font-semibold text-brand-dark-soft">No pending bookings at the moment.</p>
          ) : appointments.map((appointment) => {
            const details = getBookingDetails(appointment);
            const paymentInfo = getNewBookingPaymentInfo(details.raw);
            const isHotel = details.category === 'hotel';
            const isConfirming = confirmingId === appointment.id;
            const isBusy = Boolean(confirmingId);
            const appointmentDetails = [
              ['Pet Owner', details.owner],
              ['Pet Name', details.petName],
              ['Service', details.serviceName],
              ['Service Type', details.serviceTypeLabel],
              ...(isHotel
                ? [
                    ['Hotel Suite', details.hotelSuite || '—'],
                    ['Appointment Date', details.appointmentDate],
                    ['Appointment Time', details.appointmentTime],
                    ...(details.hotelCheckIn !== '—' ? [['Check-in', details.hotelCheckIn]] : []),
                    ...(details.hotelCheckOut !== '—' ? [['Check-out', details.hotelCheckOut]] : []),
                    ['Nights', details.nights || '—'],
                    ['Reservation Deposit', details.raw?.deposit === null || details.raw?.deposit === undefined || details.raw?.deposit === ''
                      ? '—'
                      : `PHP ${Number(details.raw.deposit).toFixed(2)}`],
                  ]
                : [
                    ['Appointment Date', details.appointmentDate],
                    ['Appointment Time', details.appointmentTime],
                    ...(details.petSize ? [['Pet Size', details.petSize]] : []),
                    ...(details.category === 'daycare' && details.daycareDuration
                      ? [['Daycare Duration', details.daycareDuration]]
                      : []),
                  ]),
              ['Booking Status', details.status],
            ];

            return (
              <article key={appointment.id} className="overflow-hidden rounded-xl border border-brand-teal/15 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-dark-light/70 px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="max-w-full break-words text-sm font-extrabold text-brand-dark">{details.serviceName}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Booking ID</span>
                    <span className="break-all font-mono text-xs font-bold text-brand-dark">{details.bookingId}</span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">{details.status}</span>
                    <span className="rounded-full bg-brand-teal-light/70 px-2.5 py-1 text-[10px] font-bold text-brand-teal-dark">{details.serviceTypeLabel}</span>
                  </div>
                  {onViewDetails && (
                    <button type="button" onClick={() => { onViewDetails(appointment); onClose?.(); }} className="min-h-9 rounded-lg px-2 text-xs font-bold text-brand-teal-dark underline-offset-2 hover:underline">
                      View full details
                    </button>
                  )}
                </div>

                <div className="p-4 sm:p-5">
                  <section aria-label="Appointment details">
                    <h4 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-dark-soft">Appointment Details</h4>
                    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                      {appointmentDetails.map(([label, value]) => (
                        <Detail key={label} label={label} value={value} />
                      ))}
                    </div>
                  </section>

                  {isHotel && (
                    <section aria-label="Hotel reservation payment details" className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal-light/20 p-3 sm:p-4">
                      <h4 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-teal-dark">Hotel Reservation Payment</h4>
                      <div className="space-y-2 text-xs">
                        <p className="break-words"><span className="font-bold text-brand-dark-soft">Payment From:</span> <span className="text-brand-dark">{paymentInfo.paymentFrom}</span></p>
                        <p className="break-words"><span className="font-bold text-brand-dark-soft">Payment To:</span> <span className="text-brand-dark">{paymentInfo.paymentTo}</span></p>
                        {paymentInfo.referenceNumber && (
                          <p className="break-all"><span className="font-bold text-brand-dark-soft">Reference Number:</span> <span className="font-mono text-brand-dark">{paymentInfo.referenceNumber}</span></p>
                        )}
                        {paymentInfo.hasProof && (
                          <div>
                            <p className="mb-1 font-bold text-brand-dark-soft">Uploaded Payment Proof</p>
                          <button
                            type="button"
                            onClick={() => setPreview({ appointmentId: appointment.id, bookingId: details.bookingId })}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-brand-teal/25 bg-white px-3 py-2 text-xs font-bold text-brand-teal-dark transition hover:border-brand-teal hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                          >
                            <FileText size={14} /> View Payment Proof
                          </button>
                          </div>
                        )}
                        {paymentInfo.showNoPaymentProof && (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-800">No payment proof</p>
                        )}
                      </div>
                    </section>
                  )}

                  <footer className="mt-4 flex flex-col-reverse gap-2 border-t border-brand-dark-light/70 pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onReject?.(appointment)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={14} strokeWidth={3} /> Reject
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onConfirm?.(appointment)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-teal px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isConfirming ? <span>Saving...</span> : <><Check size={14} strokeWidth={3} /> Confirm Booking</>}
                    </button>
                  </footer>
                </div>
              </article>
            );
          })}
        </div>

        <PaymentProofPreviewModal isOpen={Boolean(preview)} appointmentId={preview?.appointmentId} bookingId={preview?.bookingId} onClose={() => setPreview(null)} />
      </div>
    </div>,
    document.body,
  );
}
