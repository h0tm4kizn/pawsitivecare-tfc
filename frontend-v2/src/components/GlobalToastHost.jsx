import { useEffect, useState } from 'react';
import { APP_NOTIFY_EVENT } from '../utils/notify';

export default function GlobalToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNotify = (event) => {
      const message = String(event?.detail?.message || '').trim();
      if (!message) return;
      const rawType = event?.detail?.type;
      const type = rawType === 'error' || rawType === 'warning' ? rawType : 'success';
      const duration = Number(event?.detail?.duration || 3200);
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    };

    window.addEventListener(APP_NOTIFY_EVENT, handleNotify);
    return () => window.removeEventListener(APP_NOTIFY_EVENT, handleNotify);
  }, []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[250] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-brand-teal'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>
      ))}
    </div>
  );
}
