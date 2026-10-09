import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import ServicePreFooter from './ServicePreFooter';
import LoginModal from '../LoginModal';
import Register from '../Register';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../api/apiClient';
import { buildGroomingPackageCards, filterServicesByCategory } from './serviceCatalogUtils';

const HIGHLIGHTS = [
  { icon: 'fa-shower',          label: 'Bath & Blowdry' },
  { icon: 'fa-scissors',        label: 'Expert Trimming' },
  { icon: 'fa-hand-sparkles',   label: 'Nail & Ear Care' },
  { icon: 'fa-dog',             label: 'Dogs & Cats' },
];

const PACKAGES = [
  {
    name: 'Fresh me up',
    desc: 'Relaxing bath & blow dry, signature shampoo, and pet safe cologne.',
    range: 'PHP 450 - PHP 1,250',
    icon: 'fa-droplet',
  },
  {
    name: 'Tidy up',
    desc: 'Relaxing bath & blow dry with signature shampoo, nail trim, ear cleaning with gentle hair removal, and pet safe cologne.',
    range: 'PHP 350 - PHP 1,150',
    icon: 'fa-scissors',
  },
  {
    name: 'Glow up',
    desc: 'Relaxing bath & blow dry with signature shampoo, nail trim, ear cleaning with gentle hair removal, sanitary trim, paw pad trim, fresh and cool shaved, summer cut fresh groom, and pet safe cologne.',
    range: 'PHP 450 - PHP 1,250',
    icon: 'fa-star',
  },
  {
    name: 'Glam up',
    desc: 'Relaxing bath & blow dry with signature shampoo, nail trim, ear cleaning with gentle hair removal, sanitary trim, fresh and cool shaved, summer cut fresh groom, styled haircut, paw balm treatment, organic fur serum for a silky finish, and pet safe cologne.',
    range: 'PHP 550 - PHP 1,450',
    icon: 'fa-wand-magic-sparkles',
  },
];

const PACKAGE_ICONS = {
  'Fresh me up': 'fa-droplet',
  'Tidy up': 'fa-scissors',
  'Glow up': 'fa-star',
  'Glam up': 'fa-wand-magic-sparkles',
};

const CURRENCY_LABEL = 'PHP ';

const SIZE_RANGE_MAP = {
  S: 'up to 5kg',
  M: '6-10kg',
  L: '11-15kg',
  XL: '15-20kg',
  XXL: '20kg up',
  GIANT: '20kg up',
  KITTEN: 'feline kitten',
};

function formatTierSizeLabel(rawLabel) {
  const label = String(rawLabel || '').trim();
  if (!label) return 'N/A';
  const normalized = label.toUpperCase();
  if (normalized === 'CAT') return 'CAT (feline size)';
  const sizeRange = SIZE_RANGE_MAP[normalized];
  if (sizeRange) return `${normalized} (${sizeRange})`;
  return label;
}

const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', 'GIANT', 'KITTEN', 'CAT', 'STANDARD'];

const formatTierPrice = (tier) => {
  const price = Number(tier?.price || 0).toLocaleString();
  const priceMax = tier?.price_max ? Number(tier.price_max).toLocaleString() : null;
  return priceMax ? `${CURRENCY_LABEL}${price} - ${CURRENCY_LABEL}${priceMax}` : `${CURRENCY_LABEL}${price}`;
};

function PricingTable({ services, onBook }) {
  // Build a sorted list of all unique sizes across all packages
  const allSizes = [...new Set(
    services.flatMap((s) => (s.tiers ?? s.service_tiers ?? []).map((t) => String(t.size_label).trim().toUpperCase()))
  )].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a);
    const bi = SIZE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Build a lookup: packageId ? sizeLabel ? price
  const priceMap = {};
  services.forEach((svc) => {
    priceMap[svc.id] = {};
    (svc.tiers ?? svc.service_tiers ?? []).forEach((t) => {
      priceMap[svc.id][String(t.size_label).trim().toUpperCase()] = t;
    });
  });

  return (
    <div className="space-y-4">
      {/* -- MOBILE: stacked cards -- */}
      <div className="md:hidden space-y-4">
        {services.map((svc) => {
          const icon = PACKAGE_ICONS[svc.name] || 'fa-paw';
          const tiers = svc.tiers ?? svc.service_tiers ?? [];
          return (
            <div key={svc.id} className="rounded-2xl bg-white border border-brand-grooming/15 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 bg-brand-grooming px-5 py-3">
                <i className={`fa-solid ${icon} text-white text-sm`} />
                <span className="font-bold text-white text-sm uppercase tracking-wide">{svc.name}</span>
              </div>
              <div className="divide-y divide-brand-grooming/10">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-xs font-bold text-brand-dark">{String(tier.size_label).trim().toUpperCase()}</span>
                    <span className="text-sm font-extrabold text-brand-grooming">{formatTierPrice(tier)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* -- DESKTOP: comparison table -- */}
      <div className="hidden md:block rounded-2xl bg-white border border-brand-grooming/15 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="bg-brand-grooming">
                <th className="py-4 pl-6 pr-4 text-left text-white font-bold text-xs uppercase tracking-wide w-24">Size</th>
                {services.map((svc) => (
                  <th key={svc.id} className="py-4 px-4 text-center text-white font-bold text-xs uppercase tracking-wide">
                    <i className={`fa-solid ${PACKAGE_ICONS[svc.name] || 'fa-paw'} mr-1.5`} />
                    {svc.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSizes.map((size, i) => (
                <tr key={size} className={i % 2 === 0 ? 'bg-white' : 'bg-brand-grooming-soft/30'}>
                  <td className="py-3.5 pl-6 pr-4 font-bold text-brand-dark text-xs">{size}</td>
                  {services.map((svc) => {
                    const tier = priceMap[svc.id][size];
                    return (
                      <td key={svc.id} className="py-3.5 px-4 text-center font-extrabold text-brand-grooming text-sm">
                        {tier ? formatTierPrice(tier) : <span className="text-brand-dark-soft font-normal">-</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-brand-grooming/10 bg-brand-grooming-soft/30">
          <p className="text-xs text-brand-dark-soft">
            <span className="font-semibold text-brand-dark">Size guide:</span>{' '}
            S (up to 5kg) - M (6-10kg) - L (11-15kg) - XL (15-20kg) - XXL (20kg+) - CAT (feline)
          </p>
        </div>
      </div>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onBook}
          className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full bg-brand-grooming text-white font-bold text-sm hover:brightness-95 transition-all hover:-translate-y-0.5 shadow-md"
        >
          <i className="fa-solid fa-calendar-check" />
          Book an Appointment
        </button>
      </div>
    </div>
  );
}

const GALLERY_PHOTOS = [
  { src: '/assets/img_thefurclub/Image_34.webp', alt: 'Dog grooming session' },
  { src: '/assets/img_thefurclub/Image_115.webp', alt: 'Professional groomer at work' },
  { src: '/assets/img_thefurclub/Image_59.webp', alt: 'Freshly groomed pet' },
];

function GalleryPhoto({ src, alt }) {
  const [err, setErr] = useState(false);
  return (
    <div className="aspect-square rounded-2xl overflow-hidden bg-brand-grooming/20 flex items-center justify-center">
      {err ? (
        <div className="flex flex-col items-center justify-center gap-2 text-brand-grooming/30 p-4 text-center">
          <i className="fa-regular fa-image text-4xl" />
          <span className="text-xs font-semibold">Photo coming soon</span>
        </div>
      ) : (
        <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setErr(true)} />
      )}
    </div>
  );
}

export default function Grooming() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [groomingServices, setGroomingServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    apiFetch('/api/services/catalog')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Unable to load service catalog'))))
      .then((data) => {
        const all = Array.isArray(data.data) ? data.data : [];
        setGroomingServices(filterServicesByCategory(all, 'grooming'));
      })
      .catch(() => {})
      .finally(() => setLoadingServices(false));
  }, []);

  const packageCards = buildGroomingPackageCards(groomingServices, PACKAGES);

  const handleLogin = ({ token, user, remember }) => {
    login({ token, user, remember });
    setIsLoginOpen(false);
    navigate('/');
  };

  const handleNavigation = (target) => {
    if (target === 'home' || !target) {
      navigate('/');
    } else {
      navigate(`/#${target}`);
    }
  };

  return (
    <div className="min-h-screen bg-white font-poppins">

      <Header 
        onOpenLogin={() => setIsLoginOpen(true)} 
        onOpenRegister={() => setIsRegisterOpen(true)} 
        onNavigate={handleNavigation}
      />

      {/* -- HERO -- */}
      <section className="relative w-full h-[360px] sm:h-[420px] md:h-[520px] flex items-center justify-center overflow-hidden">
        <img
          src="/assets/img_thefurclub/Image_26.webp"
          alt="Pet Grooming"
          className="absolute inset-0 w-full h-full object-cover object-[30%_center] sm:object-center"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-grooming/95 via-brand-grooming/75 to-brand-dark/70" />
        <div className="relative z-10 text-center px-4 sm:px-6">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-5">
            <i className="fa-solid fa-scissors text-white text-xl sm:text-2xl" />
          </div>
          <h1
            className="font-bauhaus font-extrabold text-3xl sm:text-4xl md:text-6xl text-white mb-3"
            style={{ textShadow: '0 2px 5px rgba(0, 0, 0, 0.34)' }}
          >
            Pet Grooming
          </h1>
          <p className="text-white/85 text-sm sm:text-base md:text-lg max-w-md mx-auto leading-relaxed">
            From fresh to fabulous - one appointment at a time.
          </p>
          <p className="mt-3 text-white/60 text-xs font-semibold tracking-widest uppercase">
            Starting at PHP 350 - Dogs &amp; Cats
          </p>
        </div>
      </section>

      {/* -- HIGHLIGHTS -- */}
      <section className="bg-brand-grooming-soft py-8 sm:py-10 px-4 sm:px-6 md:px-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-grooming shadow-md flex items-center justify-center">
                <i className={`fa-solid ${h.icon} text-white text-lg sm:text-xl`} />
              </div>
              <span className="text-brand-dark font-semibold text-xs sm:text-sm">{h.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* -- PRICING OVERVIEW -- */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 md:px-12 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="font-bauhaus text-brand-grooming text-xs tracking-widest uppercase text-center mb-2">Packages</p>
          <h2 className="font-bauhaus font-extrabold text-2xl sm:text-3xl md:text-4xl text-brand-dark text-center mb-3">
            Choose Your Package
          </h2>
          <p className="text-center text-brand-dark-soft text-sm mb-8 sm:mb-12 max-w-xl mx-auto">
            All packages are available for dogs and cats. Pricing varies by pet size (XS to XL).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {packageCards.map((pkg) => (
              <button
                key={pkg.id || pkg.name}
                type="button"
                onClick={() => setIsLoginOpen(true)}
                className="group rounded-3xl p-5 sm:p-6 flex flex-col items-center text-center shadow-md border-2 border-brand-dark-light bg-white transition-all hover:shadow-xl sm:hover:-translate-y-1 hover:bg-brand-purple hover:border-brand-purple cursor-pointer w-full"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-grooming-soft flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
                  <i className={`fa-solid ${pkg.icon} text-lg text-brand-grooming group-hover:text-white transition-colors`} />
                </div>
                <h3 className="font-bauhaus font-extrabold text-xl mb-2 text-brand-dark group-hover:text-white transition-colors">
                  {pkg.name}
                </h3>
                <p className="text-xs leading-relaxed mb-5 flex-grow text-brand-dark-soft group-hover:text-white/75 transition-colors">
                  {pkg.desc}
                </p>
                <div className="w-full pt-4 border-t border-brand-dark-light group-hover:border-white/20 text-sm font-bold text-brand-grooming group-hover:text-white transition-colors">
                  {pkg.range}
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-brand-dark-soft text-xs mt-8">
            * Prices vary by pet size. Contact us for exact pricing based on your pet's breed and coat type.
          </p>
        </div>
      </section>

      {/* -- FULL PRICING LIST -- */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 md:px-12 bg-brand-grooming-soft">
        <div className="w-full">
          <p className="font-bauhaus text-brand-grooming text-xs tracking-widest uppercase text-center mb-2">Detailed Pricing</p>
          <h2 className="font-bauhaus font-extrabold text-2xl sm:text-3xl md:text-4xl text-brand-dark text-center mb-3">
            Full Pricing List
          </h2>
          <p className="text-center text-brand-dark-soft text-sm mb-8 max-w-xl mx-auto">
            Exact rates per package and pet size. All prices are per session.
          </p>

          {loadingServices ? (
            <div className="flex justify-center py-16">
              <div className="w-9 h-9 rounded-full border-4 border-brand-grooming border-t-transparent animate-spin" />
            </div>
          ) : groomingServices.length === 0 ? (
            <p className="text-center text-brand-dark-soft text-sm py-10">No pricing available at the moment.</p>
          ) : (
            <>
              <PricingTable services={groomingServices} onBook={() => setIsLoginOpen(true)} />
              <p className="text-xs text-brand-dark-soft italic mt-4 text-center">
                * Prices per session. May vary by breed and coat condition.
              </p>
            </>
          )}
        </div>
      </section>

      {/* -- GALLERY -- */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-12 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bauhaus font-extrabold text-2xl md:text-3xl text-brand-dark text-center mb-10">
            See the Results
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {GALLERY_PHOTOS.map((p) => (
              <GalleryPhoto key={p.src} src={p.src} alt={p.alt} />
            ))}
          </div>
        </div>
      </section>

      <ServicePreFooter accent="grooming" />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
        onOpenRegister={() => { setIsLoginOpen(false); setIsRegisterOpen(true); }}
        onForgotPassword={() => setIsLoginOpen(false)}
      />
      <Register
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSwitchToLogin={() => { setIsRegisterOpen(false); setIsLoginOpen(true); }}
        onRegisterSuccess={handleLogin}
      />

    </div>
  );
}
