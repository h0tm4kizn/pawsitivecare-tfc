import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ChevronDown, CircleHelp, House, Info, PawPrint, Phone, X } from 'lucide-react';

const SERVICE_LINKS = [
  { label: 'Pet Daycare', to: '/services/daycare' },
  { label: 'Pet Grooming', to: '/services/grooming' },
  { label: 'Pet Hotel', to: '/services/hotelsuite' },
];

export default function MobileSidebarMenu({
  isOpen,
  onClose,
  href,
  activeSection = '',
  onHome,
  onAbout,
  onFaq,
  onContact,
  onOpenLogin,
  onOpenRegister,
  hideOnDesktop = false,
}) {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const [servicesOpen, setServicesOpen] = useState(pathname.includes('/services/'));
  const hideClass = hideOnDesktop ? ' xl:hidden' : '';

  const currentSection = (() => {
    if (activeSection) return activeSection;
    if (pathname === '/products') return 'products';
    if (pathname.includes('/services/')) return 'services';
    if (hash) return hash.replace('#', '');
    return pathname === '/' ? 'home' : '';
  })();

  const isActive = (section) => currentSection === section;
  const isServicePathActive = (to) => pathname === to;

  const closeAll = () => {
    setServicesOpen(false);
    onClose?.();
  };

  const handleNav = (hashValue, cb) => () => {
    const section = String(hashValue || '').replace('#', '');
    if (!section) {
      cb?.();
      closeAll();
      return;
    }
    if (pathname === '/') {
      window.location.hash = `#${section}`;
    } else {
      navigate(`/#${section}`);
    }
    cb?.();
    closeAll();
  };

  const content = (
    <>
      <div
        className={`fixed inset-0 z-[140] bg-brand-dark/40 backdrop-blur-[2px] transition-opacity duration-300${hideClass} ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeAll}
      />

      <aside
        className={`fixed bottom-0 right-0 top-0 z-[150] flex h-[100dvh] max-h-[100dvh] w-[min(88vw,340px)] flex-col overflow-hidden rounded-l-[28px] bg-[linear-gradient(145deg,#ffffff_0%,#ffffff_45%,#f5fbfb_100%)] shadow-[-12px_0_40px_rgba(23,53,81,0.16)] transition-transform duration-300 ease-out md:w-[min(62vw,380px)]${hideClass} ${
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-brand-dark/10 px-5">
          <a
            href={href('#home')}
            onClick={handleNav('home', onHome)}
            aria-label="Go to Home"
            className="inline-flex items-center"
          >
            <img src="/assets/furclub_text.webp" alt="The Fur Club" className="h-5 w-auto object-contain" />
          </a>
          <button
            type="button"
            onClick={closeAll}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-dark/5 text-brand-dark transition-colors hover:bg-brand-orange/10 hover:text-brand-orange"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <nav className="space-y-1.5" aria-label="Mobile landing navigation">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-dark/45">Navigation</p>

            <a
              href={href('#home')}
              onClick={handleNav('#home', onHome)}
              className={`relative flex w-full items-center rounded-xl px-3 py-3 text-[15px] font-semibold transition-all ${isActive('home') ? 'bg-brand-orange/10 text-brand-orange before:absolute before:left-0 before:h-6 before:w-1 before:rounded-r-full before:bg-brand-orange' : 'text-brand-dark hover:bg-brand-dark/5 hover:text-brand-orange'}`}
            >
              <House size={18} className="mr-3 shrink-0" />
              Home
            </a>

            <button
              type="button"
              onClick={() => setServicesOpen((value) => !value)}
              className={`relative flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-semibold transition-all ${isActive('services') ? 'bg-brand-orange/10 text-brand-orange before:absolute before:left-0 before:h-6 before:w-1 before:rounded-r-full before:bg-brand-orange' : 'text-brand-dark hover:bg-brand-dark/5 hover:text-brand-orange'}`}
            >
              <span className="flex items-center">
                <PawPrint size={18} className="mr-3 shrink-0" />
                Services
              </span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`} />
            </button>

            {servicesOpen && (
              <div className="ml-5 space-y-1 border-l border-brand-orange/20 py-1 pl-4">
                {SERVICE_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={closeAll}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isServicePathActive(item.to) ? 'bg-brand-orange/10 text-brand-orange' : 'text-brand-dark/75 hover:bg-brand-dark/5 hover:text-brand-orange'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}

            <a
              href={href('#about-us')}
              onClick={handleNav('#about-us', onAbout)}
              className={`relative flex w-full items-center rounded-xl px-3 py-3 text-[15px] font-semibold transition-all ${isActive('about-us') ? 'bg-brand-orange/10 text-brand-orange before:absolute before:left-0 before:h-6 before:w-1 before:rounded-r-full before:bg-brand-orange' : 'text-brand-dark hover:bg-brand-dark/5 hover:text-brand-orange'}`}
            >
              <Info size={18} className="mr-3 shrink-0" />
              About Us
            </a>

            <a
              href={href('#faq')}
              onClick={handleNav('#faq', onFaq)}
              className={`relative flex w-full items-center rounded-xl px-3 py-3 text-[15px] font-semibold transition-all ${isActive('faq') ? 'bg-brand-orange/10 text-brand-orange before:absolute before:left-0 before:h-6 before:w-1 before:rounded-r-full before:bg-brand-orange' : 'text-brand-dark hover:bg-brand-dark/5 hover:text-brand-orange'}`}
            >
              <CircleHelp size={18} className="mr-3 shrink-0" />
              FAQ
            </a>

            <a
              href={href('#contact')}
              onClick={handleNav('#contact', onContact)}
              className={`relative flex w-full items-center rounded-xl px-3 py-3 text-[15px] font-semibold transition-all ${isActive('contact') ? 'bg-brand-orange/10 text-brand-orange before:absolute before:left-0 before:h-6 before:w-1 before:rounded-r-full before:bg-brand-orange' : 'text-brand-dark hover:bg-brand-dark/5 hover:text-brand-orange'}`}
            >
              <Phone size={18} className="mr-3 shrink-0" />
              Contact Us
            </a>
          </nav>
        </div>

        <div className="relative z-10 mt-auto shrink-0 space-y-2.5 border-t border-brand-dark/10 bg-[#f8fcfc] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={() => {
              onOpenLogin?.();
              closeAll();
            }}
            className="flex w-full items-center justify-center rounded-xl border border-brand-orange py-3 text-sm font-bold text-brand-orange transition-all hover:-translate-y-0.5 hover:bg-brand-orange/5"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenRegister?.();
              closeAll();
            }}
            className="flex w-full items-center justify-center rounded-xl bg-brand-orange py-3 text-sm font-bold text-white shadow-[0_6px_16px_rgba(254,126,77,0.22)] transition-all hover:-translate-y-0.5 hover:bg-brand-orange-dark"
          >
            Create an Account
          </button>
        </div>
      </aside>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
