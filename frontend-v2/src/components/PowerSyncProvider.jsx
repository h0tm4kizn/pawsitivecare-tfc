import { Suspense } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { db } from '../utils/powersync/db.js';
import OfflineBanner from './OfflineBanner.jsx';

export default function PowerSyncProvider({ children }) {
  return (
    <PowerSyncContext.Provider value={db}>
      <Suspense fallback={null}>{children}</Suspense>
      <OfflineBanner />
    </PowerSyncContext.Provider>
  );
}
