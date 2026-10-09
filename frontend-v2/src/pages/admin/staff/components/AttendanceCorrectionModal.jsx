import { useState } from 'react';
import { X } from 'lucide-react';

export default function AttendanceCorrectionModal({ staffName, value, onChange, onClose, onSave, saving }) {
  const [reason, setReason] = useState('');
  const canSave = Boolean(value && reason.trim() && !saving);

  return (
    <div className="fixed inset-0 z-[140] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Correct attendance">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-brand-teal/10 bg-brand-teal px-5 py-3.5">
          <div><h2 className="text-sm font-bold text-white">Correct attendance</h2><p className="text-[11px] font-semibold text-white/70">{staffName}</p></div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close"><X size={15} /></button>
        </div>
        <div className="space-y-3 p-5">
          <label className="block text-xs font-semibold text-brand-dark-soft">Time Out<input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand-teal" /></label>
          <label className="block text-xs font-semibold text-brand-dark-soft">Reason<textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full resize-none rounded-xl border border-brand-teal/20 px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand-teal" placeholder="Forgot to clock out" /></label>
          <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className="rounded-xl border border-brand-teal/25 px-4 py-2.5 text-xs font-bold text-brand-teal-dark">Cancel</button><button type="button" disabled={!canSave} onClick={() => onSave({ time_out_at: value, reason: reason.trim() })} className="rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Save Time Out'}</button></div>
        </div>
      </div>
    </div>
  );
}
