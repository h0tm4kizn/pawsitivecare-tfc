import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook } from 'lucide-react';

export default function Footer({ onOpenLogin, onNavigateSection }) {
  const navigate = useNavigate();
  const navLinks = [
    { label: "Home", href: "#home" },
    { label: "Services", href: "#services" },
    { label: "About Us", href: "#about-us" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact Us", href: "#contact" },
  ];
  const contactInfo = [
    { icon: Facebook, label: 'Facebook', value: 'The Fur Club Pet Station', href: 'https://www.facebook.com/profile.php?id=61575018202629', isLink: true },
    { icon: Mail, label: 'Email', value: 'connect.thefurclub@gmail.com' },
    { icon: Phone, label: 'Phone', value: '0976 065 8031' },
    { icon: MapPin, label: 'Location', value: '207 F. Blumentritt St. Kabayanan, San Juan City, 1550' },
  ];
  const currentYear = new Date().getFullYear();

  const handleFooterNav = (hash) => (e) => {
    e.preventDefault();
    const sectionId = String(hash || '').replace('#', '');
    if (!sectionId) return;

    if (sectionId === 'home') {
      onNavigateSection?.('home');
      navigate('/');
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 120);
      return;
    }

    onNavigateSection?.(sectionId);
    navigate('/');
    window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.hash = `#${sectionId}`;
      }
    }, 120);
  };

  return (
    <footer className="w-full overflow-hidden bg-[#5bbcc1] text-brand-dark shadow-outset">
      <div className="relative bg-[#5bbcc1]">
        <img
          src="/assets/footer.webp"
          alt=""
          aria-hidden="true"
          className="relative z-10 h-28 w-full object-cover object-top md:absolute md:inset-0 md:h-full md:object-center"
        />
        <div className="relative z-20 bg-transparent px-5 pb-2 pt-8 sm:px-6 md:px-12 md:pb-0 md:pt-[360px] lg:px-24">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-12">
            <div className="flex flex-col items-start gap-4 text-left">
              <Link to="/" aria-label="Go to Home" className="flex w-fit self-start justify-start">
                <img
                  src="/assets/furclub_text.webp"
                  alt="The Fur Club"
                  className="mb-2 block h-7 w-auto object-contain object-left"
                />
              </Link>
              <p className="font-poppins font-light text-sm text-brand-dark leading-relaxed">
                Providing premium grooming, daycare, and hotel services for your furry family members in San Juan City.{` `}
                <span className="text-brand-dark font-semibold">Secure your pet&apos;s slot today!</span>
              </p>
            </div>

            <div className="flex flex-col gap-4 pl-0 md:pl-6 md:pt-3 lg:pl-16">
              <h3 className="font-bauhaus font-black text-brand-dark text-2xl tracking-widest uppercase mb-2">
                Quick Links
              </h3>
              <nav className="flex flex-col gap-3">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={handleFooterNav(link.href)}
                    className="font-poppins font-medium text-sm text-brand-dark hover:text-brand-dark/80 transition-colors w-fit break-words"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-bauhaus font-black text-brand-dark text-2xl tracking-widest uppercase mb-2">
                Contact Us
              </h3>
              <div className="space-y-3">
                {contactInfo.map(({ icon: Icon, label, value, href, isLink }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-brand-dark" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-poppins text-[11px] font-semibold uppercase tracking-wider text-brand-dark/70">{label}</p>
                      {isLink ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-poppins text-sm text-brand-dark hover:text-brand-dark/80 leading-relaxed break-words transition-colors"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="font-poppins text-sm text-brand-dark leading-relaxed break-words">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={onOpenLogin}
                className="animate-float-soft bg-brand-dark text-brand-white px-8 py-3 rounded-full font-poppins font-semibold text-sm hover:bg-brand-dark/80 transition-all shadow-lg w-fit mt-2"
              >
                Book with Us!
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="-mt-px bg-[#5bbcc1] px-5 py-8 text-center">
        <div className="mx-auto mb-5 h-px w-full max-w-5xl bg-white/25" />
        <p className="font-poppins text-xs font-extrabold text-white/70">
          © The Fur Club {currentYear}. Made by <a href="https://thepawsitivecare.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-orange transition-colors hover:underline">PawsitiveCare</a>.
        </p>
      </div>
    </footer>
  );
}



