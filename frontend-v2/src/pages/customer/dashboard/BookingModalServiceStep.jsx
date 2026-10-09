export default function BookingModalServiceStep({
  BANK_OPTIONS,
  BookingModalPetStep,
  BookingModalScheduleStep,
  BookingModalSummary,
  BookingStepIndicator,
  ClientBookingValidationBox,
  DAYCARE_MAX_PETS,
  EMPTY_ITEM,
  EWALLET_OPTIONS,
  MAX_BOOKING_DATE,
  MAX_BOOKING_MONTH_INDEX,
  PARASITE_BLOCK_BODY,
  PARASITE_BLOCK_TITLE,
  PAYMENT_TYPE_OPTIONS,
  PetAssessmentFormModal,
  STEPS,
  STEPS_WITHOUT_PAYMENT,
  STEPS_WITH_RESERVATION,
  SelectDropdown,
  TODAY,
  activeItem,
  activeItemIndex,
  addonDisplayName,
  addonDisplayTier,
  addonPriceLabel,
  daycareSelectedPetSizes,
  daycareSelectedPets,
  form,
  formatHotelDescription,
  getAutoCatSizeLabel,
  getDaycareSizeOptions,
  getServiceName,
  hasDaycareAndGrooming,
  hasHotelCategory,
  hasNonHotelCategory,
  hotelSuitesError,
  hotelSuitesLoading,
  hotelSuitesSlow,
  hotelSuitesForPet,
  isPawsomeExtrasService,
  normalizeService,
  pawsomeExtrasService,
  petSpecies,
  runServiceClickAction,
  selectedDaycarePetIds,
  selectedPetHasTicksOrFlea,
  services,
  servicesError,
  servicesLoading,
  setAdditionalPetIds,
  setCatalogRetryKey,
  setDaycarePetSizes,
  setItem,
  setHotelSuitesRetryKey,
  shouldSkipGroomingSizeForCat,
  sizeWeightHint,
  step,
}) {
  const hotelPetSizeOptions = petSpecies === 'D'
    ? ['Small', 'Medium', 'Large', 'XLarge'].map((value) => ({ value, label: value }))
    : petSpecies === 'C'
      ? [{ value: 'CAT', label: 'Cat' }, { value: 'KITTEN', label: 'Kitten' }]
      : [];
  const dogSuitesBySize = {
    Small: ['The Cozy Paw Suite', 'The Happy Paws Suite', 'The Grand Paw Suite'],
    Medium: ['The Happy Paws Suite', 'The Grand Paw Suite'],
    Large: ['The Grand Paw Suite'],
    XLarge: ['The VIPaws Suite'],
  };
  const compatibleHotelSuites = petSpecies === 'D'
    ? hotelSuitesForPet.filter((suite) => (dogSuitesBySize[activeItem.pet_size] || []).includes(suite.name))
    : hotelSuitesForPet;

  return (
    <>
            {/* Step 1: Choose Service */}
            {step === 1 && (
              <div className="space-y-4">
                {servicesLoading ? (
                  <div role="status" aria-label="Loading services">
                    {!activeItem.category ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="animate-pulse rounded-xl border border-brand-dark-light px-3 py-4">
                            <div className="mx-auto h-12 w-12 rounded-full bg-brand-dark-light/50" />
                            <div className="mx-auto mt-3 h-3 w-28 rounded bg-brand-dark-light/60" />
                            <div className="mx-auto mt-2 h-2.5 w-11/12 rounded bg-brand-dark-light/40" />
                            <div className="mx-auto mt-1.5 h-2.5 w-3/4 rounded bg-brand-dark-light/40" />
                            <div className="mx-auto mt-3 h-3 w-20 rounded bg-brand-dark-light/50" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="animate-pulse rounded-xl border border-brand-dark-light px-4 py-3">
                            <div className="h-3.5 w-36 rounded bg-brand-dark-light/60" />
                            <div className="mt-2 h-2.5 w-3/4 rounded bg-brand-dark-light/40" />
                            <div className="mt-3 h-2.5 w-24 rounded bg-brand-dark-light/50" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : servicesError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center" role="alert">
                    <i className="fa-solid fa-triangle-exclamation text-xl text-amber-500" />
                    <p className="mt-2 text-sm font-bold text-brand-dark">Unable to load services. Please try again.</p>
                    <button
                      type="button"
                      onClick={() => setCatalogRetryKey((value) => value + 1)}
                      className="mt-4 rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-bold text-white transition-colors hover:brightness-95"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                  {/* Active item */}
                  <div>

                    {/* Category picker */}
                    {!activeItem.category && (
                      <>
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft mb-3">Choose Your Pet&apos;s Appointment</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {[
                            { key: 'daycare',  label: 'Pet Daycare',  desc: 'Safe daytime care, play, and socialization for eligible dogs.', icon: 'fa-bone', border: 'border-brand-daycare/30', hoverBg: 'hover:bg-brand-daycare-soft', textColor: 'text-brand-daycare', iconBg: 'bg-brand-daycare-soft' },
                            { key: 'grooming', label: 'Pet Grooming', desc: 'Full grooming packages or individual Pawsome Extras.', icon: 'fa-scissors', border: 'border-brand-grooming/30', hoverBg: 'hover:bg-brand-grooming-soft', textColor: 'text-brand-grooming', iconBg: 'bg-brand-grooming-soft' },
                            { key: 'hotel',    label: 'Pet Hotel',    desc: 'Overnight stays with suite selection, dates, and reservation reference.', icon: 'fa-hotel', border: 'border-rose-300/30', hoverBg: 'hover:bg-rose-50', textColor: 'text-rose-500', iconBg: 'bg-rose-50' },
                          ].filter(({ key }) => {
                            if (!services.some((service) => String(service.category || '').toLowerCase() === key)) return false;
                            if (key === 'hotel' && (hasNonHotelCategory || hasDaycareAndGrooming)) return false;
                            if (key !== 'hotel' && hasHotelCategory) return false;
                            return true;
                          }).map(({ key, label, desc, icon, border, hoverBg, textColor, iconBg }) => {
                            const isCatPet = petSpecies === 'C';
                            const isDaycareBlocked = key === 'daycare' && isCatPet;
                            return (
                            <div key={key} className="relative group">
                            <button type="button"
                              disabled={selectedPetHasTicksOrFlea || isDaycareBlocked}
                              onClick={() => {
                                runServiceClickAction(() => {
                                  if (activeItem.category === key) return;
                                  if (key !== 'daycare') setAdditionalPetIds([]);
                                  setItem(activeItemIndex, { category: key, service: null, size_label: '', pet_size: '', addons: [], addonsDecided: false, grooming_booking_type: '', _daycareStep: '', flowPromptDone: true });
                                });
                              }}
                              className={`flex h-full w-full flex-col items-center justify-start gap-2.5 rounded-xl border px-3 py-4 transition-all ${border} ${
                                selectedPetHasTicksOrFlea || isDaycareBlocked ? 'cursor-not-allowed opacity-45' : hoverBg
                              }`}>
                              <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center`}>
                                <i className={`fa-solid ${icon} ${textColor} text-lg`} />
                              </div>
                              <div className="text-center">
                                <p className={`text-xs font-bold ${textColor} mb-0.5`}>{label}</p>
                                <p className="mt-1 text-[11px] leading-relaxed text-brand-dark-soft">{desc}</p>
                              </div>
                            </button>
                            {isDaycareBlocked && (
                              <span className="absolute left-1/2 -translate-x-1/2 -bottom-7 z-50 whitespace-nowrap rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                Daycare is available for dogs only
                              </span>
                            )}
                            </div>
                            );
                          })}
                        </div>
                        {selectedPetHasTicksOrFlea && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <p className="font-semibold">{PARASITE_BLOCK_TITLE}</p>
                            <p className="mt-1">{PARASITE_BLOCK_BODY}</p>
                          </div>
                        )}
                      </>
                    )}

                    {activeItem.category === 'hotel' && (
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                          Pet Size <span className="text-red-500">*</span>
                        </label>
                        <SelectDropdown
                          value={activeItem.pet_size || ''}
                          onChange={(value) => {
                            if (value === activeItem.pet_size) return;
                            setItem(activeItemIndex, { pet_size: value });
                          }}
                          options={hotelPetSizeOptions}
                          placeholder={hotelPetSizeOptions.length ? 'Select pet size' : 'Pet species is not supported'}
                          disabled={!hotelPetSizeOptions.length}
                        />
                        <p className="mt-1 text-[10px] text-brand-dark-soft">
                          {petSpecies === 'D' ? "Choose the dog's Daycare size category." : 'Choose the existing cat category that fits this pet.'}
                        </p>
                        {activeItem.hotel_suite_id && (
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-brand-dark-light px-3 py-2">
                            <span className="text-[10px] font-semibold text-brand-dark">
                              Selected suite: {hotelSuitesForPet.find((suite) => String(suite.id) === String(activeItem.hotel_suite_id))?.name || 'Hotel Suite'}
                              {petSpecies === 'D' && !(dogSuitesBySize[activeItem.pet_size] || []).includes(
                                hotelSuitesForPet.find((suite) => String(suite.id) === String(activeItem.hotel_suite_id))?.name,
                              ) && ' — choose a compatible suite for this size.'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setItem(activeItemIndex, {
                                hotel_suite_id: '',
                                service: null,
                                size_label: '',
                              })}
                              className="shrink-0 text-[10px] font-bold text-brand-teal hover:underline"
                            >
                              Change suite
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hotel: pick suite */}
                    {activeItem.category === 'hotel' && !activeItem.hotel_suite_id && (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <button type="button" onClick={() => setItem(activeItemIndex, { category: '', service: null, size_label: '', hotel_suite_id: '' })}
                            className="text-brand-dark-soft hover:text-brand-teal transition-colors">
                            <i className="fa-solid fa-chevron-left text-xs" />
                          </button>
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                            Select Suite - {petSpecies === 'D' ? 'Dogs' : 'Cats'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {hotelSuitesLoading ? (
                            <div role="status" aria-label="Checking available Hotel Suites">
                              <p className="mb-2 text-xs font-medium text-brand-dark-soft">Checking available Hotel Suites…</p>
                              <div className="space-y-2">
                                {[0, 1, 2].map((index) => (
                                  <div key={index} className="animate-pulse rounded-xl border border-brand-dark-light px-4 py-3">
                                    <div className="h-3.5 w-40 rounded bg-brand-dark-light/60" />
                                    <div className="mt-2 h-2.5 w-32 rounded bg-brand-dark-light/40" />
                                  </div>
                                ))}
                              </div>
                              {hotelSuitesSlow && (
                                <p className="mt-2 text-xs text-amber-700" role="status">
                                  This is taking longer than expected. We&apos;re still checking availability.
                                </p>
                              )}
                            </div>
                          ) : hotelSuitesError ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center" role="alert">
                              <p className="text-sm font-semibold text-brand-dark">Unable to load Hotel Suites. Please try again.</p>
                              <button
                                type="button"
                                onClick={() => setHotelSuitesRetryKey((value) => value + 1)}
                                className="mt-3 rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white transition-colors hover:brightness-95"
                              >
                                Retry
                              </button>
                            </div>
                          ) : compatibleHotelSuites.length === 0 ? (
                            <p className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-4 text-xs text-brand-dark-soft">
                              {petSpecies === 'D' && !activeItem.pet_size
                                ? "Select the dog's size above to see compatible Hotel Suites."
                                : hotelSuitesForPet.length
                                ? 'No Hotel Suites match the selected pet size.'
                                : 'No Hotel Suites are configured for this pet species.'}
                            </p>
                          ) : (
                            <>
                              {hotelSuitesForPet.find((suite) => suite.description)?.description && (
                                <p className="rounded-xl border border-brand-hotel/20 bg-brand-hotel-soft/40 px-4 py-3 text-xs leading-relaxed text-brand-dark-soft">
                                  {formatHotelDescription(hotelSuitesForPet.find((suite) => suite.description).description)}
                                </p>
                              )}
                              {compatibleHotelSuites.map((suite) => (
                                <button key={suite.id} type="button"
                                  onClick={() => {
                                    runServiceClickAction(() => {
                                      if (activeItem.hotel_suite_id === suite.id) return;
                                      const hotelService = services.find((s) => s.category === 'hotel');
                                      setItem(activeItemIndex, {
                                        hotel_suite_id: suite.id,
                                        service: hotelService ? normalizeService(hotelService) : { id: '', name: suite.name, category: 'hotel' },
                                        size_label: suite.size_range,
                                      });
                                    });
                                  }}
                                  className="w-full text-left rounded-xl border border-brand-dark-light px-4 py-3 hover:border-brand-teal/50 transition-colors">
                                  <p className="text-sm font-bold text-brand-dark">{suite.name}</p>
                                  <p className="text-xs text-brand-dark font-semibold mt-0.5">
                                    PHP {Number(suite.price_per_night).toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}/night • {suite.size_range}
                                  </p>
                                </button>
                              ))}
                              <p className="text-[10px] text-brand-dark-soft">
                                Availability and remaining capacity are checked for your selected dates in the next step.
                              </p>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* Grooming: choose a full package or standalone Pawsome Extras first. */}
                    {activeItem.category === 'grooming' && !activeItem.service && !activeItem.grooming_booking_type && (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setItem(activeItemIndex, { category: '', service: null, size_label: '', addons: [], grooming_booking_type: '' })}
                            className="text-brand-dark-soft transition-colors hover:text-brand-teal"
                          >
                            <i className="fa-solid fa-chevron-left text-xs" />
                          </button>
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Choose Grooming Service</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setItem(activeItemIndex, { grooming_booking_type: 'package', service: null, size_label: '', addons: [], addonsDecided: false })}
                            className="rounded-xl border border-brand-grooming/30 bg-white px-4 py-4 text-center transition-colors hover:border-brand-grooming hover:bg-brand-grooming-soft"
                          >
                            <i className="fa-solid fa-scissors text-lg text-brand-grooming" />
                            <p className="mt-2 text-xs font-extrabold text-brand-grooming">Grooming Package</p>
                            <p className="mt-1 text-[10px] text-brand-dark-soft">Bath, trim, and full grooming care</p>
                          </button>
                          <button
                            type="button"
                            disabled={!pawsomeExtrasService}
                            onClick={() => {
                              const normalizedService = normalizeService(pawsomeExtrasService);
                              setItem(activeItemIndex, {
                                grooming_booking_type: 'extras',
                                service: normalizedService,
                                size_label: 'Standard',
                                addons: [],
                                addonsDecided: false,
                              });
                            }}
                            className="rounded-xl border border-brand-grooming/30 bg-white px-4 py-4 text-center transition-colors hover:border-brand-grooming hover:bg-brand-grooming-soft disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <i className="fa-solid fa-paw text-lg text-brand-grooming" />
                            <p className="mt-2 text-xs font-extrabold text-brand-grooming">Pawsome Extras</p>
                            <p className="mt-1 text-[10px] text-brand-dark-soft">Choose individual grooming extras</p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Grooming & Daycare: pick service */}
                    {activeItem.category === 'grooming' && activeItem.grooming_booking_type === 'package' && !activeItem.service && (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <button type="button" onClick={() => setItem(activeItemIndex, { grooming_booking_type: '', service: null, size_label: '', addons: [] })}
                            className="text-brand-dark-soft hover:text-brand-teal transition-colors">
                            <i className="fa-solid fa-chevron-left text-xs" />
                          </button>
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Select a Grooming Package</p>
                        </div>
                        <div className="space-y-2">
                          {services.filter((s) => s.category === activeItem.category && !isPawsomeExtrasService(s)).map((svc) => (
                            <button key={svc.id} type="button"
                              onClick={() => {
                                runServiceClickAction(() => {
                                  if (String(activeItem.service?.id || '') === String(svc.id)) return;
                                  const normalizedService = normalizeService(svc);
                                  const autoCatSize = shouldSkipGroomingSizeForCat(normalizedService, petSpecies)
                                    ? getAutoCatSizeLabel(normalizedService)
                                    : '';
                                  setItem(activeItemIndex, {
                                    service: normalizedService,
                                    size_label: autoCatSize,
                                    addons: [],
                                    addonsDecided: false,
                                  });
                                });
                              }}
                              className="w-full text-left rounded-xl border border-brand-dark-light px-4 py-3 hover:border-brand-teal/50 transition-colors">
                              <p className="text-sm font-bold text-brand-dark">{getServiceName(svc)}</p>
                              {svc.description && <p className="text-xs text-brand-dark-soft mt-0.5">{svc.description}</p>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Daycare requires a catalog service before duration and size can render. */}
                    {activeItem.category === 'daycare' && !activeItem.service && (
                      <div>
                        <div className={`mb-3 items-center gap-2 ${services.filter((service) => String(service.category || '').toLowerCase() === 'daycare').length === 1 ? 'hidden' : 'flex'}`}>
                          <button type="button" onClick={() => setItem(activeItemIndex, { category: '', service: null, size_label: '', daycare_duration: '', _daycareStep: '' })}
                            className="text-brand-dark-soft transition-colors hover:text-brand-teal">
                            <i className="fa-solid fa-chevron-left text-xs" />
                          </button>
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Select Daycare Package</p>
                        </div>
                        {servicesLoading ? (
                          <div className="space-y-2" aria-label="Loading daycare options">
                            {[0, 1, 2].map((index) => (
                              <div key={index} className="animate-pulse rounded-xl border border-brand-daycare/20 px-4 py-3">
                                <div className="h-3.5 w-36 rounded bg-brand-daycare/20" />
                                <div className="mt-2 h-2.5 w-3/4 rounded bg-brand-dark-light/60" />
                              </div>
                            ))}
                          </div>
                        ) : servicesError ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
                            <i className="fa-solid fa-triangle-exclamation text-xl text-amber-500" />
                            <p className="mt-2 text-sm font-bold text-brand-dark">Daycare options could not be loaded.</p>
                            <p className="mt-1 text-xs text-brand-dark-soft">{servicesError}</p>
                            <button
                              type="button"
                              onClick={() => setCatalogRetryKey((value) => value + 1)}
                              className="mt-4 rounded-xl bg-brand-daycare px-5 py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-95"
                            >
                              Retry
                            </button>
                          </div>
                        ) : services.filter((service) => String(service.category || '').toLowerCase() === 'daycare').length === 1 ? (
                          <div className="animate-pulse rounded-xl border border-brand-daycare/20 px-4 py-4" aria-label="Preparing daycare options">
                            <div className="h-3.5 w-40 rounded bg-brand-daycare/20" />
                            <div className="mt-3 h-10 w-full rounded-lg bg-brand-dark-light/50" />
                          </div>
                        ) : services.filter((service) => String(service.category || '').toLowerCase() === 'daycare').length > 1 ? (
                          <div className="space-y-2">
                            {services.filter((service) => String(service.category || '').toLowerCase() === 'daycare').map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => setItem(activeItemIndex, {
                                  service: normalizeService(service),
                                  size_label: '',
                                  daycare_duration: '',
                                  _daycareStep: '',
                                })}
                                className="w-full rounded-xl border border-brand-dark-light px-4 py-3 text-left transition-colors hover:border-brand-daycare/60 hover:bg-brand-daycare-soft/30"
                              >
                                <p className="text-sm font-bold text-brand-dark">{getServiceName(service)}</p>
                                {service.description && <p className="mt-0.5 text-xs text-brand-dark-soft">{service.description}</p>}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-brand-daycare/30 bg-brand-daycare-soft/40 px-4 py-6 text-center">
                            <i className="fa-solid fa-circle-info text-xl text-brand-daycare" />
                            <p className="mt-2 text-sm font-bold text-brand-dark">No active daycare package was found.</p>
                            <p className="mt-1 text-xs text-brand-dark-soft">Please ask an administrator to activate the daycare service and its pricing tiers.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeItem.service && activeItem.category === 'daycare' && (() => {
                      const durationOptions = [
                        { value: 'hourly', label: 'Hourly (1 hour)', prefix: 'Hourly' },
                        { value: 'half_day', label: 'Half Day (4 hours)', prefix: 'Half Day' },
                        { value: 'full_day', label: 'Full Day (8 hours)', prefix: 'Full Day' },
                      ].filter((duration) => (activeItem.service?.tiers || []).some((tier) => String(tier.size_label || '').startsWith(duration.prefix)));
                      const sizeOptions = getDaycareSizeOptions(activeItem);
                      return (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-brand-daycare/25 bg-brand-daycare-soft/30 px-3 py-3">
                            <p className="mb-2 text-[11px] font-bold text-brand-dark">Daycare Duration</p>
                            <SelectDropdown
                              value={activeItem.daycare_duration || ''}
                              onChange={(value) => {
                                const prefix = durationOptions.find((option) => option.value === value)?.prefix || '';
                                setItem(activeItemIndex, { daycare_duration: value, _daycareStep: prefix, size_label: '' });
                                setDaycarePetSizes((previous) => {
                                  const next = { ...previous };
                                  selectedDaycarePetIds.forEach((petId) => delete next[String(petId)]);
                                  return next;
                                });
                              }}
                              options={durationOptions.map(({ value, label }) => ({ value, label }))}
                              placeholder="Select duration"
                            />
                          </div>
                          {activeItem.daycare_duration && daycareSelectedPets.map((pet) => {
                            const petId = String(pet.id);
                            return (
                              <div key={petId} className="rounded-xl border border-brand-daycare/25 bg-brand-daycare-soft/30 px-3 py-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-brand-dark">Size of Pet</p>
                                  <p className="truncate text-[10px] font-semibold text-brand-teal">{pet.name}</p>
                                </div>
                                <SelectDropdown
                                  value={daycareSelectedPetSizes[petId] || ''}
                                  onChange={(size) => {
                                    setDaycarePetSizes((previous) => ({ ...previous, [petId]: size }));
                                    if (petId === String(form.pet_id)) setItem(activeItemIndex, { size_label: size });
                                  }}
                                  options={sizeOptions}
                                  placeholder="Select size"
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Size selection */}
                    {activeItem.service && activeItem.category !== 'hotel' && activeItem.category !== 'daycare' && !activeItem.size_label && (() => {
                      const allTiers = activeItem.service?.tiers || [];
                      const isDaycare = activeItem.category === 'daycare';

                      // Daycare: two-step - pick duration first, then size
                      const DURATIONS = ['Hourly', 'Half Day', 'Full Day'];
                      const SIZES = ['Small', 'Medium', 'Large', 'XLarge'];
                      const [daycareStep, setDaycareStep] = [activeItem._daycareStep || '', (v) => setItem(activeItemIndex, { _daycareStep: v })];

                      const filteredTiers = isDaycare
                        ? (daycareStep ? allTiers.filter((t) => t.size_label?.startsWith(daycareStep)) : [])
                        : allTiers.filter((tier) => {
                            const s = tier.size_label?.toUpperCase();
                            const catSizes = ['CAT', 'KITTEN'];
                            if (petSpecies === 'C') return catSizes.includes(s);
                            if (petSpecies === 'D') return !catSizes.includes(s);
                            return true;
                          });

                      return (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <button type="button" onClick={() => isDaycare && daycareStep
                              ? setItem(activeItemIndex, { _daycareStep: '' })
                              : setItem(activeItemIndex, { category: '', service: null, size_label: '', _daycareStep: '' })}
                              className="text-brand-dark-soft hover:text-brand-teal transition-colors">
                              <i className="fa-solid fa-chevron-left text-xs" />
                            </button>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                              {isDaycare && !daycareStep ? 'Select Duration' : 'Select Size'}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-brand-dark -mt-1">{getServiceName(activeItem.service)}</p>

                          {/* Daycare step 1: duration */}
                          {isDaycare && !daycareStep && (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {DURATIONS.map((dur) => {
                                const tierValue = dur === 'Hourly' ? 'hourly' : dur === 'Half Day' ? 'half_day' : 'full_day';
                                return (
                                <button key={dur} type="button"
                                  onClick={() => setItem(activeItemIndex, { _daycareStep: dur, daycare_duration: tierValue })}
                                  className="rounded-xl border border-brand-dark-light hover:border-brand-grooming/50 hover:bg-brand-grooming-soft px-3 py-3 text-left transition-colors">
                                  <p className="text-xs font-bold text-brand-dark">{dur}</p>
                                  <p className="text-[10px] text-brand-dark-soft mt-0.5">
                                    {dur === 'Hourly' ? 'Per hour' : dur === 'Half Day' ? '1:01 to 4 hours' : '4:01 to 8 hours'}
                                  </p>
                                </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Daycare step 2 / grooming: size */}
                          {(!isDaycare || daycareStep) && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {filteredTiers.map((tier) => {
                                const sizeLabel = isDaycare ? tier.size_label.replace(daycareStep + ' - ', '') : tier.size_label;
                                return (
                                  <button key={tier.size_label} type="button"
                                    onClick={() => {
                                      if (isDaycare) {
                                        setDaycarePetSizes((prev) => ({ ...prev, [String(form.pet_id)]: tier.size_label }));
                                        setItem(activeItemIndex, { size_label: tier.size_label, addonsDecided: true });
                                        return;
                                      }
                                      setItem(activeItemIndex, { size_label: tier.size_label });
                                    }}
                                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${activeItem.size_label === tier.size_label ? 'border-brand-teal bg-brand-teal-light' : 'border-brand-dark-light hover:border-brand-teal/50'}`}>
                                    <p className="text-xs font-bold text-brand-dark">{sizeLabel}</p>
                                    {sizeWeightHint(tier.size_label) && <p className="text-[10px] text-brand-dark-soft">{sizeWeightHint(tier.size_label)}</p>}
                                    <p className="text-xs text-brand-dark font-semibold">
                                      PHP {Number(tier.price).toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Standalone Pawsome Extras item selection */}
                    {activeItem.size_label && isPawsomeExtrasService(activeItem.service) && activeItem.availableAddons?.length > 0 && (() => {
                      const groups = [];
                      const seen   = {};
                      activeItem.availableAddons.forEach((addon) => {
                        const base = addonDisplayName(addon);
                        const size = addonDisplayTier(addon);
                        if (!seen[base]) { seen[base] = groups.length; groups.push({ base, items: [] }); }
                        groups[seen[base]].items.push({ ...addon, size });
                      });
                      groups.sort((a, b) => {
                        const aHasChoices = a.items.length > 1 || Boolean(a.items[0]?.size);
                        const bHasChoices = b.items.length > 1 || Boolean(b.items[0]?.size);
                        if (aHasChoices !== bHasChoices) return aHasChoices ? -1 : 1;
                        return a.base.localeCompare(b.base);
                      });
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setItem(activeItemIndex, { grooming_booking_type: '', service: null, size_label: '', addons: [], availableAddons: [], addonsDecided: false })}
                                className="text-brand-dark-soft transition-colors hover:text-brand-teal"
                                aria-label="Back to grooming choices"
                              >
                                <i className="fa-solid fa-chevron-left text-xs" />
                              </button>
                              <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Select Pawsome Extras</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-brand-dark-soft">{activeItem.addons?.length || 0} of 3 selected</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {groups.map(({ base, items }) => {
                              const isSized = items.length > 1 || items[0].size;
                              if (isSized) {
                                const selectedAddon = items.find((a) => activeItem.addons?.includes(a.id));
                                return (
                                  <div key={base} className={`rounded-xl border px-4 py-3 transition-colors ${selectedAddon ? 'border-brand-teal bg-brand-teal-light' : 'border-brand-dark-light'}`}>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <p className="text-sm font-semibold text-brand-dark">{base}</p>
                                      {selectedAddon && (
                                        <button
                                          type="button"
                                          onClick={() => setItem(activeItemIndex, { addons: activeItem.addons.filter((id) => !items.some((addon) => addon.id === id)) })}
                                          className="text-[10px] font-bold text-brand-teal hover:underline"
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </div>
                                    <SelectDropdown
                                      value={selectedAddon?.id || ''}
                                      onChange={(selectedId) => {
                                        const withoutThisGroup = activeItem.addons.filter((id) => !items.some((addon) => addon.id === id));
                                        if (isPawsomeExtrasService(activeItem.service) && selectedId && withoutThisGroup.length >= 3) return;
                                        setItem(activeItemIndex, { addons: selectedId ? [...withoutThisGroup, selectedId] : withoutThisGroup });
                                      }}
                                      options={items.map((addon) => ({
                                        value: addon.id,
                                        label: `${addon.size || 'Standard'} - ${addonPriceLabel(addon)}`,
                                      }))}
                                      placeholder="Select size"
                                      buttonClassName="!rounded-lg !px-3 !py-2"
                                      textClassName="!text-xs !font-semibold"
                                    />
                                  </div>
                                );
                              }
                              const addon    = items[0];
                              const selected = activeItem.addons?.includes(addon.id);
                              const selectionLimitReached = isPawsomeExtrasService(activeItem.service)
                                && !selected
                                && (activeItem.addons?.length || 0) >= 3;
                              const price    = addonPriceLabel(addon);
                              return (
                                <button key={addon.id} type="button"
                                  disabled={selectionLimitReached}
                                  onClick={() => setItem(activeItemIndex, { addons: activeItem.addons?.includes(addon.id) ? activeItem.addons.filter((id) => id !== addon.id) : [...(activeItem.addons || []), addon.id] })}
                                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-brand-teal bg-brand-teal-light' : 'border-brand-dark-light hover:border-brand-teal/50'}`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-brand-teal border-brand-teal' : 'border-brand-dark-light'}`}>
                                      {selected && <i className="fa-solid fa-check text-white text-[8px]" />}
                                    </div>
                                    <p className="text-sm font-semibold text-brand-dark text-left">{addon.name}</p>
                                  </div>
                                  <span className="text-xs text-brand-dark font-semibold shrink-0 ml-2">{price}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}

                    {/* Pawsome Extras service has no configured choices */}
                    {activeItem.size_label && isPawsomeExtrasService(activeItem.service) && activeItem.availableAddons?.length === 0 && (
                      <div className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3 text-xs text-brand-dark-soft">
                        No Pawsome Extras are available right now.
                      </div>
                    )}

                    {/* Selected summary - removed, single service per booking */}

                  </div>
                  </>
                )}
              </div>
            )}

    </>
  );
}
