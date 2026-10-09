import { useMemo, useState } from 'react';
import { toIso } from '../../../../../utils/dateUtils';

export default function BookingDatePicker({ value, minDate, fullyBooked = false, locked = false, onChange }) {
  const [month, setMonth] = useState(() => { const d = new Date(`${value || minDate}T00:00:00`); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const days = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), [month]);
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const currentStart = new Date(new Date(`${minDate}T00:00:00`).getFullYear(), new Date(`${minDate}T00:00:00`).getMonth(), 1);
  const canPrev = month.getTime() > currentStart.getTime();
  const canNext = month.getTime() < new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1).getTime();
  return <div className="rounded-lg border border-brand-dark-light bg-white p-3">
    <div className="mb-3 flex items-center justify-between"><button type="button" disabled={locked || !canPrev} className="w-6 text-lg disabled:opacity-20" onClick={() => !locked && canPrev && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><span className="text-sm font-bold">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span><button type="button" disabled={locked || !canNext} className="w-6 text-lg disabled:opacity-20" onClick={() => !locked && canNext && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-brand-dark-soft">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">{Array.from({ length: offset + days }, (_, i) => { if (i < offset) return <span key={`e${i}`} />; const day = i - offset + 1; const iso = toIso(new Date(month.getFullYear(), month.getMonth(), day)); const disabled = locked || iso < minDate; return <button key={iso} type="button" disabled={disabled} onClick={() => !locked && onChange(iso)} className={`h-9 rounded-md text-xs font-semibold ${value === iso ? (fullyBooked ? 'bg-green-500 text-white' : 'bg-brand-teal text-white') : disabled ? 'bg-gray-50 text-gray-300' : 'bg-brand-teal-light text-brand-dark hover:bg-brand-teal/20'}`}>{day}</button>; })}</div>
    <div className="mt-3 flex items-center gap-4 text-[10px] font-semibold text-brand-dark-soft"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />Already full</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-teal" />Available</span></div>
  </div>;
}
