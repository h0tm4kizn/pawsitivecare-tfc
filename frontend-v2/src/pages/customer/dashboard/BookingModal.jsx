import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { apiGet, apiFetch } from '../../../api/apiClient';
import { useStatus } from '@powersync/react';
import { db } from '../../../utils/powersync/db';
import { fmtTime12 as fmtTime, diffDays, toIso } from '../../../utils/dateUtils';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import PetAssessmentFormModal from '../../../components/modals/PetAssessmentFormModal';
import { formatHotelDescription, normalizeBreedName, sanitizeText } from '../../../utils/textUtils';
import { DAYCARE_MAX_PETS } from '../../../utils/daycareBooking';
import BookingModalSummary from './BookingModalSummary';
import BookingModalPetStep from './BookingModalPetStep';
import BookingModalScheduleStep from './BookingModalScheduleStep';
import BookingModalServiceStep from './BookingModalServiceStep';
import BookingModalSidebar from './BookingModalSidebar';
import BookingModalView from './BookingModalView';
import useBookingSubmit from './useBookingSubmit';
import { useCustomerBookingStore } from '../../../stores/customerBookingStore';
import { hotelCheckInTimeError } from '../../../utils/hotelCheckInTime';
import {
  BANK_OPTIONS as GENERAL_BANK_OPTIONS,
  EWALLET_OPTIONS as GENERAL_EWALLET_OPTIONS,
} from '../../../constants/paymentProviders';
import BookingStepIndicator from '../../admin/appointment/booking/components/StepPill';
import ClientBookingValidationBox from './booking/components/ClientBookingValidationBox';
import {
  TODAY,
  EMPTY_ITEM,
  getSpeciesCode,
  getServiceName,
  normalizeService,
  isSameManilaDay,
  computeEstimatedTotal,
  rangeHasBlockedNights,
  getAutoCatSizeLabel,
  shouldSkipGroomingSizeForCat,
  getDaycareTierPrice,
} from './bookingUtils';
import {
  MAX_BOOKING_DATE,
  MAX_BOOKING_MONTH_INDEX,
  PARASITE_BLOCK_BODY,
  PARASITE_BLOCK_TITLE,
  PAYMENT_TYPE_OPTIONS,
  STEPS_WITHOUT_PAYMENT,
  STEPS_WITH_RESERVATION,
  addonDisplayName,
  addonDisplayTier,
  addonPriceLabel,
  buildHotelReservationNote,
  formatHotelDateTime,
  getArr,
  getDaycareSizeOptions,
  daycareSizeLabel,
  isDogPet,
  isPawsomeExtrasService,
  normalizeGroomingAddonsFromServicePage,
  petBg,
  petBorder,
  petLight,
  petText,
  sanitizeReferenceNumber,
  sizeWeightHint,
} from './bookingModalUtils';

export default function BookingModal({
  isOpen, onClose, pets = [], petsLoading = false, onBooked,
  selectedDate, selectedCategory: preselectedCategory,
  initialStep, initialForm, onFillHealthForm, onSaveState,
}) {
  useBodyScrollLock(isOpen);
  const powersyncStatus = useStatus();
  const powersyncConnected = powersyncStatus?.connected ?? false;
  const [services,        setServices]        = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError,   setServicesError]   = useState('');
  const [catalogRetryKey, setCatalogRetryKey] = useState(0);
  const servicesLoadedRef = useRef(false);
  const [slotStateByIndex, setSlotStateByIndex] = useState({});
  const slotsRequestRef = useRef({});
  const backStepLockRef = useRef(false);
  const serviceClickLockRef = useRef(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [hotelSuites,     setHotelSuites]     = useState([]);
  const [hotelSuitesLoading, setHotelSuitesLoading] = useState(false);
  const [hotelSuitesSlow, setHotelSuitesSlow] = useState(false);
  const [hotelSuitesError, setHotelSuitesError] = useState('');
  const [hotelSuitesRetryKey, setHotelSuitesRetryKey] = useState(0);
  const hotelSuitesCacheRef = useRef(null);
  const [modeOfPayment,   setModeOfPayment]   = useState('');
  const [paymentFromProvider, setPaymentFromProvider] = useState('');
  const [paymentFromOtherName, setPaymentFromOtherName] = useState('');
  const [bankName,        setBankName]        = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentToAccount, setPaymentToAccount] = useState(null);
  const [reservationOtherName, setPaymentOtherName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [depositProof, setDepositProof] = useState(null);
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [additionalPetIds, setAdditionalPetIds] = useState([]);
  const [daycarePetSizes, setDaycarePetSizes] = useState({});
  const [hotelCalendarLoading,  setHotelCalendarLoading]  = useState(false);
  const [hotelCalendarSlow, setHotelCalendarSlow] = useState(false);
  const [hotelCalendarLoadedKey, setHotelCalendarLoadedKey] = useState('');
  const [hotelCalendarError, setHotelCalendarError] = useState('');
  const [hotelCalendarRetryKey, setHotelCalendarRetryKey] = useState(0);
  const [assessmentPet, setAssessmentPet] = useState(null);
  const [pendingAssessmentDraft, setPendingAssessmentDraft] = useState(null);
  const [pendingAssessmentDrafts, setPendingAssessmentDrafts] = useState({});
  const step = useCustomerBookingStore((s) => s.step);
  const error = useCustomerBookingStore((s) => s.error);
  const booked = useCustomerBookingStore((s) => s.booked);
  const serviceAssessments = useCustomerBookingStore((s) => s.serviceAssessments);
  const petHealthStatus = useCustomerBookingStore((s) => s.petHealthStatus);
  const [petAssessmentFlags, setPetAssessmentFlags] = useState({});
  const hotelMonth = useCustomerBookingStore((s) => s.hotelMonth);
  const hotelUnavailableDates = useCustomerBookingStore((s) => s.hotelUnavailableDates);
  const hotelClosedDates = useCustomerBookingStore((s) => s.hotelClosedDates);
  const hotelCapacityByDate = useCustomerBookingStore((s) => s.hotelCapacityByDate);
  const bookingItems = useCustomerBookingStore((s) => s.bookingItems);
  const activeItemIndex = useCustomerBookingStore((s) => s.activeItemIndex);
  const form = useCustomerBookingStore((s) => s.form);
  const resetBookingState = useCustomerBookingStore((s) => s.resetBookingState);
  const setStep = useCustomerBookingStore((s) => s.setStep);
  const setError = useCustomerBookingStore((s) => s.setError);
  const setBooked = useCustomerBookingStore((s) => s.setBooked);
  const setServiceAssessments = useCustomerBookingStore((s) => s.setServiceAssessments);
  const setPetHealthStatus = useCustomerBookingStore((s) => s.setPetHealthStatus);
  const setHotelMonth = useCustomerBookingStore((s) => s.setHotelMonth);
  const setHotelUnavailableDates = useCustomerBookingStore((s) => s.setHotelUnavailableDates);
  const setHotelClosedDates = useCustomerBookingStore((s) => s.setHotelClosedDates);
  const setHotelCapacityByDate = useCustomerBookingStore((s) => s.setHotelCapacityByDate);
  const setBookingItems = useCustomerBookingStore((s) => s.setBookingItems);
  const setActiveItemIndex = useCustomerBookingStore((s) => s.setActiveItemIndex);
  const setForm = useCustomerBookingStore((s) => s.setForm);
  const setItem = useCustomerBookingStore((s) => s.setItem);
  const selectedPet = pets.find((pet) => String(pet.id) === String(form.pet_id)) || null;
  const petSpecies = form.pet_id ? getSpeciesCode(selectedPet || {}) : '';
  const setBookingForm = (updater) => {
    const nextForm = typeof updater === 'function' ? updater(form) : updater;
    if (String(nextForm.pet_id || '') !== String(form.pet_id || '')) {
      setBookingItems((previous) => previous.map((item) =>
        String(item.category || item.service?.category || '').toLowerCase() === 'hotel'
          ? { ...item, pet_size: '' }
          : item
      ));
    }
    setForm(nextForm);
  };
  const runServiceClickAction = (callback) => {
    if (serviceClickLockRef.current) return;
    serviceClickLockRef.current = true;
    callback();
    window.setTimeout(() => {
      serviceClickLockRef.current = false;
    }, 180);
  };

  // Init on open
  useEffect(() => {
    if (!isOpen) return;
    setModeOfPayment('');
    setPaymentFromProvider('');
    setPaymentFromOtherName('');
    setBankName('');
    setPaymentAccountId('');
    setPaymentToAccount(null);
    setPaymentOtherName('');
    setReferenceNumber('');
    setDepositProof(null);
    setCreatedAppointment(null);
    setAdditionalPetIds([]);
    setDaycarePetSizes({});
    setAssessmentPet(null);
    setPendingAssessmentDraft(null);
    setPendingAssessmentDrafts({});
    const saved = initialForm && initialForm.bookingItems ? initialForm : null;
    resetBookingState({
      step: saved?.step ?? initialStep ?? 0,
      serviceAssessments: saved?.serviceAssessments ?? {},
      bookingItems: (saved?.bookingItems ?? [{
        ...EMPTY_ITEM,
        ...(preselectedCategory ? { category: preselectedCategory } : {}),
        ...(selectedDate ? { appointment_date: selectedDate } : {}),
      }])
        .slice(0, 2)
        .map((item) => item),
      activeItemIndex: saved?.activeItemIndex ?? 0,
      form: saved?.form ?? { pet_id: '', special_instructions: '' },
    });
    if (!saved && selectedDate) {
      const [year, month] = String(selectedDate).slice(0, 10).split('-').map(Number);
      if (year && month) setHotelMonth(new Date(year, month - 1, 1));
    }
    if (saved?.refreshPetId) {
      fetchPetHealthStatus(saved.refreshPetId);
    }
  }, [isOpen, selectedDate, preselectedCategory]);

  // Suite configuration is reused for this modal instance; occupancy is always
  // checked separately for the selected stay dates.
  const hotelCategorySelected = bookingItems.some((item) => item?.category === 'hotel');
  useEffect(() => {
    if (!isOpen || !hotelCategorySelected) return;
    if (hotelSuitesCacheRef.current) {
      setHotelSuites(hotelSuitesCacheRef.current);
      setHotelSuitesError('');
      setHotelSuitesLoading(false);
      setHotelSuitesSlow(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    let didTimeout = false;
    setHotelSuitesLoading(true);
    setHotelSuitesSlow(false);
    setHotelSuitesError('');

    const slowTimer = window.setTimeout(() => {
      if (active) setHotelSuitesSlow(true);
    }, 4000);
    const timeoutTimer = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 20000);

    apiFetch('/api/public/hotel-suites', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Hotel Suite request failed (${response.status}).`);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const suites = Array.isArray(data) ? data : data?.data;
        if (!Array.isArray(suites)) throw new Error('The Hotel Suite response was invalid.');
        hotelSuitesCacheRef.current = suites;
        setHotelSuites(suites);
      })
      .catch((requestError) => {
        if (!active) return;
        setHotelSuitesError(didTimeout
          ? 'The Hotel Suite request timed out. Please try again.'
          : requestError?.message || 'Unable to load Hotel Suites. Please try again.');
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
        window.clearTimeout(timeoutTimer);
        if (active) {
          setHotelSuitesLoading(false);
          setHotelSuitesSlow(false);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
      controller.abort();
    };
  }, [isOpen, hotelCategorySelected, hotelSuitesRetryKey]);

  useEffect(() => {
    if (!isOpen || servicesLoadedRef.current) return;
    let active = true;
    setServicesLoading(true);
    setServicesError('');
    apiFetch('/api/services/catalog')
      .then((r) => {
        if (!r.ok) throw new Error(`Service catalog request failed (${r.status})`);
        return r.json();
      })
      .then((d) => {
        const catalog = Array.isArray(d.data) ? d.data.map(normalizeService) : [];
        if (catalog.length === 0) throw new Error('No active services were returned.');
        if (active) {
          servicesLoadedRef.current = true;
          setServices(catalog);
        }
      })
      .catch((catalogError) => {
        if (!active) return;
        setServices([]);
        setServicesError(catalogError?.message || 'Unable to load available services.');
      })
      .finally(() => {
        if (active) setServicesLoading(false);
      });
    return () => { active = false; };
  }, [isOpen, catalogRetryKey]);

  // Pawsome Extras uses the addon records as its selectable 1-3 service items.
  // Regular grooming, daycare, and hotel bookings do not offer add-ons.
  useEffect(() => {
    const item = bookingItems[activeItemIndex];
    if (!isPawsomeExtrasService(item?.service)) {
      if ((item?.addons || []).length > 0 || (item?.availableAddons || []).length > 0) {
        setBookingItems((prev) => prev.map((entry, index) => index === activeItemIndex
          ? { ...entry, addons: [], availableAddons: [], addonsDecided: true }
          : entry));
      }
      return;
    }
    apiGet(`/api/booking/addons?category=${encodeURIComponent(item.category)}`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then(async (d) => {
        let fetched = normalizeGroomingAddonsFromServicePage(getArr(d));
        if (item.category === 'grooming' && fetched.length === 0) {
          const fallbackRes = await apiGet('/api/service-addons');
          const fallbackData = fallbackRes.ok ? await fallbackRes.json() : { data: [] };
          fetched = normalizeGroomingAddonsFromServicePage(getArr(fallbackData));
        }
        setBookingItems((prev) => prev.map((it, i) =>
          i === activeItemIndex ? { ...it, availableAddons: fetched } : it
        ));
      })
      .catch(() => {});
  }, [activeItemIndex, bookingItems[activeItemIndex]?.service?.id]);

  // Auto-advance from service step (step 1) to date step (step 2) when service selection is complete
  useEffect(() => {
    if (step !== 1) return;
    const item = bookingItems[activeItemIndex];
    if (!item) return;
    // Daycare uses an explicit Continue action because every selected dog's
    // assessment and size must be validated together before scheduling.
    if (String(item.category || '').toLowerCase() === 'daycare') return;
    const isComplete = item.category === 'hotel'
      ? !!item.hotel_suite_id
      : isPawsomeExtrasService(item.service)
        ? !!item.service?.id && (item.addons?.length || 0) >= 1 && (item.addons?.length || 0) <= 3
        : !!item.service?.id && (!!item.size_label || shouldSkipGroomingSizeForCat(item, petSpecies));
    if (isComplete) {
      setStep(2);
    }
  }, [step, bookingItems, activeItemIndex, petSpecies]);

  const slotQueryKey = useMemo(
    () => bookingItems
      .map((item) => `${item?.category || ''}|${item?.appointment_date || ''}|${item?.service?.id || ''}|${item?.daycare_duration || ''}`)
      .join('||') + `|pets:${additionalPetIds.length}`,
    [bookingItems, additionalPetIds.length],
  );

  // Fetch time slots per booking item (prevents cross-row slot leakage)
  useEffect(() => {
    bookingItems.forEach((item, idx) => {
      if (!item?.appointment_date || !item?.service?.id) {
        setSlotStateByIndex((prev) => ({
          ...prev,
          [idx]: { slots: [], loading: false, fullyBooked: false, shopClosed: false, operatingHours: null },
        }));
        return;
      }

      const requestId = (slotsRequestRef.current[idx] || 0) + 1;
      slotsRequestRef.current[idx] = requestId;

      setSlotStateByIndex((prev) => ({
        ...prev,
        [idx]: {
          ...(prev[idx] || {}),
          slots: [],
          loading: true,
          fullyBooked: false,
          shopClosed: false,
          ...(item.category === 'hotel' ? { operatingHours: null } : {}),
        },
      }));

      const petsCount = item.category === 'daycare' ? 1 + additionalPetIds.length : 1;
      apiGet(`/api/appointments/available-slots?date=${item.appointment_date}&service_id=${item.service.id}&pets_count=${petsCount}${item.category === 'daycare' && item.daycare_duration ? `&duration_tier=${item.daycare_duration}` : ''}`)
        .then((r) => r.ok ? r.json() : { data: { slots: [], fully_booked: false, reason: null } })
        .then((d) => {
          if (requestId !== slotsRequestRef.current[idx]) return;
          const reason = String(d?.data?.reason || '').toLowerCase();
          const isClosed = reason === 'closed' || reason === 'blocked';
          const isOccupied = reason === 'occupied';
          const availableSlots = Array.isArray(d?.data?.slots) ? d.data.slots : [];
          const operatingHours = d?.data?.operating_hours || null;
          setSlotStateByIndex((prev) => ({
            ...prev,
            [idx]: {
              slots: availableSlots,
              loading: false,
              fullyBooked: d?.data?.fully_booked || isOccupied || false,
              shopClosed: isClosed,
              operatingHours: item.category === 'hotel' ? operatingHours : null,
            },
          }));
        })
        .catch(() => {
          if (requestId !== slotsRequestRef.current[idx]) return;
          setSlotStateByIndex((prev) => ({
            ...prev,
            [idx]: { slots: [], loading: false, fullyBooked: false, shopClosed: false, operatingHours: null },
          }));
        });
    });
  }, [slotQueryKey, additionalPetIds.length]);

  // Hotel calendar
  const hotelCalendarItem = bookingItems[activeItemIndex];
  const hotelCalendarCategory = hotelCalendarItem?.category;
  const hotelCalendarServiceId = hotelCalendarItem?.service?.id;
  const hotelCalendarSuiteId = hotelCalendarItem?.hotel_suite_id;
  const hotelCalendarMonthKey = `${hotelMonth.getFullYear()}-${String(hotelMonth.getMonth() + 1).padStart(2, '0')}`;
  const hotelCalendarRequestKey = [
    hotelCalendarCategory,
    hotelCalendarServiceId,
    hotelCalendarSuiteId,
    form.pet_id,
    hotelCalendarMonthKey,
    hotelCalendarRetryKey,
  ].join('|');
  const hotelCalendarHasLoaded = Boolean(hotelCalendarLoadedKey);
  const hotelCalendarAvailabilityVerified = hotelCalendarLoadedKey === hotelCalendarRequestKey;
  useEffect(() => {
    if (!isOpen || hotelCalendarCategory !== 'hotel' || !hotelCalendarServiceId || !hotelCalendarSuiteId) {
      setHotelCalendarLoading(false);
      setHotelCalendarSlow(false);
      setHotelCalendarError('');
      return;
    }
    const controller = new AbortController();
    let active = true;
    let didTimeout = false;
    setHotelCalendarLoading(true);
    setHotelCalendarSlow(false);
    setHotelCalendarError('');
    const slowTimer = window.setTimeout(() => {
      if (active) setHotelCalendarSlow(true);
    }, 4000);
    const timeoutTimer = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 20000);
    apiGet(`/api/appointments/hotel-calendar?service_id=${hotelCalendarServiceId}&month=${hotelCalendarMonthKey}&suite_id=${hotelCalendarSuiteId}&pet_id=${form.pet_id}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Hotel availability request failed (${r.status}).`);
        return r.json();
      })
      .then((d) => {
        if (!active) return;
        setHotelCalendarLoadedKey(hotelCalendarRequestKey);
        const rows = Array.isArray(d?.data?.dates) ? d.data.dates : [];
        setHotelClosedDates(new Set(rows.filter((r) => r.status === 'closed').map((r) => r.date)));
        setHotelUnavailableDates(new Set(rows.filter((r) => ['full', 'unavailable', 'taken'].includes(r.status)).map((r) => r.date)));
        setHotelCapacityByDate(Object.fromEntries(rows.filter((r) => r.capacity !== undefined).map((r) => [r.date, r])));
      })
      .catch((availabilityError) => {
        if (active) setHotelCalendarError(didTimeout
          ? 'Hotel availability request timed out. Please try again.'
          : availabilityError?.message || 'Unable to check hotel availability.');
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
        window.clearTimeout(timeoutTimer);
        if (active) setHotelCalendarLoading(false);
        if (active) setHotelCalendarSlow(false);
      });
    return () => {
      active = false;
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
      controller.abort();
    };
  }, [
    isOpen,
    hotelCalendarCategory,
    hotelCalendarServiceId,
    hotelCalendarSuiteId,
    form.pet_id,
    hotelCalendarMonthKey,
    hotelCalendarRetryKey,
    hotelCalendarRequestKey,
  ]);

  const activeItem  = bookingItems[activeItemIndex] || {};
  const pawsomeExtrasService = services.find((service) => (
    String(service?.category || '').toLowerCase() === 'grooming' && isPawsomeExtrasService(service)
  )) || null;
  const selectedCategories = useMemo(
    () => bookingItems.map((item) => String(item?.category || item?.service?.category || '').toLowerCase()).filter(Boolean),
    [bookingItems],
  );
  const hasHotelCategory = bookingItems.some((item) => String(item?.category || item?.service?.category || '').toLowerCase() === 'hotel' || Boolean(item?.hotel_suite_id));
  const hasDaycareCategory = selectedCategories.includes('daycare');
  const hasGroomingCategory = selectedCategories.includes('grooming');
  const isDaycareOnlyBooking = selectedCategories.length > 0 && selectedCategories.every((cat) => cat === 'daycare');
  const selectedDaycarePetIds = useMemo(
    () => form.pet_id ? [form.pet_id, ...additionalPetIds].map(String) : [],
    [form.pet_id, additionalPetIds],
  );
  const selectedDaycarePetIdsKey = selectedDaycarePetIds.join('|');
  const daycareSelectedPets = useMemo(
    () => selectedDaycarePetIds
      .map((petId) => pets.find((pet) => String(pet.id) === String(petId)))
      .filter(Boolean),
    [pets, selectedDaycarePetIds],
  );
  const daycareAssessmentsReady = !hasDaycareCategory || daycareSelectedPets.every((pet) => {
    const flags = petAssessmentFlags[pet.id] || {};
    return petHealthStatus[pet.id] === true
      && !flags.has_ticks
      && !flags.has_flea
      && !flags.missing_rabies;
  });
  const hasNonHotelCategory = selectedCategories.some((cat) => cat !== 'hotel');
  const hasDaycareAndGrooming = hasDaycareCategory && hasGroomingCategory;
  const hasHotel = hasHotelCategory;
  const STEPS = hasHotel ? STEPS_WITH_RESERVATION : STEPS_WITHOUT_PAYMENT;
  const isSummaryStep = step === STEPS.length - 1;
  const selectedPetHealthStatus = selectedPet ? petHealthStatus[selectedPet.id] : undefined;
  const selectedPetFlags = selectedPet ? (petAssessmentFlags[selectedPet.id] || null) : null;
  const selectedPetHasTicksOrFlea = !!(selectedPetFlags?.has_ticks || selectedPetFlags?.has_flea);
  const selectedPetMissingRabies = !!selectedPetFlags?.missing_rabies;
  const selectedPetWeightRaw = String(
    pendingAssessmentDraft?.pet_id === form.pet_id
      ? (pendingAssessmentDraft?.weight_kg ?? '')
      : (selectedPet?.weight_kg ?? selectedPet?.weight ?? '')
  ).trim();
  const selectedPetHasValidWeight = !!selectedPetWeightRaw && !Number.isNaN(Number(selectedPetWeightRaw)) && Number(selectedPetWeightRaw) > 0;
  const bookingRequiresRabies = selectedCategories.some((cat) => cat === 'daycare' || cat === 'hotel');
  const selectedReservationProvider = paymentFromProvider === 'Other' ? paymentFromOtherName.trim() : paymentFromProvider;
  const hotelReservationComplete = !hasHotel || (
    !!modeOfPayment &&
    !!selectedReservationProvider &&
    !!paymentAccountId &&
    ((!!referenceNumber && /^[A-Za-z0-9]{1,30}$/.test(referenceNumber)) || !!depositProof)
  );
  const serviceIdsKey = useMemo(
    () => bookingItems.map((item) => item?.service?.id).filter(Boolean).join(','),
    [bookingItems],
  );
  const fetchPetHealthStatus = (petId) => {
    if (!petId) return;
    setPetHealthStatus((prev) => ({ ...prev, [petId]: undefined }));
    apiGet(`/api/my-pets/${petId}/health-form/status`)
      .then((r) => r.ok ? r.json() : { data: null })
      .then((d) => {
        const status = d?.data || {};
        const complete = !!status.complete_today;
        setPetAssessmentFlags((prev) => ({
          ...prev,
          [petId]: {
            has_ticks: !!status.has_ticks,
            has_flea: !!status.has_flea,
            has_rabies: !!status.has_rabies,
            missing_rabies: !!status.missing_rabies,
          },
        }));
        setPetHealthStatus((prev) => ({ ...prev, [petId]: complete }));
      })
      .catch(() => {
        setPetAssessmentFlags((prev) => ({ ...prev, [petId]: { has_ticks: false, has_flea: false, missing_rabies: true } }));
        setPetHealthStatus((prev) => ({ ...prev, [petId]: false }));
      });
  };

  useEffect(() => {
    if (!hasDaycareCategory) return;
    selectedDaycarePetIds.forEach((petId) => {
      if (petHealthStatus[petId] === undefined) fetchPetHealthStatus(petId);
    });
  }, [hasDaycareCategory, selectedDaycarePetIdsKey]);

  const assessmentKey = (petId, serviceId) => `${petId || ''}:${serviceId || ''}`;

  const fetchServiceAssessmentStatus = async (petId, serviceId) => {
    if (!petId || !serviceId) return false;
    const key = assessmentKey(petId, serviceId);
    const r = await apiGet(`/api/my-pets/${petId}/health-form?service_id=${encodeURIComponent(serviceId)}`);
    const d = r.ok ? await r.json() : { data: null };
    const f = d?.data;
    const vaccines = Array.isArray(f?.vaccines) ? f.vaccines : [];
    const hasRabies = !!(f?.vaccine_rabies || vaccines.some((name) => String(name || '').toLowerCase().includes('rabies')));
    const serviceCategory = String(bookingItems.find((item) => String(item?.service?.id) === String(serviceId))?.category || '').toLowerCase();
    const needsRabies = serviceCategory === 'daycare' || serviceCategory === 'hotel';
    const complete = !!(f && f.is_vaccinated && (!needsRabies || hasRabies) && f.is_friendly && f.declaration_accepted && isSameManilaDay(f.created_at || f.updated_at));
    setServiceAssessments((prev) => ({ ...prev, [key]: complete }));
    return complete;
  };

  useEffect(() => {
    if (step !== 1 || !form.pet_id) return;
    const serviceIds = serviceIdsKey.split(',').filter(Boolean);
    serviceIds.forEach((serviceId) => {
      const key = assessmentKey(form.pet_id, serviceId);
      if (serviceAssessments[key] === undefined) {
        fetchServiceAssessmentStatus(form.pet_id, serviceId).catch(() => {
          setServiceAssessments((prev) => ({ ...prev, [key]: false }));
        });
      }
    });
  }, [step, form.pet_id, serviceIdsKey]);

  useEffect(() => {
    if (!hasDaycareCategory || !form.pet_id) {
      setAdditionalPetIds((prev) => (prev.length === 0 ? prev : []));
      setDaycarePetSizes((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    setAdditionalPetIds((prev) => {
      const next = prev.filter((petId) => {
        const pet = pets.find((candidate) => String(candidate.id) === String(petId));
        return pet && isDogPet(pet) && String(pet.id) !== String(form.pet_id);
      }).slice(0, 2);
      return next.length === prev.length && next.every((petId, index) => String(petId) === String(prev[index]))
        ? prev
        : next;
    });
    setDaycarePetSizes((prev) => {
      const allowed = new Set(selectedDaycarePetIds);
      const next = Object.fromEntries(Object.entries(prev).filter(([petId]) => allowed.has(String(petId))));
      const previousKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      return previousKeys.length === nextKeys.length && nextKeys.every((key) => next[key] === prev[key])
        ? prev
        : next;
    });
  }, [hasDaycareCategory, form.pet_id, pets, selectedDaycarePetIdsKey]);

  // Daycare has one catalog package, so skip the redundant package picker.
  useEffect(() => {
    if (step !== 1) return;
    const item = bookingItems[activeItemIndex];
    if (!item || String(item.category || '').toLowerCase() !== 'daycare' || item.service) return;
    const daycareServices = services.filter((service) => String(service.category || '').toLowerCase() === 'daycare');
    if (daycareServices.length !== 1) return;
    setItem(activeItemIndex, {
      service: normalizeService(daycareServices[0]),
      size_label: '',
      daycare_duration: '',
      _daycareStep: '',
    });
  }, [step, activeItemIndex, bookingItems, services, setItem]);

  // Auto-pick size if only one visible tier remains.
  useEffect(() => {
    if (step !== 1) return;
    const item = bookingItems[activeItemIndex];
    if (!item?.service || item.category === 'hotel' || item.size_label) return;
    const allTiers = item.service?.tiers || [];
    if (!allTiers.length) return;

    const isDaycare = String(item.category || '').toLowerCase() === 'daycare';
    let visible = [];
    if (isDaycare) {
      const daycareStep = item._daycareStep || '';
      if (!daycareStep) return;
      visible = allTiers.filter((t) => t.size_label?.startsWith(daycareStep));
    } else {
      visible = allTiers.filter((tier) => {
        const s = String(tier.size_label || '').toUpperCase();
        const catSizes = ['CAT', 'KITTEN'];
        if (petSpecies === 'C') return catSizes.includes(s);
        if (petSpecies === 'D') return !catSizes.includes(s);
        return true;
      });
    }

    if (visible.length === 1) {
      setItem(activeItemIndex, { size_label: visible[0].size_label });
    }
  }, [step, activeItemIndex, bookingItems, petSpecies, setItem]);

  const hotelSuitesForPet = hotelSuites.filter((s) => {
    if (!petSpecies) return false;
    if (petSpecies === 'D') return s.species_type === 'dog';
    if (petSpecies === 'C') return s.species_type === 'cat';
    return false;
  });
  const daycareItem = bookingItems.find((item) => String(item?.category || '').toLowerCase() === 'daycare') || null;
  const daycareSelectedPetSizes = useMemo(() => {
    if (!daycareItem || !form.pet_id) return {};
    return selectedDaycarePetIds.reduce((acc, petId) => {
      acc[String(petId)] = daycarePetSizes[String(petId)] || (String(petId) === String(form.pet_id) ? daycareItem.size_label : '');
      return acc;
    }, {});
  }, [daycareItem, daycarePetSizes, form.pet_id, selectedDaycarePetIds]);
  const daycareAllPetSizesSelected = !isDaycareOnlyBooking
    || selectedDaycarePetIds.length === 0
    || selectedDaycarePetIds.every((petId) => Boolean(daycareSelectedPetSizes[String(petId)]));
  const hotelEstimatedTotal = bookingItems.reduce((sum, item) => {
    if (item.category !== 'hotel') return sum;
    const suite = hotelSuites.find((s) => s.id === item.hotel_suite_id);
    const nights = Number(item.hotel_nights || 0);
    return sum + ((Number(suite?.price_per_night || 0) * nights) || 0);
  }, 0);
  const requiredHotelDeposit = hotelEstimatedTotal > 0 ? hotelEstimatedTotal * 0.5 : 0;

  // Validation
  const canNext = () => {
    if (step === 0) {
      // Pet selection + assessment step
      return !!form.pet_id
        && (!hasDaycareCategory || (
          selectedDaycarePetIds.length >= 1
          && selectedDaycarePetIds.length <= DAYCARE_MAX_PETS
          && daycareAssessmentsReady
        ))
        && petHealthStatus[form.pet_id] === true
        && selectedPetHasValidWeight
        && !selectedPetHasTicksOrFlea
        && (!bookingRequiresRabies || !selectedPetMissingRabies);
    }
    if (step === 1) {
      // Service selection step
      return bookingItems.every((item) =>
        item.category === 'hotel'
          ? !!item.hotel_suite_id && !!item.pet_size
          : !!item.service?.id
            && (!!item.size_label || shouldSkipGroomingSizeForCat(item, petSpecies))
            && (!isPawsomeExtrasService(item.service)
              || ((item.addons?.length || 0) >= 1 && (item.addons?.length || 0) <= 3))
      );
    }
    if (step === 2) {
      if (hasHotelCategory && (
        hotelCalendarLoading
        || hotelCalendarError
        || !hotelCalendarAvailabilityVerified
      )) return false;
      return bookingItems.every((item, index) => {
        if (!item.appointment_date) return false;
        if (item.category === 'hotel')   return !!item.hotel_checkout && !!item.hotel_nights && !!item.start_time
          && !hotelCheckInTimeError(item.hotel_checkin_input || item.start_time, slotStateByIndex[index]?.operatingHours, item.appointment_date);
        if (item.category === 'daycare') return !!item.start_time && !!item.size_label && daycareAllPetSizesSelected;
        return !!item.start_time;
      });
    }
    if (step === 3 && hasHotel) return hotelReservationComplete;
    return true;
  };

  const handleNext = () => {
    setError('');
    if (hasHotelCategory && hasNonHotelCategory) {
      setError('Hotel bookings must be placed separately from daycare/grooming services.');
      return;
    }
    if (step === 0 && hasDaycareCategory) {
      if (selectedDaycarePetIds.length < 1 || selectedDaycarePetIds.length > DAYCARE_MAX_PETS) {
        setError(`Please select between 1 and ${DAYCARE_MAX_PETS} dogs for daycare.`);
        return;
      }
      const incompletePet = daycareSelectedPets.find((pet) => petHealthStatus[pet.id] !== true);
      if (incompletePet) {
        setError(`Please complete the assessment form for ${incompletePet.name || 'every selected dog'} before continuing.`);
        return;
      }
      const parasitePet = daycareSelectedPets.find((pet) => {
        const flags = petAssessmentFlags[pet.id] || {};
        return flags.has_ticks || flags.has_flea;
      });
      if (parasitePet) {
        setError(`${parasitePet.name || 'The selected dog'} must be free from ticks and fleas before daycare booking can continue.`);
        return;
      }
      const missingRabiesPet = daycareSelectedPets.find((pet) => petAssessmentFlags[pet.id]?.missing_rabies);
      if (missingRabiesPet) {
        setError(`Vaccination and rabies information is required for ${missingRabiesPet.name || 'every selected dog'} before daycare booking can continue.`);
        return;
      }
    }
    if (step === 0 && form.pet_id && petHealthStatus[form.pet_id] !== true) {
      setError(`Please complete the assessment form for ${selectedPet?.name || 'the selected pet'} before continuing.`);
      return;
    }
    if (step === 0 && selectedPetHasTicksOrFlea) {
      setError(`${PARASITE_BLOCK_TITLE} ${PARASITE_BLOCK_BODY}`);
      return;
    }
    if (step === 0 && bookingRequiresRabies && selectedPetMissingRabies) {
      setError('Vaccination and rabies information is required for daycare and hotel services. Please update the pet assessment form.');
      return;
    }
    if (step === 0 && !selectedPetHasValidWeight) {
      setError('Pet weight is required before you can continue booking.');
      return;
    }
    if (step === 1 && isDaycareOnlyBooking) {
      if (selectedDaycarePetIds.length < 1 || selectedDaycarePetIds.length > DAYCARE_MAX_PETS) {
        setError(`Please select between 1 and ${DAYCARE_MAX_PETS} dogs for daycare.`);
        return;
      }
      if (!bookingItems.every((item) => item.service?.id)) {
        setError('Daycare packages could not be loaded. Please retry loading the service options.');
        return;
      }
      if (!bookingItems.every((item) => item.daycare_duration)) {
        setError('Please select Hourly, Half Day, or Full Day for daycare.');
        return;
      }
      if (!daycareAllPetSizesSelected) {
        const missingSizePet = daycareSelectedPets.find((pet) => !daycareSelectedPetSizes[String(pet.id)]);
        setError(`Please select a daycare size for ${missingSizePet?.name || 'every selected pet'}.`);
        return;
      }
    }
    if (step === 3 && hasHotel && !hotelReservationComplete) {
      setError('Hotel reservations require reservation channel, provider, and a valid reference number.');
      return;
    }
    if (step === 2 && isDaycareOnlyBooking && !daycareAllPetSizesSelected) {
      setError('Please select a daycare size for each selected pet.');
      return;
    }
    setStep((p) => p + 1);
  };

  const handleBack = () => {
    if (backStepLockRef.current) return;
    backStepLockRef.current = true;
    window.setTimeout(() => {
      backStepLockRef.current = false;
    }, 250);
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = useBookingSubmit({
    additionalPetIds,
    bookingItems,
    daycareAllPetSizesSelected,
    daycareSelectedPetSizes,
    selectedDaycarePetIds,
    form,
    hotelReservationComplete,
    isDaycareOnlyBooking,
    modeOfPayment,
    selectedReservationProvider,
    onBooked,
    pendingAssessmentDraft,
    pendingAssessmentDrafts,
    depositProof,
    petSpecies,
    referenceNumber,
    requiredHotelDeposit,
    selectedPet,
    selectedPaymentAccountId: paymentAccountId,
    setBooked,
    setCreatedAppointment,
    setError,
    setPendingAssessmentDraft,
    setPendingAssessmentDrafts,
    setDepositProof,
    setSubmitting,
  });
  const handleModalClose = () => {
    onSaveState?.(null);
    onClose?.();
  };

  if (!isOpen) return null;

  const daycarePricingRows = daycareItem
    ? daycareSelectedPets.map((pet) => {
        const sizeLabel = daycareSelectedPetSizes[String(pet.id)] || '';
        const tiers = daycareItem.service?.tiers || daycareItem.service?.service_tiers || [];
        const tier = tiers.find((entry) => entry.size_label === sizeLabel);
        return { pet, sizeLabel, price: Number(tier?.price || 0) };
      })
    : [];
  const estimatedTotal = computeEstimatedTotal(bookingItems, hotelSuites);
  const singleDaycarePrice = daycareItem
    ? Number((daycareItem.service?.tiers || daycareItem.service?.service_tiers || [])
        .find((entry) => entry.size_label === daycareItem.size_label)?.price || 0)
    : 0;
  const daycarePetsTotal = daycarePricingRows.reduce((sum, row) => sum + row.price, 0);
  const finalEstimatedTotal = estimatedTotal - singleDaycarePrice + daycarePetsTotal;
  const estimatedCheckInBalance = requiredHotelDeposit > 0
    ? Math.max(finalEstimatedTotal - requiredHotelDeposit, 0)
    : 0;
  const createdBookedPackages = createdAppointment?.booked_packages || createdAppointment?.bookedPackages || [];

  const bookingContext = {
    BANK_OPTIONS: GENERAL_BANK_OPTIONS,
    BookingModalPetStep,
    BookingModalScheduleStep,
    BookingModalServiceStep,
    BookingModalSidebar,
    BookingModalSummary,
    BookingStepIndicator,
    ClientBookingValidationBox,
    DAYCARE_MAX_PETS,
    EMPTY_ITEM,
    EWALLET_OPTIONS: GENERAL_EWALLET_OPTIONS,
    MAX_BOOKING_DATE,
    MAX_BOOKING_MONTH_INDEX,
    PARASITE_BLOCK_BODY,
    PARASITE_BLOCK_TITLE,
    PAYMENT_TYPE_OPTIONS,
    PetAssessmentFormModal,
    STEPS,
    STEPS_WITHOUT_PAYMENT,
    STEPS_WITH_RESERVATION,
    SelectDropdown,
    TODAY,
    activeItem,
    activeItemIndex,
    additionalPetIds,
    addonDisplayName,
    addonDisplayTier,
    addonPriceLabel,
    apiFetch,
    apiGet,
    assessmentKey,
    assessmentPet,
    backStepLockRef,
    bankName,
    paymentAccountId,
    booked,
    bookingItems,
    bookingRequiresRabies,
    buildHotelReservationNote,
    canNext,
    catalogRetryKey,
    computeEstimatedTotal,
    createPortal,
    createdAppointment,
    createdBookedPackages,
    daycareAllPetSizesSelected,
    daycareAssessmentsReady,
    daycareItem,
    daycarePetSizes,
    daycarePetsTotal,
    daycarePricingRows,
    daycareSelectedPetSizes,
    daycareSelectedPets,
    daycareSizeLabel,
    db,
    diffDays,
    error,
    estimatedCheckInBalance,
    estimatedTotal,
    fetchPetHealthStatus,
    fetchServiceAssessmentStatus,
    finalEstimatedTotal,
    fmtTime,
    form,
    formatHotelDateTime,
    formatHotelDescription,
    getArr,
    getAutoCatSizeLabel,
    getDaycareSizeOptions,
    getDaycareTierPrice,
    getServiceName,
    getSpeciesCode,
    handleBack,
    handleModalClose,
    handleNext,
    handleSubmit,
    hasDaycareAndGrooming,
    hasDaycareCategory,
    hasGroomingCategory,
    hasHotel,
    hasHotelCategory,
    hasNonHotelCategory,
    hotelCalendarLoading,
    hotelCalendarSlow,
    hotelCalendarHasLoaded,
    hotelCalendarAvailabilityVerified,
    hotelCalendarError,
    setHotelCalendarRetryKey,
    setHotelSuitesRetryKey,
    hotelClosedDates,
    hotelCapacityByDate,
    hotelEstimatedTotal,
    hotelMonth,
    hotelReservationComplete,
    hotelSuites,
    hotelSuitesLoading,
    hotelSuitesSlow,
    hotelSuitesError,
    hotelSuitesForPet,
    hotelUnavailableDates,
    isDaycareOnlyBooking,
    isDogPet,
    isPawsomeExtrasService,
    isSameManilaDay,
    isSummaryStep,
    modeOfPayment,
    paymentFromOtherName,
    paymentFromProvider,
    paymentToAccount,
    setPaymentFromOtherName,
    setPaymentFromProvider,
    setPaymentToAccount,
    normalizeBreedName,
    normalizeGroomingAddonsFromServicePage,
    normalizeService,
    pawsomeExtrasService,
    pendingAssessmentDraft,
    pendingAssessmentDrafts,
    petAssessmentFlags,
    petBg,
    petBorder,
    petHealthStatus,
    petLight,
    petSpecies,
    petText,
    pets,
    petsLoading,
    powersyncConnected,
    powersyncStatus,
    rangeHasBlockedNights,
    referenceNumber,
    requiredHotelDeposit,
    depositProof,
    reservationOtherName,
    resetBookingState,
    runServiceClickAction,
    sanitizeReferenceNumber,
    sanitizeText,
    selectedCategories,
    selectedDaycarePetIds,
    selectedPet,
    selectedPetFlags,
    selectedPetHasTicksOrFlea,
    selectedPetHasValidWeight,
    selectedPetHealthStatus,
    selectedPetMissingRabies,
    selectedPetWeightRaw,
    selectedReservationProvider,
    serviceAssessments,
    serviceClickLockRef,
    serviceIdsKey,
    services,
    servicesError,
    servicesLoading,
    setActiveItemIndex,
    setAdditionalPetIds,
    setAssessmentPet,
    setBankName,
    setPaymentAccountId,
    setBooked,
    setBookingItems,
    setCatalogRetryKey,
    setCreatedAppointment,
    setDaycarePetSizes,
    setError,
    setForm: setBookingForm,
    setHotelCalendarLoading,
    setHotelClosedDates,
    setHotelCapacityByDate,
    setHotelMonth,
    setHotelSuites,
    setHotelUnavailableDates,
    setItem,
    setModeOfPayment,
    setPaymentOtherName,
    setPendingAssessmentDraft,
    setPendingAssessmentDrafts,
    setPetAssessmentFlags,
    setPetHealthStatus,
    setReferenceNumber,
    setDepositProof,
    setServiceAssessments,
    setServices,
    setServicesError,
    setServicesLoading,
    setSlotStateByIndex,
    setStep,
    setSubmitting,
    shouldSkipGroomingSizeForCat,
    singleDaycarePrice,
    sizeWeightHint,
    slotQueryKey,
    slotStateByIndex,
    slotsRequestRef,
    step,
    submitting,
    toIso,
  };

  return <BookingModalView context={bookingContext} />;
}
