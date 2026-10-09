import { getVolatileAuthToken, safeStorageGet, safeStorageRemove } from '../utils/browserStorage';

const sanitizeApiBaseUrl = (value) => {
  let base = String(value || '').trim();
  base = base.replace(/^VITE_API_URL\s*=\s*/i, '').trim();
  base = base.replace(/^['"]|['"]$/g, '');
  base = base.replace(/^https:\/(?!\/)/i, 'https://');
  base = base.replace(/^http:\/(?!\/)/i, 'http://');
  return base || 'http://127.0.0.1:8000';
};

const rawApiBaseUrl = sanitizeApiBaseUrl(import.meta.env.VITE_API_URL);
const inflightGetRequests = new Map();
const OFFLINE_MUTATION_QUEUE_KEY = 'api_offline_mutation_queue_v1';
let isFlushingOfflineQueue = false;

// Once we find a working base URL we remember it for the session so every
// subsequent request is a direct hit — no retry loop, no wasted roundtrips.
let _confirmedBase = null;
let _baseProbePromise = null; // deduplicate concurrent probes

const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return rawApiBaseUrl;
  if (navigator.onLine === false) return rawApiBaseUrl;
  if (window.location.protocol !== 'https:') return rawApiBaseUrl;

  try {
    const parsed = new URL(rawApiBaseUrl, window.location.origin);
    const localHosts = new Set(['localhost', '127.0.0.1']);
    if (parsed.protocol === 'http:' && !localHosts.has(parsed.hostname)) {
      parsed.protocol = 'https:';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // keep original
  }
  return rawApiBaseUrl;
};

if (!import.meta.env.VITE_API_URL) {
  console.warn('VITE_API_URL is not set. Using http://127.0.0.1:8000 for local development.');
}

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return safeStorageGet(window.localStorage, 'auth_token') ||
    safeStorageGet(window.sessionStorage, 'auth_token') ||
    getVolatileAuthToken();
};

const readOfflineMutationQueue = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_MUTATION_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOfflineMutationQueue = (queue) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_MUTATION_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort
  }
};

const enqueueOfflineMutation = (entry) => {
  const queue = readOfflineMutationQueue();
  queue.push(entry);
  writeOfflineMutationQueue(queue);
};

const flushOfflineMutationQueue = async () => {
  if (typeof window === 'undefined' || !navigator.onLine || isFlushingOfflineQueue) return;
  isFlushingOfflineQueue = true;
  try {
    let queue = readOfflineMutationQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        const response = await fetch(`${getApiBaseUrl()}${item.path}`, {
          method: item.method,
          headers: buildHeaders(item.headers || {}),
          body: item.body,
        });
        if (!response.ok && response.status >= 500) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    writeOfflineMutationQueue(remaining);
  } finally {
    isFlushingOfflineQueue = false;
  }
};

const buildHeaders = (headers = {}) => {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const normalizeBase = (base) => String(base || '').replace(/\/+$/, '');

const getBaseCandidates = () => {
  const candidates = [];
  const push = (value) => {
    const v = normalizeBase(value);
    if (!v || candidates.includes(v)) return;
    candidates.push(v);
  };
  push(getApiBaseUrl());
  push(rawApiBaseUrl);
  if (typeof window !== 'undefined' && !candidates.some((base) => base === '/api' || base.endsWith('/api'))) {
    push(`${window.location.origin}/api`);
  }
  return candidates;
};

const getPathCandidates = (path) => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const normalizedBase = String(rawApiBaseUrl || '').replace(/\/+$/, '');
  if (normalizedBase === '/api' || normalizedBase.endsWith('/api')) {
    return [normalized.startsWith('/api/') ? normalized.slice(4) : normalized];
  }
  const alt = normalized.startsWith('/api/') ? normalized.slice(4) : `/api${normalized}`;
  return Array.from(new Set([normalized, alt]));
};

/**
 * Race all base+path combinations in parallel and return the first
 * non-404 response. Caches the winning base URL so every subsequent
 * call skips straight to it.
 */
const probeAndFetch = (normalizedPath, options) => {
  const bases = getBaseCandidates();
  const paths = getPathCandidates(normalizedPath);
  const combinations = bases.flatMap((base) => paths.map((p) => ({ base, p })));

  return new Promise((resolve, reject) => {
    let remaining = combinations.length;
    let lastResponse = null;
    let done = false;

    for (const { base, p } of combinations) {
      fetch(`${base}${p}`, { ...options, headers: buildHeaders(options.headers) })
        .then((response) => {
          if (done) return;
          if (response.status !== 404) {
            done = true;
            _confirmedBase = base;
            resolve({ response });
          } else {
            lastResponse = response;
          }
        })
        .catch(() => {
          // swallow — handled in finally
        })
        .finally(() => {
          remaining -= 1;
          if (remaining === 0 && !done) {
            done = true;
            if (lastResponse) {
              resolve({ response: lastResponse });
            } else {
              reject(new Error('All API base URL candidates failed.'));
            }
          }
        });
    }
  });
};

export const apiFetch = async (path, options = {}) => {
  let normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBase = String(rawApiBaseUrl || '').replace(/\/+$/, '');
  if ((normalizedBase === '/api' || normalizedBase.endsWith('/api')) && normalizedPath.startsWith('/api/')) {
    normalizedPath = normalizedPath.slice(4);
  }
  const method = String(options.method || 'GET').toUpperCase();
  const notifyMutation = response => {
    if (method !== 'GET' && method !== 'HEAD' && response.ok && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('admin-data-changed'));
    }
    return response;
  };

  flushOfflineMutationQueue().catch(() => {});

  // Relative API bases (for example `/api` through the Vite proxy) are already
  // known-good routes. Sending them through the global base probe can make
  // unrelated requests wait behind a long-lived endpoint such as the booking
  // event stream. Fetch these routes directly so page data loads independently.
  if (normalizedBase.startsWith('/')) {
    const directPath = `${normalizedBase}${normalizedPath}`;
    const directResponse = await fetch(directPath, {
      ...options,
      headers: buildHeaders(options.headers),
    });

    return notifyMutation(directResponse);
  }

  let response;

  if (_confirmedBase) {
    // Fast path: use the already-confirmed base URL directly.
    try {
      response = await fetch(`${_confirmedBase}${normalizedPath}`, {
        ...options,
        headers: buildHeaders(options.headers),
      });
      // If confirmed base now returns 404 it may have moved — re-probe.
      if (response.status === 404) {
        _confirmedBase = null;
        const result = await probeAndFetch(normalizedPath, options);
        response = result.response;
      }
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // Confirmed base unreachable — invalidate and re-probe.
      _confirmedBase = null;
      const result = await probeAndFetch(normalizedPath, options);
      response = result.response;
    }
  } else {
    // First request (or after invalidation): probe all candidates in parallel.
    // Deduplicate concurrent probes so we don't fire N×M requests simultaneously.
    if (!_baseProbePromise) {
      _baseProbePromise = probeAndFetch(normalizedPath, options).finally(() => {
        _baseProbePromise = null;
      });
    } else {
      // Another probe is already in flight — wait for it then use confirmed base.
      await _baseProbePromise.catch(() => {});
      if (_confirmedBase) {
        try {
          response = await fetch(`${_confirmedBase}${normalizedPath}`, {
            ...options,
            headers: buildHeaders(options.headers),
          });
        } catch {
          throw new Error('Request failed after base probe.');
        }
        return notifyMutation(response);
      }
    }
    const result = await _baseProbePromise || await probeAndFetch(normalizedPath, options);
    response = result.response;
  }

  return notifyMutation(response);
};

const shouldDedupeGet = (options = {}) => {
  if (options?.signal) return false;
  if (options?.cache === 'no-store') return false;
  if (options?.headers?.['x-skip-dedupe'] === 'true') return false;
  return true;
};

const getDedupeKey = (path, options = {}) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const token = getAuthToken() || '';
  return `GET:${normalizedPath}:${token}:${JSON.stringify(options.headers || {})}`;
};

export const apiGet = (path, options = {}) => {
  const requestOptions = { method: 'GET', ...options };
  if (!shouldDedupeGet(requestOptions)) {
    return apiFetch(path, requestOptions);
  }

  const key = getDedupeKey(path, requestOptions);
  const existing = inflightGetRequests.get(key);
  if (existing) {
    return existing.then((response) => response.clone());
  }

  const request = apiFetch(path, requestOptions).finally(() => {
    inflightGetRequests.delete(key);
  });

  inflightGetRequests.set(key, request);
  return request.then((response) => response.clone());
};

export const apiDelete = (path, options = {}) => apiFetch(path, { method: 'DELETE', ...options });

export const apiPost = (path, body) =>
  apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function apiClient(endpoint, { method = 'GET', headers = {}, body, skipAuthRedirect = false, ...customConfig } = {}) {
  const response = await apiFetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    ...customConfig,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !skipAuthRedirect) {
    safeStorageRemove(window.localStorage, 'auth_token');
    safeStorageRemove(window.localStorage, 'auth_user');
    safeStorageRemove(window.sessionStorage, 'auth_token');
    safeStorageRemove(window.sessionStorage, 'auth_user');
    window.location.href = '/';
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 403) {
    const error = new Error(data.message || "You don't have permission to do that.");
    error.status = 403;
    error.data = data;
    throw error;
  }

  if (response.status === 422) {
    const error = new Error(data.message || 'Validation failed.');
    error.status = 422;
    error.errors = data.errors || {};
    error.data = data;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export default apiClient;
