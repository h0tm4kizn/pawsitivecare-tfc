import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import { apiGet, apiFetch } from '../../../../api/apiClient';
import { useStatus } from '@powersync/react';
import { db } from '../../../../utils/powersync/db';
import Loading from '../../../../components/Loading';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import { fetchPaymentAccounts } from '../../../../utils/paymentAccounts';
import {
  formatHotelCheckInLabel,
  formatHotelCheckOutLabel,
} from '../../../../utils/recordFormatters';
import {
  toIso,
  fmtDate,
  fmtTime,
  formatDateTime,
  withinCancelWindow,
  isPastAppointment,
  categoryTitle,
  isRejected,
  getRejectionReason,
  getCancellationTypeLabel,
  statusMeta,
} from './appointmentHelpers';
import { serviceIcon } from './appointmentIcons';
import {
  getAppointmentServiceCategory,
  getOrdinaryPaymentReference,
} from '../../../../utils/appointmentServiceType';

export default function AppointmentDetailModal({ isOpen, apt, onClose, onCancelled, onRescheduled }) {
  useBodyScrollLock(isOpen);
  const powersyncStatus = useStatus();
  const powersyncConnected = powersyncStatus?.connected ?? false;
  const [cancelling,       setCancelling]       = useState(false);
  const [cancelError,       setCancelError]       = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason,      setCancelReason]      = useState('');

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate]       = useState('');
  const [newTime, setNewTime]       = useState('');
  const [newCheckout, setNewCheckout] = useState('');
  const [newNights, setNewNights]   = useState('');
  const [slots, setSlots]           = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');

  // Hotel extension state
  const [showExtension, setShowExtension] = useState(false);
  const [extNights, setExtNights] = useState(1);
  const [extChecking, setExtChecking] = useState(false);
  const [extAvailable, setExtAvailable] = useState(null);
  const [extSaving, setExtSaving] = useState(false);
  const [extError, setExtError] = useState('');

  // Hotel calendar state
  const [hotelMonth,          setHotelMonth]          = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [hotelUnavailable,    setHotelUnavailable]    = useState(new Set());
  const [hotelClosed,         setHotelClosed]         = useState(new Set());
  const [hotelCapacityByDate, setHotelCapacityByDate] = useState({});
  const [hotelCalLoading,     setHotelCalLoading]     = useState(false);
  const [paymentAccounts,     setPaymentAccounts]     = useState([]);

  const TODAY_ISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen || !apt?.reservation_payment_account_id) return;
    fetchPaymentAccounts()
      .then(setPaymentAccounts)
      .catch(() => setPaymentAccounts([]));
  }, [isOpen, apt?.reservation_payment_account_id]);

  useEffect(() => {
    if (!isOpen) {
      setShowReschedule(false); setCancelError(''); setSaveError('');
      setNewDate(''); setNewTime(''); setNewCheckout(''); setNewNights('');
      setHotelUnavailable(new Set()); setHotelClosed(new Set());
      setHotelCapacityByDate({});
      setShowCancelConfirm(false); setCancelReason('');
      setShowExtension(false); setExtNights(1); setExtAvailable(null); setExtError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!newDate || !apt?.service?.id || apt?.hotel_nights) { setSlots([]); return; }
    setSlotsLoading(true);
    apiGet(`/api/appointments/available-slots?date=${newDate}&service_id=${apt.service.id}`)
      .then((r) => r.ok ? r.json() : { data: { slots: [] } })
      .then((d) => setSlots(d?.data?.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [newDate, apt?.service?.id, apt?.hotel_nights]);

  // Fetch hotel calendar availability when reschedule opens for a hotel appointment
  useEffect(() => {
    if (!isOpen || !showReschedule || !apt?.hotel_nights || !apt?.hotel_suite?.id) return;
    const monthKey = `${hotelMonth.getFullYear()}-${String(hotelMonth.getMonth() + 1).padStart(2, '0')}`;
    setHotelCalLoading(true);
    apiGet(`/api/appointments/hotel-calendar?service_id=${apt.service.id}&month=${monthKey}&suite_id=${apt.hotel_suite?.id || ''}&exclude_appointment_id=${apt.id}&pet_id=${apt.pet?.id || ''}`)
      .then((r) => r.ok ? r.json() : { data: { dates: [] } })
      .then((d) => {
        const rows = Array.isArray(d?.data?.dates) ? d.data.dates : [];
        setHotelClosed(new Set(rows.filter((r) => r.status === 'closed').map((r) => r.date)));
        setHotelUnavailable(new Set(rows.filter((r) => ['full', 'unavailable', 'taken'].includes(r.status)).map((r) => r.date)));
        setHotelCapacityByDate(Object.fromEntries(rows.filter((r) => r.capacity !== undefined).map((r) => [r.date, r])));
      })
      .catch(() => {})
      .finally(() => setHotelCalLoading(false));
  }, [isOpen, showReschedule, apt?.hotel_nights, apt?.service?.id, apt?.hotel_suite?.id, apt?.pet?.id, apt?.id, hotelMonth]);

  if (!isOpen || !apt) return null;

  const serviceCategory = getAppointmentServiceCategory(apt);
  const isHotel = serviceCategory === 'hotel';
  const paymentAccountId = apt.reservation_payment_account_id || apt.payment?.payment_account_id || '';
  const selectedReceivingAccount = paymentAccounts.find((account) => String(account.id) === String(paymentAccountId));
  const paymentMode = apt.reservation_channel === 'e_wallet'
    ? 'E-Wallet'
    : apt.reservation_channel === 'bank_transfer'
      ? 'Bank Transfer'
      : apt.reservation_channel || '—';
  const canCancel  = String(apt.status || '').toLowerCase() === 'pending'
    || (String(apt.status || '').toLowerCase() === 'approved' && !isPastAppointment(apt));
  const { label: statusLabel } = statusMeta(apt);

  const isGrooming = serviceCategory === 'grooming';
  const isDaycare  = serviceCategory === 'daycare';
  const ordinaryPaymentReference = getOrdinaryPaymentReference(apt);
  const isUpcoming = !isPastAppointment(apt) && apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'no_show';

  // Recommended arrival = appointment time minus 30 minutes for travel
  const arrivalTime = (() => {
    if (!apt.start_time || !isUpcoming || (!isGrooming && !isDaycare)) return null;
    const [h, m] = String(apt.start_time).split(':').map(Number);
    const totalMins = h * 60 + m - 30;
    if (totalMins < 0) return null;
    const ah = Math.floor(totalMins / 60);
    const am = totalMins % 60;
    const period = ah >= 12 ? 'PM' : 'AM';
    const displayH = ah % 12 || 12;
    return `${displayH}:${String(am).padStart(2, '0')} ${period}`;
  })();

  const checkoutDate = apt.hotel_nights
    ? (() => {
        const [y, m, d] = String(apt.appointment_date).slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d + apt.hotel_nights)
          .toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' });
      })()
    : null;
  const hotelCheckInDateTime = isHotel
    ? formatHotelCheckInLabel({
        appointmentDate: apt.appointment_date,
        startTime: apt.start_time,
        createdAt: apt.created_at,
      })
    : null;
  const hotelCheckOutDateTime = isHotel && apt.hotel_nights
    ? formatHotelCheckOutLabel({
        appointmentDate: apt.appointment_date,
        startTime: apt.start_time,
        createdAt: apt.created_at,
        hotelNights: apt.hotel_nights,
      })
    : null;
  const actualCheckOutDisplay = isHotel ? formatDateTime(apt.actual_check_out_at) : null;
  const checkoutDiffMinutes = isHotel ? Number(apt.checkout_time_difference_minutes || 0) : 0;
  const isLateCheckout = isHotel && checkoutDiffMinutes > 0;
  const actualCheckInDisplay = isHotel ? formatDateTime(apt.actual_check_in_at) : null;
  const checkinDiffMinutes = isHotel ? Number(apt.checkin_time_difference_minutes || 0) : 0;
  const isLateCheckin = isHotel && checkinDiffMinutes > 0;

  const openReschedule = () => {
    const scheduledDate = String(apt.appointment_date || '').slice(0, 10);
    setSaveError('');
    setCancelError('');
    setNewTime('');
    setNewDate(scheduledDate);

    const [year, month, day] = scheduledDate.split('-').map(Number);
    if (year && month && day) {
      setHotelMonth(new Date(year, month - 1, 1));
    }

    if (isHotel && year && month && day) {
      const nights = Math.max(1, Number(apt.hotel_nights || 1));
      const checkout = new Date(year, month - 1, day);
      checkout.setDate(checkout.getDate() + nights);
      setNewCheckout(toIso(checkout));
      setNewNights(String(nights));
    } else {
      setNewCheckout('');
      setNewNights('');
    }

    setShowReschedule(true);
  };

  const handleCancel = async () => {
    setCancelling(true); setCancelError('');
    try {
      if (!navigator.onLine || !powersyncConnected) {
        await db.execute(
          `UPDATE appointments
           SET status = ?, cancellation_reason = ?, cancelled_at = ?, cancellation_type = ?, updated_at = ?
           WHERE id = ?`,
          ['cancelled', cancelReason.trim() || null, new Date().toISOString(), withinCancelWindow(apt) ? 'normal' : 'late', new Date().toISOString(), apt.id]
        );
      } else {
        const res = await apiFetch(`/api/my-appointments/${apt.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellation_reason: cancelReason.trim() || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to cancel.');
      }
      onCancelled?.();
      onClose();
    } catch (err) {
      setCancelError(err.message || 'Could not cancel.');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async () => {
    if (isHotel) {
      if (!newDate || !newCheckout || !newNights) { setSaveError('Please select a check-in and check-out date.'); return; }
    } else {
      if (!newDate || !newTime) { setSaveError('Please select a date and time.'); return; }
    }
    setSaving(true); setSaveError('');
    try {
      const body = isHotel
        ? { appointment_date: newDate, start_time: apt.start_time, hotel_nights: parseInt(newNights) }
        : { appointment_date: newDate, start_time: newTime };
      if (!navigator.onLine) {
        const isApprovedReschedule = String(apt.status || '').toLowerCase() === 'approved';
        const rescheduleNote = isApprovedReschedule
          ? `${String(apt.notes || '').trim()}\n[Reschedule Request] New schedule: ${body.appointment_date} at ${String(body.start_time || '').slice(0, 5)}.`.trim()
          : (apt.notes ?? null);
        await db.execute(
          `UPDATE appointments
           SET appointment_date = ?, start_time = ?, hotel_nights = ?, status = ?, notes = ?, updated_at = ?
           WHERE id = ?`,
          [
            body.appointment_date,
            body.start_time,
            body.hotel_nights ?? apt.hotel_nights ?? null,
            isApprovedReschedule ? 'pending' : apt.status,
            rescheduleNote,
            new Date().toISOString(),
            apt.id,
          ]
        );
      } else {
        const res  = await apiFetch(`/api/my-appointments/${apt.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to reschedule.');
      }
      onRescheduled?.(body.appointment_date);
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Could not reschedule.');
    } finally {
      setSaving(false);
    }
  };

  const fmt12 = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100dvh] w-screen items-end justify-center bg-brand-dark/45 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white font-poppins shadow-2xl sm:max-h-[85vh] sm:max-w-[560px] sm:rounded-3xl lg:max-w-[620px]" onClick={(e) => e.stopPropagation()}>

        {/* Header — The Fur Club branding */}
        <div className="relative flex flex-col items-center px-6 pt-6 pb-4 shrink-0 bg-white">
          <button type="button" onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <i className="fa-solid fa-paw text-teal-500 text-base" />
            <h2 className="text-base font-black text-gray-800 uppercase tracking-tight">THE FUR CLUB</h2>
          </div>
          <p className="text-xs text-teal-500 font-medium">Pet Station • San Juan City</p>
        </div>

        {/* Scrollable body */}
        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto bg-white px-6 py-4">

          {/* Booking ID */}
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1">BOOKING ID</p>
            <p className="text-base font-black text-gray-900">{apt.appointment_code || '—'}</p>
          </div>

          {/* Dashed divider */}
          <div className="border-t border-dashed border-brand-dark-light" />

          {/* Status badge - slightly rotated */}
          <div className="flex justify-center">
            <div className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 ${
              apt.status === 'pending' ? 'border-red-400 bg-white' :
              apt.status === 'approved' ? 'border-blue-400 bg-white' :
              apt.status === 'in_progress' ? 'border-amber-400 bg-white' :
              apt.status === 'completed' ? 'border-emerald-400 bg-white' :
              'border-gray-400 bg-white'
            }`}
            >
              <i className={`fa-solid text-base ${
                apt.status === 'pending' ? 'fa-xmark text-red-500' :
                apt.status === 'approved' ? 'fa-circle-check text-blue-500' :
                apt.status === 'in_progress' ? 'fa-clock text-amber-500' :
                apt.status === 'completed' ? 'fa-circle-check text-emerald-500' :
                'fa-circle-xmark text-gray-500'
              }`} />
              <span className={`text-base font-black uppercase tracking-tight ${
                apt.status === 'pending' ? 'text-red-500' :
                apt.status === 'approved' ? 'text-blue-500' :
                apt.status === 'in_progress' ? 'text-amber-500' :
                apt.status === 'completed' ? 'text-emerald-500' :
                'text-gray-500'
              }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Dashed divider */}
          <div className="border-t border-dashed border-brand-dark-light" />

          {/* SERVICE DETAILS */}
          <div className="rounded-xl border border-brand-dark-light bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-3">SERVICE DETAILS</p>

            {/* Service + Pet */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                isHotel ? 'bg-pink-100 text-pink-600' :
                isDaycare ? 'bg-amber-100 text-amber-600' :
                'bg-purple-100 text-purple-600'
              }`}>
                {serviceIcon(apt.service?.category)}
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-gray-900 leading-tight">{categoryTitle(apt)}</p>
                <p className="text-sm text-gray-900 mt-0.5">Pet: <span className="font-bold">{apt.pet?.name || '—'}</span></p>
              </div>
            </div>

            {/* Info rows */}
            <div className="space-y-2.5">
              {[
                { label: isHotel ? 'Check-in' : 'Date', value: isHotel ? hotelCheckInDateTime : fmtDate(apt.appointment_date) },
                ...(checkoutDate ? [
                  { label: 'Actual Check-In Time', value: actualCheckInDisplay || '—' },
                  { label: 'Check-In Status', value: actualCheckInDisplay ? (isLateCheckin ? 'Late Check-In' : 'Arrived On Time') : '—' },
                  { label: 'Scheduled Check-Out', value: hotelCheckOutDateTime || checkoutDate },
                  { label: 'Actual Check-Out Time', value: actualCheckOutDisplay || '—' },
                  { label: 'Late Check-Out Indicator', value: actualCheckOutDisplay ? (isLateCheckout ? 'Late Check-Out' : 'On Time') : '—' },
                  { label: 'Nights', value: `${apt.hotel_nights} night${apt.hotel_nights !== 1 ? 's' : ''}` },
                ] : []),
                ...(!isHotel && apt.start_time ? [{ label: 'Time', value: fmtTime(apt.start_time) }] : []),
                ...(isHotel && apt.hotel_suite?.name ? [{ label: 'Suite', value: apt.hotel_suite.name }] : []),
                ...(isHotel ? [{ label: 'Pet Size', value: apt.pet_size || 'Not recorded' }] : []),
                ...(!isHotel ? (() => {
                  const rawSize = apt.size_label || '';
                  const SIZE_MAP = { small: 'S', medium: 'M', large: 'L', xlarge: 'XL', xsmall: 'XS' };
                  let packageName = apt.service?.name || '';
                  let sizeKey = rawSize.toLowerCase();
                  if (sizeKey.startsWith('half_day_'))       { packageName = 'Half Day Package'; sizeKey = sizeKey.replace('half_day_', ''); }
                  else if (sizeKey.startsWith('full_day_'))  { packageName = 'Full Day Package'; sizeKey = sizeKey.replace('full_day_', ''); }
                  else if (sizeKey.startsWith('hourly_'))    { packageName = 'Daycare Package';  sizeKey = sizeKey.replace('hourly_', ''); }
                  const sizeAbbr = SIZE_MAP[sizeKey] || rawSize;
                  const display = packageName && sizeAbbr ? `${packageName} (${sizeAbbr})` : packageName || sizeAbbr || null;
                  return display ? [{ label: 'Package', value: display }] : [];
                })() : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{label}</span>
                  <span className="text-sm font-bold text-gray-900 text-right">{value}</span>
                </div>
              ))}
              {isLateCheckout && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Notice: This hotel appointment exceeded the scheduled check-out time by {Math.floor(checkoutDiffMinutes / 60)} hour(s) and {checkoutDiffMinutes % 60} minute(s).
                </div>
              )}
              {isLateCheckin && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Notice: This hotel appointment checked in later than the scheduled arrival time by {Math.floor(checkinDiffMinutes / 60)} hour(s) and {checkinDiffMinutes % 60} minute(s).
                </div>
              )}
              {isHotel && (
                <p className="text-[11px] text-brand-dark-soft">The checkout time is shown for the appointment booking reference. Final checkout settlement is handled at the front desk.</p>
              )}
            </div>
          </div>

          {isHotel && paymentAccountId && (
            <div className="rounded-xl border border-brand-dark-light bg-white px-5 py-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">PAYMENT DETAILS</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">PAYMENT FROM</p>
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-600">Method</span><span className="font-bold text-gray-900">{paymentMode}</span></div>
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-600">Provider</span><span className="font-bold text-gray-900">{apt.reservation_payer_provider || '—'}</span></div>
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-600">Reference</span><span className="font-bold text-gray-900">{apt.reference_number || '—'}</span></div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">PAYMENT TO</p>
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-600">Provider</span><span className="font-bold text-gray-900">{selectedReceivingAccount?.label || '—'}</span></div>
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-600">Account Name</span><span className="font-bold text-gray-900">{selectedReceivingAccount?.account_name || '—'}</span></div>
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-600">Account Number</span><span className="font-bold text-gray-900">{selectedReceivingAccount?.account_number || '—'}</span></div>
                </div>
              </div>
            </div>
          )}

          {!isHotel && ordinaryPaymentReference && (
            <div className="rounded-xl border border-brand-dark-light bg-white px-5 py-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">PAYMENT DETAILS</p>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-600">Payment Reference</span>
                <span className="font-bold text-gray-900">{ordinaryPaymentReference}</span>
              </div>
            </div>
          )}

          {/* Estimated Charges Summary */}
          {(() => {
            const addons = Array.isArray(apt.appointmentAddons) ? apt.appointmentAddons : [];
            const basePrice = Number(apt.total_price || 0);
            const addonsTotal = addons.reduce((s, a) => s + Number(a.price_charged || 0), 0);
            const grandTotal = basePrice + addonsTotal;
            const depositPaid = isHotel ? Math.max(Number(apt.deposit || 0), 0) : 0;
            const remainingBalance = Math.max(grandTotal - depositPaid, 0);

            if (grandTotal === 0 || apt.status === 'cancelled') return null;

            return (
              <div className="rounded-xl border border-brand-dark-light bg-white px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-3">PAYMENT SUMMARY</p>

                <div className="space-y-2">
                  {/* Base Price */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Service Fee</span>
                    <span className="text-sm font-bold text-gray-900">PHP {basePrice.toFixed(2)}</span>
                  </div>

                  {/* Add-ons */}
                  {addons.length > 0 && addons.map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">{addon.serviceAddon?.name || 'Add-on'}</span>
                      <span className="text-sm font-bold text-gray-900">PHP {Number(addon.price_charged || 0).toFixed(2)}</span>
                    </div>
                  ))}

                  {/* Divider */}
                  <div className="border-t border-dashed border-brand-dark-light my-2" />

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-gray-900">Total Amount</span>
                    <span className="text-base font-black text-teal-600">PHP {grandTotal.toFixed(2)}</span>
                  </div>

                  {isHotel && <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Reservation Deposit (DP)</span>
                    <span className="text-sm font-bold text-gray-900">PHP {depositPaid.toFixed(2)}</span>
                  </div>}

                  <div className="flex items-center justify-between border-t border-dashed border-brand-dark-light pt-2">
                    <span className="text-base font-black text-gray-900">Remaining Balance</span>
                    <span className="text-base font-black text-teal-600">PHP {remainingBalance.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Cancellation/Rejection reason — only show in body if canCancel is true (footer won't show it) */}
          {apt.status === 'cancelled' && apt.cancellation_reason && canCancel && (
            <div className="rounded-xl bg-red-50 border-2 border-red-200 px-4 py-3">
              <p className="text-xs text-red-600"><span className="font-bold">Reason: </span>{getRejectionReason(apt)}</p>
            </div>
          )}

          {/* Arrival notice */}
          {isUpcoming && (isGrooming || isDaycare) && arrivalTime && (
            <div className="rounded-xl bg-brand-teal/5 border border-brand-teal/20 px-4 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-clock text-brand-teal text-xs" />
                <p className="text-xs font-bold text-brand-teal">Recommended Arrival: {arrivalTime}</p>
              </div>
              {isGrooming && (
                <p className="text-[11px] text-brand-dark-soft">
                  <i className="fa-solid fa-circle-info mr-1" />15-min grace period applies.
                </p>
              )}
            </div>
          )}

          {cancelError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{cancelError}</p>}

          {/* Reschedule form */}
          {showReschedule && (
            <div className="rounded-xl border border-brand-dark-light p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Reschedule</p>
              {saveError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>}

              {isHotel ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setHotelMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                      className="rounded-lg border border-brand-dark-light px-2 py-1 text-xs text-brand-dark hover:border-brand-teal/50">Prev</button>
                    <p className="text-xs font-bold text-brand-dark">
                      {hotelMonth.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', year: 'numeric' })}
                    </p>
                    <button type="button" onClick={() => setHotelMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                      className="rounded-lg border border-brand-dark-light px-2 py-1 text-xs text-brand-dark hover:border-brand-teal/50">Next</button>
                  </div>
                  {hotelCalLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loading message="Loading availability..." textClassName="text-brand-dark-soft" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-7 gap-1 text-[10px] text-brand-dark-soft mb-1">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                          <div key={d} className="text-center font-semibold">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: new Date(hotelMonth.getFullYear(), hotelMonth.getMonth(), 1).getDay() }).map((_, i) => (
                          <div key={`b-${i}`} className="h-8" />
                        ))}
                        {Array.from({ length: new Date(hotelMonth.getFullYear(), hotelMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                          const day     = i + 1;
                          const dateStr = `${hotelMonth.getFullYear()}-${String(hotelMonth.getMonth() + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const isPast    = dateStr < TODAY_ISO;
                          const isClosed  = hotelClosed.has(dateStr);
                          const isBlocked = hotelUnavailable.has(dateStr);
                          const capacity = hotelCapacityByDate?.[dateStr];
                          const isFull = isBlocked && Number(capacity?.available) <= 0;
                          const isUnavailable = isBlocked && !isFull;
                          const isCheckIn  = newDate === dateStr;
                          const isCheckOut = newCheckout === dateStr;
                          const inRange    = !!(newDate && newCheckout && dateStr > newDate && dateStr < newCheckout);
                          const selectable = !isPast && !isClosed && !isBlocked;
                          return (
                            <button key={dateStr} type="button" disabled={!selectable}
                              onClick={() => {
                                if (!newDate || newCheckout) { setNewDate(dateStr); setNewCheckout(''); setNewNights(''); return; }
                                const a = new Date(`${newDate}T00:00:00`);
                                const b = new Date(`${dateStr}T00:00:00`);
                                const checkIn  = a < b ? newDate : dateStr;
                                const checkOut = a < b ? dateStr : newDate;
                                const nights   = Math.round((new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`)) / 86400000);
                                if (nights < 1 || nights > 5) { setNewDate(dateStr); setNewCheckout(''); setNewNights(''); return; }
                                let blocked = false;
                                for (let i = 0; i < nights; i++) {
                                  const nd = new Date(`${checkIn}T00:00:00`);
                                  nd.setDate(nd.getDate() + i);
                                  const ds = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`;
                                  if (hotelUnavailable.has(ds) || hotelClosed.has(ds)) { blocked = true; break; }
                                }
                                if (blocked) { setSaveError('Selected range includes a closed or unavailable date.'); return; }
                                setSaveError('');
                                setNewDate(checkIn); setNewCheckout(checkOut); setNewNights(String(nights));
                              }}
                              className={`h-8 rounded-md text-xs font-semibold transition-colors ${
                                isCheckIn || isCheckOut ? 'bg-brand-teal text-white'
                                : inRange   ? 'bg-brand-teal-light text-brand-dark'
                                : isPast    ? 'text-gray-400 cursor-not-allowed'
                                : isClosed  ? 'text-red-400 cursor-not-allowed'
                                : isFull ? 'bg-red-100 text-red-500 cursor-not-allowed'
                                : isUnavailable ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'text-brand-dark hover:bg-brand-teal-light'
                              }`}
                              title={isClosed ? 'Shop is closed' : isFull ? 'Full' : isUnavailable ? 'Unavailable' : capacity ? `${capacity.available} of ${capacity.capacity} shared cluster units available` : undefined}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-brand-dark-soft">
                        <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-red-300" />Closed</div>
                        <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-100" />Full</div>
                        <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-100" />Unavailable</div>
                        <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-brand-teal-light" />Available</div>
                      </div>
                    </>
                  )}
                  {newDate && !newCheckout && (
                    <div className="rounded-lg border border-brand-teal/20 bg-brand-teal/5 px-3 py-2 text-xs text-brand-dark-soft">
                      <p>Check-in: <span className="font-semibold text-brand-dark">{newDate}</span>. Pick check-out (max 5 nights).</p>
                      <p className="mt-1">
                        <span className="font-semibold text-brand-dark">Extension Policy:</span> Hotel bookings are charged per night. If the actual check-out exceeds the scheduled check-out time, an additional hourly fee will apply based on your pet&apos;s size and the corresponding Daycare hourly rate. Any extra time is rounded up to the next full hour. During extended hours, pets may be transferred to an available suite depending on room availability and operations.
                      </p>
                    </div>
                  )}
                  {newDate && newCheckout && (
                    <div className="rounded-lg bg-brand-surface border border-brand-dark-light px-3 py-2 text-xs space-y-0.5">
                      <p>Check-in: <span className="font-semibold">{newDate}</span></p>
                      <p>Check-out: <span className="font-semibold">{newCheckout}</span></p>
                      <p>Nights: <span className="font-semibold">{newNights}</span></p>
                      <p className="pt-1 text-brand-dark-soft leading-relaxed">
                        <span className="font-semibold text-brand-dark">Extension Policy:</span> Hotel bookings are charged per night. If the actual check-out exceeds the scheduled check-out time, an additional hourly fee will apply based on your pet&apos;s size and the corresponding Daycare hourly rate. Any extra time is rounded up to the next full hour. During extended hours, pets may be transferred to an available suite depending on room availability and operations.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <input type="date" min={TODAY_ISO} value={newDate}
                    onChange={(e) => { setNewDate(e.target.value); setNewTime(''); }}
                    className="w-full rounded-lg border border-brand-dark-light px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  {newDate && (
                    <SelectDropdown
                      value={newTime}
                      onChange={(v) => setNewTime(v)}
                      options={[{ value: '', label: slotsLoading ? 'Loading slots…' : slots.length === 0 ? 'No slots available' : 'Select time' }, ...slots.map((s) => ({ value: s, label: fmt12(s) }))]}
                      placeholder={slotsLoading ? 'Loading slots…' : 'Select time'}
                      disabled={slotsLoading}
                    />
                  )}
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowReschedule(false); setSaveError(''); setNewDate(''); setNewTime(''); setNewCheckout(''); setNewNights(''); }}
                  className="flex-1 rounded-xl border border-brand-dark-light py-2.5 text-xs font-semibold text-brand-dark hover:bg-brand-surface transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleReschedule} disabled={saving}
                  className="flex-1 rounded-xl bg-brand-teal py-2.5 text-xs font-bold text-white hover:brightness-95 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showReschedule && (
          <div className="shrink-0 px-6 py-4 flex flex-col gap-3 bg-white">
            {/* Hotel Extension - only for in_progress hotel appointments */}
            {isHotel && apt.status === 'in_progress' && !showCancelConfirm && (
              showExtension ? (
                <div className="w-full space-y-3 rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-teal">Request Extension</p>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-brand-dark">Extra nights:</label>
                    <SelectDropdown
                      value={extNights}
                      onChange={(value) => { setExtNights(Number(value)); setExtAvailable(null); setExtError(''); }}
                      options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} night${n > 1 ? 's' : ''}` }))}
                      className="w-36"
                      buttonClassName="!rounded-lg !py-1.5"
                    />
                    <button type="button" disabled={extChecking}
                      onClick={async () => {
                        setExtChecking(true); setExtError(''); setExtAvailable(null);
                        try {
                          const currentNights = apt.hotel_nights || 1;
                          const checkIn = apt.appointment_date;
                          const totalNights = currentNights + extNights;
                          const newCheckoutDate = new Date(new Date(`${String(checkIn).slice(0,10)}T00:00:00`).getTime() + totalNights * 86400000);
                          const monthKey = `${newCheckoutDate.getFullYear()}-${String(newCheckoutDate.getMonth() + 1).padStart(2, '0')}`;
                          const res = await apiGet(`/api/appointments/hotel-calendar?service_id=${apt.service.id}&month=${monthKey}&suite_id=${apt.hotel_suite?.id || ''}&exclude_appointment_id=${apt.id}&pet_id=${apt.pet?.id || ''}`);
                          const d = res.ok ? await res.json() : { data: { dates: [] } };
                          const rows = Array.isArray(d?.data?.dates) ? d.data.dates : [];
                          const takenDates = new Set(rows.filter((r) => ['full', 'unavailable', 'taken', 'closed'].includes(r.status)).map((r) => r.date));
                          let blocked = false;
                          for (let i = currentNights; i < totalNights; i++) {
                            const nd = new Date(new Date(`${String(checkIn).slice(0,10)}T00:00:00`).getTime() + i * 86400000);
                            const ds = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-${String(nd.getDate()).padStart(2,'0')}`;
                            if (takenDates.has(ds)) { blocked = true; break; }
                          }
                          setExtAvailable(!blocked);
                          if (blocked) setExtError('Suite is not available for the requested extension dates.');
                        } catch { setExtError('Could not check availability.'); }
                        finally { setExtChecking(false); }
                      }}
                      className="rounded-lg bg-brand-teal px-3 py-1.5 text-[11px] font-bold text-white hover:brightness-95 disabled:opacity-60">
                      {extChecking ? 'Checking…' : 'Check'}
                    </button>
                  </div>
                  {extAvailable === true && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 font-semibold">
                      Suite is available for {extNights} extra night{extNights > 1 ? 's' : ''}.
                    </div>
                  )}
                  {extError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{extError}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowExtension(false); setExtAvailable(null); setExtError(''); }}
                      className="flex-1 rounded-xl border border-brand-dark-light py-2.5 text-xs font-semibold text-brand-dark hover:bg-brand-surface transition-colors">
                      Cancel
                    </button>
                    <button type="button" disabled={!extAvailable || extSaving}
                      onClick={async () => {
                        setExtSaving(true); setExtError('');
                        try {
                          const newTotal = (apt.hotel_nights || 1) + extNights;
                          const res = await apiFetch(`/api/my-appointments/${apt.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ hotel_nights: newTotal }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(data?.message || 'Failed to extend.');
                          onRescheduled?.();
                          onClose();
                        } catch (err) { setExtError(err.message || 'Could not extend.'); }
                        finally { setExtSaving(false); }
                      }}
                      className="flex-1 rounded-xl bg-brand-teal py-2.5 text-xs font-bold text-white hover:brightness-95 disabled:opacity-60 transition-colors">
                      {extSaving ? 'Extending…' : 'Confirm Extension'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowExtension(true)}
                  className="w-full rounded-xl border-2 border-brand-teal py-3 text-sm font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                  <i className="fa-solid fa-calendar-plus mr-2" />Request Extension
                </button>
              )
            )}

            {canCancel && !isRejected(apt) && !showCancelConfirm && (
              <>
                <button type="button" onClick={openReschedule}
                  className="flex-1 rounded-xl border-2 border-gray-300 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                  Reschedule
                </button>
                <button type="button" onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 transition-colors">
                  Cancel Booking
                </button>
              </>
            )}
            {canCancel && showCancelConfirm && (
              <div className="w-full space-y-2">
                <p className="text-xs font-semibold text-brand-dark">Cancel this appointment?</p>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (optional)" rows={2}
                  className="w-full resize-none rounded-xl border border-brand-dark-light px-3 py-2 text-xs text-brand-dark focus:border-red-400 focus:outline-none" />
                {cancelError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{cancelError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowCancelConfirm(false); setCancelReason(''); setCancelError(''); }}
                    className="flex-1 rounded-xl border border-brand-dark-light py-2.5 text-xs font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors">
                    Go Back
                  </button>
                  <button type="button" onClick={handleCancel} disabled={cancelling}
                    className="flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white hover:brightness-95 disabled:opacity-60 transition-colors">
                    {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
                  </button>
                </div>
              </div>
            )}
            {!canCancel && (
              apt.status === 'cancelled' && apt.cancellation_reason ? (
                <div className="w-full rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-xs font-bold text-red-600 mb-0.5">{isRejected(apt) ? 'Booking Rejected' : (getCancellationTypeLabel(apt) || 'Booking Cancelled')}</p>
                  <p className="text-xs text-red-500">{getRejectionReason(apt)}</p>
                </div>
              ) : (
                <p className="w-full text-center text-xs text-brand-dark-soft py-1">This appointment can no longer be modified.</p>
              )
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
