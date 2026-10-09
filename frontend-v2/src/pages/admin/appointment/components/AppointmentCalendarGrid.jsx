const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getCalendarServiceClass = (item) => {
  const status = String(item?.status || item?._raw?.status || '').toLowerCase().replace(/-/g, '_');
  if (status === 'completed' || status === 'cancelled' || status === 'no_show') return 'bg-gray-200 text-gray-500';
  const cat = String(item?.serviceCategory || item?.serviceType || '').toLowerCase();
  if (cat.includes('groom')) return 'bg-brand-grooming-soft text-brand-grooming';
  if (cat.includes('hotel') || cat.includes('suite')) return 'bg-brand-hotel-soft text-brand-hotel';
  if (cat.includes('day')) return 'bg-brand-daycare-soft text-brand-daycare';
  return 'bg-brand-teal-light text-brand-teal';
};

const getCalendarDotClass = (item) => {
  const status = String(item?.status || item?._raw?.status || '').toLowerCase().replace(/-/g, '_');
  if (status === 'completed' || status === 'cancelled' || status === 'no_show') return 'bg-gray-400';
  const cat = String(item?.serviceCategory || item?.serviceType || '').toLowerCase();
  if (cat.includes('groom')) return 'bg-brand-grooming';
  if (cat.includes('hotel') || cat.includes('suite')) return 'bg-brand-hotel';
  if (cat.includes('day')) return 'bg-brand-daycare';
  return 'bg-brand-teal';
};

const getHotelSegment = (item, dateIso, dayIndex) => {
  const raw = item?._raw || {};
  const category = String(item?.serviceCategory || item?.serviceType || raw?.service?.category || '').toLowerCase();
  const isHotel = category.includes('hotel') || category.includes('suite') || Number(raw?.hotel_nights || 0) > 0;
  if (!isHotel) return null;

  const checkIn = String(raw?.appointment_date || item?.calendarDateIso || item?.dateIso || '').slice(0, 10);
  const nights = Math.max(1, Number(raw?.hotel_nights || 1));
  const checkOutDate = new Date(`${checkIn}T00:00:00`);
  checkOutDate.setDate(checkOutDate.getDate() + nights);
  const checkOut = `${checkOutDate.getFullYear()}-${String(checkOutDate.getMonth() + 1).padStart(2, '0')}-${String(checkOutDate.getDate()).padStart(2, '0')}`;

  const isStart = dateIso === checkIn || dayIndex % 7 === 0;
  const isEnd = dateIso === checkOut || dayIndex % 7 === 6;
  const leftBleed = isStart ? 0 : 10;
  const rightBleed = isEnd ? 0 : 10;

  return {
    isStart,
    isEnd,
    showDetails: isStart,
    className: 'relative z-10 rounded-none bg-brand-hotel-soft text-brand-hotel shadow-none',
    style: {
      width: `calc(100% + ${leftBleed + rightBleed}px)`,
      marginLeft: leftBleed ? `-${leftBleed}px` : 0,
      borderTopLeftRadius: isStart ? '6px' : 0,
      borderBottomLeftRadius: isStart ? '6px' : 0,
      borderTopRightRadius: isEnd ? '6px' : 0,
      borderBottomRightRadius: isEnd ? '6px' : 0,
    },
  };
};

export default function AppointmentCalendarGrid({
  calendarDays,
  appointmentsByDate,
  todayIso,
  onDayClick,
  onAppointmentClick,
  onEmptyDayClick,
  compact = false,
}) {
  return (
    <div className={compact ? 'p-2' : 'p-3'}>
      <div className="overflow-hidden rounded-xl border border-brand-teal/25 bg-white">
      <div className="grid grid-cols-7 border-b border-brand-teal/25 bg-brand-surface">
        {weekDays.map((day) => (
          <div
            key={day}
            className={`${compact ? 'py-2 text-[10px]' : 'py-2.5 text-[11px]'} border-r border-brand-teal/15 text-center font-extrabold uppercase tracking-wide text-brand-dark last:border-r-0`}
          >
            {compact ? day.slice(0, 1) : day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays.map((dateObj, index) => {
          if (!dateObj) {
            return <div key={`blank-${index}`} className={`${compact ? 'min-h-[54px]' : 'min-h-[122px]'} border-b border-r border-brand-teal/15 bg-brand-surface/50`} />;
          }
          const dateIso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
          const dayAppointments = appointmentsByDate[dateIso] || [];
          const visible = dayAppointments.slice(0, 2);
          const extra = dayAppointments.length - visible.length;
          const isToday = dateIso === todayIso;
          const hasAppointments = dayAppointments.length > 0;
          const isPastEmptyDay = !hasAppointments && todayIso && dateIso < todayIso;
          const canOpenDay = hasAppointments || !isPastEmptyDay;
          const handleOpenDay = () => {
            if (isPastEmptyDay) return;
            if (!hasAppointments) {
              onEmptyDayClick?.(dateIso);
              return;
            }
            onDayClick(dateIso);
          };

          return (
            <div
              key={dateIso}
              role="button"
              tabIndex={canOpenDay ? 0 : -1}
              aria-disabled={!canOpenDay}
              onClick={handleOpenDay}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                handleOpenDay();
              }}
              className={`${compact ? 'min-h-[54px] p-1.5' : 'min-h-[122px] p-2'} overflow-visible border-b border-r border-brand-teal/15 text-left transition-colors focus:outline-none ${
                canOpenDay
                  ? 'bg-white hover:bg-brand-teal-light/15 focus:ring-2 focus:ring-inset focus:ring-brand-teal'
                  : 'cursor-not-allowed bg-brand-surface/45'
              } ${
                index % 7 === 6 ? 'border-r-0' : ''
              }`}
            >
              <div className={`${compact ? 'mb-1' : 'mb-2'} flex items-center justify-between`}>
                <span className={`inline-flex ${compact ? 'h-6 w-6 text-[11px]' : 'h-7 w-7 text-xs'} items-center justify-center rounded-full font-medium ${
                isToday ? 'bg-brand-teal text-white/90 shadow-sm' : 'text-brand-dark/45'
              }`}>
                {dateObj.getDate()}
              </span>
                {!compact && dayAppointments.length > 0 && (
                  <span className="text-[9px] font-bold text-brand-dark-soft">{dayAppointments.length}</span>
                )}
              </div>
              {compact ? (
                <div className="flex min-h-[14px] items-center justify-center gap-0.5">
                  {dayAppointments.slice(0, 3).map((item, itemIndex) => (
                    <span
                      key={`${item.id}-${itemIndex}`}
                      className={`h-1.5 w-1.5 rounded-full ${getCalendarDotClass(item)}`}
                    />
                  ))}
                  {dayAppointments.length > 3 && (
                    <span className="ml-0.5 text-[9px] font-extrabold leading-none text-brand-dark-soft">
                      +{dayAppointments.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-1 overflow-visible">
                  {visible.map((item) => {
                  const hotelSegment = getHotelSegment(item, dateIso, index);
                  const showDetails = !hotelSegment || hotelSegment.showDetails;
                  const showCheckout = hotelSegment?.isEnd && !hotelSegment.showDetails;
                  return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAppointmentClick?.(item);
                    }}
                    className={`block w-full truncate px-2 py-1.5 text-left text-[10px] font-bold leading-tight transition hover:brightness-95 ${
                      hotelSegment?.className || `rounded-md shadow-sm ${getCalendarServiceClass(item)}`
                    }`}
                    style={hotelSegment?.style}
                    aria-label={`${item.pet} ${item.time}`}
                  >
                    {showDetails ? (
                      <>
                        <div className="truncate">{item.pet}</div>
                        <div className="truncate text-[8px] font-semibold opacity-85">{item.time}</div>
                      </>
                    ) : showCheckout ? (
                      <span className="block h-[22px] truncate pt-2 text-right text-[8px] font-semibold opacity-85">
                        {item.time}
                      </span>
                    ) : (
                      <span className="block h-[22px]" aria-hidden="true" />
                    )}
                  </button>
                  );
                })}
                {extra > 0 && <div className="rounded-md bg-brand-surface px-2 py-1 text-[9px] font-bold text-brand-dark-soft">+{extra} more</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
