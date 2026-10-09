import { formatCustomerAppointmentReason } from '../../../../utils/recordFormatters';

/* Utility exports are intentionally colocated for the appointment feature. */
/* eslint react-refresh/only-export-components: off */

export const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

export const toIso = (d) => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, '0'),
  String(d.getDate()).padStart(2, '0'),
].join('-');

export const isSame = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

export const fmtDate = (d) => {
  if (!d) return '—';
  const [year, month, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour   = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' });
};

export const withinCancelWindow = (apt) => {
  if (!apt.appointment_date || !apt.start_time) return false;

  const appointmentDateTime = new Date(`${apt.appointment_date}T${apt.start_time}`);
  const twoHoursFromNow = new Date(new Date().getTime() + 2 * 60 * 60 * 1000);

  return twoHoursFromNow < appointmentDateTime;
};

export const isPastAppointment = (apt) => {
  if (!apt.appointment_date || !apt.start_time) return false;
  const appointmentDateTime = new Date(`${apt.appointment_date}T${apt.start_time}`);
  return appointmentDateTime < new Date();
};

export const categoryTitle = (apt) => {
  const cat = String(apt.service?.category || '').toLowerCase();
  if (cat.includes('groom')) return 'Pet Grooming';
  if (cat.includes('hotel')) return 'Pet Hotel';
  if (cat.includes('daycare')) return 'Pet Daycare';
  return apt.service?.name || '—';
};

export const getHandledByName = (apt) =>
  String(apt?.handled_by_name || apt?.handled_by?.name || apt?.handledBy?.name || apt?.staff?.name || '').trim() || 'Not Assigned';

export const categoryIconBg = (apt) => {
  const cat = String(apt?.service?.category || '').toLowerCase();
  if (cat.includes('daycare')) return 'bg-brand-daycare/10 text-brand-daycare';
  if (cat.includes('hotel'))   return 'bg-brand-hotel/10 text-brand-hotel';
  return 'bg-brand-grooming/10 text-brand-grooming';
};

export const STATUS_META = {
  pending:     { label: 'Pending Approval', cls: 'bg-yellow-100 text-yellow-700'   },
  approved:   { label: 'Approved',        cls: 'bg-blue-100 text-blue-800'       },
  in_progress: { label: 'In Progress',      cls: 'bg-amber-100 text-amber-700'    },
  completed:   { label: 'Completed',        cls: 'bg-emerald-50 text-emerald-700' },
  rejected:    { label: 'Rejected',         cls: 'bg-red-50 text-red-600'         },
  cancelled:   { label: 'Cancelled',        cls: 'bg-red-50 text-red-600'         },
  no_show:     { label: 'No Show',          cls: 'bg-rose-50 text-rose-700'       },
};

export const isRejected = (apt) =>
  String(apt?.cancellation_type || '').toLowerCase() === 'staff_rejection'
  || String(apt?.cancellation_reason || '').startsWith('[REJECTED]');
export const getRejectionReason = (apt) => formatCustomerAppointmentReason(apt?.cancellation_reason);

export const getCancellationTypeLabel = (apt) => {
  const type = String(apt?.cancellation_type || '').toLowerCase();
  if (type === 'late' || String(apt?.cancellation_reason || '').startsWith('[LATE CANCELLATION]')) return 'Late Cancellation';
  if (type === 'normal') return 'Cancellation';
  return null;
};

export const statusMeta = (apt) => {
  const s = typeof apt === 'string' ? apt : apt?.status;
  const normalized = String(s || '').toLowerCase();
  if (normalized === 'cancelled') {
    if (typeof apt !== 'string' && isRejected(apt)) {
      return { label: 'Rejected', cls: 'bg-red-50 text-red-600' };
    }
    return { label: 'Cancelled', cls: 'bg-red-50 text-red-600' };
  }
  return STATUS_META[normalized] || { label: 'Appointment Update', cls: 'bg-gray-100 text-gray-500' };
};
