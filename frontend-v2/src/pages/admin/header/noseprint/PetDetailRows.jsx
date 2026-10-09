import React from 'react';
import { ownerName } from './noseprintUtils';
import { fmtDate, calcAge } from '../headerDateUtils';
import { normalizeBreedName, sanitizeText } from '../../../../utils/textUtils';
import { formatWeightKg } from '../../../../utils/recordFormatters';

export default function PetDetailRows({ pet }) {
  const rows = [
    ['Owner', ownerName(pet?.owner)],
    ['Pet ID', pet?.pet_id],
    ['Species', sanitizeText(pet?.species_type?.name || pet?.species || '-')],
    ['Breed', normalizeBreedName(pet?.breed?.name || pet?.breed || '-', pet)],
    ['Sex', pet?.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : null],
    ['Date of Birth', fmtDate(pet?.date_of_birth)],
    ['Age', calcAge(pet?.date_of_birth)],
    ['Weight', formatWeightKg(pet?.weight_kg) !== '-' ? formatWeightKg(pet?.weight_kg) : null],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-1.5 rounded-xl border border-brand-teal/20 bg-brand-teal-soft/15 px-4 py-3 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-brand-dark-soft">{label}</span>
          <span className="text-right font-semibold text-brand-dark">{value}</span>
        </div>
      ))}
    </div>
  );
}
