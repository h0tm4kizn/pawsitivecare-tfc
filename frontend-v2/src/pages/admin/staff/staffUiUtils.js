import { staffTypeLabel } from '../../../utils/staffTypes';

export const staffLabel = staffTypeLabel;

export const formatStaffId = (staff, index) => {
  const explicitId = String(staff?._formattedStaffId || staff?.display_id || staff?.staff_id || staff?.employee_id || '').trim();
  if (explicitId) return explicitId.toUpperCase();
  return `S${String(index + 1).padStart(3, '0')}`;
};

export const generateStaffPassword = () => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `Paws@${randomPart}26`;
};

export const phoneRegex = /^(09|\+639)\d{9}$/;

export const cleanPhone = (v) => String(v || '').replace(/[-\s]/g, '');

export const formatPhoneInput = (value) => {
  const raw = String(value || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (raw.startsWith('+')) return raw.slice(0, 13);
  return raw.replace(/\D/g, '').slice(0, 11);
};

export const formatStaffDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
