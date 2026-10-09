export default function BookingStepIndicator({ label, index, step }) {
  const active = index === step;
  const done = index < step;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
          done || active ? 'bg-brand-teal text-white' : 'bg-brand-dark-light text-brand-dark-soft'
        }`}
      >
        {done ? '✓' : index + 1}
      </span>
      <span className={`text-[11px] font-semibold ${active ? 'text-brand-dark' : 'hidden text-brand-dark-soft sm:inline'}`}>
        {label}
      </span>
    </div>
  );
}
