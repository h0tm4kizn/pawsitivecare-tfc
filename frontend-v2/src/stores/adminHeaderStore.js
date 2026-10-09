import { create } from 'zustand';
import { apiFetch, apiGet } from '../api/apiClient';

const NOTIF_READ_KEY = 'admin_header_notif_read';

const readNotifIdsFromStorage = () => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(NOTIF_READ_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const saveNotifIdsToStorage = (ids) => {
  try {
    window.localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(ids));
  } catch {
    // no-op
  }
};

const extractArray = (data) => {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data)) return data;
  return [];
};

export const useAdminHeaderStore = create((set, get) => ({
  messages: [],
  notifications: [],
  appointmentNotifications: [],
  messageLoading: false,
  notificationLoading: false,
  notificationsDisabled: false,
  notifReadIds: typeof window !== 'undefined' ? readNotifIdsFromStorage() : [],
  lastMessagesLoadedAt: 0,
  lastNotificationsLoadedAt: 0,

  loadMessages: async ({ force = false } = {}) => {
    if (!force && get().lastMessagesLoadedAt && Date.now() - get().lastMessagesLoadedAt < 300_000) return;
    set({ messageLoading: true });
    try {
      const res = await apiGet('/api/admin/contact-messages');
      const data = await res.json().catch(() => ({}));
      const rows = extractArray(data);
      set({ messages: rows, messageLoading: false, lastMessagesLoadedAt: Date.now() });
    } catch {
      set({ messageLoading: false });
    }
  },

  markMessageRead: async (id) => {
    if (!id) return;
    set((state) => ({
      messages: state.messages.map((row) => (row.id === id ? { ...row, is_read: true } : row)),
    }));
    try {
      await apiFetch(`/api/admin/contact-messages/${id}/read`, { method: 'PATCH' });
    } catch {
      // no-op
    }
  },

  deleteMessage: async (id) => {
    if (!id) return { ok: false, message: 'Invalid message id.' };
    try {
      const res = await apiFetch(`/api/admin/contact-messages/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, message: data?.message || 'Failed to delete message.' };
      }
      set((state) => ({ messages: state.messages.filter((row) => row.id !== id) }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error?.message || 'Failed to delete message.' };
    }
  },

  replyToMessage: async (id, replyText) => {
    if (!id || !String(replyText || '').trim()) {
      return { ok: false, message: 'Reply is required.' };
    }
    try {
      const res = await apiFetch(`/api/admin/contact-messages/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: String(replyText).trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: data?.message || 'Failed to send reply.' };
      }
      set((state) => ({
        messages: state.messages.map((row) => (row.id === id ? { ...row, is_read: true } : row)),
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error?.message || 'Failed to send reply.' };
    }
  },

  loadNotifications: async ({ force = false } = {}) => {
    if (get().notificationsDisabled) return;
    if (!force && get().lastNotificationsLoadedAt && Date.now() - get().lastNotificationsLoadedAt < 300_000) return;
    set({ notificationLoading: true });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      // Fetch notifications and appointments in parallel instead of sequentially
      const [nRes, aRes] = await Promise.all([
        apiGet('/api/notifications'),
        apiGet('/api/appointments?per_page=12', { signal: controller.signal }).catch(() => null),
      ]);
      clearTimeout(timer);

      if (nRes.status === 401 || nRes.status === 403) {
        set({ notificationLoading: false, notificationsDisabled: true });
        return;
      }

      const nData = await nRes.json().catch(() => ({}));
      let appointments = [];
      try {
        const aData = aRes ? await aRes.json().catch(() => ({})) : {};
        appointments = extractArray(aData)
          .filter((row) => ['pending', 'approved'].includes(String(row?.status || '').toLowerCase()))
          .slice(0, 12);
      } catch {
        appointments = [];
      }

      set({
        notifications: extractArray(nData),
        appointmentNotifications: appointments,
        notificationLoading: false,
        lastNotificationsLoadedAt: Date.now(),
      });
    } catch {
      set({ notificationLoading: false });
    }
  },

  markNotificationRead: (id) => {
    if (!id) return;
    const next = new Set(get().notifReadIds);
    next.add(id);
    const arr = [...next];
    saveNotifIdsToStorage(arr);
    set({ notifReadIds: arr });
  },

  markAllNotificationsRead: (ids) => {
    const next = new Set(get().notifReadIds);
    (ids || []).forEach((id) => next.add(id));
    const arr = [...next];
    saveNotifIdsToStorage(arr);
    set({ notifReadIds: arr });
  },

  // Delete a single notification (system notification record)
  deleteNotification: async (notificationId) => {
    if (!notificationId) return { ok: false, message: 'Invalid id.' };
    try {
      const res = await apiFetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, message: data?.message || 'Failed to delete notification.' };
      }
      // remove from notifications list
      set((state) => ({ notifications: state.notifications.filter((row) => String(row.id) !== String(notificationId)) }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error?.message || 'Failed to delete notification.' };
    }
  },

  // Delete multiple notifications by id
  deleteNotifications: async (ids = []) => {
    const valid = (ids || []).filter(Boolean);
    if (valid.length === 0) return { ok: false, message: 'No ids provided.' };
    try {
      await Promise.all(valid.map((id) => apiFetch(`/api/notifications/${id}`, { method: 'DELETE' })));
      set((state) => ({ notifications: state.notifications.filter((row) => !valid.includes(String(row.id))) }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error?.message || 'Failed to delete notifications.' };
    }
  },
}));
