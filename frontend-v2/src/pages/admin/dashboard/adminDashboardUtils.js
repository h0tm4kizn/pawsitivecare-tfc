const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const calendarLegend = [
  { key: 'daycare', label: 'Daycare', bgClass: 'bg-brand-daycare', textClass: 'text-white', ringClass: 'ring-1 ring-brand-daycare' },
  { key: 'grooming', label: 'Grooming', bgClass: 'bg-brand-grooming', textClass: 'text-white', ringClass: 'ring-1 ring-brand-grooming' },
  { key: 'hotel', label: 'Hotel', bgClass: 'bg-brand-hotel', textClass: 'text-white', ringClass: 'ring-1 ring-brand-hotel' },
];

export const buildMonthDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);

    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;

    return {
      date: day,
      dayNumber: day.getDate(),
      iso,
      isCurrentMonth: day.getMonth() === month,
      isToday: day.toDateString() === new Date().toDateString(),
    };
  });
};

export const buildWeekDays = (date) => {
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);

    return {
      date: day,
      dayNumber: day.getDate(),
      dayName: weekDays[day.getDay()],
      iso: toLocalIsoDate(day),
      isToday: day.toDateString() === new Date().toDateString(),
    };
  });
};

export const getAppointmentDate = (appointment) =>
  appointment?.dateIso ||
  appointment?.appointment_date ||
  appointment?.date ||
  appointment?.start_date ||
  String(appointment?.start_time || '').slice(0, 10);

export const getServiceCategory = (appointment) => {
  const category = String(
    appointment?.serviceCategory ||
    appointment?.service?.category ||
    appointment?._raw?.service?.category ||
    appointment?._raw?.service_category ||
    ''
  ).toLowerCase();
  const serviceName = String(
    appointment?.service?.name ||
    appointment?._raw?.service?.name ||
    appointment?.service ||
    ''
  ).toLowerCase();

  if (category.includes('hotel')) return 'hotel';
  if (category.includes('daycare') || category.includes('day care')) return 'daycare';
  if (category.includes('groom')) return 'grooming';
  if (serviceName.includes('hotel') || serviceName.includes('suite')) return 'hotel';
  if (serviceName.includes('daycare')) return 'daycare';
  if (serviceName.includes('groom')) return 'grooming';
  return 'grooming';
};

export const getOwnerDisplayName = (appointment) => {
  const directOwner = appointment?.owner;
  if (typeof directOwner === 'string' && directOwner.trim()) return directOwner.trim();

  const ownerFirst = String(
    appointment?.owner?.first_name ||
    appointment?.pet?.owner?.first_name ||
    ''
  ).trim();
  const ownerLast = String(
    appointment?.owner?.last_name ||
    appointment?.pet?.owner?.last_name ||
    ''
  ).trim();
  const combined = `${ownerFirst} ${ownerLast}`.trim();
  return combined || 'Unknown Customer';
};

export const getSearchText = (appointment) => [
  appointment?.pet,
  appointment?.pet?.name,
  appointment?.pet_name,
  appointment?.owner,
  appointment?.pet?.owner?.first_name,
  appointment?.pet?.owner?.last_name,
  appointment?.owner?.name,
  appointment?.service,
  appointment?.service?.name,
  appointment?.service_name,
  appointment?.status,
].filter(Boolean).join(' ').toLowerCase();

export const groupAppointmentsByDate = (appointments) => {
  return appointments.reduce((acc, appointment) => {
    const dates = getCalendarDatesForAppointment(appointment);
    const category = getServiceCategory(appointment);

    dates.forEach((key) => {
      if (!acc[key]) {
        acc[key] = { grooming: 0, hotel: 0, daycare: 0, total: 0 };
      }

      acc[key][category] += 1;
      acc[key].total += 1;
    });
    return acc;
  }, {});
};

export const toLocalIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toManilaIsoDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const MANILA_DAY_KEYS = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

export const getWalkInUnavailableReason = (dateLabel, shopHours, shopHoursLoading, shopHoursError, now = new Date()) => {
  if (dateLabel !== toManilaIsoDate(now)) return 'Walk-In Service is only available for today.';
  if (shopHoursLoading) return 'Checking today’s shop hours…';
  if (shopHoursError) return 'Unable to verify shop hours right now.';

  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(now);
  const value = shopHours?.[MANILA_DAY_KEYS[dayName]];
  if (!value || String(value).trim().toLowerCase() === 'closed') return 'The shop is closed today.';

  const match = String(value).match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 'Today’s shop hours are unavailable.';

  const toMinutes = (hour, minute, period) => {
    let h = Number(hour) % 12;
    if (period.toUpperCase() === 'PM') h += 12;
    return h * 60 + Number(minute);
  };
  const open = toMinutes(match[1], match[2], match[3]);
  const close = toMinutes(match[4], match[5], match[6]);
  const timeParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value: part }) => [type, part]));
  const current = Number(timeParts.hour) * 60 + Number(timeParts.minute);
  if (current < open) return `Walk-In Service starts at ${match[1]}:${match[2]} ${match[3].toUpperCase()}.`;
  if (current >= close) return `Walk-In Service ended at ${match[4]}:${match[5]} ${match[6].toUpperCase()}.`;
  return '';
};

export const addDaysIso = (dateIso, days) => {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
};

export const getHotelStageForDate = (appointment, dateIso) => {
  const raw = appointment?._raw || {};
  const checkIn = String(raw?.appointment_date || appointment?.dateIso || '').slice(0, 10);
  const nights = Math.max(1, Number(raw?.hotel_nights || 1));
  const checkOut = checkIn ? addDaysIso(checkIn, nights) : '';
  if (dateIso === checkIn) return 'Check-in';
  if (dateIso === checkOut) return 'Check-out';
  return 'Staying';
};

export const getCalendarDatesForAppointment = (appointment) => {
  const date = getAppointmentDate(appointment);
  if (!date) return [];

  const checkIn = String(date).slice(0, 10);
  if (getServiceCategory(appointment) !== 'hotel') return [checkIn];

  const nights = Math.max(1, Number(appointment?._raw?.hotel_nights || 1));
  return Array.from({ length: nights + 1 }, (_, offset) => addDaysIso(checkIn, offset));
};

export const expandAppointmentsForCalendarDate = (appointments, dateIso) => {
  return appointments
    .filter((appointment) => getCalendarDatesForAppointment(appointment).includes(dateIso))
    .map((appointment) => {
      if (getServiceCategory(appointment) !== 'hotel') return appointment;
      const stage = getHotelStageForDate(appointment, dateIso);
      return {
        ...appointment,
        dateIso,
        calendarDateIso: dateIso,
        calendarLabel: stage,
        time: stage,
      };
    });
};

export const formatStatusLabel = (status) => {
  const normalized = String(status || '').toLowerCase().replace(/-/g, '_');
  if (normalized === 'in_progress' || normalized === 'checkin' || normalized === 'checked_in') return 'In Progress';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'no_show') return 'Cancelled';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled') return 'Cancelled';
  return normalized ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Pending';
};

export const normalizeStatus = (status) => String(status || '').toLowerCase().replace(/-/g, '_');
export const isInProgressStatus = (status) => ['checkin', 'checked_in', 'in_progress'].includes(normalizeStatus(status));
export const needsAppointmentStatusUpdate = (status) => ['approved', 'checkin', 'checked_in', 'in_progress'].includes(normalizeStatus(status));

export const timeToMinutes = (timeValue = '') => {
  const text = String(timeValue || '').trim();
  if (!text) return null;
  const [hh, mm] = text.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return (hh * 60) + mm;
};

export const isPastGraceWindow = (appointment, todayIso, nowDate = new Date()) => {
  if (normalizeStatus(appointment?.status) !== 'approved') return false;
  const appointmentDate = String(appointment?.dateIso || appointment?.appointment_date || appointment?.date || '').slice(0, 10);
  if (!appointmentDate || appointmentDate !== todayIso) return false;
  const startTime = String(appointment?._raw?.start_time || appointment?.start_time || appointment?.time || '');
  const startMinutes = timeToMinutes(startTime);
  if (startMinutes === null) return false;
  const nowMinutes = (nowDate.getHours() * 60) + nowDate.getMinutes();
  return nowMinutes >= (startMinutes + 15);
};
