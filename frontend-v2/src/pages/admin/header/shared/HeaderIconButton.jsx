export default function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  badgeCount = 0,
  withLeftBorder = false,
  roundedHover = false,
  testId,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-14 w-12 items-center justify-center px-3 text-brand-dark transition-colors ${
        roundedHover ? 'rounded-full hover:bg-white/55' : 'hover:bg-white/50'
      } ${
        withLeftBorder ? 'border-l border-brand-teal/20' : ''
      }`}
      aria-label={label}
      data-testid={testId}
    >
      <Icon size={16} strokeWidth={2.2} />
      {badgeCount > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </button>
  );
}
