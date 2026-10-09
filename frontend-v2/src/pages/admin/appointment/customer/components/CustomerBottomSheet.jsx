import { PawPrint, Pencil, Trash2, X } from 'lucide-react';
import StatusBadge from '../../../../../components/StatusBadge';
import { avatarColor, getInitials } from '../customerUtils';
import { formatAddressFromOwner } from '../../../../../utils/textUtils';

function CRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <span className="shrink-0 font-semibold text-brand-dark-soft">{label}:</span>
      <span className="truncate text-right font-medium text-brand-dark">{value}</span>
    </div>
  );
}

export default function CustomerBottomSheet({
  owner,
  isAdmin,
  onClose,
  onSeeDetails,
  onEdit,
  onRemove,
}) {
  if (!owner) return null;

  return (
    <div className="xl:hidden">
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-[85] flex flex-col rounded-t-2xl bg-white shadow-2xl max-h-[82vh]">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(owner.fullName)}`}>
              {getInitials(owner.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{owner.fullName}</p>
              <p className="truncate text-xs text-white/70">{owner.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 bg-brand-teal/20" />

        <div className="overflow-y-auto px-5 py-4 space-y-2 text-xs">
          <CRow label="Customer ID" value={owner.display_id || '—'} />
          <CRow label="Contact" value={owner.phone || '—'} />
          <CRow label="Address" value={formatAddressFromOwner(owner) || '—'} />
          <div className="flex items-center justify-between py-1">
            <span className="font-semibold text-brand-dark-soft">Status</span>
            <StatusBadge active={owner.is_active} variant="customer" />
          </div>
          {owner.pets?.length > 0 && (
            <div className="pt-1">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-teal-dark">
                <PawPrint size={11} className="text-brand-teal" /> Pets
              </p>
              <div className="space-y-1">
                {owner.pets.map((pet, i) => (
                  <div key={pet.id ?? i} className="flex items-center gap-2 rounded-lg border border-brand-teal/10 bg-white px-3 py-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${String(pet.species_type?.name ?? '').toLowerCase().includes('cat') ? 'bg-orange-400' : 'bg-brand-teal'}`} />
                    <p className="text-xs font-semibold text-brand-dark">{pet.name || `Pet ${i + 1}`}</p>
                    {pet.species_type?.name && <p className="ml-auto text-[11px] text-brand-dark-soft">{pet.species_type.name}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-brand-teal/15 px-5 py-4">
          <button
            type="button"
            onClick={() => onSeeDetails(owner)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-teal/30 py-2.5 text-sm font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors"
          >
            Full Details
          </button>
          <button
            type="button"
            onClick={() => onEdit(owner)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark"
          >
            <Pencil size={14} /> Edit
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onRemove(owner)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-500 hover:bg-red-100"
            >
              <Trash2 size={14} /> {owner.is_active ? 'Deactivate' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
