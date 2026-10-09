export default function BookingFormSection({ title, subtitle, children, disabled = false }) {
  return (
    <section className={`rounded-xl border bg-white shadow-sm ${disabled ? 'border-dashed border-brand-dark-light' : 'border-brand-dark-light'}`}>
      <div className={`flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 ${disabled ? '' : 'border-b border-brand-dark-light'}`}>
        <div className="min-w-0">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-dark">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-brand-dark-soft">{subtitle}</p>}
        </div>
        {disabled && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Locked</span>}
      </div>
      {!disabled && <div className="px-3 py-3 sm:px-4">{children}</div>}
    </section>
  );
}
