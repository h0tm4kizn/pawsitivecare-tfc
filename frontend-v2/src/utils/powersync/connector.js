import { UpdateType } from '@powersync/web';
import { apiFetch, getAuthToken } from '../../api/apiClient';

const publishSyncError = (status = 0) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('powersync:sync-error', { detail: { status } }));
};

const clearSyncError = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('powersync:sync-available'));
};

/**
 * PowerSync Backend Connector — Laravel edition
 *
 * fetchCredentials  → calls /api/powersync/token to get a short-lived JWT
 * uploadData        → calls /api/powersync/upload for any pending local writes
 *
 * The connector is instantiated once at module scope (see db.js) and reused
 * for the lifetime of the authenticated session.
 */
export class LaravelBackendConnector {
  /**
   * Called by PowerSync before each sync stream connection (every ~5 min).
   * Must return fresh credentials — never return cached/expired tokens.
   */
  async fetchCredentials() {
    const token = getAuthToken();
    if (!token) {
      // Not authenticated — return null to pause sync until user logs in
      return null;
    }

    try {
      const res = await apiFetch('/api/powersync/token');
      if (!res.ok) {
        publishSyncError(res.status);
        return null;
      }

      const data = await res.json();
      clearSyncError();
      return {
        endpoint: data.data.powersync_url,
        token: data.data.token,
        // expiresAt is optional — PowerSync will refresh when token nears expiry
        expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 min (token is 5 min)
      };
    } catch {
      publishSyncError();
      return null;
    }
  }

  /**
   * Called by PowerSync whenever there are pending local writes.
   * Maps PowerSync CrudEntry operations to the Laravel upload endpoint.
   *
   * CRITICAL: transaction.complete() must always be called, otherwise the
   * upload queue stalls forever.
   */
  async uploadData(database) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const mutations = transaction.crud.map((op) => {
      const type = op.op === UpdateType.DELETE
        ? 'DELETE'
        : op.op === UpdateType.PATCH
          ? 'UPDATE'
          : 'INSERT';

      // Convert 0/1 integers back to booleans for Postgres columns
      const data = op.opData
        ? normalizeBooleans(op.table, { id: op.id, ...op.opData })
        : { id: op.id };

      return { table: op.table, op: type, data };
    });

    try {
      const res = await apiFetch('/api/powersync/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations }),
      });

      if (!res.ok) {
        publishSyncError(res.status);
        // Keep the transaction queued until the server confirms acceptance.
        throw new Error(`PowerSync upload failed (HTTP ${res.status}); pending changes were retained.`);
      }

      await transaction.complete();
    } catch (err) {
      if (!err?.message?.startsWith('PowerSync upload failed')) publishSyncError();
      // Leave the transaction pending. PowerSync owns reconnect/backoff; do not
      // acknowledge or discard local mutations on a failed request.
      throw err;
    }
  }
}

/**
 * Convert PowerSync integer booleans (0/1) back to proper booleans
 * for tables with boolean columns in Postgres.
 */
const BOOLEAN_COLUMNS = {
  pets:          ['is_active'],
  services:      ['is_active', 'needs_cage'],
  service_tiers: [],
  service_addons:['is_active', 'has_size_pricing'],
  hotel_suites:  ['is_available'],
  species_types: ['is_active'],
  breeds:        ['is_active'],
  notifications: ['is_read'],
  appointments:  ['is_full_day_package'],
};

function normalizeBooleans(table, data) {
  const cols = BOOLEAN_COLUMNS[table];
  if (!cols?.length) return data;

  const result = { ...data };
  for (const col of cols) {
    if (col in result) {
      result[col] = Boolean(result[col]);
    }
  }
  return result;
}
