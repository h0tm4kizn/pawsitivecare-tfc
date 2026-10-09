import { PawPrint } from 'lucide-react';
import { avatarColor, getInitials, hasValue } from '../customerUtils';
import { formatAddressFromOwner, truncateAddress } from '../../../../../utils/textUtils';
import StatusBadge from '../../../../../components/StatusBadge';

export default function CustomerPanel({ owner, label = 'Selected Customer', onSeeDetails }) {
  if (!owner) {
    return (
      <div className="sticky top-4 rounded-xl border border-brand-teal/20 bg-white p-5 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <p className="text-sm font-semibold text-brand-dark">View Mode</p>
        <p className="mt-2 text-xs leading-5 text-brand-dark-soft">Select a customer to view their full details here.</p>
      </div>
    );
  }

  const name = owner.fullName;
  const color = avatarColor(name);
  return (
    <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="px-4 py-3">
        <p className="text-xs font-bold text-brand-dark">{label}</p>
      </div>
      <div className="h-px bg-brand-teal/10" />

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-brand-teal/15 bg-brand-teal-light/20 px-3 py-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}>
            {getInitials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-dark">{name}</p>
            <p className="truncate text-[11px] text-brand-dark">{owner.email}</p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-brand-dark-soft">Customer ID</span>
            <span className="font-bold text-brand-dark">{owner.display_id || '-'}</span>
          </div>
          {hasValue(owner.phone) && owner.phone !== '—' && (
            <div className="flex justify-between gap-2">
              <span className="font-semibold text-brand-dark-soft">Contact</span>
              <span className="font-normal text-brand-dark">{owner.phone}</span>
            </div>
          )}
          {hasValue(owner.address) && owner.address !== '—' && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 font-semibold text-brand-dark-soft">Address</span>
              <span className="min-w-0 max-w-[68%] break-words text-right font-normal text-brand-dark">{truncateAddress(formatAddressFromOwner(owner)) || '—'}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-brand-dark-soft">Status</span>
            <StatusBadge active={owner.is_active} variant="customer" />
          </div>
        </div>

        {owner.pets?.length > 0 && (
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-brand-teal-dark">
              <PawPrint size={11} className="text-brand-teal" />
              Pets
            </p>
            {owner.pets.map((pet, i) => (
              <div key={pet.id ?? i} className="flex items-center gap-2 rounded-lg border border-brand-teal/10 bg-white px-3 py-1.5">
                {(() => {
                  const speciesName = String(pet.species_type?.name ?? pet.speciesType?.name ?? pet.species ?? '').toLowerCase();
                  const bulletClass = speciesName.includes('cat') || speciesName.includes('feline')
                    ? 'bg-orange-400'
                    : 'bg-brand-teal';
                  return <div className={`h-1.5 w-1.5 rounded-full ${bulletClass}`} />;
                })()}
                <p className="text-xs font-normal text-brand-dark">{pet.name || `Pet ${i + 1}`}</p>
                {(pet.species_type?.name || pet.speciesType?.name) && (
                  <p className="ml-auto text-[11px] text-brand-dark">
                    {pet.species_type?.name ?? pet.speciesType?.name}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onSeeDetails?.(owner)}
          disabled={!owner}
          className="w-full rounded-xl border border-brand-teal/30 py-2 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          See Full Details
        </button>
      </div>
    </div>
  );
}
