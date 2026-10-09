import { useEffect, useState } from 'react';
import { useStatus } from '@powersync/react';

/**
 * Returns the current online/offline state based on two signals:
 *  1. browser navigator.onLine  — fast, but unreliable (can say "online" on a captive portal)
 *  2. PowerSync connection status — authoritative: connected = sync stream is live = Supabase reachable
 *
 * isOnline  = true   → REST API calls to Supabase will succeed → use Supabase directly
 * isOffline = true   → fall back to PowerSync local SQLite
 * isSyncing          → PowerSync is actively downloading changes from Supabase
 * hasPendingUploads  → there are local writes waiting to be pushed to Supabase
 */
export function useNetworkStatus() {
  const status = useStatus();
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);

  useEffect(() => {
    const setOnline  = () => setBrowserOnline(true);
    const setOffline = () => setBrowserOnline(false);
    window.addEventListener('online',  setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online',  setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  const powersyncConnected = status?.connected ?? false;

  return {
    // Both signals must agree: browser says online AND PowerSync sync stream is live
    isOnline:          browserOnline && powersyncConnected,
    isOffline:         !browserOnline || !powersyncConnected,
    // PowerSync-specific status
    isSyncing:         status?.dataFlowStatus?.downloading ?? false,
    hasPendingUploads: status?.dataFlowStatus?.uploading   ?? false,
    // Raw for advanced use
    powersyncConnected,
    browserOnline,
  };
}
