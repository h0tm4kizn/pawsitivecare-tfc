import { formatSizeLabel } from '../../../utils/recordFormatters';

// ── Date helpers ──────────────────────────────────────────────────────────────

export const toIso = (d) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const diffDays = (start, end) => {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

export const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
};

export const normalizeDate = (value) => String(value || '').slice(0, 10);

export const toMonthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

// ── Appointment field extractors ──────────────────────────────────────────────

const getPetName   = (item) => item?.pet?.name || item?.pet_name || item?.pet || '—';

const getOwnerName = (item) => {
  const o = item?.owner || item?.pet?.owner;
  if (!o) return '—';
  return `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.name || '—';
};

const getServiceName = (item) => {
  const category = String(item?.service?.category || item?.category || '').toLowerCase();
  const rawBaseService = item?.service?.name || item?.service_name || item?.service || '—';
  const baseService = String(rawBaseService).replace(/\s*\([^)]*\)\s*$/, '').trim();
  const suiteName = item?.hotel_suite?.name || item?.hotelSuite?.name || item?.suite?.name || '';
  const sizeLabel = formatSizeLabel(item?.size_label || '');

  if (category.includes('hotel') && suiteName) {
    return suiteName;
  }

  if ((category.includes('groom') || category.includes('day')) && sizeLabel) {
    return `${baseService} (${sizeLabel})`;
  }

  return baseService;
};
const isUuidLike = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
const currentYY = () => String(new Date().getFullYear()).slice(-2);
const getServiceTemplateId = (item) => {
  const category = String(item?.service?.category || item?.category || '').toLowerCase();
  const yy = currentYY();
  if (category.includes('groom')) return `GPKG${yy}00`;
  if (category.includes('hotel')) return `HPKG${yy}00`;
  if (category.includes('day')) return `DCPKG${yy}00`;
  return '-';
};
const getServiceDisplayId = (item) =>
{
  const category = String(item?.service?.category || item?.category || '').toLowerCase();
  const sizeLabel = String(item?.size_label || '').trim().toUpperCase();
  const candidates = [
    item?.service_display_id,
    item?.service?.display_id,
    item?.service_id_display,
    item?.service_code,
    item?.service?.package_code,
    item?.service?.display_code,
    item?.service?.service_code,
  ];
  const selected = candidates.find((value) => {
    const text = String(value || '').trim();
    return text && !isUuidLike(text);
  });
  const baseCode = selected || getServiceTemplateId(item);
  if ((category.includes('groom') || category.includes('day')) && sizeLabel) {
    return `${baseCode}-${sizeLabel}`;
  }
  return baseCode;
};

const getServiceCategory = (item) => item?.service?.category || item?.category || '';

const formatServiceCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('hotel')) return 'Hotel';
  if (normalized.includes('day')) return 'Daycare';
  if (normalized.includes('groom')) return 'Grooming';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getApptDate = (item) => {
  const raw = item?.appointment_date || item?.date || '';
  if (!raw) return '';
  const iso = String(raw).slice(0, 10); // strip any timestamp/timezone suffix
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' });
};

const getApptTime = (item) => {
  const t = item?.start_time || item?.time || '';
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

// Sequential display number — use created_at order index, fallback to short uuid
let _apptSeq = 0;
const apptSeqMap = new Map();
const getSeqId = (id) => {
  if (!apptSeqMap.has(id)) apptSeqMap.set(id, ++_apptSeq);
  return `#${String(apptSeqMap.get(id)).padStart(3, '0')}`;
};

const getServiceType = (item) => {
  const raw = `${getServiceName(item)} ${item?.service?.category || item?.category || ''}`.toLowerCase();
  if ((item?.status || '').toLowerCase() === 'completed')    return 'completed';
  if ((item?.status || '').toLowerCase().includes('cancel')) return 'cancelled';
  if ((item?.status || '').toLowerCase().replace(/-/g, '_') === 'no_show') return 'cancelled';
  if ((item?.status || '').toLowerCase() === 'in_progress')  return 'in_progress';
  if (raw.includes('groom'))                                  return 'grooming';
  if (raw.includes('hotel') || raw.includes('suite'))         return 'hotelsuite';
  if (raw.includes('day'))                                    return 'daycare';
  return 'other';
};

const getStatusColor = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return '#14964c';
  if (normalized === 'cancelled') return '#ef4444';
  if (normalized === 'no_show') return '#ef4444';
  if (normalized === 'in_progress') return '#f59e0b';
  if (normalized === 'approved') return '#173551';
  return '#94a3b8';
};

export const normalizeAppt = (item) => ({
  _raw:        item,
  id:          item?.id || '—',
  appointment_code: item?.appointment_code || '',
  displayId:   item?.appointment_code || getSeqId(item?.id || Math.random()),
  pet:         getPetName(item),
  owner:       getOwnerName(item),
  service:     getServiceName(item),
  serviceDisplayId: getServiceDisplayId(item),
  serviceCategory: getServiceCategory(item),
  serviceCategoryLabel: formatServiceCategory(getServiceCategory(item)),
  dateIso:     String(item?.appointment_date || item?.date || '').slice(0, 10),
  date:        getApptDate(item),
  time:        getApptTime(item),
  status:      item?.status || 'approved',
  serviceType: getServiceType(item),
});

// ── Constants ─────────────────────────────────────────────────────────────────

export const LEGEND = [
  { label: 'Daycare',     color: '#9333ea' },
  { label: 'Grooming',    color: '#1e40af' },
  { label: 'Hotel',       color: '#ec4899' },
  { label: 'Approved',   color: '#173551' },
  { label: 'In Progress', color: '#f59e0b' },
  { label: 'Completed',   color: '#14964c' },
  { label: 'Cancelled',   color: '#ef4444' },
];

export const LEGEND_KEY_MAP = {
  daycare:     'Daycare',
  grooming:    'Grooming',
  hotelsuite:  'Hotel',
  approved:   'Approved',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

export const getLegendColor = (serviceType) => {
  const label = LEGEND_KEY_MAP[serviceType];
  return LEGEND.find((l) => l.label === label)?.color || '#94a3b8';
};

export { getStatusColor };

// ── localStorage helpers ──────────────────────────────────────────────────────

export const loadLS = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};

export const saveLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));
