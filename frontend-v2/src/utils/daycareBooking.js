export const DAYCARE_MAX_PETS = 3;

export const DAYCARE_DURATIONS = [
  { value: 'hourly', label: 'Hourly', hours: 1 },
  { value: 'half_day', label: 'Half Day', hours: 4 },
  { value: 'full_day', label: 'Full Day', hours: 8 },
];

export const HOTEL_DOG_SIZE_OPTIONS = [
  { value: 'Small', label: 'Small' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Large', label: 'Large' },
  { value: 'XLarge', label: 'XLarge' },
];

export const HOTEL_CAT_SIZE_OPTIONS = [
  { value: 'KITTEN', label: 'Kitten' },
  { value: 'CAT', label: 'Cat' },
];

export const getPetSpeciesCode = (pet = {}) => {
  const rawCode = String(
    pet?.speciesType?.code
      || pet?.species_type?.code
      || pet?.species?.code
      || pet?.species_code
      || '',
  ).trim().toUpperCase();

  if (['D', 'DOG', 'DOGS'].includes(rawCode)) return 'D';
  if (['C', 'CAT', 'CATS'].includes(rawCode)) return 'C';

  const rawName = String(
    pet?.speciesType?.name
      || pet?.species_type?.name
      || pet?.species?.name
      || pet?.species
      || (typeof pet?.species_type === 'string' ? pet.species_type : '')
      || pet?.species_name
      || pet?.species_type_name
      || '',
  ).trim().toLowerCase();

  if (rawName === 'dog' || rawName === 'dogs' || rawName.includes('canine')) return 'D';
  if (rawName === 'cat' || rawName === 'cats' || rawName.includes('feline')) return 'C';
  return '';
};

export const isDaycareDog = (pet) => getPetSpeciesCode(pet) === 'D';

export const normalizeDaycareDuration = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'hour' || normalized === 'hourly') return 'hourly';
  if (normalized === 'half_day' || normalized === 'halfday') return 'half_day';
  if (normalized === 'full_day' || normalized === 'fullday') return 'full_day';
  return '';
};

export const parseDaycareTier = (tier = {}) => {
  const rawSizeLabel = String(tier?.size_label || tier?.label || '').trim();
  const lower = rawSizeLabel.toLowerCase();
  const duration = lower.includes('half day') || lower.includes('half-day')
    ? 'half_day'
    : lower.includes('full day') || lower.includes('full-day')
      ? 'full_day'
      : lower.includes('hour')
        ? 'hourly'
        : normalizeDaycareDuration(tier?.daycare_duration || tier?.duration);
  const sizeLabel = rawSizeLabel
    .replace(/^hourly\s*-\s*/i, '')
    .replace(/^half\s*day\s*-\s*/i, '')
    .replace(/^full\s*day\s*-\s*/i, '')
    .trim();

  return {
    ...tier,
    rawSizeLabel,
    duration,
    sizeLabel: sizeLabel || rawSizeLabel,
    price: Number(tier?.price ?? tier?.price_min ?? tier?.amount ?? 0),
    durationHours: Number(tier?.duration_hours || 0),
  };
};

export const getDaycareTiers = (service = {}) => {
  const tiers = Array.isArray(service?.tiers)
    ? service.tiers
    : Array.isArray(service?.service_tiers)
      ? service.service_tiers
      : [];
  return tiers.map(parseDaycareTier);
};

export const getDaycareDurationOptions = (service = {}) => {
  const available = new Set(getDaycareTiers(service).map((tier) => tier.duration).filter(Boolean));
  return DAYCARE_DURATIONS.filter((duration) => available.has(duration.value));
};

export const getDaycareSizeOptions = (service = {}, duration = '') => {
  const selectedDuration = normalizeDaycareDuration(duration);
  return getDaycareTiers(service)
    .filter((tier) => tier.duration === selectedDuration)
    .map((tier) => ({
      value: tier.rawSizeLabel,
      label: tier.sizeLabel,
      price: tier.price,
    }));
};

export const validateDaycareSelection = ({
  pets = [],
  assessments = {},
  duration = '',
  sizes = {},
  requireAssessments = true,
} = {}) => {
  if (pets.length === 0) return { valid: false, reason: 'Select at least one dog for daycare.' };
  if (pets.length > DAYCARE_MAX_PETS) return { valid: false, reason: `Select no more than ${DAYCARE_MAX_PETS} dogs.` };
  if (pets.some((pet) => !isDaycareDog(pet))) return { valid: false, reason: 'Daycare is available for dogs only.' };

  if (requireAssessments) {
    for (const pet of pets) {
      const assessment = assessments[String(pet.id)] || assessments[pet.id];
      if (!assessment?.complete) return { valid: false, reason: `Complete the assessment for ${pet.name || 'every dog'}.` };
      if (assessment?.hasTicksOrFlea) return { valid: false, reason: `${pet.name || 'A selected dog'} must be free from ticks and fleas.` };
      if (assessment?.missingRabies) return { valid: false, reason: `${pet.name || 'A selected dog'} needs a current rabies vaccination.` };
    }
  }

  if (!normalizeDaycareDuration(duration)) return { valid: false, reason: 'Select a daycare duration.' };
  const missingSizePet = pets.find((pet) => !sizes[String(pet.id)]);
  if (missingSizePet) return { valid: false, reason: `Select a size for ${missingSizePet.name || 'every dog'}.` };
  return { valid: true, reason: '' };
};
