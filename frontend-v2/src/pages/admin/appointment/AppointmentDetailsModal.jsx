import { CircleCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatHotelCheckInLabel,
  formatHotelCheckOutLabel,
  formatStatusLabel,
  normalizeStatus,
  formatCancellationReason,
} from '../../../utils/recordFormatters';
import { apiFetch } from '../../../api/apiClient';
import { notifyError, notifySuccess } from '../../../utils/notify';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import PetAssessmentFormModal from '../../../components/modals/PetAssessmentFormModal';
import { useSuppliesFeatureEnabled } from '../../../utils/featureFlags';
import { normalizeDate, toIso } from './appointmentUtils';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import WalkInSaleModal from '../inventory/components/WalkInSaleModal';
import { getPaymentLabel, getReceivingAccountLabel } from '../inventory/receiptPdfUtils';
import { normalizeBreedName } from '../../../utils/textUtils';
import AppointmentStatusControl from './AppointmentStatusControl';
import HotelStayCorrectionHistory from './HotelStayCorrectionHistory';
import HotelCheckoutConfirmation from './HotelCheckoutConfirmation';
import { useAuthStore } from '../../../stores/authStore';
import PaymentProofPreviewModal from './PaymentProofPreviewModal';
import { fetchPaymentAccounts } from '../../../utils/paymentAccounts';
import SimpleField from './AppointmentInfoField';
import { OwnerDetailsSection, PetDetailsSection } from './AppointmentSummarySections';
import { getAppointmentServiceCategory } from '../../../utils/appointmentServiceType';

const sanitizeReferenceNumber = (value = '') => String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);

const STATUS_BADGE = {
  pending:     'bg-yellow-100 text-yellow-700',
  approved:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-red-100 text-red-600',
};

const toTitleCase = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

const isUuidLike = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const templateServiceIdByCategory = (category) => {
  const c = String(category || '').toLowerCase();
  const yy = String(new Date().getFullYear()).slice(-2);
  if (c.includes('groom')) return `GPKG${yy}00`;
  if (c.includes('hotel')) return `HPKG${yy}00`;
  if (c.includes('day')) return `DCPKG${yy}00`;
  return '-';
};

const pickStaffName = (...candidates) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const text = candidate.trim();
      if (text) return text;
      continue;
    }
    const fullName = `${candidate?.first_name || ''} ${candidate?.last_name || ''}`.trim();
    if (fullName) return fullName;
    const named = String(candidate?.name || candidate?.display_name || '').trim();
    if (named) return named;
  }
  return null;
};

const getAppointmentAddons = (raw = {}) => {
  const rows = Array.isArray(raw?.appointmentAddons)
    ? raw.appointmentAddons
    : Array.isArray(raw?.appointment_addons)
      ? raw.appointment_addons
      : Array.isArray(raw?.addons)
        ? raw.addons
        : [];

  return rows.map((addon, index) => {
    const serviceAddon = addon?.serviceAddon || addon?.service_addon || addon?.addon || {};
    return {
      id: addon?.id || addon?.addon_id || serviceAddon?.id || `${serviceAddon?.name || 'addon'}-${index}`,
      name: serviceAddon?.name || addon?.name || addon?.addon_name || 'Pawsome Extra',
      price: Number(addon?.price_charged ?? addon?.price ?? serviceAddon?.price_min ?? 0),
    };
  });
};

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
};

const emptyClock = () => ({ hour: '', minute: '', period: '' });
const clockToValue = ({ hour, minute, period }) => {
  if (!hour || !minute || !period) return '';
  const twelveHour = Number(hour) % 12;
  const hours = twelveHour + (period === 'PM' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${minute}`;
};
const parseManilaDateTime = (date, clock) => {
  const time = clockToValue(clock);
  return new Date(date && time ? `${date}T${time}:00+08:00` : '');
};
const manilaTimestamp = (date, clock) => {
  const time = clockToValue(clock);
  return date && time ? `${date}T${time}:00+08:00` : '';
};
const displayRole = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return 'Admin';
  const staffType = String(user?.staff_type || (role === 'staff' ? '' : role))
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
  return staffType ? `Staff (${staffType})` : 'Staff';
};
const isAuthorizedStaffUser = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || user?.isAdmin === true || user?.is_admin === true
    || role === 'staff' || user?.isStaff === true || user?.is_staff === true
    || ['front_desk', 'groomer', 'attendant', 'receptionist', 'frontdesk', 'assistant', 'cashier', 'daycare', 'daycare_assistant'].includes(role);
};
const formatReadableDate = (value) => {
  if (!value) return 'Select a date';
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime())
    ? 'Select a date'
    : new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' }).format(date);
};

function HotelClockPicker({ value, onChange, onBlur }) {
  const update = (field, next) => onChange({ ...value, [field]: next });
  const baseClass = 'h-10 min-w-0 rounded-md border border-brand-dark-light bg-white px-2 text-sm font-medium text-brand-dark focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20';
  return (
    <div className="flex items-center gap-1.5" onBlur={onBlur}>
      <select aria-label="Hour" value={value.hour} onChange={(event) => update('hour', event.target.value)} className={`${baseClass} flex-1`}>
        <option value="">HH</option>
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour.padStart(2, '0')}</option>)}
      </select>
      <span aria-hidden="true" className="font-bold text-brand-dark-soft">:</span>
      <select aria-label="Minute" value={value.minute} onChange={(event) => update('minute', event.target.value)} className={`${baseClass} flex-1`}>
        <option value="">MM</option>
        {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
      </select>
      <select aria-label="AM or PM" value={value.period} onChange={(event) => update('period', event.target.value)} className={`${baseClass} w-[4.5rem]`}>
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

const formatDateOnly = (value) => {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatPetAge = (value) => {
  if (!value) return '-';
  const birth = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '-';
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years > 0) return `${years} yr${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} mo${months !== 1 ? 's' : ''}` : ''}`;
  return `${Math.max(months, 0)} mo${months !== 1 ? 's' : ''}`;
};

const formatPetSex = (value) => {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '-';
};

const timeToMinutes = (timeValue = '') => {
  const text = String(timeValue || '').trim();
  if (!text) return null;
  const [hh, mm] = text.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return (hh * 60) + mm;
};

const Section = ({ title, children, className = '' }) => (
  <section className={`rounded-lg border border-brand-dark-light/80 bg-white px-4 py-3 ${className}`}>
    <p className="mb-2 border-b border-dashed border-brand-dark-light pb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-dark-soft">
      {title}
    </p>
    {children}
  </section>
);

const AmountRow = ({ label, value, strong = false, highlightClass = '' }) => (
  <div className={`flex items-center justify-between gap-4 py-2.5 ${strong ? `-mx-4 px-4 ${highlightClass}` : 'border-b border-dashed border-brand-dark-light/80 last:border-b-0'}`}>
    <span className={`${strong ? 'text-sm font-extrabold uppercase tracking-wide text-brand-dark' : 'text-xs font-semibold text-brand-dark-soft'}`}>
      {label}
    </span>
    <span className={`${strong ? 'text-xl font-extrabold text-brand-dark' : 'text-sm font-bold text-brand-dark'}`}>
      PHP {Number(value || 0).toFixed(2)}
    </span>
  </div>
);

const extractRetailPurchases = (raw = {}, appointment = {}) => {
  const candidates = [
    raw?.walkInSales,
    raw?.walk_in_sales,
    raw?.retailSales,
    raw?.retail_sales,
    appointment?.walkInSales,
    appointment?.walk_in_sales,
    appointment?.retailSales,
    appointment?.retail_sales,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  const single = raw?.walkInSale || raw?.walk_in_sale || raw?.retailSale || raw?.retail_sale;
  return single ? [single] : [];
};

export default function AppointmentDetailsModal({ appointment, onClose, onEdit, onStatusChange, onRequestCancel, isSaving = false, autoOpenComplete = false }) {
  useBodyScrollLock(!!appointment);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showPaymentProof, setShowPaymentProof] = useState(false);
  const receiptRef = useRef(null);

  // Completion modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMissedCheckInModal, setShowMissedCheckInModal] = useState(false);
  const [hotelCheckoutMode, setHotelCheckoutMode] = useState('');
  const [missedCheckInDate, setMissedCheckInDate] = useState('');
  const [missedCheckInTime, setMissedCheckInTime] = useState(emptyClock);
  const [missedCheckOutDate, setMissedCheckOutDate] = useState('');
  const [missedCheckOutTime, setMissedCheckOutTime] = useState(emptyClock);
  const [hotelHandlers, setHotelHandlers] = useState([]);
  const [loadingHotelHandlers, setLoadingHotelHandlers] = useState(false);
  const [hotelHandlersError, setHotelHandlersError] = useState('');
  const [selectedHandledBy, setSelectedHandledBy] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [missedCheckInReason, setMissedCheckInReason] = useState('');
  const [confirmedHotelStay, setConfirmedHotelStay] = useState(false);
  const [missedCheckInError, setMissedCheckInError] = useState('');
  const [missedCheckInTouched, setMissedCheckInTouched] = useState({});
  const authenticatedUser = useAuthStore((state) => state.user);
  const [payMode, setPayMode] = useState('');
  const [payBankName, setPayBankName] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payDeposit, setPayDeposit] = useState('');
  const [payReference, setPayReference] = useState('');
  const [paymentModes, setPaymentModes] = useState({});
  const [loadingPaymentModes, setLoadingPaymentModes] = useState(false);
  const [groomers, setGroomers] = useState([]);
  const [groomerId, setGroomerId] = useState('');
  const [isCompletingStatus, setIsCompletingStatus] = useState(false);
  const [payModalError, setPayModalError] = useState('');
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showRetailSaleModal, setShowRetailSaleModal] = useState(false);
  const [editingRetailSale, setEditingRetailSale] = useState(null);
  const [retailSales, setRetailSales] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
  const [paymentAccountsError, setPaymentAccountsError] = useState(false);
  const [suppliesEnabled] = useSuppliesFeatureEnabled();
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleLoadingSlots, setRescheduleLoadingSlots] = useState(false);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const payConfirmedRef = useRef(false);
  const payAutoFilledRef = useRef(false);
  const autoOpenedCompleteRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchPaymentAccounts().then((accounts) => {
      if (active) setPaymentAccounts(accounts);
    }).catch(() => {
      if (active) setPaymentAccountsError(true);
    }).finally(() => {
      if (active) setPaymentAccountsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!autoOpenComplete || !appointment?.id) return;

    const rawAppointment = appointment?._raw || {};
    const normalizedAppointmentStatus = normalizeStatus(appointment?.status);
    const isHotelAppointment = getAppointmentServiceCategory(rawAppointment) === 'hotel'
      || getAppointmentServiceCategory(appointment) === 'hotel';
    const appointmentDateIso = normalizeDate(rawAppointment?.appointment_date || appointment?.dateIso || '');
    const isPastAppointmentDate = Boolean(appointmentDateIso && appointmentDateIso < toIso(new Date()));
    const canOpenComplete = normalizedAppointmentStatus === 'in_progress' || (normalizedAppointmentStatus === 'approved' && isPastAppointmentDate);

    if (isHotelAppointment || !canOpenComplete || autoOpenedCompleteRef.current === appointment.id) return;
    autoOpenedCompleteRef.current = appointment.id;
    onStatusChange?.(appointment, 'completed');
  }, [autoOpenComplete, appointment?.id, appointment?.status, appointment?.dateIso]);

  const raw = appointment?._raw || {};
  const owner = raw?.owner || raw?.pet?.owner || {};

  useEffect(() => {
    setRetailSales(extractRetailPurchases(raw, appointment));
    setEditingRetailSale(null);
    setShowRetailSaleModal(false);
  }, [appointment?.id]);

  useEffect(() => {
    if (!showMissedCheckInModal || !appointment?.id) return undefined;
    let active = true;
    setHotelHandlers([]);
    setHotelHandlersError('');
    setLoadingHotelHandlers(true);
    const loadHandlers = async () => {
      const allStaff = [];
      let page = 1;
      let lastPage = 1;
      do {
        const response = await apiFetch(`/api/appointments/hotel-handler-options?page=${page}&per_page=100`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Unable to load eligible Hotel Suite staff.');
        const paginated = payload?.data || {};
        const rows = Array.isArray(paginated?.data) ? paginated.data : [];
        allStaff.push(...rows);
        lastPage = Math.max(1, Number(paginated?.last_page || 1));
        page += 1;
      } while (active && page <= lastPage);
      if (active) setHotelHandlers(allStaff);
    };
    loadHandlers()
      .catch((error) => {
        if (active) setHotelHandlersError(error?.message || 'Unable to load eligible Hotel Suite staff.');
      })
      .finally(() => {
        if (active) setLoadingHotelHandlers(false);
      });
    return () => { active = false; };
  }, [showMissedCheckInModal, appointment?.id]);

  useEffect(() => {
    setShowMissedCheckInModal(false);
    setMissedCheckInDate('');
    setMissedCheckInTime(emptyClock());
    setMissedCheckOutDate('');
    setMissedCheckOutTime(emptyClock());
    setMissedCheckInReason('');
    setConfirmedHotelStay(false);
    setMissedCheckInError('');
    setMissedCheckInTouched({});
    setSelectedHandledBy('');
    setStaffSearch('');
    setHotelHandlersError('');
  }, [appointment?.id]);

  const appointmentDate = appointment?.date || raw?.appointment_date || '-';
  const appointmentTime = appointment?.time || String(raw?.start_time || '').slice(0, 5) || '-';
  const hotelCheckInDisplay = formatHotelCheckInLabel({
    appointmentDate: raw?.appointment_date || appointment?.dateIso || appointmentDate,
    startTime: raw?.start_time || appointment?.time || '',
    createdAt: raw?.created_at || appointment?.created_at || '',
  });
  const hotelCheckOutDisplay = formatHotelCheckOutLabel({
    appointmentDate: raw?.appointment_date || appointment?.dateIso || appointmentDate,
    startTime: raw?.start_time || appointment?.time || '',
    createdAt: raw?.created_at || appointment?.created_at || '',
    hotelNights: raw?.hotel_nights,
  });
  const ownerName = appointment?.owner || `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || owner?.name || '-';

  const serviceCategoryRaw = getAppointmentServiceCategory(raw) || getAppointmentServiceCategory(appointment);
  const baseServiceName = String(appointment?.service || raw?.service?.name || '-').replace(/\s*\([^)]*\)\s*$/, '').trim();
  const isHotel = serviceCategoryRaw === 'hotel';
  const isGrooming = serviceCategoryRaw === 'grooming';
  const isDaycare = serviceCategoryRaw === 'daycare';
  const serviceCategoryLabel = toTitleCase(serviceCategoryRaw);
  const serviceCategoryDotColor =
    String(serviceCategoryRaw || '').toLowerCase().includes('hotel') ? '#fb7185'
    : String(serviceCategoryRaw || '').toLowerCase().includes('groom') ? '#a78bfa'
    : String(serviceCategoryRaw || '').toLowerCase().includes('day') ? '#fbbf24'
    : '#18a8a8';
  const packageName = isHotel
    ? (raw?.hotel_suite?.name || raw?.hotelSuite?.name || raw?.suite?.name || appointment?.service || '-')
    : baseServiceName;
  const isPawsomeExtrasAppointment = baseServiceName.toLowerCase() === 'pawsome extras';

  const cancellationReason = raw?.cancellation_reason || raw?.cancel_reason || null;
  const missedCheckInCorrectionNotes = String(raw?.late_checkin_staff_notes || '');
  const hasMissedCheckInCorrection = missedCheckInCorrectionNotes.includes('Missed check-in correction reason:');
  const cancellationType = String(raw?.cancellation_type || '').toLowerCase();
  const cancellationTypeLabel =
    cancellationType === 'staff_rejection'
      ? 'Admin/Staff Rejection'
      : cancellationType === 'customer_cancellation'
        ? 'Customer Cancellation'
        : cancellationType === 'staff_cancellation'
          ? 'Admin/Staff Cancellation'
          : cancellationType === 'late' || String(cancellationReason || '').startsWith('[LATE CANCELLATION]')
      ? 'Late Cancellation'
      : cancellationType === 'normal'
        ? 'Normal Cancellation'
        : null;
  const cancelledAtDisplay = formatDateTime(raw?.cancelled_at || appointment?.cancelled_at);
  const cancelledByName = pickStaffName(raw?.cancelled_by, raw?.cancelledBy) || null;
  const specialInstructions = raw?.special_instructions || null;

  const handledByName = pickStaffName(
    appointment?.handledByName,
    appointment?._raw?.handled_by_name,
    raw?.handled_by_name,
    raw?.handledBy,
    raw?.handled_by,
    raw?.handled_by_user,
    raw?.staff,
    raw?.groomer,
  );

  const addons = getAppointmentAddons(raw);
  const basePrice = Number(raw?.service?.price || raw?.base_price || raw?.total_price || 0);
  const addonsPrice = addons.reduce((sum, addon) => sum + Number(addon?.price || 0), 0);
  const hotelPrice = raw?.hotel_suite?.price_per_night ? Number(raw.hotel_suite.price_per_night) * Number(raw?.hotel_nights || 0) : 0;
  const totalPrice = basePrice + addonsPrice + hotelPrice;

  const appointmentDisplayId = appointment?.displayId || raw?.appointment_code || appointment?.id || '-';
  const pet = raw?.pet || {};
  const petDisplayId = raw?.pet?.pet_id || appointment?.petId || '--';
  const petSpecies = pet?.speciesType?.name || pet?.species_type?.name || pet?.species?.name || pet?.species || raw?.species_name || raw?.species || '-';
  const petBreed = normalizeBreedName(pet?.breed?.name || pet?.breed_name || raw?.breed?.name || raw?.breed_name || appointment?.breed || '-', pet || raw || appointment);
  const petSex = pet?.sex ?? pet?.pet_sex ?? pet?.gender ?? raw?.pet_sex ?? null;
  const petDateOfBirth = pet?.date_of_birth ?? pet?.pet_dob ?? pet?.dob ?? pet?.birth_date ?? pet?.birthdate ?? null;
  const petColor = pet?.color || pet?.coat_color || raw?.pet_color || '';
  const petMedicalNotes = pet?.medical_notes || pet?.medicalNotes || raw?.pet_medical_notes || raw?.medical_notes || '';
  const contact = owner?.phone || '-';
  const email = owner?.email || '-';
  const serviceDisplayIdCandidates = [
    raw?.service_display_id,
    raw?.service?.display_id,
    appointment?.serviceDisplayId,
    raw?.service_code,
    raw?.service?.package_code,
    raw?.service?.service_code,
  ];
  const serviceDisplayId =
    serviceDisplayIdCandidates.find((value) => {
      const text = String(value || '').trim();
      return text && !isUuidLike(text);
    }) || templateServiceIdByCategory(serviceCategoryRaw);
  const bookedPackageRows = Array.isArray(raw?.bookedPackages)
    ? raw.bookedPackages
    : Array.isArray(raw?.booked_packages)
      ? raw.booked_packages
      : [];
  const bookedPackageId = (() => {
    if (!bookedPackageRows.length) return null;
    const sorted = [...bookedPackageRows].sort((a, b) => Number(a?.sequence_order || 9999) - Number(b?.sequence_order || 9999));
    const primary = sorted[0] || null;
    const id = primary?.booked_package_id || primary?.bookedPackageId || null;
    return String(id || '').trim() || null;
  })();
  const legacyBookedPackageId = (() => {
    const legacyCode = String(raw?.appointment_code || '').trim();
    if (/^(GPKG|DCPKG|HPKG)[0-9]{4}-[0-9]+$/i.test(legacyCode)) {
      return legacyCode;
    }
    const base = String(serviceDisplayId || '').trim();
    if (/^(GPKG|DCPKG|HPKG)[0-9]{4}$/i.test(base)) {
      return `${base}-1`;
    }
    return null;
  })();

  const ownerAddress = formatOwnerAddress(owner, raw);

  const baseModeRaw =
    raw?.reservation_channel ||
    raw?.mode_of_payment ||
    raw?.payment_method ||
    raw?.payment?.method ||
    '';
  const paymentDateDisplay = null;
  const paymentStatusDisplay = '';
  const referenceDisplay =
    raw?.payment_reference_id ||
    raw?.payment_reference ||
    raw?.reference_number ||
    raw?.payment?.reference_number ||
    raw?.payment?.reference ||
    null;
  const hasPaymentProof = Boolean(raw?.reservation_deposit_proof_available || raw?.reservation_deposit_proof_url || raw?.deposit_proof_url || raw?.payment?.proof_url);
  const legacyReservationProvider = raw?.reservation_provider || raw?.payment?.provider || '';
  const paymentAccountId = raw?.reservation_payment_account_id || raw?.payment?.payment_account_id || '';
  const payerProvider = raw?.reservation_payer_provider || raw?.payment?.payer_provider || '';
  const modeNormalized = String(baseModeRaw || '').toLowerCase().trim().replace(/[-\s]+/g, '_');
  const paymentModeFormValue = ['cash', 'e_wallet', 'bank_transfer'].includes(modeNormalized) ? modeNormalized : '';
  const paymentModeDisplay = ({
    cash: 'Cash',
    e_wallet: 'E-Wallet',
    bank_transfer: 'Bank Transfer',
  })[paymentModeFormValue] || (baseModeRaw ? toTitleCase(String(baseModeRaw).replace(/_/g, ' ')) : null);
  const payerProviderDisplay = String(payerProvider).trim() || null;
  const selectedReceivingAccount = paymentAccounts.find((account) => String(account.id || '') === String(paymentAccountId || ''));
  const paymentToDisplay = selectedReceivingAccount?.label || (paymentAccountId ? `Account ${paymentAccountId}` : null);
  const legacyProviderDisplay = !paymentAccountId && !payerProviderDisplay ? String(legacyReservationProvider).trim() || null : null;
  const isCashPayment = paymentModeFormValue === 'cash';
  const grandTotal = raw?.total_price ? Number(raw.total_price) : totalPrice;
  const depositValue = raw?.deposit ?? raw?.payment?.deposit ?? '';
  const depositFormValue = depositValue === null || depositValue === undefined || depositValue === '' ? '' : String(depositValue);
  const firstPaymentAmount = Number(depositFormValue || 0);
  const lateCheckoutIndicator = Boolean(raw?.late_checkout_indicator);
  const checkoutDiffMinutes = Number(raw?.checkout_time_difference_minutes || 0);
  const lateCheckinIndicator = Boolean(raw?.late_checkin_indicator);
  const checkinDiffMinutes = Number(raw?.checkin_time_difference_minutes || 0);
  const actualCheckInDisplay = formatDateTime(raw?.actual_check_in_at);
  const actualCheckOutDisplay = formatDateTime(raw?.actual_check_out_at);
  const lateCheckinReasonLabel = ({
    traffic_delay: 'Traffic Delay',
    owner_schedule_conflict: 'Owner Schedule Conflict',
    emergency_situation: 'Emergency Situation',
    late_arrival_notice_given: 'Late Arrival Notice Given',
    other: 'Other',
  }[String(raw?.late_checkin_reason || '')] || null);
  const lateCheckoutReasonLabel = ({
    customer_pickup_delay: 'Customer Pickup Delay',
    extended_pet_observation: 'Extended Pet Observation',
    staff_release_coordination: 'Staff Release Coordination',
    emergency_situation: 'Emergency Situation',
    other: 'Other',
  }[String(raw?.late_checkout_reason || '')] || null);
  const serviceTotalForPayment = Math.max(Number(grandTotal || 0) - Number(addonsPrice || 0), 0);
  const addonTotalForPayment = Number(addonsPrice || 0);
  const totalCharges = Math.max(
    Number(serviceTotalForPayment || 0) +
      Number(addonTotalForPayment || 0),
    0,
  );
  const displayedServiceTotal = isPawsomeExtrasAppointment
    ? totalCharges
    : serviceTotalForPayment;
  const remainingBalance = Math.max(Number(totalCharges || 0) - (isHotel ? firstPaymentAmount : 0), 0);
  const payableAmount = remainingBalance;
  const normalizedPaymentStatus = String(paymentStatusDisplay || '').toLowerCase().trim();
  const isPartiallyPaidHotel = isHotel && ['partial', 'partially_paid'].includes(normalizedPaymentStatus) && firstPaymentAmount > 0;

  const resolvedPetPhotoUrl = raw?.pet?.photo_url || raw?.pet?.profile_photo || raw?.pet?.photo || appointment?.petPhoto || '';

  const storedStatus = normalizeStatus(appointment?.status);
  const normalizedStatus = storedStatus === 'no_show' ? 'cancelled' : storedStatus;
  const statusBadgeClass = STATUS_BADGE[normalizedStatus] || 'bg-gray-100 text-gray-600';
  const statusLabel = normalizedStatus === 'in_progress' ? 'In Progress'
    : normalizedStatus === 'pending' ? 'Pending Approval'
    : formatStatusLabel(normalizedStatus);
  const isPending = normalizedStatus === 'pending';
  const isPendingReschedule = isPending && (
    Boolean(raw?.reschedule_requested_at)
    || String(raw?.notes || '').includes('[Reschedule Request]')
  );
  const isApproved = normalizedStatus === 'approved';
  const isCompleted = normalizedStatus === 'completed';
  const isCancelled = normalizedStatus === 'cancelled';
  const isGroomerUser = String(authenticatedUser?.staff_type || '').toLowerCase() === 'groomer';
  const isAssignedGroomer = isGroomerUser && String(raw?.handled_by?.id || raw?.handled_by || appointment?.handled_by || '') === String(authenticatedUser?.id || '');
  const appointmentDateIso = normalizeDate(raw?.appointment_date || appointment?.dateIso || '');
  const isPastAppointmentDate = Boolean(appointmentDateIso && appointmentDateIso < toIso(new Date()));
  const canCompletePastApproved = isApproved && isPastAppointmentDate;
  const canMarkComplete = normalizedStatus === 'in_progress' || canCompletePastApproved;
  const canEditAppointment = !isGroomerUser && (isPending || isApproved || canMarkComplete);
  const isTodayApproved = isApproved && appointmentDateIso === toIso(new Date());
  const startMinutes = timeToMinutes(raw?.start_time || appointment?.time || '');
  const nowMinutes = (new Date().getHours() * 60) + new Date().getMinutes();
  const isPastGracePeriod = Boolean(isTodayApproved && startMinutes !== null && nowMinutes >= (startMinutes + 15));
  const isNoShowEligible = isPastAppointmentDate || isPastGracePeriod;
  const canAddRetailPurchase = !isGroomerUser && suppliesEnabled && !isPending && !isCancelled && !isPastGracePeriod;
  const openRetailPurchaseModal = () => {
    if (!canAddRetailPurchase) return;
    setEditingRetailSale(retailSales.length > 0 ? retailSales[0] : null);
    setShowRetailSaleModal(true);
  };
  const handleRetailSaleSaved = (sale) => {
    if (sale) {
      setRetailSales((prev) => {
        const key = String(sale.id || sale.receipt_number || '');
        if (!key) return [sale, ...prev];
        const exists = prev.some((item) => String(item.id || item.receipt_number || '') === key);
        if (!exists) return [sale, ...prev];
        return prev.map((item) => (String(item.id || item.receipt_number || '') === key ? sale : item));
      });
    }
    notifySuccess(retailSales.length > 0 ? 'Retail purchase updated for this appointment.' : 'Retail purchase added to this appointment.');
    setShowRetailSaleModal(false);
    setEditingRetailSale(null);
  };

  useEffect(() => {
    if (!showRescheduleModal) return;
    const initialDate = normalizeDate(raw?.appointment_date || appointment?.dateIso || '');
    const initialTime = String(raw?.start_time || appointment?.time || '').slice(0, 5);
    setRescheduleDate(initialDate || toIso(new Date()));
    setRescheduleTime(initialTime || '');
  }, [showRescheduleModal, raw?.appointment_date, raw?.start_time, appointment?.dateIso, appointment?.time]);

  useEffect(() => {
    if (!showRescheduleModal || !rescheduleDate) return;
    const loadSlots = async () => {
      setRescheduleLoadingSlots(true);
      try {
        const serviceId = raw?.service_id || raw?.service?.id;
        if (!serviceId) {
          setRescheduleSlots([]);
          return;
        }
        const params = new URLSearchParams({
          date: rescheduleDate,
          service_id: String(serviceId),
        });
        const res = await apiFetch(`/api/appointments/available-slots?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        const rows = Array.isArray(data?.slots) ? data.slots : Array.isArray(data?.data?.slots) ? data.data.slots : [];
        setRescheduleSlots(rows.map((slot) => String(slot).slice(0, 5)));
      } catch {
        setRescheduleSlots([]);
      } finally {
        setRescheduleLoadingSlots(false);
      }
    };
    loadSlots();
  }, [showRescheduleModal, rescheduleDate, raw?.service_id, raw?.service?.id]);

  const openPaymentModal = async () => {
    payConfirmedRef.current = false;
    payAutoFilledRef.current = true;
    setPayMode(isPartiallyPaidHotel ? '' : paymentModeFormValue);
    setPayBankName(isPartiallyPaidHotel ? '' : (payerProvider || ''));
    setPayDate(isPartiallyPaidHotel ? normalizeDate(new Date().toISOString()) : normalizeDate(paymentDateDisplay || ''));
    const modalTotalCharges = Math.max(
      Number(serviceTotalForPayment || 0) +
      Number(addonTotalForPayment || 0),
      0,
    );
    const modalPayableAmount = Math.max(modalTotalCharges - firstPaymentAmount, 0);
    setPayDeposit(String(modalPayableAmount.toFixed(2)));

    setPayReference(isPartiallyPaidHotel ? '' : sanitizeReferenceNumber(referenceDisplay || ''));
    setPayModalError('');
    const savedGroomerId = String(raw?.handled_by?.id || raw?.handled_by || '');
    setGroomerId(savedGroomerId);
    setGroomers([]);
    setPaymentModes({});
    setShowPaymentModal(true);
    setLoadingPaymentModes(false);

    if (isGrooming) {
      const groomerQuery = new URLSearchParams({ type: 'groomer', availability: 'on_duty', per_page: '100' });
      if (savedGroomerId) groomerQuery.set('include_id', savedGroomerId);
      apiFetch(`/api/admin/staff?${groomerQuery.toString()}`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((d) => {
          const rows = Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.data) ? d.data.data : [];
          setGroomers(
            rows
              .map((row) => ({
                ...row,
                name: row?.name || row?.display_name || `${row?.first_name || ''} ${row?.last_name || ''}`.trim() || row?.email || '',
              }))
              .filter((row) => row?.id && row?.name),
          );
        })
        .catch(() => setGroomers([]));
    }
  };

  const closePaymentModal = () => {
    payConfirmedRef.current = false;
    setShowPaymentModal(false);
  };

  const resetMissedCheckInModal = () => {
    setShowMissedCheckInModal(false);
    setMissedCheckInDate('');
    setMissedCheckInTime(emptyClock());
    setMissedCheckOutDate('');
    setMissedCheckOutTime(emptyClock());
    setMissedCheckInReason('');
    setConfirmedHotelStay(false);
    setMissedCheckInError('');
    setMissedCheckInTouched({});
    setSelectedHandledBy('');
    setStaffSearch('');
    setHotelHandlersError('');
  };

  const actualCheckInDate = parseManilaDateTime(missedCheckInDate, missedCheckInTime);
  const actualCheckOutDate = parseManilaDateTime(missedCheckOutDate, missedCheckOutTime);
  const actualCheckInAt = manilaTimestamp(missedCheckInDate, missedCheckInTime);
  const actualCheckOutAt = manilaTimestamp(missedCheckOutDate, missedCheckOutTime);
  const selectedHandler = hotelHandlers.find((staff) => String(staff.id) === String(selectedHandledBy));
  const recordedByName = String(authenticatedUser?.name
    || [authenticatedUser?.first_name, authenticatedUser?.last_name].filter(Boolean).join(' ')
    || '').trim();
  const isActualCheckInValid = Boolean(
    actualCheckInAt &&
    Number.isFinite(actualCheckInDate.getTime()) &&
    !missedCheckInTouched.checkInFuture
  );
  const isActualCheckOutValid = Boolean(
    actualCheckOutAt &&
    Number.isFinite(actualCheckOutDate.getTime()) &&
    !missedCheckInTouched.checkOutFuture &&
    isActualCheckInValid &&
    actualCheckOutDate > actualCheckInDate
  );
  const isMissedCheckInFormValid = Boolean(
    isActualCheckInValid &&
    isActualCheckOutValid &&
    missedCheckInReason.trim() &&
    confirmedHotelStay &&
    selectedHandler &&
    authenticatedUser?.id &&
    recordedByName &&
    isAuthorizedStaffUser(authenticatedUser)
  );

  if (!appointment) return null;

  const handleConfirmComplete = async () => {
    if (isGrooming && !groomerId) {
      setPayModalError('Please select who groomed the pet.');
      return;
    }
    setIsCompletingStatus(true);
    setPayModalError('');
    try {
      const extra = {
        ...(payReference ? { reference_number: payReference } : {}),
        ...(isGrooming && groomerId ? { handled_by: groomerId } : {}),
      };
      const ok = await onStatusChange?.(appointment, 'completed', extra);
      if (ok !== false) {
        // Mark the completion dialog as submitted so closing it does not undo this status update.
        payConfirmedRef.current = true;
        setShowPaymentModal(false);
      }
    } finally {
      setIsCompletingStatus(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptRef.current || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    let receiptClone = null;
    let pdfStyle = null;

    try {
      const sourceWidth = 620;
      receiptClone = receiptRef.current.cloneNode(true);
      receiptClone.setAttribute('data-pdf-receipt', 'true');
      receiptClone.style.position = 'fixed';
      receiptClone.style.left = '-10000px';
      receiptClone.style.top = '0';
      receiptClone.style.width = `${sourceWidth}px`;
      receiptClone.style.paddingTop = '28px';
      receiptClone.style.height = 'auto';
      receiptClone.style.maxHeight = 'none';
      receiptClone.style.overflow = 'visible';
      receiptClone.style.flex = 'none';

      pdfStyle = document.createElement('style');
      pdfStyle.textContent = `
        [data-pdf-receipt] {
          width: 620px !important;
          max-width: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          border: 1px solid rgba(23, 53, 81, 0.18) !important;
          background: #ffffff !important;
          color: #173551 !important;
          font-family: Poppins, Arial, sans-serif !important;
        }
        [data-pdf-receipt] [data-pdf-title] {
          display: block !important;
          padding: 18px 30px 14px !important;
          text-align: center !important;
          border-bottom: 1px dashed rgba(23, 53, 81, 0.28) !important;
          background: #ffffff !important;
        }
        [data-pdf-receipt] [data-pdf-title] p:first-child {
          color: #173551 !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          letter-spacing: 0.12em !important;
          text-transform: uppercase !important;
        }
        [data-pdf-receipt] [data-pdf-title] p:last-child {
          margin-top: 4px !important;
          color: rgba(23, 53, 81, 0.62) !important;
          font-size: 13px !important;
          font-weight: 700 !important;
        }
        [data-pdf-receipt] [data-pdf-inner-title],
        [data-pdf-receipt] [data-pdf-service-id],
        [data-pdf-receipt] [data-pdf-service-chip],
        [data-pdf-receipt] [data-pdf-inline-pet-id] {
          display: none !important;
        }
        [data-pdf-receipt] [data-pdf-pet-meta] {
          display: flex !important;
          flex-direction: column !important;
          gap: 2px !important;
          margin-top: 4px !important;
          color: rgba(23, 53, 81, 0.62) !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          line-height: 1.25 !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
        }
        [data-pdf-receipt] [data-pdf-footer] {
          display: block !important;
          margin-top: 0 !important;
          padding: 12px 18px !important;
          text-align: center !important;
          background: #ffffff !important;
          color: rgba(23, 53, 81, 0.72) !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          letter-spacing: 0 !important;
          border-top: 1px dashed rgba(23, 53, 81, 0.24) !important;
        }
        [data-pdf-receipt] [data-business-header] {
          background: #ffffff !important;
          background-image: none !important;
          border-bottom: 1px dashed rgba(23, 53, 81, 0.24) !important;
        }
        [data-pdf-receipt] [data-business-header] .absolute {
          display: none !important;
        }
        [data-pdf-receipt] [data-business-header] * {
          color: #173551 !important;
          text-shadow: none !important;
          filter: none !important;
        }
        [data-pdf-receipt] [data-receipt-scroll] {
          display: block !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 22px 28px 28px !important;
          background: #ffffff !important;
        }
        [data-pdf-receipt] [data-receipt-scroll] > div {
          box-shadow: none !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          padding: 0 !important;
        }
        [data-pdf-receipt] section {
          box-shadow: none !important;
          border: 1px dashed rgba(23, 53, 81, 0.22) !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          padding: 12px 16px !important;
          break-inside: avoid !important;
        }
        [data-pdf-receipt] section + section {
          margin-top: 8px !important;
        }
        [data-pdf-receipt] section > p:first-child {
          border-bottom: 1px dashed rgba(23, 53, 81, 0.24) !important;
          color: rgba(23, 53, 81, 0.66) !important;
          font-size: 12px !important;
          letter-spacing: 0.14em !important;
        }
        [data-pdf-receipt] .truncate {
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: normal !important;
        }
        [data-pdf-receipt] .min-w-0 {
          min-width: 0 !important;
        }
        [data-pdf-receipt] .flex {
          min-height: 0 !important;
        }
        [data-pdf-receipt] section:first-of-type > div:first-of-type {
          align-items: flex-start !important;
          gap: 12px !important;
        }
        [data-pdf-receipt] [data-pet-summary] {
          align-items: flex-start !important;
          gap: 16px !important;
        }
        [data-pdf-receipt] [data-pet-photo] {
          width: 112px !important;
          height: 112px !important;
          border-radius: 6px !important;
        }
        [data-pdf-receipt] [data-pet-summary-text] {
          min-height: 112px !important;
          justify-content: center !important;
        }
        [data-pdf-receipt] section:first-of-type p {
          line-height: 1.35 !important;
        }
        [data-pdf-receipt] section:first-of-type p.text-lg {
          font-size: 21px !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
        }
        [data-pdf-receipt] section:first-of-type .inline-flex {
          display: inline-flex !important;
          max-width: 100% !important;
          height: auto !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          line-height: 1.25 !important;
        }
        [data-pdf-receipt] [data-pdf-service-chip],
        [data-pdf-receipt] [data-pdf-service-chip].inline-flex {
          display: none !important;
        }
        [data-pdf-receipt] section:first-of-type .mt-4 {
          padding-top: 8px !important;
          padding-bottom: 8px !important;
        }
        [data-pdf-receipt] section:first-of-type .mt-4 > div {
          align-items: flex-start !important;
          gap: 10px !important;
          padding-top: 6px !important;
          padding-bottom: 6px !important;
        }
        [data-pdf-receipt] section:first-of-type .mt-4 span:last-child {
          max-width: 390px !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          line-height: 1.35 !important;
        }
        [data-pdf-receipt] img {
          border-radius: 4px !important;
        }
      `;
      document.head.appendChild(pdfStyle);

      const cloneScrollArea = receiptClone.querySelector('[data-receipt-scroll]');
      if (cloneScrollArea) {
        cloneScrollArea.style.overflow = 'visible';
        cloneScrollArea.style.height = 'auto';
        cloneScrollArea.style.maxHeight = 'none';
        cloneScrollArea.style.flex = 'none';
      }

      document.body.appendChild(receiptClone);
      await new Promise((resolve) => requestAnimationFrame(resolve));

      try {
        const businessHeader = receiptClone.querySelector('[data-business-header]');
        if (businessHeader) {
          businessHeader.style.display = 'block';
          businessHeader.style.backgroundImage = 'none';
          businessHeader.style.backgroundColor = '#ffffff';
          businessHeader.querySelectorAll('*').forEach((node) => {
            node.style.color = '#173551';
            node.style.textShadow = 'none';
          });
          const overlay = businessHeader.querySelector('.absolute');
          if (overlay) overlay.style.display = 'none';
        }
        const topHeader = receiptClone.querySelector('[data-receipt-top-header]');
        if (topHeader) topHeader.style.display = 'none';
      } catch {
        // The PDF can still be generated if optional receipt header tweaks fail.
      }

      const captureWidth = Math.ceil(receiptClone.scrollWidth);
      const captureHeight = Math.ceil(receiptClone.scrollHeight);
      const canvas = await html2canvas(receiptClone, {
        backgroundColor: '#ffffff',
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const imageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxImageWidth = pageWidth - margin * 2;
      const maxImageHeight = pageHeight - margin * 2;
      let imageWidth = maxImageWidth;
      let imageHeight = (canvas.height * imageWidth) / canvas.width;
      if (imageHeight > maxImageHeight) {
        imageHeight = maxImageHeight;
        imageWidth = (canvas.width * imageHeight) / canvas.height;
      }
      const x = (pageWidth - imageWidth) / 2;
      const y = (pageHeight - imageHeight) / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.addImage(imageData, 'PNG', x, y, imageWidth, imageHeight);

      const safeCode = String(raw?.appointment_code || appointmentDisplayId || 'appointment')
        .replace(/[^a-z0-9_-]+/gi, '-');
      const safeDate = new Date().toISOString().slice(0, 10);
      pdf.save(`appointment-${safeCode}-${safeDate}.pdf`);
    } finally {
      receiptClone?.remove();
      pdfStyle?.remove();
      setIsDownloadingPdf(false);
    }
  };

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[82] flex h-[100dvh] min-h-[100dvh] w-screen items-end justify-center overflow-hidden bg-brand-dark/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <div
            ref={receiptRef}
            className="relative flex max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-2xl bg-transparent font-poppins sm:max-h-[90vh] sm:max-w-4xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white text-brand-dark-soft shadow-[0_10px_24px_rgba(23,53,81,0.24)] transition hover:text-brand-dark"
          aria-label="Close appointment details"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
        <div data-business-header className="relative px-6 pb-4 pt-5" style={{
          backgroundImage: 'url(/assets/landing_bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'none',
        }}>
          <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/80 via-brand-dark/70 to-brand-teal-dark/80" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-paw text-xl text-white drop-shadow-lg" />
              <div className="text-left">
                <h2 className="text-lg font-extrabold uppercase leading-tight tracking-wide text-white drop-shadow-lg">The Fur Club</h2>
                <p className="text-[10px] text-white/95 drop-shadow">Pet Station - San Juan City</p>
              </div>
            </div>
            <div className="space-y-0.5 text-right text-[9px] text-white/90 drop-shadow">
              <p>0976 065 8031</p>
              <p>connect.thefurclub@gmail.com</p>
              <p>207 F. Blumentritt St.</p>
            </div>
          </div>
        </div>

        <div data-pdf-title style={{ display: 'none' }}>
          <p>Appointment Records</p>
          <p>{appointmentDisplayId}</p>
        </div>

        <div data-receipt-top-header className="shrink-0 px-4 pb-3 pt-4 sm:px-1 sm:pt-0">
          <div className="flex flex-col items-start gap-2 pr-12 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/75">Appointment Record</p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-3.5 w-3.5 rounded-full ring-2 ring-white/80"
                  style={{ backgroundColor: serviceCategoryDotColor }}
                  title={serviceCategoryLabel}
                  aria-label={`${serviceCategoryLabel} service color`}
                />
                <h2 className="mt-1 text-lg font-semibold text-white">View Appointment</h2>
              </div>
              <p className="mt-0.5 truncate text-xs text-white/80">{serviceCategoryLabel}</p>
            </div>
            <div className="min-w-0 text-left sm:shrink-0 sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Appointment ID</p>
              <p className="truncate text-sm font-bold text-white">{appointmentDisplayId}</p>
            </div>
          </div>
        </div>

        {isPendingReschedule && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:mx-1">
            <p className="text-xs font-semibold text-amber-700">
              Reschedule request — this appointment needs approval again.
            </p>
          </div>
        )}

        <div data-receipt-scroll className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-1 no-scrollbar sm:px-1">
          <div data-pdf-inner-title style={{ display: 'none' }}>
            <p>Appointment Details</p>
            <p>{appointmentDisplayId}</p>
          </div>

          <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <PetDetailsSection
                appointment={appointment}
                petDisplayId={petDisplayId}
                petSpecies={petSpecies}
                isHotel={isHotel}
                petSize={raw?.pet_size}
                petBreed={petBreed}
                petSex={formatPetSex(petSex)}
                petDateOfBirth={formatDateOnly(petDateOfBirth)}
                petAge={formatPetAge(petDateOfBirth)}
                petColor={petColor}
                petMedicalNotes={petMedicalNotes}
                hasPet={Boolean(pet?.id)}
                onViewAssessment={() => setShowAssessmentForm(true)}
              />

              <section className="flex h-full flex-col rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
                <div className="flex items-start justify-between gap-4 border-b border-brand-dark-light pb-3">
                  <h3 className="text-sm font-semibold text-brand-dark">Service Details</h3>
                  <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass}`}>{statusLabel}</span>
                </div>
                <div className="mt-4 grid flex-1 content-start gap-3 sm:grid-cols-2">
                  <SimpleField label="Category" value={serviceCategoryLabel} />
                  <SimpleField label="Date & Time" value={isHotel ? hotelCheckInDisplay : `${appointmentDate} at ${appointmentTime}`} />
                  {isHotel && raw?.hotel_nights && <SimpleField label="Check-out" value={`${hotelCheckOutDisplay} (${raw.hotel_nights} night${raw.hotel_nights > 1 ? 's' : ''})`} />}
                  {isHotel && <SimpleField label="Actual Check-In Time" value={actualCheckInDisplay || '-'} />}
                  {isHotel && (
                    <SimpleField
                      label="Check-In Status"
                      value={actualCheckInDisplay ? (lateCheckinIndicator ? 'Late Check-In' : 'Arrived On Time') : '-'}
                    />
                  )}
                  {isHotel && lateCheckinIndicator && (
                    <SimpleField
                      label="Check-In Delay"
                      value={`Late by: ${Math.floor(Math.abs(checkinDiffMinutes) / 60)} hours ${Math.abs(checkinDiffMinutes) % 60} minutes`}
                    />
                  )}
                  {isHotel && lateCheckinIndicator && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Notice: This hotel appointment checked in later than the scheduled arrival time.
                    </p>
                  )}
                  {isHotel && lateCheckinIndicator && lateCheckinReasonLabel && <SimpleField label="Late Check-In Reason" value={lateCheckinReasonLabel} />}
                  {isHotel && lateCheckinIndicator && String(raw?.late_checkin_reason || '') === 'other' && raw?.late_checkin_other_reason && (
                    <SimpleField label="Additional Notes" value={raw.late_checkin_other_reason} />
                  )}
                  {isHotel && hasMissedCheckInCorrection && (
                    <SimpleField label="Missed Check-In Correction" value={missedCheckInCorrectionNotes} />
                  )}
                  {isHotel && lateCheckinIndicator && raw?.late_checkin_staff_notes && !hasMissedCheckInCorrection && (
                    <SimpleField label="Staff Notes (Optional)" value={raw.late_checkin_staff_notes} />
                  )}
                  {isHotel && <SimpleField label="Actual Check-Out Time" value={actualCheckOutDisplay || '-'} />}
                  {isHotel && (
                    <SimpleField
                      label="Check-Out Status"
                      value={actualCheckOutDisplay ? (lateCheckoutIndicator ? 'Late Check-Out' : 'Released On Time') : '-'}
                    />
                  )}
                  {isHotel && lateCheckoutIndicator && (
                    <SimpleField
                      label="Delay Duration"
                      value={`Late by: ${Math.floor(Math.abs(checkoutDiffMinutes) / 60)} hours ${Math.abs(checkoutDiffMinutes) % 60} minutes`}
                    />
                  )}
                  {isHotel && lateCheckoutIndicator && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Notice: This hotel appointment exceeded the scheduled check-out time by {Math.floor(Math.abs(checkoutDiffMinutes) / 60)} hour(s) and {Math.abs(checkoutDiffMinutes) % 60} minute(s).
                    </p>
                  )}
                  {isHotel && lateCheckoutIndicator && lateCheckoutReasonLabel && <SimpleField label="Late Check-Out Reason" value={lateCheckoutReasonLabel} />}
                  {isHotel && lateCheckoutIndicator && String(raw?.late_checkout_reason || '') === 'other' && raw?.late_checkout_other_reason && (
                    <SimpleField label="Staff Notes (Specify)" value={raw.late_checkout_other_reason} />
                  )}
                  {isHotel && lateCheckoutIndicator && String(raw?.late_checkout_reason || '') === 'other' && raw?.late_checkout_staff_notes && (
                    <SimpleField label="Staff Notes (Specify)" value={raw.late_checkout_staff_notes} />
                  )}
                  {isHotel && lateCheckoutIndicator && String(raw?.late_checkout_reason || '') === 'other' && !raw?.late_checkout_staff_notes && raw?.late_checkout_notes && (
                    <SimpleField label="Staff Notes (Specify)" value={raw.late_checkout_notes} />
                  )}
                  {isPawsomeExtrasAppointment ? (
                    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                      <div className="space-y-3">
                        <SimpleField label="Booked Service ID" value={bookedPackageId || legacyBookedPackageId || '-'} />
                        <SimpleField label="Handled By" value={handledByName || '-'} />
                      </div>
                      <div className="space-y-3">
                        <SimpleField label="Service" value={packageName} />
                        {addons.length > 0 && (
                          <div>
                            <ul className="list-disc space-y-1 pl-5 text-xs font-semibold leading-relaxed text-brand-dark">
                              {addons.map((addon) => (
                                <li key={addon.id}>{addon.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <SimpleField label="Booked Package ID" value={bookedPackageId || legacyBookedPackageId || '-'} />
                      {!isHotel && <SimpleField label="Handled By" value={handledByName || '-'} />}
                      <SimpleField label="Package" value={packageName} />
                      {isDaycare && <SimpleField label="Daycare Duration" value={toTitleCase(String(raw?.daycare_duration || '-').replace(/_/g, ' '))} />}
                      {isDaycare && <SimpleField label="Daycare Size" value={toTitleCase(String(raw?.size_label || '-').replace(/_/g, ' '))} />}
                    </>
                  )}
                  {isHotel && normalizedStatus === 'completed' && (
                    <div className="sm:col-span-2">
                      <HotelStayCorrectionHistory appointmentId={appointment?.id} />
                    </div>
                  )}
                  {isHotel && raw?.hotel_extension_charge && (
                    <div className="sm:col-span-2 rounded-xl border border-brand-teal/20 bg-white p-4">
                      <h3 className="mb-3 text-sm font-semibold text-brand-dark">Extended Stay Charges</h3>
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        <SimpleField label="Scheduled Checkout" value={formatDateTime(raw.hotel_extension_charge.scheduled_checkout_at)} />
                        <SimpleField label="Actual Checkout" value={formatDateTime(raw.hotel_extension_charge.actual_checkout_at)} />
                        <SimpleField label="Extra Time" value={`${raw.hotel_extension_charge.extra_minutes} minute(s)`} />
                        <SimpleField label="Billable Hours" value={raw.hotel_extension_charge.billable_hours} />
                        <SimpleField label="Pet Size" value={raw.hotel_extension_charge.pet_size} />
                        <SimpleField label="Daycare Hourly Rate" value={`PHP ${Number(raw.hotel_extension_charge.hourly_rate).toFixed(2)}`} />
                        <SimpleField label="Extension Charge" value={`PHP ${Number(raw.hotel_extension_charge.amount).toFixed(2)}`} />
                        <SimpleField label="Payment Method" value={toTitleCase(raw.hotel_extension_charge.payment_method?.replace(/_/g, ' '))} />
                        <SimpleField label="Payment Status" value={toTitleCase(raw.hotel_extension_charge.payment_status)} />
                        <SimpleField label="Handled By" value={raw.hotel_extension_charge.handled_by_name || handledByName || '-'} />
                        <SimpleField label="Recorded By" value={raw.hotel_extension_charge.recorded_by_name || '-'} />
                        <SimpleField label="Recorded At" value={formatDateTime(raw.hotel_extension_charge.recorded_at)} />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <OwnerDetailsSection
                ownerName={ownerName}
                contact={contact}
                email={email}
                address={ownerAddress}
              />

              <section className="rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
                <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Estimated Charges</h3>
                {isHotel && !isCashPayment && paymentAccountsLoading && (
                  <p role="status" className="mt-3 rounded-lg border border-brand-teal/15 bg-white px-3 py-2.5 text-xs font-semibold text-brand-dark-soft">Loading payment account details...</p>
                )}
                {isHotel && !isCashPayment && paymentAccountsError && (
                  <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">Payment account details could not be loaded.</p>
                )}
                <div className="mt-4 grid items-start gap-x-6 gap-y-4 sm:grid-cols-2">
                  <SimpleField label="Selected Service" value={packageName || '-'} />
                  <SimpleField label="Estimated Total" value={`PHP ${Number(grandTotal || 0).toFixed(2)}`} />
                  {isPawsomeExtrasAppointment && addons.length > 0 && (
                    <div className="sm:col-span-2">
                      <div className="space-y-1.5">
                        {addons.map((addon) => (
                          <div key={addon.id} className="flex items-start justify-between gap-4 text-xs font-semibold leading-relaxed">
                            <span className="text-brand-dark">{addon.name}</span>
                            <span className="shrink-0 font-semibold text-brand-dark">PHP {Number(addon.price || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <SimpleField label="Service Cost" value={`PHP ${Number(displayedServiceTotal || 0).toFixed(2)}`} />
                  {isHotel && <SimpleField label="Deposit Due Now" value={`PHP ${firstPaymentAmount.toFixed(2)}`} />}
                  {!isPawsomeExtrasAppointment && addonTotalForPayment > 0 && <SimpleField label="Pawsome Extras Estimated Charges" value={`PHP ${Number(addonTotalForPayment || 0).toFixed(2)}`} />}
                  {isHotel && (
                    <>
                      <p className="sm:col-span-2 border-b border-brand-dark-light pb-2 text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Payment Details</p>
                      {!isCashPayment && <SimpleField label="Payment To" value={paymentToDisplay || '-'} />}
                      {!isCashPayment && (selectedReceivingAccount?.account_name || selectedReceivingAccount?.account_number) && (
                        <SimpleField
                          label="Receiving Account"
                          value={<>{selectedReceivingAccount.account_name || '-'}{selectedReceivingAccount.account_number && <><br />{selectedReceivingAccount.account_number}</>}</>}
                        />
                      )}
                      {paymentModeDisplay && <SimpleField label="Payment From" value={paymentModeDisplay} />}
                      {!isCashPayment && (payerProviderDisplay || legacyProviderDisplay) && <SimpleField label="Provider" value={payerProviderDisplay || legacyProviderDisplay} />}
                      {!isCashPayment && referenceDisplay && referenceDisplay !== '-' && <SimpleField label="Reference Number" value={referenceDisplay} />}
                      <SimpleField label="Remaining Balance" value={`PHP ${remainingBalance.toFixed(2)}`} />
                      {!isCashPayment && hasPaymentProof && (
                        <div>
                          <p className="text-[10px] font-semibold text-brand-dark-soft">Payment Proof</p>
                          <button
                            type="button"
                            onClick={() => setShowPaymentProof(true)}
                            className="mt-1 inline-flex h-9 items-center rounded-lg border border-brand-teal/20 bg-brand-surface px-3 text-xs font-semibold text-brand-teal-dark transition hover:border-brand-teal"
                            title="Preview payment proof"
                          >
                            View payment proof
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {!isHotel && referenceDisplay && referenceDisplay !== '-' && (
                    <>
                      <p className="sm:col-span-2 border-b border-brand-dark-light pb-2 text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Payment Details</p>
                      <SimpleField label="Payment Reference Number" value={referenceDisplay} />
                    </>
                  )}
                  <p className="sm:col-span-2 text-[11px] font-normal italic leading-relaxed text-amber-600">The displayed total is an estimate and may change after confirming the pet&apos;s actual size, selected preferences, and any additional services provided.</p>
                </div>
              </section>
          </div>

          {specialInstructions && (
            <div className="mt-4 rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
              <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Notes</h3>
              <p className="mt-3 text-xs leading-relaxed text-brand-dark">{specialInstructions}</p>
            </div>
          )}

          {normalizedStatus === 'cancelled' && (cancellationReason || cancellationTypeLabel || cancelledAtDisplay || cancelledByName) && (
            <div className="mt-4 rounded-xl border border-red-100 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
              <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Cancellation</h3>
              <div className="mt-3 space-y-1 text-xs text-red-600">
                {cancellationTypeLabel && <p><span className="font-semibold">Type:</span> {cancellationTypeLabel}</p>}
                {cancelledAtDisplay && <p><span className="font-semibold">Cancelled At:</span> {cancelledAtDisplay}</p>}
                {cancelledByName && <p><span className="font-semibold">Cancelled By:</span> {cancelledByName}</p>}
                {cancellationReason && <p><span className="font-semibold">Reason:</span> {formatCancellationReason(cancellationReason)}</p>}
              </div>
            </div>
          )}

          <div data-pet-summary style={{ display: 'none' }}>
            <div data-pet-photo>
              {resolvedPetPhotoUrl && <img src={resolvedPetPhotoUrl} alt={appointment.pet || 'Pet'} />}
            </div>
            <div data-pet-summary-text>{appointment.pet || '--'}</div>
            <div data-pdf-pet-meta>
              <span>Pet ID: {petDisplayId}</span>
              <span>Breed: {petBreed || '-'}</span>
            </div>
          </div>
        </div>

        {!isCompleted && !isCancelled && <div data-html2canvas-ignore="true" className="mt-3 rounded-xl border border-brand-teal/15 bg-white px-4 py-2.5 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 lg:max-w-44 lg:shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Actions</p>
              <p className="text-xs font-semibold leading-4 text-brand-dark">Manage this appointment</p>
            </div>
            <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {suppliesEnabled && (
              <>
                {canAddRetailPurchase && (
                  <button
                    type="button"
                    onClick={openRetailPurchaseModal}
                    style={{ '--appointment-category-color': serviceCategoryDotColor }}
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-md border border-pink-400 bg-white px-4 text-center text-[13px] font-semibold leading-none text-pink-500 transition hover:bg-pink-500 hover:text-white active:bg-pink-500 active:text-white sm:w-auto"
                  >
                    {retailSales.length > 0 ? 'Edit Retail Purchase' : 'Add Retail Purchase'}
                  </button>
                )}
              </>
            )}
            {canEditAppointment && !isPending && (
              <button
                type="button"
                onClick={() => {
                  if (isPastGracePeriod) {
                    setShowRescheduleModal(true);
                    return;
                  }
                  onEdit?.(appointment);
                }}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-md border border-brand-teal/30 bg-white px-4 text-center text-[13px] font-semibold leading-none text-brand-teal-dark transition hover:bg-brand-teal/10 sm:w-auto"
              >
                {isPastGracePeriod ? 'Reschedule' : 'Edit Appointment'}
              </button>
            )}
            {!isCompleted && !isCancelled && (
              <AppointmentStatusControl
                status={appointment?.status}
                isFuture={Boolean(appointment?.dateIso && appointment.dateIso > toIso(new Date()))}
                isPast={isPastAppointmentDate}
                isHotel={isHotel}
                hasHotelCheckIn={Boolean(raw?.actual_check_in_at)}
                hasHotelCheckOut={Boolean(raw?.actual_check_out_at)}
                canCompleteMissedHotelStay={isHotel && !raw?.actual_check_in_at && !raw?.actual_check_out_at}
                isNoShowEligible={isNoShowEligible}
                allowedStatuses={isAssignedGroomer ? ['in_progress', 'completed'] : null}
                disabled={isSaving}
                onChange={async (nextStatus) => {
                  if (nextStatus === 'complete_missed_checkin') {
                    resetMissedCheckInModal();
                    setShowMissedCheckInModal(true);
                    return;
                  }
                  if (nextStatus === 'completed' && isGrooming && !handledByName) {
                    openPaymentModal();
                    return;
                  }
                  if (nextStatus === 'completed' && isHotel) {
                    setHotelCheckoutMode('normal');
                    return;
                  }
                  if (nextStatus === 'cancelled' && onRequestCancel) {
                    onRequestCancel(appointment);
                    return;
                  }
                  const options = nextStatus === 'cancelled' && isPending ? { cancellation_reason: 'Not approved' } : undefined;
                  const ok = await onStatusChange?.(appointment, nextStatus, options);
                  if (ok !== false && (nextStatus === 'approved' || nextStatus === 'in_progress')) onClose?.();
                }}
              />
            )}
            </div>
          </div>
          {isHotel && normalizedStatus === 'in_progress' && !raw?.actual_check_out_at && (
            <p className="mt-2 text-[10px] leading-4 text-brand-dark-soft sm:text-right">
              To complete the stay, use Edit Appointment to record and confirm the actual check-out date and time.
            </p>
          )}
          {suppliesEnabled && retailSales.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 border-t border-brand-dark-light pt-2">
              {retailSales.map((sale) => (
                <div key={sale.id || sale.receipt_number} className="min-w-0 rounded-lg bg-brand-surface px-2.5 py-2 sm:max-w-64">
                  <p className="truncate text-[11px] font-semibold text-brand-dark">{sale.receipt_number || 'Retail purchase'}</p>
                  <p className="text-[11px] font-bold text-brand-teal-dark">PHP {Number(sale.total_amount || 0).toFixed(2)}</p>
                  {sale.payment_method && <p className="truncate text-[10px] text-brand-dark-soft">Paid From: {getPaymentLabel(sale.payment_method, sale.payment_channel)}</p>}
                  {sale.payment_received_by && <p className="truncate text-[10px] text-brand-dark-soft">Paid To: {getReceivingAccountLabel(sale.payment_received_by)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>}

        <div data-pdf-footer style={{ display: 'none' }}>
          © The Fur Club 2026. Made by PawsitiveCare.
        </div>

      </div>
    </div>,
        document.body
      )}

      {/* Completion modal appears after clicking Mark as Complete */}
      <PaymentProofPreviewModal isOpen={showPaymentProof} appointmentId={appointment?.id} bookingId={appointment?.displayId || appointment?.id} onClose={() => setShowPaymentProof(false)} />

      {showMissedCheckInModal && createPortal(
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-brand-dark/25 p-4 backdrop-blur-[1px]"
          onClick={() => !isCompletingStatus && resetMissedCheckInModal()}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-brand-teal px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-white">Complete Missed Check-In</h3>
                <p className="text-[11px] text-white/75">{appointmentDisplayId}</p>
              </div>
              <button
                type="button"
                disabled={isCompletingStatus}
                onClick={resetMissedCheckInModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-40"
                aria-label="Close missed check-in completion"
              >
                <X size={16} strokeWidth={2.8} />
              </button>
            </div>
            <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-3 rounded-xl border border-brand-dark-light bg-brand-surface/50 p-3 text-xs sm:grid-cols-3">
                <SimpleField label="Pet" value={pet?.name || appointment?.petName || '-'} />
                <SimpleField label="Scheduled Check-In" value={hotelCheckInDisplay || '-'} />
                <SimpleField label="Scheduled Check-Out" value={hotelCheckOutDisplay || '-'} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <fieldset className="min-w-0 rounded-xl border border-brand-dark-light p-3">
                  <legend className="px-1 text-xs font-bold text-brand-dark">Actual Check-In <span className="text-red-600">*</span></legend>
                  <div className="grid gap-2">
                    <label className="block text-[11px] font-semibold text-brand-dark-soft">
                      Date
                      <input
                        type="date"
                        value={missedCheckInDate}
                        onBlur={() => setMissedCheckInTouched((current) => ({ ...current, checkIn: true }))}
                        onChange={(event) => {
                          const date = event.target.value;
                          const timestamp = parseManilaDateTime(date, missedCheckInTime);
                          setMissedCheckInDate(date);
                          setMissedCheckInTouched((current) => ({
                            ...current,
                            checkInFuture: Number.isFinite(timestamp.getTime()) && timestamp.getTime() > Date.now(),
                          }));
                          setMissedCheckInError('');
                        }}
                        aria-label="Actual check-in date"
                        aria-invalid={Boolean(missedCheckInTouched.checkIn && !missedCheckInDate)}
                        className="mt-1 block h-10 w-full rounded-md border border-brand-dark-light bg-white px-3 text-sm font-medium text-brand-dark focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                      />
                      <span className="mt-1 block text-[10px] font-medium text-brand-dark-soft">{formatReadableDate(missedCheckInDate)}</span>
                    </label>
                    <div>
                      <span className="text-[11px] font-semibold text-brand-dark-soft">Time (Asia/Manila)</span>
                      <div className="mt-1">
                        <HotelClockPicker
                          value={missedCheckInTime}
                          onBlur={() => setMissedCheckInTouched((current) => ({ ...current, checkIn: true }))}
                          onChange={(value) => {
                            setMissedCheckInTime(value);
                            const date = parseManilaDateTime(missedCheckInDate, value);
                            setMissedCheckInTouched((current) => ({
                              ...current,
                              checkInFuture: Number.isFinite(date.getTime()) && date.getTime() > Date.now(),
                            }));
                            setMissedCheckInError('');
                          }}
                        />
                      </div>
                      {missedCheckInTouched.checkIn && (!missedCheckInDate || !clockToValue(missedCheckInTime)) && (
                        <span className="mt-1 block text-[11px] font-medium text-red-700">Enter the actual check-in date and time.</span>
                      )}
                      {missedCheckInTouched.checkInFuture && <span className="mt-1 block text-[11px] font-medium text-red-700">Actual check-in cannot be in the future.</span>}
                    </div>
                  </div>
                </fieldset>
                <fieldset className="min-w-0 rounded-xl border border-brand-dark-light p-3">
                  <legend className="px-1 text-xs font-bold text-brand-dark">Actual Check-Out <span className="text-red-600">*</span></legend>
                  <div className="grid gap-2">
                    <label className="block text-[11px] font-semibold text-brand-dark-soft">
                      Date
                      <input
                        type="date"
                        value={missedCheckOutDate}
                        onBlur={() => setMissedCheckInTouched((current) => ({ ...current, checkOut: true }))}
                        onChange={(event) => {
                          const date = event.target.value;
                          const timestamp = parseManilaDateTime(date, missedCheckOutTime);
                          setMissedCheckOutDate(date);
                          setMissedCheckInTouched((current) => ({
                            ...current,
                            checkOutFuture: Number.isFinite(timestamp.getTime()) && timestamp.getTime() > Date.now(),
                          }));
                          setMissedCheckInError('');
                        }}
                        aria-label="Actual check-out date"
                        aria-invalid={Boolean(missedCheckInTouched.checkOut && !missedCheckOutDate)}
                        className="mt-1 block h-10 w-full rounded-md border border-brand-dark-light bg-white px-3 text-sm font-medium text-brand-dark focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                      />
                      <span className="mt-1 block text-[10px] font-medium text-brand-dark-soft">{formatReadableDate(missedCheckOutDate)}</span>
                    </label>
                    <div>
                      <span className="text-[11px] font-semibold text-brand-dark-soft">Time (Asia/Manila)</span>
                      <div className="mt-1">
                        <HotelClockPicker
                          value={missedCheckOutTime}
                          onBlur={() => setMissedCheckInTouched((current) => ({ ...current, checkOut: true }))}
                          onChange={(value) => {
                            setMissedCheckOutTime(value);
                            const date = parseManilaDateTime(missedCheckOutDate, value);
                            setMissedCheckInTouched((current) => ({
                              ...current,
                              checkOutFuture: Number.isFinite(date.getTime()) && date.getTime() > Date.now(),
                            }));
                            setMissedCheckInError('');
                          }}
                        />
                      </div>
                      {missedCheckInTouched.checkOut && (!missedCheckOutDate || !clockToValue(missedCheckOutTime)) && (
                        <span className="mt-1 block text-[11px] font-medium text-red-700">Enter the actual check-out date and time.</span>
                      )}
                      {missedCheckInTouched.checkOutFuture && <span className="mt-1 block text-[11px] font-medium text-red-700">Actual check-out cannot be in the future.</span>}
                      {missedCheckInTouched.checkOut && isActualCheckInValid && actualCheckOutAt && actualCheckOutDate <= actualCheckInDate && (
                        <span className="mt-1 block text-[11px] font-medium text-red-700">Actual check-out must be after check-in.</span>
                      )}
                    </div>
                  </div>
                </fieldset>
              </div>
              <div className="space-y-2 rounded-xl border border-brand-dark-light p-3">
                <label htmlFor="hotel-handled-by-search" className="block text-xs font-bold text-brand-dark">Handled By <span className="text-red-600">*</span></label>
                <input
                  id="hotel-handled-by-search"
                  type="search"
                  value={staffSearch}
                  onChange={(event) => setStaffSearch(event.target.value)}
                  placeholder="Search staff name or Staff ID"
                  className="h-10 w-full rounded-md border border-brand-dark-light bg-white px-3 text-sm text-brand-dark placeholder:text-brand-dark-soft focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                />
                <select
                  value={selectedHandledBy}
                  onBlur={() => setMissedCheckInTouched((current) => ({ ...current, handledBy: true }))}
                  onChange={(event) => { setSelectedHandledBy(event.target.value); setMissedCheckInError(''); }}
                  aria-label="Staff member who handled the Hotel Suite stay"
                  aria-invalid={Boolean(missedCheckInTouched.handledBy && !selectedHandledBy)}
                  disabled={loadingHotelHandlers || Boolean(hotelHandlersError)}
                  className="h-10 w-full rounded-md border border-brand-dark-light bg-white px-3 text-sm font-medium text-brand-dark focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 disabled:bg-brand-surface"
                >
                  <option value="">{loadingHotelHandlers ? 'Loading staff…' : 'Select staff member'}</option>
                  {hotelHandlers
                    .filter((staff) => {
                      const query = staffSearch.trim().toLowerCase();
                      return !query || `${staff.name || ''} ${staff.display_id || ''}`.toLowerCase().includes(query);
                    })
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}{staff.display_id ? ` (${staff.display_id})` : ''}
                      </option>
                    ))}
                </select>
                {hotelHandlersError && <p role="alert" className="text-[11px] font-semibold text-red-700">{hotelHandlersError}</p>}
                {missedCheckInTouched.handledBy && !selectedHandledBy && !hotelHandlersError && (
                  <p className="text-[11px] font-medium text-red-700">Select the staff member who handled the stay.</p>
                )}
                <p className="text-[11px] text-brand-dark-soft">
                  Recorded By: <span className="font-semibold text-brand-dark">{recordedByName || 'Signed-in user unavailable'}{authenticatedUser ? ` (${displayRole(authenticatedUser)})` : ''}</span>
                </p>
              </div>
              <label className="block text-xs font-semibold text-brand-dark">
                Reason the check-in was not recorded <span className="text-red-600">*</span>
                <textarea
                  value={missedCheckInReason}
                  onBlur={() => setMissedCheckInTouched((current) => ({ ...current, reason: true }))}
                  onChange={(event) => { setMissedCheckInReason(event.target.value); setMissedCheckInError(''); }}
                  rows={3}
                  maxLength={1000}
                  aria-invalid={Boolean(missedCheckInTouched.reason && !missedCheckInReason.trim())}
                  className="mt-1.5 w-full resize-y rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm font-normal focus:border-brand-teal focus:outline-none"
                />
                {missedCheckInTouched.reason && !missedCheckInReason.trim() && (
                  <span className="mt-1 block text-[11px] font-medium text-red-700">Provide the reason the check-in was not recorded.</span>
                )}
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs leading-5 transition-colors ${confirmedHotelStay ? 'border-brand-teal bg-brand-teal/10 text-brand-teal-dark' : 'border-brand-dark-light bg-white text-brand-dark'}`}>
                <input
                  id="confirm-hotel-stay-completed"
                  type="checkbox"
                  checked={confirmedHotelStay}
                  onBlur={() => setMissedCheckInTouched((current) => ({ ...current, confirmation: true }))}
                  onChange={(event) => { setConfirmedHotelStay(event.target.checked); setMissedCheckInError(''); }}
                  className="relative z-10 mt-0.5 block h-5 w-5 shrink-0 cursor-pointer appearance-auto opacity-100 accent-brand-teal"
                />
                <span className="select-none font-medium">
                  I confirm the pet actually stayed and the Hotel Suite service was completed.
                </span>
                {missedCheckInTouched.confirmation && !confirmedHotelStay && (
                  <span className="ml-auto text-[11px] font-medium text-red-700">Required</span>
                )}
              </label>
              {missedCheckInError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {missedCheckInError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-brand-dark-light px-5 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isCompletingStatus}
                onClick={resetMissedCheckInModal}
                className="rounded-xl border border-brand-dark-light bg-white px-4 py-2 text-sm font-medium text-brand-dark-soft hover:bg-brand-surface disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCompletingStatus || loadingHotelHandlers || !isMissedCheckInFormValid}
                onClick={() => setHotelCheckoutMode('missed')}
                className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCompletingStatus ? 'Saving...' : 'Confirm Completion'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {hotelCheckoutMode && (
        <HotelCheckoutConfirmation
          appointmentId={appointment.id}
          actualCheckin={hotelCheckoutMode === 'missed' ? actualCheckInAt : raw?.actual_check_in_at}
          actualCheckout={hotelCheckoutMode === 'missed' ? actualCheckOutAt : raw?.actual_check_out_at}
          initialPetSize={raw?.pet_size || ''}
          species={raw?.pet?.species_type?.name || raw?.pet?.speciesType?.name || ''}
          saving={isCompletingStatus}
          onCancel={() => setHotelCheckoutMode('')}
          onConfirm={async (payment) => {
            setIsCompletingStatus(true);
            try {
              const extra = hotelCheckoutMode === 'missed' ? {
                actual_check_in_at: actualCheckInAt,
                actual_check_out_at: actualCheckOutAt,
                handled_by: selectedHandledBy,
                missed_checkin_reason: missedCheckInReason.trim(),
                confirm_hotel_stay_completed: true,
              } : { actual_check_out_at: raw?.actual_check_out_at };
              const ok = await onStatusChange?.(appointment, 'completed', { ...extra, ...payment, hotel_checkout_confirmed: true });
              if (ok !== false) {
                setHotelCheckoutMode('');
                if (hotelCheckoutMode === 'missed') resetMissedCheckInModal();
              }
              return ok;
            } finally {
              setIsCompletingStatus(false);
            }
          }}
        />
      )}

      {showPaymentModal && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-dark/15 p-4 backdrop-blur-[1px] overscroll-contain"
          onClick={() => !isCompletingStatus && closePaymentModal()}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-brand-teal px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-white">Complete Service</h3>
                <p className="text-[11px] text-white/70">{appointmentDisplayId}</p>
              </div>
              <button
                type="button"
                disabled={isCompletingStatus}
                onClick={() => closePaymentModal()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-40"
                aria-label="Close completion modal"
              >
                <X size={16} strokeWidth={2.8} />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {/* Groomer selection — grooming appointments only */}
              {isGrooming && (
                <div className="mb-4">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                    Groomer Who Handled Grooming <span className="text-red-500">*</span>
                  </label>
                  <SelectDropdown
                    value={groomerId}
                    onChange={(v) => { setGroomerId(v); setPayModalError(''); }}
                    options={[
                      { value: '', label: groomers.length ? '- Select Groomer -' : '- No groomers currently on duty -' },
                      ...groomers.map((g) => ({ value: String(g.id), label: g.name })),
                    ]}
                    placeholder="- Select Groomer -"
                  />
                  {!groomers.length && <p className="mt-1 text-xs text-brand-dark-soft">A groomer must Time In before being assigned to this service.</p>}
                </div>
              )}

              {loadingPaymentModes ? (
                <p className="py-4 text-center text-xs text-brand-dark-soft">Loading payment options...</p>
              ) : (
                <div className="space-y-4">
                  {/* Estimated Charges Summary - Always show */}
                  <div className="rounded-xl border border-brand-dark-light bg-brand-teal-light/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Estimated Charges Summary</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-brand-dark-soft">Service Total</span>
                        <span className="font-medium text-brand-dark">PHP {Number(displayedServiceTotal || 0).toFixed(2)}</span>
                      </div>
                      {!isPawsomeExtrasAppointment && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-brand-dark-soft">Pawsome Extras Total</span>
                          <span className="font-medium text-brand-dark">PHP {Number(addonTotalForPayment || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4 border-t border-brand-dark-light pt-2">
                        <span className="text-brand-dark-soft">Estimated Total</span>
                        <span className="font-bold text-brand-dark">PHP {Number(totalCharges || 0).toFixed(2)}</span>
                      </div>
                      {isHotel && <div className="flex items-center justify-between gap-4">
                        <span className="text-brand-dark-soft">Reservation Deposit Reference</span>
                        <span className="font-bold text-brand-dark">PHP {firstPaymentAmount.toFixed(2)}</span>
                      </div>}
                      <div className="flex items-center justify-between gap-4 border-t border-brand-dark-light pt-2">
                        <span className="font-extrabold text-brand-dark">Estimated Remaining Charge</span>
                        <span className="text-2xl font-extrabold text-brand-teal-dark">PHP {Number(payableAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {isHotel && <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Reservation Reference Type</label>
                    <SelectDropdown
                      value={payMode}
                      onChange={(nextMode) => {
                        setPayMode(nextMode);
                        setPayBankName('');
                        if (nextMode === 'cash') setPayReference('');
                        setPayModalError('');
                      }}
                      options={[
                        { value: '', label: '- Not Recorded -' },
                        { value: 'cash', label: 'Cash' },
                        { value: 'e_wallet', label: 'E-Wallet' },
                        { value: 'bank_transfer', label: 'Bank Transfer' },
                      ]}
                      placeholder="- Not Recorded -"
                    />
                  </div>}

                  {isHotel && (payMode === 'e_wallet' || payMode === 'bank_transfer') && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                        {payMode === 'e_wallet' ? 'Paid From E-Wallet' : 'Paid From Bank'}
                      </label>
                      <SelectDropdown
                        value={payBankName}
                        onChange={(value) => {
                          setPayBankName(value);
                          setPayModalError('');
                        }}
                        options={[
                          { value: '', label: `Select ${payMode === 'e_wallet' ? 'e-wallet' : 'bank'}` },
                          ...Object.entries(paymentModes?.[payMode === 'e_wallet' ? 'E-Wallets' : 'Banks'] || {}).map(([value, label]) => ({ value, label })),
                        ]}
                        placeholder={`Select ${payMode === 'e_wallet' ? 'e-wallet' : 'bank'}`}
                      />
                    </div>
                  )}

                  {isHotel && <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Reservation Reference Date</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(event) => {
                        setPayDate(event.target.value);
                        setPayModalError('');
                      }}
                      className="w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                    />
                  </div>}

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Estimated Remaining Charge (PHP)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payDeposit}
                      onChange={(event) => {
                          setPayDeposit(event.target.value);
                          payAutoFilledRef.current = false;
                          setPayModalError('');
                      }}
                      placeholder="0.00"
                      readOnly={isPartiallyPaidHotel}
                      className="w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none read-only:bg-brand-dark-light/30"
                    />
                  </div>

                  {payMode !== 'cash' && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">{isHotel ? 'Reservation Reference Number' : 'Payment Reference Number'}</label>
                      <input
                        type="text"
                        value={payReference}
                        onChange={(event) => {
                          setPayReference(sanitizeReferenceNumber(event.target.value));
                          setPayModalError('');
                        }}
                        placeholder="Transaction reference"
                        maxLength="30"
                        className="w-full rounded-lg border border-brand-dark-light px-3 py-2.5 font-mono text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

                  {payModalError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                  {payModalError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 border-t border-brand-dark-light px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={isCompletingStatus || isSaving}
                onClick={closePaymentModal}
                className="inline-flex items-center justify-center rounded-xl border border-brand-dark-light bg-white px-5 py-2 text-sm font-medium text-brand-dark-soft transition hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:ring-offset-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCompletingStatus || isSaving}
                onClick={handleConfirmComplete}
                className="inline-flex min-w-36 items-center justify-center rounded-xl bg-brand-teal px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60"
              >
                {isCompletingStatus ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <PetAssessmentFormModal
        isOpen={showAssessmentForm}
        onClose={() => setShowAssessmentForm(false)}
        pet={pet?.id ? pet : null}
        apiBase="/api/pets"
        serviceId={raw?.service_id || raw?.service?.id || null}
        appointmentId={raw?.id || appointment?.id || null}
        serviceCategory={serviceCategoryRaw}
        theme="pet_owner"
        readOnly
      />
      {suppliesEnabled && showRetailSaleModal && (
        <WalkInSaleModal
          appointmentId={raw?.id || appointment?.id || null}
          initialCustomerName={ownerName === '-' ? '' : ownerName}
          hidePayment
          editingSale={editingRetailSale}
          onClose={() => {
            setShowRetailSaleModal(false);
            setEditingRetailSale(null);
          }}
          onSaved={handleRetailSaleSaved}
        />
      )}
      {showRescheduleModal && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm" onClick={() => !rescheduleSaving && setShowRescheduleModal(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-brand-teal px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-white">Reschedule Appointment</h3>
                <p className="text-[11px] text-white/75">{appointmentDisplayId}</p>
              </div>
              <button
                type="button"
                disabled={rescheduleSaving}
                onClick={() => setShowRescheduleModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-60"
                aria-label="Close reschedule modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={toIso(new Date())}
                  onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleTime(''); }}
                  className="w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">New Time</label>
                <SelectDropdown
                  value={rescheduleTime}
                  onChange={setRescheduleTime}
                  disabled={!rescheduleDate || rescheduleLoadingSlots}
                  options={rescheduleSlots.map((slot) => ({ value: slot, label: slot }))}
                  placeholder={rescheduleLoadingSlots ? 'Checking slots...' : 'Select time'}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-brand-dark-light px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={rescheduleSaving}
                onClick={() => setShowRescheduleModal(false)}
                className="rounded-lg border border-brand-dark-light bg-white px-4 py-2 text-xs font-medium text-brand-dark-soft transition hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:ring-offset-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rescheduleSaving}
                onClick={async () => {
                  if (!rescheduleDate || !rescheduleTime) {
                    notifyError('Please select the new date and time.');
                    return;
                  }
                  setRescheduleSaving(true);
                  try {
                    const payload = {
                      appointment_date: rescheduleDate,
                      start_time: `${rescheduleTime}:00`,
                    };
                    const res = await apiFetch(`/api/appointments/${appointment.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data?.message || 'Failed to reschedule appointment.');
                    notifySuccess('Appointment rescheduled successfully.');
                    setShowRescheduleModal(false);
                    onClose?.();
                  } catch (error) {
                    notifyError(error?.message || 'Failed to reschedule appointment.');
                  } finally {
                    setRescheduleSaving(false);
                  }
                }}
                className="rounded-lg bg-brand-teal px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60"
              >
                {rescheduleSaving ? 'Saving...' : 'Save Reschedule'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </>
  );
}

function InfoRow({ label, value, valueClassName = '' }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[11px] text-brand-dark-soft">{label}</span>
      <span className={`text-[11px] font-semibold text-brand-dark text-right ${valueClassName}`}>{value || '-'}</span>
    </div>
  );
}

function formatOwnerAddress(owner = {}, raw = {}) {
  const source = owner?._raw || owner;
  const nestedOwner = raw?.pet?.owner || raw?.booked_by_owner || {};
  const fields = {
    unit: source?.address_unit_floor || nestedOwner?.address_unit_floor,
    street: source?.address_street || source?.street || nestedOwner?.address_street || nestedOwner?.street,
    barangay: source?.address_barangay || source?.barangay || nestedOwner?.address_barangay || nestedOwner?.barangay,
    city: source?.address_city || source?.city || nestedOwner?.address_city || nestedOwner?.city,
    province: source?.address_province || source?.province || nestedOwner?.address_province || nestedOwner?.province,
    postal: source?.address_postal_code || source?.postal_code || nestedOwner?.address_postal_code || nestedOwner?.postal_code,
    country: source?.address_country || source?.country || nestedOwner?.address_country || nestedOwner?.country,
  };
  const hasStructuredAddress = Object.values(fields).some((part) => String(part || '').trim());
  if (hasStructuredAddress) {
    const line1 = [fields.unit, fields.street, fields.barangay ? `Brgy. ${fields.barangay}` : '', fields.city]
      .filter((part) => String(part || '').trim())
      .join(', ');
    const line2 = [fields.province, fields.postal, fields.country]
      .filter((part) => String(part || '').trim())
      .join(', ');
    return [line1, line2].filter(Boolean).join('\n');
  }

  const storedAddress = owner?.address || raw?.owner_address || nestedOwner?.address || '';
  const parts = String(storedAddress).split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '';
  const line2 = parts.length > 3 ? parts.slice(-3).join(', ') : '';
  const line1 = parts.length > 3 ? parts.slice(0, -3).join(', ') : parts.join(', ');
  return [line1, line2].filter(Boolean).join('\n');
}
