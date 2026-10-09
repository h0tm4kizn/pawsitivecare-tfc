import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import MobileSidebarMenu from './mobile/MobileSidebarMenu';

const SERVICE_LINKS = [
  { label: 'Pet Daycare', to: '/services/daycare' },
  { label: 'Pet Grooming', to: '/services/grooming' },
  { label: 'Pet Hotel', to: '/services/hotelsuite' },
];

export default function Header({
  onOpenLogin,
  onOpenRegister,
  onNavigate,
  forceDark = false,
  forceTopStyle = false,
  forceSolidHeader = false,
}) {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const isOnLanding = pathname === '/';
  const isOnServicePage = pathname.includes('/services/');
  const href = (hash) => isOnLanding ? hash : `/${hash}`;

  // Determine active section from hash, or detect if on a service page
  const activeSection = (() => {
    if (hash) return hash.slice(1);
    // Check if we're on a service page
    if (pathname.includes('/services/')) return 'services';
    return 'home';
  })();
  const isActiveSection = (section) => activeSection === section;
  const useMinimalMobileHomeHeader = isOnLanding && isActiveSection('home');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const servicesRef = useRef(null);
  const useScrolledStyle = forceTopStyle ? false : isScrolled;
  const dark = forceDark || forceSolidHeader || isOnServicePage || useScrolledStyle;
  const headerBgClass = forceSolidHeader || isOnServicePage
    ? 'bg-white border-white/60 shadow-lg shadow-black/10'
    : useScrolledStyle
      ? 'bg-white/95 border-white/60 shadow-lg shadow-black/10'
      : 'bg-transparent border-transparent';
  const desktopHeaderTextStyle = !dark ? { textShadow: '0 1px 4px rgba(0, 0, 0, 0.30)' } : undefined;
  const desktopTextClass = dark ? 'xl:text-brand-dark' : 'xl:text-white';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (servicesRef.current && !servicesRef.current.contains(e.target)) {
        setIsServicesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoClick = () => {
    setIsMenuOpen(false);

    if (isOnLanding) {
      onNavigate?.('home');
      return;
    }

    navigate('/');
  };

  const handleHomeNav = () => {
    if (isOnLanding) {
      onNavigate?.('home');
      return;
    }
    navigate('/');
  };

  const navigateToSection = (section) => {
    if (!section) return;
    if (section === 'home') {
      handleHomeNav();
      return;
    }
    if (isOnLanding) {
      window.location.hash = `#${section}`;
      onNavigate?.(section);
      return;
    }
    navigate(`/#${section}`);
  };

  return (
    <nav className={`sticky top-0 left-0 w-full z-50 backdrop-blur-md border-b transition-colors duration-300 ${headerBgClass} ${useMinimalMobileHomeHeader ? 'max-xl:!border-transparent max-xl:!bg-transparent max-xl:!shadow-none max-xl:!backdrop-blur-none' : ''}`}>
      <div className="mx-auto flex w-full items-center justify-between px-5 py-2.5 sm:px-6 md:min-h-[64px] md:px-12 md:py-2.5 lg:px-24 xl:min-h-[104px] xl:py-5">
      <button
        type="button"
        onClick={handleLogoClick}
        className={`items-center gap-1 md:gap-2 cursor-pointer z-50 xl:flex ${useMinimalMobileHomeHeader ? 'hidden' : 'flex'}`}
        aria-label="Go to Home"
      >
        <div className="bg-transparent flex items-center justify-center h-9 md:h-10 xl:h-14">
          <img
            src="/assets/furclub_text.webp"
            alt="The Fur Club"
            className="h-5 md:h-[22px] xl:h-6 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.10)] -ml-1 md:-ml-1.5 xl:-ml-2.5"
          />
        </div>
      </button>

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_3px_10px_rgba(23,53,81,0.08)] transition-all hover:border-brand-orange/30 hover:bg-brand-orange/10 hover:text-brand-orange focus:outline-none md:h-11 md:w-11 xl:hidden ${useMinimalMobileHomeHeader ? 'ml-auto border-white/60 bg-white/20 text-white backdrop-blur-sm' : 'border-brand-dark/10 bg-white/80 text-brand-dark'}`}
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={2.25} />
      </button>

        <MobileSidebarMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        href={href}
        activeSection={activeSection}
        onHome={handleHomeNav}
        onAbout={() => onNavigate?.()}
        onFaq={() => onNavigate?.()}
        onContact={() => onNavigate?.()}
        onOpenLogin={onOpenLogin}
        onOpenRegister={onOpenRegister}
        hideOnDesktop
      />

      <div className={`hidden xl:flex items-center gap-9 font-poppins font-bold text-sm ${desktopTextClass}`}>
        <a
          href={href('#home')}
          className={`hover:text-brand-orange transition-colors ${isActiveSection('home') ? 'text-brand-orange' : desktopTextClass}`}
          style={desktopHeaderTextStyle}
          onClick={(e) => {
            e.preventDefault();
            navigateToSection('home');
          }}
        >
          Home
        </a>

        <div className="relative" ref={servicesRef}>
          <button
            type="button"
            onClick={() => setIsServicesOpen((prev) => !prev)}
            className={`flex items-center gap-1 hover:text-brand-orange transition-colors font-poppins font-bold text-sm ${isActiveSection('services') ? 'text-brand-orange' : desktopTextClass}`}
            style={desktopHeaderTextStyle}
          >
            Services
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isServicesOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-44 rounded-2xl shadow-xl bg-white ring-1 ring-black/5 overflow-hidden z-50">
              {SERVICE_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => { onNavigate?.(); setIsServicesOpen(false); }}
                  className={`block px-5 py-3 text-sm font-poppins font-semibold hover:bg-brand-orange/10 hover:text-brand-orange transition-colors ${pathname === item.to ? 'text-brand-orange' : 'text-brand-dark'}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <a href={href('#about-us')} className={`hover:text-brand-orange transition-colors ${isActiveSection('about-us') ? 'text-brand-orange' : desktopTextClass}`} style={desktopHeaderTextStyle} onClick={(e) => { e.preventDefault(); navigateToSection('about-us'); }}>About Us</a>
        <a href={href('#faq')} className={`hover:text-brand-orange transition-colors ${isActiveSection('faq') ? 'text-brand-orange' : desktopTextClass}`} style={desktopHeaderTextStyle} onClick={(e) => { e.preventDefault(); navigateToSection('faq'); }}>FAQ</a>
        <a href={href('#contact')} className={`hover:text-brand-orange transition-colors ${isActiveSection('contact') ? 'text-brand-orange' : desktopTextClass}`} style={desktopHeaderTextStyle} onClick={(e) => { e.preventDefault(); navigateToSection('contact'); }}>Contact Us</a>
      </div>

      <div className="hidden xl:flex items-center gap-6 z-50">
        <button
          onClick={onOpenLogin}
          className={`font-poppins text-sm font-bold ${dark ? 'text-brand-dark' : 'text-white'} hover:text-brand-orange transition-colors`}
          style={desktopHeaderTextStyle}
        >
          Login
        </button>

        <button onClick={onOpenRegister} className="animate-float-soft bg-brand-orange text-brand-white px-6 py-2 rounded-full font-poppins text-sm font-semibold hover:bg-brand-teal transition-colors shadow-md">
          Sign up
        </button>
      </div>
      </div>
    </nav>
  );
}
