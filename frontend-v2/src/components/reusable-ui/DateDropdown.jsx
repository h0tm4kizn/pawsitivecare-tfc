import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const pad = (value) => String(value).padStart(2, '0');
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDate = (value) => {
  const date = fromIso(value);
  return date
    ? date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : '';
};

export default function DateDropdown({
  value = '',
  onChange,
  min = '',
  max = '',
  disabled = false,
  hasError = false,
  placeholder = 'Select date',
  className = '',
  buttonClassName = '',
}) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = fromIso(value) || fromIso(min) || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [menuStyle, setMenuStyle] = useState(null);
  const selectedDate = fromIso(value);
  const minDate = fromIso(min);
  const maxDate = fromIso(max);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      const insideTrigger = rootRef.current?.contains(event.target);
      const insideMenu = menuRef.current?.contains(event.target);
      if (!insideTrigger && !insideMenu) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const updatePosition = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(Math.max(rect.width, 260), viewportWidth - (viewportPadding * 2));
      const maxLeft = Math.max(viewportPadding, viewportWidth - width - viewportPadding);
      const menuHeight = 350;
      const openUp = rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight;
      setMenuStyle({
        left: `${Math.min(Math.max(rect.left, viewportPadding), maxLeft)}px`,
        width: `${width}px`,
        boxSizing: 'border-box',
        maxHeight: 'calc(100vh - 24px)',
        ...(openUp ? { bottom: `${window.innerHeight - rect.top}px` } : { top: `${rect.bottom + 4}px` }),
      });
    };
    updatePosition();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !value) return;
    const selected = fromIso(value);
    if (selected) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [open, value]);

  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return { start, count };
  }, [month]);

  const isSelectable = (iso) => (!min || iso >= min) && (!max || iso <= max);
  const today = toIso(new Date());
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const previousDisabled = minDate && previousMonth < new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const nextDisabled = maxDate && nextMonth > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((current) => !current)}
        className={`inline-flex h-[42px] w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-sm text-brand-dark transition ${
          hasError || open ? 'border-brand-teal' : 'border-brand-dark-light hover:border-brand-teal'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${buttonClassName}`}
      >
        <span className={value ? 'text-brand-dark' : 'text-brand-dark-soft/60'}>{value ? formatDate(value) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-brand-dark-soft" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', zIndex: 10000, ...menuStyle }}
          className="overflow-y-auto rounded-xl border border-brand-dark-light bg-white p-3 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={previousDisabled}
              onClick={() => setMonth(previousMonth)}
              className="rounded-lg p-1.5 text-brand-dark-soft hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-brand-dark">{monthLabel}</span>
            <button
              type="button"
              disabled={nextDisabled}
              onClick={() => setMonth(nextMonth)}
              className="rounded-lg p-1.5 text-brand-dark-soft hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-brand-dark-soft">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: days.start }).map((_, index) => <span key={`empty-${index}`} className="h-8" />)}
            {Array.from({ length: days.count }, (_, index) => {
              const day = index + 1;
              const iso = toIso(new Date(month.getFullYear(), month.getMonth(), day));
              const selected = iso === value;
              const isToday = iso === today;
              const selectable = isSelectable(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!selectable}
                  onClick={() => { onChange?.(iso); setOpen(false); }}
                  className={`h-8 rounded-lg text-xs font-semibold transition ${
                    selected
                      ? 'bg-brand-teal text-white'
                      : isToday
                        ? 'border border-brand-teal text-brand-teal hover:bg-brand-teal-light/40'
                        : selectable
                          ? 'text-brand-dark hover:bg-brand-teal-light/50'
                          : 'cursor-not-allowed text-gray-300'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-brand-dark-light pt-2">
            <button type="button" onClick={() => { onChange?.(''); setOpen(false); }} className="px-1 text-xs font-semibold text-brand-teal hover:underline">Clear</button>
            <button type="button" disabled={!isSelectable(today)} onClick={() => { onChange?.(today); setOpen(false); }} className="px-1 text-xs font-semibold text-brand-teal hover:underline disabled:opacity-30">Today</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
