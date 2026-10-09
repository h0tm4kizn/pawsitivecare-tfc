export const normalizeStatus = (status) => String(status || '').toLowerCase().replace(/-/g, '_');

export const isCompletedOrCancelledStatus = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === 'completed' || normalized === 'cancelled' || normalized === 'canceled';
};

export const formatStatusLabel = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'in_progress' || normalized === 'checkin' || normalized === 'checked_in') return 'In Progress';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled') return 'Cancelled';
  if (normalized === 'no_show') return 'No Show';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'approved') return 'Approved';
  return 'Appointment Update';
};

export const formatCustomerAppointmentReason = (reason) => {
  const raw = String(reason || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (normalized.includes('[late cancellation]') || normalized.includes('grace period') || normalized.includes('no-show')) {
    return 'The appointment was cancelled after the 15-minute grace period had elapsed.';
  }
  const clean = raw
    .replace(/^\s*\[(?:late cancellation|rejected)\]\s*/i, '')
    .replace(/^\s*(?:client-initiated|administrative cancellation|policy violation)\s*:\s*/i, '')
    .replace(/\s*\([^)]*policy violation[^)]*\)\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s\-:;]+$/, '');
  return clean;
};

export const formatCustomerNotificationMessage = (message) => {
  const raw = String(message || '').trim();
  if (!raw) return '';
  const marker = raw.search(/\sReason:\s*/i);
  if (marker < 0) return raw;
  const prefix = raw.slice(0, marker).trim();
  const reason = formatCustomerAppointmentReason(raw.slice(marker).replace(/^\s*Reason:\s*/i, ''));
  return reason ? `${prefix} Reason: ${reason}` : prefix;
};

export const formatCancellationReason = (reason) => {
  return formatCustomerAppointmentReason(reason) || '-';
};

export const formatReservationChannelLabel = (mode) => {
  const normalized = String(mode || '').toLowerCase().replace(/-/g, '_');
  if (!normalized) return '-';
  if (normalized === 'cash') return 'Cash';
  if (['gcash', 'maya', 'grabpay', 'shopeepay', 'e_wallet', 'ewallet'].includes(normalized)) return 'E-Wallet';
  if (normalized === 'bank_transfer') return 'Bank Transfer';
  return String(mode).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const formatReservationStatusLabel = (status) => {
  const normalized = String(status || '').toLowerCase().replace(/-/g, '_');
  if (!normalized) return '-';
  if (normalized === 'unpaid' || normalized === 'pending') return 'Not Documented';
  if (normalized === 'partially_paid' || normalized === 'partial') return 'Partially Documented';
  if (normalized === 'paid') return 'Documented';
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const formatWeightKg = (weight) => {
  if (weight === null || weight === undefined || String(weight) === '') return '-';
  return `${weight} kg`;
};

export const formatReference = (value) => (value ? String(value) : '-');

export const formatSizeLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/[-\s]+/g, '_').toLowerCase();
  const presets = {
    half_day_small: 'Half Day - Small',
    half_day_medium: 'Half Day - Medium',
    half_day_large: 'Half Day - Large',
    half_day_xlarge: 'Half Day - XLarge',
    half_day_xxlarge: 'Half Day - XXLarge',
    full_day_small: 'Full Day - Small',
    full_day_medium: 'Full Day - Medium',
    full_day_large: 'Full Day - Large',
    full_day_xlarge: 'Full Day - XLarge',
    full_day_xxlarge: 'Full Day - XXLarge',
    hourly_small: 'Hourly - Small',
    hourly_medium: 'Hourly - Medium',
    hourly_large: 'Hourly - Large',
    hourly_xlarge: 'Hourly - XLarge',
    hourly_xxlarge: 'Hourly - XXLarge',
  };

  if (presets[normalized]) return presets[normalized];

  const text = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
};

const safeDate = (value) => {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeTimePart = (time) => {
  const text = String(time || '').trim();
  if (!text) return '';
  const [h = '00', m = '00'] = text.split(':');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

const makeCheckInDate = (appointmentDate, startTime, createdAt) => {
  const datePart = String(appointmentDate || '').slice(0, 10);
  const timePart = normalizeTimePart(startTime);
  const hasMeaningfulTime = timePart && !/^00:00:00$/i.test(timePart);
  if (datePart && hasMeaningfulTime) {
    const withStartTime = safeDate(`${datePart}T${timePart}`);
    if (withStartTime) return withStartTime;
  }
  if (datePart) {
    // Default hotel check-in to opening hour when time was not captured.
    const fallback = safeDate(`${datePart}T09:00:00`);
    if (fallback) return fallback;
  }
  return safeDate(createdAt);
};

export const formatDateTimeLabel = (value) => {
  const d = safeDate(value);
  if (!d) return '-';
  return d.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatHotelCheckInLabel = ({ appointmentDate, startTime, createdAt }) =>
  formatDateTimeLabel(makeCheckInDate(appointmentDate, startTime, createdAt));

export const formatHotelCheckOutLabel = ({ appointmentDate, startTime, createdAt, hotelNights }) => {
  const checkIn = makeCheckInDate(appointmentDate, startTime, createdAt);
  if (!checkIn) return '-';
  const nights = Math.max(1, Number(hotelNights || 1));
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + nights);
  return formatDateTimeLabel(checkOut);
};
