import { ChevronDown, Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import PetRegistration from '../../../pets/PetRegistration';
import {
  avatarColor,
  composeAddress,
  getInitials,
  normalizeEmail,
  normalizePHPhone,
  validateCustomerCommon,
} from '../customerUtils';
import PHAddressFields from '../../../../../components/reusable-ui/PHAddressFields';
import SelectDropdown from '../../../../../components/reusable-ui/SelectDropdown';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character', test: (p) => /[!@#$%^&*()\-_=+{};:,<.>]/.test(p) },
];

const STRENGTH_BAR = ['bg-gray-200', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500'];
const STRENGTH_LABEL = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

export default function AddCustomerModal({ isOpen, onClose, onSaved }) {
  const EMPTY = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    address_unit_floor: '',
    address_street: '',
    address_barangay: '',
    address_city: '',
    address_province: '',
    address_postal_code: '',
    address_country: 'PH',
    preferred_contact: 'email',
    ec_first_name: '',
    ec_last_name: '',
    ec_phone: '',
    ec_email: '',
  };

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showEC, setShowEC] = useState(false);
  const [isPetRegistrationOpen, setIsPetRegistrationOpen] = useState(false);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  const resetAll = () => {
    setForm(EMPTY);
    setErrors({});
    setFormError('');
    setShowPw(false);
    setShowEC(false);
    setIsPetRegistrationOpen(false);
  };

  const handleClose = () => {
    resetAll();
    onClose?.();
  };

  const validate = () => {
    const nextErrors = validateCustomerCommon(form);
    if (!form.password.trim()) nextErrors.password = 'Password is required.';
    else if (form.password.length < 8) nextErrors.password = 'Min. 8 characters.';
    return nextErrors;
  };

  const handleContinue = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
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
    setForm((prev) => ({ ...prev, address: normalizedAddress }));
    setFormError('');
    setIsPetRegistrationOpen(true);
  };

  if (!isOpen) return null;

  const previewName = `${form.first_name} ${form.last_name}`.trim();
  const previewAddress = composeAddress(form) || '-';
  const previewEmergencyName = `${form.ec_first_name} ${form.ec_last_name}`.trim();
  const pwStrength = PASSWORD_RULES.filter((rule) => rule.test(form.password)).length;

  return (
    <>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={handleClose}>
        <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} style={{ contain: 'layout style paint' }}>
          <div className="flex shrink-0 items-center justify-between bg-brand-teal px-6 py-4">
            <h2 className="text-base font-semibold text-white">Add New Customer</h2>
            <button type="button" onClick={handleClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close">
              <X size={16} strokeWidth={2.8} />
            </button>
          </div>
          <div className="h-1 shrink-0 bg-white" />

          <form onSubmit={handleContinue} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_300px]">
              <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5 no-scrollbar">
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{formError}</div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">First Name <span className="text-red-500">*</span></label>
                    <input value={form.first_name} onChange={(event) => set('first_name', event.target.value)} placeholder="Juan" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                    {errors.first_name && <p className="mt-1 text-[11px] text-red-500">{errors.first_name}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Last Name <span className="text-red-500">*</span></label>
                    <input value={form.last_name} onChange={(event) => set('last_name', event.target.value)} placeholder="Dela Cruz" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                    {errors.last_name && <p className="mt-1 text-[11px] text-red-500">{errors.last_name}</p>}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} onBlur={(event) => set('email', normalizeEmail(event.target.value))} placeholder="juan@example.com" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                  {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">Phone Number <span className="text-red-500">*</span></label>
                  <input value={form.phone} onChange={(event) => set('phone', normalizePHPhone(event.target.value))} inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                  {errors.phone && <p className="mt-1 text-[11px] text-red-500">{errors.phone}</p>}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">Address <span className="text-red-500">*</span></p>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Street Address <span className="text-red-500">*</span></label>
                    <input
                      value={form.address_street}
                      onChange={(event) => set('address_street', event.target.value)}
                      placeholder="e.g. 207 F. Blumentritt St."
                      className={`w-full rounded-xl border ${errors.address_street ? 'border-red-400' : 'border-brand-dark-light'} bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none`}
                    />
                    {errors.address_street && <p className="mt-1 text-[11px] text-red-500">{errors.address_street}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PHAddressFields
                      form={form}
                      onFieldChange={set}
                      errors={errors}
                      variant="light"
                      requiredFields={['address_province', 'address_city', 'address_barangay', 'address_postal_code']}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">Preferred Contact</label>
                  <SelectDropdown
                    value={form.preferred_contact}
                    onChange={(value) => set('preferred_contact', value)}
                    options={[{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'both', label: 'Both' }]}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                      <input type={showPw ? 'text' : 'password'} autoComplete="off" value={form.password} onChange={(event) => set('password', event.target.value)} placeholder="Min. 8 characters" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2.5 pr-10 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none" />
                    <button type="button" onClick={() => setShowPw((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((index) => (
                          <div key={index} className={`h-1 flex-1 rounded-full ${index <= pwStrength ? STRENGTH_BAR[pwStrength] : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] font-semibold text-brand-dark-soft">{STRENGTH_LABEL[pwStrength]}</p>
                    </div>
                  )}
                  {errors.password && <p className="mt-1 text-[11px] text-red-500">{errors.password}</p>}
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
                        <input value={form.ec_first_name} onChange={(event) => set('ec_first_name', event.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-brand-dark">Last Name</label>
                        <input value={form.ec_last_name} onChange={(event) => set('ec_last_name', event.target.value)} className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-brand-dark">Email</label>
                      <input value={form.ec_email} autoComplete="off" onChange={(event) => set('ec_email', event.target.value)} onBlur={(event) => set('ec_email', normalizeEmail(event.target.value))} placeholder="emergency@email.com" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                      {errors.ec_email && <p className="mt-1 text-[11px] text-red-500">{errors.ec_email}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-brand-dark">Phone</label>
                      <input value={form.ec_phone} onChange={(event) => set('ec_phone', normalizePHPhone(event.target.value))} inputMode="numeric" maxLength={11} placeholder="09XXXXXXXXX" className="w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none" />
                      {errors.ec_phone && <p className="mt-1 text-[11px] text-red-500">{errors.ec_phone}</p>}
                    </div>
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
                      <p className="text-base font-semibold text-brand-dark">{previewName || 'New Customer'}</p>
                      <p className="break-all text-xs text-brand-dark-soft">{String(form.email || '').trim() || '-'}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-xs">
                    <PreviewRow label="Phone" value={form.phone} />
                    <PreviewRow
                      label="Preferred Contact"
                      value={form.preferred_contact ? `${form.preferred_contact[0].toUpperCase()}${form.preferred_contact.slice(1)}` : '-'}
                    />
                    <PreviewRow label="Address" value={previewAddress} />
                  </div>
                  <div className="border-t border-brand-dark-light pt-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Emergency Contact</p>
                    <div className="space-y-3 text-xs">
                      <PreviewRow label="Name" value={previewEmergencyName} />
                      <PreviewRow label="Phone" value={form.ec_phone} />
                      <PreviewRow label="Email" value={form.ec_email} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-brand-dark-light px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
              <button type="button" onClick={handleClose} className="rounded-xl border border-brand-dark-light bg-white px-4 py-2 text-xs font-medium text-brand-dark-soft transition hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:ring-offset-2 sm:px-6 sm:py-2.5 sm:text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-brand-teal px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] sm:px-6 sm:py-2.5 sm:text-sm">
                Continue Pet Registration
              </button>
            </div>
          </form>
        </div>
      </div>

      <PetRegistration
        isOpen={isPetRegistrationOpen}
        ownerForm={{ ...form, address: composeAddress(form) }}
        onBack={() => setIsPetRegistrationOpen(false)}
        onClose={handleClose}
        onRegistered={(message) => {
          onSaved?.(message || 'Customer and pet registered successfully.');
          resetAll();
          onClose?.();
        }}
      />
    </>
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
