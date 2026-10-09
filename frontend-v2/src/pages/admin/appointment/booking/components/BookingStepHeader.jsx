import { Check, X } from 'lucide-react';

export default function BookingStepHeader({ bookingStep, walkInMode, onClose }) {
  return (
    <>
      <div className="flex items-center justify-between rounded-t-2xl bg-brand-teal px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h2 className="text-sm font-extrabold text-white sm:text-base">
            {walkInMode ? 'Walk-In Service' : 'Schedule an Appointment'}
          </h2>
          {walkInMode && <p className="mt-0.5 text-[10px] font-semibold text-white/80">Create a service booking for a customer arriving now.</p>}
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 lg:hidden" aria-label="Close book appointment modal">
          <X size={16} strokeWidth={2.8} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 border-b border-brand-dark-light bg-white px-4 py-2.5 sm:px-6">
        {['Owner & Pet', 'Service', 'Schedule'].map((label, index) => {
          const isActive = bookingStep === index;
          const isDone = bookingStep > index;
          return (
            <div key={label} className="flex min-w-0 items-center gap-2">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isActive || isDone ? 'bg-brand-teal text-white' : 'bg-brand-dark-light text-brand-dark-soft'}`}>
                {isDone ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : index + 1}
              </span>
              <span className={`truncate text-[11px] font-bold ${isActive ? 'text-brand-dark' : 'hidden text-brand-dark-soft sm:inline'}`}>{label}</span>
              {index < 2 && <span className="h-px w-5 bg-brand-dark-light sm:w-8" />}
            </div>
          );
        })}
      </div>
    </>
  );
}
