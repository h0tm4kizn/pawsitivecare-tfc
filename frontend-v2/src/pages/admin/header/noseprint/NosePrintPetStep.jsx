import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { ownerName, isCatPet, isDogPet } from './noseprintUtils';
import { normalizeBreedName } from '../../../../utils/textUtils';

export default function NosePrintPetStep({
  selectedOwner,
  ownerPets,
  ownerPetsLoading,
  selectedPet,
  setSelectedPet,
  onChangeOwner,
  onBack,
  onNext,
}) {
  return (
    <div className="space-y-4">
      {/* Selected owner chip */}
      <div className="flex items-center justify-between rounded-xl border border-brand-dark-light bg-[#f8fafc] px-3 py-2.5">
        <div>
          <p className="text-xs font-bold text-brand-dark">{ownerName(selectedOwner)}</p>
          <p className="text-[11px] text-brand-dark-soft">{selectedOwner?.email || ''}</p>
        </div>
        <button
          type="button"
          onClick={onChangeOwner}
          className="rounded-lg border border-brand-dark-light px-2.5 py-1 text-[11px] font-semibold text-brand-dark-soft hover:border-brand-teal hover:text-brand-teal"
        >
          Change
        </button>
      </div>

      <div className="rounded-xl border border-brand-dark-light p-4">
        <label className="mb-3 block text-sm font-bold text-brand-dark">Select Pet</label>
        {ownerPetsLoading ? (
          <p className="text-sm text-brand-dark-soft">Loading pets...</p>
        ) : ownerPets.length === 0 ? (
          <p className="text-sm text-rose-500">No pets registered for this owner.</p>
        ) : (
          <div className="space-y-2">
            {ownerPets.map((pet) => {
              const isSelected = selectedPet?.id === pet.id;
              const cat = isCatPet(pet);
              const dog = isDogPet(pet);
              const speciesLabel = cat ? 'Cat' : dog ? 'Dog' : (pet?.species_type?.name || pet?.species || 'Pet');

              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => setSelectedPet(pet)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'border-brand-teal bg-brand-teal-soft/20 ring-1 ring-brand-teal'
                      : 'border-brand-dark-light hover:border-brand-teal/50'
                  }`}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-brand-dark-light bg-brand-teal-soft/30">
                    {pet?.photo_url ? (
                      <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-[10px] font-bold text-brand-teal-dark">
                          {String(pet.name || '?').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-brand-dark">{pet.name}</p>
                    <p className="truncate text-[11px] text-brand-dark-soft">
                      {pet.pet_id} &bull; {pet?.species_type?.name || pet?.species || (cat ? 'Cat' : 'Dog')} &bull; {normalizeBreedName(pet?.breed?.name || pet?.breed || '', pet)}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="ml-auto shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-brand-teal text-[10px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-brand-dark-light px-4 py-2.5 text-sm font-semibold text-brand-dark"
        >
          <ChevronLeft size={14} />
          Back
        </button>
        <button
          type="button"
          disabled={!selectedPet}
          onClick={onNext}
          className="flex-1 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Next — Capture
        </button>
      </div>
    </div>
  );
}
