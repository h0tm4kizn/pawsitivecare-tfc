import { Camera, ChevronDown, ScanLine, Search, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function InventoryToolbar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories = [],
  onScanSearch,
  onPhoneSearch,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);

  const options = [
    { value: '', label: 'All Categories' },
    ...categories.map((row) => ({ value: row.category, label: `${row.category} (${row.total})` })),
  ];
  const selected = options.find((o) => o.value === category) || options[0];
  const isMobileOrTablet =
    typeof navigator !== 'undefined' &&
    (/android|ipad|iphone|ipod|mobile|tablet/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches));

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-brand-teal/30 bg-white px-3 py-2.5 focus-within:border-brand-teal">
        <Search size={14} className="shrink-0 text-brand-dark-soft/60" />
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search supplies or barcode..."
          className="min-w-0 flex-1 bg-transparent text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => searchInputRef.current?.focus()}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10"
          title="Focus search for hardware scanner"
        >
          <ScanLine size={13} strokeWidth={2.5} />
          Scan
        </button>
        <button
          type="button"
          onClick={onScanSearch}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10"
          title="Scan with camera"
        >
          <Camera size={13} strokeWidth={2.5} />
          Camera
        </button>
        {!isMobileOrTablet && (
          <button
            type="button"
            onClick={onPhoneSearch}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10"
            title="Scan with phone"
          >
            <Smartphone size={13} strokeWidth={2.5} />
            Phone
          </button>
        )}
      </div>

      <div ref={rootRef} className="relative w-[220px] shrink-0">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
            open || category
              ? 'border-brand-teal bg-brand-teal text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)]'
              : 'border-brand-teal/30 bg-white text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)] hover:border-brand-teal hover:bg-brand-teal/5'
          }`}
        >
          <span className="truncate text-left">{selected.label}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="ui-dropdown-menu absolute left-0 top-full z-20 mt-1 w-full py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => { onCategoryChange(option.value); setOpen(false); }}
                className={`ui-dropdown-item ${category === option.value ? 'ui-dropdown-item-active' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

