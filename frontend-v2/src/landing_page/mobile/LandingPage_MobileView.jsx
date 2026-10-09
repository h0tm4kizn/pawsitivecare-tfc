import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import MobileSidebarMenu from './MobileSidebarMenu';

const HERO_BACKGROUND_SRC = '/assets/landing_bg.webp';

export default function LandingPage_MobileView({ onOpenLogin, onOpenRegister, onNavigate, hideHero = false }) {
  const { pathname } = useLocation();
  const isOnLanding = pathname === '/';
  const href = (hash) => isOnLanding ? hash : `/${hash}`;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPastHero, setIsPastHero] = useState(false);

  useEffect(() => {
    const updateHamburgerStyle = () => {
      setIsPastHero(window.scrollY >= window.innerHeight - 80);
    };

    updateHamburgerStyle();
    window.addEventListener('scroll', updateHamburgerStyle, { passive: true });
    window.addEventListener('resize', updateHamburgerStyle);
    return () => {
      window.removeEventListener('scroll', updateHamburgerStyle);
      window.removeEventListener('resize', updateHamburgerStyle);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`pointer-events-none fixed inset-x-0 top-0 z-50 px-4 py-3 md:px-6 md:py-3.5 transition-colors duration-300 ${isScrolled ? 'bg-white/95 border-b border-brand-teal/20 shadow-sm backdrop-blur' : 'bg-transparent border-transparent'}`}>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_3px_10px_rgba(23,53,81,0.10)] backdrop-blur-sm transition-all duration-300 md:h-11 md:w-11 ${
              isPastHero
                ? 'border-brand-dark/10 bg-white/90 text-brand-dark hover:bg-white'
                : 'border-white/60 bg-white/20 text-white hover:bg-white/30'
            }`}
            aria-label="Open menu"
          >
            <Menu size={20} strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <MobileSidebarMenu
        isOpen={menuOpen}
        onClose={closeMenu}
        href={href}
        onHome={() => onNavigate?.('home')}
        onAbout={() => onNavigate?.()}
        onFaq={() => onNavigate?.()}
        onContact={() => onNavigate?.()}
        onOpenLogin={onOpenLogin}
        onOpenRegister={onOpenRegister}
      />

      {!hideHero && (
      <section id="home" className="relative flex min-h-[100svh] w-full flex-col overflow-hidden pt-[65px] md:pt-[74px]">
        <img
          src={HERO_BACKGROUND_SRC}
          alt="Pet Station Background"
          className="absolute inset-0 z-0 h-full w-full object-cover object-[24%_bottom]"
        />
        <div
          className="absolute inset-0 z-0"
          style={{
            background: 'radial-gradient(circle at 52% 30%, rgba(79,198,201,0.22) 0%, rgba(23,53,81,0.18) 62%, rgba(23,53,81,0.24) 100%)',
          }}
        />
        <div className="absolute inset-0 z-0 bg-brand-dark/18 backdrop-blur-[2px]" />

        <div className="relative z-10 flex flex-1 translate-y-8 flex-col items-center justify-center px-5 pb-10 pt-6 text-center md:translate-y-10 md:px-8 md:pb-14 md:pt-10">
          <h1
            className="mt-2 w-full max-w-sm font-bauhaus text-[30px] font-bold leading-[1.12] tracking-wide text-white md:max-w-xl md:text-[44px]"
            style={{ textShadow: '0 2px 5px rgba(0, 0, 0, 0.34)' }}
          >
            Uniting Hearts and Paws in a Haven of Love
          </h1>
          <p
            className="mt-2 max-w-[280px] text-sm font-medium leading-relaxed text-white md:max-w-md md:text-base"
            style={{ textShadow: '0 1px 4px rgba(0, 0, 0, 0.32)' }}
          >
            Providing the best care for your furry friends at The Fur Club Pet Station.
          </p>

          <div className="mt-7 flex w-full max-w-[260px] flex-col gap-3.5 md:max-w-md md:flex-row md:justify-center">
            <button
              type="button"
              onClick={onOpenLogin}
              className="rounded-full bg-brand-orange px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-brand-teal md:min-w-[190px]"
            >
              Book with Us!
            </button>
            <a
              href="#services"
              className="rounded-full border-2 border-white px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:text-brand-dark md:min-w-[190px]"
            >
              Our Services
            </a>
          </div>
        </div>
      </section>
      )}
    </>
  );
}
