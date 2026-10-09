export const hotelTimeInputFromValue = (value) => {
  const [hourText = '', minute = '00'] = String(value || '').slice(0, 5).split(':');
  if (!/^\d{1,2}$/.test(hourText) || !/^\d{2}$/.test(minute)) {
    return { hour: '', minute: '', period: 'AM' };
  }
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { hour: '', minute: '', period: 'AM' };
  }

  return {
    hour: String(hour % 12 || 12).padStart(2, '0'),
    minute,
    period: hour >= 12 ? 'PM' : 'AM',
  };
};

export const hotelTimeValueFromInput = ({ hour, minute, period }) => {
  if (!/^(0[1-9]|1[0-2])$/.test(String(hour || ''))
    || !/^[0-5]\d$/.test(String(minute || ''))
    || !['AM', 'PM'].includes(period)) {
    return null;
  }
  const hour24 = (Number(hour) % 12) + (period === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${minute}`;
};

export const hotelCheckInTimeError = (value, operatingHours, date) => {
  const input = typeof value === 'object' && value !== null
    ? value
    : hotelTimeInputFromValue(value);
  const time = hotelTimeValueFromInput(input);
  if (!time) return 'Enter a valid hour from 01 to 12 and minute from 00 to 59.';
  if (!operatingHours?.open || !operatingHours?.close) {
    return 'Hotel check-in hours are unavailable for this date.';
  }
  if (operatingHours.open >= operatingHours.close) {
    return 'Overnight Hotel check-in hours are not configured.';
  }
  if (time < operatingHours.open || time >= operatingHours.close) {
    return `Choose a check-in time within configured operating hours (${operatingHours.open} to ${operatingHours.close}).`;
  }
  if (date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const current = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    const today = `${current.year}-${current.month}-${current.day}`;
    const currentTime = `${current.hour}:${current.minute}`;
    if (date < today || (date === today && time <= currentTime)) {
      return 'Choose a check-in time that has not passed in Manila time.';
    }
  }
  return '';
};
