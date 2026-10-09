/* eslint-disable react-refresh/only-export-components */
export const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  return `PHP ${numeric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const PhpAmount = ({ value, className = '', prefixClassName = 'text-[0.78em] text-brand-dark-soft', amountClassName = 'text-brand-dark' }) => {
  const numeric = Number(value || 0);
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`.trim()}>
      <span className={`font-semibold uppercase tracking-wide ${prefixClassName}`.trim()}>PHP</span>
      <span className={`font-bold ${amountClassName}`.trim()}>{numeric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </span>
  );
};

export const formatStock = (value) => {
  if (value === null || value === undefined || value === '') return 'No stock set';
  return Number(value).toLocaleString('en-PH');
};

export const isZeroStock = (value) => value !== null && value !== undefined && value !== '' && Number(value) <= 0;

export const getNearestExpiryBatch = (item) => {
  const batches = Array.isArray(item?.batches) ? item.batches : [];
  return batches
    .filter((batch) => batch?.expiration_date && Number(batch?.quantity_available || 0) > 0)
    .sort((a, b) => String(a.expiration_date).localeCompare(String(b.expiration_date)))[0] || null;
};

export const formatInventoryDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const stockTone = (value) => {
  if (value === null || value === undefined || Number(value) <= 0) return 'bg-red-100 text-red-700 border-red-300';
  if (Number(value) <= 5) return 'bg-brand-teal-soft text-brand-teal-dark border-brand-teal/30';
  return 'bg-brand-teal-soft text-brand-teal-dark border-brand-teal/30';
};
