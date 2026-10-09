import React from 'react';
import { AlertTriangle, ScanFace } from 'lucide-react';

export default function CameraAlertOverlay({ cameraAlert, onDismiss }) {
  if (!cameraAlert) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 ${
        cameraAlert.type === 'human'
          ? 'bg-red-100/90'
          : cameraAlert.type === 'species' || cameraAlert.type === 'system'
          ? 'bg-amber-900/85'
          : 'bg-black/85'
      }`}
    >
      {cameraAlert.type === 'human' ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-300 bg-red-200/70">
            <AlertTriangle size={26} strokeWidth={2.5} className="text-red-700" aria-hidden="true" />
          </div>
          <p className="text-center text-sm font-extrabold uppercase tracking-widest text-red-700">
            Human Detected
          </p>
          <p className="text-center text-xs text-red-700/85">
            This system is for dogs and cats only.
          </p>
        </>
      ) : cameraAlert.type === 'species' || cameraAlert.type === 'system' ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/30">
            <AlertTriangle size={26} strokeWidth={2.5} className="text-amber-300" aria-hidden="true" />
          </div>
          <p className="text-center text-sm font-extrabold uppercase tracking-widest text-amber-300">
            {cameraAlert.type === 'system' ? 'Re-Enroll Required' : 'Wrong Species'}
          </p>
          <p className="text-center text-xs text-amber-200/90">
            {cameraAlert.text}
          </p>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/20">
            <ScanFace size={22} className="text-amber-300" />
          </div>
          <p className="text-center text-xs font-semibold leading-relaxed text-white">
            {cameraAlert.text}
          </p>
        </>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className={`mt-1 rounded-full px-4 py-1.5 text-[11px] font-bold transition-colors ${
          cameraAlert.type === 'human'
            ? 'border border-red-400 bg-white text-red-700 hover:bg-red-50'
            : 'border border-white/30 text-white/80 hover:border-white/60 hover:text-white'
        }`}
      >
        Dismiss &amp; Retry
      </button>
    </div>
  );
}
