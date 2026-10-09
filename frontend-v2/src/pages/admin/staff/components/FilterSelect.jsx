import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function FilterSelect({ value, onChange, options = [], widthClass = 'min-w-[170px]' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${widthClass}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
          open
            ? 'border-brand-teal bg-brand-teal text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)]'
            : 'border-brand-teal/30 bg-white text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)] hover:border-brand-teal hover:bg-brand-teal/5'
        }`}
      >
        <span className="truncate text-left">{selected?.label || '-'}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="ui-dropdown-menu absolute left-0 top-full z-20 mt-1 w-full py-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`ui-dropdown-item ${value === option.value ? 'ui-dropdown-item-active' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

