import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function HeaderModalShell({
  isOpen = true,
  onClose,
  title,
  subtitle,
  children,
  className = 'w-full max-w-md',
  headerClassName = 'bg-brand-teal',
}) {
  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/45 h-[100dvh] min-h-[100dvh] w-screen">
      <div className={`flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${className}`}>
        <div className={`flex items-center justify-between px-5 py-3.5 ${headerClassName}`}>
          <div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {subtitle ? <p className="text-[11px] text-white/80">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25"
            aria-label={`Close ${String(title || 'modal').toLowerCase()}`}
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
