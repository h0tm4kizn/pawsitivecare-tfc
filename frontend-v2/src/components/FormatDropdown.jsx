import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

export default function FormatDropdown({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);

  const positionMenu = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = 78;
    const opensUp = rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight;
    setMenuPosition({
      left: Math.max(8, rect.right - 96),
      ...(opensUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  };

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-full min-h-10 items-center gap-1 rounded-r-xl border-l border-white/30 bg-brand-teal px-2.5 text-[10px] font-extrabold uppercase tracking-wide text-white transition hover:bg-brand-teal-dark">
        {value}<ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && menuPosition && createPortal(
        <div ref={menuRef} role="listbox" aria-label={label}
          style={{ position: 'fixed', ...menuPosition }}
          className="z-[300] min-w-24 overflow-hidden rounded-xl border border-brand-teal/20 bg-white p-1 shadow-xl">
          {['json', 'csv'].map((option) => (
            <button key={option} type="button" role="option" aria-selected={value === option}
              onClick={() => { onChange(option); setOpen(false); }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-[11px] font-bold uppercase transition ${value === option ? 'bg-brand-teal text-white' : 'text-brand-dark hover:bg-brand-teal/10'}`}>
              {option}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
