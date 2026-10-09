import { Bell } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAdminHeaderStore } from '../../../stores/adminHeaderStore';
import { fmtTimeAgo } from './headerDateUtils';
import HeaderNotificationsAllModal from './HeaderNotificationsAllModal';
import HeaderIconButton from './shared/HeaderIconButton';
import HeaderPopoverPanel from './shared/HeaderPopoverPanel';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import BreedRequestModal from './BreedRequestModal';
import NotificationDetailsModal from './shared/NotificationDetailsModal';
import { formatCustomerNotificationMessage } from '../../../utils/recordFormatters';

const safeTimestamp = (value) => {
  const ts = new Date(value || '').getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const ownerDisplayName = (row) => {
  const direct = typeof row?.owner === 'string' ? row.owner.trim() : '';
  if (direct) return direct;
  const first = String(row?.owner?.first_name || row?.pet?.owner?.first_name || '').trim();
  const last = String(row?.owner?.last_name || row?.pet?.owner?.last_name || '').trim();
  const combined = `${first} ${last}`.trim();
  return combined || 'Unknown Customer';
};

const toAppointmentText = (row) => {
  const pet = row?.pet?.name || row?.pet_name || 'Pet';
  const petId = row?.pet?.pet_id || row?.pet_id || 'Pet ID';
  const service = row?.service?.name || row?.service_name || 'Service';
  const owner = ownerDisplayName(row);
  return `Appointment: ${service} for ${pet} (${petId}) by ${owner}.`;
};

const toAdminNotificationText = (row) => {
  const raw = String(row?.message || '').trim();
  if (!raw) return '-';
  const owner = ownerDisplayName(row);
  return formatCustomerNotificationMessage(raw
    .replace(/^your appointment\b/i, `${owner}'s appointment`)
    .replace(/^appointment booking for\b/i, `Appointment booking for`)
    .replace(/\byour pet\b/gi, 'the pet'));
};

const getNotifSubject = (item) => {
  if (item.raw?.subject) return item.raw.subject;
  if (item.isBreedRequest) return 'Breed Request';
  if (item.isNewCustomer)  return 'New Customer';
  if (item.isNewPet)       return 'New Pet Registered';
  if (item.isNewBooking)   return 'New Booking';
  if (item.source === 'appointment') {
    const msg = String(item.raw?.message || item.text || '').toLowerCase();
    if (msg.includes('cancel')) return 'Booking Cancelled';
    if (msg.includes('rejected') || msg.includes('not approved')) return 'Booking Not Approved';
    if (msg.includes('no show'))                            return 'Appointment No Show';
    if (msg.includes('approved') || msg.includes('confirmed')) return 'Booking Approved';
    if (msg.includes('completed'))                          return 'Appointment Completed';
    if (msg.includes('reminder') || msg.includes('tomorrow')) return 'Appointment Reminder';
    return 'Appointment Update';
  }
  const msg = String(item.raw?.message || item.text || '').toLowerCase();
  if (msg.includes('cancel')) return 'Booking Cancelled';
  if (msg.includes('rejected') || msg.includes('not approved')) return 'Booking Not Approved';
  if (msg.includes('no show'))                              return 'Appointment No Show';
  if (msg.includes('approved') || msg.includes('confirmed')) return 'Booking Approved';
  if (msg.includes('completed'))                            return 'Appointment Completed';
  if (msg.includes('reminder') || msg.includes('tomorrow')) return 'Appointment Reminder';
  if (msg.includes('birthday')) return 'Pet Birthday';
  return 'Notification';
};

const getNotifIcon = (item) => {
  if (item.source === 'appointment') return { icon: 'fa-calendar-check', cls: 'text-blue-500' };
  if (item.isBreedRequest) return { icon: 'fa-paw', cls: 'text-amber-500' };
  if (item.isNewCustomer) return { icon: 'fa-user-plus', cls: 'text-brand-teal' };
  if (item.isNewPet) return { icon: 'fa-paw', cls: 'text-brand-orange' };
  if (item.isNewBooking) return { icon: 'fa-calendar-check', cls: 'text-blue-500' };
  const msg = String(item.raw?.message || '').toLowerCase();
  if (msg.includes('cancel') || msg.includes('rejected')) return { icon: 'fa-circle-xmark', cls: 'text-red-500' };
  if (msg.includes('no show')) return { icon: 'fa-user-slash', cls: 'text-rose-500' };
  if (msg.includes('approved') || msg.includes('confirmed')) return { icon: 'fa-circle-check', cls: 'text-blue-500' };
  if (msg.includes('completed')) return { icon: 'fa-star', cls: 'text-emerald-500' };
  if (msg.includes('reminder') || msg.includes('tomorrow')) return { icon: 'fa-clock', cls: 'text-amber-500' };
  if (msg.includes('birthday')) return { icon: 'fa-cake-candles', cls: 'text-brand-orange' };
  return { icon: 'fa-bell', cls: 'text-brand-teal' };
};

export default function HeaderNotifications({ onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [breedRequestItem, setBreedRequestItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const notifications = useAdminHeaderStore((state) => state.notifications);
  const appointmentNotifications = useAdminHeaderStore((state) => state.appointmentNotifications);
  const notificationLoading = useAdminHeaderStore((state) => state.notificationLoading);
  const notificationsDisabled = useAdminHeaderStore((state) => state.notificationsDisabled);
  const notifReadIds = useAdminHeaderStore((state) => state.notifReadIds);
  const loadNotifications = useAdminHeaderStore((state) => state.loadNotifications);
  const markNotificationRead = useAdminHeaderStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useAdminHeaderStore((state) => state.markAllNotificationsRead);
  const deleteNotification = useAdminHeaderStore((state) => state.deleteNotification);
  const deleteNotifications = useAdminHeaderStore((state) => state.deleteNotifications);

  useEffect(() => {
    if (notificationsDisabled) return undefined;
    loadNotifications();
    const interval = setInterval(loadNotifications, 300_000);
    return () => clearInterval(interval);
  }, [loadNotifications, notificationsDisabled]);

  const items = useMemo(() => {
    const systemRows = notifications.map((row) => {
      const type = String(row?.type || '').toLowerCase();
      const isNewCustomer = type === 'confirmation' && String(row?.message || '').toLowerCase().includes('welcome');
      const isNewPet = type === 'new_pet';
      const isNewBooking = type === 'new_booking'
        || (type === 'confirmation' && String(row?.message || '').toLowerCase().includes('pending admin approval'));
      const isBreedRequest = type === 'breed_request';
      const ownerName = `${row?.owner?.first_name || ''} ${row?.owner?.last_name || ''}`.trim();
      const meta = row?.metadata || {};
      const petNameFromMessage = String(row?.message || '').match(/your pet\s+([^([]+)/i)?.[1]?.trim() || '';
      const appointmentId = row?.appointment_id || meta?.appointment_id || null;
      const linkedAppointment = appointmentId
        ? appointmentNotifications.find((appointment) => String(appointment?.id) === String(appointmentId))
        : null;
      const item = {
        id: `n-${row.id}`,
        text: isBreedRequest
          ? `New breed request: "${meta.custom_breed || 'Unknown'}"`
          : isNewCustomer
            ? 'New customer has signed up!'
            : isNewPet
              ? 'New pet registered!'
              : toAdminNotificationText(row),
        sub: isBreedRequest
          ? `${meta.pet_name || 'A pet'} - ${meta.species_name || ''} - Tap to review`
          : isNewCustomer
            ? `Welcome ${row?.owner?.first_name || 'them'}! Go check on them.`
            : isNewPet
              ? `${ownerName ? `${ownerName} - ` : ''}Go check on their pet.`
              : ownerName,
        time: row?.created_at,
        source: 'system',
        isNewCustomer,
        isNewPet,
        isNewBooking,
        isBreedRequest,
        ownerId: row?.owner?.id ?? null,
        petId: meta?.pet_id || row?.pet_id || null,
        petName: meta?.pet_name || petNameFromMessage || null,
        appointmentId,
        appointmentDate: linkedAppointment?.appointment_date || linkedAppointment?.date || meta?.appointment_date || null,
        raw: row,
      };
      return { ...item, icon: getNotifIcon(item) };
    });

    const apptRows = appointmentNotifications.map((row) => {
      const status = String(row?.status || '').toLowerCase();
      const isNewBooking = status === 'pending';
      const item = {
        id: `a-${row.id}`,
        text: toAppointmentText(row),
        sub: isNewBooking ? 'New booking - tap to review' : `Status: ${row?.status || 'approved'}`,
        time: row?.created_at,
        source: 'appointment',
        isNewBooking,
        appointmentId: row?.id,
        appointmentDate: row?.appointment_date || row?.date || null,
        raw: row,
      };
      return { ...item, icon: getNotifIcon(item) };
    });

    return [...systemRows, ...apptRows].sort((a, b) => {
      const aKey = safeTimestamp(a.time);
      const bKey = safeTimestamp(b.time);
      return bKey - aKey;
    });
  }, [notifications, appointmentNotifications]);

  const resolveNavigationTarget = (item) => {
    if (item?.isNewBooking) {
      return item?.appointmentId
        ? { pageId: 'appointment', payload: { appointmentId: item.appointmentId, appointmentDate: item.appointmentDate } }
        : { pageId: 'appointment', payload: { openNewBookings: true } };
    }

    if (item?.appointmentId) {
      return { pageId: 'appointment', payload: { appointmentId: item.appointmentId, appointmentDate: item.appointmentDate } };
    }

    if (item?.isNewCustomer) {
      return { pageId: 'customer', payload: { ownerId: item?.ownerId } };
    }
    if (item?.isNewPet) {
      return {
        pageId: 'pets',
        payload: { petId: item?.petId, ownerId: item?.ownerId, petName: item?.petName },
      };
    }
    if (item?.petId) {
      return { pageId: 'pets', payload: { petId: item.petId, ownerId: item?.ownerId, petName: item?.petName } };
    }

    const haystack = `${item?.text || ''} ${item?.sub || ''} ${item?.raw?.type || ''} ${item?.raw?.title || ''}`.toLowerCase();
    if (
      haystack.includes('new register')
      || haystack.includes('new registration')
      || haystack.includes('registered')
      || haystack.includes('customer')
      || haystack.includes('client')
      || haystack.includes('user')
    ) {
      return { pageId: 'customer' };
    }
    if (haystack.includes('appointment') || haystack.includes('booking')) {
      return { pageId: 'appointment' };
    }
    return null;
  };

  const handleNotificationClick = (item) => {
    if (!item) return;
    const isRead = notifReadIds.includes(item.id);
    if (!isRead) markNotificationRead(item.id);

    if (item.isBreedRequest) {
      setBreedRequestItem(item);
      setIsOpen(false);
      setShowAll(false);
      return;
    }
    setSelectedItem(item);
    setIsOpen(false);
    setShowAll(false);
  };

  const selectedTarget = selectedItem ? resolveNavigationTarget(selectedItem) : null;
  const selectedMessage = selectedItem?.source === 'appointment'
    ? selectedItem.text
    : selectedItem?.raw?.message || selectedItem?.text;

  const unread = items.filter((item) => !notifReadIds.includes(item.id)).length;

  return (
    <div className="relative">
      <HeaderIconButton
        icon={Bell}
        label="Notifications"
        onClick={() => {
          setIsOpen((open) => {
            const next = !open;
            if (next) loadNotifications();
            return next;
          });
        }}
        badgeCount={unread}
        roundedHover
        testId="icon-notification"
      />

      <HeaderPopoverPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notifications"
        titleIcon="fa-bell"
        rightAction={unread > 0 ? (
          <button
            type="button"
            onClick={() => markAllNotificationsRead(items.map((item) => item.id))}
            className="text-[11px] font-semibold text-brand-teal hover:text-brand-teal-dark"
          >
            Mark all read
          </button>
        ) : null}
        footer={(
          <button
            type="button"
            onClick={() => {
              loadNotifications({ force: true });
              setShowAll(true);
              setIsOpen(false);
            }}
            className="w-full border-t border-brand-teal/20 bg-brand-teal-soft/20 py-2.5 text-xs font-bold text-brand-teal hover:bg-brand-teal-soft/35"
          >
            See All Notifications
          </button>
        )}
      >
        {notificationLoading && notifications.length === 0 ? (
          <AdminSkeleton variant="table" label="Loading notifications" rows={3} />
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <i className="fa-solid fa-bell text-brand-dark/20 text-2xl mb-2 block" />
            <p className="text-xs text-brand-dark-soft">No notifications yet.</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto scrollbar-teal">
            {items.slice(0, 5).map((item) => {
              const isRead = notifReadIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full border-b border-brand-dark-light px-4 py-3 text-left transition-colors hover:bg-brand-dark/5 ${isRead ? 'opacity-70' : 'bg-white'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <i className={`fa-solid ${item.icon?.icon || 'fa-bell'} ${item.icon?.cls || 'text-brand-teal'} mt-0.5 text-sm shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-brand-dark leading-snug">{getNotifSubject(item)}</p>
                      <p className="mt-0.5 text-[10px] text-brand-dark-soft line-clamp-1">{item.text}</p>
                      <span className="mt-0.5 block text-[9px] text-brand-dark-soft">{fmtTimeAgo(item.time)}</span>
                    </div>
                    {!isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </HeaderPopoverPanel>

      <HeaderNotificationsAllModal
        isOpen={showAll}
        items={items}
        readIds={notifReadIds}
        onClose={() => setShowAll(false)}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
        onItemClick={handleNotificationClick}
        onOpenPet={(petId) => {
          if (!petId) return;
          setShowAll(false);
          setIsOpen(false);
          onNavigate?.('pets', { petId });
        }}
        onDelete={async (id) => {
          await deleteNotification(id);
        }}
        onDeleteMany={async (ids) => {
          await deleteNotifications(ids);
        }}
      />

      <BreedRequestModal
        notification={breedRequestItem}
        onClose={() => setBreedRequestItem(null)}
      />

      <NotificationDetailsModal
        item={selectedItem}
        title={selectedItem ? getNotifSubject(selectedItem) : 'Notification'}
        icon={selectedItem?.icon?.icon}
        iconClass={selectedItem?.icon?.cls}
        message={selectedMessage}
        timestamp={selectedItem?.time}
        isRead={selectedItem ? notifReadIds.includes(selectedItem.id) : true}
        actionLabel={selectedTarget?.pageId === 'appointment' ? 'View Appointment' : selectedTarget?.pageId === 'pets' ? 'View Pet' : selectedTarget?.pageId === 'customer' ? 'View Customer' : null}
        onAction={selectedTarget ? () => {
          setSelectedItem(null);
          onNavigate?.(selectedTarget.pageId, selectedTarget.payload);
        } : null}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
