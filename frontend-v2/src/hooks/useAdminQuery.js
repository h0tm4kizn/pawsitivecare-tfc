import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAdminResource, readAdminCache, writeAdminCache } from '../api/adminData';

export default function useAdminQuery(key, loader, initialData, { enabled = true } = {}) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const version = useRef(0);
  const [state, setState] = useState(() => {
    const cached = readAdminCache(key);
    return { data: cached ? cached.data : initialData, loaded: Boolean(cached), pending: !cached, error: '' };
  });
  const refresh = useCallback(async ({ force = true } = {}) => {
    if (!enabled) return;
    const request = ++version.current;
    setState(s => ({ ...s, pending: true, error: '' }));
    try {
      const load = loaderRef.current;
      const data = await loadAdminResource(key, load, { force });
      if (request === version.current) setState({ data, loaded: true, pending: false, error: '' });
      return data;
    } catch (error) {
      if (request === version.current) setState(s => ({ ...s, pending: false, error: error.message || 'Unable to load records.' }));
    }
  }, [key, enabled]);
  useEffect(() => {
    refresh({ force: false });
    const handleAdminMutation = () => refresh({ force: true });
    window.addEventListener('admin-data-changed', handleAdminMutation);
    return () => {
      version.current += 1;
      window.removeEventListener('admin-data-changed', handleAdminMutation);
    };
  }, [refresh]);
  const setData = useCallback(update => setState(s => {
    const data = typeof update === 'function' ? update(s.data) : update;
    writeAdminCache(key, data);
    return { ...s, data };
  }), [key]);
  return { data: state.data, setData, loading: !state.loaded && state.pending, refreshing: state.loaded && state.pending, loaded: state.loaded, error: state.error, refresh };
}
