import { createPortal } from 'react-dom';
import { Facebook, X } from 'lucide-react';
import { FUR_CLUB } from './furClubConstants';

export default function FurClubInfoModal({ isOpen, onClose }) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen"
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-sm font-poppins overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-brand-teal">
          <div className="flex items-center gap-2">
            <img src="/assets/paw-teal.webp" alt="" className="h-5 w-5 object-contain brightness-0 invert" />
            <h2 className="text-white font-bold text-sm tracking-wide">The Fur Club</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-2.5">
          {/* Store name */}
          <div className="flex items-center gap-3 rounded-xl bg-brand-teal/5 border border-brand-teal/15 px-4 py-3">
            <i className="fa-solid fa-store text-brand-teal text-sm w-4 text-center shrink-0" />
            <p className="text-sm font-semibold text-brand-dark">{FUR_CLUB.name}</p>
          </div>

          {/* Address — clickable to Google Maps */}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FUR_CLUB.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 rounded-xl bg-brand-teal/5 border border-brand-teal/15 px-4 py-3 hover:bg-brand-teal/10 transition-colors group"
          >
            <i className="fa-solid fa-location-dot text-brand-teal text-sm w-4 text-center shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-brand-dark group-hover:text-brand-teal transition-colors">{FUR_CLUB.address}</p>
              <p className="text-[11px] text-brand-teal mt-0.5 font-medium">Open in Google Maps ↗</p>
            </div>
          </a>

          {/* Phone */}
          <a
            href={`tel:${FUR_CLUB.phone.replace(/\s/g, '')}`}
            className="flex items-center gap-3 rounded-xl bg-brand-teal/5 border border-brand-teal/15 px-4 py-3 hover:bg-brand-teal/10 transition-colors group"
          >
            <i className="fa-solid fa-phone text-brand-teal text-sm w-4 text-center shrink-0" />
            <p className="text-sm text-brand-dark group-hover:text-brand-teal transition-colors">{FUR_CLUB.phone}</p>
          </a>

          {/* Email */}
          <a
            href={`mailto:${FUR_CLUB.email}`}
            className="flex items-center gap-3 rounded-xl bg-brand-teal/5 border border-brand-teal/15 px-4 py-3 hover:bg-brand-teal/10 transition-colors group"
          >
            <i className="fa-solid fa-envelope text-brand-teal text-sm w-4 text-center shrink-0" />
            <p className="text-sm text-brand-dark group-hover:text-brand-teal transition-colors">{FUR_CLUB.email}</p>
          </a>

          {/* Facebook */}
          {FUR_CLUB.socials.map(({ label, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl bg-brand-teal/5 border border-brand-teal/15 px-4 py-3 hover:bg-brand-teal/10 transition-colors group"
            >
              <div className="w-4 text-center shrink-0">
                <Facebook size={15} className="text-brand-teal" />
              </div>
              <p className="text-sm text-brand-dark group-hover:text-brand-teal transition-colors">{label}</p>
            </a>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
