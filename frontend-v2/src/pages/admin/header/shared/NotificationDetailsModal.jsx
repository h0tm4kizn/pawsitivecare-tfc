import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { formatCustomerNotificationMessage, formatDateTimeLabel } from '../../../../utils/recordFormatters';

export default function NotificationDetailsModal({
  item,
  title = 'Notification',
  icon = 'fa-bell',
  iconClass = 'text-brand-teal',
  message,
  timestamp,
  isRead = true,
  actionLabel,
  onAction,
  onClose,
}) {
  if (!item) return null;
  const cleanMessage = formatCustomerNotificationMessage(message ?? item.message ?? item.text ?? '');

  return createPortal(
    <div
      className="fixed inset-0 z-[340] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h2 id="notification-details-title" className="truncate pr-3 text-sm font-extrabold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close notification details">
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className="h-1 bg-white" />
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-surface ${iconClass}`}>
              <i className={`fa-solid ${icon} text-base`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-dark">{cleanMessage || 'No additional details.'}</p>
              <p className="mt-2 text-[11px] text-brand-dark-soft">{formatDateTimeLabel(timestamp || item.sent_at || item.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3">
            <span className="text-[11px] text-brand-dark-soft">Status</span>
            <span className={`text-[11px] font-semibold ${isRead ? 'text-brand-dark-soft' : 'text-brand-teal'}`}>{isRead ? 'Read' : 'Unread'}</span>
          </div>
          {actionLabel && onAction ? (
            <button type="button" onClick={onAction} className="w-full rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark">
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
