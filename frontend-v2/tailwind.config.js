/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#173551',
        'brand-dark-deep': '#173551',
        'brand-dark-soft': '#7a9ab0',
        'brand-dark-light': '#e5ecf0',
        'brand-orange': '#FE7E4D',
        'brand-orange-dark': '#d35725',
        'brand-orange-soft': '#f5d4c7',
        'brand-orange-light': '#fae9dd',
        'brand-green': '#14964c',
        'brand-red': '#b32d2d',
        'brand-pink': '#F38797',
        'brand-purple': '#736CDE',
        'brand-green-soft': '#14964c',
        'brand-green-light': '#14964c',
        'brand-teal': '#5bbcc1',
        'brand-teal-dark': '#24777a',
        'brand-teal-soft': '#d7f5f6',
        'brand-teal-light': '#e0f8f9',
        'brand-white': '#ffffff',
        'brand-surface': '#fafdfe',
        'brand-receipt': '#fef9f4',
        'brand-receipt-bg': '#f8efe6',
        'brand-dark-hero': '#0e2236',
        'brand-purple-soft': '#e8e7f9',
        'brand-pink-soft': '#fde8ec',
        'brand-grooming': '#a78bfa',
        'brand-grooming-soft': '#ede9fe',
        'brand-daycare': '#fbbf24',
        'brand-daycare-soft': '#fef9c3',
        'brand-hotel': '#fb7185',
        'brand-hotel-soft': '#ffe4e6',
      },
      fontFamily: {
        'bauhaus': ['var(--font-bauhaus)'],
        'poppins': ['var(--font-poppins)'],
      }
    },
  },
  plugins: [],
  safelist: [
    // Service brand colors — used dynamically, must be safelisted
    'bg-brand-grooming', 'bg-brand-grooming-soft', 'text-brand-grooming', 'border-brand-grooming',
    'hover:bg-brand-grooming-soft', 'hover:border-brand-grooming', 'ring-brand-grooming', 'border-brand-grooming/30', 'focus:ring-brand-grooming/30',
    'bg-brand-daycare',  'bg-brand-daycare-soft',  'text-brand-daycare',  'border-brand-daycare',
    'hover:bg-brand-daycare-soft',  'hover:border-brand-daycare',  'ring-brand-daycare', 'border-brand-daycare/30', 'focus:ring-brand-daycare/30',
    'bg-brand-hotel',    'bg-brand-hotel-soft',    'text-brand-hotel',    'border-brand-hotel',
    'hover:bg-brand-hotel-soft',    'hover:border-brand-hotel',    'ring-brand-hotel', 'border-brand-hotel/30', 'focus:ring-brand-hotel/30',
    'bg-brand-teal', 'text-brand-teal', 'border-brand-teal/30', 'focus:ring-brand-teal/30',
  ],
}
