export const toManilaIsoDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts
    .filter(({ type }) => ['year', 'month', 'day'].includes(type))
    .map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const TODAY = toManilaIsoDate();
export const CLINIC_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export const getManilaDateTime = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts
    .filter(({ type }) => ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(type))
    .map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
};

export const getArr = (data, key) => {
  if (key && Array.isArray(data?.[key])) return data[key];
  if (key && Array.isArray(data?.data?.[key])) return data.data[key];
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const normalizeCategoryOption = (item) => {
  if (item == null) return null;
  if (typeof item === 'string' || typeof item === 'number') {
    const value = String(item).trim().toLowerCase();
    if (!value) return null;
    return { value, label: value.charAt(0).toUpperCase() + value.slice(1) };
  }
  if (typeof item === 'object') {
    const rawValue = item.slug || item.value || item.category || item.code || item.key || item.name;
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value) return null;
    const rawLabel = item.label || item.name || item.title || value;
    const label = String(rawLabel).trim() || value;
    return { value, label };
  }
  return null;
};

export const getOwnerName = (owner) =>
  `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || owner?.name || '';

export const getOwnerAddress = (owner) => {
  const directAddress =
    owner?.address ||
    owner?.full_address ||
    owner?.street_address ||
    owner?.complete_address ||
    '';
  if (String(directAddress).trim()) return String(directAddress).trim();

  const parts = [
    owner?.house_no || owner?.house_number,
    owner?.street,
    owner?.barangay,
    owner?.city,
    owner?.province,
  ].filter((part) => String(part || '').trim());
  return parts.length ? parts.join(', ') : '';
};

export const isAssessmentFresh = (isoLike) => {
  if (!isoLike) return false;
  const date = new Date(String(isoLike));
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
};

export const parseAssessmentComplete = (form) =>
  !!(form && form.is_vaccinated && form.is_friendly && form.declaration_accepted && isAssessmentFresh(form.created_at || form.updated_at));

export const isSameManilaDay = isAssessmentFresh;

export const fmt12 = (value) => {
  const [h, m] = String(value || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const hour = h % 12 || 12;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

export const getServiceTiers = (service) => {
  if (Array.isArray(service?.service_tiers)) return service.service_tiers;
  if (Array.isArray(service?.tiers)) return service.tiers;
  return [];
};

export const isGroomingService = (entryOrService) =>
  String(entryOrService?.category || entryOrService?.selectedService?.category || '').toLowerCase() === 'grooming';

export const getAutoCatSizeLabel = (service) => {
  const tiers = getServiceTiers(service);
  if (tiers.length === 0) return '';
  const catTier = tiers.find((tier) => ['CAT', 'KITTEN'].includes(String(tier?.size_label || '').toUpperCase()));
  return catTier?.size_label || tiers[0]?.size_label || '';
};

export const shouldSkipGroomingSizeForCat = (entryOrService, petSpecies) =>
  petSpecies === 'C' && isGroomingService(entryOrService);

export const getVisibleServiceTiers = (service, petSpecies) => {
  const tiers = getServiceTiers(service);
  if (tiers.length === 0) return [];

  const filtered = tiers.filter((tier) => {
    const size = String(tier?.size_label || '').toUpperCase();
    const isCatTier = size.includes('CAT') || size.includes('KITTEN');
    if (petSpecies === 'C') return isCatTier;
    if (petSpecies === 'D') return !isCatTier;
    return true;
  });

  return filtered.length > 0 ? filtered : tiers;
};

let entrySeq = 0;
export const freshEntry = () => ({
  key: ++entrySeq,
  category: '',
  grooming_booking_type: '',
  service_id: '',
  selectedService: null,
  promotion_id: '',
  appointment_date: '',
  start_time: '',
  availableSlots: [],
  slotStatuses: [],
  walkInStartTime: '',
  walkInStatus: '',
  loadingSlots: false,
  loadingServices: false,
  serviceLoadError: '',
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
