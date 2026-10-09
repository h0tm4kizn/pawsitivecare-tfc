import { sanitizeText } from '../../utils/textUtils';

export const EMPTY_FORM = {
  weight_kg: '',
  is_vaccinated: '',
  vaccines: [],
  vaccine_records: {},
  vet_clinic_name: '',
  vet_contact_number: '',
  is_friendly: '',
  treat_preference: '',
  allergies: '',
  has_ticks: false,
  has_flea: false,
  has_wound: false,
  has_mange: false,
  has_bald_spot: false,
  has_skin_problem: false,
  has_lameness: false,
  has_eye_discharge: false,
  has_nasal_discharge: false,
  has_ear_discharge: false,
  has_other_condition: false,
  other_condition_notes: '',
  medical_conditions: '',
  other_vaccine_name: '',
  declaration_accepted: false,
};

export const DOG_VACCINES = [
  'Rabies',
  'Canine Distemper',
  'Infectious Canine Hepatitis (Adenovirus Type 1 or 2)',
  'Canine Parvovirus',
  'Canine Parainfluenza',
  'Leptospirosis',
  'Bordetella bronchiseptica (Kennel Cough)',
  'Canine Coronavirus',
  'Canine Influenza',
  'Lyme Disease',
];

export const CAT_VACCINES = [
  'Rabies',
  'Feline Panleukopenia (Distemper)',
  'Feline Calicivirus',
  'Feline Viral Rhinotracheitis (Herpesvirus-1)',
  'Chlamydia',
  'Feline Leukemia Virus (FeLV)',
  'Feline Immunodeficiency Virus (FIV)',
  'Bordetella',
];

export const hasRabiesVaccine = (vaccines = []) =>
  Array.isArray(vaccines) && vaccines.some((name) => String(name || '').toLowerCase().includes('rabies'));

export const normalizeVaccineName = (name) => {
  const text = String(name || '').trim();
  if (!text) return '';
  const clean = text.replace(/\s*\((mandatory|required)\)\s*/gi, '').trim();
  const lower = clean.toLowerCase();
  if (lower.includes('rabies')) return 'Rabies';
  if (/5\s*[- ]?\s*in\s*[- ]?\s*1/.test(lower)) return '5-in-1';
  if (lower.includes('feline leukemia')) return 'Feline Leukemia Virus (FeLV)';
  return clean;
};

export const normalizeVaccineList = (vaccines = []) =>
  [...new Set((Array.isArray(vaccines) ? vaccines : []).map(normalizeVaccineName).filter(Boolean))];

export const normalizeAssessmentWeight = (value) => {
  const raw = String(value || '').replace(/[^\d.]/g, '');
  const [wholeRaw = '', decimalRaw] = raw.split('.');
  const whole = wholeRaw.slice(0, 2);
  const decimal = decimalRaw !== undefined ? decimalRaw.slice(0, 2) : undefined;
  const next = decimal !== undefined ? `${whole}.${decimal}` : whole;
  if (next && Number(next) > 99.99) return '99.99';
  return next;
};

export const SOCIALIZATION_OPTIONS = [
  { value: 'socialize', label: 'My pet can socialize with others' },
  { value: 'alone', label: 'My pet prefers to stay alone' },
];

export const TREAT_OPTIONS = [
  { value: 'can_treats', label: 'My pet can have house treats' },
  { value: 'no_treats', label: 'My pet cannot have house treats' },
];

export const HOTEL_POLICIES = [
  { num: '1.', title: 'Check-out & Pick-up Policy', body: 'Standard check-out time is 12:00 PM. Pick-ups beyond the agreed time will incur a Daycare Fee (charged per hour).' },
  { num: '2.', title: 'Safety & Comfort', body: 'We provide a safe, clean, and loving environment. Pets showing extreme aggression may be refused or separated for safety.' },
  { num: '3.', title: 'Happy & Healthy Pets Only', body: 'Pets must have updated complete vaccinations with proof (vet card/record). Anti-tick & flea prevention is required before check-in. Pets with illness (coughing, vomiting, diarrhea, severe skin issues) cannot be accepted.' },
  { num: '4.', title: 'Emergency Care', body: 'In case of emergency, we will contact you or your secondary contact. If urgent, your pet may be taken to your listed vet (or the nearest clinic if unavailable).' },
];

export const DAYCARE_POLICIES = [
  { num: '1.', title: 'Drop-off & Pick-up Schedule', body: 'Drop-off starts at 8:00 AM. Standard pick-up is before 6:00 PM. Late pick-ups incur an additional hourly fee.' },
  { num: '2.', title: 'Safety & Supervision', body: 'Pets are supervised at all times in a clean, secure environment. Pets showing aggression may be separated for everyone\'s safety.' },
  { num: '3.', title: 'Health Requirements', body: 'Pets must be vaccinated with proof (vet card/record). Anti-tick & flea treatment is required before daycare. Sick pets (coughing, vomiting, diarrhea) will not be accepted.' },
  { num: '4.', title: 'Emergency Contacts', body: 'In case of emergency, we will contact you immediately. If you are unreachable, your pet may be taken to your listed vet clinic.' },
];

export const GROOMING_POLICIES = [
  { num: '1.', title: 'Health Requirement', body: 'Pets must be free from ticks, fleas, and contagious conditions before grooming. We reserve the right to decline service if a pet poses a health risk to others.' },
  { num: '2.', title: 'Matting & Coat Condition', body: 'Severely matted coats may require shaving for the pet\'s comfort and safety. Additional charges may apply. Our groomers will advise before proceeding.' },
  { num: '3.', title: 'Stress & Senior Pets', body: 'If your pet shows signs of extreme stress or is elderly with known health conditions, please inform us. We may pause or modify the grooming session for their safety.' },
  { num: '4.', title: 'Drop-off & Pick-up', body: 'Please pick up your pet within 1 hour of completion. Pets left beyond the agreed time may incur a waiting/daycare fee.' },
];

export const GROOMING_ITEMS = [
  { key: 'has_ticks', label: 'Ticks' },
  { key: 'has_flea', label: 'Flea' },
  { key: 'has_wound', label: 'Wound' },
  { key: 'has_mange', label: 'Mange' },
  { key: 'has_bald_spot', label: 'Bald Spot' },
  { key: 'has_skin_problem', label: 'Skin Problem' },
  { key: 'has_lameness', label: 'Lameness' },
  { key: 'has_eye_discharge', label: 'Eye Discharge' },
  { key: 'has_nasal_discharge', label: 'Nasal Discharge' },
  { key: 'has_ear_discharge', label: 'Ear Discharge' },
];

export const petInitials = (name) => String(name || '?').slice(0, 2).toUpperCase();
export const TODAY = new Date().toISOString().slice(0, 10);
export const PH_MOBILE_REGEX = /^(?:\+63|0)9\d{9}$/;

export const normalizePhMobileInput = (value) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  let core = digitsOnly;
  if (core.startsWith('63')) core = core.slice(2);
  if (core.startsWith('0')) core = core.slice(1);
  const firstNine = core.indexOf('9');
  if (firstNine > 0) core = core.slice(firstNine);
  if (firstNine === -1) return '';
  return `0${core.slice(0, 10)}`;
};

export const normalizeVaccineRecords = (dataRecords) => {
  if (Array.isArray(dataRecords)) {
    return dataRecords.reduce((acc, item) => {
      const key = normalizeVaccineName(item?.vaccine || item?.vaccine_name || item?.name);
      const date = String(item?.date || item?.vaccine_date || '').slice(0, 10);
      if (key && date) acc[key] = date;
      return acc;
    }, {});
  }
  if (dataRecords && typeof dataRecords === 'object') {
    return Object.entries(dataRecords).reduce((acc, [key, value]) => {
      const normalizedKey = normalizeVaccineName(key);
      const date = String(value || '').slice(0, 10);
      if (normalizedKey && date) acc[normalizedKey] = date;
      return acc;
    }, {});
  }
  return {};
};

export const normalizeBoolField = (value) =>
  value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true';

export const normalizeChoiceField = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower === 'yes' || lower === 'true' || lower === '1') return 'Yes';
  if (lower === 'no' || lower === 'false' || lower === '0') return 'No';
  return text;
};

export const normalizeTextField = (value) => sanitizeText(value ?? '') || '';

export const normalizeWeightField = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '';
};

export const normalizeLoadedAssessmentForm = (formData = {}, fallbackWeight = '') => {
  const legacyVaccines = [];
  if (normalizeBoolField(formData.vaccine_5in1)) legacyVaccines.push('5-in-1');
  if (normalizeBoolField(formData.vaccine_rabies)) legacyVaccines.push('Rabies');
  const selectedVaccines = normalizeVaccineList(
    Array.isArray(formData.vaccines) && formData.vaccines.length ? formData.vaccines : legacyVaccines,
  );
  const vaccineRecords = normalizeVaccineRecords(formData.vaccine_records);
  const fallbackDate = String(formData.vaccine_date || '').slice(0, 10);
  if (fallbackDate) {
    selectedVaccines.forEach((vaccine) => {
      if (!vaccineRecords[vaccine]) vaccineRecords[vaccine] = fallbackDate;
    });
  }
  const friendlyChoice = normalizeChoiceField(formData.is_friendly);
  const legacySocialization = friendlyChoice === 'Yes' ? 'socialize' : friendlyChoice === 'No' ? 'alone' : friendlyChoice;

  return {
    ...EMPTY_FORM,
    weight_kg: normalizeWeightField(formData.weight_kg ?? fallbackWeight),
    is_vaccinated: normalizeChoiceField(formData.is_vaccinated),
    vaccines: selectedVaccines,
    vaccine_records: vaccineRecords,
    vet_clinic_name: normalizeTextField(formData.vet_clinic_name),
    vet_contact_number: normalizeTextField(formData.vet_contact_number),
    is_friendly: legacySocialization,
    treat_preference: normalizeTextField(formData.treat_preference),
    allergies: normalizeTextField(formData.allergies),
    has_ticks: normalizeBoolField(formData.has_ticks),
    has_flea: normalizeBoolField(formData.has_flea),
    has_wound: normalizeBoolField(formData.has_wound),
    has_mange: normalizeBoolField(formData.has_mange),
    has_bald_spot: normalizeBoolField(formData.has_bald_spot),
    has_skin_problem: normalizeBoolField(formData.has_skin_problem),
    has_lameness: normalizeBoolField(formData.has_lameness),
    has_eye_discharge: normalizeBoolField(formData.has_eye_discharge),
    has_nasal_discharge: normalizeBoolField(formData.has_nasal_discharge),
    has_ear_discharge: normalizeBoolField(formData.has_ear_discharge),
    has_other_condition: normalizeBoolField(formData.has_other_condition),
    other_condition_notes: normalizeTextField(formData.other_condition_notes),
    medical_conditions: normalizeTextField(formData.medical_conditions),
    other_vaccine_name: normalizeTextField(formData.other_vaccine_name),
    declaration_accepted: normalizeBoolField(formData.declaration_accepted),
  };
};
