export const AVATAR_COLORS = [
  'bg-brand-orange',
  'bg-brand-dark',
  'bg-brand-teal',
  'bg-[#5C7A8A]',
  'bg-[#2E7D6B]',
];

export const avatarColor = (name = '') => {
  let sum = 0;
  for (const c of name) sum += c.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

export const getInitials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

export const formatEmailPreview = (email = '', visibleChars = 15) => {
  const value = String(email || '').trim();
  if (!value) return '—';
  if (value.length <= visibleChars) return value;
  return `${value.slice(0, visibleChars)}...`;
};

export const formatAddressPreview = (address = '', visibleChars = 20) => {
  const value = String(address || '').trim();
  if (!value) return '—';
  if (value.length <= visibleChars) return value;
  return `${value.slice(0, visibleChars)}...`;
};

export const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== '—';

export const isValidPHPhone = (v) => /^(09|\+639)\d{9}$/.test(String(v).trim().replace(/[-\s]/g, ''));
export const normalizePHPhone = (v) => {
  const digits = String(v || '').replace(/\D/g, '');
  if (!digits) return '';
  let core = digits;
  if (core.startsWith('63')) core = core.slice(2);
  if (core.startsWith('0')) core = core.slice(1);
  const idx = core.indexOf('9');
  if (idx > 0) core = core.slice(idx);
  if (idx === -1) return '';
  return `0${core.slice(0, 10)}`;
};
export const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

export const getMissingFields = (owner) => {
  const m = [];
  if (!hasValue(owner?.email)) m.push('Email');
  if (!hasValue(owner?.phone)) m.push('Phone');
  if (!hasValue(owner?.address)) m.push('Address');
  if (!owner?.pets?.length) m.push('Linked Pets');
  return m;
};

export const ADDRESS_INPUT_CLASS =
  'w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none';

export const composeAddress = (form = {}) => {
  const line1 = [form.address_unit_floor, form.address_street].filter(Boolean).join(', ');
  const line2 = [
    form.address_barangay ? `Brgy. ${form.address_barangay}` : '',
    form.address_city,
    form.address_province,
    form.address_postal_code,
  ].filter(Boolean).join(', ');
  const country = form.address_country || 'PH';
  return [line1, line2, country].filter(Boolean).join(', ');
};

export const validateCustomerCommon = (form = {}) => {
  const nextErrors = {};
  if (!form.first_name?.trim()) nextErrors.first_name = 'First name is required.';
  if (!form.last_name?.trim()) nextErrors.last_name = 'Last name is required.';
  if (!form.email?.trim()) nextErrors.email = 'Email is required.';
  if (!form.phone?.trim()) nextErrors.phone = 'Phone number is required.';
  else if (!isValidPHPhone(form.phone)) nextErrors.phone = 'Invalid phone. Use 09XXXXXXXXX format.';

  if (!form.address_street?.trim()) nextErrors.address_street = 'Street address is required.';
  if (!form.address_province?.trim()) nextErrors.address_province = 'Province is required.';
  if (!form.address_city?.trim()) nextErrors.address_city = 'City/Municipality is required.';
  if (!form.address_barangay?.trim()) nextErrors.address_barangay = 'Barangay is required.';
  if (!form.address_postal_code?.trim()) {
    nextErrors.address_postal_code = 'Postal code is required.';
  } else if (!/^\d{4}$/.test(form.address_postal_code.trim())) {
    nextErrors.address_postal_code = 'Postal code must be 4 digits.';
  }
  if (form.ec_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(form.ec_email))) {
    nextErrors.ec_email = 'Emergency email is invalid.';
  }
  if (form.ec_phone && !isValidPHPhone(form.ec_phone)) {
    nextErrors.ec_phone = 'Emergency phone must be in 09XXXXXXXXX format.';
  }
  return nextErrors;
};
