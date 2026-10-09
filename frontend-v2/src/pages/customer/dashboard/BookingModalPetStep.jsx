import PetAssessmentFormModal from '../../../components/modals/PetAssessmentFormModal';
import './bookingModalUtils';

export default function BookingModalPetStep({ step, hasDaycareCategory, selectedDaycarePetIds, additionalPetIds, form, DAYCARE_MAX_PETS, petsLoading, pets, setForm, setAdditionalPetIds, selectedPet, isDogPet, setError, setAssessmentPet, setPendingAssessmentDraft, setPendingAssessmentDrafts, fetchPetHealthStatus, petHealthStatus, petAssessmentFlags, activeItem, bookingRequiresRabies, assessmentPet, pendingAssessmentDraft, pendingAssessmentDrafts, PARASITE_BLOCK_TITLE, PARASITE_BLOCK_BODY, setPetAssessmentFlags, setPetHealthStatus, PetAssessmentFormModal, petBorder, petLight, petBg, sanitizeText }) {
  return (
    <>
            {/* Step 0: Choose Pet */}
            {step === 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  {!hasDaycareCategory && <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Select a Pet</p>}
                  {hasDaycareCategory && <span className="ml-auto text-[10px] font-bold text-brand-daycare">{selectedDaycarePetIds.length} of {DAYCARE_MAX_PETS} selected</span>}
                </div>
                {hasDaycareCategory && (
                  <div className="rounded-xl border border-brand-daycare/30 bg-brand-daycare-soft/40 px-4 py-3">
                    <p className="text-xs font-bold text-brand-daycare">Pet Daycare: Select 1 to {DAYCARE_MAX_PETS} Dogs</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-brand-dark-soft">Daycare is available for dogs only. Select up to three dogs from the same owner; every selected dog needs a completed assessment and current rabies vaccination.</p>
                  </div>
                )}
                {petsLoading ? (
                  <div className="space-y-2" aria-label="Loading pets">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex animate-pulse items-center gap-3 rounded-xl border border-brand-dark-light px-4 py-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-brand-dark-light/70" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-28 rounded bg-brand-dark-light/80" />
                          <div className="h-2.5 w-40 rounded bg-brand-dark-light/50" />
                        </div>
                        <div className="h-6 w-16 rounded-full bg-brand-dark-light/60" />
                      </div>
                    ))}
                  </div>
                ) : pets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <i className="fa-solid fa-paw text-brand-dark-soft/30 text-3xl mb-2" />
                    <p className="text-sm text-brand-dark-soft">No pets registered yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pets.map((p) => {
                      const petId = String(p.id);
                      const isDog = isDogPet(p);
                      const isSelected = selectedDaycarePetIds.includes(petId);
                      const isAdditional = isSelected && petId !== String(form.pet_id);
                      const daycareSelectionFull = !isSelected && selectedDaycarePetIds.length >= DAYCARE_MAX_PETS;
                      const blockedForDaycare = hasDaycareCategory && !isDog;
                      const currentPetHealthStatus = petHealthStatus[p.id];
                      const currentPetFlags = petAssessmentFlags[p.id] || {};
                      const currentPetHasTicksOrFlea = !!(currentPetFlags.has_ticks || currentPetFlags.has_flea);
                      const currentPetMissingRabies = !!currentPetFlags.missing_rabies;
                      return (
                        <div key={p.id}>
                          <button type="button"
                            disabled={blockedForDaycare || (daycareSelectionFull && isDog)}
                            onClick={() => {
                              if (!hasDaycareCategory) {
                                setForm((prev) => ({ ...prev, pet_id: p.id }));
                                setAdditionalPetIds([]);
                              } else if (!isDog) {
                                setForm((prev) => ({ ...prev, pet_id: p.id }));
                                setAdditionalPetIds([]);
                              } else if (!form.pet_id || !isSelected) {
                                if (!form.pet_id || !isDogPet(selectedPet)) {
                                  setForm((prev) => ({ ...prev, pet_id: p.id }));
                                  setAdditionalPetIds([]);
                                } else if (selectedDaycarePetIds.length < DAYCARE_MAX_PETS) {
                                  setAdditionalPetIds((prev) => [...prev.map(String), petId]);
                                }
                              } else if (isAdditional) {
                                setAdditionalPetIds((prev) => prev.filter((id) => String(id) !== petId));
                              } else if (additionalPetIds.length > 0) {
                                const [nextPrimary, ...remaining] = additionalPetIds;
                                setForm((prev) => ({ ...prev, pet_id: nextPrimary }));
                                setAdditionalPetIds(remaining);
                              }
                              setError('');
                              setAssessmentPet(null);
                              setPendingAssessmentDraft(null);
                              fetchPetHealthStatus(p.id);
                            }}
                            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isSelected ? `${petBorder(p)} ${petLight(p)}` : `border-brand-dark-light hover:${petBorder(p)}/50`}`}>
                            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-white shadow">
                              {p.photo_url
                                ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                : <div className={`w-full h-full flex items-center justify-center ${petBg(p)}`}>
                                    <span className="text-xs font-bold text-white">{String(p.name || '?').slice(0, 2).toUpperCase()}</span>
                                  </div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-brand-dark">{p.name}</p>
                              <p className="text-[11px] text-brand-dark-soft">{sanitizeText(p.speciesType?.name || p.species_type?.name || '')}{sanitizeText(p.breed?.name ? ` • ${p.breed?.name}` : '')}</p>
                            </div>
                            {isSelected && <span className="rounded-full bg-brand-teal px-2.5 py-1 text-[10px] font-bold text-white">Selected</span>}
                            {blockedForDaycare && <span className="text-[10px] font-bold text-brand-dark-soft">Dogs only</span>}
                          </button>
                          {isSelected && currentPetHealthStatus !== undefined && (
                            currentPetHealthStatus === true && !currentPetHasTicksOrFlea ? (
                              bookingRequiresRabies && currentPetMissingRabies ? (
                                <div className="mt-2 rounded-xl border border-red-300 bg-red-50 px-3 py-3">
                                  <div className="flex items-start gap-2.5">
                                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-extrabold text-red-700">
                                      !
                                    </span>
                                    <div className="text-xs leading-relaxed">
                                      <p className="font-semibold text-red-700">Rabies vaccination is required for {activeItem?.category === 'hotel' ? 'Pet Hotel' : 'Pet Daycare'}.</p>
                                      <p className="text-red-600 mt-1">Please fill out a new assessment form and indicate that your pet is vaccinated with rabies to proceed with this booking.</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setAssessmentPet((prev) => (prev?.id === p.id ? null : p))}
                                    className="mt-2 ml-7 rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-red-600"
                                  >
                                    {assessmentPet?.id === p.id ? 'Hide Form' : 'Update Assessment'}
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
                                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                  Assessment form is complete.
                                </div>
                              )
                            ) : (
                              <div className="mt-2 rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-start gap-2.5">
                                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-extrabold text-amber-700">
                                      !
                                    </span>
                                    <div className="text-xs leading-relaxed">
                                      {currentPetHasTicksOrFlea ? (
                                        <>
                                          <p className="font-semibold text-amber-700">{PARASITE_BLOCK_TITLE}</p>
                                          <p className="text-amber-700">{PARASITE_BLOCK_BODY}</p>
                                        </>
                                      ) : (
                                        <>
                                          <p className="font-semibold text-amber-700">Assessment form for <span className="font-extrabold">{p?.name || 'this pet'}</span> is required before booking.</p>
                                          <p className="text-amber-700">Please fill out the Pet Assessment Form before proceeding.</p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {!currentPetHasTicksOrFlea && (
                                    <button
                                      type="button"
                                      onClick={() => setAssessmentPet((prev) => (prev?.id === p.id ? null : p))}
                                      className="shrink-0 rounded-lg bg-brand-teal px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand-teal-dark"
                                    >
                                      {assessmentPet?.id === p.id ? 'Hide Form' : 'Fill Out'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                          {isSelected && assessmentPet?.id === p.id && (
                            <div className="mt-3">
                              <PetAssessmentFormModal
                                isOpen={true}
                                pet={p}
                                apiBase="/api/my-pets"
                                theme="pet_owner"
                                serviceId={activeItem?.service?.id || null}
                                serviceCategory={activeItem?.category || activeItem?.service?.category || ''}
                                deferSave
                                saveLabel="Save for Booking"
                                initialDraft={pendingAssessmentDrafts?.[String(p.id)] || (String(pendingAssessmentDraft?.pet_id || '') === String(p.id) ? pendingAssessmentDraft : null)}
                                onClose={() => setAssessmentPet(null)}
                                onSaved={(payload) => {
                                  const draftVaccines = Array.isArray(payload?.vaccines) ? payload.vaccines : [];
                                  const draftHasRabies = !!(
                                    payload?.vaccine_rabies ||
                                    draftVaccines.some((name) => String(name || '').toLowerCase().includes('rabies'))
                                  );
                                  setPendingAssessmentDraft({ ...payload, pet_id: p.id });
                                  setPendingAssessmentDrafts((prev) => ({ ...prev, [String(p.id)]: { ...payload, pet_id: p.id } }));
                                  setPetAssessmentFlags((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      has_ticks: !!payload?.has_ticks,
                                      has_flea: !!payload?.has_flea,
                                      has_rabies: draftHasRabies,
                                      missing_rabies: !draftHasRabies,
                                    },
                                  }));
                                  setPetHealthStatus((prev) => ({ ...prev, [p.id]: true }));
                                  setAssessmentPet(null);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
    </>
  );
}
