import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 260);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-5 right-4 z-[70] inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand-orange bg-white/95 text-brand-orange shadow-lg transition-all hover:bg-brand-orange hover:text-white active:scale-95 sm:bottom-6 sm:right-6"
    >
      <ChevronUp size={18} strokeWidth={2.5} />
    </button>
  );
}
