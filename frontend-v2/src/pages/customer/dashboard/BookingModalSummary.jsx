import '../../../utils/dateUtils';
import { normalizeBreedName } from '../../../utils/textUtils';
import './bookingUtils';
import { petBg } from './bookingModalUtils';

function ReceiptRow({ label, value }) {
  return <div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-brand-dark-soft">{label}</span><span className="text-right font-semibold text-brand-dark">{value}</span></div>;
}

export default function BookingModalSummary({ isSummaryStep, bookingItems, hasDaycareCategory, selectedPet, daycareSelectedPets, daycarePricingRows, hotelSuites, getServiceName, isPawsomeExtrasService, formatHotelDateTime, fmtTime, daycareSizeLabel, modeOfPayment, selectedReservationProvider, referenceNumber, requiredHotelDeposit, finalEstimatedTotal, estimatedCheckInBalance, form, setForm }) {
  return (<>
            {/* Step 3/4: Summary Receipt */}
            {isSummaryStep && (
              <div className="mx-auto w-full max-w-md space-y-4">
                {bookingItems.length === 2 && bookingItems.some((i) => i.category === 'grooming') && bookingItems.some((i) => i.category === 'daycare') && (
                  <div className="rounded-xl border border-brand-teal/25 bg-brand-teal-light px-4 py-3">
                    <p className="text-sm font-bold text-brand-dark">Your pet&apos;s appointment includes Grooming and Daycare.</p>
                    <p className="mt-1 text-xs text-brand-dark-soft">Grooming will be scheduled first, followed by Daycare. This helps keep the visit organized and ensures your pet is clean before the supervised stay.</p>
                  </div>
                )}
                {/* Receipt card */}
                <div className="overflow-hidden rounded-xl border border-brand-dark-light">

                  {/* Pet */}
                  {selectedPet && (
                    <div className="border-b border-dashed border-brand-dark-light px-5 py-4">
                      <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">{hasDaycareCategory ? 'Pets' : 'Pet'}</p>
                      <div className="space-y-3">
                        {(hasDaycareCategory ? daycareSelectedPets : [selectedPet]).map((pet) => (
                          <div key={pet.id} className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-brand-dark-light">
                              {pet.photo_url
                                ? <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                                : <div className={`flex h-full w-full items-center justify-center ${petBg(pet)}`}>
                                    <span className="text-[9px] font-bold text-white">{String(pet.name || '?').slice(0, 2).toUpperCase()}</span>
                                  </div>
                              }
                            </div>
                            <div>
                              <p className="text-sm font-bold text-brand-dark">{pet.name}</p>
                              <p className="text-[11px] text-brand-dark-soft">
                                {pet.speciesType?.name || pet.species_type?.name || ''}
                                {pet.breed?.name ? ` • ${normalizeBreedName(pet.breed.name, pet)}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Services */}
                  <div className="border-b border-dashed border-brand-dark-light px-5 py-4">
                    <p className="mb-3 text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">Services</p>
                    <div className="space-y-4">
                      {bookingItems.map((item, idx) => {
                        const tiers = item.service?.tiers || [];
                        const tier = tiers.find((t) => t.size_label === item.size_label);
                        const daycareRows = item.category === 'daycare' ? daycarePricingRows : [];
                        const basePrice = item.category === 'daycare'
                          ? daycareRows.reduce((sum, row) => sum + row.price, 0)
                          : Number(tier?.price || 0);
                        const suite = hotelSuites.find((s) => s.id === item.hotel_suite_id);
                        const suitePrice = Number(suite?.price_per_night || 0) * Number(item.hotel_nights || 0);
                        const selectedAddons = isPawsomeExtrasService(item.service)
                          ? (item.availableAddons || []).filter((a) => (item.addons || []).includes(a.id))
                          : [];
                        const addonsPrice = selectedAddons.reduce((acc, a) => acc + Number(a.price_min || 0), 0);
                        const itemTotal = basePrice + suitePrice + addonsPrice;
                        const addonNames = selectedAddons.map((a) => a.name);
                        const showInlinePrice = bookingItems.length > 1 && item.category !== 'daycare';
                        const showPriceBreakdown = daycareRows.length > 1
                          || selectedAddons.length > 0;
                        return (
                          <div key={idx} className="border-b border-brand-dark-light/30 pb-3 last:border-0 last:pb-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-brand-dark">
                                  {item.category === 'hotel' ? suite?.name || getServiceName(item.service) : getServiceName(item.service)}
                                </p>
                                {item.service?.display_id && (
                                  <p className="text-[9px] font-mono font-semibold text-brand-teal mt-0.5">
                                    {item.service.display_id}
                                  </p>
                                )}
                              </div>
                              {showInlinePrice && <p className="shrink-0 text-xs font-bold text-brand-dark">PHP {itemTotal.toFixed(2)}</p>}
                            </div>
                            {item.category !== 'daycare' && item.size_label && (
                              <div className="flex items-center gap-1.5">
                                <i className="fa-solid fa-ruler text-[8px] text-brand-dark-soft" />
                                <p className="text-[10px] text-brand-dark-soft">Size: <span className="font-semibold text-brand-dark">{item.size_label}</span></p>
                              </div>
                            )}
                            {item.category === 'hotel' && item.pet_size && (
                              <div className="flex items-center gap-1.5">
                                <i className="fa-solid fa-ruler text-[8px] text-brand-dark-soft" />
                                <p className="text-[10px] text-brand-dark-soft">Pet Size: <span className="font-semibold text-brand-dark">{item.pet_size}</span></p>
                              </div>
                            )}
                            {item.category === 'hotel' ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-calendar-check text-[8px] text-brand-dark-soft" />
                                  <p className="text-[10px] text-brand-dark-soft">Check-in: <span className="font-semibold text-brand-dark">{formatHotelDateTime(item.appointment_date, item.start_time || '09:00:00')}</span></p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-calendar-xmark text-[8px] text-brand-dark-soft" />
                                  <p className="text-[10px] text-brand-dark-soft">Check-out: <span className="font-semibold text-brand-dark">{formatHotelDateTime(item.hotel_checkout, item.start_time || '09:00:00')}</span></p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-moon text-[8px] text-brand-dark-soft" />
                                  <p className="text-[10px] text-brand-dark-soft">Nights: <span className="font-semibold text-brand-dark">{item.hotel_nights}</span></p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-tag text-[8px] text-brand-dark-soft" />
                                  <p className="text-[10px] text-brand-dark-soft">Nightly rate: <span className="font-semibold text-brand-dark">PHP {Number(suite?.price_per_night || 0).toFixed(2)}</span></p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-calendar text-[8px] text-brand-dark-soft" />
                                  <p className="text-[10px] text-brand-dark-soft">Date: <span className="font-semibold text-brand-dark">{item.appointment_date}</span></p>
                                </div>
                                {item.start_time && (
                                  <div className="flex items-center gap-1.5">
                                    <i className="fa-solid fa-clock text-[8px] text-brand-dark-soft" />
                                    <p className="text-[10px] text-brand-dark-soft">Time: <span className="font-semibold text-brand-dark">{fmtTime(item.start_time)}</span></p>
                                  </div>
                                )}
                              </>
                            )}
                            {addonNames.length > 0 && (
                              <div className="flex items-start gap-1.5">
                                <i className="fa-solid fa-plus text-[8px] text-brand-dark-soft mt-0.5" />
                                <p className="text-[10px] text-brand-dark-soft">Pawsome Extras: <span className="font-semibold text-brand-dark">{addonNames.join(', ')}</span></p>
                              </div>
                            )}
                            {showPriceBreakdown && <div className="mt-2 rounded-lg border border-brand-dark-light/40 bg-brand-surface px-2.5 py-2 text-[10px]">
                              {item.category === 'daycare' ? (
                                daycareRows.map(({ pet, sizeLabel, price }) => (
                                  <div key={pet.id} className="mt-1 flex items-center justify-between gap-2 first:mt-0">
                                    <span className="text-brand-dark-soft">{pet.name} ({daycareSizeLabel(sizeLabel)})</span>
                                    <span className="font-semibold text-brand-dark">PHP {price.toFixed(2)}</span>
                                  </div>
                                ))
                              ) : selectedAddons.length > 0 ? (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-brand-dark-soft">Base service</span>
                                  <span className="font-semibold text-brand-dark">PHP {basePrice.toFixed(2)}</span>
                                </div>
                              ) : null}
                              {selectedAddons.map((addon) => (
                                <div key={addon.id} className="mt-1 flex items-center justify-between gap-2">
                                  <span className="text-brand-dark-soft">Pawsome Extra: {addon.name}</span>
                                  <span className="font-semibold text-brand-dark">PHP {Number(addon.price_min || 0).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment details */}
                  {modeOfPayment && (
                    <div className="border-b border-dashed border-brand-dark-light px-5 py-4">
                      <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">Payment Details</p>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">Payment From</p>
                        <ReceiptRow label="Method" value={
                          modeOfPayment === 'e_wallet' ? 'E-Wallet'
                          : modeOfPayment === 'bank_transfer' ? 'Bank Transfer'
                          : modeOfPayment
                        } />
                        <ReceiptRow label="Provider" value={selectedReservationProvider || '—'} />
                        <ReceiptRow label="Reference" value={referenceNumber || '—'} />
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-b border-dashed border-brand-dark-light px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-extrabold text-brand-dark">{requiredHotelDeposit > 0 ? 'Stay Total' : 'Estimated Total'}</p>
                      <p className="text-base font-extrabold text-brand-dark">
                        PHP {finalEstimatedTotal.toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {requiredHotelDeposit > 0 && (
                      <>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[11px] text-brand-dark-soft">Reservation Deposit (50%)</p>
                          <p className="text-[11px] font-bold text-brand-dark">PHP {requiredHotelDeposit.toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-[11px] text-brand-dark-soft">Remaining Balance</p>
                          <p className="text-[11px] font-bold text-brand-dark">PHP {estimatedCheckInBalance.toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-amber-50 px-5 py-4 flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200">
                      <i className="fa-solid fa-triangle-exclamation text-amber-700 text-[10px]" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-amber-800 mb-0.5">Please Note</p>
                      <p className="text-[10px] leading-relaxed text-amber-700">
                        Final pricing is subject to change based on your pet's physical condition and size upon arrival. Please bring your pet's <span className="font-semibold">vaccination card</span> on the day of the appointment.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Special Instructions */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-brand-dark">
                    Special Instructions <span className="font-normal text-brand-dark-soft">(optional)</span>
                  </label>
                  <textarea
                    value={form.special_instructions}
                    onChange={(e) => setForm((p) => ({ ...p, special_instructions: e.target.value }))}
                    rows={3}
                    placeholder="Allergies, preferences, notes..."
                    className="w-full resize-none rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                </div>
              </div>
            )}
  </>);
}
