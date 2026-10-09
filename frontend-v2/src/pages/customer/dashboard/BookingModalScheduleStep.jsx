import '../../../utils/dateUtils';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import { fetchPaymentAccounts } from '../../../utils/paymentAccounts';
import BookingDatePicker from './BookingDatePicker';
import './bookingUtils';
import { MAX_BOOKING_DATE, MAX_BOOKING_MONTH_INDEX } from './bookingModalUtils';

export default function BookingModalScheduleStep({ step, bookingItems, slotStateByIndex, hotelSuites, getServiceName, hotelMonth, setHotelMonth, MAX_BOOKING_MONTH_INDEX, hotelCalendarLoading, hotelCalendarSlow, hotelCalendarHasLoaded, hotelCalendarAvailabilityVerified, hotelCalendarError, setHotelCalendarRetryKey, hotelClosedDates, hotelUnavailableDates, hotelCapacityByDate, setItem, setError, diffDays, rangeHasBlockedNights, TODAY, toIso, formatHotelDateTime, SelectDropdown, fmtTime, hasHotel, finalEstimatedTotal, requiredHotelDeposit, estimatedCheckInBalance, modeOfPayment, setModeOfPayment, paymentFromProvider, setPaymentFromProvider, paymentFromOtherName, setPaymentFromOtherName, setBankName, setPaymentAccountId, setPaymentToAccount, setPaymentOtherName, PAYMENT_TYPE_OPTIONS, EWALLET_OPTIONS, BANK_OPTIONS, bankName, reservationOtherName, sanitizeText, referenceNumber, setReferenceNumber, depositProof, setDepositProof, sanitizeReferenceNumber }) {
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentDetailsAccount, setPaymentDetailsAccount] = useState(null);
  const [hotelDateTarget, setHotelDateTarget] = useState('check-in');
  useEffect(() => {
    let active = true;
    fetchPaymentAccounts().then((accounts) => {
      if (active) setPaymentAccounts(accounts);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const configuredOptions = useMemo(() => paymentAccounts.map((account) => ({ value: account.id, label: account.label })), [paymentAccounts]);
  const paidToOptions = [
    { value: '', label: configuredOptions.length ? 'Select receiving account' : 'No configured payment accounts' },
    ...configuredOptions,
  ];
  return (
    <>
            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="space-y-4">
                  {bookingItems.map((item, idx) => {
                    const slotState = slotStateByIndex[idx] || { slots: [], loading: false, fullyBooked: false, shopClosed: false };
                    const rowSlots = slotState.slots || [];
                    const rowSlotsLoading = !!slotState.loading;
                    const rowFullyBooked = !!slotState.fullyBooked;
                    const rowShopClosed = !!slotState.shopClosed;
                    return (
                    <div key={idx} className="space-y-3 rounded-lg bg-brand-surface/60 p-4">
                      {bookingItems.length > 1 && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-5 h-5 rounded-full bg-brand-teal flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                          </div>
                          <p className="text-xs font-semibold text-brand-dark">
                            {item.category === 'hotel'
                              ? hotelSuites.find((s) => s.id === item.hotel_suite_id)?.name || getServiceName(item.service)
                              : getServiceName(item.service)}
                          </p>
                          {item.size_label && <span className="text-[10px] text-brand-dark-soft">• {item.size_label}</span>}
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-brand-dark-soft mb-2 block">
                          {item.category === 'hotel' ? 'Check-in & Check-out' : 'Appointment Date'}
                        </label>

                        {item.category === 'hotel' ? (
                          <div className="rounded-lg bg-white p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="w-12" aria-hidden="true" />
                              <p className="text-xs font-semibold text-brand-dark">{hotelMonth.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', year: 'numeric' })}</p>
                              <button
                                type="button"
                                disabled={(hotelMonth.getFullYear() * 12) + hotelMonth.getMonth() >= MAX_BOOKING_MONTH_INDEX}
                                onClick={() => setHotelMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                                className="w-12 rounded-lg border border-brand-dark-light px-2 py-1 text-xs text-brand-dark hover:border-brand-teal/50 disabled:cursor-not-allowed disabled:opacity-30"
                              >Next</button>
                            </div>

                            <div className="mb-3 grid grid-cols-2 gap-2" aria-label="Choose hotel date to change">
                              {[
                                { value: 'check-in', label: 'Check-in', date: item.appointment_date },
                                { value: 'check-out', label: 'Check-out', date: item.hotel_checkout },
                              ].map(({ value, label, date }) => {
                                const selectedTarget = item.appointment_date ? hotelDateTarget : 'check-in';
                                const disabled = value === 'check-out' && !item.appointment_date;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    disabled={disabled}
                                    aria-pressed={selectedTarget === value}
                                    onClick={() => setHotelDateTarget(value)}
                                    className={`min-w-0 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                                      selectedTarget === value ? 'border-brand-teal bg-brand-teal-light/50' : 'border-brand-dark-light bg-white'
                                    }`}
                                  >
                                    <span className="block font-semibold text-brand-dark">{label}</span>
                                    <span className="block truncate text-brand-dark-soft">{date || 'Select date'}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {!hotelCalendarHasLoaded && !hotelCalendarAvailabilityVerified && !hotelCalendarError ? (
                              <div className="animate-pulse" aria-label="Loading availability">
                                <div className="mb-2 grid grid-cols-7 gap-1">
                                  {Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-2.5 rounded bg-brand-dark-light/60" />)}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                  {Array.from({ length: 35 }).map((_, index) => <div key={index} className="h-8 rounded bg-brand-dark-light/45" />)}
                                </div>
                                <p className="mt-2 text-xs text-brand-dark-soft">Checking available Hotel Suites…</p>
                                {hotelCalendarSlow && (
                                  <p className="mt-1 text-xs text-amber-700" role="status">
                                    This is taking longer than expected. We&apos;re still checking availability.
                                  </p>
                                )}
                              </div>
                            ) : hotelCalendarError && !hotelCalendarHasLoaded ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center" role="alert">
                                <p className="text-xs text-amber-900">Unable to load Hotel Suites. Please try again.</p>
                                <button
                                  type="button"
                                  onClick={() => setHotelCalendarRetryKey((value) => value + 1)}
                                  className="mt-2 rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
                                >
                                  Retry
                                </button>
                              </div>
                            ) : (
                              <>
                                {(hotelCalendarLoading || hotelCalendarError || !hotelCalendarAvailabilityVerified) && (
                                  <div className={`mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
                                    hotelCalendarError ? 'bg-amber-50 text-amber-900' : 'bg-brand-teal-light/40 text-brand-dark-soft'
                                  }`} role={hotelCalendarError ? 'alert' : 'status'}>
                                    <span>
                                      {hotelCalendarError ? 'Unable to refresh availability.' : 'Updating availability…'}
                                    </span>
                                    {hotelCalendarError && (
                                      <button
                                        type="button"
                                        onClick={() => setHotelCalendarRetryKey((value) => value + 1)}
                                        className="font-semibold text-brand-teal underline"
                                      >
                                        Retry
                                      </button>
                                    )}
                                  </div>
                                )}
                                {hotelCalendarSlow && hotelCalendarLoading && (
                                  <p className="mb-2 text-xs text-amber-700" role="status">
                                    This is taking longer than expected. We&apos;re still checking availability.
                                  </p>
                                )}
                                <div className="grid grid-cols-7 gap-1 text-[10px] text-brand-dark-soft mb-1">
                                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                    <div key={d} className="text-center font-semibold">{d}</div>
                                  ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                  {Array.from({ length: new Date(hotelMonth.getFullYear(), hotelMonth.getMonth(), 1).getDay() }).map((_, i) => (
                                    <div key={`blank-${i}`} className="h-8" />
                                  ))}
                                  {Array.from({ length: new Date(hotelMonth.getFullYear(), hotelMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                    const day      = i + 1;
                                    const dateStr  = toIso(new Date(hotelMonth.getFullYear(), hotelMonth.getMonth(), day));
                                    const availabilityIsStale = hotelCalendarLoading
                                      || !!hotelCalendarError
                                      || !hotelCalendarAvailabilityVerified;
                                    const isPast   = dateStr < TODAY;
                                    const isClosed = !availabilityIsStale && hotelClosedDates.has(dateStr);
                                    const isBlocked= !availabilityIsStale && hotelUnavailableDates.has(dateStr);
                                    const capacity = hotelCapacityByDate?.[dateStr];
                                    const isFull = !availabilityIsStale && isBlocked && Number(capacity?.available) <= 0;
                                    const isUnavailable = !availabilityIsStale && isBlocked && !isFull;
                                    const isCheckIn  = item.appointment_date === dateStr;
                                    const isCheckOut = item.hotel_checkout === dateStr;
                                    const isSelected = isCheckIn || isCheckOut;
                                    const inRange    = !!(item.appointment_date && item.hotel_checkout && dateStr > item.appointment_date && dateStr < item.hotel_checkout);
                                    const selectable = !hotelCalendarLoading && !hotelCalendarError
                                      && hotelCalendarAvailabilityVerified
                                      && dateStr >= TODAY && dateStr <= MAX_BOOKING_DATE && !isClosed && !isBlocked;
                                    return (
                                      <button key={dateStr} type="button" disabled={!selectable}
                                        onClick={() => {
                                          const selectedTarget = item.appointment_date ? hotelDateTarget : 'check-in';
                                          if (selectedTarget === 'check-in') {
                                            const nights = item.hotel_checkout ? diffDays(dateStr, item.hotel_checkout) : 0;
                                            const checkoutRemainsValid = nights >= 1
                                              && nights <= 5
                                              && !rangeHasBlockedNights(dateStr, item.hotel_checkout, hotelUnavailableDates, hotelClosedDates);
                                            setItem(idx, {
                                              appointment_date: dateStr,
                                              hotel_checkout: checkoutRemainsValid ? item.hotel_checkout : '',
                                              hotel_nights: checkoutRemainsValid ? String(nights) : '',
                                              start_time: dateStr === item.appointment_date ? item.start_time : '',
                                            });
                                            setHotelDateTarget('check-out');
                                            setError('');
                                            return;
                                          }
                                          if (!item.appointment_date) {
                                            setHotelDateTarget('check-in');
                                            setError('Select a check-in date first.');
                                            return;
                                          }
                                          const checkIn = item.appointment_date;
                                          const checkOut = dateStr;
                                          const nights = diffDays(checkIn, checkOut);
                                          if (nights < 1 || nights > 5) {
                                            setError('Check-out must be after check-in and within 5 nights.');
                                            return;
                                          }
                                          if (rangeHasBlockedNights(checkIn, checkOut, hotelUnavailableDates, hotelClosedDates)) {
                                            setError('Selected stay includes a closed or unavailable date.'); return;
                                          }
                                          setItem(idx, { appointment_date: checkIn, hotel_checkout: checkOut, hotel_nights: String(nights) });
                                          setError('');
                                        }}
                                        className={`h-8 rounded-md text-xs font-semibold transition-colors ${
                                          isSelected  ? 'bg-brand-teal text-white'
                                          : inRange   ? 'bg-brand-teal-light text-brand-dark'
                                          : availabilityIsStale ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                          : isPast    ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                          : isClosed  ? 'border border-red-300 bg-white text-red-600 cursor-not-allowed'
                                          : isFull ? 'bg-red-100 text-red-600 cursor-not-allowed'
                                          : isUnavailable ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                          : 'bg-brand-teal-light text-brand-dark hover:bg-brand-teal/20'
                                        }`}
                                        title={availabilityIsStale ? 'Availability is being checked' : isClosed ? 'Shop is closed' : isFull ? 'Full' : isUnavailable ? 'Unavailable' : capacity ? `${capacity.available} of ${capacity.capacity} shared cluster units available` : undefined}>
                                        {day}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="mt-3 flex items-center gap-4 text-[11px]">
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded border border-red-300 bg-white" />Closed</div>
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-red-100" />Full</div>
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-gray-100" />Unavailable</div>
                                  <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-brand-teal-light" />Available</div>
                                </div>
                              </>
                            )}

                            {item.appointment_date && !item.hotel_checkout && (
                              <div className="mt-2 rounded-lg bg-brand-teal-light/25 px-3 py-2 text-xs text-brand-dark-soft">
                                <p>
                                  Check-in: <span className="font-semibold text-brand-dark">{item.appointment_date}</span>. Now pick a check-out date (max 5 nights).
                                </p>
                                <p className="mt-1">
                                  <span className="font-semibold text-brand-dark">Extension Policy:</span> Hotel bookings are charged per night. If the actual check-out exceeds the scheduled check-out time, an additional hourly fee will apply based on your pet&apos;s size and the corresponding Daycare hourly rate. Any extra time is rounded up to the next full hour. During extended hours, pets may be transferred to an available suite depending on room availability and operations.
                                </p>
                              </div>
                            )}
                            {item.appointment_date && item.hotel_checkout && (
                              <div className="mt-2 rounded-lg bg-brand-teal-light/25 px-3 py-2 text-xs text-brand-dark space-y-0.5">
                                <p>Check-in: <span className="font-semibold">{formatHotelDateTime(item.appointment_date, item.start_time)}</span></p>
                                <p>Check-out: <span className="font-semibold">{formatHotelDateTime(item.hotel_checkout, item.start_time)}</span></p>
                                <p>Nights: <span className="font-semibold">{item.hotel_nights}</span></p>
                                <p className="pt-1 text-brand-dark-soft leading-relaxed">
                                  <span className="font-semibold text-brand-dark">Extension Policy:</span> Hotel bookings are charged per night. If the actual check-out exceeds the scheduled check-out time, an additional hourly fee will apply based on your pet&apos;s size and the corresponding Daycare hourly rate. Any extra time is rounded up to the next full hour. During extended hours, pets may be transferred to an available suite depending on room availability and operations.
                                </p>
                              </div>
                            )}
                            {item.appointment_date && item.hotel_checkout && (
                              <div className="mt-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-brand-dark-soft mb-2 block">Hotel Check-in Time</label>
                                {rowSlotsLoading && rowSlots.length === 0 ? (
                                  <p className="rounded-lg bg-white px-3 py-2 text-xs text-brand-dark-soft">Checking available check-in times…</p>
                                ) : rowSlots.length === 0 ? (
                                  <p className="rounded-lg bg-white px-3 py-2 text-xs text-brand-dark-soft">No Hotel Suite check-in times are available for this date.</p>
                                ) : (
                                  <SelectDropdown
                                    value={item.start_time || ''}
                                    onChange={(v) => { setItem(idx, { start_time: v }); }}
                                    options={[{ value: '', label: 'Select check-in time' }, ...rowSlots.map((slot) => ({ value: slot, label: fmtTime(slot) }))]}
                                    placeholder="Select check-in time"
                                    disabled={rowSlotsLoading}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <BookingDatePicker
                            value={item.appointment_date}
                            minDate={TODAY}
                            maxDate={MAX_BOOKING_DATE}
                            fullyBooked={rowFullyBooked}
                            onChange={(date) => setItem(idx, { appointment_date: date, start_time: '' })}
                          />
                        )}
                      </div>

                      {item.appointment_date && item.category !== 'hotel' && (
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-brand-dark-soft mb-2 block">Available Time Slots</label>
                          {rowSlotsLoading ? (
                            <div className="animate-pulse rounded-lg border border-brand-dark-light px-3 py-3" aria-label="Checking availability">
                              <div className="h-3 w-32 rounded bg-brand-dark-light/70" />
                            </div>
                          ) : rowSlots.length === 0 ? (
                            <p className="text-xs text-brand-dark-soft bg-white rounded-lg px-3 py-2">
                              {rowShopClosed ? 'The shop is closed for this day.' : rowFullyBooked ? 'That date is fully booked for now. Please pick another date for your pet.' : 'No available slots for this date.'}
                            </p>
                          ) : (
                            <>
                              {rowFullyBooked && (
                                <div className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-500 font-semibold">
                                  That date is fully booked for now. Please pick another date for your pet.
                                </div>
                              )}
                              <SelectDropdown
                                value={item.start_time}
                                onChange={(v) => { setItem(idx, { start_time: v }); }}
                                options={[{ value: '', label: 'Select time slot' }, ...rowSlots.map((slot) => ({ value: slot, label: fmtTime(slot) }))]}
                                placeholder="Select time slot"
                              />
                            </>
                          )}
                        </div>
                      )}

                    </div>
                    );
                  })}
              </div>
            )}

            {/* Step 3: Reservation (hotel only) */}
            {step === 3 && hasHotel && (
              <div className="space-y-5">
                <div className="rounded-lg bg-brand-teal-light/40 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Hotel Reservation Deposit</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] text-brand-dark-soft">Estimated Total</p>
                      <p className="text-sm font-semibold text-brand-dark">
                        PHP {finalEstimatedTotal.toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-brand-dark-soft">Reservation Deposit (50%)</p>
                      <p className="text-sm font-semibold text-brand-dark">
                        PHP {requiredHotelDeposit.toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-brand-dark-soft">Pay at Shop</p>
                      <p className="text-sm font-semibold text-brand-dark">
                        PHP {estimatedCheckInBalance.toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-brand-dark-soft">
                    The displayed total is an estimate and may change after confirming your pet&apos;s actual size, selected preferences, and any additional services provided.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-brand-dark">
                    Payment Type <span className="text-red-500">*</span>
                  </label>
                  <SelectDropdown
                    value={modeOfPayment}
                    onChange={(v) => {
                      setModeOfPayment(v);
                      setPaymentFromProvider('');
                      setPaymentFromOtherName('');
                      setBankName('');
                      setPaymentOtherName('');
                    }}
                    options={PAYMENT_TYPE_OPTIONS}
                    placeholder="Select payment type"
                  />
                </div>

                {modeOfPayment && (
                  <>
                    {(modeOfPayment === 'e_wallet' || modeOfPayment === 'bank_transfer') && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-dark">
                          {modeOfPayment === 'e_wallet' ? 'Payment From E-Wallet' : 'Payment From Bank'} <span className="text-red-500">*</span>
                        </label>
                        <SelectDropdown
                          value={paymentFromProvider}
                          onChange={(value) => {
                            setPaymentFromProvider(value);
                            if (value !== 'Other') setPaymentFromOtherName('');
                          }}
                          options={modeOfPayment === 'e_wallet' ? EWALLET_OPTIONS : BANK_OPTIONS}
                          placeholder={`Select ${modeOfPayment === 'e_wallet' ? 'e-wallet' : 'bank'}`}
                        />
                        {paymentFromProvider === 'Other' && (
                          <input
                            type="text"
                            value={paymentFromOtherName}
                            onChange={(event) => setPaymentFromOtherName(sanitizeText(event.target.value).slice(0, 60))}
                            placeholder={`Please specify ${modeOfPayment === 'e_wallet' ? 'e-wallet' : 'bank'} name`}
                            maxLength="60"
                            className="mt-2 w-full rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                          />
                        )}
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-dark">
                        Paid To <span className="text-red-500">*</span>
                      </label>
                      <SelectDropdown
                        value={bankName}
                        onChange={(v) => {
                          const account = paymentAccounts.find((item) => String(item.id) === String(v));
                          setBankName(v);
                          if (v !== 'Other') setPaymentOtherName('');
                          setPaymentAccountId(account?.id || '');
                          setPaymentToAccount(account || null);
                          setPaymentDetailsAccount(account || null);
                        }}
                        options={paidToOptions}
                        placeholder="Select where the payment was sent"
                      />
                    </div>
                    {bankName === 'Other' && (
                      <div>
                        <input
                          type="text"
                          value={reservationOtherName}
                          onChange={(e) => setPaymentOtherName(sanitizeText(e.target.value).slice(0, 60))}
                          placeholder={modeOfPayment === 'e_wallet' ? 'Please specify e-wallet name' : 'Please specify bank name'}
                          maxLength="60"
                          className="w-full rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-dark">
                        Reservation Reference Number <span className="font-normal text-brand-dark-soft">(or upload proof below)</span>
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(sanitizeReferenceNumber(e.target.value))}
                        placeholder="Reservation reference"
                        maxLength="30"
                        className="w-full rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-dark">Proof of Payment <span className="font-normal text-brand-dark-soft">(or enter reference above)</span></label>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setDepositProof(e.target.files?.[0] || null)} className="block w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-xs text-brand-dark file:mr-3 file:rounded-lg file:border-0 file:bg-brand-teal-light file:px-3 file:py-1.5 file:font-bold file:text-brand-teal" />
                      {depositProof && <p className="mt-1 truncate text-[10px] font-semibold text-brand-teal">Selected: {depositProof.name}</p>}
                    </div>
                  </>
                )}

              </div>
            )}
      {paymentDetailsAccount && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[360] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/50 p-4 backdrop-blur-sm" onClick={() => setPaymentDetailsAccount(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between bg-brand-teal px-5 py-4 text-white">
              <h3 className="text-sm font-extrabold">Payment Destination</h3>
              <button type="button" onClick={() => setPaymentDetailsAccount(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg hover:bg-white/25" aria-label="Close payment destination">×</button>
            </div>
            <div className="space-y-3 p-5 text-center">
              <p className="text-sm font-bold text-brand-dark">{paymentDetailsAccount.label}</p>
              {paymentDetailsAccount.qr_code && <img src={paymentDetailsAccount.qr_code} alt={`${paymentDetailsAccount.label} payment QR code`} className="mx-auto h-56 w-56 max-w-full rounded-xl border border-brand-dark-light bg-white object-contain p-2" />}
              <div className="rounded-xl bg-brand-surface p-3 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Account name</p>
                <p className="text-sm font-semibold text-brand-dark">{paymentDetailsAccount.account_name || 'Not configured'}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Account number</p>
                <p className="text-sm font-semibold text-brand-dark">{paymentDetailsAccount.account_number || 'Not configured'}</p>
              </div>
              <button type="button" onClick={() => setPaymentDetailsAccount(null)} className="w-full rounded-full bg-brand-teal px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark">Continue</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
