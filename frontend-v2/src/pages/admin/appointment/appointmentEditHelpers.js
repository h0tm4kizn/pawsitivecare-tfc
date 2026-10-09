import { addDays, normalizeDate } from './appointmentUtils';

export const LATE_CHECKIN_REASON_OPTIONS = [
  { value: '', label: 'Select reason' },
  { value: 'traffic_delay', label: 'Traffic Delay' },
  { value: 'owner_schedule_conflict', label: 'Owner Schedule Conflict' },
  { value: 'emergency_situation', label: 'Emergency Situation' },
  { value: 'late_arrival_notice_given', label: 'Late Arrival Notice Given' },
  { value: 'other', label: 'Other' },
];

export const LATE_CHECKOUT_REASON_OPTIONS = [
  { value: '', label: 'Select reason' },
  { value: 'customer_pickup_delay', label: 'Customer Pickup Delay' },
  { value: 'extended_pet_observation', label: 'Extended Pet Observation' },
  { value: 'staff_release_coordination', label: 'Staff Release Coordination' },
  { value: 'emergency_situation', label: 'Emergency Situation' },
  { value: 'other', label: 'Other' },
];

export const fmtShortDate = (value) => {
  const iso = normalizeDate(value);
  if (!iso) return '-';
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const isGroomingCategory = (category = '') => String(category).toLowerCase().includes('groom');
export const isDaycareCategory = (category = '') => String(category).toLowerCase().includes('day');
export const MAX_PAWSOME_EXTRAS = 3;
export const ADDON_SIZE_SUFFIX = /\s*-\s*(S|M|L|XL|XXL)$/i;
export const addonBaseName = (name = '') => String(name || '').replace(ADDON_SIZE_SUFFIX, '').trim();
export const addonTier = (addon = {}) =>
  addon?.tier_label || String(addon?.name || '').match(ADDON_SIZE_SUFFIX)?.[1]?.toUpperCase() || '';
export const toTierLabel = (value = '') =>
  String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const parseDaycareTier = (label = '') => {
  const raw = String(label || '').trim();
  const low = raw.toLowerCase();
  let duration = '';
  if (low.includes('hour')) duration = 'hourly';
  else if (low.includes('half day') || low.includes('half-day')) duration = 'half_day';
  else if (low.includes('full day') || low.includes('full-day')) duration = 'full_day';
  const size = raw
    .replace(/hourly\s*-\s*/i, '')
    .replace(/half\s*day\s*-\s*/i, '')
    .replace(/full\s*day\s*-\s*/i, '')
    .trim();
  return { raw, duration, size };
};

export const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `PHP ${amount.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const getAppointmentAddons = (raw = {}) => {
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
      id: addon?.addon_id || serviceAddon?.id || addon?.id || `${serviceAddon?.name || 'addon'}-${index}`,
      name: serviceAddon?.name || addon?.name || addon?.addon_name || 'Pawsome Extra',
      price: Number(addon?.price_charged ?? addon?.price ?? serviceAddon?.price_min ?? 0),
    };
  });
};

export const hotelRangeHasBlockedDate = (
  checkIn,
  checkOut,
  unavailableDates,
  closedDates,
  todayIso,
) => {
  if (!checkIn || !checkOut) return false;
  for (let current = checkIn; current < checkOut; current = addDays(current, 1)) {
    if (current < todayIso || unavailableDates.has(current) || closedDates.has(current)) return true;
  }
  return false;
};
