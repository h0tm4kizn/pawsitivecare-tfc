import { ChevronDown, X } from 'lucide-react';
import PHAddressFields from '../../../../../components/reusable-ui/PHAddressFields';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../../../api/apiClient';
import {
  avatarColor,
  composeAddress,
  getInitials,
  normalizeEmail,
  normalizePHPhone,
  validateCustomerCommon,
} from '../customerUtils';
import RELATIONSHIP_OPTIONS from '../../../../../constants/emergencyRelationships';
import SelectDropdown from '../../../../../components/reusable-ui/SelectDropdown';

const cleanCorruptValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text || /[\uFFFD\u00EF\u00BF\u00BD]/.test(text)) return '';
  return text;
};

export default function EditCustomerModal({ owner, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: owner?.first_name || '',
    last_name: owner?.last_name || '',
    email: cleanCorruptValue(owner?.email),
    phone: cleanCorruptValue(owner?.phone),
    address: cleanCorruptValue(owner?.address),
    address_unit_floor: owner?._raw?.address_unit_floor || owner?.address_unit_floor || '',
    address_street: owner?._raw?.address_street || owner?.address_street || '',
    address_barangay: owner?._raw?.address_barangay || owner?.address_barangay || '',
    address_city: owner?._raw?.address_city || owner?.address_city || '',
    address_province: owner?._raw?.address_province || owner?.address_province || '',
    address_postal_code: owner?._raw?.address_postal_code || owner?.address_postal_code || '',
    address_country: owner?._raw?.address_country || owner?.address_country || 'PH',
    preferred_contact: owner?._raw?.preferred_contact || owner?.preferred_contact || 'email',
    ec_first_name: owner?._raw?.ec_first_name || owner?.ec_first_name || '',
    ec_last_name: owner?._raw?.ec_last_name || owner?.ec_last_name || '',
    ec_phone: owner?._raw?.ec_phone || owner?.ec_phone || '',
    ec_email: owner?._raw?.ec_email || owner?.ec_email || '',
    ec_relationship: owner?._raw?.ec_relationship || owner?.ec_relationship || '',
    is_active: owner?.is_active ?? true,
    deactivation_reason: owner?.deactivation_reason || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showEC, setShowEC] = useState(Boolean(owner?._raw?.ec_first_name || owner?._raw?.ec_last_name || owner?._raw?.ec_phone || owner?._raw?.ec_email));

  const previewName = useMemo(() => `${form.first_name} ${form.last_name}`.trim(), [form.first_name, form.last_name]);
  const previewAddress = useMemo(() => composeAddress(form), [form]);
  const previewEmergencyName = useMemo(() => `${form.ec_first_name} ${form.ec_last_name}`.trim(), [form.ec_first_name, form.ec_last_name]);
  const previewEmergencyRelationship = RELATIONSHIP_OPTIONS.find((option) => option.value === form.ec_relationship)?.label || form.ec_relationship;
  const previewPreferredContact = {
    email: 'Email',
    phone: 'Phone',
    both: 'Email and Phone',
  }[form.preferred_contact] || 'Email';

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setError('');
  };

  const validate = () => {
    const next = validateCustomerCommon(form);
    if (!form.is_active && !form.deactivation_reason.trim()) {
      next.deactivation_reason = 'Reason is required when deactivating customer.';
    }
    return next;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setSaving(true);
    setError('');

    const normalizedAddress = composeAddress({
      ...form,
      address_unit_floor: (form.address_unit_floor || '').trim(),
      address_street: form.address_street.trim(),
      address_barangay: form.address_barangay.trim(),
      address_city: form.address_city.trim(),
      address_province: form.address_province.trim(),
      address_postal_code: form.address_postal_code.trim(),
      address_country: 'PH',
    });

    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim().replace(/[-\s]/g, ''),
        address: normalizedAddress || null,
        address_unit_floor: (form.address_unit_floor || '').trim() || null,
        address_street: form.address_street.trim() || null,
        address_barangay: form.address_barangay.trim() || null,
        address_city: form.address_city.trim() || null,
        address_province: form.address_province.trim() || null,
        address_postal_code: form.address_postal_code.trim() || null,
        address_country: 'PH',
        preferred_contact: form.preferred_contact,
        ec_first_name: form.ec_first_name.trim() || null,
        ec_last_name: form.ec_last_name.trim() || null,
        ec_phone: form.ec_phone.trim() || null,
        ec_email: form.ec_email.trim() || null,
        ec_relationship: form.ec_relationship || null,
        is_active: form.is_active,
        ...(!form.is_active ? { deactivation_reason: form.deactivation_reason.trim() } : { deactivation_reason: null }),
      };

      const response = await apiFetch(`/api/owners/${owner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'Failed to update customer.';
        setError(message);
        return;
      }

      onSaved?.(data?.queued ? 'Offline: customer update queued.' : 'Customer updated successfully.');
    } catch (exception) {
      setError(exception?.message || 'Failed to update customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} style={{ contain: 'layout style paint' }}>
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-6 py-4">
          <h2 className="text-base font-semibold text-white">Edit Customer</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close">
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        <form onSubmit={handleSave} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_300px]">
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 pb-10 pt-5 no-scrollbar">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">First Name <span className="text-red-500">*</span></label>
                  <input value={form.first_name} onChange={(event) => setField('first_name', event.target.value)} placeholder="Juan" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                  {fieldErrors.first_name && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.first_name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">Last Name <span className="text-red-500">*</span></label>
                  <input value={form.last_name} onChange={(event) => setField('last_name', event.target.value)} placeholder="Dela Cruz" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                  {fieldErrors.last_name && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.last_name}</p>}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-dark">Email <span className="text-red-500">*</span></label>
                <input type="email" autoComplete="off" value={form.email} onChange={(event) => setField('email', event.target.value)} onBlur={(event) => setField('email', normalizeEmail(event.target.value))} placeholder="juan@example.com" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                {fieldErrors.email && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-dark">Phone Number <span className="text-red-500">*</span></label>
                <input value={form.phone} onChange={(event) => setField('phone', normalizePHPhone(event.target.value))} inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                {fieldErrors.phone && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.phone}</p>}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">Address <span className="text-red-500">*</span></p>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">Street Address <span className="text-red-500">*</span></label>
                  <input
                    value={form.address_street}
                    onChange={(event) => setField('address_street', event.target.value)}
                    placeholder="e.g. 207 F. Blumentritt St."
                    className={`w-full rounded-xl border ${fieldErrors.address_street ? 'border-red-400' : 'border-brand-dark-light'} bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none`}
                  />
                  {fieldErrors.address_street && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.address_street}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PHAddressFields
                    form={form}
                    onFieldChange={setField}
                    errors={fieldErrors}
                    variant="light"
                    requiredFields={['address_province', 'address_city', 'address_barangay', 'address_postal_code']}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-dark">Preferred Contact</label>
                <SelectDropdown
                  value={form.preferred_contact}
                  onChange={(value) => setField('preferred_contact', value)}
                  options={[{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'both', label: 'Both' }]}
                />
              </div>

              <button type="button" onClick={() => setShowEC((value) => !value)} className="flex w-full items-center justify-between rounded-xl border border-brand-dark-light bg-[#f6f8fa] px-4 py-2.5 text-xs font-semibold text-brand-dark hover:bg-[#eef2f5]">
                <span>Emergency Contact <span className="font-semibold text-brand-dark-soft">(Optional)</span></span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${showEC ? 'rotate-180' : ''}`} />
              </button>

              {showEC && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-brand-dark-soft">Add a trusted contact we can reach in case of emergency.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-brand-dark">First Name</label>
                      <input value={form.ec_first_name} onChange={(event) => setField('ec_first_name', event.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-brand-dark">Last Name</label>
                      <input value={form.ec_last_name} onChange={(event) => setField('ec_last_name', event.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Email</label>
                    <input value={form.ec_email} autoComplete="off" onChange={(event) => setField('ec_email', event.target.value)} onBlur={(event) => setField('ec_email', normalizeEmail(event.target.value))} placeholder="emergency@email.com" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                    {fieldErrors.ec_email && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.ec_email}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Phone</label>
                    <input value={form.ec_phone} onChange={(event) => setField('ec_phone', normalizePHPhone(event.target.value))} inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                    {fieldErrors.ec_phone && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.ec_phone}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Relationship</label>
                    <SelectDropdown
                      value={form.ec_relationship}
                      onChange={(value) => setField('ec_relationship', value)}
                      options={[{ value: '', label: 'Select relationship' }, ...RELATIONSHIP_OPTIONS]}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-dark">Status</label>
                <SelectDropdown
                  value={form.is_active ? 'active' : 'inactive'}
                  onChange={(value) => setField('is_active', value === 'active')}
                  options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Deactivated' }]}
                />
              </div>

              {!form.is_active && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">Deactivation Reason <span className="text-red-500">*</span></label>
                  <textarea
                    value={form.deactivation_reason}
                    onChange={(event) => setField('deactivation_reason', event.target.value)}
                    rows={3}
                    placeholder="Write reason for deactivation..."
                    className="w-full resize-none rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm focus:border-brand-teal focus:outline-none"
                  />
                  {fieldErrors.deactivation_reason && <p className="mt-1 text-[11px] text-red-500">{fieldErrors.deactivation_reason}</p>}
                </div>
              )}
            </div>

            <div className="hidden border-l border-brand-dark-light px-5 py-5 lg:flex lg:overflow-y-auto">
              <div className="flex h-full w-full flex-col gap-4 pb-10">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Preview</p>
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white ${avatarColor(previewName || 'N')}`}>
                    {getInitials(previewName) || '?'}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-brand-dark">{previewName || 'Customer'}</p>
                    <p className="break-all text-xs text-brand-dark-soft">{String(form.email || '').trim() || '-'}</p>
                  </div>
                </div>
                <div className="space-y-3 text-xs">
                  <PreviewRow label="Phone" value={form.phone} />
                  <PreviewRow label="Preferred Contact" value={previewPreferredContact} />
                  <PreviewRow label="Address" value={previewAddress} />
                  <PreviewRow label="Status" value={form.is_active ? 'Active' : 'Deactivated'} valueClassName={form.is_active ? 'text-brand-teal' : 'text-red-500'} />
                  {!form.is_active && <PreviewRow label="Reason" value={form.deactivation_reason} />}
                </div>
                <div className="border-t border-brand-dark-light pt-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Emergency Contact</p>
                  <div className="space-y-3 text-xs">
                    <PreviewRow label="Name" value={previewEmergencyName} />
                    <PreviewRow label="Phone" value={form.ec_phone} />
                    <PreviewRow label="Email" value={form.ec_email} />
                    <PreviewRow label="Relationship" value={previewEmergencyRelationship} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-3 border-t border-brand-dark-light bg-white px-6 py-4">
            <button type="submit" disabled={saving} className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewRow({ label, value, valueClassName = 'text-brand-dark' }) {
  const displayValue = String(value || '').trim() || '-';

  return (
    <div>
      <p className="font-semibold text-brand-dark-soft">{label}</p>
      <p className={`mt-0.5 break-words font-semibold leading-snug ${valueClassName}`}>{displayValue}</p>
    </div>
  );
}
