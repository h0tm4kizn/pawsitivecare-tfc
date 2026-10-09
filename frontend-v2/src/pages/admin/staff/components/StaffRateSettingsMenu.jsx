import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import FilterSelect from './FilterSelect';

const inputClass = 'rounded-xl border border-brand-teal/20 bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-teal';

export default function StaffRateSettingsMenu({
  staff = [],
  isOpen,
  onClose,
  showTrigger = true,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen ?? internalOpen;
  const [settings, setSettings] = useState([]);
  const [staffId, setStaffId] = useState('');
  const [rate, setRate] = useState('0');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const menuRef = useRef(null);

  const setOpen = useCallback((nextOpen) => {
    if (isOpen === undefined) {
      setInternalOpen(nextOpen);
    } else if (!nextOpen) {
      onClose?.();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    const close = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    apiFetch('/api/admin/commission-settings')
      .then((response) => response.json())
      .then((json) => {
        const rows = json?.data || [];
        setSettings(rows);
        const defaultSetting = rows.find((item) => !item.staff_id && item.service_category === 'grooming' && item.is_active);
        if (defaultSetting) setRate(String(defaultSetting.rate_percent));
      })
      .catch(() => setMessage('Unable to load rate settings.'));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const setting = settings.find((item) => String(item.staff_id || '') === String(staffId) && item.service_category === 'grooming' && item.is_active)
      || settings.find((item) => !item.staff_id && item.service_category === 'grooming' && item.is_active);
    setRate(setting ? String(setting.rate_percent) : '0');
  }, [open, settings, staffId]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await apiFetch('/api/admin/commission-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate_percent: Number(rate),
          staff_id: staffId || null,
          service_category: 'grooming',
          calculation_basis: 'final_service_price',
          is_active: true,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.message || 'Unable to save rate.');
      setMessage('Rate saved.');
      const refreshed = await apiFetch('/api/admin/commission-settings');
      const refreshedJson = await refreshed.json();
      setSettings(refreshedJson?.data || []);
    } catch (error) {
      setMessage(error.message || 'Unable to save rate.');
    } finally {
      setSaving(false);
    }
  };

  const staffOptions = [
    { value: '', label: 'Everyone - default rate' },
    ...staff.filter((item) => item.is_active).map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <div ref={menuRef} className="relative">
      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-teal/30 bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.06)] transition-colors hover:border-brand-teal hover:text-brand-teal-dark"
        >
          <Settings2 size={16} />
          Staff Rate Settings
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-brand-teal/20 bg-white p-4 shadow-xl">
          <div className="mb-3">
            <p className="text-sm font-extrabold text-brand-dark">Commission rates</p>
            <p className="mt-0.5 text-xs leading-5 text-brand-dark-soft">Set the default grooming rate or an individual staff override.</p>
          </div>
          <label className="block text-xs font-bold text-brand-dark-soft">
            Applies to
            <div className="mt-1">
              <FilterSelect value={staffId} onChange={setStaffId} options={staffOptions} widthClass="w-full" />
            </div>
          </label>
          <label className="mt-3 block text-xs font-bold text-brand-dark-soft">
            Grooming commission rate (%)
            <input
              className={`${inputClass} mt-1 w-full`}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </label>
          {message && <p className="mt-2 text-xs font-semibold text-brand-teal-dark">{message}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="mt-4 w-full rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brand-teal-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save rate'}
          </button>
        </div>
      )}
    </div>
  );
}
