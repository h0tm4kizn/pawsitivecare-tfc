import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import { apiGet, apiFetch } from '../../../../api/apiClient';
import { fmtTimeAgo } from '../../../../utils/dateUtils';
import { db } from '../../../../utils/powersync/db';
import { formatCustomerNotificationMessage } from '../../../../utils/recordFormatters';
import { safeStorageSet } from '../../../../utils/browserStorage';
import NotificationDetailsModal from '../../../admin/header/shared/NotificationDetailsModal';

const getNotifIcon = (item = {}) => {
  const type = String(item.type || '').toLowerCase();
  const message = String(item.message || '').toLowerCase();
  if (type === 'new_pet' || (message.includes('pet') && message.includes('registered')))
    return { icon: 'fa-paw', cls: 'text-brand-orange' };
  if (message.includes('not approved') || message.includes('rejected')) return { icon: 'fa-circle-xmark', cls: 'text-red-500' };
  if (message.includes('cancel')) return { icon: 'fa-ban', cls: 'text-red-400' };
  if (message.includes('no show')) return { icon: 'fa-user-slash', cls: 'text-rose-500' };
  if (message.includes('completed')) return { icon: 'fa-star', cls: 'text-emerald-500' };
  if (message.includes('approved') || message.includes('confirmed')) return { icon: 'fa-circle-check', cls: 'text-blue-500' };
  if (message.includes('pending') || message.includes('awaiting')) return { icon: 'fa-hourglass-half', cls: 'text-amber-500' };
  if (message.includes('reminder') || message.includes('tomorrow')) return { icon: 'fa-clock', cls: 'text-amber-500' };
  if (message.includes('booked') || message.includes('appointment') || message.includes('booking')) return { icon: 'fa-calendar-check', cls: 'text-blue-500' };
  if (message.includes('reservation') || message.includes('reference')) return { icon: 'fa-receipt', cls: 'text-emerald-600' };
  if (message.includes('groom')) return { icon: 'fa-scissors', cls: 'text-brand-teal' };
  if (message.includes('hotel') || message.includes('boarding')) return { icon: 'fa-house', cls: 'text-brand-teal' };
  if (message.includes('daycare')) return { icon: 'fa-sun', cls: 'text-amber-500' };
  if (message.includes('birthday')) return { icon: 'fa-cake-candles', cls: 'text-brand-orange' };
  if (message.includes('welcome')) return { icon: 'fa-user', cls: 'text-brand-teal' };
  return { icon: 'fa-bell', cls: 'text-brand-teal' };
};

const getNotifSubject = (item) => {
  if (item.subject) return item.subject;
  const type = String(item.type || '').toLowerCase();
  const message = String(item.message || '').toLowerCase();
  if (type === 'new_pet') return 'New Pet Registered';
  if (message.includes('not approved') || message.includes('rejected')) return 'Booking Not Approved';
  if (message.includes('cancel')) return 'Appointment Cancelled';
  if (message.includes('no show')) return 'Appointment No Show';
  if (message.includes('completed')) return 'Appointment Completed';
  if (message.includes('approved') || message.includes('confirmed')) return 'Booking Approved';
  if (message.includes('pending') || message.includes('awaiting')) return 'Awaiting Approval';
  if (message.includes('reminder') || message.includes('tomorrow')) return 'Appointment Reminder';
  if (message.includes('booked') || message.includes('appointment') || message.includes('booking')) return 'Appointment Update';
  if (message.includes('reservation') || message.includes('reference')) return 'Reservation Update';
  if (message.includes('birthday')) return 'Happy Birthday!';
  if (message.includes('welcome')) return 'Welcome to The Fur Club';
  return 'Notification';
};

const getLinkedAppointmentId = (item = {}) => {
  let metadata = item.metadata;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
  }
  return item.appointment_id || metadata?.appointment_id || metadata?.appointmentId || null;
};

export default function NotificationsModal({ isOpen, onClose }) {
  useBodyScrollLock(isOpen);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('client_notif_read') || '[]'));
    } catch {
      return new Set();
    }
  });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    apiGet('/api/my-notifications?per_page=50')
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((data) => {
        const raw = Array.isArray(data?.data?.data)
          ? data.data.data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setItems(raw.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        const backendRead = raw.filter((item) => item?.is_read).map((item) => item.id);
        if (backendRead.length) {
          setReadIds((previous) => {
            const next = new Set(previous);
            backendRead.forEach((id) => next.add(id));
            safeStorageSet(window.localStorage, 'client_notif_read', JSON.stringify([...next]));
            return next;
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  const markRead = (id) => {
    setReadIds((previous) => {
      const next = new Set(previous);
      next.add(id);
      safeStorageSet(window.localStorage, 'client_notif_read', JSON.stringify([...next]));
      return next;
    });
    if (typeof window !== 'undefined' && navigator.onLine === false) {
      db.execute(
        `UPDATE notifications SET is_read = ?, read_at = ?, updated_at = ? WHERE id = ?`,
        [1, new Date().toISOString(), new Date().toISOString(), id],
      ).catch(() => {});
      return;
    }
    apiFetch(`/api/my-notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    }).catch(() => {});
  };

  const markAll = () => {
    setReadIds((previous) => {
      const next = new Set(previous);
      items.forEach((item) => next.add(item.id));
      safeStorageSet(window.localStorage, 'client_notif_read', JSON.stringify([...next]));
      return next;
    });
  };

  const unread = items.filter((item) => !readIds.has(item.id)).length;

  if (!isOpen) return null;
  return createPortal(
    <>
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden font-poppins"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-bell text-white text-sm" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-widest">
              Notifications
            </h3>
            {unread > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {unread} new
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        {unread > 0 && (
          <div className="border-b border-brand-dark-light px-4 py-2 flex justify-end">
            <button
              type="button"
              onClick={markAll}
              className="text-[11px] font-semibold text-brand-teal hover:underline"
            >
              Mark all as read
            </button>
          </div>
        )}

        {loading ? (
          <div className="px-4 py-8 text-center text-xs text-brand-dark-soft animate-pulse">
            Pawsing for a happy moment...
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <i className="fa-solid fa-bell text-brand-dark/20 text-2xl mb-2 block" />
            <p className="text-xs text-brand-dark-soft">No notifications yet.</p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto scrollbar-teal">
            {items.map((item) => {
              const { icon, cls } = getNotifIcon(item);
              const isRead = readIds.has(item.id);
              const subject = getNotifSubject(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!isRead) markRead(item.id);
                    setSelected(item);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-brand-dark-light transition-colors hover:bg-brand-dark/5 last:border-b-0 ${isRead ? 'opacity-70' : 'bg-white'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <i className={`fa-solid ${icon} ${cls} mt-0.5 text-sm shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-brand-dark leading-snug">{subject}</p>
                      <p className="mt-0.5 text-[10px] text-brand-dark-soft line-clamp-1">{formatCustomerNotificationMessage(item.message)}</p>
                      <span className="text-[9px] text-brand-dark-soft mt-0.5 block">
                        {fmtTimeAgo(item.sent_at || item.created_at)}
                      </span>
                    </div>
                    {!isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
    <NotificationDetailsModal
      item={selected}
      title={selected ? getNotifSubject(selected) : 'Notification'}
      icon={selected ? getNotifIcon(selected).icon : 'fa-bell'}
      iconClass={selected ? getNotifIcon(selected).cls : 'text-brand-teal'}
      message={selected?.message}
      timestamp={selected?.sent_at || selected?.created_at}
      isRead={selected ? readIds.has(selected.id) : true}
      actionLabel={selected && getLinkedAppointmentId(selected) ? 'View Appointment' : null}
      onAction={selected && getLinkedAppointmentId(selected) ? () => {
        const appointmentId = getLinkedAppointmentId(selected);
        setSelected(null);
        onClose();
        window.dispatchEvent(new CustomEvent('client:open-appointment', { detail: { appointmentId } }));
      } : null}
      onClose={() => setSelected(null)}
    />
    </>,
    document.body,
  );
}
