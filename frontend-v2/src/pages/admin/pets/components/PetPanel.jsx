import PetCard from './PetCard';
import { fmtDate, calcAge, ownerName, titleCasePetName } from '../petUtils';
import { normalizeBreedName, sanitizeText } from '../../../../utils/textUtils';
import { formatWeightKg } from '../../../../utils/recordFormatters';

export default function PetPanel({ pet, onSeeDetails }) {
  if (!pet) {
    return (
      <div className="sticky top-4 rounded-xl border border-brand-teal/20 bg-white p-5 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <p className="text-sm font-semibold text-brand-dark">View Mode</p>
        <p className="mt-2 text-xs leading-5 text-brand-dark-soft">Select a pet to view its full details here.</p>
      </div>
    );
  }

  return (
    <div className="flex h-fit flex-col overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="border-b border-brand-teal/20 bg-white px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark-soft">Selected Pet</p>
        <p className="truncate text-sm font-medium text-brand-dark">{titleCasePetName(pet.name)}</p>
      </div>

      <div className="flex flex-col p-4">
        <PetCard pet={pet} showOwner={false} />
        <div className="mt-3 space-y-1.5 rounded-xl border border-brand-teal/15 bg-white px-3 py-2.5 text-xs">
          {[
            ['Type',   sanitizeText(pet.species_type?.name || '-')],
            ['Breed',  normalizeBreedName(pet.breed?.name || '-')],
            ['Sex',    pet.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '-'],
            ['DOB',    fmtDate(pet.date_of_birth)],
            ['Age',    calcAge(pet.date_of_birth) || '-'],
            ['Weight', formatWeightKg(pet.weight_kg)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="font-semibold text-brand-dark-soft">{label}</span>
              <span className="font-normal text-brand-dark">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-brand-teal/15 bg-white px-3 py-2.5 text-xs">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-dark-soft">Pet Owner Details</p>
          {[
            ['Pet Owner', ownerName(pet?.owner)],
            ['Owner ID', pet?.owner?.display_id || '-'],
            ['Phone', pet?.owner?.phone || '-'],
            ['Email', pet?.owner?.email || '-'],
          ].map(([label, value]) => (
            <div key={label} className="mb-1 flex items-center justify-between gap-2 last:mb-0">
              <span className="font-semibold text-brand-dark-soft">{label}</span>
              <span className="text-right font-normal text-brand-dark">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-brand-teal/15 bg-white p-4">
        <button
          type="button"
          onClick={onSeeDetails}
          className="w-full rounded-xl border border-brand-teal/40 py-2 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
        >
          View Pet Details
        </button>
      </div>
    </div>
  );
}
