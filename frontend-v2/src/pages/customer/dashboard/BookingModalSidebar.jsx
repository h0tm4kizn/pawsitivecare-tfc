import { getServiceName } from './bookingUtils';
import { daycareSizeLabel, isPawsomeExtrasService, petBg } from './bookingModalUtils';

export default function BookingModalSidebar({ step, STEPS, bookingItems, selectedPet, hasDaycareCategory, daycareSelectedPets, daycarePricingRows, hotelSuites, finalEstimatedTotal, requiredHotelDeposit, estimatedCheckInBalance }) {
  return (
    <>
              {/* Booking Summary Sidebar - only show before summary step */}
              {step < STEPS.length - 1 && (
                <div className="hidden lg:flex flex-col border-l border-brand-dark-light bg-brand-surface overflow-y-auto scrollbar-teal">
                  <div className="px-4 py-4 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Booking Summary</p>

                    {/* Pet Info */}
                    {selectedPet && (
                      <div className="rounded-xl border border-brand-dark-light bg-white px-3 py-3">
                        <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">{hasDaycareCategory ? 'Pets' : 'Pet'}</p>
                        <div className="space-y-2">
                          {(hasDaycareCategory ? daycareSelectedPets : [selectedPet]).map((pet) => (
                            <div key={pet.id} className="flex items-center gap-2">
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-brand-dark-light">
                                {pet.photo_url
                                  ? <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                                  : <div className={`flex h-full w-full items-center justify-center ${petBg(pet)}`}>
                                      <span className="text-[8px] font-bold text-white">{String(pet.name || '?').slice(0, 2).toUpperCase()}</span>
                                    </div>
                                }
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-brand-dark">{pet.name}</p>
                                <p className="truncate text-[10px] text-brand-dark-soft">
                                  {pet.speciesType?.name || pet.species_type?.name || pet.species_name || ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Services List */}
                    {bookingItems.some((item) => item.service || item.hotel_suite_id) && (
                      <div className="rounded-xl border border-brand-dark-light bg-white px-3 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft mb-2">Services</p>
                        <div className="space-y-2">
                          {bookingItems.map((item, idx) => {
                            if (!item.service && !item.hotel_suite_id) return null;
                            const tiers = item.service?.tiers || [];
                            const tier = tiers.find((t) => t.size_label === item.size_label);
                            const daycareRows = item.category === 'daycare' ? daycarePricingRows : [];
                            const basePrice = item.category === 'daycare'
                              ? daycareRows.reduce((sum, row) => sum + row.price, 0)
                              : Number(tier?.price || 0);
                            const suite = hotelSuites.find((s) => s.id === item.hotel_suite_id);
                            const suitePrice = Number(suite?.price_per_night || 0) * Number(item.hotel_nights || 0);
                            const addonsPrice = (isPawsomeExtrasService(item.service) ? (item.availableAddons || []) : [])
                              .filter((a) => (item.addons || []).includes(a.id))
                              .reduce((acc, a) => acc + Number(a.price_min || 0), 0);
                            const itemTotal = basePrice + suitePrice + addonsPrice;
                            return (
                              <div key={idx} className="border-b border-brand-dark-light/30 pb-2 last:border-0 last:pb-0">
                                <p className="text-[11px] font-bold text-brand-dark">
                                  {item.category === 'hotel' ? suite?.name || getServiceName(item.service) : getServiceName(item.service)}
                                </p>
                                {item.category === 'daycare' && daycareRows.length > 0 ? (
                                  <div className="mt-1 space-y-0.5">
                                    {daycareRows.map(({ pet, sizeLabel, price }) => (
                                      <p key={pet.id} className="text-[10px] text-brand-dark-soft">
                                        {pet.name}: {daycareSizeLabel(sizeLabel)} · PHP {price.toFixed(2)}
                                      </p>
                                    ))}
                                  </div>
                                ) : item.size_label && (
                                  <p className="text-[10px] text-brand-dark-soft mt-0.5">{item.size_label}</p>
                                )}
                                {isPawsomeExtrasService(item.service) && item.addons?.length > 0 && (
                                  <p className="text-[10px] text-brand-dark-soft mt-0.5">
                                    + {item.availableAddons?.filter((a) => item.addons.includes(a.id)).map((a) => a.name).join(', ')}
                                  </p>
                                )}
                                {itemTotal > 0 && (
                                  <p className="text-[11px] font-semibold text-brand-dark mt-1">PHP {itemTotal.toFixed(2)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Estimated Total */}
                    {finalEstimatedTotal > 0 && (
                      <div className="rounded-xl border border-brand-teal/30 bg-brand-teal-light px-3 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-brand-dark">Estimated Total</p>
                          <p className="text-sm font-extrabold text-brand-teal">
                            PHP {finalEstimatedTotal.toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        {requiredHotelDeposit > 0 && (
                          <div className="mt-2 pt-2 border-t border-brand-teal/20 space-y-0.5">
                            <p className="text-[10px] text-brand-dark-soft">
                              Deposit (50%): <span className="font-bold text-brand-dark">PHP {requiredHotelDeposit.toFixed(2)}</span>
                            </p>
                            <p className="text-[10px] text-brand-dark-soft">
                              Balance: <span className="font-bold text-brand-dark">PHP {estimatedCheckInBalance.toFixed(2)}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            
    </>
  );
}
