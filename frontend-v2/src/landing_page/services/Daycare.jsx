import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import ServicePreFooter from './ServicePreFooter';
import LoginModal from '../LoginModal';
import Register from '../Register';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../api/apiClient';
import { buildDaycarePricingRows, filterServicesByCategory, getStartingPrice, getTiers } from './serviceCatalogUtils';

const HIGHLIGHTS = [
  { icon: 'fa-clock',         label: 'Flexible Sessions' },
  { icon: 'fa-shield-dog',    label: 'Supervised Care' },
  { icon: 'fa-futbol',        label: 'Supervised Playtime' },
  { icon: 'fa-house-chimney', label: 'Safe Environment' },
];

const FALLBACK_PRICING_ROWS = [
  {
    session: 'Hourly',
    icon: 'fa-clock',
    small: 'PHP 80',
    medium: 'PHP 80',
    large: 'PHP 100',
    xlarge: 'PHP 110',
  },
  {
    session: 'Half Day Package',
    icon: 'fa-sun',
    small: 'PHP 250',
    medium: 'PHP 300',
    large: 'PHP 350',
    xlarge: 'PHP 400',
  },
  {
    session: 'Full Day Package',
    icon: 'fa-moon',
    small: 'PHP 500',
    medium: 'PHP 600',
    large: 'PHP 700',
    xlarge: 'PHP 800',
    highlight: true,
  },
];

const GALLERY_PHOTOS = [
  { src: '/assets/img_thefurclub/Image_119.webp', alt: 'Dogs playing in daycare' },
  { src: '/assets/img_thefurclub/Image_58.webp', alt: 'Staff playing with pets' },
  { src: '/assets/img_thefurclub/Image_45.webp', alt: 'Daycare play area' },
];

function GalleryPhoto({ src, alt }) {
  const [err, setErr] = useState(false);
  return (
    <div className="aspect-square rounded-2xl overflow-hidden bg-brand-daycare/10 flex items-center justify-center">
      {err ? (
        <div className="flex flex-col items-center justify-center gap-2 text-brand-daycare/30 p-4 text-center">
          <i className="fa-regular fa-image text-4xl" />
          <span className="text-xs font-semibold">Photo coming soon</span>
        </div>
      ) : (
        <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setErr(true)} />
      )}
    </div>
  );
}

export default function Daycare() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [daycareServices, setDaycareServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);


  useEffect(() => {
    let disposed = false;

    apiFetch('/api/services/catalog')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Unable to load service catalog'))))
      .then((data) => {
        if (disposed) return;
        const catalog = Array.isArray(data?.data) ? data.data : [];
        setDaycareServices(filterServicesByCategory(catalog, 'daycare'));
      })
      .catch(() => {
        if (!disposed) setDaycareServices([]);
      })
      .finally(() => {
        if (!disposed) setLoadingServices(false);
      });

    return () => { disposed = true; };
  }, []);

  const pricingRows = buildDaycarePricingRows(daycareServices);
  const displayPricingRows = pricingRows.length ? pricingRows : FALLBACK_PRICING_ROWS;
  const startingPrice = getStartingPrice(daycareServices.flatMap((service) => getTiers(service).map((tier) => tier?.price))) || 80;
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

      {/* HERO */}
      <section className="relative w-full h-[360px] sm:h-[420px] md:h-[520px] flex items-center justify-center overflow-hidden">
        <img
          src="/assets/img_thefurclub/Image_16.webp"
          alt="Pet Daycare"
          className="absolute inset-0 w-full h-full object-cover object-[30%_center] sm:object-center"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-daycare/95 via-brand-daycare/70 to-brand-dark/70" />
        <div className="relative z-10 text-center px-4 sm:px-6">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-5">
            <i className="fa-solid fa-bone text-white text-xl sm:text-2xl" />
          </div>
          <h1
            className="font-bauhaus font-extrabold text-3xl sm:text-4xl md:text-6xl text-white mb-3"
            style={{ textShadow: '0 2px 5px rgba(0, 0, 0, 0.34)' }}
          >
            Pet Daycare
          </h1>
          <p className="text-white/85 text-sm sm:text-base md:text-lg max-w-md mx-auto leading-relaxed">
            A safe, fun space for your pet while you're away.
          </p>
          <p className="mt-3 text-white/60 text-xs font-semibold tracking-widest uppercase">
            Starting at PHP {startingPrice.toLocaleString()} - Hourly, Half Day &amp; Full Day
          </p>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="bg-brand-daycare-soft py-8 sm:py-10 px-4 sm:px-6 md:px-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-daycare shadow-md flex items-center justify-center">
                <i className={`fa-solid ${h.icon} text-white text-lg sm:text-xl`} />
              </div>
              <span className="text-brand-dark font-semibold text-xs sm:text-sm">{h.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 md:px-12 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="font-bauhaus text-brand-daycare text-xs tracking-widest uppercase text-center mb-2">Pricing</p>
          <h2 className="font-bauhaus font-extrabold text-2xl sm:text-3xl md:text-4xl text-brand-dark text-center mb-3">
            Session Rates
          </h2>
          <p className="text-center text-brand-dark-soft text-sm mb-8 sm:mb-12 max-w-xl mx-auto">
            Choose a session that fits your schedule. Hourly rates are charged per hour, while half-day and full-day rates are per session.
          </p>
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-brand-daycare">Exact rates by pet size - managed from the Admin service catalog</p>

          {loadingServices && (
            <p className="mb-4 text-center text-xs font-semibold text-brand-dark-soft">Refreshing latest Admin rates...</p>
          )}

          <div className="grid gap-4 sm:hidden">
            {displayPricingRows.map((row) => (
              <button
                key={row.session}
                type="button"
                onClick={() => setIsLoginOpen(true)}
                className="rounded-2xl border-2 border-brand-dark-light bg-white p-4 text-left shadow-md"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-brand-dark">
                    <i className={`fa-solid ${row.icon} text-brand-daycare text-xs`} />
                    <span className="whitespace-nowrap">{row.session}</span>
                  </div>
                  {row.highlight && (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-orange px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Best Value
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Small', row.small],
                    ['Medium', row.medium],
                    ['Large', row.large],
                    ['XLarge', row.xlarge],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-brand-daycare-soft px-3 py-2">
                      <p className="font-semibold text-brand-dark-soft">{label}</p>
                      <p className="mt-0.5 font-extrabold text-brand-dark">{value}</p>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-3xl border-2 border-brand-dark-light shadow-md sm:block">
            <div className="min-w-[760px]">
              {/* Table header */}
              <div className="grid grid-cols-[minmax(260px,1.55fr)_repeat(4,minmax(110px,1fr))] bg-brand-daycare text-white text-center text-sm font-bold py-4 px-6">
                <span className="pl-8 text-left">Session</span>
                <span>Small</span>
                <span>Medium</span>
                <span>Large</span>
                <span>XLarge</span>
              </div>

              {/* Rows */}
              {displayPricingRows.map((row, i) => (
                <button
                  key={row.session}
                  type="button"
                  onClick={() => setIsLoginOpen(true)}
                  className={`group w-full grid grid-cols-[minmax(260px,1.55fr)_repeat(4,minmax(110px,1fr))] items-center text-center py-5 px-6 gap-3 transition-all cursor-pointer hover:bg-brand-daycare-soft ${
                    row.highlight
                      ? 'bg-white'
                      : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                  }`}
                >
                  <div className="flex min-w-0 items-center justify-start gap-2 pl-8 font-bold text-brand-dark group-hover:text-brand-daycare text-sm">
                    <i className={`fa-solid ${row.icon} text-brand-dark group-hover:text-brand-daycare text-xs`} />
                    <span className="whitespace-nowrap">{row.session}</span>
                    {row.highlight && (
                      <span className="ml-1 shrink-0 whitespace-nowrap text-[9px] bg-brand-orange text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide transition-colors">
                        Best Value
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-brand-dark group-hover:text-brand-daycare">
                    {row.small}
                  </span>
                  <span className="text-sm font-semibold text-brand-dark group-hover:text-brand-daycare">
                    {row.medium}
                  </span>
                  <span className="text-sm font-semibold text-brand-dark group-hover:text-brand-daycare">
                    {row.large}
                  </span>
                  <span className="text-sm font-semibold text-brand-dark group-hover:text-brand-daycare">
                    {row.xlarge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-brand-dark-soft text-xs mt-6">
            * Rates are per pet. Multi-pet discounts available — ask us when booking.
          </p>
        </div>
      </section>

      {/* GALLERY */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-12 bg-gradient-to-b from-brand-daycare-soft to-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bauhaus font-extrabold text-2xl md:text-3xl text-brand-dark text-center mb-10">
            A Day at The Fur Club
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {GALLERY_PHOTOS.map((p) => (
              <GalleryPhoto key={p.src} src={p.src} alt={p.alt} />
            ))}
          </div>
        </div>
      </section>

      <ServicePreFooter accent="daycare" />

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
