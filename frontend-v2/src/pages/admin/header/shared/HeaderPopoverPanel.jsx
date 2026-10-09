import { createPortal } from 'react-dom';

export default function HeaderPopoverPanel({
  isOpen,
  onClose,
  title,
  titleIcon,
  rightAction,
  children,
  footer,
  widthClass = 'w-[calc(100vw-2rem)] max-w-[340px]',
}) {
  if (!isOpen) return null;

  const panel = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[280] cursor-default bg-brand-dark/45 backdrop-blur-sm h-[100dvh] min-h-[100dvh] w-screen"
        onClick={onClose}
        aria-label={`Dismiss ${String(title || 'panel').toLowerCase()}`}
      />
      <div className={`fixed right-4 top-[88px] z-[290] overflow-hidden rounded-xl border border-brand-dark-light bg-brand-surface shadow-2xl sm:right-6 ${widthClass}`}>
        <div className="flex items-center justify-between border-b border-brand-dark-light px-4 py-3">
          <div className="flex items-center gap-2">
            {titleIcon && <i className={`fa-solid ${titleIcon} text-brand-teal text-xs`} />}
            <p className="text-xs font-bold uppercase tracking-widest text-brand-dark-soft">{title}</p>
          </div>
          {rightAction || null}
        </div>
        {children}
        {footer || null}
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : panel;
}
