import { useState } from 'react';

export default function ReportsTableFilterSort({ children, panelClassName = 'w-[min(100%,420px)] sm:grid-cols-2' }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex justify-end">
      <button type="button" onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${open ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-teal/25 bg-white text-brand-teal hover:bg-brand-teal/10'}`}>
        <i className="fa-solid fa-filter text-[11px]" />
        Filter &amp; Sort
      </button>
      {open && (
        <div className={`absolute right-0 top-[calc(100%+0.5rem)] z-20 grid grid-cols-1 gap-3 rounded-xl border border-brand-teal/20 bg-white p-4 shadow-xl ${panelClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}
