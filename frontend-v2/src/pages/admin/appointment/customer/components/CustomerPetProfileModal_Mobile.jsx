import { ChevronLeft, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import StatusBadge from '../../../../../components/StatusBadge';
import { formatWeightKg } from '../../../../../utils/recordFormatters';
import { formatAddressFromOwner } from '../../../../../utils/textUtils';
import { normalizeBreedName, sanitizeText } from '../../../../../utils/textUtils';

const fmtDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', day: 'numeric', year: 'numeric' });
};

const calcAge = (dob) => {
  if (!dob) return '-';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '-';
  const now = new Date();
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'Less than 1 month old';
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''} old`;
  const years = Math.floor(totalMonths / 12);
  return `${years} year${years !== 1 ? 's' : ''} old`;
};

const ownerName = (owner) =>
  owner?.fullName ||
  owner?.name ||
  [owner?.first_name, owner?.last_name].filter(Boolean).join(' ').trim() ||
  '-';

export default function CustomerPetProfileModal_Mobile({ pet, owner, onBack, onClose }) {
  if (!pet) return null;

  const displayOwner = pet.owner || owner || {};

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 h-[100dvh] min-h-[100dvh] w-screen px-4" onClick={onClose}>
      <div className="w-full max-w-md flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl font-poppins" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label="Back"
          >
            <ChevronLeft size={16} strokeWidth={2.6} />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-sm font-bold uppercase tracking-widest text-white">
            Pet Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <div className="h-1 bg-brand-teal-light shrink-0" />

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4">
          <div className="flex items-center gap-4 rounded-2xl border bg-brand-teal-light/30 p-4 border-brand-teal/20">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-brand-teal/30 shadow-sm">
              {pet.photo_url ? (
                <img src={pet.photo_url} alt={pet.name || 'Pet'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-teal">
                  <span className="text-xl font-extrabold text-white">
                    {String(pet.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bauhaus text-xl font-bold uppercase leading-tight text-brand-dark">
                {pet.name || 'Pet'}
              </p>
              {pet.pet_id && (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-brand-teal">
                  {pet.pet_id}
                </p>
              )}
              <p className="mt-1 text-[10px] text-brand-teal-dark/70">
                {sanitizeText(pet.species_type?.name || '')}
                {pet.breed?.name ? ` - ${normalizeBreedName(pet.breed.name, pet)}` : ''}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-brand-teal/20">
            <div className="border-b border-brand-teal/20 bg-brand-teal-light/30 px-4 py-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Pet Details</span>
            </div>
            <div className="divide-y divide-brand-dark-light/60">
              <ProfileRow label="Species" value={sanitizeText(pet.species_type?.name || '-')} />
              <ProfileRow label="Breed" value={normalizeBreedName(pet.breed?.name || pet.breed || '-', pet)} />
              <ProfileRow label="Sex" value={pet.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '-'} />
              <ProfileRow label="Date of Birth" value={fmtDate(pet.date_of_birth)} />
              <ProfileRow label="Age" value={calcAge(pet.date_of_birth)} />
              <ProfileRow label="Weight" value={formatWeightKg(pet.weight_kg)} />
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-brand-teal">Status</span>
                <StatusBadge active={pet.is_active} />
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-brand-teal/20">
            <div className="border-b border-brand-teal/20 bg-brand-teal-light/30 px-4 py-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Owner Details</span>
            </div>
            <div className="divide-y divide-brand-dark-light/60">
              <ProfileRow label="Name" value={ownerName(displayOwner)} />
              <ProfileRow label="Email" value={displayOwner.email || '-'} />
              <ProfileRow label="Phone" value={displayOwner.phone || '-'} />
              <ProfileRow label="Address" value={formatAddressFromOwner(displayOwner) || displayOwner.address || '-'} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="shrink-0 text-xs font-semibold text-brand-teal">{label}</span>
      <span className="min-w-0 max-w-[62%] break-words text-right text-xs font-medium text-brand-dark">{value}</span>
    </div>
  );
}
