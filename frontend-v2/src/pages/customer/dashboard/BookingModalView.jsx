export default function BookingModalView({ context }) {
  const {
    BANK_OPTIONS,
    BookingModalPetStep,
    BookingModalScheduleStep,
    BookingModalServiceStep,
    BookingModalSidebar,
    BookingModalSummary,
    BookingStepIndicator,
    ClientBookingValidationBox,
    DAYCARE_MAX_PETS,
    EMPTY_ITEM,
    EWALLET_OPTIONS,
    MAX_BOOKING_DATE,
    MAX_BOOKING_MONTH_INDEX,
    PARASITE_BLOCK_BODY,
    PARASITE_BLOCK_TITLE,
    PAYMENT_TYPE_OPTIONS,
    PetAssessmentFormModal,
    STEPS,
    STEPS_WITHOUT_PAYMENT,
    STEPS_WITH_RESERVATION,
    SelectDropdown,
    TODAY,
    activeItem,
    activeItemIndex,
    additionalPetIds,
    addonDisplayName,
    addonDisplayTier,
    addonPriceLabel,
    assessmentPet,
    bankName,
    booked,
    bookingItems,
    bookingRequiresRabies,
    canNext,
    createPortal,
    createdAppointment,
    daycarePricingRows,
    daycareSelectedPetSizes,
    daycareSelectedPets,
    daycareSizeLabel,
    diffDays,
    error,
    estimatedCheckInBalance,
    fetchPetHealthStatus,
    finalEstimatedTotal,
    fmtTime,
    form,
    formatHotelDateTime,
    formatHotelDescription,
    getAutoCatSizeLabel,
    getDaycareSizeOptions,
    getServiceName,
    handleBack,
    handleModalClose,
    handleNext,
    handleSubmit,
    hasDaycareAndGrooming,
    hasDaycareCategory,
    hasHotel,
    hasHotelCategory,
    hasNonHotelCategory,
    hotelCalendarLoading,
    hotelCalendarSlow,
    hotelCalendarHasLoaded,
    hotelCalendarAvailabilityVerified,
    hotelCalendarError,
    setHotelCalendarRetryKey,
    hotelCapacityByDate,
    hotelClosedDates,
    hotelMonth,
    hotelSuites,
    hotelSuitesLoading,
    hotelSuitesSlow,
    hotelSuitesError,
    setHotelSuitesRetryKey,
    hotelSuitesForPet,
    hotelUnavailableDates,
    isDaycareOnlyBooking,
    isDogPet,
    isPawsomeExtrasService,
    isSummaryStep,
    modeOfPayment,
    paymentFromOtherName,
    paymentFromProvider,
    paymentToAccount,
    normalizeService,
    pawsomeExtrasService,
    pendingAssessmentDraft,
    pendingAssessmentDrafts,
    depositProof,
    petAssessmentFlags,
    petBg,
    petBorder,
    petHealthStatus,
    petLight,
    petSpecies,
    pets,
    petsLoading,
    rangeHasBlockedNights,
    referenceNumber,
    requiredHotelDeposit,
    reservationOtherName,
    runServiceClickAction,
    sanitizeReferenceNumber,
    sanitizeText,
    selectedDaycarePetIds,
    selectedPet,
    selectedPetHasTicksOrFlea,
    selectedReservationProvider,
    services,
    servicesError,
    servicesLoading,
    setAdditionalPetIds,
    setAssessmentPet,
    setBankName,
    setPaymentAccountId,
    setCatalogRetryKey,
    setDaycarePetSizes,
    setError,
    setForm,
    setHotelMonth,
    setItem,
    setModeOfPayment,
    setPaymentFromOtherName,
    setPaymentFromProvider,
    setPaymentToAccount,
    setPaymentOtherName,
    setPendingAssessmentDraft,
    setPendingAssessmentDrafts,
    setDepositProof,
    setPetAssessmentFlags,
    setPetHealthStatus,
    setReferenceNumber,
    setStep,
    shouldSkipGroomingSizeForCat,
    sizeWeightHint,
    slotStateByIndex,
    step,
    submitting,
    toIso,
  } = context;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between bg-brand-teal px-6 py-4">
          <h2 className="text-base font-extrabold text-white">Book an Appointment</h2>
          <button
            type="button"
            onClick={handleModalClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Close booking modal"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Step indicator */}
        {!booked && (
          <div className="flex items-center justify-center gap-2 border-b border-brand-dark-light px-5 py-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <BookingStepIndicator index={i} step={step} label={label} />
                {i < STEPS.length - 1 && <div className="h-px w-5 bg-brand-dark-light" />}
              </div>
            ))}
          </div>
        )}

        {/* Success Screen */}
        {booked ? (
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center gap-4 overflow-y-auto scrollbar-teal max-w-md mx-auto w-full">
            <div className="w-16 h-16 rounded-full bg-brand-teal-light flex items-center justify-center">
              <i className="fa-solid fa-circle-check text-brand-teal text-2xl" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-brand-dark">Booking Confirmed!</p>
              <p className="text-sm text-brand-dark-soft mt-1">Appointment booking request has been sent for approval.</p>
            </div>

            {/* Booking Details */}
            <div className="w-full rounded-xl border border-brand-dark-light bg-white px-4 py-4 text-left space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-dark-soft mb-2">Booking Details</p>
              {[
                { label: 'Appointment ID', value: createdAppointment?.appointment_code || '—' },
                { label: 'Pet', value: pets.find((p) => p.id === form.pet_id)?.name || '—' },
                { label: 'Service', value: createdAppointment?.service?.name || bookingItems[0]?.service?.name || '—' },
                { label: 'Category', value: (createdAppointment?.service?.category || bookingItems[0]?.category || '—').charAt(0).toUpperCase() + (createdAppointment?.service?.category || bookingItems[0]?.category || '').slice(1) },
                { label: 'Size/Package', value: createdAppointment?.size_label || bookingItems[0]?.size_label || '—' },
                { label: 'Date', value: createdAppointment?.appointment_date ? new Date(createdAppointment.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                { label: 'Time', value: createdAppointment?.start_time ? (() => { const [h,m] = createdAppointment.start_time.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; })() : '—' },
                ...(createdAppointment?.hotel_nights ? [{ label: 'Nights', value: `${createdAppointment.hotel_nights} night${createdAppointment.hotel_nights > 1 ? 's' : ''}` }] : []),
                ...(createdAppointment?.hotel_suite?.name ? [{ label: 'Suite', value: createdAppointment.hotel_suite.name }] : []),
                { label: 'Total', value: createdAppointment?.total_price ? `PHP ${Number(createdAppointment.total_price).toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}` : '—' },
              ].filter((r) => r.value && r.value !== '—').map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-dark-soft">{label}</span>
                  <span className="text-xs font-bold text-brand-dark">{value}</span>
                </div>
              ))}
            </div>

            <div className="w-full rounded-xl bg-brand-teal-light border border-brand-teal/30 px-4 py-3 flex items-start gap-3 text-left">
              <i className="fa-solid fa-bell text-brand-teal text-sm shrink-0 mt-0.5" />
                <p className="text-xs text-brand-teal leading-relaxed">
                Please wait for an <strong>email or in-app notification</strong> once the appointment booking is approved by our staff.
              </p>
            </div>
            <button type="button" onClick={handleModalClose}
              className="rounded-xl bg-brand-teal px-8 py-2.5 text-sm font-extrabold uppercase tracking-widest text-white hover:brightness-95 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

            {/* Main content with conditional sidebar */}
            <div className={`grid flex-1 min-h-0 overflow-hidden ${
              isSummaryStep ? '' : 'grid-cols-1 lg:grid-cols-[1fr_280px]'
            }`}>
              <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto min-h-0 scrollbar-teal h-full">

            <BookingModalPetStep
              step={step}
              hasDaycareCategory={hasDaycareCategory}
              selectedDaycarePetIds={selectedDaycarePetIds}
              additionalPetIds={additionalPetIds}
              form={form}
              DAYCARE_MAX_PETS={DAYCARE_MAX_PETS}
              petsLoading={petsLoading}
              pets={pets}
              setForm={setForm}
              setAdditionalPetIds={setAdditionalPetIds}
              selectedPet={selectedPet}
              isDogPet={isDogPet}
              setError={setError}
              setAssessmentPet={setAssessmentPet}
              setPendingAssessmentDraft={setPendingAssessmentDraft}
              setPendingAssessmentDrafts={setPendingAssessmentDrafts}
              fetchPetHealthStatus={fetchPetHealthStatus}
              petHealthStatus={petHealthStatus}
              petAssessmentFlags={petAssessmentFlags}
              activeItem={activeItem}
              bookingRequiresRabies={bookingRequiresRabies}
              assessmentPet={assessmentPet}
              pendingAssessmentDraft={pendingAssessmentDraft}
              pendingAssessmentDrafts={pendingAssessmentDrafts}
              PARASITE_BLOCK_TITLE={PARASITE_BLOCK_TITLE}
              PARASITE_BLOCK_BODY={PARASITE_BLOCK_BODY}
              setPetAssessmentFlags={setPetAssessmentFlags}
              setPetHealthStatus={setPetHealthStatus}
              PetAssessmentFormModal={PetAssessmentFormModal}
              petBorder={petBorder}
              petLight={petLight}
              petBg={petBg}
              sanitizeText={sanitizeText}
            />

            <BookingModalServiceStep
              PARASITE_BLOCK_BODY={PARASITE_BLOCK_BODY}
              PARASITE_BLOCK_TITLE={PARASITE_BLOCK_TITLE}
              activeItem={activeItem}
              activeItemIndex={activeItemIndex}
              addonDisplayName={addonDisplayName}
              addonDisplayTier={addonDisplayTier}
              addonPriceLabel={addonPriceLabel}
              daycareSelectedPetSizes={daycareSelectedPetSizes}
              daycareSelectedPets={daycareSelectedPets}
              form={form}
              formatHotelDescription={formatHotelDescription}
              getAutoCatSizeLabel={getAutoCatSizeLabel}
              getDaycareSizeOptions={getDaycareSizeOptions}
              getServiceName={getServiceName}
              hasDaycareAndGrooming={hasDaycareAndGrooming}
              hasHotelCategory={hasHotelCategory}
              hasNonHotelCategory={hasNonHotelCategory}
              hotelSuitesForPet={hotelSuitesForPet}
              hotelSuitesLoading={hotelSuitesLoading}
              hotelSuitesSlow={hotelSuitesSlow}
              hotelSuitesError={hotelSuitesError}
              setHotelSuitesRetryKey={setHotelSuitesRetryKey}
              isPawsomeExtrasService={isPawsomeExtrasService}
              normalizeService={normalizeService}
              pawsomeExtrasService={pawsomeExtrasService}
              petSpecies={petSpecies}
              runServiceClickAction={runServiceClickAction}
              selectedDaycarePetIds={selectedDaycarePetIds}
              selectedPetHasTicksOrFlea={selectedPetHasTicksOrFlea}
              services={services}
              servicesError={servicesError}
              servicesLoading={servicesLoading}
              SelectDropdown={SelectDropdown}
              setAdditionalPetIds={setAdditionalPetIds}
              setCatalogRetryKey={setCatalogRetryKey}
              setDaycarePetSizes={setDaycarePetSizes}
              setItem={setItem}
              shouldSkipGroomingSizeForCat={shouldSkipGroomingSizeForCat}
              sizeWeightHint={sizeWeightHint}
              step={step}
            />
            <BookingModalScheduleStep
              step={step}
              bookingItems={bookingItems}
              slotStateByIndex={slotStateByIndex}
              hotelSuites={hotelSuites}
              getServiceName={getServiceName}
              hotelMonth={hotelMonth}
              setHotelMonth={setHotelMonth}
              MAX_BOOKING_MONTH_INDEX={MAX_BOOKING_MONTH_INDEX}
              hotelCalendarLoading={hotelCalendarLoading}
              hotelCalendarSlow={hotelCalendarSlow}
              hotelCalendarHasLoaded={hotelCalendarHasLoaded}
              hotelCalendarAvailabilityVerified={hotelCalendarAvailabilityVerified}
              hotelCalendarError={hotelCalendarError}
              setHotelCalendarRetryKey={setHotelCalendarRetryKey}
              hotelClosedDates={hotelClosedDates}
              hotelUnavailableDates={hotelUnavailableDates}
              hotelCapacityByDate={hotelCapacityByDate}
              setItem={setItem}
              setError={setError}
              diffDays={diffDays}
              rangeHasBlockedNights={rangeHasBlockedNights}
              TODAY={TODAY}
              toIso={toIso}
              formatHotelDateTime={formatHotelDateTime}
              SelectDropdown={SelectDropdown}
              fmtTime={fmtTime}
              hasHotel={hasHotel}
              finalEstimatedTotal={finalEstimatedTotal}
              requiredHotelDeposit={requiredHotelDeposit}
              estimatedCheckInBalance={estimatedCheckInBalance}
              modeOfPayment={modeOfPayment}
              setModeOfPayment={setModeOfPayment}
              paymentFromProvider={paymentFromProvider}
              setPaymentFromProvider={setPaymentFromProvider}
              paymentFromOtherName={paymentFromOtherName}
              setPaymentFromOtherName={setPaymentFromOtherName}
              setBankName={setBankName}
              setPaymentAccountId={setPaymentAccountId}
              setPaymentToAccount={setPaymentToAccount}
              setPaymentOtherName={setPaymentOtherName}
              PAYMENT_TYPE_OPTIONS={PAYMENT_TYPE_OPTIONS}
              EWALLET_OPTIONS={EWALLET_OPTIONS}
              BANK_OPTIONS={BANK_OPTIONS}
              bankName={bankName}
              reservationOtherName={reservationOtherName}
              sanitizeText={sanitizeText}
              referenceNumber={referenceNumber}
              paymentToAccount={paymentToAccount}
              setReferenceNumber={setReferenceNumber}
              depositProof={depositProof}
              setDepositProof={setDepositProof}
              sanitizeReferenceNumber={sanitizeReferenceNumber}
            />

            <BookingModalSummary
              isSummaryStep={isSummaryStep}
              bookingItems={bookingItems}
              hasDaycareCategory={hasDaycareCategory}
              selectedPet={selectedPet}
              daycareSelectedPets={daycareSelectedPets}
              daycarePricingRows={daycarePricingRows}
              hotelSuites={hotelSuites}
              getServiceName={getServiceName}
              isPawsomeExtrasService={isPawsomeExtrasService}
              formatHotelDateTime={formatHotelDateTime}
              fmtTime={fmtTime}
              daycareSizeLabel={daycareSizeLabel}
              modeOfPayment={modeOfPayment}
              selectedReservationProvider={selectedReservationProvider}
              referenceNumber={referenceNumber}
              requiredHotelDeposit={requiredHotelDeposit}
              finalEstimatedTotal={finalEstimatedTotal}
              estimatedCheckInBalance={estimatedCheckInBalance}
              form={form}
              setForm={setForm}
            />

              </div>

              <BookingModalSidebar
                step={step}
                STEPS={STEPS}
                bookingItems={bookingItems}
                selectedPet={selectedPet}
                hasDaycareCategory={hasDaycareCategory}
                daycareSelectedPets={daycareSelectedPets}
                daycarePricingRows={daycarePricingRows}
                hotelSuites={hotelSuites}
                finalEstimatedTotal={finalEstimatedTotal}
                requiredHotelDeposit={requiredHotelDeposit}
                estimatedCheckInBalance={estimatedCheckInBalance}
              />
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between border-t border-brand-dark-light px-4 sm:px-6 py-3 sm:py-4">
              {step > 0 ? (
                <button type="button" onClick={handleBack}
                  className="rounded-xl border border-brand-dark-light px-4 sm:px-5 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-surface transition-colors">
                  Back
                </button>
              ) : (
                <button type="button" onClick={handleModalClose}
                  className="rounded-xl border border-brand-dark-light px-4 sm:px-5 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-surface transition-colors">
                  Cancel
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={handleNext} disabled={!canNext() && !(step === 0 && Boolean(form.pet_id)) && !(step === 1 && isDaycareOnlyBooking && selectedDaycarePetIds.length >= 1 && selectedDaycarePetIds.length <= DAYCARE_MAX_PETS)}
                  className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-bold text-white hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Next
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-bold text-white hover:brightness-95 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {submitting ? 'Booking...' : 'Submit Booking'}
                </button>
              )}
            </div>

          </div>
        )}

      </div>

      <ClientBookingValidationBox
        open={Boolean(error)}
        message={error}
        primaryLabel={/assessment|vaccination|rabies|weight|ticks|fleas/i.test(error) ? 'Complete Pet Assessment' : 'Back to Pets'}
        onBack={() => {
          const shouldOpenAssessment = /assessment|vaccination|rabies|weight|ticks|fleas/i.test(error);
          const assessmentTarget = hasDaycareCategory
            ? daycareSelectedPets.find((pet) => (
                petHealthStatus[pet.id] !== true
                || petAssessmentFlags[pet.id]?.missing_rabies
                || petAssessmentFlags[pet.id]?.has_ticks
                || petAssessmentFlags[pet.id]?.has_flea
              )) || selectedPet
            : selectedPet;
          setError('');
          setStep(0);
          if (shouldOpenAssessment && assessmentTarget) {
            setAssessmentPet(assessmentTarget);
          }
        }}
        onExit={() => {
          setError('');
          handleModalClose();
        }}
      />
    </div>,
    document.body
  );
}
