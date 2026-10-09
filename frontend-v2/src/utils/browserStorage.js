export const safeStorageGet = (storage, key) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const safeStorageSet = (storage, key, value) => {
  try {
    storage?.setItem(key, String(value));
    return Boolean(storage);
  } catch {
    return false;
  }
};

export const safeStorageRemove = (storage, key) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing or after quota exhaustion.
  }
};

export const removeDisposableApiCache = () => {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith('api_cache_v1:')) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // The API response cache is optional; never let cleanup break the app.
  }
};

let volatileAuthToken = null;

export const setVolatileAuthToken = (token) => {
  volatileAuthToken = token || null;
};

export const getVolatileAuthToken = () => volatileAuthToken;
