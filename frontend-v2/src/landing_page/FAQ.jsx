import { useEffect, useState } from 'react';

const FAQS = [
  {
    category: 'Booking & Appointments',
    icon: 'fa-calendar-check',
    items: [
      {
        q: 'How do I book an appointment?',
        a: 'Log in to your account, go to your dashboard, and click "Book Now." Select your pet, choose a service (Grooming, Hotel, or Daycare), select your preferred date and time, complete any required Pet Assessment Forms, then confirm your booking.',
      },
      {
        q: 'Can I book multiple services at once?',
        a: 'No. Each service requires a separate booking to ensure proper scheduling, assessment, and service management. If your pet requires multiple services, please create a separate appointment for each service.',
      },
      {
        q: 'How far in advance can I book?',
        a: 'You may book any future date provided that the selected schedule is available. We recommend booking at least 2-3 days in advance to secure your preferred appointment slot.',
      },
      {
        q: 'Can I reschedule or cancel my appointment?',
        a: 'Yes. Approved appointments may be rescheduled or cancelled through your dashboard under "Upcoming Appointments," subject to PawsitiveCare scheduling and cancellation policies.',
      },
      {
        q: 'What happens if I miss my appointment?',
        a: 'Missed appointments will remain recorded in your appointment history. If you are unable to attend your scheduled appointment, please contact PawsitiveCare as soon as possible so our staff can assist you with rescheduling.',
      },
      {
        q: 'Why is my appointment still pending?',
        a: 'Pending appointments are currently under review by station personnel. You will be notified once the appointment has been approved, declined, or requires additional information.',
      },
      {
        q: 'Can I book an appointment for multiple pets?',
        a: 'Yes. Depending on the selected service, multiple pets registered under your account may be included in a booking, subject to service-specific limitations.',
      },
    ],
  },
  {
    category: 'Pet Assessment Forms',
    icon: 'fa-notes-medical',
    items: [
      {
        q: 'Why do I need to fill out the assessment form for every appointment?',
        a: "Your pet's health, behavior, and condition may change over time. Completing a Pet Assessment Form before every appointment helps ensure that your pet is fit for service, properly vaccinated, and safe to interact with staff and other pets.",
      },
      {
        q: "What happens if my pet's assessment form is incomplete?",
        a: 'Booking cannot proceed until all required Pet Assessment Forms have been completed.',
      },
      {
        q: 'Why was my booking rejected after submitting an assessment form?',
        a: 'For the safety of pets and staff, bookings may be declined if the assessment form indicates health concerns, incomplete vaccination records, aggressive behavior, active tick or flea infestations, or other conditions requiring further review by station personnel.',
      },
    ],
  },
  {
    category: 'Pet Registration',
    icon: 'fa-id-card',
    items: [
      {
        q: 'Why does my pet need to be registered in the system?',
        a: 'Registering your pet helps maintain accurate records, appointment history, vaccination information, identification records, and service history. This allows PawsitiveCare to provide safer and more organized service management.',
      },
      {
        q: 'Can I register more than one pet?',
        a: 'Yes. You may register multiple pets under a single account. Each pet maintains its own profile, service history, appointment records, and assessment records.',
      },
      {
        q: "Can I edit my pet's information later?",
        a: "Yes. You may update your pet's profile information whenever necessary through your dashboard.",
      },
    ],
  },
  {
    category: 'Pet Identification',
    icon: 'fa-paw',
    items: [
      {
        q: 'What is nose print identification for dogs?',
        a: "Similar to human fingerprints, every dog's nose pattern is unique. The system uses images of a dog's nose to assist staff in verifying identity during service operations, helping reduce the risk of pet misidentification.",
      },
      {
        q: 'What is facial recognition for cats?',
        a: "The system uses image-based facial identification to assist staff in verifying a cat's identity using its unique facial features. This provides an additional layer of verification during service operations and record management.",
      },
      {
        q: 'Is Pet Identification required for all pets?',
        a: 'Pet Identification enrollment is available to support identity verification during service operations. Dogs may be enrolled using nose print images, while cats may be enrolled using facial images. To maintain image quality and identification reliability, enrollment is performed by authorized station personnel using designated image capture procedures.',
      },
      {
        q: 'Will my pet be identified automatically every visit?',
        a: "Not necessarily. Pet Identification serves as a verification tool that may be used by station personnel when needed to assist in confirming a pet's identity during check-in, service operations, or record validation. The identification process serves as an additional layer of verification and does not replace standard operational procedures.",
      },
      {
        q: "Why can't I enroll my pet's identification images myself?",
        a: 'To maintain identification accuracy, consistency, and image quality, Pet Identification enrollment is performed only by authorized station personnel. Standardized image capture procedures help ensure that dog nose print images and cat facial images meet the quality requirements necessary for reliable identification and matching.',
      },
    ],
  },
  {
    category: 'Grooming',
    icon: 'fa-scissors',
    items: [
      {
        q: 'What grooming services do you offer?',
        a: "We offer a range of grooming packages tailored to your pet's size and breed, including bathing, blow drying, nail trimming, ear cleaning, haircuts, and styling services.",
      },
      {
        q: 'How long does a grooming session take?',
        a: "Grooming sessions typically take between 1-3 hours depending on your pet's size, breed, coat condition, behavior, and selected package.",
      },
      {
        q: 'Do I need to book in advance for grooming?',
        a: 'Yes. We recommend booking in advance to secure your preferred appointment slot.',
      },
      {
        q: 'What size packages are available for grooming?',
        a: 'Grooming packages are available by pet size: Small, Medium, Large, Extra Large, and Cat/Kitten. Pricing varies according to package and size category.',
      },
      {
        q: 'Can I request a specific groomer?',
        a: 'You may indicate your preferred groomer through the special instructions section during booking. Requests remain subject to staff availability.',
      },
      {
        q: 'Will pets with ticks or fleas be accepted?',
        a: 'No. For the safety of all pets, animals with active tick or flea infestations may not be accepted for Grooming, Daycare, or Hotel services until proper treatment has been completed. Ticks and fleas can spread quickly to other pets and facility areas. If ticks or fleas are discovered during check-in, staff may recommend treatment before rescheduling the appointment.',
      },
    ],
  },
  {
    category: 'Hotel',
    icon: 'fa-hotel',
    items: [
      {
        q: 'How many nights can my pet stay at the hotel?',
        a: 'There is no fixed maximum stay duration. Hotel reservations and stay extensions are subject to accommodation availability and approval by PawsitiveCare.',
      },
      {
        q: "Can I extend my pet's hotel stay?",
        a: 'Yes. Hotel stay extensions may be requested through station personnel. Approval depends on accommodation availability and operational considerations.',
      },
      {
        q: 'Can two pets share a hotel accommodation?',
        a: 'No. Each hotel accommodation is assigned to one pet only to ensure proper monitoring, comfort, welfare, and record management.',
      },
      {
        q: 'What happens if I cannot pick up my pet on time?',
        a: 'Please contact PawsitiveCare immediately. Staff will review available accommodation options and determine appropriate arrangements based on current capacity and operational policies.',
      },
      {
        q: 'What should I bring for a hotel stay?',
        a: 'Please bring vaccination records, medications, feeding instructions, and any comfort items such as toys, blankets, or bedding that may help your pet feel comfortable during their stay.',
      },
    ],
  },
  {
    category: 'Daycare',
    icon: 'fa-bone',
    items: [
      {
        q: 'How many pets can I include in a daycare booking?',
        a: 'A daycare booking may include up to three pets provided that all selected pets belong to the same owner or household.',
      },
      {
        q: 'Can I book daycare for only one pet?',
        a: 'Yes. Daycare bookings may include one, two, or three pets.',
      },
      {
        q: 'Can multiple owners share the same daycare booking?',
        a: 'No. The daycare area is reserved exclusively for the selected owner and their registered pets during the booked schedule.',
      },
      {
        q: "Why can't I book daycare for my selected schedule?",
        a: 'The daycare area may already be reserved during the selected schedule or may be unavailable for operational reasons.',
      },
      {
        q: "What's the difference between daycare half-day and full-day?",
        a: "Half-day daycare covers either a morning or afternoon session, while full-day daycare covers the station's full operating hours.",
      },
    ],
  },
  {
    category: 'Account & Security',
    icon: 'fa-shield-halved',
    items: [
      {
        q: 'What if I forget my password?',
        a: 'You may use the Forgot Password feature on the login page to request a password reset link through your registered email address.',
      },
      {
        q: 'Why am I being asked for a verification code when logging in?',
        a: 'PawsitiveCare uses Two-Factor Authentication (2FA) to improve account security through Email OTP and Google Authenticator verification.',
      },
    ],
  },
  {
    category: 'History & Records',
    icon: 'fa-clock-rotate-left',
    items: [
      {
        q: "Can I view my pet's appointment history?",
        a: 'Yes. Appointment history, service records, and completed appointments can be viewed from your dashboard.',
      },
      {
        q: "Can I view my pet's previous services?",
        a: 'Yes. Service history is maintained for each registered pet and may be viewed through your account.',
      },
    ],
  },
  {
    category: 'Contact Information',
    icon: 'fa-phone',
    items: [
      {
        q: 'How do I contact PawsitiveCare?',
        a: 'Phone: 0976 065 8031. Location: 207 F. Blumentritt Street, Kabayanan, San Juan City, 1550. You may also use the Contact Us page available within the platform for inquiries and assistance.',
      },
    ],
  },
];

function FAQItem({ q, a, open, onToggle }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-[0_4px_14px_rgba(23,53,81,0.05)] transition-all ${open ? 'border-brand-teal' : 'border-brand-dark-light'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left md:gap-4 md:px-5 md:py-4"
      >
        <span className="text-sm font-semibold leading-snug text-brand-dark">{q}</span>
        <i className={`fa-solid fa-chevron-down text-xs shrink-0 transition-transform ${open ? 'rotate-180 text-brand-teal' : 'text-brand-dark-soft'}`} />
      </button>
      {open && (
        <div className="border-t border-brand-dark-light border-l-4 border-l-brand-teal px-4 pb-4 text-sm leading-relaxed text-brand-dark md:px-5">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [openItemIndex, setOpenItemIndex] = useState(null);

  useEffect(() => {
    setOpenItemIndex(null);
  }, [activeCategory]);

  return (
    <section id="faq" className="w-full scroll-mt-24 bg-white px-4 py-12 md:px-12 md:py-16 lg:px-24">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8 text-center md:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-dark mb-4">
            <i className="fa-solid fa-paw" /> FAQ
          </span>
          <h2 className="text-2xl font-extrabold leading-tight text-brand-dark md:text-4xl">
            Frequently Asked <span className="text-brand-orange">Questions</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-dark-soft">
            Everything you need to know about booking, services, security, and pet care at PawsitiveCare.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="grid grid-cols-2 gap-2 lg:flex lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
            {FAQS.map((cat, i) => (
              <button
                key={cat.category}
                type="button"
                onClick={() => setActiveCategory(i)}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold leading-snug transition-colors lg:px-4 lg:py-3 ${
                  activeCategory === i
                    ? 'bg-brand-teal text-white shadow-sm'
                    : 'bg-white border border-brand-dark-light text-brand-dark hover:bg-brand-teal/40 hover:text-brand-dark hover:border-brand-teal/50'
                }`}
              >
                <i className={`fa-solid ${cat.icon} text-sm ${activeCategory === i ? 'text-white' : 'text-brand-orange'}`} />
                <span>{cat.category}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3">
            {FAQS[activeCategory].items.map((item, index) => (
              <FAQItem
                key={item.q}
                q={item.q}
                a={item.a}
                open={openItemIndex === index}
                onToggle={() => setOpenItemIndex((prev) => (prev === index ? null : index))}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
