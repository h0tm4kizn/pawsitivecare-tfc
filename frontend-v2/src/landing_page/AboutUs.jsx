import { HeartHandshake, Building2, ScanFace, Heart } from 'lucide-react';

export default function AboutUs({ onBookNow }) {
  const featureItems = [
    { label: "Expert Caretakers",  icon: HeartHandshake, color: 'bg-brand-pink' },
    { label: "Premium Facilities", icon: Building2,       color: 'bg-brand-pink' },
    { label: "Pet Identification", icon: ScanFace,        color: 'bg-brand-pink'   },
    { label: "Loving Environment", icon: Heart,           color: 'bg-brand-pink'   },
  ];

  const gridImages = [
    { src: '/assets/grid-1.webp', alt: 'Facility 1' },
    { src: '/assets/grid-2.webp', alt: 'Facility 2' },
    { src: '/assets/grid-3.webp', alt: 'Facility 3' },
    { src: '/assets/grid-4.webp', alt: 'Facility 4' },
  ];

  return (
    <section
      id="about-us"
      className="w-full scroll-mt-24 overflow-hidden bg-white"
    >
      <div className="lg:hidden px-4 py-14">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <div>
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-dark">
                <i className="fa-solid fa-paw" /> About Us
              </span>
            </div>
            <h3 className="text-2xl font-extrabold leading-tight text-brand-dark">
              Your pet's second home for <span className="text-brand-orange">care and comfort.</span>
            </h3>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-brand-dark-light/10 shadow-lg">
            <img
              src="/assets/about-dog.webp"
              alt="About The Fur Club"
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <p className="font-poppins text-sm leading-relaxed text-brand-dark">
              The Fur Club Pet Station in San Juan City keeps furry family members safe, comfortable,
              and cared for through professional grooming, engaging daycare, and cozy hotel lodging.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {featureItems.map(({ label, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl border border-brand-dark-light bg-white p-3 shadow-[0_4px_12px_rgba(23,53,81,0.06)]">
                  <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${color}`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <p className="text-xs font-bold leading-snug text-brand-dark">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl pt-8 pb-5">
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-dark">
                <i className="fa-solid fa-paw" /> Why Choose Us
              </span>
            </div>
            <h3 className="text-2xl font-extrabold leading-tight text-brand-dark">
              San Juan's trusted sanctuary for <br />
              <span className="text-brand-orange">Furry Friends.</span>
            </h3>
            <p className="mt-4 font-poppins text-sm leading-relaxed text-brand-dark">
              We offer 24/7 CCTV monitoring, supervised play, and professional care. Book Grooming
              with Daycare and enjoy an automatic 10% combo discount.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {gridImages.map((img) => (
              <div key={img.alt} className="aspect-square overflow-hidden rounded-2xl bg-brand-dark-light/10 shadow-md">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>

          <button
            onClick={onBookNow}
            className="w-full rounded-full bg-brand-teal px-7 py-3 text-sm font-semibold text-brand-white shadow-lg transition-all hover:bg-brand-orange"
          >
            Reserve a Spot in the Club
          </button>
        </div>
      </div>

      {/* Row 1: Text left, Image right */}
      <div className="hidden lg:flex lg:px-24 lg:pt-20 flex-col lg:flex-row items-center gap-8 md:gap-12 lg:gap-16">

        {/* Text & Features */}
        <div className="w-full lg:w-1/2 flex flex-col z-10">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-dark">
              <i className="fa-solid fa-paw" /> About Us
            </span>
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-brand-dark md:text-4xl mb-5">
            Your pet's second home for,{' '}
            <span className="text-brand-orange">care and comfort.</span>
          </h2>
          <p className="font-poppins text-brand-dark text-sm md:text-base text-left mb-7 md:mb-8 leading-relaxed">
            The Fur Club Pet Station in San Juan City, where your furry family members
            are our top priority. We specialize in professional grooming, engaging daycare, and
            cozy hotel lodging tailored to the unique needs of every guest. Our passionate team
            is dedicated to creating a safe, fun, and stress-free environment.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {featureItems.map(({ label, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-4">
                <div className={`w-10 h-10 ${color} rounded-full shrink-0 shadow-md flex items-center justify-center`}>
                  <Icon size={20} className="text-white" />
                </div>
                <span className="font-poppins font-semibold text-brand-dark text-base">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Single image */}
        <div className="w-full lg:w-1/2 relative h-[240px] sm:h-[360px] lg:h-[560px] xl:h-[500px] rounded-3xl lg:rounded-[56px] shadow-xl overflow-hidden group">
          <div className="absolute hidden lg:block w-[300px] h-[300px] bg-brand-purple rounded-full opacity-20 blur-3xl z-0" />
          <img
            src="/assets/about-dog.webp"
            alt="About The Fur Club"
            className="absolute inset-0 w-full h-full object-cover z-10 group-hover:scale-105 transition-transform duration-700"
          />
        </div>
      </div>

      {/* Row 2: Image grid left, Text right */}
      <div className="hidden lg:flex lg:px-24 lg:pb-20 lg:pt-24 flex-col lg:flex-row items-center gap-8 md:gap-12 lg:gap-20">

        {/* 4-image grid */}
        <div className="w-full lg:w-1/2 lg:max-w-[620px] xl:max-w-none relative z-10">
          <div className="absolute hidden lg:block top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-pink rounded-full opacity-20 blur-3xl z-0" />
          <div className="grid grid-cols-2 gap-3 md:gap-5 relative z-10">
            {gridImages.map((img) => (
              <div key={img.alt} className="aspect-square rounded-2xl md:rounded-3xl overflow-hidden shadow-lg md:shadow-xl drop-shadow-xl bg-brand-dark-light/10">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Text & Book button */}
        <div className="w-full lg:w-1/2 flex flex-col z-10">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-dark">
              <i className="fa-solid fa-paw" /> Why Choose Us
            </span>
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-brand-dark md:text-4xl mb-5">
            San Juan's trusted sanctuary for,{' '}<br />
            <span className="text-brand-orange">Furry Friends.</span>
          </h2>
          <p className="font-poppins text-brand-dark text-sm md:text-base text-left mb-7 md:mb-8 leading-relaxed">
            Treat your beloved companion to a safe, cozy, and professional environment. At The Fur Club Pet Station,
            we offer 24/7 CCTV monitoring and supervised play to ensure total peace of mind for every pet parent.
            Planning a full day of pampering? Book a Grooming session with Daycare and enjoy an automatic 10% combo discount.
            Professional care has never been this rewarding.
          </p>

          <button
            onClick={onBookNow}
            className="animate-float-soft bg-brand-teal text-brand-white px-7 md:px-10 py-3 rounded-full font-poppins font-semibold text-sm md:text-lg hover:bg-brand-orange transition-all shadow-lg w-full sm:w-fit"
          >
            Reserve a Spot in the Club
          </button>
        </div>

      </div>
    </section>
  );
}
