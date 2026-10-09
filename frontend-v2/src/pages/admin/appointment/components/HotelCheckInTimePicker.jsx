import {
  hotelCheckInTimeError,
  hotelTimeInputFromValue,
  hotelTimeValueFromInput,
} from '../../../../utils/hotelCheckInTime';

export default function HotelCheckInTimePicker({
  value = '',
  draft,
  date,
  operatingHours,
  onChange,
  onDraftChange,
  disabled = false,
}) {
  const input = draft || hotelTimeInputFromValue(value);
  const error = hotelCheckInTimeError(input, operatingHours, date);
  const inputClass = 'h-11 w-full min-w-0 rounded-lg border border-brand-dark-light bg-white px-1 text-center text-base font-bold text-brand-dark outline-none placeholder:text-sm placeholder:font-medium placeholder:text-gray-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/10 disabled:cursor-not-allowed disabled:opacity-60';

  const updateInput = (next) => {
    onDraftChange?.(next);
    const nextError = hotelCheckInTimeError(next, operatingHours, date);
    if (!nextError) onChange?.(hotelTimeValueFromInput(next));
  };

  return (
    <div>
      <div
        className="grid w-fit max-w-full grid-cols-[minmax(0,80px)_auto_minmax(0,80px)_minmax(0,115px)] items-center gap-1.5"
        role="group"
        aria-label="Hotel check-in time"
      >
        <input
          aria-label="Check-in hour"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          placeholder="HH"
          value={input.hour}
          disabled={disabled}
          onChange={(event) => updateInput({ ...input, hour: event.target.value.replace(/\D/g, '').slice(0, 2) })}
          className={inputClass}
        />
        <span className="text-base font-bold text-brand-dark">:</span>
        <input
          aria-label="Check-in minute"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          placeholder="MM"
          value={input.minute}
          disabled={disabled}
          onChange={(event) => updateInput({ ...input, minute: event.target.value.replace(/\D/g, '').slice(0, 2) })}
          className={inputClass}
        />
        <div className="flex h-11 min-w-0 overflow-hidden rounded-lg border border-brand-dark-light" role="group" aria-label="AM or PM">
          {['AM', 'PM'].map((period) => (
            <button
              key={period}
              type="button"
              aria-pressed={input.period === period}
              disabled={disabled}
              onClick={() => updateInput({ ...input, period })}
              className={`min-w-0 flex-1 px-1 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                input.period === period ? 'bg-brand-teal text-white' : 'bg-white text-brand-dark-soft hover:bg-brand-teal/10'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-[11px] font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
