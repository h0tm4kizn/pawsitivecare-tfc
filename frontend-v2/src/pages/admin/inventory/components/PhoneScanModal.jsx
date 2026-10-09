import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiFetch } from '../../../../api/apiClient';

const POLL_INTERVAL = 1500;
const SESSION_TTL   = 120;

function isHosted() {
  const h = window.location.hostname;
  return (
    h !== 'localhost' &&
    h !== '127.0.0.1' &&
    !/^192\.168\./.test(h) &&
    !/^10\./.test(h) &&
    !/^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

// Windows Mobile Hotspot always assigns this IP to the PC
const HOTSPOT_FALLBACK_IP = '192.168.137.1';

async function fetchServerIp() {
  try {
    const res  = await apiFetch('/api/scan-sessions/server-ip', { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    return data.ip || HOTSPOT_FALLBACK_IP;
  } catch {
    return HOTSPOT_FALLBACK_IP;
  }
}

export default function PhoneScanModal({ onScan, onClose }) {
  const hosted = isHosted();

  const [lanIp, setLanIp]         = useState(hosted ? window.location.hostname : null);
  const [detecting, setDetecting] = useState(!hosted);
  const [token, setToken]         = useState(null);
  const [error, setError]         = useState('');
  const [expired, setExpired]     = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_TTL);
  const pollRef  = useRef(null);
  const timerRef = useRef(null);

  const port    = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;
  const scanUrl  = token && (hosted || lanIp)
    ? hosted
      ? `${window.location.origin}/scan/${token}`
      : `${protocol}//${lanIp}${port}/scan/${token}`
    : null;

  const createSession = useCallback(async () => {
    setError('');
    setExpired(false);
    setSecondsLeft(SESSION_TTL);
    try {
      const res  = await apiFetch('/api/scan-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Could not create scan session.');
      setToken(data.token);
    } catch (err) {
      setError(err?.message || 'Failed to start scan session.');
    }
  }, []);

  useEffect(() => {
    if (hosted) {
      createSession();
      return;
    }
    fetchServerIp().then((ip) => {
      setDetecting(false);
      setLanIp(ip);
      createSession();
    });
  }, [hosted, createSession]);

  // Countdown
  useEffect(() => {
    if (!token || expired) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { setExpired(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [token, expired]);

  // Poll for result
  useEffect(() => {
    if (!token || expired) return;
    pollRef.current = setInterval(async () => {
      try {
        const res  = await apiGet(`/api/scan-sessions/${token}`);
        const data = await res.json().catch(() => ({}));
        if (data.status === 'scanned' && data.barcode) {
          clearInterval(pollRef.current);
          onScan(data.barcode);
          onClose();
        } else if (data.status === 'expired') {
          clearInterval(pollRef.current);
          setExpired(true);
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [token, expired, onScan, onClose]);

  function handleRetry() {
    setToken(null);
    setError('');
    setExpired(false);
    if (hosted) {
      createSession();
    } else {
      setDetecting(true);
      fetchServerIp().then((ip) => {
        setDetecting(false);
        setLanIp(ip);
        createSession();
      });
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
          <div className="flex items-center gap-2">
            <Smartphone size={15} className="text-white" strokeWidth={2.5} />
            <h2 className="text-sm font-extrabold text-white">Scan with Phone</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        <div className="flex flex-col items-center gap-4 px-5 py-5">

          {detecting && (
            <p className="text-center text-xs font-semibold text-brand-dark-soft">
              Detecting network address...
            </p>
          )}

          {!detecting && !hosted && lanIp && !error && (
            <p className="w-full rounded-lg bg-brand-teal/8 px-3 py-1.5 text-center text-[11px] font-semibold text-brand-teal">
              Network: <span className="font-extrabold">{lanIp}</span>
            </p>
          )}

          {error && (
            <div className="flex w-full flex-col gap-2">
              <p className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
                {error}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark"
              >
                Try Again
              </button>
            </div>
          )}

          {!error && !expired && scanUrl && (
            <>
              <p className="text-center text-xs font-semibold text-brand-dark-soft">
                {hosted
                  ? 'Open your phone camera and scan this QR code.'
                  : 'Open your phone camera and scan this QR code. Your phone must be on the same WiFi.'}
              </p>
              <div className="rounded-xl border-2 border-brand-teal/20 p-3">
                <QRCodeSVG value={scanUrl} size={180} />
              </div>
              <div className="flex w-full items-center justify-between rounded-lg bg-brand-surface px-3 py-2">
                <span className="text-[11px] font-semibold text-brand-dark-soft">Waiting for scan...</span>
                <span className={`text-[11px] font-bold tabular-nums ${secondsLeft <= 20 ? 'text-red-500' : 'text-brand-teal'}`}>
                  {secondsLeft}s
                </span>
              </div>
            </>
          )}

          {expired && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-sm font-semibold text-brand-dark-soft">Session expired.</p>
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark"
              >
                Generate New QR
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-brand-dark-light py-2.5 text-sm font-bold text-brand-dark-soft hover:bg-brand-dark-light"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
