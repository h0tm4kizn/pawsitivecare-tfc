export default function AdminBookingValidationBox({
  open,
  title = 'Complete Appointment Details',
  message = '',
  actionLabel = 'Continue Booking',
  onContinue,
  onExit,
}) {
  if (!open || !message) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-dark/40 px-4 backdrop-blur-md" role="presentation">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-booking-validation-title"
        aria-describedby="admin-booking-validation-message"
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl"
      >
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <i className="fa-solid fa-circle-exclamation text-base" />
            </span>
            <div className="min-w-0">
              <h2 id="admin-booking-validation-title" className="text-sm font-extrabold text-brand-dark">{title}</h2>
              <p id="admin-booking-validation-message" className="mt-2 text-sm leading-relaxed text-brand-dark-soft">{message}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
          <button type="button" onClick={onExit} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-brand-dark-light bg-white px-4 py-2.5 text-xs font-semibold text-brand-dark transition hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:ring-offset-2">
            Exit
          </button>
          <button type="button" onClick={onContinue} autoFocus className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98]">
            {actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
