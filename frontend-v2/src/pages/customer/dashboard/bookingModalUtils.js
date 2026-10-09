import { TODAY, getSpeciesCode } from './bookingUtils';
import { toIso } from '../../../utils/dateUtils';
import { CLINIC_EWALLET_OPTIONS, CLINIC_BANK_OPTIONS } from '../../../constants/paymentProviders';

export { CLINIC_EWALLET_OPTIONS as EWALLET_OPTIONS, CLINIC_BANK_OPTIONS as BANK_OPTIONS };

export const STEPS_WITHOUT_PAYMENT = ['Pet', 'Service', 'Date & Time', 'Summary'];
export const STEPS_WITH_RESERVATION = ['Pet', 'Service', 'Date & Time', 'Reservation', 'Summary'];
export const PARASITE_BLOCK_TITLE = 'A Little "Paws" for Your Pet\'s Well-being';
export const PARASITE_BLOCK_BODY = 'Our priority is a safe, parasite-free environment for everyone. Because we spotted some ticks/fleas, we can\'t proceed with the booking just yet. We\'re rooting for a speedy treatment so we can see those tail wags again!';
export const MAX_BOOKING_DATE = (() => {
  const [year, month, day] = TODAY.split('-').map(Number);
  const lastDayOfNextMonth = new Date(year, month + 1, 0).getDate();
  const date = new Date(year, month, Math.min(day, lastDayOfNextMonth));
  return toIso(date);
})();
export const MAX_BOOKING_MONTH_INDEX = (() => {
  const [year, month] = MAX_BOOKING_DATE.split('-').map(Number);
  return (year * 12) + month - 1;
})();
export const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'Select reservation channel' },
  { value: 'e_wallet', label: 'E-Wallet' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export const petIsCat = (pet) => String(pet?.species_type?.name || pet?.speciesType?.name || '').toLowerCase().includes('cat');
export const petBg = (pet) => petIsCat(pet) ? 'bg-brand-orange' : 'bg-brand-teal';
export const petLight = (pet) => petIsCat(pet) ? 'bg-orange-50' : 'bg-brand-teal-light';
export const petBorder = (pet) => petIsCat(pet) ? 'border-brand-orange' : 'border-brand-teal';
export const petText = (pet) => petIsCat(pet) ? 'text-brand-orange' : 'text-brand-teal';
export const sizeWeightHint = (sizeLabel = '') => {
  const size = String(sizeLabel).toUpperCase();
  if (size === 'S' || size.endsWith(' - SMALL')) return 'Up to 5kg';
  if (size.endsWith(' - SMALL TO MEDIUM')) return 'Up to 10kg';
  if (size === 'M' || size.endsWith(' - MEDIUM')) return '6-10kg';
  if (size === 'L' || size.endsWith(' - LARGE')) return '11-15kg';
  if (size === 'XL' || size.endsWith(' - XLARGE') || size.endsWith(' - X-LARGE')) return '15-20kg';
  if (size === 'XXL' || size.endsWith(' - XXL') || size.endsWith(' - XXLARGE') || size.endsWith(' - XX-LARGE')) return '20kg up';
  return '';
};
export const sanitizeReferenceNumber = (value = '') => String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
export const buildHotelReservationNote = (mode, provider) => {
  if (!mode || !provider) return null;
  return `Hotel reservation channel: ${mode === 'e_wallet' ? 'E-Wallet' : 'Bank Transfer'} - ${provider}`;
};
const ADDON_SIZE_SUFFIX = /\s*[-]\s*(S|M|L|XL|XXL)$/i;
export const addonBaseName = (name = '') => String(name || '').replace(ADDON_SIZE_SUFFIX, '').trim();
export const addonSizeName = (name = '') => String(name || '').match(ADDON_SIZE_SUFFIX)?.[1]?.toUpperCase() || '';
export const addonDisplayName = (addon) => addon?.addon_group ? addon.name : addonBaseName(addon?.name || '');
export const addonDisplayTier = (addon) => addon?.tier_label || addonSizeName(addon?.name || '');
export const addonPriceLabel = (addon) => addon?.price_max
  ? `PHP ${Number(addon.price_min).toLocaleString('en-PH')} - PHP ${Number(addon.price_max).toLocaleString('en-PH')}`
  : `PHP ${Number(addon?.price_min || 0).toLocaleString('en-PH')}`;
export const formatHotelDateTime = (date, time) => {
  if (!date) return '-';
  const value = new Date(`${String(date).slice(0, 10)}T${String(time || '09:00:00')}`);
  if (Number.isNaN(value.getTime())) return String(date);
  return value.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
export const getArr = (data, key) => {
  if (key && Array.isArray(data?.[key])) return data[key];
  if (key && Array.isArray(data?.data?.[key])) return data.data[key];
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};
export const truthyFlag = (value) => value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true';
export const isPawsomeExtrasService = (service) => String(service?.name || '').trim().toLowerCase() === 'pawsome extras';
export const normalizeGroomingAddonsFromServicePage = (rows = []) => rows
  .filter((addon) => {
    const category = String(addon?.category || '').toLowerCase();
    const active = addon?.is_active !== false && addon?.is_active !== 0 && addon?.is_active !== '0';
    const applies = truthyFlag(addon?.applies_to_grooming);
    const hasScope = Boolean(category || addon?.applies_to_grooming != null || addon?.applies_to_daycare != null || addon?.applies_to_hotel != null);
    const legacy = category === 'grooming_extra' || category === 'grooming_addon' || category === 'treatment';
    return active && (!hasScope || applies || legacy);
  })
  .map((addon) => ({ ...addon, category: addon.category || 'grooming_extra', price_min: addon.price_min ?? addon.price ?? 0, price_max: addon.price_max ?? null }));
export const isDogPet = (pet) => getSpeciesCode(pet) === 'D';
export const daycareSizeLabel = (sizeLabel = '') => String(sizeLabel).replace(/^(Hourly|Half Day|Full Day)\s*[-]\s*/i, '').trim();
export const getDaycareSizeOptions = (item) => {
  const tiers = item?.service?.tiers || item?.service?.service_tiers || [];
  const durationLabel = item?.daycare_duration === 'hourly' ? 'Hourly' : item?.daycare_duration === 'half_day' ? 'Half Day' : item?.daycare_duration === 'full_day' ? 'Full Day' : '';
  return tiers.filter((tier) => !durationLabel || String(tier?.size_label || '').startsWith(durationLabel)).map((tier) => ({
    value: tier.size_label,
    label: `${daycareSizeLabel(tier.size_label)} - PHP ${Number(tier.price || 0).toLocaleString('en-PH')}`,
  }));
};
