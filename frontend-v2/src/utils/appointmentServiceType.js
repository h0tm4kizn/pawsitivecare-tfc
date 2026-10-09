export const getAppointmentServiceCategory = (appointment) => String(
  appointment?.service?.category
  || appointment?.service_category
  || appointment?.serviceCategory
  || '',
).trim().toLowerCase();

export const getOrdinaryPaymentReference = (appointment) => {
  const category = getAppointmentServiceCategory(appointment);
  if (category === 'hotel') return null;
  return appointment?.payment_reference_id
    || appointment?.payment_reference
    || appointment?.payment?.reference_number
    || appointment?.payment?.reference
    || appointment?.reference_number
    || null;
};
