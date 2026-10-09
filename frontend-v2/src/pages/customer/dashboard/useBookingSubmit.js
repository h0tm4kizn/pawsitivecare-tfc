import { useCallback, useRef } from 'react';
import { apiFetch } from '../../../api/apiClient';
import {
  isPawsomeExtrasService,
  sanitizeReferenceNumber,
} from './bookingModalUtils';
import {
  getAutoCatSizeLabel,
  shouldSkipGroomingSizeForCat,
} from './bookingUtils';

export default function useBookingSubmit({
  additionalPetIds,
  bookingItems,
  daycareAllPetSizesSelected,
  selectedDaycarePetIds,
  daycareSelectedPetSizes,
  form,
  hotelReservationComplete,
  isDaycareOnlyBooking,
  modeOfPayment,
  onBooked,
  pendingAssessmentDraft,
  pendingAssessmentDrafts,
  depositProof,
  petSpecies,
  referenceNumber,
  requiredHotelDeposit,
  selectedReservationProvider,
  selectedPet,
  selectedPaymentAccountId,
  setBooked,
  setCreatedAppointment,
  setError,
  setPendingAssessmentDraft,
  setPendingAssessmentDrafts,
  setSubmitting,
}) {
  const submissionInFlight = useRef(false);

  return useCallback(async () => {
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const hasHotelBooking = bookingItems.some((item) => String(item.category || item.service?.category || '').toLowerCase() === 'hotel' || item.hotel_suite_id);
      if (hasHotelBooking && !hotelReservationComplete) {
        setError('Hotel reservations require reservation channel, provider, and a valid reference number.');
        setSubmitting(false);
        return;
      }
      if (hasHotelBooking && !bookingItems.every((item) =>
        String(item.category || item.service?.category || '').toLowerCase() !== 'hotel'
        || Boolean(item.pet_size))) {
        setError('Please select a Pet Size for the hotel booking.');
        setSubmitting(false);
        return;
      }
      if (isDaycareOnlyBooking && !daycareAllPetSizesSelected) {
        setError('Please select a daycare size for each selected pet.');
        setSubmitting(false);
        return;
      }

      const categoryRank = (cat) => cat === 'grooming' ? 0 : cat === 'daycare' ? 1 : 2;
      const orderedItems = [...bookingItems].sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
      const groupedBookedPackages = orderedItems.map((item) => ({
        service_id: item.service?.id || '',
        size_label: item.category === 'daycare'
          ? (daycareSelectedPetSizes[String(form.pet_id)] || item.size_label || null)
          : item.size_label || (shouldSkipGroomingSizeForCat(item, petSpecies) ? getAutoCatSizeLabel(item.service) : null),
        pet_size: item.category === 'hotel' ? item.pet_size || null : null,
        appointment_date: item.appointment_date,
        start_time: item.start_time || null,
        daycare_duration: item.category === 'daycare' ? (item.daycare_duration || null) : null,
        hotel_suite_id: item.category === 'hotel' ? (item.hotel_suite_id || null) : null,
        hotel_nights: item.category === 'hotel' ? (item.hotel_nights ? Number(item.hotel_nights) : null) : null,
      }));
      const firstItem = groupedBookedPackages[0] || {};

      const assessmentPetIds = isDaycareOnlyBooking ? selectedDaycarePetIds : [String(form.pet_id)];
      for (const petId of assessmentPetIds) {
        const assessmentDraft = pendingAssessmentDrafts?.[String(petId)]
          || (String(pendingAssessmentDraft?.pet_id || '') === String(petId) ? pendingAssessmentDraft : null);
        if (!assessmentDraft || assessmentDraft._existing_today || assessmentDraft._saved_to_server) continue;
        const assessmentRes = await apiFetch(`/api/my-pets/${petId}/health-form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...assessmentDraft, pet_id: petId, service_id: firstItem.service_id || assessmentDraft.service_id || null }),
        });
        const assessmentData = await assessmentRes.json().catch(() => ({}));
        if (!assessmentRes.ok) {
          const message = assessmentRes.status >= 500
            ? 'The assessment could not be saved right now. Please try again later.'
            : assessmentData?.errors
            ? Object.values(assessmentData.errors).flat().join(' ')
            : assessmentData?.message || 'Assessment form could not be saved.';
          setError(message);
          return;
        }
      }

      const body = {
        pet_id: form.pet_id,
        service_id: firstItem.service_id || '',
        booked_by_owner_id: selectedPet?.owner_id || null,
        appointment_date: firstItem.appointment_date,
        start_time: firstItem.start_time,
        size_label: firstItem.size_label,
        pet_size: firstItem.pet_size || null,
        hotel_suite_id: firstItem.hotel_suite_id || null,
        hotel_nights: firstItem.hotel_nights || null,
        daycare_duration: firstItem.daycare_duration || null,
        status: 'pending',
        special_instructions: form.special_instructions || null,
        booked_packages: groupedBookedPackages,
        deposit: hasHotelBooking ? requiredHotelDeposit : null,
        reference_number: hasHotelBooking ? sanitizeReferenceNumber(referenceNumber) : null,
        has_deposit_proof: hasHotelBooking ? Boolean(depositProof) : false,
        reservation_channel: hasHotelBooking ? modeOfPayment : null,
        reservation_payment_account_id: hasHotelBooking ? selectedPaymentAccountId : null,
        reservation_payer_provider: hasHotelBooking ? selectedReservationProvider : null,
        notes: null,
        additional_pet_ids: isDaycareOnlyBooking ? additionalPetIds : [],
        daycare_pet_sizes: isDaycareOnlyBooking
          ? selectedDaycarePetIds.map((petId) => ({
              pet_id: String(petId),
              size_label: daycareSelectedPetSizes[String(petId)] || firstItem.size_label || null,
            }))
          : [],
      };
      const selectedAddonIds = Array.from(new Set(orderedItems.flatMap((item) => isPawsomeExtrasService(item?.service) && Array.isArray(item?.addons) ? item.addons : [])));
      if (selectedAddonIds.length > 0) {
        const addonMap = new Map(orderedItems
          .flatMap((item) => isPawsomeExtrasService(item?.service) && Array.isArray(item?.availableAddons) ? item.availableAddons : [])
          .map((addon) => [String(addon.id), addon]));
        body.addons = selectedAddonIds.map((addonId) => {
          const addon = addonMap.get(String(addonId));
          const charged = Number(addon?.price_min ?? addon?.price ?? 0);
          return { addon_id: addonId, price_charged: Number.isFinite(charged) ? charged : 0 };
        });
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setError('You appear to be offline. Reconnect to submit this booking.');
        return;
      }
      const res = await apiFetch('/api/my-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const validationErrors = Object.values(data?.errors || {})
          .flat()
          .filter(Boolean);
        const message = res.status === 401
          ? 'Your session has expired. Please sign in again before booking.'
          : res.status === 403
            ? data?.message || 'Your account is not authorized to submit this booking.'
            : res.status === 404
              ? 'The booking service could not be reached. Please refresh and try again.'
              : res.status === 409
                ? data?.message || 'The selected suite or time is no longer available. Please choose another.'
                : res.status === 422
                  ? data?.message || validationErrors.join(' ') || 'Some booking details are invalid. Review them and try again.'
                  : res.status === 429
                    ? 'Too many booking attempts were made. Please wait a moment before trying again.'
                    : res.status >= 500
                      ? 'We could not confirm whether your booking was saved. Check My Appointments before trying again.'
                      : data?.message || 'Booking failed. Please review the details and try again.';
        console.error('Appointment booking request failed.', { status: res.status });
        setError(message);
        setSubmitting(false);
        return;
      }
      const created = data?.data || data?.appointment || data || null;
      if (!created?.id) {
        console.error('Appointment booking response did not contain a saved appointment ID.', { status: res.status });
        setError('The server response was incomplete. Check My Appointments before trying again.');
        return;
      }
      let proofUploadFailed = false;
      if (depositProof && created?.id) {
        try {
          const proofBody = new FormData();
          proofBody.append('proof', depositProof);
          const proofRes = await apiFetch(`/api/appointments/${created.id}/deposit-proof`, { method: 'POST', body: proofBody });
          if (!proofRes.ok) {
            proofUploadFailed = true;
            console.error('Booking was saved, but the deposit proof upload failed.', { status: proofRes.status });
          } else {
            const proofData = await proofRes.json().catch(() => ({}));
            const savedAppointment = proofData?.data || proofData?.appointment || null;
            if (savedAppointment?.reservation_deposit_proof_available) {
              Object.assign(created, savedAppointment);
            }
          }
        } catch {
          proofUploadFailed = true;
          console.error('Booking was saved, but the deposit proof upload could not be confirmed.');
        }
      }
      created.proof_upload_failed = proofUploadFailed;
      setError('');
      setPendingAssessmentDraft(null);
      setPendingAssessmentDrafts({});
      setCreatedAppointment(created);
      setBooked(true);
      try {
        onBooked?.(created, firstItem.appointment_date);
      } catch (callbackError) {
        console.error('Booking completion callback failed:', callbackError);
      }
    } catch {
      setError('The connection was interrupted before we could confirm the booking. Check My Appointments before trying again.');
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }, [additionalPetIds, bookingItems, daycareAllPetSizesSelected, daycareSelectedPetSizes, depositProof, form, hotelReservationComplete, isDaycareOnlyBooking, modeOfPayment, onBooked, pendingAssessmentDraft, pendingAssessmentDrafts, petSpecies, referenceNumber, requiredHotelDeposit, selectedDaycarePetIds, selectedPet, selectedPaymentAccountId, selectedReservationProvider, setBooked, setCreatedAppointment, setError, setPendingAssessmentDraft, setPendingAssessmentDrafts, setSubmitting]);
}
