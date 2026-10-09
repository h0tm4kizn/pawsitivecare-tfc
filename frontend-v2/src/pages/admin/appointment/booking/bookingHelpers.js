import { isDaycareDog } from '../../../../utils/daycareBooking';
import { getOwnerName, getServiceTiers } from './bookingUtils';
import { CAT_VACCINES, DAYCARE_CLOSE_MINUTES, DOG_VACCINES } from './bookingConstants';

export const sanitizeReferenceNumber = (value = '') => String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);

export const truthyFlag = (value) => value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true';

export const extractAddonRows = (payload = {}) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.addons)) return payload.addons;
  if (Array.isArray(payload?.data?.addons)) return payload.data.addons;
  if (Array.isArray(payload?.service_addons)) return payload.service_addons;
  if (Array.isArray(payload?.data?.service_addons)) return payload.data.service_addons;
  return [];
};

export const normalizePawsomeExtras = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  const filtered = list.filter((row) => {
    const category = String(row?.category || '').toLowerCase();
    const active = row?.is_active !== false;
    const applies = truthyFlag(row?.applies_to_grooming);
    const hasScope = Boolean(
      category ||
      row?.applies_to_grooming != null ||
      row?.applies_to_daycare != null ||
      row?.applies_to_hotel != null
    );
    const legacy = category === 'grooming_extra' || category === 'grooming_addon';
    return active && (!hasScope || applies || legacy);
  });
  const seen = new Set();
  return filtered.filter((row) => {
    const id = String(row?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const isPawsomeExtrasService = (service) => String(service?.name || '').trim().toLowerCase() === 'pawsome extras';

export const buildHotelReservationNote = (mode, provider) => {
  if (!mode) return null;
  if (mode === 'cash') return 'Hotel reservation payment method: Cash';
  if (!provider) return null;
  const label = mode === 'e_wallet' ? 'E-Wallet' : 'Bank Transfer';
  return `Hotel reservation payment method: ${label} - ${provider}`;
};

export const isHotelEntry = (entry) =>
  String(entry?.category || entry?.selectedService?.category || '').toLowerCase() === 'hotel';

export const normalizeServiceCategory = (service) => String(
  service?.category || service?.service_category || service?.category_name || ''
).trim().toLowerCase();

export const normalizeServiceForBooking = (service) => ({
  ...service,
  category: normalizeServiceCategory(service),
  service_tiers: Array.isArray(service?.service_tiers)
    ? service.service_tiers
    : (Array.isArray(service?.tiers) ? service.tiers : []),
});

export const toPriceNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const applyServicePromotion = (service, basePrice, date) => {
  const day = date || new Date().toISOString().slice(0, 10);
  const candidates = (service?.promotions || (service?.tiers || service?.service_tiers || []).flatMap((tier) => tier.promotions || []))
    .filter((promo) => promo?.is_active !== false && (!promo.starts_on || promo.starts_on <= day) && (!promo.ends_on || promo.ends_on >= day))
    .map((promo) => {
      const value = Number(promo.discount_value || 0);
      const discounted = promo.discount_type === 'percentage'
        ? basePrice * (1 - value / 100)
        : promo.discount_type === 'fixed'
          ? basePrice - value
          : Math.min(basePrice, Number(promo.promotional_price || 0));
      return { discounted: Math.max(0, discounted) };
    });
  return candidates.sort((a, b) => (basePrice - b.discounted) - (basePrice - a.discounted))[0]?.discounted ?? basePrice;
};

export const applySelectedServicePromotion = (service, tierId, promotionId, basePrice, date) => {
  if (!promotionId) return basePrice;
  const day = date || new Date().toISOString().slice(0, 10);
  const promotion = (service?.tiers || service?.service_tiers || [])
    .find((tier) => String(tier?.id) === String(tierId))
    ?.promotions?.find((promo) => String(promo?.id) === String(promotionId));
  if (!promotion || promotion.is_active === false || (promotion.starts_on && promotion.starts_on > day) || (promotion.ends_on && promotion.ends_on < day)) {
    return basePrice;
  }
  return Math.max(0, Number(
    promotion.discount_type === 'percentage'
      ? basePrice * (1 - Number(promotion.discount_value || 0) / 100)
      : promotion.discount_type === 'fixed'
        ? basePrice - Number(promotion.discount_value || 0)
        : Math.min(basePrice, Number(promotion.promotional_price || 0)),
  ));
};

export const resolveEntryBasePrice = (entry, petSpecies) => {
  const service = entry?.selectedService;
  if (!service) return 0;
  const tiers = getServiceTiers(service);
  const selectedTier = tiers.find((item) => String(item?.size_label || '') === String(entry?.size_label || ''));
  if (selectedTier) {
    return toPriceNumber(selectedTier?.price ?? selectedTier?.price_min ?? selectedTier?.amount);
  }
  if (tiers.length > 0) {
    const visibleTiers = tiers.filter((tier) => {
      const size = String(tier?.size_label || '').toUpperCase();
      const catSizes = ['CAT', 'KITTEN'];
      if (petSpecies === 'C') return catSizes.includes(size);
      if (petSpecies === 'D') return !catSizes.includes(size);
      return true;
    });
    const fallbackTier = visibleTiers[0] || tiers[0];
    return toPriceNumber(fallbackTier?.price ?? fallbackTier?.price_min ?? fallbackTier?.amount);
  }
  return toPriceNumber(service?.price ?? service?.price_min ?? service?.base_price ?? service?.amount);
};

export const formatCategoryLabel = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '-';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export const inferDaycareDuration = (service) => {
  const blob = `${service?.name || ''} ${service?.description || ''}`.toLowerCase();
  if (blob.includes('hour')) return 'hourly';
  if (blob.includes('half day') || blob.includes('half-day')) return 'half_day';
  if (blob.includes('full day') || blob.includes('full-day')) return 'full_day';
  return null;
};

export const sanitizeDraftVaccinesForPet = (draft = {}, pet = null) => {
  const speciesCode = String(
    pet?.speciesType?.code ||
    pet?.species_type?.code ||
    pet?.species?.code ||
    pet?.species_code ||
    ''
  ).toUpperCase();
  const allowed = speciesCode === 'D' ? DOG_VACCINES : speciesCode === 'C' ? CAT_VACCINES : [];
  if (!allowed.length) return draft;
  const vaccines = Array.isArray(draft?.vaccines) ? draft.vaccines : [];
  const filtered = vaccines.filter((name) => allowed.includes(String(name || '').trim()));
  const rabiesChecked = Boolean(
    draft?.vaccine_rabies === true || draft?.has_rabies === true || draft?.missing_rabies === false
  );
  const withRabies = rabiesChecked && !filtered.some((name) => String(name).toLowerCase().includes('rabies'))
    ? [...filtered, 'Rabies (Mandatory)']
    : filtered;
  return { ...draft, vaccines: withRabies };
};

export const draftHasRabies = (draft = {}) => {
  const vaccines = Array.isArray(draft?.vaccines) ? draft.vaccines : [];
  if (draft?.vaccine_rabies === true) return true;
  if (draft?.has_rabies === true) return true;
  if (draft?.missing_rabies === false) return true;
  return vaccines.some((name) => String(name || '').toLowerCase().includes('rabies'));
};

export const draftHasParasite = (draft = {}) => Boolean(
  draft?.has_ticks === true ||
  draft?.has_flea === true ||
  draft?.has_tick_infestation === true ||
  draft?.has_flea_infestation === true ||
  draft?.ticks === true ||
  draft?.fleas === true
);

export const daycareDurationHours = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'hourly') return 1;
  if (v === 'half_day') return 4;
  if (v === 'full_day') return 8;
  return 0;
};

export const toMinutesFromHHMM = (value) => {
  const text = String(value || '').slice(0, 5);
  const [hh, mm] = text.split(':').map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return (hh * 60) + mm;
};

export const isDaycareScheduleWithinHours = (entry) => {
  if (String(entry?.category || '').toLowerCase() !== 'daycare') return true;
  const start = toMinutesFromHHMM(entry?.start_time);
  const hours = daycareDurationHours(entry?.daycare_duration);
  if (start === null) return false;
  if (hours <= 0) return true;
  return (start + (hours * 60)) <= DAYCARE_CLOSE_MINUTES;
};

export const getDaycareScheduleIssue = (entry) => {
  if (!entry?.appointment_date) return 'missing_date';
  if (!entry?.start_time) return 'missing_time';
  if (!String(entry?.daycare_duration || '').trim()) return 'missing_duration';
  if (!isDaycareScheduleWithinHours(entry)) return 'exceeds_close';
  return null;
};

export const isDogPet = isDaycareDog;

export const normalizeOwnerRow = (row) => {
  const firstName = row?.first_name || row?.firstname || '';
  const lastName = row?.last_name || row?.lastname || '';
  const fullName = row?.full_name || row?.fullName || row?.name || `${firstName} ${lastName}`.trim();
  return {
    ...row,
    id: row?.id ?? row?.owner_id ?? row?.customer_id ?? row?.user_id ?? '',
    first_name: firstName || (fullName ? String(fullName).split(' ').slice(0, -1).join(' ') : ''),
    last_name: lastName || (fullName ? String(fullName).split(' ').slice(-1).join(' ') : ''),
    name: row?.name || fullName || '',
    full_name: fullName || '',
    email: row?.email || '',
    phone: row?.phone || row?.contact_number || row?.mobile_number || '',
    address: row?.address || row?.full_address || row?.complete_address || row?.street_address || '',
    pets: Array.isArray(row?.pets) ? row.pets : [],
  };
};

export const ownerSearchBlob = (owner) => [
  owner?.display_id,
  getOwnerName(owner),
  owner?.full_name,
  owner?.first_name,
  owner?.last_name,
  owner?.email,
  owner?.phone,
  owner?.contact_number,
  owner?.mobile_number,
].filter(Boolean).join(' ').toLowerCase();
