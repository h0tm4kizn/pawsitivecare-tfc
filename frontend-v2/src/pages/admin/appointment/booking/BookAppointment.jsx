import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, apiGet, apiPost } from '../../../../api/apiClient';
import { useAppointmentStore } from '../../../../stores/appointmentStore';
import { useDashboardStore } from '../../../../stores/dashboardStore';
import { useAuthStore } from '../../../../stores/authStore';
import PetAssessmentRecordsModal from '../../../../components/modals/PetAssessmentRecordsModal';
import PetAssessmentFormModal from '../../../../components/modals/PetAssessmentFormModal';
import { downloadPetAssessmentRecordPdf } from '../../../../utils/petAssessmentBlankPdf';
import { useSuppliesFeatureEnabled } from '../../../../utils/featureFlags';
import { DAYCARE_MAX_PETS, getPetSpeciesCode } from '../../../../utils/daycareBooking';
import { fetchPaymentAccounts } from '../../../../utils/paymentAccounts';
import WalkInSaleModal from '../../inventory/components/WalkInSaleModal';
import {
  TODAY,
  CLINIC_SLOTS,
  getArr,
  getManilaDateTime,
  getOwnerName,
  getOwnerAddress,
  freshEntry,
  getServiceTiers,
  getAutoCatSizeLabel,
  shouldSkipGroomingSizeForCat,
} from './bookingUtils';
import OwnerSearchStep from './components/OwnerSearchStep';
import ServiceSelectionStep from './components/ServiceSelectionStep';
import DateTimeStep from './components/DateTimeStep';
import AdminBookingValidationBox from './components/AdminBookingValidationBox';
import BookingFormSection from './components/BookingFormSection';
import BookingNavigation from './components/BookingNavigation';
import BookingStepHeader from './components/BookingStepHeader';
import BookingPaymentSection from './components/BookingPaymentSection';
import BookingSummarySidebar from './components/BookingSummarySidebar';
import BookingSuccessModal from './components/BookingSuccessModal';
import {
  BANK_OPTIONS,
  EWALLET_OPTIONS,
  PARASITE_BLOCK_BODY,
  PARASITE_BLOCK_TITLE,
  PAYMENT_TYPE_OPTIONS,
} from './bookingConstants';
import {
  buildHotelReservationNote,
  applySelectedServicePromotion,
  draftHasParasite,
  draftHasRabies,
  extractAddonRows,
  getDaycareScheduleIssue,
  inferDaycareDuration,
  isDogPet,
  isHotelEntry,
  isPawsomeExtrasService,
  normalizeOwnerRow,
  normalizePawsomeExtras,
  normalizeServiceCategory,
  normalizeServiceForBooking,
  ownerSearchBlob,
  resolveEntryBasePrice,
  sanitizeDraftVaccinesForPet,
  sanitizeReferenceNumber,
  toPriceNumber,
} from './bookingHelpers';

export default function BookAppointment({ isOpen, onClose, initialCategory = null, initialDate = null, walkInMode = false }) {
  const walkInDate = typeof initialDate === 'string' && initialDate
    ? initialDate
    : (walkInMode ? getManilaDateTime().date : TODAY);
  const currentUser = useAuthStore((state) => state.user);
  const preSelectedDate = useAppointmentStore((state) => state.preSelectedDate);
  const prefillPet = useAppointmentStore((state) => state.prefillPet);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrintingAssessment, setIsPrintingAssessment] = useState(false);
  const [formError, setFormError] = useState('');
  const [booked, setBooked] = useState(false);
  const [bookedAppointments, setBookedAppointments] = useState([]);
  const [retailSaleOpen, setRetailSaleOpen] = useState(false);
  const [editingRetailSale, setEditingRetailSale] = useState(null);
  const [retailSales, setRetailSales] = useState([]);
  const [suppliesEnabled] = useSuppliesFeatureEnabled();
  const [validationModal, setValidationModal] = useState({ open: false, title: '', message: '' });

  const [services, setServices] = useState([]);
  const [pawsomeExtrasService, setPawsomeExtrasService] = useState(null);
  const [hotelSuites, setHotelSuites] = useState([]);

  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerPool, setOwnerPool] = useState([]);
  const [ownerSearching, setOwnerSearching] = useState(false);
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);

  const [ownerPets, setOwnerPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [petAssessmentComplete, setPetAssessmentComplete] = useState(false);
  const [petAssessmentLoading, setPetAssessmentLoading] = useState(false);
  const [petHealthForm, setPetHealthForm] = useState(null);
  const [assessmentPet, setAssessmentPet] = useState(null);
  const [recordsPet, setRecordsPet] = useState(null);
  const [assessmentSavedNotice, setAssessmentSavedNotice] = useState('');
  const [pendingAssessmentDraft, setPendingAssessmentDraft] = useState(null);
  const [pendingAssessmentDrafts, setPendingAssessmentDrafts] = useState({});
  const [daycarePetCount, setDaycarePetCount] = useState(1);
  const [daycarePetSizes, setDaycarePetSizes] = useState({});
  const [draftDaycarePetIds, setDraftDaycarePetIds] = useState([]);

  const [entries, setEntries] = useState([freshEntry()]);
  const latestEntriesRef = useRef(entries);
  const fetchSlotsRef = useRef(null);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [bookingStep, setBookingStep] = useState(0);
  const [additionalPetIds, setAdditionalPetIds] = useState([]);
  const [note, setNote] = useState('');

  const [modeOfPayment, setModeOfPayment] = useState('');
  const [reservationProvider, setReservationProvider] = useState('');
  const [reservationOtherName, setReservationOtherName] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [receivingPaymentAccountId, setReceivingPaymentAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositProof, setDepositProof] = useState(null);
  const [handledById, setHandledById] = useState('');
  const [bookingStaff, setBookingStaff] = useState([]);

  const [hotelMonth, setHotelMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [hotelUnavailableDates, setHotelUnavailableDates] = useState(new Set());
  const [hotelClosedDates, setHotelClosedDates] = useState(new Set());
  const [hotelCapacityByDate, setHotelCapacityByDate] = useState({});
  const [hotelCalendarLoading, setHotelCalendarLoading] = useState(false);

  const searchTimer = useRef(null);
  const ownerSearchAbortRef = useRef(null);
  const ownerSearchRequestIdRef = useRef(0);
  const ownerSearchCacheRef = useRef(new Map());
  const ownerPetsCacheRef = useRef(new Map());
  const slotsCacheRef = useRef(new Map());
  const servicesByCategoryCacheRef = useRef(new Map());
  const addonsByCategoryCacheRef = useRef(new Map());
  const petAssessmentCacheRef = useRef(new Map());
  const allServicesCacheRef = useRef([]);
  const hotelSuitesCacheRef = useRef([]);
  const autoDownloadAssessmentsRef = useRef(false);
  const initialCategoryAppliedRef = useRef('');
  const serviceDetailsSectionRef = useRef(null);
  const scheduleSectionRef = useRef(null);
  const paymentSectionRef = useRef(null);
  const notesSectionRef = useRef(null);
  const previousSectionAvailabilityRef = useRef({
    serviceDetails: false,
    schedule: false,
    payment: false,
    notes: false,
  });

  useEffect(() => {
    latestEntriesRef.current = entries;
  }, [entries]);

  const loadAppointments = useAppointmentStore((state) => state.loadAppointments);
  const loadMonthAppointments = useDashboardStore((state) => state.loadMonthAppointments);

  const activeEntry = entries[activeItemIndex] || entries[0] || freshEntry();
  const selectedCategories = useMemo(
    () => entries.map((entry) => String(entry?.category || entry?.selectedService?.category || '').toLowerCase()).filter(Boolean),
    [entries],
  );
  const hasHotelCategory = entries.some((entry) => isHotelEntry(entry) || Boolean(entry?.hotel_suite_id));
  const hasDaycareCategory = selectedCategories.includes('daycare');
  const hasGroomingCategory = selectedCategories.includes('grooming');
  const hasNonHotelCategory = selectedCategories.some((cat) => cat !== 'hotel');
  const hasDaycareAndGrooming = hasDaycareCategory && hasGroomingCategory;
  const hasMixedHotelAndNonHotel = hasHotelCategory && hasNonHotelCategory;
  const daycareSlotRefreshKey = useMemo(
    () => entries
      .filter((entry) => String(entry?.category || '').toLowerCase() === 'daycare')
      .map((entry) => `${entry.key}|${entry.service_id || ''}|${entry.appointment_date || ''}`)
      .join('||'),
    [entries],
  );
  const petSpecies = getPetSpeciesCode(selectedPet || {});
  const hotelSuitesForPet = useMemo(() => hotelSuites.filter((s) => {
    if (!petSpecies) return true;
    if (petSpecies === 'D') return s.species_type === 'dog';
    if (petSpecies === 'C') return s.species_type === 'cat';
    return false;
  }), [hotelSuites, petSpecies]);
  const selectedDaycarePetIds = useMemo(() => {
    if (!hasDaycareCategory || !selectedPet?.id) return [];
    return [String(selectedPet.id), ...additionalPetIds.map(String)];
  }, [hasDaycareCategory, selectedPet, additionalPetIds]);
  const daycarePickerPetIds = hasDaycareCategory ? draftDaycarePetIds : selectedDaycarePetIds;
  const showBookingDetails = Boolean(selectedPet?.id && activeEntry.category);
  const canUseRetailPurchase = Boolean(selectedOwner?.id && selectedPet?.id);
  const patchEntry = (entryKey, patch) => {
    setEntries((prev) => prev.map((entry) => (entry.key === entryKey ? { ...entry, ...patch } : entry)));
  };

  const totalPrice = useMemo(() => {
    return entries.reduce((sum, entry) => {
      const entryCategory = String(entry?.category || '').toLowerCase();
      let base = resolveEntryBasePrice(entry, petSpecies);
      const selectedTier = getServiceTiers(entry?.selectedService).find((tier) => String(tier?.size_label || '') === String(entry?.size_label || ''));
      const rawBase = toPriceNumber(selectedTier?.price ?? base);
      base = applySelectedServicePromotion(entry?.selectedService, selectedTier?.id, entry?.promotion_id, rawBase, entry?.appointment_date);
      let baseIncludesPromotion = false;
      if (entryCategory === 'daycare' && selectedDaycarePetIds.length > 0) {
        const tiers = getServiceTiers(entry?.selectedService);
        base = selectedDaycarePetIds.reduce((acc, petId) => {
          const size = daycarePetSizes[String(petId)];
          const tier = tiers.find((item) => String(item?.size_label || '') === String(size || ''));
          const raw = toPriceNumber(tier?.price ?? tier?.price_min ?? tier?.amount);
          return acc + applySelectedServicePromotion({ ...entry.selectedService, service_tiers: tier ? [tier] : [] }, tier?.id, entry?.promotion_id, raw, entry?.appointment_date);
        }, 0);
        baseIncludesPromotion = true;
      }
      if (!baseIncludesPromotion && !entry?.promotion_id) base = toPriceNumber(selectedTier?.price ?? base);
      const suitePrice = toPriceNumber(hotelSuites.find((s) => s.id === entry.hotel_suite_id)?.price_per_night) * toPriceNumber(entry.hotel_nights || 0);
      const addonsPrice = (entryCategory === 'grooming' && String(entry?.grooming_booking_type || '').toLowerCase() === 'extras'
        ? (entry.availableAddons || [])
        : [])
        .filter((addon) => (entry.addon_ids || []).includes(addon.id))
        .reduce((acc, addon) => acc + toPriceNumber(addon.price_min ?? addon.price ?? addon.amount), 0);
      return sum + base + suitePrice + addonsPrice;
    }, 0);
  }, [entries, hotelSuites, petSpecies, selectedDaycarePetIds, daycarePetSizes]);
  const bookingDisplayTotal = totalPrice;

  const requiredHotelDeposit = hasHotelCategory && bookingDisplayTotal > 0
    ? bookingDisplayTotal * 0.5
    : 0;
  const effectiveHotelDeposit = requiredHotelDeposit > 0 ? requiredHotelDeposit : 0;
  const estimatedShopPayment = Math.max(bookingDisplayTotal - requiredHotelDeposit, 0);
  const requiresElectronicReference = modeOfPayment === 'e_wallet' || modeOfPayment === 'bank_transfer';
  const selectedReservationProvider = reservationProvider === 'Other' ? reservationOtherName.trim() : reservationProvider;
  const receivingPaymentOptions = paymentAccounts
    .map((account) => ({ value: String(account.id), label: account.label }));
  const hotelReservationComplete = !hasHotelCategory || (
    requiredHotelDeposit <= 0 ||
    (!!modeOfPayment && !!handledById && (!requiresElectronicReference || (!!selectedReservationProvider && !!receivingPaymentAccountId && ((!!referenceNumber && /^[A-Za-z0-9]{1,30}$/.test(referenceNumber)) || !!depositProof))))
  );
  const resetForm = () => {
    setIsSaving(false);
    setIsPrintingAssessment(false);
    setFormError('');
    setBooked(false);
    setBookedAppointments([]);
    setRetailSaleOpen(false);
    setEditingRetailSale(null);
    setRetailSales([]);
    setValidationModal({ open: false, title: '', message: '' });
    setOwnerQuery('');
    setOwnerPool([]);
    setOwnerSearching(false);
    setShowOwnerDropdown(false);
    setSelectedOwner(null);
    setOwnerPets([]);
    setLoadingPets(false);
    setSelectedPet(null);
    setPetAssessmentComplete(false);
    setPetAssessmentLoading(false);
    setPetHealthForm(null);
    setAssessmentPet(null);
    setRecordsPet(null);
    setAssessmentSavedNotice('');
    setPendingAssessmentDraft(null);
    const openingCategory = String(initialCategory || '').trim().toLowerCase();
    const clickedDate = typeof preSelectedDate === 'string' && preSelectedDate ? preSelectedDate : '';
    const openingDate = walkInMode
      ? (typeof initialDate === 'string' && initialDate ? initialDate : TODAY)
      : clickedDate || (openingCategory === 'hotel' ? TODAY : '');
    setEntries([{ ...freshEntry(), category: openingCategory, appointment_date: openingDate }]);
    setActiveItemIndex(0);
    setBookingStep(0);
    setAdditionalPetIds([]);
    setNote('');
    setModeOfPayment('');
    setReservationProvider('');
    setReservationOtherName('');
    setReceivingPaymentAccountId('');
    setReferenceNumber('');
    setDepositProof(null);
    setHandledById(String(currentUser?.id || ''));
    initialCategoryAppliedRef.current = '';
    const d = openingDate ? new Date(`${openingDate}T00:00:00`) : new Date();
    setHotelMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setHotelUnavailableDates(new Set());
    setHotelClosedDates(new Set());
    setHotelCapacityByDate({});
    autoDownloadAssessmentsRef.current = false;
    previousSectionAvailabilityRef.current = {
      serviceDetails: false,
      schedule: false,
      payment: false,
      notes: false,
    };
  };

  const showValidationModal = (message) => {
    setFormError('');
    if (!message) {
      setValidationModal({ open: false, title: '', message: '' });
      return;
    }
    const text = String(message);
    const isAssessmentConcern = /assessment|health form/i.test(text);
    setValidationModal({
      open: true,
      title: isAssessmentConcern ? 'Assessment Form Required' : 'Complete Appointment Details',
      message: text,
    });
  };

  useEffect(() => {
    if (!formError) return;
    showValidationModal(formError);
  }, [formError]);

  const fetchRecentOwners = async () => {
    const cached = ownerSearchCacheRef.current.get('__recent__');
    if (cached) {
      setOwnerPool(cached);
      setShowOwnerDropdown(cached.length > 0);
      return;
    }
    try {
      const res = await apiGet('/api/booking/owners?per_page=20');
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const rows = getArr(data, 'owners').map(normalizeOwnerRow).filter((r) => String(r?.id || '').length > 0);
      if (rows.length > 0) {
        ownerSearchCacheRef.current.set('__recent__', rows);
        setOwnerPool(rows);
        setShowOwnerDropdown(true);
      }
    } catch {
      // no-op
    }
  };

  const initDropdowns = async () => {
    if (hotelSuitesCacheRef.current.length > 0) {
      setHotelSuites(hotelSuitesCacheRef.current);
    } else {
      const suiteRes = await apiGet('/api/hotel-suites');
      if (suiteRes.ok) {
        const suites = getArr(await suiteRes.json(), 'hotel_suites');
        hotelSuitesCacheRef.current = suites;
        setHotelSuites(suites);
      }
    }

    const normalizeServices = (rows) => rows
      .filter((service) => service && typeof service === 'object')
      .filter((service) => {
        const isActive = service.is_active;
        const status = String(service.status || '').trim().toLowerCase();
        if (isActive === false || isActive === 0 || isActive === '0') return false;
        if (status === 'inactive') return false;
        return true;
      })
      .map((service) => normalizeServiceForBooking(service));

    let loadedServices = allServicesCacheRef.current || [];
    if (loadedServices.length === 0) {
      const svcRes = await apiGet('/api/booking/services');
      if (svcRes.ok) {
        const data = await svcRes.json().catch(() => ({}));
        const rows = getArr(data, 'data');
        if (rows.length > 0) {
          loadedServices = normalizeServices(rows);
        }
      }
    }

    allServicesCacheRef.current = loadedServices;
    setPawsomeExtrasService(loadedServices.find(isPawsomeExtrasService) || null);
    setServices(loadedServices);
  };

  // Warm the owner list before the modal is opened when possible.
  useEffect(() => {
    fetchRecentOwners().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    // Keep recent/search results between modal opens so the owner list appears
    // immediately while any background refresh completes.
    initDropdowns();
    apiFetch('/api/admin/staff?per_page=100')
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((payload) => {
        const rows = Array.isArray(payload?.data?.data) ? payload.data.data : (Array.isArray(payload?.data) ? payload.data : []);
        const current = currentUser?.id ? [{ ...currentUser, name: currentUser.name || currentUser.email, role: currentUser.role || 'admin' }] : [];
        setBookingStaff([...current, ...rows].filter((person, index, all) => person?.id && all.findIndex((item) => String(item?.id) === String(person.id)) === index));
      })
      .catch(() => setBookingStaff(currentUser?.id ? [currentUser] : []));
    if (prefillPet) {
      const owner = normalizeOwnerRow(prefillPet.owner || {});
      setSelectedOwner(owner);
      setOwnerQuery(getOwnerName(owner));
      setOwnerPets([prefillPet]);
      setSelectedPet(prefillPet);
    } else {
      fetchRecentOwners().catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetchPaymentAccounts()
      .then(setPaymentAccounts)
      .catch(() => setPaymentAccounts([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setEntries((prev) => prev.map((entry) => ({
      ...entry,
      appointment_date: walkInMode ? walkInDate : ((typeof preSelectedDate === 'string' && preSelectedDate) ? preSelectedDate : entry.appointment_date),
    })));
  }, [isOpen, preSelectedDate, walkInDate, walkInMode]);

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    ownerSearchAbortRef.current?.abort();
  }, []);

  // Hotel calendar
  useEffect(() => {
    const entry = entries[activeItemIndex];
    if (!isOpen || !isHotelEntry(entry) || !entry?.service_id || !entry?.hotel_suite_id) return;
    const monthKey = `${hotelMonth.getFullYear()}-${String(hotelMonth.getMonth() + 1).padStart(2, '0')}`;
    setHotelCalendarLoading(true);
    setHotelUnavailableDates(new Set());
    setHotelClosedDates(new Set());
    apiGet(`/api/appointments/hotel-calendar?service_id=${entry.service_id}&month=${monthKey}&suite_id=${entry.hotel_suite_id}&pet_id=${selectedPet?.id || ''}`)
      .then((r) => r.ok ? r.json() : { data: { dates: [] } })
      .then((d) => {
        const rows = Array.isArray(d?.data?.dates) ? d.data.dates : [];
        setHotelClosedDates(new Set(rows.filter((r) => r.status === 'closed').map((r) => r.date)));
        setHotelUnavailableDates(new Set(rows.filter((r) => ['full', 'unavailable', 'taken'].includes(r.status)).map((r) => r.date)));
        setHotelCapacityByDate(Object.fromEntries(rows.filter((r) => r.capacity !== undefined).map((r) => [r.date, r])));
      })
      .finally(() => setHotelCalendarLoading(false));
  }, [isOpen, activeItemIndex, entries[activeItemIndex]?.service_id, entries[activeItemIndex]?.hotel_suite_id, selectedPet?.id, hotelMonth, setHotelCapacityByDate]);

  const doOwnerSearch = async (query) => {
    const normalized = String(query || '').trim().toLowerCase();
    if (normalized.length < 2) {
      setShowOwnerDropdown(Boolean(normalized.length));
      return;
    }

    const cached = ownerSearchCacheRef.current.get(normalized);
    if (cached) {
      setOwnerPool(cached);
      setShowOwnerDropdown(true);
      return;
    }

    ownerSearchAbortRef.current?.abort();
    const requestId = ownerSearchRequestIdRef.current + 1;
    ownerSearchRequestIdRef.current = requestId;
    const controller = new AbortController();
    ownerSearchAbortRef.current = controller;
    const searchTimeout = setTimeout(() => controller.abort(), 6_000);

    setOwnerSearching(true);
    try {
      const res = await apiFetch(
        `/api/booking/owners?search=${encodeURIComponent(normalized)}&per_page=20`,
        { method: 'GET', signal: controller.signal },
      );
      if (controller.signal.aborted || requestId !== ownerSearchRequestIdRef.current) return;
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      const rows = getArr(data, 'owners')
        .map(normalizeOwnerRow)
        .filter((r) => String(r?.id || '').length > 0)
        .slice(0, 20);
      if (rows.length > 0) ownerSearchCacheRef.current.set(normalized, rows);
      setOwnerPool(rows);
      setShowOwnerDropdown(true);
    } catch (err) {
      if (err?.name !== 'AbortError' && requestId === ownerSearchRequestIdRef.current) setShowOwnerDropdown(true);
    } finally {
      clearTimeout(searchTimeout);
      if (requestId === ownerSearchRequestIdRef.current) setOwnerSearching(false);
    }
  };

  const handleOwnerQueryChange = (value) => {
    const normalized = value.trim();
    setOwnerQuery(value);
    setSelectedOwner(null);
    setOwnerPets([]);
    setSelectedPet(null);
    setAdditionalPetIds([]);
    setDraftDaycarePetIds([]);
    setPendingAssessmentDraft(null);
    setPendingAssessmentDrafts({});
    setDaycarePetCount(1);
    setDaycarePetSizes({});
    setDraftDaycarePetIds([]);
    clearTimeout(searchTimer.current);
    ownerSearchAbortRef.current?.abort();

    if (!normalized) {
      setOwnerSearching(false);
      const recent = ownerSearchCacheRef.current.get('__recent__') || [];
      setOwnerPool(recent);
      setShowOwnerDropdown(recent.length > 0);
      return;
    }

    setShowOwnerDropdown(true);

    const normLower = normalized.toLowerCase();
    const cached = ownerSearchCacheRef.current.get(normLower);
    const localHits = ownerPool.filter((owner) => ownerSearchBlob(owner).trim().includes(normLower));

    if (cached) {
      setOwnerPool(cached);
      setOwnerSearching(false);
      return;
    }

    if (localHits.length === 0 && normalized.length >= 2) {
      setOwnerSearching(true);
    } else {
      setOwnerSearching(false);
    }

    if (normalized.length >= 2) {
      searchTimer.current = setTimeout(() => doOwnerSearch(normalized), 50);
    }
  };

  const displayedOwnerResults = useMemo(() => {
    const query = String(ownerQuery || '').trim().toLowerCase();
    if (!query) return ownerPool.slice(0, 12);
    return ownerPool
      .filter((owner) => ownerSearchBlob(owner).trim().includes(query))
      .slice(0, 12);
  }, [ownerPool, ownerQuery]);

  const handleSelectOwner = async (owner) => {
    setSelectedOwner(owner);
    setOwnerQuery(getOwnerName(owner));
    setShowOwnerDropdown(false);
    setSelectedPet(null);
    setAdditionalPetIds([]);
    setDraftDaycarePetIds([]);
    setOwnerPets([]);
    setPetAssessmentComplete(false);
    setPetAssessmentLoading(false);
    setPetHealthForm(null);
    setPendingAssessmentDraft(null);
    setPendingAssessmentDrafts({});
    setDaycarePetCount(1);
    setDaycarePetSizes({});
    setDraftDaycarePetIds([]);
    setEntries((prev) => {
      const current = prev[0] || {};
      const category = String(current.category || '').toLowerCase();
      const preserveHotel = category === 'hotel';
      const preserveDaycare = category === 'daycare';
      return [{
        ...freshEntry(),
        category,
        service_id: preserveHotel || preserveDaycare ? current.service_id : '',
        selectedService: preserveHotel || preserveDaycare ? current.selectedService : null,
        appointment_date: walkInMode
          ? walkInDate
          : (current.appointment_date || (typeof preSelectedDate === 'string' ? preSelectedDate : '') || (category === 'hotel' ? TODAY : '')),
        start_time: preserveDaycare ? (current.start_time || '') : '',
        availableSlots: preserveDaycare ? (current.availableSlots || []) : [],
        fullyBooked: preserveDaycare ? !!current.fullyBooked : false,
        shopClosed: preserveDaycare ? !!current.shopClosed : false,
      }];
    });
    setActiveItemIndex(0);

    if (Array.isArray(owner?.pets) && owner.pets.length > 0) {
      ownerPetsCacheRef.current.set(owner.id, owner.pets);
      setOwnerPets(owner.pets);
      return;
    }

    if (ownerPetsCacheRef.current.has(owner.id)) {
      const cachedPets = ownerPetsCacheRef.current.get(owner.id) || [];
      if (cachedPets.length > 0) {
        setOwnerPets(cachedPets);
        return;
      }
    }

    setLoadingPets(true);
    try {
      let pets = [];
      try {
        const bookingPetsRes = await apiGet(`/api/booking/owners/${owner.id}/pets`);
        if (bookingPetsRes.ok) {
          const data = await bookingPetsRes.json().catch(() => ({}));
          pets = getArr(data, 'pets');
          ownerPetsCacheRef.current.set(owner.id, pets);
          setOwnerPets(pets);
          return;
        }
      } catch {
        // Fall through to fallback below
      }

      const fallbackRes = await apiGet(`/api/admin/pets?owner_id=${owner.id}&per_page=50`);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json().catch(() => ({}));
        pets = getArr(data, 'pets');
      }

      ownerPetsCacheRef.current.set(owner.id, pets);
      setOwnerPets(pets);
    } finally {
      setLoadingPets(false);
    }
  };

  const fetchPetAssessmentStatus = async (petId, { silent = false, force = false } = {}) => {
    if (!petId) {
      setPetAssessmentComplete(false);
      setPetAssessmentLoading(false);
      setPetHealthForm(null);
      return false;
    }
    const isCurrentPet = String(selectedPet?.id || '') === String(petId);

    if (!force && petAssessmentCacheRef.current.has(petId)) {
      const cached = petAssessmentCacheRef.current.get(petId);
      if (isCurrentPet) {
        setPetHealthForm(cached.form);
        setPetAssessmentComplete(Boolean(cached.complete));
      }
      if (cached.complete) {
        setPendingAssessmentDrafts((prev) => ({
          ...prev,
          [String(petId)]: prev[String(petId)] || { ...cached.form, _existing_today: true },
        }));
      }
      if (isCurrentPet) setPetAssessmentLoading(false);
      return Boolean(cached.complete);
    }

    if (!silent) setPetAssessmentLoading(true);
    try {
      const statusRes = await apiGet(`/api/pets/${petId}/health-form/status`);
      if (!statusRes.ok) throw new Error('status_unavailable');
      const statusData = await statusRes.json().catch(() => ({}));
      const status = statusData?.data || {};
      const form = {
        has_ticks: !!status.has_ticks,
        has_flea: !!status.has_flea,
        has_rabies: !!status.has_rabies,
        missing_rabies: !!status.missing_rabies,
        declaration_accepted: !!status.complete_today,
        is_vaccinated: !!status.complete_today,
        is_friendly: !!status.complete_today,
        created_at: status.checked_at,
        updated_at: status.checked_at,
      };
      const complete = Boolean(status.complete_today);
      petAssessmentCacheRef.current.set(petId, { form, complete, checkedAt: Date.now() });
      if (isCurrentPet) {
        setPetHealthForm(form);
        setPetAssessmentComplete(complete);
      }
      setPendingAssessmentDrafts((prev) => {
        const key = String(petId);
        if (complete) {
          return { ...prev, [key]: prev[key] || { ...form, _existing_today: true } };
        }
        if (!prev[key]?._existing_today) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (!silent && isCurrentPet) setPetAssessmentLoading(false);
      return complete;
    } catch {
      const cached = petAssessmentCacheRef.current.get(petId);
      if (cached && isCurrentPet) {
        setPetHealthForm(cached.form || null);
        setPetAssessmentComplete(Boolean(cached.complete));
      } else if (isCurrentPet) {
        setPetAssessmentComplete(false);
        setPetHealthForm(null);
      }
      if (!silent && isCurrentPet) setPetAssessmentLoading(false);
      return Boolean(cached?.complete);
    }
  };

  useEffect(() => {
    if (!selectedPet?.id) {
      setPetAssessmentComplete(false);
      setPetAssessmentLoading(false);
      setPetHealthForm(null);
      setPendingAssessmentDraft(null);
      return;
    }
    setPendingAssessmentDraft(null);
    fetchPetAssessmentStatus(selectedPet.id, { silent: false, force: false });
  }, [selectedPet?.id]);

  const handleCategoryChange = async (entryKey, category) => {
    const nextCategory = String(category || '').toLowerCase();
    const currentEntry = entries.find((entry) => entry.key === entryKey);
    const calendarSelectedDate = typeof preSelectedDate === 'string' && preSelectedDate ? preSelectedDate : '';
    if (!nextCategory) {
      setServices(allServicesCacheRef.current || []);
      patchEntry(entryKey, {
        category: '',
        service_id: '',
        selectedService: null,
        appointment_date: walkInMode ? walkInDate : '',
        start_time: '',
        availableSlots: [],
        slotStatuses: [],
        walkInStartTime: '',
        walkInStatus: '',
        loadingSlots: false,
        loadingAddons: false,
        fullyBooked: false,
        size_label: '',
        pet_size: '',
        addon_ids: [],
        availableAddons: [],
        addonsDecided: false,
        hotel_suite_id: '',
        hotel_checkout: '',
        hotel_nights: '',
      });
      setFormError('');
      return;
    }
    const otherEntries = entries.filter((entry) => entry.key !== entryKey);
    const otherHasHotel = otherEntries.some((entry) => isHotelEntry(entry) || Boolean(entry?.hotel_suite_id));
    const otherHasNonHotel = otherEntries.some((entry) => {
      const entryCategory = String(entry?.category || entry?.selectedService?.category || '').toLowerCase();
      return entryCategory && entryCategory !== 'hotel';
    });
    if (nextCategory === 'hotel' && otherHasNonHotel) {
      showValidationModal('Hotel bookings must be placed separately from daycare/grooming services.');
      return;
    }
    if (nextCategory && nextCategory !== 'hotel' && otherHasHotel) {
      showValidationModal('Daycare/grooming must be placed separately from hotel bookings.');
      return;
    }
    // Optimistic UI: apply category immediately so click feels instant.
    patchEntry(entryKey, {
      category,
      service_id: '',
      selectedService: null,
      loadingServices: Boolean(category),
      serviceLoadError: '',
      appointment_date: walkInMode ? walkInDate : (currentEntry?.appointment_date || calendarSelectedDate || (nextCategory === 'hotel' ? TODAY : '')),
      start_time: '',
      availableSlots: [],
      slotStatuses: [],
      walkInStartTime: '',
      walkInStatus: '',
      loadingSlots: false,
      loadingAddons: false,
      fullyBooked: false,
      size_label: '',
      pet_size: '',
      addon_ids: [],
      availableAddons: [],
      addonsDecided: false,
      hotel_suite_id: '',
      hotel_checkout: '',
      hotel_nights: '',
    });

    let loadedServices = [];
    try {
      if (category && servicesByCategoryCacheRef.current.has(category)) {
        loadedServices = servicesByCategoryCacheRef.current.get(category) || [];
      } else if (category) {
        const svcRes = await apiGet(`/api/booking/services?category=${encodeURIComponent(category)}`);
        if (svcRes.ok) {
          const data = await svcRes.json().catch(() => ({}));
          loadedServices = getArr(data, 'data')
            .map((svc) => normalizeServiceForBooking(svc))
            .filter((svc) => normalizeServiceCategory(svc) === category);
        }

        if (loadedServices.length === 0) {
          loadedServices = (allServicesCacheRef.current || [])
            .filter((svc) => normalizeServiceCategory(svc) === category);
        }

        if (loadedServices.length === 0) {
          const publicRes = await apiGet('/api/services/catalog');
          if (publicRes.ok) {
            const publicData = await publicRes.json().catch(() => ({}));
            loadedServices = getArr(publicData, 'data')
              .map((svc) => normalizeServiceForBooking(svc))
              .filter((svc) => normalizeServiceCategory(svc) === category);
          }
        }

        if (loadedServices.length > 0) {
          servicesByCategoryCacheRef.current.set(category, loadedServices);
        }
      }
    } catch {
      loadedServices = (allServicesCacheRef.current || [])
        .filter((svc) => normalizeServiceCategory(svc) === category);
    }
    if (loadedServices.length > 0) {
      setServices(loadedServices);
      const extrasService = loadedServices.find(isPawsomeExtrasService);
      if (extrasService) setPawsomeExtrasService(extrasService);
    }

    let autoService = null;
    if ((category === 'hotel' || category === 'daycare') && loadedServices.length > 0) {
      autoService = loadedServices[0];
    }

    patchEntry(entryKey, {
      service_id: autoService?.id || '',
      selectedService: autoService,
      loadingServices: false,
      serviceLoadError: loadedServices.length === 0
        ? `No active ${category} service or pricing tiers could be loaded.`
        : '',
    });

    if (!category) return;
    if (addonsByCategoryCacheRef.current.has(category)) {
      patchEntry(entryKey, { availableAddons: addonsByCategoryCacheRef.current.get(category) || [], loadingAddons: false });
      return;
    }
    patchEntry(entryKey, { availableAddons: [], loadingAddons: false });
  };

  useEffect(() => {
    const category = String(initialCategory || '').trim().toLowerCase();
    if (!isOpen || !category || bookingStep < 1) return;
    const firstEntry = entries[0];
    if (!firstEntry?.key) return;
    if (String(firstEntry?.category || '').toLowerCase() === category && firstEntry?.selectedService?.id) return;
    const applyKey = `${firstEntry.key}:${category}`;
    if (initialCategoryAppliedRef.current === applyKey) return;

    initialCategoryAppliedRef.current = applyKey;
    void handleCategoryChange(firstEntry.key, category);
  }, [isOpen, initialCategory, bookingStep, entries[0]?.key]);

  const handleServiceChange = (entryKey, serviceId) => {
    const entry = entries.find((item) => item.key === entryKey);
    const selectedCategory = String(entry?.category || '').toLowerCase();
    const selectedService = services.find((service) => String(service.id) === String(serviceId)) || null;
    const serviceCategory = String(selectedService?.category || '').toLowerCase();
    if (!selectedService || (selectedCategory && serviceCategory !== selectedCategory)) {
      showValidationModal('Please select a package that matches the chosen service category.');
      return;
    }
    setFormError('');
    const shouldAutoSelectCatSize = shouldSkipGroomingSizeForCat(selectedService, petSpecies);
    const isDaycareService = String(selectedCategory || '').toLowerCase() === 'daycare';
    const inferredDaycareDuration = isDaycareService ? inferDaycareDuration(selectedService) : null;
    const preserveDaycareSchedule = isDaycareService && !!entry?.appointment_date;

    patchEntry(entryKey, {
      service_id: serviceId,
      selectedService,
      start_time: preserveDaycareSchedule ? (entry?.start_time || '') : '',
      availableSlots: preserveDaycareSchedule ? (entry?.availableSlots || []) : [],
      slotStatuses: [],
      walkInStartTime: '',
      walkInStatus: '',
      loadingSlots: preserveDaycareSchedule ? !!entry?.loadingSlots : false,
      loadingAddons: false,
      fullyBooked: preserveDaycareSchedule ? !!entry?.fullyBooked : false,
      size_label: shouldAutoSelectCatSize ? getAutoCatSizeLabel(selectedService) : '',
      addon_ids: [],
      addonsDecided: false,
      hotel_suite_id: '',
      hotel_checkout: '',
      hotel_nights: '',
      daycare_duration: inferredDaycareDuration || null,
    });
    if (entry?.appointment_date && selectedCategory !== 'hotel' && selectedCategory !== 'daycare') {
      void fetchSlots(entryKey, serviceId, entry.appointment_date, 1);
    }
  };

  const loadPawsomeExtrasForEntry = async (entryKey) => {
    if (!entryKey) return [];
    if (addonsByCategoryCacheRef.current.has('grooming')) {
      const cached = addonsByCategoryCacheRef.current.get('grooming');
      patchEntry(entryKey, { availableAddons: cached, loadingAddons: false, addonLoadError: '' });
      return cached;
    }
    patchEntry(entryKey, { loadingAddons: true, addonLoadError: '' });
    try {
      const response = await apiGet(`/api/booking/addons?category=grooming&_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'x-skip-dedupe': 'true' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Pawsome Extras could not be loaded.');
      }
      const addons = normalizePawsomeExtras(extractAddonRows(data));
      if (addons.length === 0) {
        throw new Error('The booking API returned no active Pawsome Extras. Please retry or check Service Management.');
      }
      addonsByCategoryCacheRef.current.set('grooming', addons);
      patchEntry(entryKey, { availableAddons: addons, loadingAddons: false, addonLoadError: '' });
      return addons;
    } catch (error) {
      patchEntry(entryKey, {
        availableAddons: [],
        loadingAddons: false,
        addonLoadError: error?.message || 'Unable to load Pawsome Extras. Please check the backend connection and try again.',
      });
      return [];
    }
  };

  useEffect(() => {
    const entry = activeEntry || null;
    if (!entry?.key) return;
    if (String(entry.category || '').toLowerCase() !== 'grooming') return;
    if (!entry.show_pawsome_extras) return;
    if (entry.loadingAddons) return;
    if (entry.addonLoadError) return;
    if (Array.isArray(entry.availableAddons) && entry.availableAddons.length > 0) return;
    if (addonsByCategoryCacheRef.current.has('grooming')) {
      patchEntry(entry.key, {
        availableAddons: addonsByCategoryCacheRef.current.get('grooming') || [],
        loadingAddons: false,
        addonLoadError: '',
      });
      return;
    }
    void loadPawsomeExtrasForEntry(entry.key);
  }, [activeEntry?.key, activeEntry?.show_pawsome_extras, activeEntry?.availableAddons?.length, activeEntry?.loadingAddons, activeEntry?.addonLoadError]);

  const fetchSlots = async (entryKey, serviceId, dateIso, petsCount = 1) => {
    const existingEntry = entries.find((item) => item.key === entryKey);
    const hotelEntry = isHotelEntry(existingEntry);
    const groomingEntry = String(existingEntry?.category || '').toLowerCase() === 'grooming';
    const durationTier = String(existingEntry?.daycare_duration || '');
    const key = `${serviceId}|${dateIso}|${petsCount}|${durationTier}|${walkInMode ? 'walk-in' : 'scheduled'}`;
    const applySlotAvailability = ({ slots, slotStatuses = [], walkInStartTime = '', walkInStatus = '', fullyBooked = false, shopClosed = false }) => {
      setEntries((currentEntries) => currentEntries.map((entry) => {
        if (entry.key !== entryKey) return entry;
        const selectedTime = entry.start_time || '';
        const normalizedSelected = String(selectedTime).slice(0, 5);
        const keepSelected = slots.some((slot) => String(slot || '').slice(0, 5) === normalizedSelected)
          || String(walkInStartTime || '').slice(0, 5) === normalizedSelected
          || (hotelEntry && !shopClosed && /^\d{2}:\d{2}$/.test(normalizedSelected)
            && normalizedSelected >= '09:00' && normalizedSelected <= '17:00');
        return {
          ...entry,
          loadingSlots: false,
          availableSlots: slots,
          slotStatuses,
          walkInStartTime,
          walkInStatus,
          fullyBooked,
          shopClosed,
          start_time: keepSelected ? selectedTime : '',
        };
      }));
    };
    if (!hotelEntry && !groomingEntry && slotsCacheRef.current.has(key)) {
      const cached = slotsCacheRef.current.get(key);
      const slots = Array.isArray(cached) ? cached : (cached?.slots || []);
      const slotStatuses = Array.isArray(cached) ? [] : (cached?.slotStatuses || []);
      const walkInStartTime = Array.isArray(cached) ? '' : (cached?.walkInStartTime || '');
      const walkInStatus = Array.isArray(cached) ? '' : (cached?.walkInStatus || '');
      const fullyBooked = Array.isArray(cached) ? false : (cached?.fullyBooked || false);
      const shopClosed = Array.isArray(cached) ? false : (cached?.shopClosed || false);
      applySlotAvailability({ slots, slotStatuses, walkInStartTime, walkInStatus, fullyBooked, shopClosed });
      return;
    }

    // Keep the previous slot grid visible while the next availability check
    // runs; the response will replace it with the date-specific result.
    patchEntry(entryKey, {
      loadingSlots: true,
      availableSlots: groomingEntry || hotelEntry ? [] : existingEntry?.availableSlots?.length ? existingEntry.availableSlots : CLINIC_SLOTS,
      slotStatuses: groomingEntry ? [] : (existingEntry?.slotStatuses || []),
      walkInStartTime: groomingEntry ? '' : (existingEntry?.walkInStartTime || ''),
      walkInStatus: groomingEntry ? '' : (existingEntry?.walkInStatus || ''),
      fullyBooked: false,
      shopClosed: false,
    });
    try {
      const walkInParam = walkInMode ? '&walk_in=1' : '';
      const res = await apiGet(`/api/appointments/available-slots?date=${dateIso}&service_id=${serviceId}&pets_count=${petsCount}${durationTier ? `&duration_tier=${encodeURIComponent(durationTier)}` : ''}${walkInParam}`);
      if (!res.ok) {
        patchEntry(entryKey, {
          loadingSlots: false,
          availableSlots: [],
          slotStatuses: [],
          walkInStartTime: '',
          walkInStatus: '',
          fullyBooked: false,
          shopClosed: false,
          availabilityError: groomingEntry ? 'Unable to load appointment availability. Please retry.' : '',
        });
        return;
      }
      const data = await res.json().catch(() => ({}));
      const reason = String(data?.data?.reason || '').toLowerCase();
      const slots = data?.data?.slots || data?.data?.available_slots || [];
      const slotStatuses = Array.isArray(data?.data?.slot_statuses) ? data.data.slot_statuses : [];
      const walkInStartTime = String(data?.data?.walk_in_slot || '');
      const walkInStatus = String(data?.data?.walk_in_status || '');
      const shopClosed = reason === 'closed' || reason === 'blocked';
      const fullyBooked = !!(data?.data?.fully_booked || ['occupied', 'full'].includes(reason));

      // Respect explicit API "closed/blocked" responses and do not inject fallback slots.
      const availableSlots = shopClosed
        ? []
        : Array.isArray(slots) && slots.length > 0
          ? slots
          : hotelEntry || groomingEntry ? [] : CLINIC_SLOTS;

      if (groomingEntry && ['full', 'no_slots', 'closed', 'blocked'].includes(reason)) {
        const message = reason === 'full'
          ? 'All Grooming time slots are full for this date.'
          : reason === 'closed' || reason === 'blocked'
            ? 'The shop is closed for this day.'
            : 'No Grooming time slots are available for this date.';
        setEntries((currentEntries) => currentEntries.map((entry) => entry.key === entryKey
          ? { ...entry, loadingSlots: false, availabilityError: message }
          : entry));
      } else if (groomingEntry) {
        setEntries((currentEntries) => currentEntries.map((entry) => entry.key === entryKey
          ? { ...entry, loadingSlots: false, availabilityError: '' }
          : entry));
      }

      if (!hotelEntry && !groomingEntry) slotsCacheRef.current.set(key, { slots: availableSlots, slotStatuses, walkInStartTime, walkInStatus, fullyBooked, shopClosed });
      applySlotAvailability({ slots: availableSlots, slotStatuses, walkInStartTime, walkInStatus, fullyBooked, shopClosed });
    } catch {
      patchEntry(entryKey, {
        loadingSlots: false,
        availableSlots: [],
        slotStatuses: [],
        walkInStartTime: '',
        walkInStatus: '',
        fullyBooked: false,
        shopClosed: false,
        availabilityError: 'Unable to load appointment availability. Please retry.',
      });
    }
  };
  useEffect(() => {
    fetchSlotsRef.current = (...args) => fetchSlots(...args);
  });

  const groomingAvailabilityKey = entries
    .filter((entry) => String(entry.category || '').toLowerCase() === 'grooming' && entry.service_id && entry.appointment_date)
    .map((entry) => `${entry.key}|${entry.service_id}|${entry.appointment_date}`)
    .join('||');

  useEffect(() => {
    if (!isOpen || bookingStep !== 2 || !groomingAvailabilityKey) return undefined;
    const timer = window.setInterval(() => {
      latestEntriesRef.current
        .filter((entry) => String(entry.category || '').toLowerCase() === 'grooming' && entry.service_id && entry.appointment_date)
        .forEach((entry) => fetchSlotsRef.current?.(entry.key, entry.service_id, entry.appointment_date, 1));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen, bookingStep, groomingAvailabilityKey]);

  const handleDateChange = (entryKey, dateIso) => {
    const entry = entries.find((item) => item.key === entryKey);
    if (walkInMode) {
      patchEntry(entryKey, { appointment_date: walkInDate, start_time: '' });
      patchEntry(entryKey, { availabilityError: '' });
      if (entry?.service_id) fetchSlots(entryKey, entry.service_id, walkInDate, 1);
      return;
    }
    if (dateIso && dateIso < TODAY) {
      patchEntry(entryKey, { appointment_date: '', start_time: '' });
      showValidationModal('Past dates cannot be selected.');
      return;
    }
    patchEntry(entryKey, { appointment_date: dateIso, start_time: '' });
    if (!entry?.service_id) return;
    if (!dateIso) return;
    const petsCount = String(entry?.category || '').toLowerCase() === 'daycare' ? 1 + additionalPetIds.length : 1;
    patchEntry(entryKey, { availabilityError: '' });
    fetchSlots(entryKey, entry.service_id, dateIso, petsCount);
  };

  useEffect(() => {
    if (!hasDaycareCategory) return;
    entries.forEach((entry) => {
      if (String(entry?.category || '').toLowerCase() !== 'daycare') return;
      if (!entry?.service_id || !entry?.appointment_date) return;
      fetchSlots(entry.key, entry.service_id, entry.appointment_date, 1 + additionalPetIds.length);
    });
  }, [additionalPetIds.length, hasDaycareCategory, daycareSlotRefreshKey]);

  const hotelSlotQueryKey = entries
    .filter((entry) => isHotelEntry(entry))
    .map((entry) => `${entry.key}|${entry.service_id || ''}|${entry.appointment_date || ''}`)
    .join('||');

  useEffect(() => {
    entries.forEach((entry) => {
      if (!isHotelEntry(entry) || !entry?.service_id || !entry?.appointment_date) return;
      fetchSlots(entry.key, entry.service_id, entry.appointment_date, 1);
    });
  }, [hotelSlotQueryKey]);

  const petHasTicksOrFlea = !!(petHealthForm && (petHealthForm.has_ticks || petHealthForm.has_flea));
  const petMissingRabies = !!(petHealthForm?.missing_rabies);

  useEffect(() => {
    const category = String(activeEntry?.category || '').toLowerCase();
    if (!isOpen || bookingStep !== 1 || category !== 'hotel' || !petMissingRabies) return;
    showValidationModal('We cannot accept an unvaccinated pet for hotel services. Please update the pet assessment form before booking.');
  }, [isOpen, bookingStep, activeEntry?.category, petMissingRabies]);
  useEffect(() => {
    const entry = entries[activeItemIndex];
    if (!entry) return;
    if (String(entry.category || '').toLowerCase() === 'hotel') return;
    if (!entry.service_id || entry.size_label) return;

    const tiers = getServiceTiers(entry.selectedService);
    if (!tiers.length) return;
    if (shouldSkipGroomingSizeForCat(entry, petSpecies)) return;

    const visible = tiers.filter((tier) => {
      const s = String(tier.size_label || '').toUpperCase();
      const catSizes = ['CAT', 'KITTEN'];
      if (petSpecies === 'C') return catSizes.includes(s);
      if (petSpecies === 'D') return !catSizes.includes(s);
      return true;
    });

    if (visible.length === 1) {
      patchEntry(entry.key, { size_label: visible[0].size_label });
    }
  }, [entries, activeItemIndex, petSpecies]);

  const requiresRabiesVaccine = (entry) => {
    const cat = String(entry?.category || '').toLowerCase();
    return cat === 'hotel' || cat === 'daycare';
  };

  const canProceedFromStep0 = entries.every((entry) => Boolean(entry.category));

  useEffect(() => {
    if (!hasDaycareCategory) return;
    setDaycarePetSizes((prev) => {
      const allowed = new Set(selectedDaycarePetIds.map(String));
      const next = {};
      Object.entries(prev || {}).forEach(([petId, size]) => {
        if (allowed.has(String(petId))) next[String(petId)] = size;
      });
      return next;
    });
  }, [hasDaycareCategory, selectedDaycarePetIds.join('|')]);
  useEffect(() => {
    if (!hasDaycareCategory) return;
    const dogPetIds = new Set(ownerPets.filter(isDogPet).map((pet) => String(pet.id)));
    if (selectedPet?.id && !dogPetIds.has(String(selectedPet.id))) {
      setSelectedPet(null);
    }
    setAdditionalPetIds((prev) => prev.map(String).filter((id) => dogPetIds.has(id)));
    setDraftDaycarePetIds((prev) => prev.map(String).filter((id) => dogPetIds.has(id)));
  }, [hasDaycareCategory, ownerPets, selectedPet?.id]);
  const handleToggleDaycarePet = (pet) => {
    const petId = String(pet?.id || '');
    if (!petId) return;
    setFormError('');
    setDraftDaycarePetIds((prev) => {
      const selectedIds = prev.map(String);
      if (selectedIds.includes(petId)) return selectedIds.filter((id) => id !== petId);
      if (selectedIds.length >= 3) {
        showValidationModal(`Please select only up to ${DAYCARE_MAX_PETS} pets for daycare.`);
        return selectedIds;
      }
      void fetchPetAssessmentStatus(petId, { silent: true, force: false });
      return [...selectedIds, petId];
    });
  };
  const handleConfirmDaycarePets = () => {
    const selectedIds = draftDaycarePetIds.map(String).slice(0, DAYCARE_MAX_PETS);
    if (selectedIds.length < 1) {
      showValidationModal('Please select at least 1 pet for daycare.');
      return;
    }
    const primaryPet = ownerPets.find((pet) => String(pet.id) === selectedIds[0]);
    if (!primaryPet) {
      showValidationModal('The selected pet is no longer available. Please choose again.');
      return;
    }
    setSelectedPet(primaryPet);
    setAdditionalPetIds(selectedIds.slice(1));
    setDaycarePetCount(selectedIds.length);
    setFormError('');
  };
  const selectedPetAssessmentReady = Boolean(
    petAssessmentComplete || pendingAssessmentDrafts[String(selectedPet?.id || '')],
  );
  const continueFromOwnerAndPet = () => {
    if (!selectedOwner?.id) {
      showValidationModal('Please select a customer before continuing.');
      return;
    }
    if (hasDaycareCategory) {
      const selectedIds = draftDaycarePetIds.map(String);
      if (selectedIds.length < 1 || selectedIds.length > DAYCARE_MAX_PETS) {
        showValidationModal(`Please select between 1 and ${DAYCARE_MAX_PETS} dog pets for daycare.`);
        return;
      }
      const ineligiblePetId = selectedIds.find((petId) => {
        const pet = ownerPets.find((candidate) => String(candidate.id) === petId);
        return !pet || !isDogPet(pet);
      });
      if (ineligiblePetId) {
        showValidationModal('Daycare is for dogs only. Please select an eligible dog pet.');
        return;
      }
      const parasitePet = selectedIds.find((petId) => draftHasParasite(pendingAssessmentDrafts[petId]));
      if (parasitePet) {
        const pet = ownerPets.find((candidate) => String(candidate.id) === parasitePet);
        showValidationModal(`${pet?.name || 'The selected pet'} must be free from ticks and fleas before daycare booking can continue.`);
        return;
      }
      const missingFormPet = selectedIds.find((petId) => !pendingAssessmentDrafts[petId]);
      if (missingFormPet) {
        const pet = ownerPets.find((candidate) => String(candidate.id) === missingFormPet);
        showValidationModal(`Please complete the assessment form for ${pet?.name || 'every selected pet'} before continuing.`);
        return;
      }
      const missingRabiesPet = selectedIds.find((petId) => !draftHasRabies(pendingAssessmentDrafts[petId]));
      if (missingRabiesPet) {
        const pet = ownerPets.find((candidate) => String(candidate.id) === missingRabiesPet);
        showValidationModal(`Vaccination and rabies information is required for ${pet?.name || 'every selected pet'} before daycare booking can continue.`);
        return;
      }
      handleConfirmDaycarePets();
    } else {
      if (!selectedPet?.id) {
        showValidationModal('Please select a pet before continuing.');
        return;
      }
      if (!selectedPetAssessmentReady) {
        showValidationModal(`Please complete the assessment form for ${selectedPet?.name || 'the selected pet'} before continuing.`);
        return;
      }
      if (petHasTicksOrFlea) {
        showValidationModal(`${PARASITE_BLOCK_TITLE} ${PARASITE_BLOCK_BODY}`);
        return;
      }
      if (requiresRabiesVaccine(activeEntry) && petMissingRabies) {
        showValidationModal('Vaccination and rabies information is required for hotel services. Please update the pet assessment form.');
        return;
      }
    }
    setBookingStep(1);
  };

  const backFromService = () => {
    if (String(activeEntry.category || '').toLowerCase() === 'grooming' && activeEntry.grooming_booking_type) {
      patchEntry(activeEntry.key, {
        grooming_booking_type: '',
        service_id: '',
        selectedService: null,
        size_label: '',
        addon_ids: [],
        loadingAddons: false,
        addonsDecided: false,
        show_pawsome_extras: false,
      });
      return;
    }
    setBookingStep(0);
  };

  const continueFromServiceToSchedule = () => {
    if (!canProceedFromStep2) {
      if (hasDaycareCategory) {
        const daycareEntry = entries.find((entry) => String(entry.category || '').toLowerCase() === 'daycare');
        if (!daycareEntry?.service_id) {
          showValidationModal('Please select a daycare package.');
        } else if (!String(daycareEntry.daycare_duration || '').trim()) {
          showValidationModal('Please select daycare duration first (Hourly, Half Day, or Full Day).');
        } else {
          showValidationModal('Please select size for each selected daycare pet.');
        }
      } else if (hasHotelCategory) {
        const hotelEntry = entries.find((entry) => isHotelEntry(entry));
        if (hotelEntry && !hotelEntry.pet_size) {
          showValidationModal('Please select a Pet Size before choosing a hotel suite.');
        } else if (hotelEntry && (!hotelEntry.service_id || normalizeServiceCategory(hotelEntry.selectedService) !== 'hotel')) {
          showValidationModal('Hotel Suite service is still loading. Please wait, then try again.');
        } else {
          showValidationModal('Please select a hotel suite.');
        }
      } else {
        const groomingEntry = entries.find((entry) => String(entry.category || '').toLowerCase() === 'grooming');
        if (groomingEntry && !String(groomingEntry.grooming_booking_type || '').trim()) {
          showValidationModal('Please choose Grooming Package or Pawsome Extras.');
        } else if (groomingEntry && String(groomingEntry.grooming_booking_type || '').toLowerCase() === 'extras'
          && (!Array.isArray(groomingEntry.addon_ids) || groomingEntry.addon_ids.length === 0)) {
          showValidationModal('Please select at least one Pawsome Extra.');
        } else {
          showValidationModal('Please complete service details for all items.');
        }
      }
      return;
    }
    setBookingStep(2);
  };

  const canProceedFromStep2 = entries.every((entry) => {
    if (!entry.category) return false;
    if (String(entry.category).toLowerCase() === 'grooming') {
      const groomingType = String(entry.grooming_booking_type || '').toLowerCase();
      if (!groomingType) return false;
      if (groomingType === 'extras') {
        return Array.isArray(entry.addon_ids) && entry.addon_ids.length > 0;
      }
    }
    if (String(entry.category).toLowerCase() === 'hotel') {
      return Boolean(
        entry.hotel_suite_id
        && entry.pet_size
        && entry.service_id
        && normalizeServiceCategory(entry.selectedService) === 'hotel'
      );
    }
    if (!entry.service_id) return false;
    if (String(entry.category).toLowerCase() === 'daycare' && selectedDaycarePetIds.length > 0) {
      if (!String(entry.daycare_duration || '').trim()) return false;
      const allSized = selectedDaycarePetIds.every((petId) => Boolean(daycarePetSizes[String(petId)]));
      if (!allSized) return false;
    }
    const tiers = getServiceTiers(entry.selectedService);
    if (String(entry.category).toLowerCase() !== 'daycare'
      && tiers.length > 0
      && !entry.size_label
      && !shouldSkipGroomingSizeForCat(entry, petSpecies)) return false;
    return true;
  });

  const canProceedFromStep3 = entries.every((entry) => {
    if (!entry.appointment_date) return false;
    if (entry.appointment_date < TODAY) return false;
    if (isHotelEntry(entry)) {
      return !!(entry.hotel_checkout && Number(entry.hotel_nights) > 0 && entry.start_time);
    }
    return !!entry.start_time;
  });

  const scrollToBookingSection = (ref) => {
    window.setTimeout(() => {
      ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  useEffect(() => {
    if (!isOpen || booked) return;

    const nextAvailability = {
      serviceDetails: showBookingDetails,
      schedule: showBookingDetails,
      payment: Boolean(showBookingDetails && hasHotelCategory && canProceedFromStep3),
      notes: showBookingDetails,
    };
    const previous = previousSectionAvailabilityRef.current;

    if (nextAvailability.serviceDetails && !previous.serviceDetails) scrollToBookingSection(serviceDetailsSectionRef);
    else if (nextAvailability.schedule && !previous.schedule) scrollToBookingSection(scheduleSectionRef);
    else if (nextAvailability.payment && !previous.payment) scrollToBookingSection(paymentSectionRef);
    else if (nextAvailability.notes && !previous.notes) scrollToBookingSection(notesSectionRef);

    previousSectionAvailabilityRef.current = nextAvailability;
  }, [
    isOpen,
    booked,
    selectedPet,
    activeEntry.category,
    showBookingDetails,
    canProceedFromStep3,
    hasHotelCategory,
  ]);

  const validateHotelDepositReference = () => {
    if (requiredHotelDeposit <= 0) return true;
    if (!hotelReservationComplete) {
      showValidationModal('Select a payment method, payment provider, and who handled the reservation. Electronic payments also require a receiving account and either a reference number or proof of payment.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (isSaving) return;
    if (hasMixedHotelAndNonHotel) {
      showValidationModal('Hotel bookings must be placed separately from daycare/grooming services.');
      return;
    }
    if (!canProceedFromStep0) {
      showValidationModal('Please choose a service category first.');
      return;
    }
    if (!selectedOwner || !selectedPet) {
      showValidationModal('Please select customer and pet.');
      return;
    }
    if (!canProceedFromStep2) {
      if (hasDaycareCategory) {
        const daycareEntry = entries.find((entry) => String(entry.category || '').toLowerCase() === 'daycare');
        if (daycareEntry && !String(daycareEntry.daycare_duration || '').trim()) {
          showValidationModal('Please select daycare duration first (Hourly, Half Day, or Full Day).');
        } else {
          showValidationModal('Please select size for each selected daycare pet.');
        }
      } else if (hasHotelCategory) {
        const hotelEntry = entries.find((entry) => isHotelEntry(entry));
        if (hotelEntry && !hotelEntry.pet_size) {
          showValidationModal('Please select a Pet Size before choosing a hotel suite.');
        } else if (hotelEntry && (!hotelEntry.service_id || normalizeServiceCategory(hotelEntry.selectedService) !== 'hotel')) {
          showValidationModal('Hotel Suite service is still loading. Please wait, then try again.');
        } else {
          showValidationModal('Please select a hotel suite.');
        }
      } else {
        const groomingEntry = entries.find((entry) => String(entry.category || '').toLowerCase() === 'grooming');
        if (groomingEntry && !String(groomingEntry.grooming_booking_type || '').trim()) {
          showValidationModal('Please choose Grooming Package or Pawsome Extras.');
        } else if (groomingEntry && String(groomingEntry.grooming_booking_type || '').toLowerCase() === 'extras'
          && (!Array.isArray(groomingEntry.addon_ids) || groomingEntry.addon_ids.length === 0)) {
          showValidationModal('Please select at least one Pawsome Extra.');
        } else {
          showValidationModal('Please complete service details for all items.');
        }
      }
      return;
    }
    if (!canProceedFromStep3) {
      if (hasHotelCategory) {
        showValidationModal('Please select a valid check-in date, check-out date, and check-in time for hotel bookings.');
      } else if (hasDaycareCategory) {
        const daycareEntry = entries.find((entry) => String(entry.category || '').toLowerCase() === 'daycare');
        const daycareIssue = daycareEntry ? getDaycareScheduleIssue(daycareEntry) : null;
        if (daycareIssue === 'missing_date') showValidationModal('Please select daycare date.');
        else if (daycareIssue === 'missing_time') showValidationModal('Please select daycare time.');
        else if (daycareIssue === 'missing_duration') showValidationModal('Please select daycare duration first (Hourly, Half Day, or Full Day).');
        else if (daycareIssue === 'exceeds_close') showValidationModal('Selected daycare time exceeds closing hours. Please choose a start time that fits before 5:00 PM.');
        else showValidationModal('Please select a valid daycare date and time.');
      } else {
        showValidationModal('Please select a valid appointment date and time.');
      }
      return;
    }
    const manilaNow = getManilaDateTime();
    const localToday = manilaNow.date;
    const [currentHour, currentMinute] = manilaNow.time.split(':').map(Number);
    const currentMinutes = (currentHour * 60) + currentMinute;
    const hasPastTimeToday = entries.some((entry) => {
      if (entry.appointment_date !== localToday || !entry.start_time) return false;
      const [hours, minutes] = String(entry.start_time).split(':').map(Number);
      return Number.isFinite(hours) && Number.isFinite(minutes)
        && ((hours * 60) + minutes) <= currentMinutes;
    });
    const immediateWalkInSelected = walkInMode && entries.some((entry) =>
      String(entry.category || '').toLowerCase() === 'grooming'
      && entry.walkInStartTime
      && String(entry.start_time || '').slice(0, 5) === String(entry.walkInStartTime).slice(0, 5)
    );
    if (hasPastTimeToday && !immediateWalkInSelected) {
      showValidationModal('You cannot book an appointment for a time that has already passed.');
      return;
    }
    if (!validateHotelDepositReference()) return;

    setIsSaving(true);
    setFormError('');
    try {
      const resolveEntryServiceIdForSubmit = (entry) => {
        const category = normalizeServiceCategory(entry);
        const source = [
          entry?.selectedService,
          ...(services || []),
          ...(allServicesCacheRef.current || []),
        ].filter(Boolean);
        const selectedService = source.find((service) =>
          String(service?.id || '') === String(entry?.service_id || '')
          && normalizeServiceCategory(service) === category
        );
        if (selectedService) return selectedService.id;

        if (category === 'hotel' || category === 'daycare') {
          return source.find((service) => normalizeServiceCategory(service) === category)?.id || null;
        }

        const isGroomingExtras = category === 'grooming'
          && String(entry?.grooming_booking_type || '').toLowerCase() === 'extras';
        if (!isGroomingExtras) return null;
        const pawsomeExtrasService = source.find((service) =>
          isPawsomeExtrasService(service) && normalizeServiceCategory(service) === 'grooming'
        );
        return pawsomeExtrasService?.id || null;
      };

      const normalizedEntries = entries.map((entry) => {
        const tiers = getServiceTiers(entry.selectedService);
        const firstTier = tiers[0]?.size_label || 'Standard';
        const daycarePrimarySize = String(entry.category || '').toLowerCase() === 'daycare'
          ? (daycarePetSizes[String(selectedPet.id)] || entry.size_label || firstTier)
          : (entry.size_label || firstTier);
        const effectiveServiceId = resolveEntryServiceIdForSubmit(entry);
        return {
          service_id: effectiveServiceId,
          promotion_id: entry.promotion_id || null,
          size_label: daycarePrimarySize,
          pet_size: isHotelEntry(entry) ? entry.pet_size || null : null,
          appointment_date: entry.appointment_date,
          start_time: entry.start_time || (isHotelEntry(entry) ? '09:00:00' : null),
          daycare_duration: entry.daycare_duration || null,
          hotel_suite_id: entry.hotel_suite_id || null,
          hotel_nights: entry.hotel_nights ? Number(entry.hotel_nights) : null,
        };
      });

      const firstEntry = normalizedEntries[0] || {};
      if (!firstEntry.service_id) {
        const category = normalizeServiceCategory(entries[0]);
        const message = category === 'hotel'
          ? 'Unable to resolve the Hotel Suite service. Please wait for hotel services to finish loading, then try again.'
          : category === 'grooming'
            ? 'Unable to resolve grooming service for this booking. Please reselect Grooming and try again.'
            : category === 'daycare'
              ? 'Unable to resolve the Daycare service. Please reselect Daycare and try again.'
              : 'Unable to resolve the selected service. Please reselect it and try again.';
        throw new Error(message);
      }
      const hasHotel = entries.some((entry) => isHotelEntry(entry));
      const targetPetIds = hasDaycareCategory
        ? selectedDaycarePetIds
        : [String(selectedPet.id)];
      for (const petId of targetPetIds) {
        const rawDraft = pendingAssessmentDrafts[String(petId)] || (!hasDaycareCategory && String(petId) === String(selectedPet.id) ? pendingAssessmentDraft : null);
        if (!rawDraft) {
          continue;
        }
        if (rawDraft._existing_today) {
          continue;
        }
        const draftPet = [selectedPet, ...ownerPets].find((p) => String(p?.id) === String(petId)) || null;
        const draft = sanitizeDraftVaccinesForPet(rawDraft, draftPet);
        const assessmentBody = { ...draft, service_id: firstEntry.service_id };
        const assessmentRes = await apiFetch(`/api/pets/${petId}/health-form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assessmentBody),
        });
        const assessmentData = await assessmentRes.json().catch(() => ({}));
        if (!assessmentRes.ok) {
          const message = assessmentRes.status >= 500
            ? 'The assessment could not be saved right now. Please try again later.'
            : assessmentData?.errors
            ? Object.values(assessmentData.errors).flat().join(' ')
            : assessmentData?.message || 'Assessment form could not be saved.';
          throw new Error(message);
        }
        petAssessmentCacheRef.current.set(petId, {
          form: assessmentBody,
          complete: true,
        });
      }
      setPendingAssessmentDraft(null);

      const body = {
        pet_id: selectedPet.id,
        service_id: firstEntry.service_id,
        promotion_id: firstEntry.promotion_id || null,
        size_label: firstEntry.size_label,
        pet_size: firstEntry.pet_size || null,
        appointment_date: firstEntry.appointment_date,
        start_time: firstEntry.start_time,
        hotel_suite_id: firstEntry.hotel_suite_id || null,
        hotel_nights: firstEntry.hotel_nights || null,
        daycare_duration: firstEntry.daycare_duration || null,
        special_instructions: note || null,
        booked_by_owner_id: selectedOwner.id,
        status: 'approved',
        booked_packages: normalizedEntries,
        booking_source: walkInMode ? 'walk_in' : 'admin',
        ...(hasDaycareCategory ? { additional_pet_ids: additionalPetIds } : {}),
        ...(hasDaycareCategory ? {
          daycare_pet_sizes: selectedDaycarePetIds.map((petId) => ({
            pet_id: String(petId),
            size_label: daycarePetSizes[String(petId)] || normalizedEntries[0]?.size_label || null,
          })),
        } : {}),
        ...(hasHotel ? {
          deposit: requiredHotelDeposit,
          reference_number: requiresElectronicReference ? sanitizeReferenceNumber(referenceNumber) : null,
          has_deposit_proof: requiresElectronicReference ? Boolean(depositProof) : false,
          reservation_channel: modeOfPayment,
          reservation_payment_account_id: requiresElectronicReference ? receivingPaymentAccountId : null,
          reservation_payer_provider: requiresElectronicReference ? selectedReservationProvider : null,
          notes: buildHotelReservationNote(modeOfPayment, selectedReservationProvider),
          handled_by: handledById,
        } : {}),
      };

      // Map selected addon_ids to backend-compatible addons payload.
      // This is required so Pawsome Extras can be booked as standalone grooming.
      const selectedAddonIds = Array.from(new Set(
        entries.flatMap((entry) => (
          String(entry?.category || '').toLowerCase() === 'grooming'
          && String(entry?.grooming_booking_type || '').toLowerCase() === 'extras'
          && Array.isArray(entry?.addon_ids)
            ? entry.addon_ids
            : []
        ))
      ));
      if (selectedAddonIds.length > 0) {
        const addonMap = new Map(
          entries.flatMap((entry) => (
            String(entry?.category || '').toLowerCase() === 'grooming'
            && String(entry?.grooming_booking_type || '').toLowerCase() === 'extras'
            && Array.isArray(entry?.availableAddons)
              ? entry.availableAddons
              : []
          ))
            .map((addon) => [String(addon.id), addon])
        );
        body.addons = selectedAddonIds.map((addonId) => {
          const addon = addonMap.get(String(addonId));
          const charged = Number(addon?.price_min ?? addon?.price ?? 0);
          return {
            addon_id: addonId,
            price_charged: Number.isFinite(charged) ? charged : 0,
          };
        });
      }

      let res = await apiPost('/api/appointments', body);
      let data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        // Fallback for environments where base URL already includes /api.
        res = await apiPost('/appointments', body);
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        if (res.status >= 500) {
          throw new Error('Unable to save the appointment right now. Please try again later.');
        }
        const details = data?.errors ? Object.values(data.errors).flat().join(' ') : '';
        const message = details || data?.message || `Failed to save appointment (HTTP ${res.status}).`;
        throw new Error(message);
      }
      const appointment = data?.data || data?.appointment || data;

      if (depositProof && appointment?.id) {
        const proofBody = new FormData();
        proofBody.append('proof', depositProof);
        const proofRes = await apiFetch(`/api/appointments/${appointment.id}/deposit-proof`, { method: 'POST', body: proofBody });
        if (!proofRes.ok) throw new Error('The booking was created, but the proof of payment could not be uploaded.');
      }

      setPendingAssessmentDrafts({});
      if (appointment?.id) {
        const savedRetailSales = await saveRetailDraftsForAppointment(appointment.id);
        if (savedRetailSales.length > 0) {
          setRetailSales((prev) => [
            ...savedRetailSales,
            ...prev.filter((sale) => !sale?.is_draft),
          ]);
        }
      }

      setBookedAppointments(appointment ? [appointment] : []);
      setBooked(true);

      // The appointment is already saved at this point. Refresh both consumers
      // in the background instead of keeping the save button loading on two
      // overlapping month-list requests.
      void Promise.allSettled([
        loadAppointments({ force: true, silent: true }),
        loadMonthAppointments({ force: true, silent: true }),
      ]);
    } catch (error) {
      showValidationModal(error.message || 'Failed to save appointment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintBookedAssessment = async () => {
    const appointment = bookedAppointments[0] || null;
    const petIds = hasDaycareCategory
      ? [String(selectedPet?.id || ''), ...additionalPetIds.map(String)].filter(Boolean)
      : [String(selectedPet?.id || '')].filter(Boolean);
    if (petIds.length === 0 || isPrintingAssessment) return;

    setIsPrintingAssessment(true);
    setFormError('');
    try {
      for (const petId of petIds) {
        const params = new URLSearchParams();
        if (appointment?.id) params.set('appointment_id', appointment.id);
        if (appointment?.service_id) params.set('service_id', appointment.service_id);
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await apiFetch(`/api/pets/${petId}/health-form${query}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.data) throw new Error('Failed to download one or more assessment forms.');
        const petObj = [selectedPet, ...ownerPets].find((pet) => String(pet?.id) === String(petId)) || null;
        await downloadPetAssessmentRecordPdf({
          record: { ...data.data, appointment: data.data?.appointment || appointment },
          pet: petObj || selectedPet || {},
          owner: selectedOwner || petObj?.owner || {},
        });
      }
    } catch (error) {
      setFormError(error?.message || 'Unable to download the assessment form.');
    } finally {
      setIsPrintingAssessment(false);
    }
  };
  useEffect(() => {
    if (!booked || autoDownloadAssessmentsRef.current || isPrintingAssessment) return;
    autoDownloadAssessmentsRef.current = true;
    void handlePrintBookedAssessment();
  }, [booked]);

  const handleModalClose = () => {
    onClose();
  };

  const approvedAppointmentId = bookedAppointments[0]?.id || null;
  const openRetailPurchaseModal = () => {
    if (!canUseRetailPurchase) {
      showValidationModal('Please select an owner and pet before adding a retail purchase.');
      return;
    }
    if (retailSales.length > 0) {
      openEditRetailPurchaseModal(retailSales[0]);
      return;
    }
    setEditingRetailSale(null);
    setRetailSaleOpen(true);
  };
  const openEditRetailPurchaseModal = (sale) => {
    if (!sale?.id) return;
    setEditingRetailSale(sale);
    setRetailSaleOpen(true);
  };
  const handleRetailSaleSaved = (sale) => {
    if (!sale) {
      setRetailSaleOpen(false);
      setEditingRetailSale(null);
      return;
    }
    setRetailSales((prev) => {
      const key = String(sale.id || sale.receipt_number || '');
      if (!key) return [sale, ...prev];
      const exists = prev.some((item) => String(item.id || item.receipt_number || '') === key);
      if (!exists) return [sale, ...prev];
      return prev.map((item) => (String(item.id || item.receipt_number || '') === key ? sale : item));
    });
    setRetailSaleOpen(false);
    setEditingRetailSale(null);
  };
  const saveRetailDraftsForAppointment = async (appointmentId) => {
    const drafts = retailSales.filter((sale) => sale?.is_draft);
    if (!appointmentId || drafts.length === 0) return [];

    const savedSales = [];
    for (const draft of drafts) {
      const res = await apiFetch('/api/admin/walk-in-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: appointmentId,
          customer_name: draft.customer_name || (selectedOwner ? getOwnerName(selectedOwner) : null),
          payment_method: null,
          payment_channel: null,
          reference_number: null,
          notes: draft.notes || null,
          items: (draft.items || []).map((item) => ({
            inventory_id: item.inventory_id || item.product_id,
            quantity: item.quantity || item.quantity_used || 0,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.errors?.items?.[0] || 'Retail purchase could not be saved.');
      }
      if (data?.data) savedSales.push(data.data);
    }

    return savedSales;
  };

  const handleAssessmentSavedForBooking = (petName, pet) => {
    const petId = String(pet?.id || selectedPet?.id || '');
    if (petId) {
      setPendingAssessmentDrafts((prev) => ({ ...prev, [petId]: prev[petId] || pendingAssessmentDraft || {} }));
    }
    setAssessmentSavedNotice(`${petName || 'Pet'} assessment saved successfully. You can continue booking.`);
    setTimeout(() => setAssessmentSavedNotice(''), 3500);
  };

  const handleAssessmentDraftSavedForBooking = (payload, pet) => {
    const petId = String(pet?.id || selectedPet?.id || payload?.pet_id || '');
    const nextDraft = { ...payload, pet_id: petId };
    setPendingAssessmentDraft(nextDraft);
    if (petId) {
      setPendingAssessmentDrafts((prev) => ({ ...prev, [petId]: nextDraft }));
    }
    const draftVaccines = Array.isArray(payload?.vaccines) ? payload.vaccines : [];
    const hasRabies = Boolean(
      payload?.vaccine_rabies ||
      draftVaccines.some((name) => String(name || '').toLowerCase().includes('rabies')),
    );
    setPetHealthForm((prev) => ({
      ...(prev || {}),
      has_ticks: Boolean(payload?.has_ticks),
      has_flea: Boolean(payload?.has_flea),
      has_rabies: hasRabies,
      missing_rabies: !hasRabies,
      declaration_accepted: Boolean(payload?.declaration_accepted),
      is_vaccinated: payload?.is_vaccinated,
      is_friendly: payload?.is_friendly,
    }));
    setPetAssessmentComplete(true);
    setAssessmentSavedNotice('Assessment edits are ready. They will be saved only when this booking is saved.');
    setTimeout(() => setAssessmentSavedNotice(''), 5000);
  };

  const assessmentPetDraft = assessmentPet
    ? pendingAssessmentDrafts[String(assessmentPet.id)] || (String(selectedPet?.id || '') === String(assessmentPet.id) ? pendingAssessmentDraft : null)
    : null;

  if (!isOpen) return null;

  if (booked) {
    return createPortal(
      <BookingSuccessModal
        walkInMode={walkInMode}
        onClose={handleModalClose}
        suppliesEnabled={suppliesEnabled}
        retailSales={retailSales}
        openRetailPurchaseModal={openRetailPurchaseModal}
        canUseRetailPurchase={canUseRetailPurchase}
        isPrintingAssessment={isPrintingAssessment}
        onPrintAssessment={handlePrintBookedAssessment}
        approvedAppointmentId={approvedAppointmentId}
        selectedOwner={selectedOwner}
        getOwnerName={getOwnerName}
        retailSaleOpen={retailSaleOpen}
        editingRetailSale={editingRetailSale}
        onCloseRetailSale={() => {
          setRetailSaleOpen(false);
          setEditingRetailSale(null);
        }}
        onRetailSaleSaved={handleRetailSaleSaved}
      />,
      document.body
    );
  }

  return createPortal(
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="fixed inset-0 z-[120] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-3 backdrop-blur-sm sm:p-4" onClick={handleModalClose}>
        <div
          className="relative flex h-[92dvh] max-h-[92dvh] w-full flex-col overflow-visible rounded-2xl bg-white shadow-2xl sm:h-[88vh] sm:max-w-4xl lg:max-w-4xl lg:-translate-x-[10.5rem]"
          onClick={(event) => event.stopPropagation()}
        >
        <BookingStepHeader bookingStep={bookingStep} walkInMode={walkInMode} onClose={handleModalClose} />

        <>
            <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden bg-brand-surface/40 p-2.5 sm:p-3 lg:rounded-b-2xl">
              <div className="min-h-0 overflow-y-auto">
                <div className="mx-auto w-full max-w-none space-y-2.5 sm:space-y-3">
                  {bookingStep === 0 && (
                  <BookingFormSection title="Customer & Pet" subtitle="Search the customer, choose the pet, then complete its assessment before continuing.">
                  <OwnerSearchStep
                    ownerQuery={ownerQuery}
                    ownerResults={displayedOwnerResults}
                    ownerSearching={ownerSearching}
                    showOwnerDropdown={showOwnerDropdown}
                    setShowOwnerDropdown={setShowOwnerDropdown}
                    selectedOwner={selectedOwner}
                    handleSelectOwner={handleSelectOwner}
                    ownerPets={ownerPets}
                    loadingPets={loadingPets}
                    selectedPet={selectedPet}
                    setSelectedPet={(pet) => {
                      if (String(selectedPet?.id || '') !== String(pet?.id || '')) {
                        setEntries((previous) => previous.map((entry) =>
                          isHotelEntry(entry) ? { ...entry, pet_size: '' } : entry
                        ));
                      }
                      setSelectedPet(pet);
                      setAdditionalPetIds((prev) => prev.filter((id) => String(id) !== String(pet?.id)));
                    }}
                    petAssessmentComplete={petAssessmentComplete}
                    petAssessmentLoading={petAssessmentLoading}
                    petHasTicksOrFlea={petHasTicksOrFlea}
                    assessmentSavedNotice={assessmentSavedNotice}
                    assessmentPet={assessmentPet}
                    setAssessmentPet={setAssessmentPet}
                    setRecordsPet={setRecordsPet}
                    fetchPetAssessmentStatus={fetchPetAssessmentStatus}
                    assessmentDraft={pendingAssessmentDraft}
                    onAssessmentSaved={handleAssessmentSavedForBooking}
                    onAssessmentDraftSaved={handleAssessmentDraftSavedForBooking}
                    handleOwnerQueryChange={handleOwnerQueryChange}
                    getOwnerName={getOwnerName}
                    getOwnerAddress={getOwnerAddress}
                    serviceId={activeEntry?.service_id || null}
                    serviceCategory={activeEntry?.selectedService?.category || activeEntry?.category || ''}
                    assessmentDraftsByPet={pendingAssessmentDrafts}
                    isDaycareFlow={hasDaycareCategory}
                    selectedDaycarePetIds={daycarePickerPetIds}
                    onToggleDaycarePet={handleToggleDaycarePet}
                    assessmentPlacement="inline"
                  />
                  </BookingFormSection>
                  )}

                  {bookingStep === 1 && (
                    <div ref={serviceDetailsSectionRef}>
                      {!selectedPet?.id ? (
                        <BookingFormSection title="Service Details" subtitle="The selected pet was lost while opening daycare.">
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
                            <p className="text-xs font-bold text-brand-dark">Please return and select the daycare pet again.</p>
                            <button
                              type="button"
                              onClick={() => setBookingStep(0)}
                              className="mt-3 rounded-lg bg-brand-teal px-4 py-2 text-xs font-bold text-white hover:bg-brand-teal-dark"
                            >
                              Back to Owner &amp; Pet
                            </button>
                          </div>
                        </BookingFormSection>
                      ) : (
                      <BookingFormSection title="Service Details" subtitle="Choose package, suite, duration, or size.">
                      <ServiceSelectionStep
                        entries={entries}
                        activeItemIndex={activeItemIndex}
                        setActiveItemIndex={setActiveItemIndex}
                        activeEntry={activeEntry}
                        hotelSuites={hotelSuites}
                        hotelSuitesForPet={hotelSuitesForPet}
                        petSpecies={petSpecies}
                        services={services}
                        pawsomeExtrasService={pawsomeExtrasService}
                        patchEntry={patchEntry}
                        handleCategoryChange={handleCategoryChange}
                        handleServiceChange={handleServiceChange}
                        setEntries={setEntries}
                        freshEntry={freshEntry}
                        petHasTicksOrFlea={petHasTicksOrFlea}
                        petMissingRabies={petMissingRabies}
                        hasHotelCategory={hasHotelCategory}
                        hasNonHotelCategory={hasNonHotelCategory}
                        hasDaycareAndGrooming={hasDaycareAndGrooming}
                        lockCategory
                        selectedDaycarePetIds={selectedDaycarePetIds}
                        ownerPets={ownerPets}
                        daycarePetSizes={daycarePetSizes}
                        setDaycarePetSizes={setDaycarePetSizes}
                      />
                      </BookingFormSection>
                      )}
                    </div>
                  )}

                  {bookingStep === 2 && showBookingDetails && (
                    <div ref={scheduleSectionRef}>
                      <BookingFormSection title="Schedule" subtitle={hasHotelCategory ? 'Pick hotel check-in, check-out, and check-in time.' : 'Pick appointment date and available time.'}>
                      <DateTimeStep
                          entries={entries}
                          activeItemIndex={activeItemIndex}
                          setActiveItemIndex={setActiveItemIndex}
                          hotelMonth={hotelMonth}
                          setHotelMonth={setHotelMonth}
                          hotelCalendarLoading={hotelCalendarLoading}
                          hotelClosedDates={hotelClosedDates}
                          hotelUnavailableDates={hotelUnavailableDates}
                          hotelCapacityByDate={hotelCapacityByDate}
                          patchEntry={patchEntry}
                          handleDateChange={handleDateChange}
                          setFormError={showValidationModal}
                          TODAY={TODAY}
                          lockAppointmentDate={walkInMode}
                          walkInMode={walkInMode}
                        />
                      </BookingFormSection>
                    </div>
                  )}

                  {bookingStep === 2 && showBookingDetails && hasHotelCategory && canProceedFromStep3 && (
                    <BookingPaymentSection
                      paymentSectionRef={paymentSectionRef}
                      bookingDisplayTotal={bookingDisplayTotal}
                      effectiveHotelDeposit={effectiveHotelDeposit}
                      estimatedShopPayment={estimatedShopPayment}
                      modeOfPayment={modeOfPayment}
                      setModeOfPayment={setModeOfPayment}
                      handledById={handledById}
                      setHandledById={setHandledById}
                      bookingStaff={bookingStaff}
                      requiresElectronicReference={requiresElectronicReference}
                      reservationProvider={reservationProvider}
                      setReservationProvider={setReservationProvider}
                      reservationOtherName={reservationOtherName}
                      setReservationOtherName={setReservationOtherName}
                      receivingPaymentAccountId={receivingPaymentAccountId}
                      setReceivingPaymentAccountId={setReceivingPaymentAccountId}
                      receivingPaymentOptions={receivingPaymentOptions}
                      referenceNumber={referenceNumber}
                      setReferenceNumber={setReferenceNumber}
                      sanitizeReferenceNumber={sanitizeReferenceNumber}
                      depositProof={depositProof}
                      setDepositProof={setDepositProof}
                      paymentTypeOptions={PAYMENT_TYPE_OPTIONS}
                      ewalletOptions={EWALLET_OPTIONS}
                      bankOptions={BANK_OPTIONS}
                    />
                  )}
                  {bookingStep === 2 && showBookingDetails && (
                    <div ref={notesSectionRef}>
                      <BookingFormSection title="Notes" subtitle="Optional internal note for this booking.">
                        <textarea
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          rows={3}
                          placeholder="Add booking notes..."
                          className="w-full resize-none rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                        />
                      </BookingFormSection>
                    </div>
                  )}
                </div>
              </div>

              <BookingSummarySidebar
                onClose={handleModalClose}
                onEditOwner={() => setBookingStep(0)}
                getOwnerName={getOwnerName}
                selectedOwner={selectedOwner}
                selectedPet={selectedPet}
                additionalPetIds={additionalPetIds}
                ownerPets={ownerPets}
                entries={entries}
                hotelSuites={hotelSuites}
                bookingDisplayTotal={bookingDisplayTotal}
                requiredHotelDeposit={requiredHotelDeposit}
                effectiveHotelDeposit={effectiveHotelDeposit}
                estimatedShopPayment={estimatedShopPayment}
                suppliesEnabled={suppliesEnabled}
                retailSales={retailSales}
                openRetailPurchaseModal={openRetailPurchaseModal}
                canUseRetailPurchase={canUseRetailPurchase}
              />
            </div>

              <BookingNavigation
                bookingStep={bookingStep}
                hasDaycareCategory={hasDaycareCategory}
                draftDaycarePetIds={draftDaycarePetIds}
                isSaving={isSaving}
                onClose={handleModalClose}
                onBackFromService={backFromService}
                onContinueFromOwnerAndPet={continueFromOwnerAndPet}
                onContinueFromService={continueFromServiceToSchedule}
                onBackToService={() => setBookingStep(1)}
                onSubmit={handleSubmit}
              />
        </>
        </div>
      </div>

      <PetAssessmentRecordsModal
        isOpen={Boolean(recordsPet)}
        pet={recordsPet}
        onClose={() => setRecordsPet(null)}
      />

      <PetAssessmentFormModal
        isOpen={Boolean(assessmentPet) && bookingStep !== 0}
        pet={assessmentPet}
        apiBase="/api/pets"
        theme="pet_owner"
        serviceId={activeEntry?.service_id || null}
        serviceCategory={activeEntry?.selectedService?.category || activeEntry?.category || ''}
        deferSave
        saveLabel="Save for Booking"
        initialDraft={assessmentPetDraft}
        onClose={() => setAssessmentPet(null)}
        onSaved={(payload) => handleAssessmentDraftSavedForBooking(payload, assessmentPet)}
      />

      {suppliesEnabled && retailSaleOpen && (
        <WalkInSaleModal
          appointmentId={approvedAppointmentId}
          initialCustomerName={selectedOwner ? getOwnerName(selectedOwner) : ''}
          hidePayment
          editingSale={editingRetailSale}
          draftMode={!approvedAppointmentId}
          onClose={() => {
            setRetailSaleOpen(false);
            setEditingRetailSale(null);
          }}
          onSaved={handleRetailSaleSaved}
        />
      )}

      <AdminBookingValidationBox
        open={validationModal.open}
        title={validationModal.title}
        message={validationModal.message}
        actionLabel={validationModal.title === 'Assessment Form Required' ? 'Answer Assessment' : 'Continue Booking'}
        onContinue={() => {
          const shouldOpenAssessment = validationModal.title === 'Assessment Form Required';
          setValidationModal({ open: false, title: '', message: '' });
          if (shouldOpenAssessment && selectedPet) {
            setBookingStep(0);
            setAssessmentPet(selectedPet);
          }
        }}
        onExit={() => {
          setValidationModal({ open: false, title: '', message: '' });
          handleModalClose();
        }}
      />

    </>,
    document.body
  );
}
