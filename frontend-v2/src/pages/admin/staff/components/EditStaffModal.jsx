import { Eye, EyeOff, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../../api/apiClient';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import { DEACTIVATION_REASONS } from '../../../../constants/staffActionReasons';
import {
  cleanPhone,
  formatPhoneInput,
  formatStaffId,
  phoneRegex,
  staffLabel,
} from '../staffUiUtils';
import StaffSummary from './StaffSummary';
import { STAFF_TYPES } from '../../../../utils/staffTypes';

export default function EditStaffModal({ staff, onClose, onSaved }) {
  const nameParts = useMemo(() => String(staff?.name || '').split(' '), [staff?.name]);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    contact_number: staff?.contact_number || '',
    email: staff?.email || '',
    password: '',
    staff_type: staff?.staff_type || STAFF_TYPES.FRONT_DESK,
    is_active: staff?.is_active ?? true,
    deactivation_reason: staff?.deactivation_reason || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isGroomer = form.staff_type === STAFF_TYPES.GROOMER;
  const previewName = `${form.first_name} ${form.last_name}`.trim();
  const previewEmail = form.email || '-';
  const previewReason = form.deactivation_reason === 'other' ? form._deactivation_other : form.deactivation_reason;

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim()) e.last_name = 'Last name is required.';
    if (form.contact_number.trim() && !phoneRegex.test(cleanPhone(form.contact_number))) {
      e.contact_number = 'Invalid number. Use 09XXXXXXXXX format.';
    }
    if (!isGroomer && !form.email.trim()) e.email = 'Email is required for Front Desk staff.';
    if (form.password && form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!form.is_active && !form.deactivation_reason.trim()) {
      e.deactivation_reason = 'Deactivation reason is required when status is Deactivated.';
    }
    if (!form.is_active && form.deactivation_reason === 'other' && !(form._deactivation_other || '').trim()) {
      e.deactivation_reason = 'Please provide details for the deactivation reason.';
    }
    return e;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const legacyBody = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: staff?.role || 'staff',
        staff_type: form.staff_type,
        is_active: form.is_active,
        deactivation_reason: form.is_active ? null : (form.deactivation_reason === 'other' ? (form._deactivation_other || '').trim() : form.deactivation_reason.trim()),
      };
      legacyBody.phone = form.contact_number.trim() ? cleanPhone(form.contact_number) : null;
      legacyBody.email = form.email.trim() || null;
      if (form.password) legacyBody.password = form.password;

      let response = await apiFetch(`/api/admin/staff/${staff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
          staff_type: form.staff_type,
          is_active: form.is_active,
          deactivation_reason: form.is_active ? null : (form.deactivation_reason === 'other' ? (form._deactivation_other || '').trim() : form.deactivation_reason.trim()),
          contact_number: form.contact_number.trim() ? cleanPhone(form.contact_number) : null,
          email: form.email.trim() || null,
          ...(form.password ? { password: form.password } : {}),
        }),
      });

      if (!response.ok && [404, 405].includes(response.status)) {
        response = await apiFetch(`/api/admin/users/${staff.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(legacyBody),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'Failed to update staff.';
        setFormError(msg);
        return;
      }

      onSaved?.('Staff updated successfully.');
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} style={{ contain: 'layout style paint' }}>
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-6 py-4">
          <h2 className="text-base font-semibold text-white">Edit Staff</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close">
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        <form onSubmit={handleSubmit} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_300px]">
            <div className="min-h-0 overflow-y-auto px-6 py-5 no-scrollbar">
              {formError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Staff Type" required>
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

                {!form.is_active && (
                  <Field label="Deactivation Reason" required error={errors.deactivation_reason}>
                    <SelectDropdown
                      value={form.deactivation_reason || ''}
                      onChange={(v) => set('deactivation_reason', v)}
                      options={[{ value: '', label: 'Select reason' }, ...DEACTIVATION_REASONS]}
                      placeholder="Select reason"
                    />
                    {form.deactivation_reason === 'other' && (
                      <textarea
                        value={form._deactivation_other || ''}
                        onChange={(e) => set('_deactivation_other', e.target.value)}
                        rows={3}
                        placeholder="Write reason for deactivation..."
                        className="mt-3 w-full resize-none rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                    )}
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" required error={errors.first_name}>
                    <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  </Field>
                  <Field label="Last Name" required error={errors.last_name}>
                    <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  </Field>
                </div>

                <Field label="Contact Number" error={errors.contact_number}>
                  <input
                    value={form.contact_number}
                    onChange={(e) => set('contact_number', formatPhoneInput(e.target.value))}
                    placeholder="09XXXXXXXXX"
                    inputMode="tel"
                    maxLength={13}
                    className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Email" required={!isGroomer} error={errors.email}>
                    <input type="email" autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  </Field>
                  {!isGroomer && (
                    <Field label="Password" error={errors.password}>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} autoComplete="off" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Leave blank to keep current" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 pr-10 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark">
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            </div>

            <StaffSummary
              title="Preview"
              name={previewName || 'Staff'}
              staffId={staff?.display_id}
              staffUuid={staff?.id}
              rows={[
                ['Staff ID', formatStaffId(staff, 0)],
                ['Staff Type', staffLabel(form.staff_type)],
                ['Status', form.is_active ? 'Active' : 'Inactive'],
                ['Contact', form.contact_number || '-'],
                ['Email', previewEmail],
                ['Password', form.password ? 'Will be updated' : 'Unchanged'],
                ...(!form.is_active ? [['Reason', previewReason || '-']] : []),
              ]}
            />
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-brand-dark-light px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-brand-dark-light bg-white px-6 py-2.5 text-sm font-medium text-brand-dark-soft transition hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:ring-offset-2 disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
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
      {error ? <p className="mt-1 text-[11px] text-red-500">{error}</p> : null}
    </div>
  );
}
