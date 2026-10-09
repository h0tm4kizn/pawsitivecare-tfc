export const resolvePaymentProofUrl = (path) => {
  if (!path) return null;
  const value = String(path);
  if (/^https?:\/\//i.test(value)) return value;
  if (typeof window === 'undefined') return value;

  const apiBase = String(import.meta.env.VITE_API_URL || window.location.origin);
  try {
    const backend = new URL(apiBase, window.location.origin);
    backend.pathname = backend.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '');
    return `${backend.origin}${backend.pathname}/${value.replace(/^\//, '')}`;
  } catch {
    return `${window.location.origin}/${value.replace(/^\//, '')}`;
  }
};
