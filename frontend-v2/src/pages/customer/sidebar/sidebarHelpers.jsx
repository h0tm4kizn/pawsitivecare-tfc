/* This feature helper intentionally exports shared UI rows and formatting utilities together. */
/* eslint react-refresh/only-export-components: off */

export const getInitials = (name) =>
  (name || 'FP').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export const PH_PHONE_REGEX = /^09\d{9}$/;

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

export const normalizePHPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('63')) return `0${digits.slice(2, 11)}`.slice(0, 11);
  if (digits.startsWith('9')) return `0${digits.slice(0, 10)}`.slice(0, 11);
  return digits.slice(0, 11);
};

export const combineName = (...parts) => parts.filter(Boolean).join(' ').trim();

export const splitFullName = (value = '') => {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
};

export const inputCls = (err) =>
  `w-full rounded-xl border ${err ? 'border-red-300' : 'border-brand-dark-light'} bg-white px-3 py-2.5 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/25`;

export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character', test: (p) => /[!@#$%^&*()\-_=+{};:,<.>/?\\|[\]`~"']/.test(p) },
];

export const STRENGTH_META = {
  0: { label: 'Very Weak', color: 'text-brand-dark-soft', bar: 'bg-brand-dark-light' },
  1: { label: 'Weak', color: 'text-red-500', bar: 'bg-red-400' },
  2: { label: 'Fair', color: 'text-amber-500', bar: 'bg-amber-400' },
  3: { label: 'Good', color: 'text-yellow-600', bar: 'bg-yellow-400' },
  4: { label: 'Strong', color: 'text-brand-teal', bar: 'bg-brand-teal/70' },
  5: { label: 'Very Strong', color: 'text-emerald-600', bar: 'bg-emerald-500' },
};

export const getStrength = (password = '') => PASSWORD_RULES.reduce((acc, r) => acc + (r.test(password) ? 1 : 0), 0);

export const formatWeightKg = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return 'Weight: -';
  return `Weight: ${value} kg`;
};

export const displayAssessmentValue = (value, fallback = 'None') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

export const formatAssessmentDate = (value, options = { year: 'numeric', month: 'long', day: 'numeric' }) => {
  if (!value) return 'None';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'None' : date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ...options });
};

export const assessmentConditionLabels = [
  ['has_ticks', 'Ticks'], ['has_flea', 'Flea'], ['has_wound', 'Wound'],
  ['has_mange', 'Mange'], ['has_bald_spot', 'Bald spot'], ['has_skin_problem', 'Skin problem'],
  ['has_lameness', 'Lameness'], ['has_eye_discharge', 'Eye discharge'],
  ['has_nasal_discharge', 'Nasal discharge'], ['has_ear_discharge', 'Ear discharge'],
];

export function AssessmentDetailsPreview({ form, pet }) {
  const vaccinated = ['yes', 'true', '1', 'y'].includes(String(form?.is_vaccinated ?? '').toLowerCase()) ? 'Yes' : 'No';
  const vaccines = Array.isArray(form?.vaccines) ? form.vaccines.filter(Boolean).join(', ') : '';
  const conditions = assessmentConditionLabels
    .filter(([key]) => Boolean(form?.[key]))
    .map(([, label]) => label)
    .join(', ');
  const serviceName = form?.service_name || form?.service?.name || form?.appointment?.service?.name;
  const appointmentDate = form?.appointment?.appointment_date || form?.created_at;
  const rows = [
    ['Pet', pet?.name],
    ['Assessment date', formatAssessmentDate(appointmentDate)],
    ['Service', serviceName],
    ['Weight', form?.weight_kg ? `${form.weight_kg} kg` : 'None'],
    ['Vaccinated', vaccinated],
    ...(vaccinated === 'Yes' ? [
      ['Vaccines', vaccines || 'None'],
      ['Vaccination date', formatAssessmentDate(form?.vaccine_date)],
    ] : []),
    ['Veterinary clinic', form?.vet_clinic_name],
    ['Veterinary contact', form?.vet_contact_number],
    ['Socialization', form?.is_friendly],
    ['Treat preference', String(form?.treat_preference || '').replaceAll('_', ' ')],
    ['Allergies', form?.allergies],
    ['Medical conditions', form?.medical_conditions],
    ['Physical findings', conditions || 'None reported'],
    ['Declaration accepted', form?.declaration_accepted ? 'Yes' : 'No'],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-brand-teal/30 bg-white">
      <div className="divide-y divide-brand-dark-light/70 px-3 sm:px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,42%)_minmax(0,58%)] gap-3 py-2.5">
            <p className="text-[10px] font-bold uppercase leading-relaxed tracking-wide text-brand-dark-soft">{label}</p>
            <p className="break-words text-right text-xs font-semibold capitalize leading-relaxed text-brand-dark">
              {displayAssessmentValue(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssessmentHistoryLoading() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-teal/15 bg-brand-teal/5 px-4 py-4">
      <span className="h-7 w-7 shrink-0 animate-spin rounded-full border-[3px] border-brand-teal/20 border-t-brand-teal" />
      <div>
        <p className="text-sm font-bold text-brand-dark">Loading history</p>
        <p className="text-xs text-brand-dark-soft">Getting this pet's assessment records...</p>
      </div>
    </div>
  );
}

export function ProfileRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-dark-light/70 px-1 pb-3">
      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">{label}</p>
      <p className="min-w-0 text-right text-xs font-semibold text-brand-dark break-words">{value || '—'}</p>
    </div>
  );
}

export function CompactProfileRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-dark-light/60 px-1 py-2 last:border-b-0">
      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">{label}</p>
      <p className="min-w-0 text-right text-[11px] font-semibold text-brand-dark break-words">{value || '—'}</p>
    </div>
  );
}
