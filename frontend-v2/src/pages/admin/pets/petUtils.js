import { formatReference } from '../../../utils/recordFormatters';

export const normalizePet = (item) => ({
  id:            item?.id,
  pet_id:        item?.pet_id || null,
  name:          item?.name || '—',
  species_type:  item?.species_type || item?.speciesType || null,
  species_id:    item?.species_id || null,
  breed:         item?.breed || null,
  breed_id:      item?.breed_id || null,
  sex:           item?.sex || '—',
  weight_kg:     item?.weight_kg ?? null,
  date_of_birth: item?.date_of_birth || null,
  medical_notes: item?.medical_notes || '',
  owner_id:      item?.owner_id || null,
  owner:         item?.owner || null,
  photo_url:     item?.photo_url || null,
  is_active:     item?.is_active !== undefined ? item.is_active : true,
  deactivation_reason: item?.deactivation_reason || '',
  created_at:    item?.created_at || null,
});

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', day: 'numeric', year: 'numeric' }) : '—';

export const calcAge = (dob) => {
  if (!dob) return null;
  const totalMonths =
    (new Date().getFullYear() - new Date(dob).getFullYear()) * 12 +
    (new Date().getMonth() - new Date(dob).getMonth());
  if (totalMonths < 1)  return 'Under 1 month';
  if (totalMonths < 12) return `${totalMonths}mo`;
  const yr = Math.floor(totalMonths / 12);
  return `${yr} yr${yr !== 1 ? 's' : ''}`;
};

export const speciesColor = (species) => {
  const s = (species || '').toLowerCase();
  if (s === 'dog' || s === 'dogs') return 'bg-brand-teal';
  if (s === 'cat' || s === 'cats') return 'bg-brand-orange';
  return 'bg-brand-dark';
};

export const speciesInitial = (species) => {
  const s = (species || '').toLowerCase();
  if (s === 'dog' || s === 'dogs') return 'D';
  if (s === 'cat' || s === 'cats') return 'C';
  return (species || 'P')[0].toUpperCase();
};

export const ownerName = (owner) =>
  `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || '—';

export const titleCasePetName = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b([a-z])/g, (match) => match.toUpperCase()) || '-';

export const getInitials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2) || '?';

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
  if ((category.includes('groom') || category.includes('day')) && sizeLabel) {
    const normalized = sizeLabel.toUpperCase();
    if (normalized === 'CAT') return baseName;
    return `${baseName} (${sizeLabel})`;
  }
  return baseName;
};

export const getAppointmentPackageCode = (row) => {
  const category = String(row?.service?.category || row?.category || '').toLowerCase();
  const sizeLabel = String(row?.size_label || '').trim().toUpperCase();
  const baseCode =
    row?.service?.display_id ||
    row?.service_id_display ||
    row?.service_code ||
    row?.service?.package_code ||
    row?.service?.display_code ||
    row?.service?.id ||
    '-';
  if ((category.includes('groom') || category.includes('day')) && sizeLabel && baseCode !== '-') {
    return `${baseCode}-${sizeLabel}`;
  }
  return baseCode;
};

export const isCompletedStatus = (status) => String(status || '').toLowerCase() === 'completed';

export const extractAppointments = (data) => {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const calcAgeVerbose = (dob) => {
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
  const s = String(pet?.species_type?.name ?? '').toLowerCase();
  const isCat = s.includes('cat') || s.includes('feline');
  return {
    mediaBg: isCat ? 'bg-orange-400/85' : 'bg-brand-teal/85',
    speciesBadge: isCat ? 'bg-brand-orange text-white' : 'bg-brand-teal text-white',
    idText: isCat ? 'text-brand-orange' : 'text-brand-teal',
  };
};

export const TODAY = new Date().toISOString().slice(0, 10);
export const EMPTY_PET = { name: '', speciesId: '', breedId: '', sex: '', dateOfBirth: '', weightKg: '' };

export const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const n = String(value || '').trim().toLowerCase();
  return ['yes', 'true', '1', 'y'].includes(n);
};

export const recognitionStatusLabel = (pet) => {
  const raw =
    pet?.recognition_registered ??
    pet?.pet_recognition_registered ??
    pet?.biometric_registered ??
    pet?.is_recognized;
  return toBool(raw) ? 'Enrolled' : 'Not enrolled';
};

export const recognitionRegisteredAtLabel = (pet) => {
  const raw =
    pet?.recognition_registered_at ??
    pet?.pet_recognition_registered_at ??
    pet?.biometric_registered_at ??
    pet?.recognized_at ??
    pet?.enrolled_at;
  if (!raw) return '-';
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const getReservationPaymentMode = (row) => {
  const noteMatch = String(row?.notes || '').match(/hotel reservation [^:]+:\s*(.+)$/i);
  return noteMatch?.[1]?.trim() || '-';
};

export const isOtherBreed = (breed) => /^others?(?:\s*\(.*\))?$/i.test(String(breed?.name || '').trim());

export const isValidListedBreed = (breed) => {
  const name = String(breed?.name || '').trim();
  return Boolean(name) && !/^\d+$/.test(name) && !isOtherBreed(breed);
};

export const exportAppointmentPdf = async (apt, { defaultPetName = '-', defaultPetCode = '-', defaultOwnerName = '-' } = {}) => {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 14;
  const line = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '-'), 62, y);
    y += 6;
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Appointment Record', 14, y);
  y += 8;
  doc.setFontSize(10);
  line('Appointment ID', apt?.serviceId || '-');
  line('Status', apt?.status || '-');
  line('Service', apt?.service || '-');
  line('Date', apt?.date || '-');
  line('Time', apt?.time || '-');
  line('Completed Time', apt?.completedAt || '-');
  line('Handled By', apt?.handledBy || '-');
  line('Pet Name', apt?.petName || defaultPetName || '-');
  line('Pet ID', apt?.petCode || defaultPetCode || '-');
  line('Owner', apt?.ownerName || defaultOwnerName || '-');
  line('Contact', apt?.ownerPhone || '-');
  line('Email', apt?.ownerEmail || '-');
  line('Address', apt?.ownerAddress || '-');
  if (apt?.isHotel) {
    line('Reservation Channel', apt?.reservationPaymentMode || '-');
  }
  line(apt?.isHotel ? 'Reservation Reference' : 'Payment Reference', formatReference(apt?.paymentReference || '-'));
  line('Special Instructions', apt?.specialInstructions || 'None');
  const safeId = String(apt?.serviceId || apt?.id || 'appointment').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(`appointment-${safeId}-${safeDate}.pdf`);
};
