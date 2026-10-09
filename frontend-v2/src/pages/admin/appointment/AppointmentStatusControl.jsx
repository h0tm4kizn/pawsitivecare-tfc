import { useMemo, useState } from 'react';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import { APPOINTMENT_STATUS_RULES, normalizeAppointmentStatus } from './appointmentStatusRules';

export default function AppointmentStatusControl({
  status,
  disabled = false,
  isFuture = false,
  isPast = false,
  isHotel = false,
  hasHotelCheckIn = false,
  hasHotelCheckOut = false,
  canCompleteMissedHotelStay = false,
  isNoShowEligible = false,
  allowedStatuses = null,
  onChange,
}) {
  const [saving, setSaving] = useState(false);
  const options = useMemo(() => {
    const current = normalizeAppointmentStatus(status);
    let allowed = APPOINTMENT_STATUS_RULES[current] || [];
    if (Array.isArray(allowedStatuses)) {
      allowed = allowed.filter((option) => allowedStatuses.includes(option.value));
    }
    if (current === 'approved') {
      if (isFuture) allowed = allowed.filter((option) => option.value === 'cancelled');
      else if (isPast && !isHotel) allowed = allowed.filter((option) => option.value !== 'in_progress');
      if (isHotel && !hasHotelCheckIn) allowed = allowed.filter((option) => option.value !== 'in_progress');
      if (!isNoShowEligible) allowed = allowed.filter((option) => option.value !== 'no_show');
    }
    if (isHotel && current === 'in_progress' && !hasHotelCheckOut) {
      allowed = allowed.filter((option) => option.value !== 'completed');
    }
    if (isHotel && current === 'approved') {
      allowed = allowed.filter((option) => option.value !== 'completed');
    }
    if (isHotel && current === 'approved' && canCompleteMissedHotelStay) {
      allowed = [
        ...allowed,
        { value: 'complete_missed_checkin', label: 'Complete Missed Check-In' },
      ];
    }
    return allowed;
  }, [status, isFuture, isPast, isHotel, hasHotelCheckIn, hasHotelCheckOut, canCompleteMissedHotelStay, isNoShowEligible, allowedStatuses]);
  if (!options.length && !(isHotel && status === 'approved' && !hasHotelCheckIn)) return null;

  const handleChange = async (nextStatus) => {
    if (!nextStatus) return;
    setSaving(true);
    try { await onChange?.(nextStatus); } finally { setSaving(false); }
  };

  return (
    <div className="w-full min-w-0 sm:w-auto">
      <SelectDropdown
        value=""
        onChange={handleChange}
        options={options}
        placeholder={saving ? 'Updating status…' : 'Update Status'}
        disabled={disabled || saving}
        className="w-full sm:w-auto"
        buttonClassName="!h-11 !w-full sm:!w-auto !rounded-md !border-transparent !bg-brand-teal !px-4 !text-[13px] !font-semibold !leading-none !text-white hover:!bg-brand-teal-dark [&>svg]:shrink-0"
        textClassName="!text-white"
      />
    </div>
  );
}
