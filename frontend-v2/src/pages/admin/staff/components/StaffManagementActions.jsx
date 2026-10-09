import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, Settings2, UserPlus } from 'lucide-react';
import StaffRateSettingsMenu from './StaffRateSettingsMenu';

export default function StaffManagementActions({
  staff = [],
  onAddStaff,
  onAttendance,
  compact = false,
  canManage = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setRatesOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const buttonSize = compact
    ? 'px-3 py-2 text-xs'
    : 'px-4 py-2.5 text-sm';
  const actionClass = `inline-flex items-center justify-center gap-2 rounded-xl border border-brand-teal/30 bg-white ${buttonSize} font-semibold text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.06)] transition-colors hover:border-brand-teal hover:text-brand-teal-dark`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onAttendance}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-brand-teal/35 bg-white ${buttonSize} font-semibold text-brand-teal-dark transition-colors hover:bg-brand-surface`}
      >
        <Camera size={compact ? 14 : 16} strokeWidth={2.4} />
        Attendance
      </button>
      {canManage && <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className={actionClass}
        >
          <Settings2 size={compact ? 14 : 16} />
          Manage Staff
          <ChevronDown size={compact ? 14 : 15} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 rounded-xl border border-brand-teal/20 bg-white p-1.5 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onAddStaff?.();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-surface"
            >
              <UserPlus size={16} className="text-brand-teal" />
              Add Staff
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setRatesOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-surface"
            >
              <Settings2 size={16} className="text-brand-teal" />
              Staff Rate Settings
            </button>
          </div>
        )}
      </div>}
      {canManage && <StaffRateSettingsMenu
        staff={staff}
        isOpen={ratesOpen}
        onClose={() => setRatesOpen(false)}
        showTrigger={false}
      />}
    </div>
  );
}
