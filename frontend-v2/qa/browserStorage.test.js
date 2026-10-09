import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVolatileAuthToken,
  removeDisposableApiCache,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
  setVolatileAuthToken,
} from '../src/utils/browserStorage.js';

test('storage access failures are contained', () => {
  const unavailable = {
    getItem() { throw new DOMException('Blocked', 'SecurityError'); },
    setItem() { throw new DOMException('Full', 'QuotaExceededError'); },
    removeItem() { throw new DOMException('Blocked', 'SecurityError'); },
  };

  assert.equal(safeStorageGet(unavailable, 'key'), null);
  assert.equal(safeStorageSet(unavailable, 'key', 'value'), false);
  assert.doesNotThrow(() => safeStorageRemove(unavailable, 'key'));
});

test('disposable API cache cleanup leaves auth and offline queue keys intact', () => {
  const entries = new Map([
    ['api_cache_v1:staff:/api/customers', '{}'],
    ['auth_token', 'session-token-placeholder'],
    ['api_offline_mutation_queue_v1', '[]'],
  ]);
  globalThis.window = {
    localStorage: {
      get length() { return entries.size; },
      key(index) { return [...entries.keys()][index] ?? null; },
      removeItem(key) { entries.delete(key); },
    },
  };

  removeDisposableApiCache();

  assert.deepEqual([...entries.keys()], ['auth_token', 'api_offline_mutation_queue_v1']);
  delete globalThis.window;
});

test('volatile auth token is available when persistent storage is unavailable', () => {
  setVolatileAuthToken('in-memory-session-token');
  assert.equal(getVolatileAuthToken(), 'in-memory-session-token');
  setVolatileAuthToken(null);
  assert.equal(getVolatileAuthToken(), null);
});
