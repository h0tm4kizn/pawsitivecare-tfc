export default function AppointmentInfoField({ label, value, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold text-brand-dark-soft">{label}</p>
      <div className="mt-1 break-words text-xs font-semibold leading-relaxed text-brand-dark">{value || '-'}</div>
    </div>
  );
}
