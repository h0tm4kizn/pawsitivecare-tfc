import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import ServicePreFooter from './ServicePreFooter';
import LoginModal from '../LoginModal';
import Register from '../Register';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../api/apiClient';
import { buildHotelSuiteCards, getStartingPrice } from './serviceCatalogUtils';

const HIGHLIGHTS = [
  { icon: 'fa-bed',          label: 'Air Conditioned Suites' },
  { icon: 'fa-broom',        label: 'Daily Room Cleaning' },
  { icon: 'fa-paw',          label: 'Playtime & Socialization' },
  { icon: 'fa-shield-dog',   label: '24/7 CCTV Monitored' },
];

const HOTEL_DESCRIPTION = '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.';

const FALLBACK_DOG_SUITES = [
  {
    name: 'The Cozy Paw Suite',
    size: 'XS to Small',
    price: 650,
    desc: HOTEL_DESCRIPTION,
    icon: 'fa-house',
  },
  {
    name: 'The Happy Paws Suite',
    size: 'XS to Medium',
    price: 750,
    desc: HOTEL_DESCRIPTION,
    icon: 'fa-house-chimney',
    popular: true,
  },
  {
    name: 'The Grand Paw Suite',
    size: 'XS to Large',
    price: 950,
    desc: HOTEL_DESCRIPTION,
    icon: 'fa-star',
  },
  {
    name: 'The VIPaws Suite',
    size: 'XS to XLarge',
    price: 1050,
    desc: HOTEL_DESCRIPTION,
    icon: 'fa-crown',
  },
];

const FALLBACK_CAT_SUITES = [
  {
    name: 'The Cozy Whiskers',
    size: 'All sizes',
    price: 550,
    desc: HOTEL_DESCRIPTION,
    icon: 'fa-house',
  },
  {
    name: 'The Grand Purr Suite',
    size: 'All sizes',
    price: 650,
    desc: HOTEL_DESCRIPTION,
    icon: 'fa-star',
    popular: true,
  },
  {
    name: 'The VIPurr Villa',
    size: 'All sizes',
    price: 750,
    desc: HOTEL_DESCRIPTION,
    icon: 'fa-crown',
  },
];

const GALLERY_PHOTOS = [
  { src: '/assets/img_thefurclub/Image_66.webp', alt: 'Cozy pet suite interior' },
  { src: '/assets/img_thefurclub/Image_88.webp', alt: 'Pet resting in suite' },
  { src: '/assets/img_thefurclub/Image_104.webp', alt: 'Staff caring for pets' },
];

function GalleryPhoto({ src, alt }) {
  const [err, setErr] = useState(false);
  return (
    <div className="aspect-square rounded-2xl overflow-hidden bg-brand-hotel/10 flex items-center justify-center">
      {err ? (
        <div className="flex flex-col items-center justify-center gap-2 text-brand-hotel/30 p-4 text-center">
          <i className="fa-regular fa-image text-4xl" />
          <span className="text-xs font-semibold">Photo coming soon</span>
        </div>
      ) : (
        <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setErr(true)} />
      )}
    </div>
  );
}

function SuiteCard({ suite, accent, onBook }) {
  return (
    <button
      type="button"
      onClick={onBook}
      className={`relative rounded-3xl p-5 sm:p-6 flex flex-col shadow-md transition-all hover:shadow-xl sm:hover:-translate-y-1 border-2 text-left w-full ${
        suite.popular
          ? 'bg-brand-hotel-soft border-brand-hotel text-brand-dark'
          : 'bg-white border-brand-dark-light text-brand-dark'
      }`}
    >
      {suite.popular && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-orange text-white text-[9px] sm:text-[10px] font-bold px-3 sm:px-4 py-1 rounded-full tracking-widest uppercase whitespace-nowrap">
          Most Popular
        </span>
      )}
      <div className="w-11 h-11 rounded-2xl bg-brand-hotel-soft border border-brand-hotel/30 flex items-center justify-center mb-4">
        <i className={`fa-solid ${suite.icon} text-lg text-brand-hotel`} />
      </div>
      <h3 className="font-bauhaus font-extrabold text-base sm:text-lg mb-1 text-brand-dark">
        {suite.name}
      </h3>
      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full w-fit mb-3 bg-brand-hotel/10 text-brand-hotel">
        {suite.size}
      </span>
      <p className="text-xs leading-relaxed mb-5 flex-grow text-brand-dark-soft">
        {suite.desc}
      </p>
      <div className="pt-4 border-t border-brand-dark-light flex items-end justify-between">
        <div>
          <span className="text-2xl font-extrabold text-brand-hotel">
            PHP {suite.price.toLocaleString()}
          </span>
          <span className="text-xs ml-1 text-brand-dark-soft">/night</span>
        </div>
      </div>
    </button>
  );
}

export default function HotelSuite() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [species, setSpecies] = useState('dog');
  const [hotelSuites, setHotelSuites] = useState([]);
  const [loadingSuites, setLoadingSuites] = useState(true);

  useEffect(() => {
    let disposed = false;

    apiFetch('/api/public/hotel-suites')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Unable to load hotel suites'))))
      .then((data) => {
        if (disposed) return;
        setHotelSuites(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
      })
      .catch(() => {
        if (!disposed) setHotelSuites([]);
      })
      .finally(() => {
        if (!disposed) setLoadingSuites(false);
      });

    return () => { disposed = true; };
  }, []);

  const dynamicSuites = buildHotelSuiteCards(hotelSuites, species);
  const suites = dynamicSuites.length ? dynamicSuites : (species === 'dog' ? FALLBACK_DOG_SUITES : FALLBACK_CAT_SUITES);
  const startingPrice = getStartingPrice(suites.map((suite) => suite.price)) || 550;

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
          src="/assets/img_thefurclub/Image_21.webp"
          alt="Pet Hotel"
          className="absolute inset-0 w-full h-full object-cover object-[30%_center] sm:object-center"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-hotel/95 via-brand-hotel/70 to-brand-dark/70" />
        <div className="relative z-10 text-center px-4 sm:px-6">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-5">
            <i className="fa-solid fa-hotel text-white text-xl sm:text-2xl" />
          </div>
          <h1
            className="font-bauhaus font-extrabold text-3xl sm:text-4xl md:text-6xl text-white mb-3"
            style={{ textShadow: '0 2px 5px rgba(0, 0, 0, 0.34)' }}
          >
            Pet Hotel Suites
          </h1>
          <p className="text-white/85 text-sm sm:text-base md:text-lg max-w-md mx-auto leading-relaxed">
            Your pet's home away from home - comfortable, safe, and always cared for.
          </p>
          <p className="mt-3 text-white/60 text-xs font-semibold tracking-widest uppercase">
            Starting at PHP {startingPrice.toLocaleString()} / night - Dogs &amp; Cats
          </p>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="bg-brand-hotel-soft py-8 sm:py-10 px-4 sm:px-6 md:px-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-hotel shadow-md flex items-center justify-center">
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
          <p className="font-bauhaus text-brand-hotel text-xs tracking-widest uppercase text-center mb-2">Suites</p>
          <h2 className="font-bauhaus font-extrabold text-2xl sm:text-3xl md:text-4xl text-brand-dark text-center mb-3">
            Choose a Suite
          </h2>
          <p className="text-center text-brand-dark-soft text-sm mb-8 max-w-xl mx-auto">
            We have dedicated suites for dogs and cats. All suites include full daycare, hotel stay in their own suite, feeding, playtime, cuddles, and photo or video updates.
          </p>

          {/* Dog / Cat Toggle */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <div className="grid w-full max-w-xs grid-cols-2 overflow-hidden rounded-2xl border-2 border-brand-hotel/30 sm:inline-grid">
              {['dog', 'cat'].map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpecies(sp)}
                  className={`px-4 sm:px-8 py-2.5 text-sm font-bold transition-all ${
                    species === sp
                      ? 'bg-brand-hotel text-white'
                      : 'bg-white text-brand-hotel hover:bg-brand-hotel-soft'
                  }`}
                >
                  <i className={`fa-solid ${sp === 'dog' ? 'fa-dog' : 'fa-cat'} mr-2`} />
                  {sp === 'dog' ? 'Dogs' : 'Cats'}
                </button>
              ))}
            </div>
          </div>

          {loadingSuites && (
            <p className="mb-4 text-center text-xs font-semibold text-brand-dark-soft">Refreshing latest Admin suites...</p>
          )}

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 ${species === 'cat' ? 'lg:grid-cols-3 lg:max-w-3xl lg:mx-auto w-full' : 'lg:grid-cols-4'}`} key={species}>
            {suites.map((suite) => (
              <SuiteCard key={suite.name} suite={suite} accent={species} onBook={() => setIsLoginOpen(true)} />
            ))}
          </div>

          <p className="text-center text-brand-dark-soft text-xs mt-8">
            * All nightly rates are per pet. Extended stay discounts available for 5+ nights.
          </p>
        </div>
      </section>

      {/* -- GALLERY -- */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-12 bg-gradient-to-b from-brand-hotel-soft to-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bauhaus font-extrabold text-2xl md:text-3xl text-brand-dark text-center mb-10">
            Inside Our Suites
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {GALLERY_PHOTOS.map((p) => (
              <GalleryPhoto key={p.src} src={p.src} alt={p.alt} />
            ))}
          </div>
        </div>
      </section>

      <ServicePreFooter accent="hotel" />

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
