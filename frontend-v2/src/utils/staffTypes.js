export const STAFF_TYPES = Object.freeze({
  FRONT_DESK: 'front_desk',
  GROOMER: 'groomer',
});

export const normalizeStaffType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'technical') return STAFF_TYPES.FRONT_DESK;
  if (type === 'field') return STAFF_TYPES.GROOMER;
  return type;
};

export const staffTypeLabel = (value) => {
  const type = normalizeStaffType(value);
  if (type === STAFF_TYPES.FRONT_DESK) return 'Front Desk';
  if (type === STAFF_TYPES.GROOMER) return 'Groomer';
  return value || '-';
};

export const canAccessStaffPage = (user, pageId, suppliesEnabled = true) => {
  const role = String(user?.role || '').trim().toLowerCase();
  if (pageId === 'inventory' && !suppliesEnabled) return false;
  if (role === 'admin') return true;
  if (role !== 'staff') return pageId === 'dashboard';

  const type = normalizeStaffType(user?.staff_type);
  if (type === STAFF_TYPES.FRONT_DESK) {
    return ['dashboard', 'appointment', 'staff', 'customer', 'pets', 'inventory'].includes(pageId);
  }
  if (type === STAFF_TYPES.GROOMER) {
    return ['dashboard', 'appointment', 'staff'].includes(pageId);
  }
  return pageId === 'dashboard';
};
