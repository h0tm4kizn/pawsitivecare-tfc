const DEACTIVATION_REASONS = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'disciplinary_suspension', label: 'Disciplinary Suspension' },
  { value: 'on_extended_leave', label: 'On Extended Leave' },
  { value: 'role_change_promotion', label: 'Role Change / Promotion' },
  { value: 'redundancy', label: 'Redundancy' },
  { value: 'other', label: 'Other (specify)' },
];

const DELETION_REASONS = [
  { value: 'duplicate_account', label: 'Duplicate Account' },
  { value: 'data_entry_error', label: 'Data Entry Error' },
  { value: 'privacy_request', label: 'Privacy Request' },
  { value: 'other', label: 'Other (specify)' },
];

export { DEACTIVATION_REASONS, DELETION_REASONS };
