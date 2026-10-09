import SelectDropdown from '../../../../../components/reusable-ui/SelectDropdown';
import BookingFormSection from './BookingFormSection';

export default function BookingPaymentSection({
  paymentSectionRef,
  bookingDisplayTotal,
  effectiveHotelDeposit,
  estimatedShopPayment,
  modeOfPayment,
  setModeOfPayment,
  handledById,
  setHandledById,
  bookingStaff,
  requiresElectronicReference,
  reservationProvider,
  setReservationProvider,
  reservationOtherName,
  setReservationOtherName,
  receivingPaymentAccountId,
  setReceivingPaymentAccountId,
  receivingPaymentOptions,
  referenceNumber,
  setReferenceNumber,
  sanitizeReferenceNumber,
  depositProof,
  setDepositProof,
  paymentTypeOptions,
  ewalletOptions,
  bankOptions,
}) {
  return (
    <div ref={paymentSectionRef}>
      <BookingFormSection title="Reservation Payment" subtitle="A 50% deposit is required to confirm the hotel reservation.">
        <div className="mx-auto max-w-xl space-y-5">
          <div className="rounded-lg bg-brand-teal-light/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Payment Summary</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-brand-dark-soft">Estimated Total</p>
                <p className="text-sm font-semibold text-brand-dark">PHP {bookingDisplayTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-brand-dark-soft">Deposit Due Now</p>
                <p className="text-sm font-semibold text-brand-dark">PHP {effectiveHotelDeposit.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-brand-dark-soft">Remaining Balance</p>
                <p className="text-sm font-semibold text-brand-dark">PHP {estimatedShopPayment.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Paid From Method <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={modeOfPayment}
                  onChange={(value) => {
                    setModeOfPayment(value);
                    setReceivingPaymentAccountId('');
                    setReservationProvider('');
                    setReservationOtherName('');
                    if (value === 'cash') setReferenceNumber('');
                  }}
                  options={paymentTypeOptions}
                  placeholder="Select paid-from method"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Handled By <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={handledById}
                  onChange={setHandledById}
                  options={bookingStaff.map((person) => ({
                    value: String(person.id),
                    label: `${person.name || person.email || 'User'} (${String(person.role || 'staff').toLowerCase() === 'admin' ? 'Admin' : (String(person.staff_type || '').toLowerCase() === 'groomer' ? 'Groomer' : 'Staff')})`,
                  }))}
                  placeholder="Select admin or staff"
                  searchable
                />
              </div>
            </div>

            {requiresElectronicReference && (
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">
                  {modeOfPayment === 'e_wallet' ? 'Paid From E-Wallet' : 'Paid From Bank'} <span className="text-red-500">*</span>
                </label>
                <SelectDropdown
                  value={reservationProvider}
                  onChange={(value) => {
                    setReservationProvider(value);
                    if (value !== 'Other') setReservationOtherName('');
                  }}
                  options={modeOfPayment === 'e_wallet' ? ewalletOptions : bankOptions}
                  placeholder={`Select paid-from ${modeOfPayment === 'e_wallet' ? 'e-wallet' : 'bank'}`}
                />
                {reservationProvider === 'Other' && (
                  <input
                    type="text"
                    value={reservationOtherName}
                    onChange={(event) => setReservationOtherName(event.target.value.slice(0, 60))}
                    placeholder={modeOfPayment === 'e_wallet' ? 'Please specify e-wallet name' : 'Please specify bank name'}
                    maxLength="60"
                    className="mt-2 w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                )}
              </div>
            )}

            {requiresElectronicReference && (
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Payment To <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={receivingPaymentAccountId}
                  onChange={setReceivingPaymentAccountId}
                  options={[{ value: '', label: receivingPaymentOptions.length ? 'Select receiving account' : 'No configured payment accounts' }, ...receivingPaymentOptions]}
                  placeholder="Select receiving account"
                />
              </div>
            )}

            {requiresElectronicReference && (
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Transaction Reference Number <span className="normal-case font-normal">(or upload proof)</span></label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(sanitizeReferenceNumber(e.target.value))}
                  placeholder="Enter reference number"
                  maxLength="30"
                  className="w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>
            )}

            {requiresElectronicReference && (
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Proof of Payment <span className="normal-case font-normal">(or enter reference)</span></label>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setDepositProof(event.target.files?.[0] || null)} className="block w-full rounded-lg border border-brand-dark-light bg-white px-3 py-2 text-xs text-brand-dark file:mr-3 file:rounded-md file:border-0 file:bg-brand-teal-light file:px-3 file:py-1.5 file:font-bold file:text-brand-teal" />
                {depositProof && <p className="mt-1 truncate text-[10px] font-semibold text-brand-teal">Selected: {depositProof.name}</p>}
              </div>
            )}

            <p className="text-justify text-[10px] italic leading-relaxed text-amber-600">Estimated pricing is subject to change based on the pet&apos;s confirmed size and care requirements.</p>
          </div>
        </div>
      </BookingFormSection>
    </div>
  );
}
