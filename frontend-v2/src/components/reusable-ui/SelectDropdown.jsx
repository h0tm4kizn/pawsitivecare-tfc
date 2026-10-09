import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function SelectDropdown({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  hasError = false,
  className = '',
  searchable = false,
  searchPlaceholder = 'Search...',
  groupByFirstLetter = false,
  menuPlacement = 'down', // 'down' or 'up'
  highlightSelected = false,
  buttonClassName = '',
  textClassName = '',
  variant = 'light', // 'light' | 'dark'
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      const target = e.target;
      const isRootClick = rootRef.current && rootRef.current.contains(target);
      const isMenuClick = menuRef.current && menuRef.current.contains(target);
      if (!isRootClick && !isMenuClick) setOpen(false);
    };
    const onKey = (ev) => { if (ev.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSearchTerm('');
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value));
  const normalizeSearch = (text) => String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase()
    .trim();
  const filteredOptions = searchable
    ? options.filter((opt) => {
        const term = normalizeSearch(searchTerm);
        if (!term) return true;
        const searchableText = normalizeSearch(`${opt?.label || ''} ${opt?.searchText || ''}`);
        return searchableText.includes(term);
      })
    : options;

  const colorClasses = [
    'text-teal-700 bg-teal-50',
    'text-blue-700 bg-blue-50',
    'text-emerald-700 bg-emerald-50',
    'text-cyan-700 bg-cyan-50',
  ];
  const groupedOptions = (() => {
    if (!groupByFirstLetter) return null;
    const base = filteredOptions.filter((o) => String(o?.value ?? '') !== '');
    const sorted = [...base].sort((a, b) => String(a.label).normalize('NFC').localeCompare(String(b.label).normalize('NFC')));
    const groups = [];
    sorted.forEach((opt) => {
      const first = String(opt.label || '').normalize('NFC').trim().charAt(0).toUpperCase() || '#';
      const letter = /\p{L}/u.test(first) ? first : '#';
      if (letter === '#') {
        // Skip grouping items starting with non-letter characters
        if (!groups.length || groups[groups.length - 1].letter !== '#') return;
        groups[groups.length - 1].items.push(opt);
      } else {
        const last = groups[groups.length - 1];
        if (!last || last.letter !== letter) groups.push({ letter, items: [opt] });
        else last.items.push(opt);
      }
    });
    return groups;
  })();

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const maxLeft = Math.max(viewportPadding, viewportWidth - viewportPadding - rect.width);
      const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
      const width = Math.min(rect.width, viewportWidth - left - viewportPadding);
      const baseStyle = {
        left: `${left}px`,
        width: `${Math.max(width, 0)}px`,
        maxHeight: 'calc(100vh - 24px)',
        position: 'fixed',
      };
      const estimatedMenuHeight = Math.min(260, 48 + (filteredOptions.length * 40));
      const shouldOpenUp = menuPlacement === 'up'
        || (menuPlacement === 'down'
          && rect.bottom + estimatedMenuHeight > window.innerHeight
          && rect.top > estimatedMenuHeight);
      if (shouldOpenUp) {
        // place menu above the trigger: set bottom relative to viewport
        const bottom = Math.max(window.innerHeight - rect.top, 0);
        setMenuStyle({ ...baseStyle, bottom: `${bottom}px` });
      } else {
        // place menu below the trigger
        const top = rect.bottom;
        setMenuStyle({ ...baseStyle, top: `${top}px` });
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, menuPlacement, filteredOptions.length]);

  const handleTypeAhead = (event) => {
    if (!searchable || disabled) return;
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (!isPrintable && event.key !== 'Backspace') return;

    event.preventDefault();
    if (!open) setOpen(true);

    if (event.key === 'Backspace') {
      setSearchTerm((prev) => prev.slice(0, -1));
      return;
    }
    setSearchTerm((prev) => `${prev}${event.key}`);
  };

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleTypeAhead}
        className={`inline-flex w-full items-center justify-between gap-2 border text-sm transition ${
          hasError
            ? variant === 'dark'
              ? 'rounded-lg border-red-400 bg-white/10 px-4 py-3 font-semibold text-white'
              : 'rounded-xl border-red-400 bg-white px-3 py-2 font-medium text-brand-dark'
            : variant === 'dark'
              ? open
                ? 'rounded-lg border-white/40 bg-white/15 px-4 py-3 font-semibold text-white'
                : 'rounded-lg border-white/20 bg-white/10 px-4 py-3 font-semibold text-white hover:border-white/40'
              : open
                ? 'rounded-xl border-brand-teal bg-white px-3 py-2 font-medium text-brand-dark'
                : 'rounded-xl border-brand-dark-light bg-white px-3 py-2 font-medium text-brand-dark hover:border-brand-teal'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${buttonClassName}`}
      >
        <span className={`truncate text-left text-sm ${!selected ? (variant === 'dark' ? 'text-white/50' : 'text-brand-dark-soft/60') : (variant === 'dark' ? 'text-white' : 'text-brand-dark')} ${textClassName}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        // render menu in a portal attached to body so it can escape modal overflow/clipping
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle || {}}
            className="ui-dropdown-menu z-[9999] flex flex-col overflow-y-auto rounded-2xl border border-brand-teal/20 bg-white"
          >
            {searchable && (
              <div className="px-2 pt-2 pb-1 shrink-0">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-brand-dark-light px-2.5 py-1.5 text-xs text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>
            )}
            <div className="max-h-52 overflow-y-auto py-1">
              {!groupByFirstLetter && filteredOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={Boolean(opt.disabled)}
                  onClick={() => { onChange?.(opt.value); setOpen(false); }}
                  className={`ui-dropdown-item ${String(value) === String(opt.value) ? 'ui-dropdown-item-active' : ''} ${opt.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
              {groupByFirstLetter && (
                <>
                  {filteredOptions.find((o) => String(o?.value ?? '') === '') && (
                    <button
                      key="__empty__"
                      type="button"
                      onClick={() => { onChange?.(''); setOpen(false); }}
                      className={`ui-dropdown-item ${String(value) === '' ? 'ui-dropdown-item-active' : ''}`}
                    >
                      {filteredOptions.find((o) => String(o?.value ?? '') === '')?.label || 'Select'}
                    </button>
                  )}
                  {(groupedOptions || []).map((group, idx) => (
                    <div key={group.letter}>
                      {group.letter !== '#' && (
                        <div className={`mx-2 my-1 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider ${colorClasses[idx % colorClasses.length]}`}>
                          {group.letter}
                        </div>
                      )}
                      {group.items.map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          disabled={Boolean(opt.disabled)}
                          onClick={() => { onChange?.(opt.value); setOpen(false); }}
                          className={`ui-dropdown-item ${String(value) === String(opt.value) ? 'ui-dropdown-item-active' : ''} ${opt.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
              {searchable && filteredOptions.length === 0 && (
                <div className="px-3 py-2 text-xs text-brand-dark-soft">No matches found.</div>
              )}
            </div>
          </div>,
          document.body,
        )
      )}
    </div>
  );
}
