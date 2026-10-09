import { useCallback, useEffect, useRef, useState } from 'react';
import { getOwnerDisplayName, getServiceCategory } from './adminDashboardUtils';

const TOAST_MAX_VISIBLE = 3;
const TOAST_AUTO_DISMISS_MS = 4000;

const getBookingLabel = (category) => category === 'daycare'
  ? 'New Daycare Booking!'
  : category === 'hotel'
    ? 'New Hotel Booking!'
    : 'New Grooming Booking!';

const getBookingDetails = (appointment, source = 'stream') => {
  const category = getServiceCategory(appointment);
  const code = source === 'month'
    ? String(appointment?.displayId || appointment?.appointment_code || appointment?._raw?.appointment_code || appointment?.id || '')
    : String(appointment?.appointment_code || appointment?.display_id || appointment?.id || '');
  const ownerName = getOwnerDisplayName(appointment);
  const serviceName = source === 'month'
    ? String(appointment?.service || appointment?._raw?.service?.name || '').trim() || 'Service'
    : String(appointment?.service?.name || appointment?.service || '').trim() || 'Service';
  const petName = source === 'month'
    ? String(appointment?.pet || appointment?.pet_name || '').trim() || 'Pet'
    : String(appointment?.pet?.name || appointment?.pet || '').trim() || 'Pet';
  const petId = source === 'month'
    ? String(appointment?._raw?.pet?.pet_id || '').trim() || 'Pet ID'
    : String(appointment?.pet?.pet_id || '').trim() || 'Pet ID';

  return {
    category,
    appointmentCode: code,
    appointmentId: appointment?.id,
    ownerName,
    serviceName,
    petName,
    petId,
    label: getBookingLabel(category),
  };
};

export default function useBookingNotifications({
  activePage,
  token,
  normalizedRole,
  staffType,
  monthAppointments,
  appointmentNotifications,
  apiBaseUrl,
  onOpenAppointment,
}) {
  const [toasts, setToasts] = useState([]);
  const seenAppointmentIdsRef = useRef(new Set());
  const seenBookingToastKeysRef = useRef(new Set());
  const toastSeqRef = useRef(0);
  const toastTimersRef = useRef(new Map());
  const bookingStreamRef = useRef(null);
  const [initialBookingCursor] = useState(() => new Date(Date.now() - 15_000).toISOString());
  const bookingCursorRef = useRef(initialBookingCursor);

  const showDesktopNotification = useCallback((type, message, options = {}) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const appointmentCode = String(options?.appointmentCode || '').trim();
    const appointmentId = String(options?.appointmentId || '').trim();
    const ownerName = String(options?.ownerName || '').trim() || 'Unknown Customer';
    const serviceName = String(options?.serviceName || '').trim() || 'Service';
    const petName = String(options?.petName || '').trim() || 'Pet';
    const petId = String(options?.petId || '').trim() || 'Pet ID';

    try {
      const notif = new Notification('New Booking Alert!', {
        body: `${serviceName} for ${petName} (${petId}) by ${ownerName}.`,
        icon: '/favicon.ico',
        tag: `booking-${appointmentCode || Date.now()}`,
      });
      notif.onclick = () => {
        window.focus();
        onOpenAppointment(appointmentId);
        notif.close();
      };
    } catch {
      // Browser notifications can fail when permission changes during construction.
    }
  }, [onOpenAppointment]);

  const removeToast = useCallback((id) => {
    if (!id) return;
    setToasts((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    const timerId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
      const timeout = toastTimersRef.current.get(id);
      if (timeout) {
        window.clearTimeout(timeout);
        toastTimersRef.current.delete(id);
      }
    }, 220);
    toastTimersRef.current.set(`${id}-exit`, timerId);
  }, []);

  const addToast = useCallback((type, message, options = {}) => {
    const appointmentCode = String(options.appointmentCode || '').trim();
    const nextId = ++toastSeqRef.current;
    const toast = {
      id: nextId,
      type: String(type || 'grooming').toLowerCase(),
      message: String(message || '').trim() || 'New booking received.',
      appointmentCode,
      visible: false,
      leaving: false,
    };

    setToasts((prev) => {
      let next = [...prev, toast];
      if (next.length > TOAST_MAX_VISIBLE) {
        const oldestId = next[0]?.id;
        next = next.slice(next.length - TOAST_MAX_VISIBLE);
        if (oldestId) {
          const timeout = toastTimersRef.current.get(oldestId);
          if (timeout) window.clearTimeout(timeout);
          toastTimersRef.current.delete(oldestId);
        }
      }
      return next;
    });

    window.setTimeout(() => {
      setToasts((prev) => prev.map((item) => (item.id === nextId ? { ...item, visible: true } : item)));
    }, 20);
    toastTimersRef.current.set(nextId, window.setTimeout(() => removeToast(nextId), TOAST_AUTO_DISMISS_MS));
    showDesktopNotification(type, message, options);
  }, [removeToast, showDesktopNotification]);

  useEffect(() => {
    if (!Array.isArray(monthAppointments) || monthAppointments.length === 0) return;
    const currentIds = new Set(monthAppointments.map((appointment) => String(appointment?.id || '')));
    if (seenAppointmentIdsRef.current.size === 0) {
      seenAppointmentIdsRef.current = currentIds;
      return;
    }
    monthAppointments.filter((appointment) => {
      const id = String(appointment?.id || '');
      return id && !seenAppointmentIdsRef.current.has(id);
    }).forEach((appointment) => {
      const dedupeKey = String(appointment?.id || '');
      if (seenBookingToastKeysRef.current.has(dedupeKey)) return;
      const details = getBookingDetails(appointment, 'month');
      addToast(details.category, details.label, details);
      seenBookingToastKeysRef.current.add(dedupeKey);
    });
    seenAppointmentIdsRef.current = currentIds;
  }, [monthAppointments, addToast]);

  useEffect(() => {
    if (!Array.isArray(appointmentNotifications)) return;
    appointmentNotifications.filter((row) => String(row?.status || '').toLowerCase() === 'pending').forEach((appointment) => {
      const dedupeKey = String(appointment?.id || '');
      if (!dedupeKey || seenBookingToastKeysRef.current.has(dedupeKey)) return;
      const details = getBookingDetails(appointment);
      addToast(details.category, details.label, details);
      seenBookingToastKeysRef.current.add(dedupeKey);
    });
  }, [appointmentNotifications, addToast]);

  useEffect(() => {
    const canUseStream = activePage === 'dashboard'
      && Boolean(token)
      && (normalizedRole === 'admin' || (normalizedRole === 'staff' && staffType === 'front_desk'));
    if (!canUseStream) {
      bookingStreamRef.current?.close();
      bookingStreamRef.current = null;
      return undefined;
    }

    let retryTimer = null;
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      bookingStreamRef.current?.close();
      const base = String(apiBaseUrl() || '').replace(/\/$/, '');
      const streamPath = base.endsWith('/api') ? '/admin/appointments/stream' : '/api/admin/appointments/stream';
      const url = new URL(`${base}${streamPath}`, window.location.origin);
      url.searchParams.set('token', token);
      url.searchParams.set('since', bookingCursorRef.current);
      const source = new EventSource(url.toString());
      bookingStreamRef.current = source;
      source.addEventListener('booking', (event) => {
        let payload = {};
        try { payload = JSON.parse(event?.data || '{}'); } catch { payload = {}; }
        if (payload?.cursor) bookingCursorRef.current = String(payload.cursor);
        (Array.isArray(payload?.appointments) ? payload.appointments : []).forEach((appointment) => {
          const dedupeKey = String(appointment?.id || '');
          if (!dedupeKey || seenBookingToastKeysRef.current.has(dedupeKey)) return;
          const details = getBookingDetails(appointment);
          addToast(details.category, details.label, details);
          seenBookingToastKeysRef.current.add(dedupeKey);
        });
      });
      source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) {
          source.close();
          bookingStreamRef.current = null;
          if (!cancelled) retryTimer = window.setTimeout(connect, 3000);
        }
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      bookingStreamRef.current?.close();
      bookingStreamRef.current = null;
    };
  }, [activePage, token, normalizedRole, staffType, apiBaseUrl, addToast]);

  useEffect(() => () => {
    toastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    toastTimersRef.current.clear();
  }, []);

  return { toasts, removeToast };
}
