const HOURS = Array.from({ length: 9 }, (_, index) => String(index + 9).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

export default function HotelCheckInTimePicker({ value = '', onChange, disabled = false }) {
  const [hour = '', minute = ''] = String(value).slice(0, 5).split(':');
  const minuteOptions = hour === '17' ? ['00'] : MINUTES;
  const selectClass = 'min-w-0 flex-1 rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm font-semibold text-brand-dark outline-none focus:border-brand-teal disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="flex max-w-xs items-center gap-2" role="group" aria-label="Hotel check-in time, 09:00 to 17:00">
      <select
        aria-label="Check-in hour"
        value={hour}
        disabled={disabled}
        onChange={(event) => {
          const nextHour = event.target.value;
          onChange(nextHour ? `${nextHour}:${nextHour === '17' ? '00' : (minute || '00')}` : '');
        }}
        className={selectClass}
      >
        <option value="">HH</option>
        {hour && !HOURS.includes(hour) && <option value={hour} disabled>{hour} (current)</option>}
        {HOURS.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <span className="text-sm font-bold text-brand-dark">:</span>
      <select
        aria-label="Check-in minute"
        value={minute}
        disabled={disabled || !hour}
        onChange={(event) => onChange(`${hour}:${event.target.value}`)}
        className={selectClass}
      >
        <option value="">MM</option>
        {minute && !minuteOptions.includes(minute) && <option value={minute} disabled>{minute} (current)</option>}
        {minuteOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
