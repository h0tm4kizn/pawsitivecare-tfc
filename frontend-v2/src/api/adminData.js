import { apiGet, getAuthToken } from './apiClient';

const cache = new Map();
const pending = new Map();
let cacheEpoch = 0;
if (typeof window !== 'undefined') window.addEventListener('admin-data-changed', () => { cache.clear(); cacheEpoch += 1; });
const TTL = 5 * 60 * 1000;
const sessionKey = key => `${getAuthToken() || 'guest'}:${key}`;

export function readAdminCache(key) {
  return cache.get(sessionKey(key));
}

export function writeAdminCache(key, data) {
  cache.set(sessionKey(key), { data, at: Date.now() });
}

export function loadAdminResource(key, loader, { force = false } = {}) {
  const scopedKey = sessionKey(key);
  const entry = cache.get(scopedKey);
  if (!force && entry && Date.now() - entry.at < TTL) return Promise.resolve(entry.data);
  if (!force && pending.has(scopedKey)) return pending.get(scopedKey);
  const epoch = cacheEpoch;
  const request = Promise.resolve().then(loader).then(data => {
    if (pending.get(scopedKey) === request && epoch === cacheEpoch) cache.set(scopedKey, { data, at: Date.now() });
    return data;
  }).finally(() => { if (pending.get(scopedKey) === request) pending.delete(scopedKey); });
  pending.set(scopedKey, request);
  return request;
}

export async function adminGet(path) {
  // Let the API finish instead of surfacing a timeout banner over the page.
  // Callers keep their existing data visible while this request is pending.
  return apiGet(path);
}

export async function adminJson(path) {
  const response = await adminGet(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Unable to load records. Please retry.');
  return data;
}
