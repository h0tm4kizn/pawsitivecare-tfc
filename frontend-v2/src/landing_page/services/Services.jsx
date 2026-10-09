import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/apiClient';

const fallbackServices = [
  {
    id: 1,
    name: 'Pet Hotel',
    category: 'hotel',
    description: 'Comfortable overnight suites with monitored care, feeding, and playtime for dogs and cats.',
    featured: false,
    startingPrice: '550',
    services: [
      { name: 'The Cozy Paw Suite (Dog, XS to Small)', price: 'PHP 650/night' },
      { name: 'The Happy Paws Suite (Dog, XS to Medium)', price: 'PHP 750/night' },
      { name: 'The Grand Paw Suite (Dog, XS to Large)', price: 'PHP 950/night' },
      { name: 'The VIPaws Suite (Dog, XS to XLarge)', price: 'PHP 1,050/night' },
      { name: 'The Cozy Whiskers (Cat)', price: 'PHP 550/night' },
      { name: 'The Grand Purr Suite (Cat)', price: 'PHP 650/night' },
      { name: 'The VIPurr Villa (Cat)', price: 'PHP 750/night' },
    ],
  },
  {
    id: 2,
    name: 'Pet Grooming',
    category: 'grooming',
    description: 'Professional grooming packages for dogs and cats, from a simple bath to a full glam session.',
    featured: true,
    startingPrice: '350',
    services: [
      { name: 'Fresh me up', price: 'PHP 450 - PHP 1,250' },
      { name: 'Tidy up', price: 'PHP 350 - PHP 1,150' },
      { name: 'Glow up', price: 'PHP 450 - PHP 1,250' },
      { name: 'Glam up', price: 'PHP 550 - PHP 1,450' },
      { name: 'Available for Dogs & Cats', price: '' },
    ],
  },
  {
    id: 3,
    name: 'Pet Daycare',
    category: 'daycare',
    description: 'Supervised daycare in a safe and fun environment. Available in hourly, half-day, and full-day sessions.',
    featured: false,
    startingPrice: '80',
    services: [
      { name: 'Hourly', price: 'PHP 80 - PHP 110 / hr' },
      { name: 'Half Day', price: 'PHP 250 - PHP 400' },
      { name: 'Full Day', price: 'PHP 500 - PHP 800' },
    ],
  },
];

const CheckIcon = ({ colorClass }) => (
  <div className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${colorClass}`}>
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

export default function Services({ onOpenLogin }) {
  const [services, setServices] = useState(fallbackServices);

  useEffect(() => {
    let disposed = false;

    const formatPrice = (value, suffix = '') => {
      const price = Number(value);
      return Number.isFinite(price) && price > 0 ? `PHP ${price.toLocaleString()}${suffix}` : '';
    };

    const getTierRows = (service) => {
      const tiers = Array.isArray(service?.tiers) ? service.tiers : (service?.service_tiers || []);
      const prices = tiers.map((tier) => Number(tier?.price)).filter((price) => Number.isFinite(price) && price > 0);
      if (!prices.length) return [{ name: service.name, price: '' }];
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const priceLabel = min === max ? formatPrice(min) : `PHP ${min.toLocaleString()} - PHP ${max.toLocaleString()}`;
      return [{ name: service.name, price: priceLabel }];
    };

    const hydrate = async () => {
      try {
        const [servicesResponse, suitesResponse] = await Promise.all([
          apiFetch('/api/services/catalog'),
          apiFetch('/api/public/hotel-suites'),
        ]);
        const servicesData = servicesResponse.ok ? await servicesResponse.json() : {};
        const suitesData = suitesResponse.ok ? await suitesResponse.json() : {};
        const catalog = Array.isArray(servicesData?.data) ? servicesData.data : [];
        const suites = Array.isArray(suitesData) ? suitesData : (suitesData?.data || []);
        if (!catalog.length && !suites.length) return;

        const dynamicServices = ['grooming', 'daycare', 'hotel'].map((category) => {
          const categoryServices = catalog.filter((service) => String(service?.category || '').toLowerCase() === category);
          const rows = category === 'hotel'
            ? suites.map((suite) => ({
                name: suite.name,
                price: formatPrice(suite.price_per_night, '/night'),
              }))
            : categoryServices.flatMap(getTierRows);
          const prices = category === 'hotel'
            ? suites.map((suite) => Number(suite.price_per_night))
            : categoryServices.flatMap((service) => (service.tiers || service.service_tiers || []).map((tier) => Number(tier.price)));
          const validPrices = prices.filter((price) => Number.isFinite(price) && price > 0);
          return {
            id: category,
            name: category === 'grooming' ? 'Pet Grooming' : category === 'daycare' ? 'Pet Daycare' : 'Pet Hotel',
            category,
            description: categoryServices.find((service) => service.description)?.description || '',
            featured: category === 'grooming',
            startingPrice: validPrices.length ? Math.min(...validPrices).toLocaleString() : '',
            services: rows,
          };
        }).filter((service) => service.services.length > 0);

        if (!disposed && dynamicServices.length) setServices(dynamicServices);
      } catch {
        // Keep the local catalog visible when the public catalog is unavailable.
      }
    };

    hydrate();
    return () => { disposed = true; };
  }, []);

  const SERVICE_PATHS = {
    grooming: '/services/grooming',
    daycare: '/services/daycare',
    hotel: '/services/hotelsuite',
  };

  return (
    <>
      <section id="services" className="w-full px-6 md:px-12 xl:px-24 py-24 flex flex-col items-center scroll-mt-24 bg-white">
      <div className="mb-8 text-center md:mb-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-teal-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-dark mb-4">
          <i className="fa-solid fa-paw" /> OUR SERVICES
        </span>
        <h2 className="text-2xl font-extrabold leading-tight text-brand-dark md:text-4xl">
          Everything your pet needs, <span className="text-brand-orange">all in one place.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-dark-soft">
          Explore our professional grooming, secure pet hotel, and supervised daycare services designed to give your furry family members the ultimate pampering experience.
        </p>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 xl:grid-cols-3 gap-8 items-stretch">
        {['grooming', 'daycare', 'hotel'].map((cat, idx) => {
          const pkg = services.find((service) => service.category === cat);
          if (!pkg) return null;

          const COLORS = {
            grooming: {
              cardCls:        'bg-brand-grooming-soft border-2 border-brand-grooming xl:scale-105 z-10 relative order-2',
              titleColor:     'text-brand-grooming',
              priceColor:     'text-brand-grooming',
              dividerCls:     'bg-brand-grooming/30',
              itemPriceColor: 'text-brand-grooming font-bold',
              checkCls:       'border-brand-grooming bg-brand-grooming text-white',
              btnCls:         'border-2 border-brand-grooming text-brand-grooming hover:bg-brand-grooming hover:text-white',
              badgeBg:        'bg-brand-grooming text-white',
            },
            daycare: {
              cardCls:        'bg-brand-daycare-soft border-2 border-brand-daycare order-1',
              titleColor:     'text-brand-daycare',
              priceColor:     'text-brand-daycare',
              dividerCls:     'bg-brand-daycare/40',
              itemPriceColor: 'text-brand-daycare font-bold',
              checkCls:       'border-brand-daycare bg-brand-daycare text-white',
              btnCls:         'border-2 border-brand-daycare text-brand-daycare hover:bg-brand-daycare hover:text-white',
            },
            hotel: {
              cardCls:        'bg-brand-hotel-soft border-2 border-brand-hotel order-3',
              titleColor:     'text-brand-hotel',
              priceColor:     'text-brand-hotel',
              dividerCls:     'bg-brand-hotel/30',
              itemPriceColor: 'text-brand-hotel font-bold',
              checkCls:       'border-brand-hotel bg-brand-hotel text-white',
              btnCls:         'border-2 border-brand-hotel text-brand-hotel hover:bg-brand-hotel hover:text-white',
            },
          };

          const { cardCls, titleColor, priceColor, dividerCls, itemPriceColor, checkCls, btnCls, badgeBg } = COLORS[cat];

          return (
            <div
              key={pkg.id}
              className={`animate-float-soft w-full max-w-2xl xl:max-w-none mx-auto rounded-[35px] p-6 md:p-8 xl:p-10 flex flex-col items-center shadow-lg hover:shadow-xl transition-all ${cardCls}`}
              style={{ animationDelay: `${idx * 0.25}s` }}
            >

              {pkg.featured && badgeBg && (
                <div className={`absolute -top-5 px-6 py-2 rounded-full font-poppins font-bold text-sm tracking-wide ${badgeBg}`}>
                  MOST POPULAR
                </div>
              )}
              <h4 className={`font-poppins font-bold text-xl text-center mb-3 leading-tight ${titleColor}`}>{pkg.name}</h4>
              <p className="min-h-[4.5rem] text-center text-sm leading-6 text-brand-dark-soft">{pkg.description}</p>
              <div className={`font-poppins font-bold my-5 ${priceColor}`}>
                <span className="text-3xl">PHP {pkg.startingPrice || '0'}</span>
                <span className="text-base ml-2 opacity-75">starting</span>
              </div>
              <div className={`w-full h-px mb-6 ${dividerCls}`} />

              <div className="flex flex-col gap-4 mb-10 w-full flex-grow">
                {pkg.services.map((service) => (
                  <div key={`${pkg.id}-${service.name}`} className="flex items-start sm:items-center justify-between w-full gap-2">
                    <div className="flex items-start sm:items-center gap-2 min-w-0">
                      <CheckIcon colorClass={checkCls} />
                      <span className={`font-poppins font-medium text-xs leading-snug ${titleColor}`}>{service.name}</span>
                    </div>
                    <span className={`font-poppins text-xs whitespace-nowrap shrink-0 ${itemPriceColor}`}>{service.price}</span>
                  </div>
                ))}
              </div>

              <Link
                to={SERVICE_PATHS[pkg.category]}
                className={`w-full py-3 rounded-[35px] font-poppins font-bold text-base transition-all transform-gpu duration-200 hover:-translate-y-1 text-center ${btnCls}`}
              >
                SEE MORE
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-16 text-center">
        <p className="text-gray-600 font-poppins text-sm">
          * All services include professional care and attention to detail. Contact us for special rates and customized packages.
        </p>
      </div>
    </section>

    </>
  );
}
