export default function StatusBadge({ active, status, variant = 'default' }) {
  const isActive = active != null
    ? Boolean(active)
    : String(status || '').toLowerCase() === 'active';

  const inactiveLabel  = variant === 'customer' ? 'DEACTIVATED' : 'INACTIVE';
  const inactiveBg     = variant === 'customer' ? 'bg-brand-orange/10 text-brand-orange' : 'bg-red-100 text-red-500';
  const inactiveDot    = variant === 'customer' ? 'bg-brand-orange' : 'bg-red-400';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
      isActive ? 'bg-brand-teal/15 text-brand-teal-dark' : inactiveBg
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-brand-teal' : inactiveDot}`} />
      {isActive ? 'ACTIVE' : inactiveLabel}
    </span>
  );
}
