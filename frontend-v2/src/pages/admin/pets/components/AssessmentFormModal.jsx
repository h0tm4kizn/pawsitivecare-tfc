import { X } from 'lucide-react';
import { titleCasePetName } from '../petUtils';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';

export default function AssessmentFormModal({ pet, isOpen, onClose }) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-white">Pet Assessment Form</h2>
            {pet && <p className="text-[11px] text-white/70">{titleCasePetName(pet.name)}</p>}
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 bg-white" />
        <div className="px-5 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-brand-dark">Pet Health Assessment Form</p>
          <p className="mt-1 text-xs text-brand-dark-soft">
            {pet ? `Viewing assessment form for ${titleCasePetName(pet.name)}` : 'Select a pet to view its assessment form.'}
          </p>
          {pet?.medical_notes && (
            <div className="mt-4 rounded-xl border border-brand-teal/15 bg-white px-4 py-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Medical Notes</p>
              <p className="mt-1 text-sm text-brand-dark">{pet.medical_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
