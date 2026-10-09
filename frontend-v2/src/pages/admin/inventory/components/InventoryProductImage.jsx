import { ImageIcon } from 'lucide-react';

const variantClasses = {
  thumb: 'h-12 w-12 rounded-xl',
  mobile: 'h-14 w-14 rounded-xl',
  panel: 'h-36 w-36 rounded-xl',
};

export default function InventoryProductImage({ item, variant = 'thumb', className = '' }) {
  const imageUrl = typeof item?.image_url === 'string' ? item.image_url.trim() : '';
  const sizeClass = variantClasses[variant] || variantClasses.thumb;
  const label = item?.item_name || 'Supplies item';

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label}
        className={`${sizeClass} shrink-0 border border-brand-teal/15 bg-white object-cover ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-brand-teal/25 bg-brand-teal-light/25 text-brand-teal-dark ${className}`}
      aria-label={`${label} photo not set`}
    >
      <ImageIcon size={variant === 'panel' ? 28 : 20} strokeWidth={2.2} />
      {variant === 'panel' && (
        <span className="px-2 text-center text-[10px] font-bold leading-tight text-brand-dark-soft">
          No photo available
        </span>
      )}
    </div>
  );
}

