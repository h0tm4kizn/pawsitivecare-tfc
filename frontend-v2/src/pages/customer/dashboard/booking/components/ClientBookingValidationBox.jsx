export default function ClientBookingValidationBox({
  open,
  title = 'Please Check Your Booking',
  message = '',
  onBack,
  onExit,
  primaryLabel = 'Back to Pets',
}) {
  if (!open || !message) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-dark/45 px-4 backdrop-blur-sm"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="client-booking-validation-title"
        aria-describedby="client-booking-validation-message"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-brand-teal/25 bg-white shadow-2xl sm:max-w-md"
      >
        <div className="border-b border-brand-teal/15 bg-gradient-to-r from-brand-teal-light/70 to-white px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
              <i className="fa-solid fa-paw text-base" />
            </span>
            <div className="min-w-0">
              <h2 id="client-booking-validation-title" className="text-sm font-extrabold text-brand-dark">{title}</h2>
              <p id="client-booking-validation-message" className="mt-2 text-sm leading-relaxed text-brand-dark-soft">{message}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <button type="button" onClick={onExit} className="rounded-xl border border-brand-dark-light bg-white px-4 py-2.5 text-xs font-bold text-brand-dark transition hover:bg-brand-surface">
            Exit
          </button>
          <button type="button" onClick={onBack} autoFocus className="rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brand-teal-dark">
            {primaryLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
