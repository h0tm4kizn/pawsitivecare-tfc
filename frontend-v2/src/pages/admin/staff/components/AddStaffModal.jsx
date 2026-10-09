import { AlertCircle, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '../../../../api/apiClient';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import {
  cleanPhone,
  formatPhoneInput,
  generateStaffPassword,
  phoneRegex,
  staffLabel,
} from '../staffUiUtils';
import StaffSummary from './StaffSummary';
import { STAFF_TYPES } from '../../../../utils/staffTypes';

const normalizeName = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  contact_number: '',
  email: '',
  password: '',
  staff_type: STAFF_TYPES.FRONT_DESK,
  is_active: true,
};

const makeEmptyForm = () => ({ ...EMPTY_FORM, password: generateStaffPassword() });

export default function AddStaffModal({ isOpen, onClose, onSaved, existingStaff = [] }) {
  const [form, setForm] = useState(makeEmptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setForm(makeEmptyForm());
    setErrors({});
    setSaving(false);
    setShowPw(false);
    setFormError('');
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const set = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'staff_type' && value === STAFF_TYPES.FRONT_DESK && !prev.password ? { password: generateStaffPassword() } : {}),
    }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  const isGroomer = form.staff_type === STAFF_TYPES.GROOMER;
  const previewName = `${form.first_name} ${form.last_name}`.trim();
  const previewEmail = form.email || '-';
  const previewPassword = isGroomer ? 'Not required' : form.password ? 'Ready' : 'Required';

  const validate = () => {
    const next = {};
    const fullName = normalizeName(`${form.first_name} ${form.last_name}`);
    const normalizedPhone = cleanPhone(form.contact_number);
    if (!form.first_name.trim()) next.first_name = 'First name is required.';
    if (!form.last_name.trim()) next.last_name = 'Last name is required.';
    if (!isGroomer && !form.contact_number.trim()) next.contact_number = 'Contact number is required for Front Desk staff.';
    else if (!phoneRegex.test(normalizedPhone)) next.contact_number = 'Use 09XXXXXXXXX format.';

    if (fullName && normalizedPhone && Array.isArray(existingStaff)) {
      const hasDuplicate = existingStaff.some((staff) => {
        const staffName = normalizeName(staff?.name);
        const staffPhone = cleanPhone(staff?.contact_number || staff?.phone || '');
        return staffName === fullName && staffPhone === normalizedPhone;
      });
      if (hasDuplicate) {
        next.contact_number = 'Duplicate staff detected: same name and contact number already exists.';
      }
    }

    if (!isGroomer && !form.email.trim()) next.email = 'Email is required for Front Desk staff.';
    if (!isGroomer && !form.password) next.password = 'Password is required.';
    if (!isGroomer && form.password && form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const legacyBody = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.contact_number.trim() ? cleanPhone(form.contact_number) : null,
        role: 'staff',
        staff_type: form.staff_type,
        is_active: form.is_active,
      };
      if (form.email.trim()) {
        legacyBody.email = form.email.trim();
      }
      if (!isGroomer) {
        legacyBody.password = form.password;
      }

      let response = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyBody),
      });

      if (!response.ok && [404, 405].includes(response.status)) {
        const staffBody = {
          name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
          contact_number: form.contact_number.trim() ? cleanPhone(form.contact_number) : null,
          staff_type: form.staff_type,
          is_active: form.is_active,
        };
        if (form.email.trim()) {
          staffBody.email = form.email.trim();
        }
        if (!isGroomer) {
          staffBody.password = form.password;
        }
        response = await apiFetch('/admin/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(staffBody),
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'Failed to add staff.';
        setFormError(msg);
        return;
      }

      onSaved?.('Staff created successfully.', data?.data?.id ?? null);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={handleClose}>
      <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} style={{ contain: 'layout style paint' }}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Add Staff</h2>
          <button type="button" onClick={handleClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_300px]">
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 no-scrollbar">
              {formError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{formError}</p>}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="First Name" required error={errors.first_name}>
                  <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                </Field>
                <Field label="Last Name" required error={errors.last_name}>
                  <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Staff Type">
                  <SelectDropdown
                    value={form.staff_type}
                    onChange={(v) => set('staff_type', v)}
                    options={[{ value: STAFF_TYPES.FRONT_DESK, label: 'Front Desk' }, { value: STAFF_TYPES.GROOMER, label: 'Groomer' }]}
                  />
                </Field>
                <Field label="Status">
                  <SelectDropdown
                    value={form.is_active ? 'Active' : 'Inactive'}
                    onChange={(v) => set('is_active', v === 'Active')}
                    options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
                  />
                </Field>
              </div>

              <Field label="Contact Number" required={!isGroomer} error={errors.contact_number}>
                <input
                  value={form.contact_number}
                  onChange={(e) => set('contact_number', formatPhoneInput(e.target.value))}
                  placeholder="09XXXXXXXXX"
                  inputMode="tel"
                  maxLength={13}
                  aria-invalid={Boolean(errors.contact_number)}
                  className={`w-full rounded-xl bg-white px-3 py-2.5 text-sm text-brand-dark focus:outline-none ${
                    errors.contact_number
                      ? 'border border-red-300 focus:border-red-400'
                      : 'border border-brand-dark-light focus:border-brand-teal'
                  }`}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Email" required={!isGroomer} error={errors.email}>
                  <input type="email" autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                </Field>
                {!isGroomer && (
                  <Field label="Password" required error={errors.password}>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} autoComplete="off" value={form.password} onChange={(e) => set('password', e.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 pr-20 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                      <button type="button" onClick={() => set('password', generateStaffPassword())} className="absolute right-10 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark" aria-label="Suggest password" title="Suggest password">
                        <RefreshCw size={14} />
                      </button>
                      <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark" aria-label={showPw ? 'Hide password' : 'Show password'}>
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>
                )}
                {isGroomer && <div />}
              </div>
            </div>

            <StaffSummary
              title="Preview"
              name={previewName || 'New Staff'}
              rows={[
                ['Staff Type', staffLabel(form.staff_type)],
                ['Status', form.is_active ? 'Active' : 'Inactive'],
                ['Contact', form.contact_number || '-'],
                ['Email', previewEmail],
                ['Password', previewPassword],
              ]}
            />
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-brand-dark-light px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-brand-dark-light bg-white px-5 py-2 text-sm font-medium text-brand-dark-soft transition hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:ring-offset-2 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-brand-teal px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60">{saving ? 'Saving...' : 'Add Staff'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required = false, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-brand-dark">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-500">
          <AlertCircle size={12} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
