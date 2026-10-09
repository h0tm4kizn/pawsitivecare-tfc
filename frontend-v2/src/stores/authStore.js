import { create } from 'zustand';
import {
  getVolatileAuthToken,
  removeDisposableApiCache,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
  setVolatileAuthToken,
} from '../utils/browserStorage';

const readStoredAuth = () => {
  if (typeof window === 'undefined') return { token: null, user: null };

  const token = safeStorageGet(window.localStorage, 'auth_token') ||
    safeStorageGet(window.sessionStorage, 'auth_token') ||
    getVolatileAuthToken();

  const userRaw = safeStorageGet(window.localStorage, 'auth_user') ||
    safeStorageGet(window.sessionStorage, 'auth_user');

  if (!token || !userRaw) return { token: null, user: null };

  try {
    return { token, user: JSON.parse(userRaw) };
  } catch {
    return { token: null, user: null };
  }
};

const clearStoredAuth = () => {
  if (typeof window === 'undefined') return;
  safeStorageRemove(window.localStorage, 'auth_token');
  safeStorageRemove(window.localStorage, 'auth_user');
  safeStorageRemove(window.sessionStorage, 'auth_token');
  safeStorageRemove(window.sessionStorage, 'auth_user');
};

const writeStoredAuth = ({ token, user, remember }) => {
  if (typeof window === 'undefined') {
    setVolatileAuthToken(token);
    return false;
  }

  const preferred = remember ? window.localStorage : window.sessionStorage;
  const fallback = remember ? window.sessionStorage : window.localStorage;
  const userJson = JSON.stringify(user);
  const persist = (storage) => {
    if (!safeStorageSet(storage, 'auth_token', token) || !safeStorageSet(storage, 'auth_user', userJson)) {
      safeStorageRemove(storage, 'auth_token');
      safeStorageRemove(storage, 'auth_user');
      return false;
    }
    return storage;
  };

  let persistedStorage = persist(preferred);
  if (!persistedStorage) {
    // API JSON cache entries are disposable; reclaim only that namespace and retry.
    removeDisposableApiCache();
    persistedStorage = persist(preferred);
  }
  if (!persistedStorage) persistedStorage = persist(fallback);

  setVolatileAuthToken(token);
  if (!persistedStorage) {
    safeStorageRemove(preferred, 'auth_token');
    safeStorageRemove(preferred, 'auth_user');
    safeStorageRemove(fallback, 'auth_token');
    safeStorageRemove(fallback, 'auth_user');
  } else {
    const otherStorage = persistedStorage === preferred ? fallback : preferred;
    safeStorageRemove(otherStorage, 'auth_token');
    safeStorageRemove(otherStorage, 'auth_user');
  }
  return Boolean(persistedStorage);
};

const initialAuth = readStoredAuth();

const connectPowerSync = async () => {
  const module = await import('../utils/powersync/db');
  return module.connectPowerSync();
};

const disconnectPowerSync = async () => {
  const module = await import('../utils/powersync/db');
  return module.disconnectPowerSync();
};

// Reconnect PowerSync on page reload if a session already exists
if (initialAuth.token) {
  // Deferred so the module finishes loading before db.js is imported
  setTimeout(() => connectPowerSync(), 0);
}

export const useAuthStore = create((set, get) => ({
  token: initialAuth.token,
  user: initialAuth.user,
  isAuthenticated: Boolean(initialAuth.token),

  role: () => get().user?.role?.toLowerCase() || null,

  login: ({ token, user, remember = false }) => {
    const authPersisted = writeStoredAuth({ token, user, remember });
    set({ token, user, isAuthenticated: true, authStorageUnavailable: !authPersisted });
    // Start offline-first sync after login
    connectPowerSync();
  },

  logout: () => {
    clearStoredAuth();
    setVolatileAuthToken(null);
    set({ token: null, user: null, isAuthenticated: false, authStorageUnavailable: false });
    // Wipe local SQLite so the next user doesn't see stale data
    disconnectPowerSync();
  },

  updateUser: (patch) => {
    const nextUser =
      typeof patch === 'function'
        ? patch(get().user)
        : { ...get().user, ...patch };

    const token = get().token;
    let authPersisted = !token || !nextUser;
    if (token && nextUser && typeof window !== 'undefined') {
      const storage = safeStorageGet(window.localStorage, 'auth_token')
        ? window.localStorage
        : window.sessionStorage;
      authPersisted = safeStorageSet(storage, 'auth_user', JSON.stringify(nextUser));
      if (!authPersisted) {
        removeDisposableApiCache();
        authPersisted = safeStorageSet(storage, 'auth_user', JSON.stringify(nextUser));
      }
    }

    set({ user: nextUser, authStorageUnavailable: !authPersisted });
  },
}));
