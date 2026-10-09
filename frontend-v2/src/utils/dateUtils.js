export const fmtTimeAgo = (iso) => {
  if (!iso) return '';
  const d       = new Date(iso);
  const diffMs  = new Date() - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric' });
};

export const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila', 
    month: 'long', day: 'numeric', year: 'numeric',
  });
};

export const fmtTime12 = (t) => {
  if (!t) return '';
  const parts = String(t).split(':');
  const hour  = parseInt(parts[0], 10);
  const min   = parts[1] || '00';
  return `${hour % 12 || 12}:${min} ${hour >= 12 ? 'P.M.' : 'A.M.'}`;
};

export const calcAge = (dob) => {
  if (!dob) return '—';
  const birth = new Date(String(dob).slice(0, 10) + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalMonths =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth()    - birth.getMonth());
  if (totalMonths < 1)  return 'Under 1 month';
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  const years  = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0
    ? `${years} yr${years !== 1 ? 's' : ''} ${months} mo`
    : `${years} yr${years !== 1 ? 's' : ''}`;
};

export const toIso = (d) => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, '0'),
  String(d.getDate()).padStart(2, '0'),
].join('-');

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

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

export const normalizeDate = (value) => String(value || '').slice(0, 10);

