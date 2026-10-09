import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';

const PET_DEACTIVATION_REASONS = [
  { value: 'pet_deceased', label: 'Pet Deceased' },
  { value: 'pet_rehomed', label: 'Pet Rehomed / Transferred' },
  { value: 'owner_request', label: 'Owner Request' },
  { value: 'medical_condition', label: 'Medical Condition' },
  { value: 'other', label: 'Other (specify)' },
];

const PET_DELETION_REASONS = [
  { value: 'duplicate_record', label: 'Duplicate Record' },
  { value: 'data_entry_error', label: 'Data Entry Error' },
  { value: 'owner_request', label: 'Owner Request' },
  { value: 'other', label: 'Other (specify)' },
];

export default function PetActionModal({ pet, onClose, onConfirm, isSaving, error, initialAction }) {
  useBodyScrollLock(!!pet);
  const action = initialAction ?? (pet?.is_active === false ? 'delete' : 'deactivate');
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');

  useEffect(() => {
    setSelected('');
    setReason('');
    setReasonErr('');
  }, [pet, initialAction]);

  if (!pet) return null;

  const handleConfirm = () => {
    const reasonList = action === 'delete' ? PET_DELETION_REASONS : PET_DEACTIVATION_REASONS;
    const finalReason = selected === 'other' ? reason.trim() : (selected ? reasonList.find((o) => o.value === selected)?.label : '');
    if (!finalReason) { setReasonErr(selected === 'other' ? 'Please specify the reason.' : 'Reason is required.'); return; }
    onConfirm(action, finalReason);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={() => !isSaving && onClose()}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">{action === 'delete' ? 'Delete Pet' : 'Deactivate Pet'}</h2>
          <button type="button" onClick={onClose} disabled={isSaving} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50">
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 bg-white" />
        <div className="px-5 py-5">
          <div>
            <label className="mb-1 block text-xs font-bold text-brand-dark">
              Reason <span className="text-red-500">*</span>
            </label>
            <SelectDropdown
              value={selected}
              onChange={(v) => { setSelected(v); setReason(''); if (reasonErr) setReasonErr(''); }}
              options={[{ value: '', label: 'Select reason' }, ...(action === 'delete' ? PET_DELETION_REASONS : PET_DEACTIVATION_REASONS)]}
              placeholder="Select reason"
            />
            {selected === 'other' && (
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => { setReason(e.target.value); if (reasonErr) setReasonErr(''); }}
                placeholder="Please specify..."
                className="mt-2 w-full resize-none rounded-xl border border-brand-teal/25 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
              />
            )}
            {reasonErr && <p className="mt-1 text-[11px] font-semibold text-red-500">{reasonErr}</p>}
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onClose} disabled={isSaving}
              className="flex-1 rounded-xl border border-brand-dark-light py-2 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleConfirm} disabled={isSaving}
              className={`flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-50 ${action === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-teal hover:bg-brand-teal-dark'}`}>
              {isSaving ? 'Saving...' : action === 'delete' ? 'Delete' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
