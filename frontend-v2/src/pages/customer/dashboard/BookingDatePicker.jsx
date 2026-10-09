import { useEffect, useMemo, useState } from 'react';
import { toIso } from '../../../utils/dateUtils';

export default function BookingDatePicker({ value, minDate, maxDate, fullyBooked = false, onChange }) {
  const getMonth = (date) => {
    const parsed = new Date(`${date}T00:00:00`);
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  };
  const [month, setMonth] = useState(() => getMonth(value || minDate));

  useEffect(() => {
    if (value) setMonth(getMonth(value));
  }, [value]);

  const days = useMemo(
    () => new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    [month],
  );
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const minMonth = getMonth(minDate);
  const maxMonth = getMonth(maxDate);
  const canPrev = month.getTime() > minMonth.getTime();
  const canNext = month.getTime() < maxMonth.getTime();

  return (
    <div className="rounded-lg border border-brand-dark-light bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrev}
          aria-label="Previous month"
          className="w-6 text-lg text-brand-dark disabled:opacity-20"
          onClick={() => canPrev && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >‹</button>
        <span className="text-sm font-bold text-brand-dark">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          disabled={!canNext}
          aria-label="Next month"
          className="w-6 text-lg text-brand-dark disabled:opacity-20"
          onClick={() => canNext && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-brand-dark-soft">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset + days }, (_, index) => {
          if (index < offset) return <span key={`empty-${index}`} />;
          const day = index - offset + 1;
          const iso = toIso(new Date(month.getFullYear(), month.getMonth(), day));
          const disabled = iso < minDate || iso > maxDate;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={`h-9 rounded-md text-xs font-semibold transition-colors ${
                value === iso
                  ? (fullyBooked ? 'bg-green-500 text-white' : 'bg-brand-teal text-white')
                  : disabled
                    ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                    : 'bg-brand-teal-light text-brand-dark hover:bg-brand-teal/20'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[10px] font-semibold text-brand-dark-soft">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />Already full</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-teal" />Available</span>
      </div>
    </div>
  );
}
