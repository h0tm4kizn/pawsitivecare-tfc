import { createPortal } from 'react-dom';

const CATEGORY_OPTIONS = [
  { key: 'daycare', label: 'Pet Daycare', description: 'Safe daytime care, play, and socialization for eligible dogs.', icon: 'fa-bone', border: 'border-brand-daycare/20 hover:border-brand-daycare/40', shadow: 'hover:shadow-[0_8px_24px_rgba(251,191,36,0.3)]', iconBackground: 'bg-brand-daycare-soft', text: 'text-brand-daycare' },
  { key: 'grooming', label: 'Pet Grooming', description: 'Full grooming packages or individual Pawsome Extras.', icon: 'fa-scissors', border: 'border-brand-grooming/20 hover:border-brand-grooming/40', shadow: 'hover:shadow-[0_8px_24px_rgba(167,139,250,0.3)]', iconBackground: 'bg-brand-grooming-soft', text: 'text-brand-grooming' },
  { key: 'hotel', label: 'Pet Hotel', description: 'Overnight stays with suite selection, dates, and reservation reference.', icon: 'fa-hotel', border: 'border-brand-hotel/20 hover:border-brand-hotel/40', shadow: 'hover:shadow-[0_8px_24px_rgba(251,113,133,0.3)]', iconBackground: 'bg-brand-hotel-soft', text: 'text-brand-hotel' },
];

export default function ServiceCategoryPickerModal({ isOpen, onClose, onSelect }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div className="flex w-full max-w-3xl flex-col items-center gap-5" onClick={(event) => event.stopPropagation()}>
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-white/90">Choose Service Category</p>
          <p className="mt-1 text-xs font-medium text-white/70">Start by selecting what the customer wants to book.</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelect(option.key)}
              className={`flex min-h-[230px] flex-col items-center justify-center rounded-3xl border bg-white px-6 py-8 shadow-2xl transition-all hover:scale-[1.03] sm:min-h-[320px] sm:px-8 sm:py-14 ${option.border} ${option.shadow}`}
            >
              <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24 ${option.iconBackground}`}>
                <i className={`fa-solid ${option.icon} text-3xl sm:text-4xl ${option.text}`} />
              </div>
              <p className={`text-center text-base font-extrabold uppercase tracking-widest ${option.text}`}>{option.label}</p>
              <p className="mt-3 max-w-[210px] text-center text-xs leading-relaxed text-brand-dark-soft">{option.description}</p>
            </button>
          ))}
        </div>

        <button type="button" onClick={onClose} className="text-xs font-semibold text-white/70 transition-colors hover:text-white">Cancel</button>
      </div>
    </div>,
    document.body
  );
}
