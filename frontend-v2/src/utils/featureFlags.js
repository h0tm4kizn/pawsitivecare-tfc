import { useEffect, useState } from 'react';
import { safeStorageGet, safeStorageSet } from './browserStorage';

export const SUPPLIES_FEATURE_STORAGE_KEY = 'pawsitivecare.suppliesFeatureEnabled';
const SUPPLIES_FEATURE_EVENT = 'pawsitivecare:supplies-feature-changed';

export const getSuppliesFeatureEnabled = () => {
  if (typeof window === 'undefined') return true;
  return safeStorageGet(window.localStorage, SUPPLIES_FEATURE_STORAGE_KEY) !== 'false';
};

export const setSuppliesFeatureEnabled = (enabled) => {
  if (typeof window === 'undefined') return;
  safeStorageSet(window.localStorage, SUPPLIES_FEATURE_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(SUPPLIES_FEATURE_EVENT, { detail: { enabled } }));
};

export const useSuppliesFeatureEnabled = () => {
  const [enabled, setEnabled] = useState(() => getSuppliesFeatureEnabled());

  useEffect(() => {
    const sync = () => setEnabled(getSuppliesFeatureEnabled());
    window.addEventListener('storage', sync);
    window.addEventListener(SUPPLIES_FEATURE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SUPPLIES_FEATURE_EVENT, sync);
    };
  }, []);

  return [enabled, setSuppliesFeatureEnabled];
};
