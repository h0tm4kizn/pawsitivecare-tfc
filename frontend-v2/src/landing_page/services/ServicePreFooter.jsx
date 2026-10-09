import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook } from 'lucide-react';

const QUICK_LINKS = [
  { label: 'Home',        to: '/' },
  { label: 'Services',    to: '/#services' },
  { label: 'About Us',    to: '/#about-us' },
  { label: 'FAQ',         to: '/#faq' },
  { label: 'Contact Us',  to: '/#contact' },
];

const CONTACT = [
  { icon: Facebook, label: 'Facebook', value: 'The Fur Club Pet Station', href: 'https://www.facebook.com/profile.php?id=61575018202629', isLink: true },
  { icon: Mail,   label: 'Email',    value: 'connect.thefurclub@gmail.com' },
  { icon: Phone,  label: 'Phone',    value: '0976 065 8031' },
  { icon: MapPin, label: 'Location', value: '207 F. Blumentritt St. Kabayanan, San Juan City, 1550' },
];

const COLOR_MAP = {
  grooming: {
    image: '/assets/footer-g.webp?v=service-footer-1',
    surface: 'bg-[#8d7fe8]',
    imageMobilePosition: 'object-top',
    bar: 'bg-transparent',
    accentText: 'text-brand-dark',
    headingText: 'text-white',
    bodyText: 'text-white/90',
    linkText: 'text-white/90 hover:text-brand-dark',
    iconText: 'text-white',
    metaText: 'text-white/70',
    bookBtn: 'bg-brand-dark hover:bg-brand-dark/80 text-white',
  },
  daycare: {
    image: '/assets/footer-d.webp?v=service-footer-1',
    surface: 'bg-[#f4b900]',
    imageMobilePosition: 'object-top',
    bar: 'bg-[#f4b900]',
    accentText: 'text-brand-dark',
    headingText: 'text-brand-dark',
    bodyText: 'text-brand-dark',
    linkText: 'text-brand-dark hover:text-brand-dark/80',
    iconText: 'text-brand-dark',
    metaText: 'text-brand-dark/70',
    bookBtn: 'bg-brand-dark hover:bg-brand-dark/80 text-white',
  },
  hotel: {
    image: '/assets/footer-h.webp?v=service-footer-1',
    surface: 'bg-[#ff7c82]',
    imageMobilePosition: 'object-top',
    bar: 'bg-[#ff7c82]',
    accentText: 'text-brand-dark',
    headingText: 'text-brand-dark',
    bodyText: 'text-brand-dark',
    linkText: 'text-brand-dark hover:text-brand-dark/80',
    iconText: 'text-brand-dark',
    metaText: 'text-brand-dark/70',
    bookBtn: 'bg-brand-dark hover:bg-brand-dark/80 text-white',
  },
};

export default function ServicePreFooter({ accent = 'grooming' }) {
  const navigate = useNavigate();
  const c = COLOR_MAP[accent] ?? COLOR_MAP.grooming;
  const currentYear = new Date().getFullYear();
  const handleQuickLink = (to) => (e) => {
    e.preventDefault();
    if (!to.startsWith('/#')) {
      navigate(to);
      return;
    }

    const sectionId = to.replace('/#', '');
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
    <footer className={`relative isolate w-full overflow-x-hidden overflow-y-visible ${c.surface} text-brand-dark shadow-outset`}>
      <div className={`relative ${c.surface}`}>
        <img
          src={c.image}
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.src = '/assets/footer.webp'; }}
          className={`relative z-10 h-28 w-full object-cover ${c.imageMobilePosition || 'object-top'} md:absolute md:inset-0 md:h-full md:object-center`}
        />
        <div className="relative z-20 bg-transparent px-5 pb-2 pt-8 sm:px-6 md:px-12 md:pb-0 md:pt-[360px] lg:px-24">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-12">

        {/* Col 1 — Logo + tagline */}
        <div className="flex flex-col items-start gap-4 text-left">
          <Link to="/" aria-label="Go to Home" className="flex w-fit self-start justify-start">
            <img
              src="/assets/furclub_text.webp"
              alt="The Fur Club"
              className="mb-2 block h-7 w-auto object-contain object-left"
            />
          </Link>
          <p className={`font-poppins font-light text-sm leading-relaxed ${c.bodyText || 'text-white'}`}>
            Providing premium grooming, daycare, and hotel services for your furry family members in San Juan City.{' '}
            <span className={`${c.accentText} font-semibold`}>Secure your pet's slot today!</span>
          </p>
        </div>

        {/* Col 2 — Quick Links */}
        <div className="flex flex-col gap-4 pl-0 md:pl-6 md:pt-3 lg:pl-16">
          <h3 className={`mb-2 font-bauhaus text-xl font-black uppercase tracking-widest sm:text-2xl ${c.headingText || 'text-white'}`}>
            Quick Links
          </h3>
          <nav className="flex flex-col gap-3">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={handleQuickLink(l.to)}
                className={`font-poppins font-medium text-sm transition-colors w-fit break-words ${c.linkText || 'text-white hover:text-brand-orange'}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Col 3 — Contact + Book */}
        <div className="flex flex-col gap-4">
          <h3 className={`mb-2 font-bauhaus text-xl font-black uppercase tracking-widest sm:text-2xl ${c.headingText || 'text-white'}`}>
            Contact Us
          </h3>
          <div className="space-y-3">
            {CONTACT.map(({ icon: Icon, label, value, href, isLink }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <Icon size={16} className={c.iconText || 'text-white'} />
                </div>
                <div className="min-w-0">
                  <p className={`font-poppins text-[11px] font-semibold uppercase tracking-wider ${c.metaText || 'text-white/70'}`}>{label}</p>
                  {isLink ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`font-poppins text-sm leading-relaxed break-words transition-colors ${c.linkText || 'text-white hover:text-brand-orange'}`}
                    >
                      {value}
                    </a>
                  ) : (
                    <p className={`font-poppins text-sm leading-relaxed break-words ${c.bodyText || 'text-white'}`}>{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/"
            className={`animate-float-soft ${c.bookBtn} px-8 py-3 rounded-full font-poppins font-semibold text-sm transition-all shadow-lg w-fit mt-2`}
          >
            Book with Us!
          </Link>
        </div>

          </div>
        </div>
      </div>

      <div className={`-mt-px px-5 py-8 text-center ${c.bar}`}>
        <div className="mx-auto mb-5 h-px w-full max-w-5xl bg-white/25" />
        <p className="font-poppins text-xs font-extrabold text-white/70">
          © The Fur Club {currentYear}. Made by PawsitiveCare.
        </p>
      </div>
    </footer>
  );
}


