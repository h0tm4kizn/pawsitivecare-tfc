import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiFetch, apiGet } from '../../../api/apiClient';
import { toIso, diffDays, addDays, normalizeDate } from './appointmentUtils';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import DateDropdown from '../../../components/reusable-ui/DateDropdown';
import ConfirmActionModal from '../../../components/reusable-ui/ConfirmActionModal';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { CANCELLATION_REASON_OPTIONS } from './appointmentConstants';
import SimpleField from './AppointmentInfoField';
import HotelCheckoutConfirmation from './HotelCheckoutConfirmation';
import HotelCheckInTimePicker from './components/HotelCheckInTimePicker';
import { hotelCheckInTimeError } from '../../../utils/hotelCheckInTime';
import {
  ADDON_SIZE_SUFFIX,
  LATE_CHECKIN_REASON_OPTIONS,
  LATE_CHECKOUT_REASON_OPTIONS,
  MAX_PAWSOME_EXTRAS,
  addonBaseName,
  addonTier,
  fmtShortDate,
  formatCurrency,
  getAppointmentAddons,
  hotelRangeHasBlockedDate,
  isDaycareCategory,
  isGroomingCategory,
  parseDaycareTier,
  toTierLabel,
} from './appointmentEditHelpers';

export default function EditModal({ isOpen, appointment, onClose, onSaved, onNotify, readOnly = false }) {
  useBodyScrollLock(isOpen && Boolean(appointment));
  const [services, setServices] = useState([]);
  const [hotelSuites, setHotelSuites] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [petSizeLabel, setPetSizeLabel] = useState('');
  const [daycareDuration, setDaycareDuration] = useState('');
  const [hotelSuiteId, setHotelSuiteId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [hotelCheckInInput, setHotelCheckInInput] = useState(null);
  const [hotelOperatingHours, setHotelOperatingHours] = useState(null);
  const timeRef = useRef(time);
  useEffect(() => {
    timeRef.current = time;
  }, [time]);
  const [status, setStatus] = useState('');
  const [groomers, setGroomers] = useState([]);
  const [groomerId, setGroomerId] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationReasonChoice, setCancellationReasonChoice] = useState('');
  const [cancellationOtherReason, setCancellationOtherReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingHotelCheckout, setPendingHotelCheckout] = useState('');
  const [error, setError] = useState('');
  const [loadErrors, setLoadErrors] = useState({});
  const [loadingReferenceData, setLoadingReferenceData] = useState({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [availableAddons, setAvailableAddons] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [addonLoadError, setAddonLoadError] = useState('');
  const [openSizedExtra, setOpenSizedExtra] = useState('');

  // Hotel calendar state
  const [hotelCheckout,         setHotelCheckout]         = useState('');
  const [hotelNights,           setHotelNights]           = useState('');
  const [hotelMonth,            setHotelMonth]            = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [hotelUnavailableDates, setHotelUnavailableDates] = useState(new Set());
  const [hotelClosedDates,      setHotelClosedDates]      = useState(new Set());
  const [hotelCapacityByDate, setHotelCapacityByDate] = useState({});
  const [hotelCalendarLoading,  setHotelCalendarLoading]  = useState(false);

  // Hotel reservation reference fields
  const [deposit, setDeposit] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [actualCheckInAt, setActualCheckInAt] = useState('');
  const [actualCheckOutAt, setActualCheckOutAt] = useState('');
  const [lateCheckoutNotes, setLateCheckoutNotes] = useState('');
  const [lateCheckoutReason, setLateCheckoutReason] = useState('');
  const [lateCheckoutOtherReason, setLateCheckoutOtherReason] = useState('');
  const [lateCheckoutStaffNotes, setLateCheckoutStaffNotes] = useState('');
  const [lateCheckinReason, setLateCheckinReason] = useState('');
  const [lateCheckinOtherReason, setLateCheckinOtherReason] = useState('');

  const todayIso = toIso(new Date());

  useEffect(() => {
    if (!isOpen || !appointment) return;
    const raw = appointment._raw || {};
    const initialServiceId = String(raw.service_id || raw.service?.id || '');
    const initialCategory = raw.service?.category || raw.service_category || appointment.serviceCategory || appointment.serviceType || '';
    const initialHotelSuiteId = String(raw.hotel_suite_id || raw.hotel_suite?.id || raw.hotelSuite?.id || '');
    const initialDateIso = normalizeDate(raw.appointment_date || appointment.dateIso || '');
    const initialNights = raw.hotel_nights ? String(raw.hotel_nights) : '';
    const initialHotelCheckout = initialDateIso && initialNights
      ? addDays(initialDateIso, Number(initialNights))
      : normalizeDate(raw.check_out_time || raw.hotel_checkout || '');

    setServiceCategory(initialCategory);
    setServiceId(raw.service_id || raw.service?.id || '');
    setSizeLabel(raw.size_label || '');
    setPetSizeLabel(raw.pet_size || '');
    setDaycareDuration(raw.daycare_duration || '');
    setHotelSuiteId(initialHotelSuiteId);
    setDate(initialDateIso);
    const initialTime = raw.start_time && String(raw.start_time).slice(0, 5) !== '00:00' ? String(raw.start_time).slice(0, 5) : '';
    setTime(initialTime);
    setHotelCheckInInput(null);
    setHotelOperatingHours(null);
    setStatus(appointment.status || 'approved');
    setPendingHotelCheckout('');
    setGroomerId(String(raw.handled_by?.id || raw.handled_by || ''));
    const savedCancellationReason = raw.cancellation_reason || appointment.cancellation_reason || '';
    const savedReasonOption = CANCELLATION_REASON_OPTIONS.find((option) => option.value !== '__other__' && option.value === savedCancellationReason);
    setCancellationReason(savedCancellationReason);
    setCancellationReasonChoice(savedReasonOption?.value || (savedCancellationReason ? '__other__' : ''));
    setCancellationOtherReason(savedReasonOption ? '' : savedCancellationReason);
    setDeposit(raw.deposit ? String(raw.deposit) : '');
    setReferenceNumber(raw.reference_number || '');
    setActualCheckInAt(raw.actual_check_in_at ? String(raw.actual_check_in_at).slice(0, 16) : '');
    setActualCheckOutAt(raw.actual_check_out_at ? String(raw.actual_check_out_at).slice(0, 16) : '');
    setLateCheckoutNotes(raw.late_checkout_notes || '');
    setLateCheckoutReason(raw.late_checkout_reason || '');
    setLateCheckoutOtherReason(raw.late_checkout_other_reason || '');
    setLateCheckoutStaffNotes(raw.late_checkout_staff_notes || raw.late_checkout_notes || '');
    setLateCheckinReason(raw.late_checkin_reason || '');
    setLateCheckinOtherReason(raw.late_checkin_other_reason || '');
    setError('');
    setLoadErrors({});
    setLoadingReferenceData({ services: true, staff: true, hotelSuites: true });
    setSlots([]);
    setSelectedAddonIds(getAppointmentAddons(raw).map((addon) => String(addon.id)));
    setOpenSizedExtra('');
    // Hotel fields
    setHotelCheckout(initialHotelCheckout);
    setHotelNights(initialNights);
    setHotelMonth(() => {
      const d = raw.appointment_date ? new Date(`${normalizeDate(raw.appointment_date)}T00:00:00`) : new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    apiFetch('/api/services/catalog')
      .then((r) => {
        if (r.ok) return r.json();
        setLoadErrors((previous) => ({ ...previous, services: 'Service options could not be loaded.' }));
        return { data: [] };
      })
      .then((d) => {
        const list = Array.isArray(d.data) ? d.data : [];
        setServices(list);

        if (!initialCategory && initialServiceId) {
          const matched = list.find((s) => String(s.id) === initialServiceId);
          if (matched?.category) setServiceCategory(matched.category);
        }
      })
      .catch(() => setLoadErrors((previous) => ({ ...previous, services: 'Service options could not be loaded.' })))
      .finally(() => setLoadingReferenceData((previous) => ({ ...previous, services: false })));

    const savedGroomerId = String(raw.handled_by?.id || raw.handled_by || '');
    const groomerQuery = new URLSearchParams({ type: 'groomer', availability: 'on_duty', per_page: '100' });
    if (savedGroomerId) groomerQuery.set('include_id', savedGroomerId);
    apiFetch(`/api/admin/staff?${groomerQuery.toString()}`)
      .then((r) => {
        if (r.ok) return r.json();
        setLoadErrors((previous) => ({ ...previous, staff: 'Staff options could not be loaded.' }));
        return { data: [] };
      })
      .then((d) => {
        const rows = Array.isArray(d?.data)
          ? d.data
          : Array.isArray(d?.data?.data)
            ? d.data.data
            : [];
        setGroomers(
          rows
            .map((row) => ({
              ...row,
              name: row?.name || row?.display_name || `${row?.first_name || ''} ${row?.last_name || ''}`.trim() || row?.email || '',
            }))
            .filter((row) => row?.id && row?.name),
        );
      })
      .catch(() => {
        setGroomers([]);
        setLoadErrors((previous) => ({ ...previous, staff: 'Staff options could not be loaded.' }));
      })
      .finally(() => setLoadingReferenceData((previous) => ({ ...previous, staff: false })));

    apiGet('/api/hotel-suites?per_page=100')
      .then((r) => {
        if (r.ok) return r.json();
        setLoadErrors((previous) => ({ ...previous, hotelSuites: 'Hotel suite options could not be loaded.' }));
        return { data: [] };
      })
      .then((d) => {
        const rows = Array.isArray(d?.data?.data)
          ? d.data.data
          : Array.isArray(d?.data)
            ? d.data
            : Array.isArray(d)
              ? d
              : [];
        setHotelSuites(rows);
      })
      .catch(() => {
        setHotelSuites([]);
        setLoadErrors((previous) => ({ ...previous, hotelSuites: 'Hotel suite options could not be loaded.' }));
      })
      .finally(() => setLoadingReferenceData((previous) => ({ ...previous, hotelSuites: false })));

    const isPawsome = String(raw.service?.name || appointment.service || '').trim().toLowerCase() === 'pawsome extras';
    if (isPawsome) {
      setLoadingAddons(true);
      setAddonLoadError('');
      apiFetch('/api/booking/addons?category=grooming')
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.message || 'Unable to load Pawsome Extras.');
          setAvailableAddons(Array.isArray(payload?.data) ? payload.data : []);
        })
        .catch((err) => {
          setAvailableAddons([]);
          setAddonLoadError(err?.message || 'Unable to load Pawsome Extras.');
        })
        .finally(() => setLoadingAddons(false));
    } else {
      setAvailableAddons([]);
      setAddonLoadError('');
    }
  }, [isOpen, appointment]);

  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([]);
      setLoadErrors((previous) => ({ ...previous, slots: '' }));
      return;
    }
    setLoadingSlots(true);
    setLoadErrors((previous) => ({ ...previous, slots: '' }));
    apiFetch(`/api/appointments/available-slots?date=${date}&service_id=${serviceId}`)
      .then((r) => {
        if (r.ok) return r.json();
        setLoadErrors((previous) => ({ ...previous, slots: 'Available time slots could not be loaded.' }));
        return { data: { slots: [], reason: null } };
      })
      .then((d) => {
        const availableSlots = Array.isArray(d.data?.slots) ? d.data.slots : [];
        setSlots(availableSlots);
        if (String(serviceCategory || '').toLowerCase() === 'hotel') {
          setHotelOperatingHours(d.data?.operating_hours || null);
        }
        // Handle occupied status for hotel appointments
        if (d.data?.reason === 'occupied') {
          setSlots([]);
        }
      })
      .catch(() => {
        setSlots([]);
        setLoadErrors((previous) => ({ ...previous, slots: 'Available time slots could not be loaded.' }));
      })
      .finally(() => setLoadingSlots(false));
  }, [serviceId, date, serviceCategory]);

  // Hotel calendar availability
  useEffect(() => {
    if (!isOpen || serviceCategory !== 'hotel' || !serviceId) return;
    if (!hotelSuiteId) return;
    const monthKey = `${hotelMonth.getFullYear()}-${String(hotelMonth.getMonth() + 1).padStart(2, '0')}`;
    setHotelCalendarLoading(true);
    setLoadErrors((previous) => ({ ...previous, calendar: '' }));
    setHotelUnavailableDates(new Set());
    setHotelClosedDates(new Set());
    setHotelCapacityByDate({});
    apiGet(`/api/appointments/hotel-calendar?service_id=${serviceId}&month=${monthKey}&suite_id=${hotelSuiteId}&exclude_appointment_id=${appointment?.id || ''}&pet_id=${appointment?.pet_id || ''}`)
      .then((r) => {
        if (r.ok) return r.json();
        setLoadErrors((previous) => ({ ...previous, calendar: 'Hotel availability could not be loaded.' }));
        return { data: { dates: [] } };
      })
      .then((d) => {
        const rows = Array.isArray(d?.data?.dates) ? d.data.dates : [];
        setHotelClosedDates(new Set(rows.filter((r) => r.status === 'closed').map((r) => r.date)));
        setHotelUnavailableDates(new Set(rows.filter((r) => ['full', 'unavailable', 'taken'].includes(r.status)).map((r) => r.date)));
        setHotelCapacityByDate(Object.fromEntries(rows.filter((r) => r.capacity !== undefined).map((r) => [r.date, r])));
      })
      .catch(() => setLoadErrors((previous) => ({ ...previous, calendar: 'Hotel availability could not be loaded.' })))
      .finally(() => setHotelCalendarLoading(false));
  }, [appointment?.id, appointment?.pet_id, isOpen, serviceCategory, serviceId, hotelSuiteId, hotelMonth]);

  const handleSave = async () => {
    const isHotel = serviceCategory === 'hotel';
    if (isPawsomeExtrasAppt && (selectedAddonIds.length < 1 || selectedAddonIds.length > MAX_PAWSOME_EXTRAS)) {
      const message = 'Select 1 to 3 Pawsome Extras before saving.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }
    if (effectiveAppointmentDetailsChanged) {
      if (!serviceId || !date) {
        const message = 'Service and date are required.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (!isHotel && !time) {
        const message = 'Time is required.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (isHotel && !time) {
        const message = 'Hotel check-in time is required.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (isHotel && hotelCheckInTimeError(hotelCheckInInput || time, hotelOperatingHours, date)) {
        const message = hotelCheckInTimeError(hotelCheckInInput || time, hotelOperatingHours, date);
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (isHotel && (!hotelSuiteId || !hotelCheckout || !hotelNights)) {
        const message = 'Please select the hotel package, check-in, and check-out dates.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (isHotel && hotelCalendarLoading) {
        const message = 'Please wait while we check hotel availability.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (isHotel && hotelRangeHasBlockedDate(date, hotelCheckout, hotelUnavailableDates, hotelClosedDates, todayIso)) {
        const message = 'Selected hotel stay includes a closed or unavailable date. Please choose another suite, date, or checkout.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (isHotel && lateCheckoutDetected && lateCheckoutReason === 'other' && !String(lateCheckoutStaffNotes || '').trim()) {
        const message = 'Staff Notes is required when Late Check-Out Reason is Other.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
      if (isHotel && lateCheckinDetected && lateCheckinReason === 'other' && !String(lateCheckinOtherReason || '').trim()) {
        const message = 'Additional Notes is required when Late Check-In Reason is Other.';
        setError(message);
        onNotify?.(message, 'error');
        return;
      }
    }
    if (status === 'in_progress' && !isHotelAppt && date !== todayIso) {
      const message = 'In Progress is only allowed when appointment date is today.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }
    if (isHotelAppt && status === 'in_progress' && !actualCheckInAt) {
      const message = 'Enter and confirm the actual Hotel Suite check-in date and time before starting the stay.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }
    if (isHotelAppt && status === 'completed' && (!actualCheckInAt || !actualCheckOutAt)) {
      const message = 'Record the actual Hotel Suite check-in and check-out date and time before completing the stay.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }
    if (normalizedInitialStatus === 'in_progress' && status === 'approved') {
      const message = 'Appointments already in progress cannot be changed back to approved.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }
    if (status === 'cancelled' && !cancellationReason.trim()) {
      const message = 'Cancellation reason is required when cancelling an appointment.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }
    if (status === 'completed' && isGroomingAppt && !groomerId) {
      const message = 'Please select who groomed the pet.';
      setError(message);
      onNotify?.(message, 'error');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let savedCheckout = appointment?._raw?.actual_check_out_at || actualCheckOutAt;
      if (effectiveAppointmentDetailsChanged) {
        const body = {
          service_id:       serviceId,
          ...((isGroomingAppt || isDaycareAppt) ? { size_label: sizeLabel || null } : {}),
          ...(isHotelAppt ? { pet_size: petSizeLabel || null } : {}),
          ...(isDaycareAppt ? { daycare_duration: daycareDuration || null } : {}),
          ...(isHotel ? { hotel_suite_id: hotelSuiteId || null } : {}),
          appointment_date: date,
          start_time:       time.length === 5 ? `${time}:00` : time,
          ...(isHotel && hotelNights   ? { hotel_nights:   parseInt(hotelNights) } : {}),
          ...(isHotel ? { actual_check_in_at: actualCheckInAt || null, actual_check_out_at: actualCheckOutAt || null } : {}),
          ...(isHotel ? { late_checkin_reason: lateCheckinDetected ? (lateCheckinReason || null) : null } : {}),
          ...(isHotel ? { late_checkin_other_reason: (lateCheckinDetected && lateCheckinReason === 'other') ? (lateCheckinOtherReason || null) : null } : {}),
          ...(isHotel ? { late_checkin_staff_notes: null } : {}),
          ...(isHotel ? { late_checkout_notes: lateCheckoutNotes || null } : {}),
          ...(isHotel ? { late_checkout_reason: lateCheckoutDetected ? (lateCheckoutReason || null) : null } : {}),
          ...(isHotel ? { late_checkout_other_reason: (lateCheckoutDetected && lateCheckoutReason === 'other') ? (lateCheckoutStaffNotes || null) : null } : {}),
          ...(isHotel ? { late_checkout_staff_notes: lateCheckoutDetected ? (lateCheckoutStaffNotes || null) : null } : {}),
          ...(deposit ? { deposit: parseFloat(deposit) } : {}),
          ...(referenceNumber ? { reference_number: referenceNumber } : {}),
          ...(isPawsomeExtrasAppt ? { addons: selectedAddonIds.map((addonId) => ({ addon_id: addonId })) } : {}),
          ...(isGroomingAppt && groomerId !== initialGroomerId ? { handled_by: groomerId || null } : {}),
        };
        const res = await apiFetch(`/api/appointments/${appointment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(res.status >= 500 ? 'Unable to save the appointment right now. Please try again later.' : data?.message || 'Failed to save.');
        }
        savedCheckout = data?.data?.actual_check_out_at || actualCheckOutAt;
      }

      if (statusUpdateChanged) {
        if (status === 'completed' && isHotelAppt) {
          setPendingHotelCheckout(savedCheckout);
          return;
        }
        const statusPayload = { status };
        if (status === 'completed' && isGroomingAppt && groomerId) {
          statusPayload.handled_by = groomerId;
        }
        if (status === 'cancelled') {
          statusPayload.cancellation_reason = cancellationReason.trim();
        }

        const statusRes = await apiFetch(`/api/appointments/${appointment.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statusPayload),
        });
        const statusData = await statusRes.json().catch(() => ({}));
        if (!statusRes.ok) {
          throw new Error(statusRes.status >= 500 ? 'Unable to update the appointment right now. Please try again later.' : statusData?.message || 'Failed to update status.');
        }
      }

      onNotify?.('Appointment updated successfully.', 'success');
      onSaved?.('Appointment updated successfully.');
      onClose();
    } catch (err) {
      setError(err.message);
      onNotify?.(err?.message || 'Failed to update appointment.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const fmt12 = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const toTimeValue = (value) => {
    const text = String(value || '').trim();
    return text && text !== '00:00' && text !== '00:00:00' ? text.slice(0, 5) : '';
  };

  const noSlots = !loadingSlots && !loadErrors.slots && date && serviceId && slots.length === 0;

  const raw = appointment._raw || {};
  const pet = raw.pet || {};
  const owner = raw.owner || raw.booked_by_owner || raw.pet?.owner || {};

  const initialServiceId = String(raw.service_id || raw.service?.id || '');
  const initialSizeLabel = String(raw.size_label || '');
  const initialPetSizeLabel = String(raw.pet_size || '');
  const initialDaycareDuration = String(raw.daycare_duration || '');
  const initialHotelSuiteId = String(raw.hotel_suite_id || raw.hotel_suite?.id || raw.hotelSuite?.id || '');
  const initialDate = normalizeDate(raw.appointment_date || appointment.dateIso || '');
  const initialTime = raw.start_time && String(raw.start_time).slice(0, 5) !== '00:00' ? String(raw.start_time).slice(0, 5) : '';
  const initialHotelNights = raw.hotel_nights ? String(raw.hotel_nights) : '';
  const initialHotelCheckout = initialDate && initialHotelNights
    ? addDays(initialDate, Number(initialHotelNights))
    : normalizeDate(raw.check_out_time || raw.hotel_checkout || '');
  const initialStatus = appointment.status || 'approved';
  const normalizedInitialStatus = String(initialStatus || '').toLowerCase().replace(/-/g, '_');
  const initialGroomerId = String(raw.handled_by?.id || raw.handled_by || '');
  const initialCancellationReason = raw.cancellation_reason || appointment.cancellation_reason || '';
  const initialDeposit = raw.deposit ? String(raw.deposit) : '';
  const initialReferenceNumber = raw.reference_number || '';
  const initialAddonIds = getAppointmentAddons(raw).map((addon) => String(addon.id)).sort();
  const initialActualCheckInAt = raw.actual_check_in_at ? String(raw.actual_check_in_at).slice(0, 16) : '';
  const initialActualCheckOutAt = raw.actual_check_out_at ? String(raw.actual_check_out_at).slice(0, 16) : '';
  const initialLateCheckoutNotes = raw.late_checkout_notes || '';
  const initialLateCheckoutReason = raw.late_checkout_reason || '';
  const initialLateCheckoutOtherReason = raw.late_checkout_other_reason || '';
  const initialLateCheckoutStaffNotes = raw.late_checkout_staff_notes || raw.late_checkout_notes || '';
  const initialLateCheckinReason = raw.late_checkin_reason || '';
  const initialLateCheckinOtherReason = raw.late_checkin_other_reason || '';

  const appointmentDetailsChanged =
    String(serviceId) !== String(initialServiceId) ||
    String(sizeLabel) !== String(initialSizeLabel) ||
    String(petSizeLabel) !== String(initialPetSizeLabel) ||
    String(daycareDuration) !== String(initialDaycareDuration) ||
    String(hotelSuiteId) !== String(initialHotelSuiteId) ||
    date !== initialDate ||
    time !== initialTime ||
    hotelCheckout !== initialHotelCheckout ||
    hotelNights !== initialHotelNights ||
    actualCheckInAt !== initialActualCheckInAt ||
    actualCheckOutAt !== initialActualCheckOutAt ||
    lateCheckoutNotes !== initialLateCheckoutNotes ||
    lateCheckoutReason !== initialLateCheckoutReason ||
    lateCheckoutOtherReason !== initialLateCheckoutOtherReason ||
    lateCheckoutStaffNotes !== initialLateCheckoutStaffNotes ||
    lateCheckinReason !== initialLateCheckinReason ||
    lateCheckinOtherReason !== initialLateCheckinOtherReason ||
    deposit !== initialDeposit ||
    referenceNumber !== initialReferenceNumber ||
    (isGroomingCategory(`${serviceCategory} ${appointment.service || raw.service?.name || ''}`) && groomerId !== initialGroomerId);
  const pawsomeExtrasChanged = selectedAddonIds.map(String).sort().join('|') !== initialAddonIds.join('|');
  const effectiveAppointmentDetailsChanged = appointmentDetailsChanged || pawsomeExtrasChanged;
  const statusUpdateChanged =
    status !== initialStatus ||
    (status === 'cancelled' && cancellationReason.trim() !== String(initialCancellationReason || '').trim());
  const hasChanges = effectiveAppointmentDetailsChanged || statusUpdateChanged;

  const selectedGroomer = groomers.find((g) => String(g.id) === String(groomerId));

  const serviceLabel = services.find((s) => String(s.id) === String(serviceId))?.name || appointment.service || '-';
  const effectiveServiceCategory =
    serviceCategory ||
    services.find((s) => String(s.id) === String(serviceId))?.category ||
    raw.service?.category ||
    raw.service_category ||
    appointment.serviceCategory ||
    appointment.serviceType ||
    '';
  const isGroomingAppt = isGroomingCategory(`${effectiveServiceCategory} ${serviceLabel}`);
  const isPawsomeExtrasAppt = String(serviceLabel || '').trim().toLowerCase() === 'pawsome extras';

  const isHotelAppt = serviceCategory === 'hotel';
  const isDaycareAppt = isDaycareCategory(serviceCategory);
  const petSpeciesValue = String(
    pet?.speciesType?.code ||
    pet?.species_type?.code ||
    pet?.species?.code ||
    pet?.speciesType?.name ||
    pet?.species_type?.name ||
    pet?.species?.name ||
    pet?.species ||
    '',
  ).trim().toUpperCase();
  const isDogPet = ['D', 'DOG', 'DOGS', 'CANINE'].includes(petSpeciesValue);
  const isCatPet = ['C', 'CAT', 'CATS', 'FELINE'].includes(petSpeciesValue);
  const hotelPetSizeOptions = isDogPet
    ? ['Small', 'Medium', 'Large', 'XLarge'].map((value) => ({ value, label: value }))
    : isCatPet
      ? [{ value: 'CAT', label: 'Cat' }, { value: 'KITTEN', label: 'Kitten' }]
      : [];
  const statusLabel = String(status || 'approved')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const appointmentDetailsValid =
    !!serviceId &&
    (!isGroomingAppt || isPawsomeExtrasAppt || !!sizeLabel) &&
    (!isDaycareAppt || (!!daycareDuration && !!sizeLabel)) &&
    (!isHotelAppt || hotelPetSizeOptions.some((option) => option.value === petSizeLabel)) &&
    !!date &&
    (isHotelAppt ? (!!hotelSuiteId && !!hotelCheckout && !!hotelNights && !!time) : !!time) &&
    !(isHotelAppt && hotelCalendarLoading) &&
    !(isHotelAppt && hotelRangeHasBlockedDate(date, hotelCheckout, hotelUnavailableDates, hotelClosedDates, todayIso));
  const canSave =
    !saving &&
    !readOnly &&
    (!effectiveAppointmentDetailsChanged || appointmentDetailsValid) &&
    (!isPawsomeExtrasAppt || (selectedAddonIds.length >= 1 && selectedAddonIds.length <= MAX_PAWSOME_EXTRAS)) &&
    !(status === 'cancelled' && !cancellationReason.trim()) &&
    !(status === 'completed' && isGroomingAppt && !groomerId) &&
    hasChanges;

  const hotelSuiteLabel = hotelSuites.find((s) => String(s.id) === String(hotelSuiteId))?.name
    || raw.hotel_suite?.name
    || raw.hotelSuite?.name
    || raw.suite?.name
    || '-';
  const categoryLabelMap = {
    grooming: 'Grooming',
    daycare: 'Daycare',
    hotel: 'Hotel',
  };
  const bookedCategory =
    serviceCategory ||
    raw.service?.category ||
    services.find((s) => String(s.id) === String(initialServiceId))?.category ||
    '';
  const serviceCategoryDotColor =
    String(bookedCategory).toLowerCase().includes('hotel') ? '#fb7185'
    : String(bookedCategory).toLowerCase().includes('groom') ? '#a78bfa'
    : String(bookedCategory).toLowerCase().includes('day') ? '#fbbf24'
    : '#18a8a8';
  const ownerName =
    `${owner.first_name || ''} ${owner.last_name || ''}`.trim() ||
    owner.name ||
    appointment.owner ||
    '-';
  const breedName = pet?.breed?.name || '-';
  const petCode = pet?.pet_id || '-';
  const petWeightKg = pet?.weight_kg;
  const currentDate = date || normalizeDate(raw.appointment_date || appointment.dateIso || '');
  const currentTime = time || (raw.start_time ? String(raw.start_time).slice(0, 5) : '');
  const currentCheckout = hotelCheckout || normalizeDate(raw.check_out_time || raw.hotel_checkout || '');
  const currentNights = hotelNights || (raw.hotel_nights ? String(raw.hotel_nights) : '');
  const bookingSource = raw.booked_by_owner_id ? 'Customer' : 'Administrator';

  const addons = getAppointmentAddons(raw);
  const addonTotal = addons.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
  const addonGroups = availableAddons.reduce((groups, addon) => {
    const base = addonBaseName(addon?.name || '');
    const existing = groups.find((group) => group.base === base);
    const item = { ...addon, size: addonTier(addon) };
    if (existing) existing.items.push(item);
    else groups.push({ base, items: [item] });
    return groups;
  }, []).sort((a, b) => {
    const aSized = a.items.length > 1 || Boolean(a.items[0]?.size);
    const bSized = b.items.length > 1 || Boolean(b.items[0]?.size);
    return aSized === bSized ? a.base.localeCompare(b.base) : (aSized ? -1 : 1);
  });
  const selectedAddonRows = selectedAddonIds.map((id) =>
    availableAddons.find((addon) => String(addon.id) === String(id))
      || addons.find((addon) => String(addon.id) === String(id))
  ).filter(Boolean);
  const editableAddonTotal = selectedAddonRows.reduce((sum, addon) => sum + Number(addon?.price_min ?? addon?.price ?? 0), 0);
  const displayedAddons = isPawsomeExtrasAppt ? selectedAddonRows : addons;
  const displayedAddonTotal = isPawsomeExtrasAppt ? editableAddonTotal : addonTotal;
  const currentTotal = Number.parseFloat(raw.total_price || 0);
  const isStatusDateToday = date === todayIso;
  const isStatusDatePast = Boolean(date && date < todayIso);
  const selectedService = services.find((s) => String(s.id) === String(serviceId));
  const groomingTierOptions = Array.from(new Set(
    Array.isArray(selectedService?.service_tiers || selectedService?.tiers)
      ? (selectedService.service_tiers || selectedService.tiers).map((tier) => String(tier?.size_label || '').trim()).filter(Boolean)
      : []
  )).map((value) => ({
    value,
    label: toTierLabel(value),
  }));
  const daycareTierRows = Array.isArray(selectedService?.tiers)
    ? selectedService.tiers.map((tier) => parseDaycareTier(tier?.size_label)).filter((row) => row.duration)
    : [];
  const daycareTierOptions = Array.from(
    new Map(daycareTierRows.map((row) => [row.duration, { value: row.duration, label: toTierLabel(row.duration) }])).values(),
  );
  const daycareSizeOptions = Array.from(
    new Map(
      daycareTierRows
        .filter((row) => row.duration === daycareDuration)
        .map((row) => [row.raw, { value: row.raw, label: toTierLabel(row.size) }]),
    ).values(),
  );
  const hotelSuiteOptions = hotelSuites.map((suite) => ({
    value: suite.id,
    label: `${suite.name} - PHP ${Number(suite.price_per_night || 0).toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}/night`,
  }));
  const selectedTimeValue = toTimeValue(time || initialTime);
  const normalizedSlots = slots.map(toTimeValue).filter(Boolean);
  const timeOptions = Array.from(new Set([selectedTimeValue, ...normalizedSlots].filter(Boolean))).map((slot) => ({
    value: slot,
    label: `${fmt12(slot)}${selectedTimeValue === slot && !normalizedSlots.includes(slot) ? ' (current)' : ''}`,
  }));
  const statusOptions = (() => {
    if (normalizedInitialStatus === 'pending') {
      return [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'cancelled', label: 'Cancelled' },
      ];
    }
    if (normalizedInitialStatus === 'approved') {
      return [
        { value: 'approved', label: 'Approved' },
        ...(isHotelAppt
          ? (actualCheckInAt ? [{ value: 'in_progress', label: 'Start Hotel Stay' }] : [])
          : (isStatusDateToday ? [{ value: 'in_progress', label: 'In Progress' }] : [])),
        ...(!isHotelAppt && isStatusDatePast ? [{ value: 'completed', label: 'Completed' }] : []),
        { value: 'cancelled', label: 'Cancelled' },
      ];
    }
    if (normalizedInitialStatus === 'in_progress') {
      return [
        { value: 'in_progress', label: 'In Progress' },
        ...(!isHotelAppt || (actualCheckInAt && actualCheckOutAt) ? [{ value: 'completed', label: 'Completed' }] : []),
        { value: 'cancelled', label: 'Cancelled' },
      ];
    }
    return [{ value: normalizedInitialStatus, label: statusLabel }];
  })();
  const getStatusButtonClass = (value) => {
    const active = status === value;
    if (value === 'cancelled') {
      return active
        ? 'border-red-500 bg-red-500 text-white shadow-sm'
        : 'border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600';
    }
    if (value === 'completed') {
      return active
        ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100';
    }
    if (value === 'in_progress') {
      return active
        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
        : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100';
    }
    return active
      ? 'border-brand-teal bg-brand-teal text-white shadow-sm'
      : 'border-brand-teal/20 bg-brand-teal/5 text-brand-teal-dark hover:border-brand-teal/35 hover:bg-brand-teal/10';
  };
  const groomerOptions = groomers.map((groomer) => ({
    value: groomer.id,
    label: groomer.name,
  }));
  const selectedHotelSuite = hotelSuites.find((s) => String(s.id) === String(hotelSuiteId));
  const rawHotelSuitePrice = Number(raw.hotel_suite?.price_per_night || raw.hotelSuite?.price_per_night || 0);
  const selectedHotelNightlyRate = Number(selectedHotelSuite?.price_per_night ?? rawHotelSuitePrice ?? 0);
  const hotelChargeTotal = isHotelAppt
    ? selectedHotelNightlyRate * Math.max(0, Number(hotelNights || raw.hotel_nights || 0))
    : 0;
  const displayedTotal = isHotelAppt && hotelChargeTotal > 0 ? hotelChargeTotal : currentTotal;
  const depositPaid = Number(deposit || raw.deposit || 0);
  const remainingBalance = Math.max(Number(displayedTotal || 0) - depositPaid, 0);
  const originalBalance = Math.max(Number(currentTotal || 0) - depositPaid, 0);
  const toSafeDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const checkinDateIso = date || initialDate;
  const checkinTime = (time || initialTime || '09:00').slice(0, 5);
  const scheduledCheckinAt = (() => {
    if (!isHotelAppt || !checkinDateIso) return null;
    return toSafeDate(`${checkinDateIso}T${checkinTime}:00`);
  })();
  const actualCheckinAtDate = toSafeDate(actualCheckInAt);
  const checkinDiffMinutes = (isHotelAppt && scheduledCheckinAt && actualCheckinAtDate)
    ? Math.floor((actualCheckinAtDate.getTime() - scheduledCheckinAt.getTime()) / 60000)
    : null;
  const lateCheckinDetected = isHotelAppt && Number.isFinite(checkinDiffMinutes) && checkinDiffMinutes > 0;
  const checkoutCheckInDateIso = date || initialDate;
  const checkoutCheckInTime = (time || initialTime || '09:00').slice(0, 5);
  const checkoutNights = Math.max(1, Number(hotelNights || raw.hotel_nights || 1));
  const scheduledCheckoutAt = (() => {
    if (!isHotelAppt || !checkoutCheckInDateIso) return null;
    const base = toSafeDate(`${checkoutCheckInDateIso}T${checkoutCheckInTime}:00`);
    if (!base) return null;
    base.setDate(base.getDate() + checkoutNights);
    return base;
  })();
  const actualCheckoutAtDate = toSafeDate(actualCheckOutAt);
  const checkoutDiffMinutes = (isHotelAppt && scheduledCheckoutAt && actualCheckoutAtDate)
    ? Math.floor((actualCheckoutAtDate.getTime() - scheduledCheckoutAt.getTime()) / 60000)
    : null;
  const lateCheckoutDetected = isHotelAppt && Number.isFinite(checkoutDiffMinutes) && checkoutDiffMinutes > 0;
  const balanceDelta = remainingBalance - originalBalance;
  const visibleLoadErrors = Object.entries(loadErrors).filter(([key, message]) => (
    message && (isHotelAppt || (key !== 'hotelSuites' && key !== 'calendar')) && (isGroomingAppt || key !== 'staff')
  ));
  const loadingRelevantOptions = loadingReferenceData.services
    || (isGroomingAppt && loadingReferenceData.staff)
    || (isHotelAppt && loadingReferenceData.hotelSuites);

  const handleAttemptClose = () => {
    if (!readOnly && hasChanges && !saving) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  return createPortal(
    <>
    <div
      className="fixed inset-0 z-[82] flex h-[100dvh] min-h-[100dvh] w-screen items-end justify-center overflow-hidden bg-brand-dark/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleAttemptClose}
    >
      <div
        className="relative flex max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-2xl bg-transparent font-poppins sm:max-h-[90vh] sm:max-w-5xl sm:overflow-visible sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleAttemptClose}
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white text-brand-dark-soft shadow-[0_10px_24px_rgba(23,53,81,0.24)] transition hover:text-brand-dark"
          aria-label="Close appointment edit modal"
        >
          <X size={17} strokeWidth={2.4} />
        </button>

        <div className="shrink-0 px-4 pb-3 pt-4 sm:px-1 sm:pt-0">
          <div className="flex flex-col items-start gap-2 pr-12 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/75">{readOnly ? 'Appointment Record' : 'Appointment Editor'}</p>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/80" style={{ backgroundColor: serviceCategoryDotColor }} aria-hidden="true" />
                <h2 className="mt-1 text-lg font-semibold text-white">{readOnly ? 'View Appointment' : 'Edit Appointment'}</h2>
              </div>
              <p className="mt-0.5 truncate text-xs text-white/80">{serviceLabel}</p>
            </div>
            <div className="min-w-0 text-left sm:shrink-0 sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Appointment ID</p>
              <p className="truncate text-sm font-bold text-white">{appointment.displayId}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-1 no-scrollbar sm:px-1">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="min-w-0 space-y-4">
              <div className="rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
                <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Appointment Overview</h3>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Category</span><span className="font-semibold text-brand-dark text-right">{categoryLabelMap[bookedCategory] || '-'}</span></div>
                  <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Service</span><span className="font-semibold text-brand-dark text-right">{serviceLabel || '-'}</span></div>
                  {bookedCategory === 'hotel' && (
                    <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Package</span><span className="font-semibold text-brand-dark text-right">{hotelSuiteLabel}</span></div>
                  )}
                  <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Date</span><span className="font-semibold text-brand-dark text-right">{fmtShortDate(currentDate)}</span></div>
                  {bookedCategory === 'hotel' ? (
                    <>
                      <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Check-in Time</span><span className="font-semibold text-brand-dark text-right">{currentTime ? fmt12(currentTime) : '-'}</span></div>
                      <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Check-out</span><span className="font-semibold text-brand-dark text-right">{fmtShortDate(currentCheckout) || '-'}</span></div>
                      <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Nights</span><span className="font-semibold text-brand-dark text-right">{currentNights || '-'}</span></div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Time</span><span className="font-semibold text-brand-dark text-right">{currentTime ? fmt12(currentTime) : '-'}</span></div>
                  )}
                  <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Status</span><span className="font-semibold text-brand-dark text-right">{statusLabel}</span></div>
                  <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Booked By</span><span className="font-semibold text-brand-dark text-right">{bookingSource}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
                <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Pet Details</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <SimpleField label="Pet Name" value={appointment.pet || '-'} />
                  <SimpleField label="Pet Code" value={petCode} />
                  <SimpleField label="Breed" value={breedName} />
                  <SimpleField label="Weight" value={petWeightKg ? `${petWeightKg} kg` : '-'} />
                </div>
              </div>

              <div className="rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
                <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Pet Owner</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <SimpleField label="Owner" value={ownerName} />
                  <SimpleField label="Phone" value={owner.phone || '-'} />
                  <SimpleField label="Email" value={owner.email || '-'} className="sm:col-span-2 break-all" />
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {loadingRelevantOptions && (
                <p role="status" className="rounded-lg border border-brand-teal/15 bg-white px-3 py-2.5 text-xs font-semibold text-brand-dark-soft">Loading appointment options...</p>
              )}
              {visibleLoadErrors.length > 0 && (
                <div role="alert" className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
                  {visibleLoadErrors.map(([key, message]) => <p key={key}>{message}</p>)}
                </div>
              )}
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

              <div className="rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
                <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Service Details</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Service Category</label>
                    <p
                      aria-disabled="true"
                      className="cursor-not-allowed select-none rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-500"
                    >
                      {categoryLabelMap[serviceCategory] || '-'}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Service</label>
                    <p
                      aria-disabled="true"
                      className="cursor-not-allowed select-none rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-500"
                    >
                      {serviceLabel}
                    </p>
                    {!readOnly && <p className="mt-1 text-[10px] text-brand-dark-soft">The booked service cannot be changed. You may update its package details below.</p>}
                  </div>

                  {isPawsomeExtrasAppt && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Select Pawsome Extras</label>
                        <span className="text-[10px] font-semibold text-brand-teal">{selectedAddonIds.length} of {MAX_PAWSOME_EXTRAS} selected</span>
                      </div>
                      {loadingAddons && <p role="status" className="rounded-lg border border-brand-teal/15 bg-white px-3 py-2.5 text-xs font-semibold text-brand-dark-soft">Loading Pawsome Extras...</p>}
                      {!loadingAddons && addonLoadError && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">{addonLoadError}</p>}
                      {!loadingAddons && !addonLoadError && addonGroups.map(({ base, items }) => {
                        const selectedAddon = items.find((addon) => selectedAddonIds.includes(String(addon.id)));
                        const isSized = items.length > 1 || Boolean(items[0]?.size);
                        const limitReached = !selectedAddon && selectedAddonIds.length >= MAX_PAWSOME_EXTRAS;
                        if (isSized) {
                          const selectorOpen = openSizedExtra === base || Boolean(selectedAddon);
                          return (
                            <div key={base} className={`rounded-xl border px-3 py-3 ${selectedAddon ? 'border-brand-teal bg-brand-teal-light' : 'border-brand-dark-light'}`}>
                              <button
                                type="button"
                                disabled={readOnly || limitReached}
                                onClick={() => {
                                  if (selectedAddon) {
                                    setSelectedAddonIds((ids) => ids.filter((id) => !items.some((item) => String(item.id) === id)));
                                    setOpenSizedExtra('');
                                  } else {
                                    setOpenSizedExtra((current) => current === base ? '' : base);
                                  }
                                  setError('');
                                }}
                                className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <span className="flex items-center gap-3 text-sm font-semibold text-brand-dark">
                                  <span className={`flex h-4 w-4 items-center justify-center rounded border-2 ${selectedAddon ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-dark-light'}`}>
                                    {selectedAddon && <span className="text-[9px]">✓</span>}
                                  </span>
                                  {base}
                                </span>
                                <span className="text-xs text-brand-teal">{selectorOpen ? '▲' : '▼'}</span>
                              </button>
                              {selectorOpen && !readOnly && (
                                <div className="mt-3 border-t border-brand-teal/15 pt-3">
                                  <SelectDropdown
                                    value={selectedAddon ? String(selectedAddon.id) : ''}
                                    onChange={(selectedId) => {
                                      const withoutGroup = selectedAddonIds.filter((id) => !items.some((item) => String(item.id) === id));
                                      setSelectedAddonIds(selectedId ? [...withoutGroup, String(selectedId)] : withoutGroup);
                                      setError('');
                                    }}
                                    options={items.map((addon) => ({
                                      value: String(addon.id),
                                      label: `${addon.size || 'Standard'} - ${formatCurrency(addon.price_min)}`,
                                    }))}
                                    placeholder="Select size"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        }
                        const addon = items[0];
                        const selected = selectedAddonIds.includes(String(addon.id));
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            disabled={readOnly || (!selected && selectedAddonIds.length >= MAX_PAWSOME_EXTRAS)}
                            onClick={() => {
                              setSelectedAddonIds((ids) => selected ? ids.filter((id) => id !== String(addon.id)) : [...ids, String(addon.id)]);
                              setError('');
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-brand-teal bg-brand-teal-light' : 'border-brand-dark-light'}`}
                          >
                            <span className="flex items-center gap-3 text-sm font-semibold text-brand-dark">
                              <span className={`flex h-4 w-4 items-center justify-center rounded border-2 ${selected ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-dark-light'}`}>
                                {selected && <span className="text-[9px]">✓</span>}
                              </span>
                              {addon.name}
                            </span>
                            <span className="text-xs font-semibold text-brand-dark">{formatCurrency(addon.price_min)}</span>
                          </button>
                        );
                      })}
                      <div className="flex items-center justify-between border-t border-brand-dark-light pt-2 text-sm">
                        <span className="font-semibold text-brand-dark-soft">Estimated Service Cost</span>
                        <span className="font-bold text-brand-dark">{formatCurrency(editableAddonTotal)}</span>
                      </div>
                    </div>
                  )}

                  {isGroomingAppt && !isPawsomeExtrasAppt && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Grooming Tier</label>
                      {readOnly ? (
                        <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">{toTierLabel(sizeLabel || raw.size_label || '-')}</p>
                      ) : (
                        <SelectDropdown
                          value={sizeLabel}
                          onChange={setSizeLabel}
                          options={groomingTierOptions}
                          placeholder="Select grooming tier"
                        />
                      )}
                    </div>
                  )}

                  {isDaycareAppt && (
                    <>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Daycare Duration</label>
                        {readOnly ? (
                          <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">{toTierLabel(daycareDuration || raw.daycare_duration || '-')}</p>
                        ) : (
                          <SelectDropdown
                            value={daycareDuration}
                            onChange={(value) => { setDaycareDuration(value); setSizeLabel(''); }}
                            options={daycareTierOptions}
                            placeholder="Select daycare tier"
                          />
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Daycare Size</label>
                        {readOnly ? (
                          <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">{toTierLabel(sizeLabel || raw.size_label || '-')}</p>
                        ) : (
                          <SelectDropdown
                            value={sizeLabel}
                            onChange={setSizeLabel}
                            options={daycareSizeOptions}
                            placeholder={daycareDuration ? 'Select daycare size' : 'Select daycare tier first'}
                            disabled={!daycareDuration}
                          />
                        )}
                      </div>
                    </>
                  )}

                  {isHotelAppt && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                        Pet Size <span className="text-red-500">*</span>
                      </label>
                      {readOnly ? (
                        <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">
                          {petSizeLabel || raw.pet_size || 'Not recorded'}
                        </p>
                      ) : (
                        <SelectDropdown
                          value={petSizeLabel}
                          onChange={(value) => {
                            setPetSizeLabel(value);
                            setError('');
                          }}
                          options={hotelPetSizeOptions}
                          placeholder={hotelPetSizeOptions.length ? 'Select pet size' : 'Pet species is not supported'}
                          disabled={!hotelPetSizeOptions.length}
                        />
                      )}
                    </div>
                  )}

                  {isHotelAppt && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Hotel Package</label>
                      {readOnly ? (
                        <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">{hotelSuiteLabel}</p>
                      ) : (
                        <SelectDropdown
                          value={hotelSuiteId}
                          onChange={(value) => {
                            setHotelSuiteId(value);
                            setError('');
                          }}
                          options={hotelSuiteOptions}
                          placeholder="Select Hotel Package"
                        />
                      )}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                        {isHotelAppt ? 'Check-in & Check-out' : 'Date'}
                      </label>
                      {readOnly ? (
                        <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">
                          {isHotelAppt ? `${date} ${time ? fmt12(time) : ''} to ${hotelCheckout || '-'} (${hotelNights || '-'}n)` : (date || '-')}
                        </p>
                      ) : isHotelAppt ? (
                        <div className="col-span-2">
                          {/* Hotel calendar */}
                          <div className="rounded-xl border border-brand-dark-light p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <button type="button" onClick={() => setHotelMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                                className="rounded-lg border border-brand-dark-light px-2 py-1 text-xs text-brand-dark hover:border-brand-teal/50">Prev</button>
                              <p className="text-xs font-bold text-brand-dark">{hotelMonth.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', year: 'numeric' })}</p>
                              <button type="button" onClick={() => setHotelMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                                className="rounded-lg border border-brand-dark-light px-2 py-1 text-xs text-brand-dark hover:border-brand-teal/50">Next</button>
                            </div>
                            {hotelCalendarLoading ? (
                              <p role="status" className="rounded-lg border border-brand-teal/15 bg-white px-3 py-2.5 text-center text-xs font-semibold text-brand-dark-soft">Loading hotel availability...</p>
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
                                    const dateStr = toIso(new Date(hotelMonth.getFullYear(), hotelMonth.getMonth(), day));
                                    const isPast    = dateStr < todayIso;
                                    const isClosed  = hotelClosedDates.has(dateStr);
                                    const isBlocked = hotelUnavailableDates.has(dateStr);
                                    const capacity = hotelCapacityByDate?.[dateStr];
                                    const isFull = isBlocked && Number(capacity?.available) <= 0;
                                    const isUnavailable = isBlocked && !isFull;
                                    const isCheckIn  = date === dateStr;
                                    const isCheckOut = hotelCheckout === dateStr;
                                    const inRange    = !!(date && hotelCheckout && dateStr > date && dateStr < hotelCheckout);
                                    const selectable = dateStr >= todayIso && !isClosed && !isBlocked;
                                    return (
                                      <button key={dateStr} type="button" disabled={!selectable}
                                        onClick={() => {
                                          if (!date || hotelCheckout) {
                                            setDate(dateStr); setHotelCheckout(''); setHotelNights(''); setHotelCheckInInput(null);
                                            setError(''); return;
                                          }
                                          const checkIn  = dateStr < date ? dateStr : date;
                                          const checkOut = dateStr < date ? date : dateStr;
                                          const nights   = diffDays(checkIn, checkOut);
                                          if (nights < 1 || nights > 5) {
                                            setDate(dateStr); setHotelCheckout(''); setHotelNights(''); setHotelCheckInInput(null);
                                            setError(''); return;
                                          }
                                          // check range for blocked nights
                                          let blocked = false;
                                          for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
                                            if (hotelUnavailableDates.has(d) || hotelClosedDates.has(d) || d < todayIso) { blocked = true; break; }
                                          }
                                          if (blocked) { setError('Selected stay includes a closed or unavailable date.'); return; }
                                          setDate(checkIn); setHotelCheckout(checkOut); setHotelNights(String(nights));
                                          setError('');
                                        }}
                                        className={`h-8 rounded-md text-xs font-semibold transition-colors ${
                                          isCheckIn || isCheckOut ? 'bg-brand-teal text-white'
                                          : inRange   ? 'bg-brand-teal-light/70 text-brand-teal-dark'
                                          : isPast    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                          : isClosed  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                          : isFull ? 'bg-red-100 text-red-500 cursor-not-allowed'
                                          : isUnavailable ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                          : 'bg-brand-teal-light/35 text-brand-dark hover:bg-brand-teal-light/70'
                                        }`}
                                        title={isClosed ? 'Shop is closed' : isFull ? 'Full' : isUnavailable ? 'Unavailable' : capacity ? `${capacity.available} of ${capacity.capacity} shared cluster units available` : undefined}>
                                        {day}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="mt-3 flex items-center gap-4 text-[11px]">
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-gray-100 ring-1 ring-gray-200" />Closed</div>
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-red-100" />Full</div>
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-gray-100" />Unavailable</div>
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-brand-teal-light/70 ring-1 ring-brand-teal/20" />Available</div>
                                </div>
                              </>
                            )}
                            {date && !hotelCheckout && (
                              <p className="mt-2 text-xs text-brand-dark-soft">
                                Check-in: <span className="font-semibold text-brand-dark">{date}</span>. Now pick a check-out date (max 5 nights).
                              </p>
                            )}
                            {date && hotelCheckout && (
                              <div className="mt-2 rounded-lg bg-white border border-brand-dark-light px-3 py-2 text-xs text-brand-dark space-y-0.5">
                                <p>Check-in: <span className="font-semibold">{date}</span></p>
                                <p>Check-out: <span className="font-semibold">{hotelCheckout}</span></p>
                                <p>Nights: <span className="font-semibold">{hotelNights}</span></p>
                              </div>
                            )}
                            {date && hotelCheckout && (
                              <div className="mt-3">
                                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Hotel Check-in Time</label>
                                <HotelCheckInTimePicker
                                  value={time}
                                  draft={hotelCheckInInput}
                                  date={date}
                                  operatingHours={hotelOperatingHours}
                                  onDraftChange={setHotelCheckInInput}
                                  onChange={setTime}
                                  disabled={loadingSlots || noSlots}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <DateDropdown
                          value={date}
                          min={todayIso}
                          onChange={(value) => { setDate(value); setTime(''); }}
                        />
                      )}
                    </div>

                    {!isHotelAppt && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Time Slot</label>
                      {readOnly ? (
                        <p className="flex h-[42px] items-center rounded-xl border border-brand-dark-light px-3 text-sm text-brand-dark">{time ? fmt12(time) : '-'}</p>
                      ) : (
                        <SelectDropdown
                          value={time}
                          onChange={setTime}
                          disabled={!date || !serviceId || loadingSlots}
                          options={timeOptions}
                          placeholder={loadingSlots ? 'Checking...' : loadErrors.slots ? 'Unable to load slots' : noSlots ? (serviceCategory === 'hotel' ? 'Already occupied' : 'No slots available') : 'Select Time'}
                          buttonClassName="h-[42px] py-0"
                        />
                      )}
                    </div>
                    )}
                  </div>

                  {!readOnly && !isHotelAppt && noSlots && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {serviceCategory === 'hotel' ? 'This date is already occupied.' : 'No available slots for this service on the selected date.'}
                    </p>
                  )}

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Status</label>
                    {readOnly ? (
                      <div className="flex items-center gap-2 rounded-lg border border-brand-dark-light px-3 py-2.5">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${
                          status === 'completed'   ? 'bg-emerald-500' :
                          status === 'cancelled'   ? 'bg-red-400' :
                          status === 'in_progress' ? 'bg-blue-500' :
                          status === 'approved'    ? 'bg-teal-500' : 'bg-gray-400'
                        }`} />
                        <span className={`text-sm font-semibold capitalize ${
                          status === 'completed'   ? 'text-emerald-600' :
                          status === 'cancelled'   ? 'text-red-500' :
                          status === 'in_progress' ? 'text-blue-600' :
                          status === 'approved'    ? 'text-teal-600' : 'text-gray-500'
                        }`}>
                          {status === 'in_progress' ? 'In Progress' : status || '-'}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setStatus(option.value)}
                            className={`min-h-[42px] rounded-lg border px-3 py-2 text-xs font-bold transition-all ${getStatusButtonClass(option.value)}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {isGroomingAppt && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Handled By</label>
                      {readOnly ? (
                        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">
                          <i className="fa-solid fa-circle-check mr-2" />
                          {raw.handled_by?.name || selectedGroomer?.name || '-'}
                        </p>
                      ) : (
                        <>
                          <SelectDropdown
                            value={groomerId}
                            onChange={setGroomerId}
                            options={groomerOptions}
                            placeholder="Select Groomer"
                            searchable
                          />
                          {!loadingReferenceData.staff && groomers.length === 0 && !loadErrors.staff && (
                            <p className="mt-1 text-xs text-brand-dark-soft">No groomers are currently on duty. A groomer must Time In before they can be assigned to this service.</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {status === 'cancelled' && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Cancellation Reason</label>
                      {readOnly ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 whitespace-pre-wrap">
                          <i className="fa-solid fa-ban mr-2" />
                          {cancellationReason || '-'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <SelectDropdown
                            value={cancellationReasonChoice}
                            onChange={(value) => {
                              setCancellationReasonChoice(value);
                              if (value === '__other__') {
                                setCancellationReason(cancellationOtherReason.trim());
                              } else {
                                setCancellationOtherReason('');
                                setCancellationReason(value);
                              }
                            }}
                            options={[{ value: '', label: 'Select cancellation reason' }, ...CANCELLATION_REASON_OPTIONS]}
                            placeholder="Select cancellation reason"
                            menuPlacement="up"
                          />
                          {cancellationReasonChoice === '__other__' && (
                            <textarea
                              value={cancellationOtherReason}
                              onChange={(event) => {
                                setCancellationOtherReason(event.target.value);
                                setCancellationReason(event.target.value.trimStart());
                              }}
                              placeholder="Please specify the cancellation reason..."
                              rows={3}
                              maxLength={500}
                              className="w-full resize-none rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isHotelAppt && (
                    <div className="rounded-lg border border-brand-dark-light p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Hotel Time Logging</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Actual Check-In Time</label>
                          {readOnly ? (
                            <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">{actualCheckInAt || '-'}</p>
                          ) : (
                            <input type="datetime-local" value={actualCheckInAt} onChange={(e) => setActualCheckInAt(e.target.value)} className="w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                          )}
                          {!readOnly && normalizedInitialStatus === 'approved' && !actualCheckInAt && (
                            <p className="mt-1 text-[10px] leading-4 text-brand-dark-soft">Enter and save the pet&apos;s actual arrival date and time. This confirmed timestamp is required to start the hotel stay.</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Actual Check-Out Time</label>
                          {readOnly ? (
                            <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">{actualCheckOutAt || '-'}</p>
                          ) : (
                            <input type="datetime-local" value={actualCheckOutAt} onChange={(e) => setActualCheckOutAt(e.target.value)} disabled={normalizedInitialStatus !== 'in_progress'} className="w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none disabled:cursor-not-allowed disabled:bg-brand-dark-light/30" />
                          )}
                          {!readOnly && normalizedInitialStatus !== 'in_progress' && (
                            <p className="mt-1 text-[10px] leading-4 text-brand-dark-soft">Record check-out after the stay has been started.</p>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-brand-dark-soft">
                        Check-In Status: {!actualCheckInAt ? 'Pending Check-In Log' : lateCheckinDetected ? 'Late Check-In' : 'Arrived On Time'}
                      </p>
                      {lateCheckinDetected && (
                        <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          Notice: This hotel appointment checked in later than the scheduled arrival time.
                        </p>
                      )}
                      {lateCheckinDetected && (
                        <p className="mt-1 text-xs text-brand-dark-soft">
                          Late by: {Math.floor((checkinDiffMinutes || 0) / 60)} hours {Math.abs((checkinDiffMinutes || 0) % 60)} minutes
                        </p>
                      )}
                      {lateCheckinDetected && (
                        <div className="mt-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Late Check-In Reason</label>
                          {readOnly ? (
                            <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">
                              {{
                                traffic_delay: 'Traffic Delay',
                                owner_schedule_conflict: 'Owner Schedule Conflict',
                                emergency_situation: 'Emergency Situation',
                                late_arrival_notice_given: 'Late Arrival Notice Given',
                                other: 'Other',
                              }[lateCheckinReason] || '-'}
                            </p>
                          ) : (
                            <SelectDropdown
                              value={lateCheckinReason}
                              onChange={setLateCheckinReason}
                              options={LATE_CHECKIN_REASON_OPTIONS}
                              placeholder="Select reason"
                              buttonClassName="!rounded-lg !border-brand-dark-light !px-3 !py-2.5"
                            />
                          )}
                        </div>
                      )}
                      {lateCheckinDetected && lateCheckinReason === 'other' && (
                        <div className="mt-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Additional Notes</label>
                          {readOnly ? (
                            <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark whitespace-pre-wrap">{lateCheckinOtherReason || '-'}</p>
                          ) : (
                            <textarea value={lateCheckinOtherReason} onChange={(e) => setLateCheckinOtherReason(e.target.value)} rows={2} placeholder="Enter additional operational details" className="w-full resize-none rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                          )}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-brand-dark-soft">
                        Check-Out Status: {!actualCheckOutAt ? 'Pending Check-Out Log' : lateCheckoutDetected ? 'Late Check-Out' : 'Released On Time'}
                      </p>
                      {lateCheckoutDetected && (
                        <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          Notice: This hotel appointment exceeded the scheduled check-out time.
                        </p>
                      )}
                      {lateCheckoutDetected && (
                        <p className="mt-1 text-xs text-brand-dark-soft">
                          Late by: {Math.floor((checkoutDiffMinutes || 0) / 60)} hours {Math.abs((checkoutDiffMinutes || 0) % 60)} minutes
                        </p>
                      )}
                      {lateCheckoutDetected && (
                        <div className="mt-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Late Check-Out Reason</label>
                          {readOnly ? (
                            <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark">
                              {{
                                customer_pickup_delay: 'Customer Pickup Delay',
                                extended_pet_observation: 'Extended Pet Observation',
                                staff_release_coordination: 'Staff Release Coordination',
                                emergency_situation: 'Emergency Situation',
                                other: 'Other',
                              }[lateCheckoutReason] || '-'}
                            </p>
                          ) : (
                            <SelectDropdown
                              value={lateCheckoutReason}
                              onChange={setLateCheckoutReason}
                              options={LATE_CHECKOUT_REASON_OPTIONS}
                              placeholder="Select reason"
                              buttonClassName="!rounded-lg !border-brand-dark-light !px-3 !py-2.5"
                            />
                          )}
                        </div>
                      )}
                      {lateCheckoutDetected && lateCheckoutReason === 'other' && (
                        <div className="mt-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Staff Notes (Specify)</label>
                          {readOnly ? (
                            <p className="rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark whitespace-pre-wrap">{lateCheckoutStaffNotes || '-'}</p>
                          ) : (
                            <textarea value={lateCheckoutStaffNotes} onChange={(e) => setLateCheckoutStaffNotes(e.target.value)} rows={2} placeholder="Enter details" className="w-full resize-none rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                          )}
                        </div>
                      )}
                      <p className="mt-1 text-[11px] text-brand-dark-soft">Final charges and payment settlement are processed through Loyverse POS.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
                <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Estimated Charges</h3>
                <div className="mt-3 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Individual Services</span><span className="font-semibold text-brand-dark text-right">{displayedAddons.length}</span></div>
                  {displayedAddons.length > 0 && (
                    <div className="rounded-lg border border-brand-teal/15 bg-brand-surface/60 px-3 py-2">
                      <div className="space-y-1.5">
                        {displayedAddons.map((addon) => (
                          <div key={addon.id} className="flex items-start justify-between gap-3 text-xs">
                            <span className="font-semibold text-brand-dark">{addon.name}</span>
                            <span className="shrink-0 font-bold text-brand-dark">{formatCurrency(addon.price_min ?? addon.price)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-brand-teal/15 pt-2 text-xs">
                        <span className="font-semibold text-brand-dark-soft">Pawsome Extras Total</span>
                        <span className="font-bold text-brand-dark">{formatCurrency(displayedAddonTotal)}</span>
                      </div>
                    </div>
                  )}
                  {isHotelAppt && (
                    <>
                      <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Suite Rate</span><span className="font-semibold text-brand-dark text-right">{formatCurrency(selectedHotelNightlyRate)} / night</span></div>
                      <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Hotel Charge</span><span className="font-semibold text-brand-dark text-right">{formatCurrency(displayedTotal)}</span></div>
                      <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Deposit Paid</span><span className="font-semibold text-brand-dark text-right">{formatCurrency(depositPaid)}</span></div>
                      <div className="flex items-start justify-between gap-4 border-t border-brand-dark-light pt-2"><span className="font-semibold text-brand-dark">Remaining Balance</span><span className="font-bold text-brand-dark text-right">{formatCurrency(remainingBalance)}</span></div>
                      {balanceDelta !== 0 && (
                        <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${balanceDelta > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {balanceDelta > 0
                            ? `Suite/date change adds ${formatCurrency(balanceDelta)} to the balance.`
                            : `Suite/date change lowers the balance by ${formatCurrency(Math.abs(balanceDelta))}.`}
                        </p>
                      )}
                    </>
                  )}
                  {!isHotelAppt && (
                    <div className="flex items-start justify-between gap-4"><span className="text-brand-dark-soft">Current Total</span><span className="font-semibold text-brand-dark text-right">{isPawsomeExtrasAppt ? formatCurrency(editableAddonTotal) : (Number.isFinite(currentTotal) ? formatCurrency(currentTotal) : '-')}</span></div>
                  )}
                  <p className="text-[11px] font-normal italic leading-relaxed text-amber-600">The displayed total is an estimate and may change after confirming the pet&apos;s actual size, selected preferences, and any additional services provided.</p>
                  <p className="text-[11px] text-brand-dark-soft">Operational updates are saved for staff reference only. Final settlement is handled in Loyverse POS.</p>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="sticky bottom-0 mt-3 flex flex-col items-stretch justify-between gap-2 rounded-xl border border-brand-teal/15 bg-white px-4 py-3 shadow-[0_18px_35px_rgba(23,53,81,0.16)] sm:flex-row sm:items-center">
          <p className="min-w-0 text-[11px] text-brand-dark-soft">
            {readOnly
              ? status === 'completed'
                ? <span className="font-semibold text-emerald-600"><i className="fa-solid fa-circle-check mr-1" />This appointment has been completed.</span>
                : status === 'cancelled'
                  ? <span className="font-semibold text-red-500"><i className="fa-solid fa-ban mr-1" />This appointment has been cancelled.</span>
                  : 'Viewing appointment details'
              : hasChanges
                ? 'You have unsaved changes.'
                : 'No changes yet.'}
          </p>
          {!readOnly && (
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="w-full rounded-xl bg-brand-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-teal-dark disabled:opacity-50 sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    <ConfirmActionModal
      isOpen={showDiscardConfirm}
      title="Discard Changes?"
      message="You have unsaved appointment changes. Discard them and close?"
      confirmText="Discard"
      cancelText="Keep Editing"
      confirmTone="danger"
      onCancel={() => setShowDiscardConfirm(false)}
      onConfirm={() => {
        setShowDiscardConfirm(false);
        onClose();
      }}
    />
    {pendingHotelCheckout && (
      <HotelCheckoutConfirmation
        appointmentId={appointment.id}
        actualCheckin={actualCheckInAt || raw?.actual_check_in_at}
        actualCheckout={pendingHotelCheckout}
        initialPetSize={petSizeLabel || initialPetSizeLabel}
        species={raw?.pet?.species_type?.name || raw?.pet?.speciesType?.name || ''}
        onCancel={() => setPendingHotelCheckout('')}
        onConfirm={async (payment) => {
          const response = await apiFetch(`/api/appointments/${appointment.id}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed', ...payment }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.message || 'Unable to complete Hotel Suite checkout.');
          setPendingHotelCheckout('');
          onNotify?.('Hotel Suite checkout completed.', 'success');
          onSaved?.('Hotel Suite checkout completed.');
          onClose();
          return true;
        }}
      />
    )}
    </>,
    document.body
  );
}
