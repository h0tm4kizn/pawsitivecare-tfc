import Loading from '../../../../../components/Loading';
import { SkeletonBlock } from '../../../../../components/admin/AdminLoading';
import { toIso, diffDays } from '../../../../../utils/dateUtils';
import { rangeHasBlockedNights } from '../../../../customer/dashboard/bookingUtils';
import { fmt12 } from '../bookingUtils';
import SelectDropdown from '../../../../../components/reusable-ui/SelectDropdown';
import BookingDatePicker from './BookingDatePicker';
import HotelCheckInTimePicker from '../../components/HotelCheckInTimePicker';

const isHotelEntry = (entry) =>
  String(entry?.category || entry?.selectedService?.category || '').toLowerCase() === 'hotel';

const formatHotelDateTime = (date, time) => {
  if (!date) return '-';
  const d = new Date(`${String(date).slice(0, 10)}T${String(time || '09:00:00')}`);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function DateTimeStep({
  entries,
  activeItemIndex,
  setActiveItemIndex,
  hotelMonth,
  setHotelMonth,
  hotelCalendarLoading,
  hotelClosedDates,
  hotelUnavailableDates,
  hotelCapacityByDate,
  patchEntry,
  handleDateChange,
  setFormError,
  TODAY,
  lockAppointmentDate = false,
  walkInMode = false,
}) {
  const currentMonthStart = new Date(`${TODAY}T00:00:00`);
  currentMonthStart.setDate(1);
  const nextMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1);
  const [todayYear, todayMonth, todayDay] = TODAY.split('-').map(Number);
  const lastDayOfNextMonth = new Date(todayYear, todayMonth + 1, 0).getDate();
  const maxBookingDate = new Date(todayYear, todayMonth, Math.min(todayDay, lastDayOfNextMonth));
  const maxBookingDateIso = toIso(maxBookingDate);
  const canViewNextMonth = hotelMonth < nextMonthStart;

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        const isHotel = isHotelEntry(entry);
        return (
          <div key={entry.key} className="space-y-3 rounded-lg bg-brand-surface/60 p-3 sm:p-4">
            {isHotel ? (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-brand-dark-soft">Check-in & Check-out</label>
                <div className="rounded-lg bg-white p-2.5 sm:p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="w-12" aria-hidden="true" />
                      <p className="min-w-0 truncate text-xs font-semibold text-brand-dark">{hotelMonth.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', year: 'numeric' })}</p>
                    <button
                      type="button"
                      disabled={!canViewNextMonth}
                      onClick={() => {
                        if (!canViewNextMonth) return;
                        setActiveItemIndex(index);
                        setHotelMonth(nextMonthStart);
                      }}
                      className="w-12 rounded-lg border border-brand-dark-light px-2 py-1 text-xs text-brand-dark hover:border-brand-teal/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >Next</button>
                  </div>

                  {index === activeItemIndex && hotelCalendarLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <Loading message="Loading availability..." textClassName="text-brand-dark-soft" />
                    </div>
                  ) : (
                    <>
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
                          const day = i + 1;
                          const dateStr = toIso(new Date(hotelMonth.getFullYear(), hotelMonth.getMonth(), day));
                          const isPast = dateStr < TODAY;
                          const isClosed = hotelClosedDates.has(dateStr);
                          const isBlocked = hotelUnavailableDates.has(dateStr);
                          const capacity = hotelCapacityByDate?.[dateStr];
                          const isFull = isBlocked && Number(capacity?.available) <= 0;
                          const isUnavailable = isBlocked && !isFull;
                          const isCheckIn = entry.appointment_date === dateStr;
                          const isCheckOut = entry.hotel_checkout === dateStr;
                          const isSelected = isCheckIn || isCheckOut;
                          const inRange = !!(entry.appointment_date && entry.hotel_checkout && dateStr > entry.appointment_date && dateStr < entry.hotel_checkout);
                          const isBeyondBookingWindow = dateStr > maxBookingDateIso;
                          const selectable = dateStr >= TODAY && !isBeyondBookingWindow && !isClosed && !isBlocked;
                          return (
                            <button key={dateStr} type="button" disabled={!selectable}
                              onClick={() => {
                                if (!selectable) return;
                                setActiveItemIndex(index);
                                if (!entry.appointment_date || entry.hotel_checkout) {
                                  patchEntry(entry.key, { appointment_date: dateStr, hotel_nights: '', hotel_checkout: '', start_time: '', hotel_checkin_input: null });
                                  setFormError(''); return;
                                }
                                const checkIn = dateStr < entry.appointment_date ? dateStr : entry.appointment_date;
                                const checkOut = dateStr < entry.appointment_date ? entry.appointment_date : dateStr;
                                const nights = diffDays(checkIn, checkOut);
                                if (nights < 1 || nights > 5) {
                                  patchEntry(entry.key, { appointment_date: dateStr, hotel_nights: '', hotel_checkout: '', start_time: '', hotel_checkin_input: null });
                                  setFormError(''); return;
                                }
                                if (rangeHasBlockedNights(checkIn, checkOut, hotelUnavailableDates, hotelClosedDates)) {
                                  setFormError('Selected stay includes a closed or unavailable date.'); return;
                                }
                                patchEntry(entry.key, { appointment_date: checkIn, hotel_checkout: checkOut, hotel_nights: String(nights) });
                                setFormError('');
                              }}
                              className={`h-9 rounded-md text-xs font-semibold transition-colors sm:h-8 ${
                                isSelected  ? 'bg-brand-teal text-white'
                                : inRange   ? 'bg-brand-teal-light text-brand-dark'
                                : isPast || isBeyondBookingWindow ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                : isClosed  ? 'border border-red-300 bg-white text-red-600 cursor-not-allowed'
                                : isFull ? 'bg-red-100 text-red-600 cursor-not-allowed'
                                : isUnavailable ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'bg-brand-teal-light text-brand-dark hover:bg-brand-teal/20'
                              }`}
                              title={isClosed ? 'Shop is closed' : isFull ? 'Full' : isUnavailable ? 'Unavailable' : capacity ? `${capacity.available} of ${capacity.capacity} shared cluster units available` : undefined}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded border border-red-300 bg-white" />Closed</div>
                        <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-red-100" />Full</div>
                        <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-gray-100" />Unavailable</div>
                        <div className="flex items-center gap-1.5 text-brand-dark-soft"><span className="inline-block h-3 w-3 rounded bg-brand-teal-light" />Available</div>
                      </div>
                    </>
                  )}

                  {entry.appointment_date && !entry.hotel_checkout && (
                    <p className="mt-2 text-xs text-brand-dark-soft">
                      Check-in: <span className="font-semibold text-brand-dark">{entry.appointment_date}</span>. Now pick a check-out date (max 5 nights).
                    </p>
                  )}
                  {entry.appointment_date && entry.hotel_checkout && (
                    <div className="mt-2 rounded-lg bg-brand-teal-light/25 px-3 py-2 text-xs text-brand-dark space-y-0.5">
                      <p>Check-in: <span className="font-semibold">{formatHotelDateTime(entry.appointment_date, entry.start_time)}</span></p>
                      <p>Check-out: <span className="font-semibold">{formatHotelDateTime(entry.hotel_checkout, entry.start_time)}</span></p>
                      <p>Nights: <span className="font-semibold">{entry.hotel_nights}</span></p>
                    </div>
                  )}
                  {entry.appointment_date && entry.hotel_checkout && (
                    <div className="mt-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-dark-soft">Hotel Check-in Time</label>
                      {entry.loadingSlots && !(entry.availableSlots || []).length ? (
                        <p className="rounded-lg bg-white px-3 py-2 text-xs text-brand-dark-soft">Checking available check-in times…</p>
                      ) : (entry.availableSlots || []).length === 0 ? (
                        <p className="rounded-lg bg-white px-3 py-2 text-xs text-brand-dark-soft">No Hotel Suite check-in times are available for this date.</p>
                      ) : (
                        <HotelCheckInTimePicker
                          value={entry.start_time || ''}
                          draft={entry.hotel_checkin_input}
                          date={entry.appointment_date}
                          operatingHours={entry.hotelOperatingHours}
                          onDraftChange={(draft) => patchEntry(entry.key, { hotel_checkin_input: draft })}
                          onChange={(value) => patchEntry(entry.key, { start_time: value })}
                          disabled={entry.loadingSlots}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-dark-soft">Appointment Date</label>
                  <BookingDatePicker value={entry.appointment_date} minDate={TODAY} fullyBooked={entry.fullyBooked} locked={lockAppointmentDate} onChange={(date) => handleDateChange(entry.key, date)} />
                </div>
                {entry.appointment_date && (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-dark-soft">Available Time Slots</label>
                    {entry.loadingSlots && !(entry.availableSlots || []).length ? (
                      <div role="status" aria-label="Loading available time slots" className="rounded-lg border border-brand-teal/20 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-brand-dark-soft">Available times</span>
                          <span className="text-[10px] text-brand-teal">Checking schedule…</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[0, 1, 2, 3, 4, 5].map((slot) => (
                            <SkeletonBlock key={slot} className="h-9 rounded-lg" />
                          ))}
                        </div>
                      </div>
                    ) : entry.shopClosed ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-xs text-brand-dark-soft">
                        The shop is closed for this day.
                      </p>
                    ) : entry.availabilityError ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <p>{entry.availabilityError}</p>
                        <button
                          type="button"
                          className="mt-1 font-semibold underline"
                          onClick={() => {
                            patchEntry(entry.key, { availabilityError: '' });
                            handleDateChange(entry.key, entry.appointment_date);
                          }}
                        >Retry</button>
                      </div>
                    ) : !(entry.availableSlots.length || entry.slotStatuses?.length || entry.walkInStartTime) ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-xs text-brand-dark-soft">
                        {entry.fullyBooked
                          ? (String(entry?.category || entry?.selectedService?.category || '').toLowerCase() === 'daycare'
                            ? 'Daycare is already reserved. Please choose a different date or time.'
                            : 'That date is fully booked for now. Please select another date for the pet.')
                          : 'No available slots for this date.'}
                      </p>
                    ) : (
                      <>
                        {entry.fullyBooked && (
                          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-500">
                            {String(entry?.category || entry?.selectedService?.category || '').toLowerCase() === 'daycare'
                              ? 'Daycare is already reserved. Please choose a different date or time.'
                              : 'That date is fully booked for now. Please select another date for the pet.'}
                          </div>
                        )}
                        <SelectDropdown
                          value={entry.start_time}
                          onChange={(v) => patchEntry(entry.key, { start_time: v })}
                          options={[
                            { value: '', label: 'Select time slot' },
                            ...(entry.slotStatuses?.length
                              ? entry.slotStatuses.map((slot) => ({
                                value: slot.time,
                                label: `${fmt12(slot.time)}${slot.status === 'full' ? ' · Full' : ''}`,
                                disabled: slot.status === 'full',
                              }))
                              : (entry.availableSlots || []).map((slot) => ({ value: slot, label: fmt12(slot) }))),
                            ...(walkInMode && entry.walkInStartTime ? [{
                              value: entry.walkInStartTime,
                              label: `Start now · ${fmt12(entry.walkInStartTime)}`,
                            }] : []),
                            ...(walkInMode && !entry.walkInStartTime && entry.walkInStatus === 'full' ? [{
                              value: '__walk_in_full__',
                              label: 'Start now · Full',
                              disabled: true,
                            }] : []),
                          ]}
                          placeholder="Select time slot"
                          disabled={entry.loadingSlots}
                          menuPlacement="down"
                        />
                        {entry.loadingSlots && <p className="mt-1 text-[10px] text-brand-teal">Updating availability…</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
