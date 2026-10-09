import { X } from 'lucide-react';
import { formatSizeLabel } from '../../../../../utils/recordFormatters';
import { normalizeBreedName } from '../../../../../utils/textUtils';
import { formatCategoryLabel, isHotelEntry } from '../bookingHelpers';

export default function BookingSummarySidebar({
  onClose,
  onEditOwner,
  getOwnerName,
  selectedOwner,
  selectedPet,
  additionalPetIds,
  ownerPets,
  entries,
  hotelSuites,
  bookingDisplayTotal,
  requiredHotelDeposit,
  effectiveHotelDeposit,
  estimatedShopPayment,
  suppliesEnabled,
  retailSales,
  openRetailPurchaseModal,
  canUseRetailPurchase,
}) {
  return (
    <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-brand-dark-light/70 lg:absolute lg:left-[calc(100%+1rem)] lg:top-0 lg:flex lg:h-full lg:w-80">
      <div className="flex items-center justify-between gap-3 border-b border-brand-dark-light px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Booking Summary</p>
        <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-dark-light text-brand-dark-soft transition hover:bg-brand-surface hover:text-brand-dark" aria-label="Close book appointment modal">
          <X size={15} strokeWidth={2.8} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {selectedOwner && (
          <div className="mb-3 rounded-xl border border-brand-dark-light bg-brand-surface/50 px-3 py-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">Customer</p>
              <button type="button" onClick={onEditOwner} className="text-[10px] font-bold text-brand-teal transition hover:underline">Edit</button>
            </div>
            <p className="text-xs font-bold text-brand-dark">{getOwnerName(selectedOwner)}</p>
            {selectedOwner.email && <p className="mt-0.5 truncate text-[10px] text-brand-dark-soft">{selectedOwner.email}</p>}
          </div>
        )}

        {selectedPet && (
          <div className="mb-3 rounded-xl border border-brand-dark-light bg-white px-3 py-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">Pet</p>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-brand-dark-light bg-brand-teal-light">
                {selectedPet.photo_url
                  ? <img src={selectedPet.photo_url} alt={selectedPet.name} className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center"><span className="text-xs font-bold text-brand-teal">{String(selectedPet.name || '?').slice(0, 2).toUpperCase()}</span></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-brand-dark">{selectedPet.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-brand-dark-soft">
                  {selectedPet.species_type?.name || selectedPet.species || ''}
                  {selectedPet.breed?.name ? ` · ${normalizeBreedName(selectedPet.breed.name, selectedPet)}` : ''}
                </p>
              </div>
            </div>
            {additionalPetIds.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-brand-dark-soft">Additional Daycare Pets</p>
                <p className="text-[10px] font-semibold text-brand-dark">
                  {ownerPets.filter((pet) => additionalPetIds.map(String).includes(String(pet.id))).map((pet) => pet.name).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {entries.some((entry) => entry.category) && (
          <div className="rounded-xl border border-brand-dark-light bg-white px-3 py-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-brand-dark-soft">{entries.filter((entry) => entry.category).length > 1 ? 'Services' : 'Service'}</p>
            {entries.map((entry, index) => entry.category && (
              <div key={entry.key} className="border-b border-brand-dark-light/60 py-2 first:pt-0 last:border-0 last:pb-0">
                <p className="text-xs font-bold text-brand-dark">
                  {entry.category === 'hotel' ? hotelSuites.find((suite) => suite.id === entry.hotel_suite_id)?.name || 'Hotel Suite' : entry.selectedService?.name || '-'}
                </p>
                <p className="mt-0.5 text-[10px] text-brand-dark-soft">
                  {entries.filter((item) => item.category).length > 1 ? `${index + 1}. ` : ''}{formatCategoryLabel(entry.category || entry.selectedService?.category)}
                  {entry.size_label ? ` · ${formatSizeLabel(entry.size_label)}` : ''}
                  {isHotelEntry(entry) && entry.pet_size ? ` · Pet Size: ${formatSizeLabel(entry.pet_size)}` : ''}
                </p>
                {String(entry.category || '').toLowerCase() === 'grooming' && entry.addon_ids.length > 0 && (
                  <p className="mt-0.5 text-[10px] text-brand-dark-soft">+{entry.addon_ids.length} add-on{entry.addon_ids.length > 1 ? 's' : ''}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {bookingDisplayTotal > 0 && (
          <div className="mt-3 rounded-xl border border-brand-teal/30 bg-brand-teal-light px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-brand-dark">Estimated Total</p>
              <p className="text-sm font-extrabold text-brand-teal-dark">PHP {bookingDisplayTotal.toFixed(2)}</p>
            </div>
            {requiredHotelDeposit > 0 && (
              <div className="mt-2 space-y-1 border-t border-brand-teal/20 pt-2">
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] text-brand-dark-soft">Deposit (50%)</p><p className="text-[10px] font-bold text-brand-dark">PHP {effectiveHotelDeposit.toFixed(2)}</p></div>
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] text-brand-dark-soft">Balance at check-in</p><p className="text-[10px] font-bold text-brand-dark">PHP {estimatedShopPayment.toFixed(2)}</p></div>
              </div>
            )}
            <p className="mt-2 border-t border-brand-teal/20 pt-2 text-[9px] leading-relaxed text-amber-700">The estimated price is subject to change based on the pet&apos;s confirmed size, specific care requirements, and services provided.</p>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-brand-dark-light bg-white px-4 py-4">
        {suppliesEnabled && (
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Retail Purchases</p>
              <span className="text-[10px] font-semibold text-brand-dark-soft">Optional</span>
            </div>
            {retailSales.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {retailSales.map((sale) => (
                  <div key={sale.id || sale.receipt_number} className="flex items-center justify-between gap-2 rounded-lg bg-brand-teal/5 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-brand-dark">{sale.receipt_number || 'Retail purchase'}</p>
                      <p className="text-[11px] font-bold text-brand-teal-dark">PHP {Number(sale.total_amount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-1 text-[11px] text-brand-dark-soft">No retail items added.</p>}
            <button type="button" onClick={openRetailPurchaseModal} aria-disabled={!canUseRetailPurchase} title={!canUseRetailPurchase ? 'Select an owner and pet first' : undefined} className={`mt-2 w-full rounded-xl border border-brand-teal bg-brand-teal px-5 py-2.5 text-xs font-bold text-white transition hover:border-brand-teal hover:bg-brand-teal active:border-brand-teal active:bg-brand-teal ${!canUseRetailPurchase ? 'cursor-not-allowed opacity-55' : ''}`}>
              {retailSales.length > 0 ? 'Edit Retail Purchase' : 'Add Retail Purchase'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
