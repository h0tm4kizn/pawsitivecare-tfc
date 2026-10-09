export const APPOINTMENT_STATUS_RULES = {
  pending: [
    { value: 'approved', label: 'Approve' },
    { value: 'cancelled', label: 'Reject Request' },
  ],
  approved: [
    { value: 'in_progress', label: 'Start Service' },
    { value: 'completed', label: 'Mark as Complete' },
    { value: 'cancelled', label: 'Cancel Appointment' },
    { value: 'no_show', label: 'Mark as No-Show' },
  ],
  in_progress: [
    { value: 'completed', label: 'Mark as Complete' },
    { value: 'cancelled', label: 'Cancel Appointment' },
  ],
};

export const normalizeAppointmentStatus = (status) => String(status || '').toLowerCase().replace(/-/g, '_');
