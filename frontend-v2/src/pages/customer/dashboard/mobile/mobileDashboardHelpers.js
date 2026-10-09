export const petInitials = (name) => String(name || '?').slice(0, 2).toUpperCase();

export const petBg = (pet) => {
  const species = String(
    pet?.species_type?.name || pet?.speciesType?.name || '',
  ).toLowerCase();
  return species.includes('cat') ? 'bg-brand-orange' : 'bg-brand-teal';
};

export const petTone = (pet) => {
  const species = String(
    pet?.species_type?.name || pet?.speciesType?.name || '',
  ).toLowerCase();
  return species.includes('cat') ? 'text-brand-orange' : 'text-brand-teal';
};

export const petCardGradient = (pet) => {
  const species = String(
    pet?.species_type?.name || pet?.speciesType?.name || '',
  ).toLowerCase();
  return species.includes('cat')
    ? 'bg-gradient-to-r from-orange-50 via-white to-white'
    : 'bg-gradient-to-r from-brand-teal-light/80 via-white to-white';
};

export const fmtDate = (date) =>
  date
    ? new Date(String(date).slice(0, 10) + 'T00:00:00').toLocaleDateString(
        'en-US',
        {
          timeZone: 'Asia/Manila',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        },
      )
    : null;

export const calcAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(String(dob).slice(0, 10) + 'T00:00:00');
  const totalMonths =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'Under 1 month';
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0
    ? `${years} yr${years !== 1 ? 's' : ''} ${months} mo`
    : `${years} yr${years !== 1 ? 's' : ''}`;
};

export const calcBirthdayCountdown = (dob) => {
  if (!dob) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(String(dob).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return null;
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / (1000 * 60 * 60 * 24));
};

export const fmtBirthday = (dob) => {
  if (!dob) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(String(dob).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return '';
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return next.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
  });
};
