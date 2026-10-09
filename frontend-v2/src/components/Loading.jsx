import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

// delay: ms to wait before showing the spinner. Overlay defaults to 150ms so
// fast local (SQLite) responses never cause a flash. Pass delay={0} to show immediately.
export default function Loading({ message = 'Loading...', overlay = false, textClassName = 'text-white', overlayClassName = 'bg-brand-dark/40', delay = overlay ? 150 : 0 }) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) { setVisible(true); return; }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useBodyScrollLock(overlay && visible);

  if (!visible) return null;

  const inner = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-brand-teal shadow-[0_4px_16px_rgba(36,119,122,0.35)]">
        <img
          src="/assets/paw-teal.webp"
          alt="Loading"
          className="w-9 h-9"
        />
      </div>
      {message && (
        <p className={`${textClassName} font-poppins text-xs font-semibold tracking-wide animate-pulse`}>
          {message}
        </p>
      )}
    </div>
  );

  if (overlay) {
    const overlayNode = (
      <div className={`fixed inset-0 z-[9999] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center backdrop-blur-sm ${overlayClassName}`}>
        {inner}
      </div>
    );

    if (typeof document !== 'undefined') {
      return createPortal(overlayNode, document.body);
    }

    return overlayNode;
  }

  return (
    <div className="flex items-center justify-center py-8">
      {inner}
    </div>
  );
}
