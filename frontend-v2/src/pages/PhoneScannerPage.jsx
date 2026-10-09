import { BrowserMultiFormatReader } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

function getApiBase() {
  return window.location.origin;
}

async function applyAutofocus(track) {
  if (!track) return;
  try {
    const caps = track.getCapabilities?.() || {};
    if (caps.focusMode?.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    } else if (caps.focusMode?.includes('auto')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'auto' }] });
    }
  } catch { /* unsupported */ }
}

const VIDEO_CONSTRAINTS = {
  facingMode: { ideal: 'environment' },
  width:  { ideal: 1920 },
  height: { ideal: 1080 },
};

const NATIVE_FORMATS = [
  'ean_13', 'ean_8', 'code_128', 'code_39',
  'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code',
];

export default function PhoneScannerPage() {
  const { token } = useParams();
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const controlsRef = useRef(null);
  const rafRef      = useRef(null);

  const [status, setStatus]   = useState('scanning');
  const [message, setMessage] = useState('');
  // Incrementing this key restarts the scanner (Try Again)
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function sendBarcode(value) {
      setStatus('sending');
      try {
        const res = await fetch(`${getApiBase()}/api/scan-sessions/${token}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body:    JSON.stringify({ barcode: value }),
          signal:  AbortSignal.timeout(12000), // 12 s timeout
        });
        if (cancelled) return;
        if (res.ok) {
          setStatus('success');
          setMessage('Barcode sent! You can close this page.');
        } else if (res.status === 404) {
          setStatus('expired');
          setMessage('Session expired. Please generate a new QR code on the desktop.');
        } else if (res.status === 403) {
          setStatus('error');
          setMessage('Your phone is not on the same WiFi network as the desktop.');
        } else {
          setStatus('error');
          setMessage('Failed to send barcode. Please try again.');
        }
      } catch (err) {
        if (cancelled) return;
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
          setStatus('error');
          setMessage('Request timed out. Make sure you are on the same WiFi and try again.');
        } else {
          setStatus('error');
          setMessage('Could not reach the server. Make sure you are on the same WiFi.');
        }
      }
    }

    async function startNative() {
      const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      await applyAutofocus(track);
      setTimeout(() => applyAutofocus(track), 600);

      async function tick() {
        if (cancelled) return;
        try {
          const found = await detector.detect(video);
          if (found.length > 0 && !cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            await sendBarcode(found[0].rawValue);
            return;
          }
        } catch { /* frame not ready */ }
        if (!cancelled) rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function startZxing() {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: VIDEO_CONSTRAINTS },
        videoRef.current,
        async (result, _err, ctrl) => {
          if (cancelled) { ctrl?.stop(); return; }
          if (!result) return;
          ctrl?.stop();
          const track = videoRef.current?.srcObject?.getVideoTracks?.()?.[0];
          await applyAutofocus(track);
          await sendBarcode(result.getText());
        }
      );
      if (cancelled) { controls.stop(); return; }
      controlsRef.current = controls;
      setTimeout(() => {
        const track = videoRef.current?.srcObject?.getVideoTracks?.()?.[0];
        applyAutofocus(track);
      }, 700);
    }

    async function start() {
      try {
        if ('BarcodeDetector' in window) {
          await startNative();
        } else {
          await startZxing();
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || '';
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
          setStatus('error');
          setMessage('Camera permission denied. Allow camera access and refresh.');
        } else {
          setStatus('error');
          setMessage('Could not start camera. Make sure no other app is using it.');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [token, scanKey]); // status intentionally excluded — changing status must not restart the scanner

  function handleRetry() {
    setStatus('scanning');
    setScanKey((k) => k + 1);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 font-poppins">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-teal-600 px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">PawsitiveCare</p>
          <h1 className="mt-0.5 text-base font-extrabold text-white">Barcode Scanner</h1>
        </div>

        {(status === 'scanning' || status === 'sending') && (
          <div className="relative bg-black">
            <video ref={videoRef} className="h-72 w-full object-cover" autoPlay muted playsInline />
            {status === 'scanning' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-32 w-60 rounded-lg border-2 border-teal-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            )}
            {status === 'sending' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <p className="text-sm font-bold text-white">Sending...</p>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-5 text-center">
          {status === 'scanning' && (
            <p className="text-sm font-semibold text-gray-500">
              Hold the barcode steady inside the box.
            </p>
          )}
          {status === 'success' && (
            <div className="space-y-1">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-2xl">✓</div>
              <p className="font-extrabold text-teal-700">Barcode sent!</p>
              <p className="text-xs text-gray-500">{message}</p>
            </div>
          )}
          {(status === 'error' || status === 'expired') && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-600">{message}</p>
              {status === 'error' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
