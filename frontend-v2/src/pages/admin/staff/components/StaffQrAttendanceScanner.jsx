import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Camera, CheckCircle2, Loader2, QrCode, X } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';

export default function StaffQrAttendanceScanner({ onClose }) {
  const [phase, setPhase] = useState('scanning');
  const [scanAttempt, setScanAttempt] = useState(0);
  const [credential, setCredential] = useState('');
  const [staffRecord, setStaffRecord] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const scanLock = useRef(false);
  const submitLock = useRef(false);

  const identifyCredential = useCallback(async (scannedText) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setCredential(scannedText);
    setError('');
    setPhase('identifying');
    try {
      const response = await apiFetch('/api/admin/attendance/qr/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: scannedText }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || 'This QR code is invalid or has been revoked.');
      setStaffRecord(body.data);
      setPhase('confirm');
    } catch (requestError) {
      setError(requestError.message || 'Unable to verify this staff QR code.');
      setPhase('error');
    }
  }, []);

  const restartScanning = () => {
    scanLock.current = false;
    submitLock.current = false;
    setCredential('');
    setStaffRecord(null);
    setError('');
    setPhase('scanning');
    setScanAttempt((current) => current + 1);
  };

  const confirmAttendance = async () => {
    if (submitLock.current || !credential || !staffRecord?.next_action) return;
    submitLock.current = true;
    setSaving(true);
    setError('');
    const actionName = staffRecord.next_action === 'time_out' ? 'Time Out' : 'Time In';
    try {
      const response = await apiFetch(`/api/admin/attendance/qr/confirm-${staffRecord.next_action.replace('_', '-')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || `Unable to record ${actionName.toLowerCase()}.`);
      setStaffRecord((current) => current ? {
        ...current,
        attendance_state: {
          ...current.attendance_state,
          status: staffRecord.next_action === 'time_out' ? 'off_duty' : 'on_duty',
          label: staffRecord.next_action === 'time_out' ? 'Off duty' : 'On duty',
        },
      } : current);
      setPhase('complete');
      window.dispatchEvent(new CustomEvent('staff-summary-refresh'));
    } catch (requestError) {
      setError(requestError.message || `Unable to record ${actionName.toLowerCase()}.`);
      submitLock.current = false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="QR Attendance Scanner">
      <div className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between bg-brand-teal px-4 py-3 text-white sm:px-6 sm:py-4">
          <div>
            <h2 className="text-base font-extrabold">QR Attendance Scanner</h2>
            <p className="mt-0.5 text-xs text-white/80">Scan staff QR code to record attendance.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close QR scanner" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {phase === 'scanning' && (
            <ScannerCamera key={scanAttempt} onDecoded={identifyCredential} onError={setError} />
          )}
          {phase === 'identifying' && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl bg-brand-surface text-sm font-semibold text-brand-dark">
              <Loader2 size={26} className="animate-spin text-brand-teal" />
              Verifying staff QR…
            </div>
          )}
          {staffRecord && ['confirm', 'complete'].includes(phase) && (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-xl border border-brand-teal/20 bg-brand-teal-light/20 p-4 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-teal">
                  {phase === 'complete' ? <CheckCircle2 size={26} /> : <QrCode size={26} />}
                </div>
                <p className="text-sm text-brand-dark"><span className="font-bold">Staff Name:</span> {staffRecord.staff.name}</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-dark-light px-4 py-3 text-sm">
                <span className="font-semibold text-brand-dark-soft">Attendance Status:</span>
                <span className="text-right font-bold text-brand-dark">{staffRecord.attendance_state?.label || 'Off duty'}</span>
              </div>
              {phase === 'complete' ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700">
                  {staffRecord.next_action === 'time_out' ? 'Time Out' : 'Time In'} recorded successfully.
                </p>
              ) : staffRecord.next_action === 'needs_review' ? (
                <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  This shift is from an earlier day and needs admin review in Staff Activity before attendance can be changed.
                </p>
              ) : (
                <button type="button" onClick={confirmAttendance} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-3 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:cursor-wait disabled:opacity-60">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Confirm Time {staffRecord.next_action === 'time_out' ? 'Out' : 'In'}
                </button>
              )}
              <button type="button" onClick={restartScanning} className="w-full rounded-xl border border-brand-teal/30 px-4 py-2.5 text-sm font-bold text-brand-teal-dark hover:bg-brand-surface">
                Scan Another
              </button>
            </div>
          )}
          {phase === 'error' && (
            <div className="space-y-4">
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
              <button type="button" onClick={restartScanning} className="w-full rounded-xl bg-brand-teal px-4 py-3 text-sm font-bold text-white hover:bg-brand-teal-dark">Scan Another</button>
            </div>
          )}
          {phase === 'confirm' && error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}
          {phase === 'scanning' && error && (
            <div className="mt-3 space-y-3">
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
              <button type="button" onClick={restartScanning} className="w-full rounded-xl border border-brand-teal/30 px-4 py-2.5 text-sm font-bold text-brand-teal-dark hover:bg-brand-surface">Retry Camera</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScannerCamera({ onDecoded, onError }) {
  const videoRef = useRef(null);
  const decodedRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let controls = null;
    const reader = new BrowserQRCodeReader();

    reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      videoRef.current,
      (result) => {
        if (!result || stopped || decodedRef.current) return;
        decodedRef.current = true;
        controls?.stop();
        onDecoded(result.getText());
      },
    ).then((scannerControls) => {
      controls = scannerControls;
      if (stopped) controls.stop();
    }).catch((cameraError) => {
      if (!stopped) {
        onError(cameraError?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access and try again.'
          : cameraError?.message || 'Unable to start the camera. Check camera permissions and try again.');
      }
    });

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onDecoded, onError]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-brand-dark">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Staff QR camera preview" />
        <div className="pointer-events-none absolute inset-[12%] rounded-xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
          <Camera size={14} /> Point camera at staff QR code
        </div>
      </div>
    </div>
  );
}
