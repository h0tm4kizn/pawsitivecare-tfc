import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

// Colors match SERVICE_CATEGORY_COLORS in ServicePage.jsx
// grooming: #a78bfa  |  hotel: #fb7185  |  daycare: #fbbf24
const REMINDERS = [
  {
    icon: 'fa-solid fa-syringe',
    hex: '#fb7185',
    title: 'Rabies Vaccination Required for Pet Daycare and Pet Hotel',
    body: 'Rabies vaccination is required for Pet Daycare and Pet Hotel bookings. Please ensure your pet is up-to-date before booking these services.',
  },
  {
    icon: 'fa-solid fa-bug',
    hex: '#fbbf24',
    title: 'Flea & Tick-Free, Please!',
    body: "Your pet should be free of fleas and ticks on the day of their appointment. If we spot any, we'll need to reschedule to protect all the other furry guests.",
  },
  {
    icon: 'fa-solid fa-hotel',
    hex: '#fb7185',
    title: 'Hotel Stays Need a Deposit',
    body: 'A 50% deposit (DP) is required to secure hotel/boarding reservations. This will be settled at check-in.',
  },
  {
    icon: 'fa-regular fa-clock',
    hex: '#a78bfa',
    title: '15-Minute Grace Period',
    body: "We hold your slot for up to 15 minutes past your scheduled time. If you're running late, give us a heads-up so we can do our best to accommodate you!",
  },
];

export default function BookingReminderModal({ isOpen, category, onContinue, onClose }) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  const cat = (category || '').toLowerCase();
  const visibleReminders = REMINDERS.filter((r) =>
    !r.categories || r.categories.includes(cat) || !cat
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-brand-teal px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-paw text-white text-lg" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Before You Book</p>
            <p className="text-white/70 text-[11px] mt-0.5">A few friendly reminders for your fur baby&apos;s visit</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Reminder cards */}
        <div className="px-4 py-3 space-y-2.5 overflow-y-auto max-h-[60vh] scrollbar-teal">
          {visibleReminders.map((r) => (
            <div
              key={r.title}
              className="flex gap-3 rounded-xl px-3.5 py-3"
              style={{
                backgroundColor: `${r.hex}14`,
                border: `1px solid ${r.hex}40`,
              }}
            >
              <div
                className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${r.hex}25` }}
              >
                <i className={`${r.icon} text-sm`} style={{ color: r.hex }} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold leading-snug" style={{ color: r.hex }}>
                  {r.title}
                </p>
                <p className="text-[11px] text-brand-dark-soft mt-0.5 leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl bg-brand-teal py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-teal/90 active:scale-[0.98] transition-all"
          >
            Got it, let&apos;s book! <i className="fa-solid fa-arrow-right ml-1.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-brand-dark-soft hover:text-brand-dark transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
