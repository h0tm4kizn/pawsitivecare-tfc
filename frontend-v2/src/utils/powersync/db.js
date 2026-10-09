import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';
import { LaravelBackendConnector } from './connector';

/**
 * PowerSync singleton — created once at module scope.
 *
 * IMPORTANT: Never create PowerSyncDatabase inside useEffect — React Strict Mode
 * double-invokes effects, which destroys the shared-worker proxy on the first
 * unmount before the second mount can use it.
 */
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'pawsitivecare.db',
  },
});

export const connector = new LaravelBackendConnector();

// The local launcher can force Laravel onto the SQLite snapshot. In that
// mode the browser must not reconnect to PowerSync and silently switch the
// UI back to cloud-backed rows when internet happens to be available.
export const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';
let lastManualRetryAt = 0;

/**
 * Call after the user logs in with a valid Sanctum token.
 * Starts the background sync stream and upload loop.
 */
export function connectPowerSync() {
  if (isLocalMode) return;
  // Keep sync connection failures isolated from application rendering.
  db.connect(connector).catch(() => {});
}

/** Retry only after an explicit user action; normal reconnect backoff stays with PowerSync. */
export function retryPowerSyncConnection() {
  if (isLocalMode) return Promise.resolve(false);
  const now = Date.now();
  if (now - lastManualRetryAt < 5000) return Promise.resolve(false);
  lastManualRetryAt = now;
  return db.connect(connector).then(() => true).catch(() => false);
}

/**
 * Call on logout. Disconnects from the sync stream and wipes the local
 * SQLite database so the next user doesn't see stale data.
 */
export async function disconnectPowerSync() {
  await db.disconnectAndClear();
}
