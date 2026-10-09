export default function TermsCondition({ isOpen, onClose, onBack }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-2 backdrop-blur-sm bg-brand-dark/40"
      onClick={(event) => {
        event.stopPropagation();
        onBack?.() ?? onClose?.();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-brand-orange hover:text-brand-dark transition-colors text-2xl"
          onClick={onBack ?? onClose}
          aria-label="Back to registration"
        >
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="px-6 py-8 sm:p-10">
          <h2 className="text-3xl font-bold mb-2 text-brand-orange text-center">Terms &amp; Conditions</h2>
          <p className="text-center text-brand-dark/70 mb-1">The Fur Club Pet Station</p>
          <p className="text-center text-xs text-stone-400 mb-8">Effective Date: May 29, 2026 &nbsp;·&nbsp; Version: 1.0</p>

          <div className="space-y-8 text-sm text-stone-700">
            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">1. Acceptance of Terms</h3>
              <p>
                By booking, registering, or using any service offered by The Fur Club through our web-based platform,
                website, or in person, you ("Fur Parent") agree to be bound by these Terms and Conditions. If you do not
                agree with any part of these terms, please refrain from using our services.
              </p>
              <p className="mt-2">
                These terms apply to all services offered by The Fur Club, including Grooming, Daycare, and Pet Hotel services.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">2. Our Services</h3>
              <h4 className="font-semibold text-base text-brand-dark">Pet Daycare</h4>
              <p>Supervised daytime care, play sessions, exercise, and socialization activities.</p>
              <h4 className="font-semibold text-base text-brand-dark mt-3">Pet Grooming</h4>
              <p>Bathing, blow drying, haircuts, nail trimming, ear cleaning, hygiene services, and specialty styling.</p>
              <h4 className="font-semibold text-base text-brand-dark mt-3">Pet Hotel</h4>
              <p>Overnight accommodation, feeding, exercise, monitoring, and basic care throughout the duration of the stay.</p>
              <p className="mt-2">All services are subject to availability and the policies outlined in these Terms and Conditions.</p>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">3. Pet Daycare Policies</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Daycare services operate during the station&apos;s designated business hours.</li>
                <li>Late drop-offs or pick-ups outside operating hours may be subject to additional charges or applicable station policies.</li>
                <li>All daycare pets may be required to undergo an initial temperament or behavioral assessment before participating in group activities.</li>
                <li>Pets are supervised by trained personnel; however, minor play-related incidents may occur despite reasonable supervision.</li>
                <li>The Fur Club is not liable for minor injuries resulting from normal supervised social interaction among pets.</li>
                <li>Pets not collected before closing time may be accommodated under Pet Hotel services, subject to availability and applicable charges.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">4. Pet Grooming Policies</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Fur Parents will be notified once grooming services have been completed and the pet is ready for pick-up.</li>
                <li>Delayed pick-ups may be subject to the station&apos;s applicable policies and operational procedures.</li>
                <li>Severely matted coats may require a shorter haircut or complete shave when necessary for the pet&apos;s comfort, welfare, and safety.</li>
                <li>The Fur Club is not responsible for skin conditions, irritations, or other pre-existing issues revealed during dematting procedures.</li>
                <li>Grooming services may be paused, modified, or refused if a pet exhibits excessive stress, aggression, or behavior that may endanger the pet, staff, or other animals.</li>
                <li>No refund shall be provided for grooming procedures discontinued due to the pet&apos;s behavior or health condition.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">5. Pet Hotel Policies</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Standard check-in is between <strong>8:00 AM and 12:00 PM</strong>.</li>
                <li>Standard check-out is on or before <strong>12:00 PM</strong> on the departure date.</li>
                <li>Actual arrival and departure times may be recorded for operational monitoring, accommodation management, and service documentation purposes.</li>
                <li>Early or late check-in and check-out may be subject to applicable station policies and additional charges.</li>
                <li>Fur Parents are responsible for providing sufficient food, medication, and special care instructions for the duration of the stay.</li>
                <li>Pets receive feeding, exercise, and attention according to the selected accommodation package.</li>
                <li>Daily updates may be provided through the platform or designated communication channels when available.</li>
                <li>Requests to extend a stay should be communicated as early as possible and remain subject to accommodation availability.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">6. Pet Identification</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>The Fur Club utilizes a Species-Adaptive Pet Identification process to assist in verifying pet identities during service operations.</li>
                <li>Pet identification records may include dog nose print images and cat facial images collected during enrollment and identification procedures.</li>
                <li>These records are collected solely for pet identification, verification, record management, and operational purposes.</li>
                <li>Identification records are stored securely and are accessible only to authorized personnel.</li>
                <li>Pet identification records are not sold, rented, or disclosed to unauthorized third parties.</li>
                <li>Requests regarding access, correction, or deletion of pet identification records may be submitted in writing and will be evaluated in accordance with applicable legal, operational, and record-retention requirements.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">7. Health and Vaccination Requirements</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>All pets must have complete and up-to-date vaccinations appropriate for their age and species.</li>
                <li>Vaccination records must be provided during registration and updated whenever necessary.</li>
                <li>Pets showing signs of illness, contagious conditions, or severe health concerns may be refused service for the safety of other pets and personnel.</li>
                <li>If a pet becomes ill during a service, The Fur Club will attempt to contact the Fur Parent immediately.</li>
                <li>Fur Parents must disclose all known medical conditions, allergies, medications, behavioral concerns, and special care requirements before availing of services.</li>
                <li>Emergency veterinary assistance may be sought when deemed necessary for the pet&apos;s welfare.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">8. Liability and Emergencies</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>The Fur Club is not liable for complications arising from undisclosed, pre-existing, or underlying health conditions.</li>
                <li>Fur Parents acknowledge that participation in grooming, daycare, and hotel services involves inherent risks associated with normal pet activities and interactions.</li>
                <li>In the event of a medical emergency, The Fur Club will make reasonable efforts to contact the Fur Parent.</li>
                <li>If the Fur Parent cannot be reached, The Fur Club may seek veterinary care on behalf of the pet, and all resulting expenses shall be the responsibility of the Fur Parent.</li>
                <li>The Fur Club is not responsible for loss, damage, or deterioration of personal items, toys, bedding, collars, leashes, or other belongings brought by the pet.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">9. Reservations, Deposits, and Cancellations</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Service completion, payment processing, invoicing, and receipt issuance are handled through the station&apos;s designated point-of-sale and payment systems.</li>
                <li>For Pet Hotel reservations, a reservation deposit may be required to confirm the booking.</li>
                <li>Reservation deposit information recorded within the system is maintained for reservation documentation and monitoring purposes.</li>
                <li>Cancellations should be made at least twenty-four (24) hours before the scheduled service whenever possible.</li>
                <li>No-shows or same-day cancellations may be subject to cancellation charges equivalent to up to fifty percent (50%) of the booked service.</li>
                <li>Refund requests are evaluated in accordance with station policies.</li>
                <li>No refunds shall be provided for services already rendered or substantially completed.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">10. Data Privacy</h3>
              <p className="mb-2">
                The Fur Club is committed to protecting personal and pet information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and other applicable laws.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Personal information is collected and processed solely for service delivery, appointment management, record maintenance, customer communication, and operational purposes.</li>
                <li>Pet identification records, including dog nose print images and cat facial images, are collected solely for enrollment and identification purposes and are not used for commercial profiling, marketing, or automated decision-making.</li>
                <li>Reasonable administrative, technical, and organizational safeguards are implemented to protect personal and pet information from unauthorized access, disclosure, alteration, or destruction.</li>
                <li>Authorized users may request access to or correction of their personal information in accordance with applicable laws and station policies.</li>
                <li>The Fur Club will not sell, rent, or disclose personal information to unauthorized third parties except when required by law or with the owner&apos;s consent.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">11. Amendments</h3>
              <p>
                The Fur Club reserves the right to revise, modify, or update these Terms and Conditions when necessary to reflect operational, legal, or service-related changes.
              </p>
              <p className="mt-2">
                Significant updates may be communicated through the platform, website, or other official communication channels. Continued use of The Fur Club&apos;s services after such updates constitutes acceptance of the revised Terms and Conditions.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-brand-orange">12. Contact Information</h3>
              <p>For questions, concerns, or requests regarding these Terms and Conditions, please contact:</p>
              <p className="mt-2"><strong>The Fur Club</strong></p>
              <p>
                Email: <a href="mailto:connect.thefurclub@gmail.com" className="text-brand-orange underline">connect.thefurclub@gmail.com</a>
              </p>
              <p className="mt-2">Additional support may also be available through the platform&apos;s designated support channels.</p>
            </section>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onBack ?? onClose}
                className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-dark"
              >
                Back to Registration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
