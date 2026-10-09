import { addDays } from '../../../utils/dateUtils';

import { getPetSpeciesCode } from '../../../utils/daycareBooking';

const toLocalIsoDate = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

export const TODAY = toLocalIsoDate();

export const EMPTY_ITEM = {
  category: '',
  service: null,
  size_label: '',
  pet_size: '',
  hotel_suite_id: '',
  addons: [],
  addonsDecided: false,
  appointment_date: '',
  start_time: '',
  hotel_nights: '',
  hotel_checkout: '',
  daycare_duration: '',
  availableAddons: [],
};

export const getSpeciesCode = getPetSpeciesCode;

export const getServiceName = (service) => {
  if (!service) return '-';
  if (typeof service === 'string') return service;
  if (typeof service.name === 'string') return service.name;
  if (service.name && typeof service.name === 'object') {
    const pick = service.name.en || service.name.label || service.name.title || Object.values(service.name).find((v) => typeof v === 'string');
    if (pick) return pick;
  }
  if (typeof service.service_name === 'string') return service.service_name;
  if (typeof service.title === 'string') return service.title;
  return '-';
};

export const normalizeService = (service) => {
  if (!service || typeof service !== 'object') return service;
  const tiers = service.tiers ?? service.service_tiers ?? [];
  const category = String(service.category || '').trim().toLowerCase();
  return { ...service, name: getServiceName(service), category, tiers };
};

export const isGroomingService = (itemOrService) =>
  String(itemOrService?.category || itemOrService?.service?.category || '').toLowerCase() === 'grooming';

export const getServiceTiers = (service) => {
  if (Array.isArray(service?.tiers)) return service.tiers;
  if (Array.isArray(service?.service_tiers)) return service.service_tiers;
  return [];
};

export const getAutoCatSizeLabel = (service) => {
  const tiers = getServiceTiers(service);
  if (tiers.length === 0) return '';
  const catTier = tiers.find((tier) => ['CAT', 'KITTEN'].includes(String(tier?.size_label || '').toUpperCase()));
  return catTier?.size_label || tiers[0]?.size_label || '';
};

export const shouldSkipGroomingSizeForCat = (itemOrService, petSpecies) =>
  petSpecies === 'C' && isGroomingService(itemOrService);

export const isAssessmentFresh = (isoLike) => {
  if (!isoLike) return false;
  const parsed = new Date(String(isoLike));
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= 24 * 60 * 60 * 1000;
};

export const isSameManilaDay = isAssessmentFresh;

export const getTierPrice = (item) => {
  const tiers = Array.isArray(item?.service?.tiers)
    ? item.service.tiers
    : Array.isArray(item?.service?.service_tiers)
      ? item.service.service_tiers
      : [];
  const matchedTier = tiers.find((tier) => tier.size_label === item?.size_label);
  return Number(matchedTier?.price || 0);
};

export const getDaycareTierPrice = (item, sizeLabel) => {
  const tiers = Array.isArray(item?.service?.tiers)
    ? item.service.tiers
    : Array.isArray(item?.service?.service_tiers)
      ? item.service.service_tiers
      : [];
  const matchedTier = tiers.find((tier) => tier.size_label === sizeLabel);
  return Number(matchedTier?.price || 0);
};

export const applyServicePromotion = (service, basePrice, date = TODAY) => {
  return basePrice;
};

export const hasDaycareSameDate = (items, date) =>
  items.some((it) => it?.category === 'daycare' && it?.appointment_date === date);

export const computeEstimatedTotal = (bookingItems, hotelSuites, daycarePetSizes = {}, selectedDaycarePetIds = []) =>
  bookingItems.reduce((sum, item) => {
    if (!item?.service) return sum;
    let itemTotal = 0;
    if (item.category === 'hotel') {
      const suite = hotelSuites.find((s) => s.id === item.hotel_suite_id);
      const nights = parseInt(item.hotel_nights) || 0;
      itemTotal = (Number(suite?.price_per_night) || 0) * nights;
    } else if (item.category === 'daycare' && selectedDaycarePetIds.length > 0) {
      itemTotal = selectedDaycarePetIds.reduce((petTotal, petId) => (
        petTotal + getDaycareTierPrice(item, daycarePetSizes[String(petId)] || item.size_label)
      ), 0);
    } else {
      itemTotal = getTierPrice(item);
    }

    const tier = (item.service?.tiers || item.service?.service_tiers || []).find((row) => row.size_label === item.size_label);
    itemTotal = applyServicePromotion({ tiers: tier ? [tier] : [] }, itemTotal, item.appointment_date || TODAY);

    if (item.category === 'grooming' && item.addons?.length > 0 && item.availableAddons) {
      const addonTotal = item.availableAddons
        .filter((addon) => item.addons.includes(addon.id))
        .reduce((addonSum, addon) => addonSum + Number(addon.price_min || 0), 0);
      itemTotal += addonTotal;
    }

    return sum + itemTotal;
  }, 0);

export const rangeHasBlockedNights = (checkIn, checkOut, hotelUnavailableDates, hotelClosedDates) => {
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    if (hotelUnavailableDates.has(d) || hotelClosedDates.has(d) || d < TODAY) return true;
  }
  return false;
};


// ── Daycare booking rule helpers ──

export const DAYCARE_TIER_MAP = {
  'Hourly': 'hourly',
  'Half Day': 'half_day',
  'Full Day': 'full_day',
};

export const isDogOnly = (pet) => getSpeciesCode(pet) === 'D';
export const isCat = (pet) => getSpeciesCode(pet) === 'C';
