import { useEffect, useState } from 'react';
import { useNetworkStatus } from '../utils/powersync/useNetworkStatus';
import { retryPowerSyncConnection } from '../utils/powersync/db';

/**
 * Sticky banner for true offline mode and queued PowerSync uploads.
 * A disconnected PowerSync stream by itself should not imply the Laravel API is down.
 */
export default function OfflineBanner() {
  const { hasPendingUploads, browserOnline, powersyncConnected } = useNetworkStatus();
  const [syncError, setSyncError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onError = (event) => setSyncError(event.detail?.status || 0);
    const onAvailable = () => setSyncError(null);
    window.addEventListener('powersync:sync-error', onError);
    window.addEventListener('powersync:sync-available', onAvailable);
    return () => {
      window.removeEventListener('powersync:sync-error', onError);
      window.removeEventListener('powersync:sync-available', onAvailable);
    };
  }, []);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    await retryPowerSyncConnection();
    setRetrying(false);
  };

  if (syncError && browserOnline) {
    const message = syncError === 401 || syncError === 403
      ? 'Sync authentication failed. Sign in again to resume synchronization.'
      : syncError === 503
        ? 'Sync is temporarily unavailable. Offline changes remain saved on this device.'
        : 'Synchronization is unavailable. Offline changes remain saved on this device.';
    return (
      <div role="status" className="fixed bottom-0 inset-x-0 z-[200] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
        <span>{message}</span>
        <button type="button" onClick={retry} disabled={retrying} className="rounded bg-white/20 px-2 py-1 underline disabled:opacity-60">
          {retrying ? 'Retrying…' : 'Retry sync'}
        </button>
      </div>
    );
  }

  if (hasPendingUploads && browserOnline && powersyncConnected) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[200] flex items-center justify-center gap-2 bg-brand-teal px-4 py-2 text-xs font-semibold text-white shadow-lg">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white/70" />
        Syncing offline changes to Supabase...
      </div>
    );
  }

  if (hasPendingUploads && (!browserOnline || !powersyncConnected)) {
    const reason = browserOnline ? 'Sync service unreachable' : 'No internet connection';

    return (
      <div className="fixed bottom-0 inset-x-0 z-[200] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
        <i className="fa-solid fa-wifi-slash text-sm" />
        <span>{reason} - saved changes will sync when connection returns.</span>
      </div>
    );
  }

  if (!browserOnline) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[200] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
        <i className="fa-solid fa-wifi-slash text-sm" />
        <span>No internet connection - showing cached data.</span>
      </div>
    );
  }

  return null;
}
