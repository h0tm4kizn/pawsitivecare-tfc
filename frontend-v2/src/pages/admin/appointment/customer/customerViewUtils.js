export { getInitials } from './customerUtils';

export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatTime = (value) => {
  const time = String(value || '');
  if (!time) return '-';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return '-';
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

export const getAppointmentPackageName = (row) => {
  const category = String(row?.service?.category || row?.category || '').toLowerCase();
  const baseName = row?.service?.name || row?.service_name || row?.service || '-';
  const suiteName = row?.hotel_suite?.name || row?.hotelSuite?.name || row?.suite?.name || '';
  const sizeLabel = String(row?.size_label || '').trim();
  if (category.includes('hotel') && suiteName) return suiteName;
  if ((category.includes('groom') || category.includes('day')) && sizeLabel) return `${baseName} (${sizeLabel})`;
  return baseName;
};

export const getAppointmentPackageCode = (row) => {
  const category = String(row?.service?.category || row?.category || '').toLowerCase();
  const sizeLabel = String(row?.size_label || '').trim().toUpperCase();
  const baseCode = row?.service?.display_id || row?.service_id_display || row?.service_code ||
    row?.service?.package_code || row?.service?.display_code || row?.service?.id || '-';
  if ((category.includes('groom') || category.includes('day')) && sizeLabel && baseCode !== '-') {
    return `${baseCode}-${sizeLabel}`;
  }
  return baseCode;
};

export const extractAppointments = (data) => {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const isCompletedStatus = (status) => String(status || '').toLowerCase() === 'completed';

export const calcAge = (dob) => {
  if (!dob) return '-';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '-';
  const now = new Date();
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'Less than 1 month old';
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''} old`;
  const years = Math.floor(totalMonths / 12);
  return `${years} year${years !== 1 ? 's' : ''} old`;
};

export const getSpeciesTone = (pet) => {
  const species = String(pet?.species_type?.name ?? pet?.speciesType?.name ?? pet?.species ?? pet?.type ?? '').toLowerCase();
  const isCat = species.includes('cat') || species.includes('feline');
  return {
    mediaBg: isCat ? 'bg-orange-400/85' : 'bg-brand-teal/85',
    speciesBadge: isCat ? 'bg-brand-orange text-white' : 'bg-brand-teal text-white',
  };
};

export const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value || '').trim().toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(normalized)) return true;
  if (['no', 'false', '0', 'n', ''].includes(normalized)) return false;
  return Boolean(value);
};

export const getPetRecognitionStatus = (pet) => {
  const raw = pet?.recognition_registered ?? pet?.pet_recognition_registered ??
    pet?.biometric_registered ?? pet?.is_recognized;
  return toBool(raw) ? 'Enrolled' : 'Not enrolled';
};

export const getPetRecognitionRegisteredAt = (pet) => {
  const raw = pet?.recognition_registered_at ?? pet?.pet_recognition_registered_at ??
    pet?.biometric_registered_at ?? pet?.recognized_at ?? pet?.enrolled_at;
  if (!raw) return '-';
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const labelFromBool = (value) => (toBool(value) ? 'Yes' : 'No');

export const fmtDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtDateShort = (value) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
};

export const humanize = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

export const hasLinkedService = (record) => Boolean(
  record?.service_id || record?.service?.id || record?.service?.display_id ||
  (record?.service_name && String(record.service_name).trim() !== '')
);

export const getArray = (payload, keys = []) => {
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data) && Array.isArray(payload.data.data)) {
    return payload.data.data;
  }
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};
