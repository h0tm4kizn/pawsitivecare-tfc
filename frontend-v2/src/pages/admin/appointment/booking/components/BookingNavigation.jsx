import { ArrowLeft } from 'lucide-react';

export default function BookingNavigation({
  bookingStep,
  hasDaycareCategory,
  draftDaycarePetIds,
  isSaving,
  onClose,
  onBackFromService,
  onContinueFromOwnerAndPet,
  onContinueFromService,
  onBackToService,
  onSubmit,
}) {
  const continueOwnerLabel = hasDaycareCategory
    ? `Continue with ${draftDaycarePetIds.length} Pet${draftDaycarePetIds.length === 1 ? '' : 's'}`
    : 'Continue to Service';

  return (
    <>
      <div className={`hidden shrink-0 rounded-b-2xl border-t border-brand-dark-light bg-white px-5 py-3 lg:flex ${bookingStep > 0 ? 'items-center justify-between' : 'justify-end'}`}>
        {bookingStep === 1 && (
          <button type="button" onClick={onBackFromService} className="inline-flex items-center gap-2 rounded-xl border border-brand-dark-light px-4 py-2.5 text-xs font-bold text-brand-dark transition hover:bg-brand-surface">
            <ArrowLeft size={14} strokeWidth={2.5} />
            Back
          </button>
        )}
        <button
          className={`${bookingStep === 2 ? 'hidden' : ''} rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-bold text-white transition hover:bg-brand-teal-dark`}
          type="button"
          onClick={bookingStep === 0 ? onContinueFromOwnerAndPet : onContinueFromService}
        >
          {bookingStep === 0 ? continueOwnerLabel : 'Continue to Schedule'}
        </button>
        {bookingStep === 2 && (
          <>
            <button type="button" onClick={onBackToService} className="inline-flex items-center gap-2 rounded-xl border border-brand-dark-light px-4 py-2.5 text-xs font-bold text-brand-dark transition hover:bg-brand-surface">
              <ArrowLeft size={14} strokeWidth={2.5} />
              Back to Service
            </button>
            <button type="button" disabled={isSaving} onClick={onSubmit} className="min-w-[150px] whitespace-nowrap rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-bold text-white transition hover:bg-brand-teal-dark disabled:opacity-60">
              {isSaving ? 'Saving...' : 'Complete Booking'}
            </button>
          </>
        )}
      </div>

      <div className="rounded-b-2xl border-t border-brand-dark-light bg-white px-4 py-3 sm:px-5 sm:py-4 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="min-h-10 flex-1 rounded-xl border border-brand-dark-light px-4 py-2 text-xs font-bold text-brand-dark hover:bg-brand-surface sm:flex-none">
            Close
          </button>
          {bookingStep === 0 && (
            <button type="button" onClick={onContinueFromOwnerAndPet} className="min-h-10 flex-1 rounded-xl bg-brand-teal px-5 py-2 text-xs font-bold text-white hover:bg-brand-teal-dark sm:flex-none">
              {continueOwnerLabel}
            </button>
          )}
          {bookingStep === 1 && (
            <>
              <button type="button" onClick={onBackFromService} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-dark-light px-4 py-2 text-xs font-bold text-brand-dark hover:bg-brand-surface sm:flex-none">
                <ArrowLeft size={14} strokeWidth={2.5} />
                Back
              </button>
              <button type="button" onClick={onContinueFromService} className="min-h-10 flex-1 rounded-xl bg-brand-teal px-5 py-2 text-xs font-bold text-white hover:bg-brand-teal-dark sm:flex-none">
                Continue to Schedule
              </button>
            </>
          )}
          {bookingStep === 2 && (
            <>
              <button type="button" onClick={onBackToService} className="min-h-10 flex-1 rounded-xl border border-brand-teal/35 px-4 py-2 text-xs font-bold text-brand-teal hover:bg-brand-teal hover:text-white sm:flex-none">
                Back to Service
              </button>
              <button type="button" disabled={isSaving} onClick={onSubmit} className="min-h-10 min-w-[150px] flex-1 whitespace-nowrap rounded-xl bg-brand-teal px-5 py-2 text-xs font-bold text-white hover:bg-brand-teal-dark disabled:opacity-60 sm:flex-none">
                {isSaving ? 'Saving...' : 'Complete Booking'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
