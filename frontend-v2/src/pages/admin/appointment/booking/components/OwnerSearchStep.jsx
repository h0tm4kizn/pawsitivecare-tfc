import { useEffect, useRef, useState } from 'react';
import PetAssessmentFormModal from '../../../../../components/modals/PetAssessmentFormModal';
import SelectDropdown from '../../../../../components/reusable-ui/SelectDropdown';
import { normalizeBreedName, truncateAddress } from '../../../../../utils/textUtils';

const PARASITE_BLOCK_TITLE = 'A Little "Paws" for Your Pet\'s Well-being';
const PARASITE_BLOCK_BODY = 'Our priority is a safe, parasite-free environment for everyone. Because we spotted some ticks/fleas, we can\'t proceed with the booking just yet. We\'re rooting for a speedy treatment so we can see those tail wags again!';

export default function OwnerSearchStep({
  ownerQuery,
  ownerResults,
  ownerSearching,
  showOwnerDropdown,
  setShowOwnerDropdown,
  selectedOwner,
  handleSelectOwner,
  ownerPets,
  loadingPets,
  selectedPet,
  setSelectedPet,
  petAssessmentComplete,
  petAssessmentLoading,
  petHasTicksOrFlea,
  assessmentSavedNotice,
  assessmentPet,
  setAssessmentPet,
  setRecordsPet,
  fetchPetAssessmentStatus,
  onAssessmentSaved,
  onAssessmentDraftSaved,
  handleOwnerQueryChange,
  getOwnerName,
  getOwnerAddress,
  serviceId = null,
  serviceCategory = '',
  assessmentDraft = null,
  assessmentDraftsByPet = {},
  isDaycareFlow = false,
  selectedDaycarePetIds = [],
  onToggleDaycarePet = () => {},
  assessmentPlacement = 'inline',
}) {
  const ownerBoxRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const shouldDeferAssessmentSave = true;
  const speciesCodeOf = (pet) => String(
    pet?.speciesType?.code ||
    pet?.species_type?.code ||
    pet?.species?.code ||
    pet?.species_code ||
    ''
  ).trim().toUpperCase();
  const speciesNameOf = (pet) => String(
    pet?.speciesType?.name ||
    pet?.species_type?.name ||
    pet?.species?.name ||
    pet?.species ||
    ''
  ).trim().toLowerCase();
  const isDog = (pet) => {
    const code = speciesCodeOf(pet);
    const name = speciesNameOf(pet);
    return code === 'D' || code === 'DOG' || name.includes('dog') || name.includes('canine');
  };
  const isCat = (pet) => {
    const code = speciesCodeOf(pet);
    const name = speciesNameOf(pet);
    return code === 'C' || code === 'CAT' || name.includes('cat') || name.includes('feline');
  };
  const daycareAllPets = isDaycareFlow ? ownerPets : [];
  const daycareDogPets = isDaycareFlow ? ownerPets.filter(isDog) : ownerPets;
  const daycareHasOnlyCats = isDaycareFlow && daycareAllPets.length > 0 && daycareDogPets.length === 0 && daycareAllPets.some(isCat);
  const displayPets = isDaycareFlow ? daycareDogPets : ownerPets;
  const shouldCollapseSinglePetPicker = !isDaycareFlow && Boolean(selectedPet?.id) && assessmentPlacement === 'summary';

  useEffect(() => {
    const onClickOutside = (event) => {
      if (ownerBoxRef.current && !ownerBoxRef.current.contains(event.target)) {
        setShowOwnerDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [setShowOwnerDropdown]);

  useEffect(() => {
    setActiveIndex(ownerResults.length > 0 ? 0 : -1);
  }, [ownerResults, ownerQuery]);

  const handleInputKeyDown = (event) => {
    if (!showOwnerDropdown || ownerResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % ownerResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? ownerResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const target = ownerResults[activeIndex] || ownerResults[0];
      if (target) handleSelectOwner(target);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setShowOwnerDropdown(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="min-w-0" ref={ownerBoxRef}>
          <label className="mb-2 block text-sm font-bold text-brand-dark">Customer</label>
          <div className="relative mb-2 px-0.5">
            <input
              type="text"
              value={ownerQuery}
              onChange={(event) => handleOwnerQueryChange(event.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => {
                if (ownerResults.length > 0 || ownerQuery.trim().length > 0) setShowOwnerDropdown(true);
              }}
              placeholder="Search by name, email, or phone..."
              className="ui-dropdown-field block w-full box-border px-3 py-2.5 text-sm pr-20"
            />
            {ownerSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-brand-teal animate-pulse">
                Searching...
              </span>
            )}
            {showOwnerDropdown && (
              <ul className="ui-dropdown-menu absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto">
                {ownerQuery.trim().length === 0 && ownerResults.length > 0 && (
                  <li className="px-3 py-2.5 text-xs font-medium text-brand-dark-soft">Recent customers</li>
                )}
                {ownerSearching && ownerResults.length === 0 && (
                  <li className="px-3 py-2 text-[11px] font-medium text-brand-teal animate-pulse">Searching...</li>
                )}
                {!ownerSearching && ownerQuery.trim().length >= 2 && ownerResults.length === 0 && (
                  <li className="px-3 py-2.5 text-xs font-medium text-brand-dark-soft">No customers found</li>
                )}
                {ownerResults.map((owner, index) => (
                  <li key={owner.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectOwner(owner)}
                      className={`w-full px-3 py-2.5 text-left transition hover:bg-brand-teal-soft/30 ${
                        index === activeIndex ? 'bg-brand-teal-soft/30' : ''
                      }`}
                    >
                      <p className="text-sm font-semibold text-brand-dark">{getOwnerName(owner)}</p>
                      <p className="text-[11px] text-brand-dark-soft">{owner.email || ''}{owner.phone ? ` | ${owner.phone}` : ''}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedOwner && (
            <div className="mb-2 rounded-xl border border-brand-dark-light bg-[#f8fafc] p-3">
              <p className="text-sm font-bold text-brand-dark">{getOwnerName(selectedOwner)}</p>
              <div className="mt-2 space-y-1.5">
                <p className="flex items-start gap-2 text-xs text-brand-dark-soft">
                  <i className="fa-solid fa-envelope mt-0.5 text-[11px] text-brand-teal" />
                  <span>{selectedOwner.email || 'No email provided'}</span>
                </p>
                <p className="flex items-start gap-2 text-xs text-brand-dark-soft">
                  <i className="fa-solid fa-phone mt-0.5 text-[11px] text-brand-teal" />
                  <span>{selectedOwner.phone || selectedOwner.contact_number || 'No phone provided'}</span>
                </p>
                <p className="flex items-start gap-2 text-xs text-brand-dark-soft">
                  <i className="fa-solid fa-location-dot mt-0.5 text-[11px] text-brand-teal" />
                  <span>{truncateAddress(getOwnerAddress(selectedOwner)) || 'No address provided'}</span>
                </p>
              </div>
            </div>
          )}
        </div>
        {selectedOwner && (
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-bold text-brand-dark">Pet</label>
            {shouldCollapseSinglePetPicker ? (
              <div className="rounded-xl border border-brand-teal/30 bg-brand-teal-soft/20 px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-brand-dark-light bg-brand-teal-soft/30">
                    {selectedPet?.photo_url ? (
                      <img src={selectedPet.photo_url} alt={selectedPet.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-brand-dark">{selectedPet?.name || 'Pet'}</p>
                    <p className="truncate text-[11px] text-brand-dark-soft">
                      {selectedPet?.species_type?.name || selectedPet?.species || '-'}{selectedPet?.breed?.name ? ` | ${normalizeBreedName(selectedPet.breed.name, selectedPet)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPet(null);
                      setAssessmentPet(null);
                    }}
                    className="shrink-0 rounded-lg border border-brand-teal/30 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-teal transition hover:bg-brand-teal hover:text-white"
                  >
                    Change pet
                  </button>
                </div>
              </div>
            ) : loadingPets ? (
              <p className="text-sm font-semibold text-brand-dark-soft">Loading pets...</p>
            ) : displayPets.length === 0 ? (
              <div className="rounded-xl border border-brand-dark-light bg-[#f8fafc] px-3 py-3">
                <p className="text-sm font-medium text-brand-dark-soft">
                  {isDaycareFlow && ownerPets.length > 0
                    ? 'No eligible dog pets found for daycare. Please check the pet species record.'
                    : 'No pets found for this customer.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {daycareHasOnlyCats && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3">
                    <p className="text-xs font-semibold text-rose-700">
                      Daycare is for dogs only. This owner currently has cats only, so daycare booking cannot continue.
                    </p>
                  </div>
                )}
                {isDaycareFlow && (
                  <p className="flex items-center gap-1.5 text-xs font-normal text-amber-600">
                    <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                    Daycare accepts 1-3 dogs only. Cats are not eligible.
                  </p>
                )}
                {displayPets.map((pet) => {
                  const isSelected = selectedPet?.id === pet.id;
                  const isAssessmentFormOpen = assessmentPet && assessmentPet.id === pet.id;
                  const isCheckedForDaycare = selectedDaycarePetIds.map(String).includes(String(pet.id));
                  const hasDraftForPet = Boolean(assessmentDraftsByPet[String(pet.id)]);
                  return (
                    <div
                      key={pet.id}
                      className={`relative overflow-hidden rounded-xl border transition ${
                        (isDaycareFlow ? isCheckedForDaycare : isSelected)
                          ? 'border-brand-teal bg-brand-teal-soft/20'
                          : 'border-brand-dark-light hover:border-brand-teal/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isDaycareFlow) {
                            onToggleDaycarePet(pet);
                            return;
                          }
                          setSelectedPet(pet);
                        }}
                        className="flex w-full items-center gap-2.5 py-3 pl-3 pr-36 text-left sm:gap-3 sm:pl-4 sm:pr-40"
                      >
                        {isDaycareFlow && (
                          <input
                            type="checkbox"
                            readOnly
                            checked={isCheckedForDaycare}
                            className="h-3.5 w-3.5 rounded border-brand-dark-light text-brand-daycare focus:ring-brand-daycare"
                          />
                        )}
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-brand-dark-light bg-brand-teal-soft/30 sm:h-10 sm:w-10">
                          {pet?.photo_url ? (
                            <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-brand-dark">{pet?.name || 'Pet'}</p>
                          <p className="truncate text-[11px] text-brand-dark-soft">
                            {pet?.species_type?.name || pet?.species || '-'}{pet?.breed?.name ? ` | ${normalizeBreedName(pet.breed.name, pet)}` : ''}
                          </p>
                        </div>
                      </button>
                      {(isDaycareFlow ? isCheckedForDaycare : isSelected) && (
                        <button
                          type="button"
                          onClick={() => setRecordsPet(pet)}
                          className="absolute right-3 top-3 text-[10px] font-bold text-brand-teal transition hover:underline sm:right-4"
                        >
                          View Assessment Records
                        </button>
                      )}
                      {assessmentPlacement === 'inline' && ((isDaycareFlow && isCheckedForDaycare) || (!isDaycareFlow && isSelected) || isAssessmentFormOpen) && (
                        <div className="border-t border-brand-teal/20 bg-white/70 px-3 py-3 sm:px-4">
                          {!isSelected ? (
                            <div>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className={`mt-1 text-[11px] font-semibold ${hasDraftForPet ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {hasDraftForPet ? 'Assessment ready' : 'Assessment required'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAssessmentPet((prev) => (prev?.id === pet?.id ? null : pet))}
                                  className="w-full shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-600 sm:w-auto sm:py-1.5"
                                >
                                  {isAssessmentFormOpen ? 'Hide Form' : (hasDraftForPet ? 'Edit Assessment' : 'Fill Out Assessment')}
                                </button>
                              </div>
                            </div>
                          ) : petAssessmentLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-brand-dark-light bg-brand-surface px-3 py-2.5 text-xs font-semibold text-brand-dark-soft">
                              <span className="inline-block h-2 w-2 rounded-full bg-brand-teal animate-pulse" />
                              Checking assessment status...
                            </div>
                          ) : petAssessmentComplete && !petHasTicksOrFlea ? (
                            <div>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-emerald-700">
                                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                  <span>Assessment form is complete.</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAssessmentPet((prev) => (prev?.id === pet?.id ? null : pet))}
                                  className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg border border-emerald-300 bg-transparent px-3 text-[11px] font-extrabold text-emerald-700 transition hover:bg-emerald-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:h-8 sm:w-auto"
                                  aria-label={isAssessmentFormOpen ? 'Hide assessment form' : 'Edit assessment form'}
                                  title={isAssessmentFormOpen ? 'Hide assessment form' : 'Edit assessment form'}
                                >
                                  {isAssessmentFormOpen ? 'Hide' : 'Edit'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-2.5">
                                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-extrabold text-amber-700">
                                    !
                                  </span>
                                  <p className="text-xs font-semibold leading-relaxed text-amber-700">
                                    Review and save a new assessment for <span className="font-extrabold">{pet?.name || 'this pet'}</span> before booking.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAssessmentPet((prev) => (prev?.id === pet?.id ? null : pet))}
                                  className="w-full shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-600 sm:w-auto sm:py-1.5"
                                >
                                  {isAssessmentFormOpen ? 'Hide Form' : 'Fill Out Assessment'}
                                </button>
                              </div>
                            </div>
                          )}
                          {isAssessmentFormOpen && (
                            <div className="mt-3">
                              <PetAssessmentFormModal
                                isOpen={true}
                                pet={pet}
                                apiBase="/api/pets"
                                theme="pet_owner"
                                serviceId={serviceId}
                                serviceCategory={serviceCategory}
                                deferSave={shouldDeferAssessmentSave}
                                saveLabel={shouldDeferAssessmentSave ? 'Save for Booking' : 'Save'}
                                initialDraft={assessmentDraftsByPet[String(pet?.id)] || (String(selectedPet?.id || '') === String(pet?.id || '') ? assessmentDraft : null)}
                                onClose={() => setAssessmentPet(null)}
                                onSaved={async (payload) => {
                                  if (shouldDeferAssessmentSave) {
                                    onAssessmentDraftSaved?.(payload, pet);
                                    return;
                                  }
                                  if (pet?.id) {
                                    await fetchPetAssessmentStatus(pet.id, { force: true });
                                    onAssessmentSaved?.(pet?.name, pet);
                                  }
                                }}
                              />
                            </div>
                          )}
                          {petHasTicksOrFlea && (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              <p className="font-semibold">
                                {PARASITE_BLOCK_TITLE}
                              </p>
                              <p className="mt-1">
                                {PARASITE_BLOCK_BODY}
                              </p>
                            </div>
                          )}
                          {assessmentSavedNotice && (
                            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                              {assessmentSavedNotice}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
