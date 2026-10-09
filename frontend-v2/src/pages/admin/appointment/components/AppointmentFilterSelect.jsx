import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function AppointmentFilterSelect({ value, onChange, options = [], widthClass = 'min-w-[150px]', compact = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div ref={rootRef} className={`relative ${widthClass}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex w-full items-center justify-between gap-2 whitespace-nowrap border px-4 transition ${
          open
            ? `border-brand-teal bg-brand-teal text-white ${compact ? '' : 'shadow-[0_4px_10px_rgba(36,119,122,0.25)]'}`
            : `border-brand-teal/30 bg-white text-brand-dark hover:border-brand-teal hover:bg-brand-teal/5 ${compact ? '' : 'shadow-[0_2px_8px_rgba(23,53,81,0.08)]'}`
        } ${compact ? 'rounded-lg px-3 py-1.5 text-xs font-semibold' : 'rounded-2xl px-4 py-2.5 text-sm font-semibold'}`}
      >
        <span className="truncate text-left">{selected?.label || '-'}</span>
        <ChevronDown size={compact ? 14 : 15} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`${compact ? 'absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-brand-teal/20 bg-white py-1' : 'ui-dropdown-menu absolute left-0 top-full z-20 mt-1 w-full py-1'}`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`ui-dropdown-item font-semibold ${value === option.value ? 'ui-dropdown-item-active' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

