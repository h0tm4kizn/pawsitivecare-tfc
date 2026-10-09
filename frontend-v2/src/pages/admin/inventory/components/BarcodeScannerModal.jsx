import { BrowserMultiFormatReader } from '@zxing/browser';
import { ScanLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function BarcodeScannerModal({ onScan, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;

    const video = videoRef.current;
    const stream = video?.srcObject;
    if (stream?.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute('src');
      video.load?.();
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function start() {
      stopCamera();
      setError('');
      setScanning(true);
      try {
        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        if (devices.length === 0) {
          setError('No camera found on this device.');
          setScanning(false);
          return;
        }
        // Prefer rear camera on mobile
        const device =
          devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];

        const controls = await reader.decodeFromVideoDevice(
          device.deviceId,
          videoRef.current,
          (result, err, ctrl) => {
            if (cancelled) { ctrl?.stop(); return; }
            if (result) {
              setScanning(false);
              ctrl?.stop();
              stopCamera();
              onScanRef.current?.(result.getText());
              onCloseRef.current?.();
            }
          }
        );
        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message || '';
          if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
            setError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (msg.includes('NotReadable') || msg.includes('Could not start video source') || msg.includes('busy')) {
            setError('Camera is still busy. Close other camera apps, then try again.');
          } else {
            setError('Could not start camera. Make sure no other app is using it.');
          }
          setScanning(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [attempt]);

  return (
    <div className="fixed inset-0 z-[300] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
          <div className="flex items-center gap-2">
            <ScanLine size={16} className="text-white" strokeWidth={2.5} />
            <h2 className="text-sm font-extrabold text-white">Scan Barcode</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        <div className="relative bg-black">
          <video
            ref={videoRef}
            className="h-64 w-full object-cover"
            autoPlay
            muted
            playsInline
          />
          {scanning && !error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-36 w-48 rounded-lg border-2 border-brand-teal shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          {error ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark"
              >
                Try Camera Again
              </button>
            </div>
          ) : (
            <p className="text-center text-xs font-semibold text-brand-dark-soft">
              Point your camera at a barcode to scan it automatically.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl border border-brand-dark-light py-2.5 text-sm font-bold text-brand-dark-soft transition-colors hover:bg-brand-dark-light"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
