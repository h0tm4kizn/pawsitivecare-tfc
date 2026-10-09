import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, apiGet } from '../../../api/apiClient';
import { fmtTimeAgo as fmtTime } from '../../../utils/dateUtils';
import { db } from '../../../utils/powersync/db';
import { formatCustomerNotificationMessage } from '../../../utils/recordFormatters';
import { safeStorageSet } from '../../../utils/browserStorage';
import HeaderPopoverPanel from '../../admin/header/shared/HeaderPopoverPanel';
import NotificationDetailsModal from '../../admin/header/shared/NotificationDetailsModal';

const POLL_MS = 30_000;

const getIcon = (item = {}) => {
  const type = String(item.type || '').toLowerCase();
  const m    = String(item.message || '').toLowerCase();

  // pet
  if (type === 'new_pet' || (m.includes('pet') && m.includes('registered')))
                                                              return { icon: 'fa-paw',            cls: 'text-brand-orange' };
  // appointment status
  if (m.includes('not approved') || m.includes('rejected'))  return { icon: 'fa-circle-xmark',   cls: 'text-red-500'      };
  if (m.includes('cancel'))                                   return { icon: 'fa-ban',            cls: 'text-red-400'      };
  if (m.includes('no show'))                                  return { icon: 'fa-user-slash',     cls: 'text-rose-500'     };
  if (m.includes('completed'))                                return { icon: 'fa-star',           cls: 'text-emerald-500'  };
  if (m.includes('approved') || m.includes('confirmed'))      return { icon: 'fa-circle-check',   cls: 'text-blue-500'     };
  if (m.includes('pending') || m.includes('awaiting'))        return { icon: 'fa-hourglass-half', cls: 'text-amber-500'    };
  if (m.includes('reminder') || m.includes('tomorrow'))       return { icon: 'fa-clock',          cls: 'text-amber-500'    };
  if (m.includes('booked') || m.includes('appointment') || m.includes('booking'))
                                                              return { icon: 'fa-calendar-check', cls: 'text-blue-500'     };
  // reservation updates
  if (m.includes('reservation') || m.includes('reference'))   return { icon: 'fa-receipt',        cls: 'text-emerald-600'  };
  // service-specific
  if (m.includes('groom'))                                    return { icon: 'fa-scissors',       cls: 'text-brand-teal'   };
  if (m.includes('hotel') || m.includes('boarding'))         return { icon: 'fa-house',          cls: 'text-brand-teal'   };
  if (m.includes('daycare'))                                  return { icon: 'fa-sun',            cls: 'text-amber-500'    };
  // account / pet
  if (m.includes('birthday'))                                 return { icon: 'fa-cake-candles',   cls: 'text-brand-orange' };
  if (m.includes('welcome'))                                  return { icon: 'fa-user',           cls: 'text-brand-teal'   };
  return { icon: 'fa-bell', cls: 'text-brand-teal' };
};

const getSubject = (item) => {
  if (item.subject) return item.subject;
  const type = String(item.type || '').toLowerCase();
  const m    = String(item.message || '').toLowerCase();
  if (type === 'new_pet')                                            return 'New Pet Registered';
  if (m.includes('not approved') || m.includes('rejected'))         return 'Booking Not Approved';
  if (m.includes('cancel'))                                          return 'Appointment Cancelled';
  if (m.includes('no show'))                                         return 'Appointment No Show';
  if (m.includes('completed'))                                       return 'Appointment Completed';
  if (m.includes('approved') || m.includes('confirmed'))             return 'Booking Approved';
  if (m.includes('pending') || m.includes('awaiting'))              return 'Awaiting Approval';
  if (m.includes('reminder') || m.includes('tomorrow'))             return 'Appointment Reminder';
  if (m.includes('booked') || m.includes('appointment') || m.includes('booking')) return 'Appointment Update';
  if (m.includes('reservation') || m.includes('reference'))         return 'Reservation Update';
  if (m.includes('birthday'))                                        return 'Happy Birthday!';
  if (m.includes('welcome'))                                         return 'Welcome to The Fur Club';
  return 'Notification';
};

const getLinkedAppointmentId = (item = {}) => {
  let metadata = item.metadata;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
  }
  return item.appointment_id || metadata?.appointment_id || metadata?.appointmentId || null;
};

// ── Notification row (used in both popover and view-all list) ─────────────────
function NotifItem({ item, isRead, onOpen }) {
  const { icon, cls } = getIcon(item);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`w-full text-left px-4 py-3 border-b border-brand-dark-light transition-colors hover:bg-brand-dark/5 ${isRead ? 'opacity-70' : 'bg-white'}`}
    >
      <div className="flex items-start gap-2.5">
        <i className={`fa-solid ${icon} ${cls} mt-0.5 text-sm shrink-0`} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-brand-dark leading-snug">{getSubject(item)}</p>
          <p className="mt-0.5 text-[10px] text-brand-dark-soft line-clamp-1">{formatCustomerNotificationMessage(item.message)}</p>
          <span className="text-[9px] text-brand-dark-soft mt-0.5 block">{fmtTime(item.sent_at || item.created_at)}</span>
        </div>
        {!isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />}
      </div>
    </button>
  );
}

// ── View All Modal ────────────────────────────────────────────────────────────
function ViewAllModal({ isOpen, items, readIds, onOpen, onMarkAll, onClose }) {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-dark/25 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex max-h-[calc(100dvh-2rem)] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h3 className="text-sm font-extrabold text-white">All Notifications</h3>
          <button type="button" onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>
        <div className="h-1 bg-white" />

        {items.some((i) => !readIds.has(i.id)) && (
          <div className="border-b border-brand-dark-light px-4 py-2 flex justify-end">
            <button type="button" onClick={onMarkAll}
              className="text-[11px] font-semibold text-brand-teal hover:underline">
              Mark all as read
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-teal">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <i className="fa-solid fa-bell text-brand-dark/20 text-3xl mb-3" />
              <p className="text-sm text-brand-dark-soft">No notifications yet.</p>
            </div>
          ) : (
            items.map((item) => (
              <NotifItem key={item.id} item={item} isRead={readIds.has(item.id)} onOpen={onOpen} />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClientNotification() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [showAll,   setShowAll]   = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [items,     setItems]     = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readIds,   setReadIds]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('client_notif_read') || '[]')); }
    catch { return new Set(); }
  });
  const pollRef = useRef(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const r = await apiGet('/api/my-notifications?per_page=50');
      if (!r.ok) return;
      const d = await r.json();
      const raw = Array.isArray(d?.data?.data) ? d.data.data
        : Array.isArray(d?.data) ? d.data : [];
      setItems(raw.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      const backendReadIds = raw.filter((item) => item?.is_read).map((item) => item.id);
      if (backendReadIds.length > 0) {
        setReadIds((prev) => {
          const next = new Set(prev);
          backendReadIds.forEach((id) => next.add(id));
          safeStorageSet(window.localStorage, 'client_notif_read', JSON.stringify([...next]));
          return next;
        });
      }
    } catch { /* silent */ }
    finally { if (!quiet) setIsLoading(false); }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const markRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      safeStorageSet(window.localStorage, 'client_notif_read', JSON.stringify([...next]));
      return next;
    });
    if (typeof window !== 'undefined' && navigator.onLine === false) {
      db.execute(
        `UPDATE notifications SET is_read = ?, read_at = ?, updated_at = ? WHERE id = ?`,
        [1, new Date().toISOString(), new Date().toISOString(), id]
      ).catch(() => {});
      return;
    }
    apiFetch(`/api/my-notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    }).catch(() => {});
  }, []);

  const markAll = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      safeStorageSet(window.localStorage, 'client_notif_read', JSON.stringify([...next]));
      return next;
    });
  }, [items]);

  // Open detail modal, mark as read
  const openDetail = useCallback((item) => {
    if (!readIds.has(item.id)) markRead(item.id);
    setIsOpen(false);
    setShowAll(false);
    setSelected(item);
  }, [readIds, markRead]);

  const closeDetail = useCallback(() => setSelected(null), []);

  const unread = items.filter((i) => !readIds.has(i.id)).length;
  const preview = items.slice(0, 5);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="relative flex h-10 w-10 items-center justify-center text-brand-dark/70 hover:text-brand-teal transition-colors"
        aria-label="Notifications"
      >
        <i className="fa-solid fa-bell text-sm" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <HeaderPopoverPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notifications"
        titleIcon="fa-bell"
        rightAction={unread > 0 ? (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{unread} new</span>
        ) : null}
        footer={items.length > 0 ? (
          <button
            type="button"
            onClick={() => { setIsOpen(false); setShowAll(true); }}
            className="w-full border-t border-brand-teal/20 bg-brand-teal-soft/20 py-2.5 text-xs font-bold text-brand-teal hover:bg-brand-teal-soft/35"
          >
            View All Notifications
          </button>
        ) : null}
      >
        {isLoading ? (
          <div className="px-4 py-6 text-center text-xs text-brand-dark-soft animate-pulse">Loading...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <i className="fa-solid fa-bell text-brand-dark/20 text-2xl mb-2" />
            <p className="text-xs text-brand-dark-soft">No notifications yet.</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto scrollbar-teal">
            {preview.map((item) => (
              <NotifItem key={item.id} item={item} isRead={readIds.has(item.id)} onOpen={openDetail} />
            ))}
          </div>
        )}
      </HeaderPopoverPanel>

      <ViewAllModal
        isOpen={showAll}
        items={items}
        readIds={readIds}
        onOpen={openDetail}
        onMarkAll={markAll}
        onClose={() => setShowAll(false)}
      />

      <NotificationDetailsModal
        item={selected}
        title={selected ? getSubject(selected) : 'Notification'}
        icon={selected ? getIcon(selected).icon : 'fa-bell'}
        iconClass={selected ? getIcon(selected).cls : 'text-brand-teal'}
        message={selected?.message}
        timestamp={selected?.sent_at || selected?.created_at}
        isRead={selected ? readIds.has(selected.id) : true}
        actionLabel={selected && getLinkedAppointmentId(selected) ? 'View Appointment' : null}
        onAction={selected && getLinkedAppointmentId(selected) ? () => {
          const appointmentId = getLinkedAppointmentId(selected);
          setSelected(null);
          window.dispatchEvent(new CustomEvent('client:open-appointment', { detail: { appointmentId } }));
        } : null}
        onClose={closeDetail}
      />
    </div>
  );
}
