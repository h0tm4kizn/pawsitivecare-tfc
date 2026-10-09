import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import RELATIONSHIP_OPTIONS from '../../../constants/emergencyRelationships';
import { apiGet, apiFetch } from '../../../api/apiClient';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import ClientSecurityTab from './ClientSecurityTab';
import { AdminLoadState, AdminSkeleton } from '../../../components/admin/AdminLoading';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import {
  getInitials,
  PH_PHONE_REGEX,
  normalizeEmail,
  normalizePHPhone,
  combineName,
  splitFullName,
  inputCls,
  ProfileRow,
  CompactProfileRow,
} from './sidebarHelpers';

export default function ClientProfileDrawer({
  isOpen,
  onClose,
  currentUser,
  onLogoutClick,
}) {
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState('profile');
  const [showECForm, setShowECForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    unit_floor: '',
    street_address: '',
    barangay: '',
    city_municipality: '',
    province: '',
    postal_code: '',
    country: '',
    ec_name: '',
    ec_phone: '',
    ec_relationship: '',
  });

  useBodyScrollLock(isOpen);

  const displayName =
    currentUser?.name ||
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
    currentUser?.email ||
    'Fur Parent';

  const panelName =
    [profile?.first_name || '', profile?.last_name || ''].filter(Boolean).join(' ').trim() ||
    form.name ||
    displayName;

  const panelAddress =
    profile?.address ||
    [
      form.barangay && `Brgy. ${form.barangay}`,
      form.city_municipality,
      form.province,
    ]
      .filter(Boolean)
      .join(', ') ||
    '';

  const panelEmail = form.email || profile?.email || currentUser?.email || '';
  const panelPhone = form.phone || profile?.phone || currentUser?.phone || '—';

  const hasECData = Boolean(
    form.ec_name ||
    form.ec_phone ||
    form.ec_relationship ||
    profile?.ec_name ||
    profile?.emergency_contact_name ||
    profile?.ec_first_name ||
    profile?.ec_last_name ||
    profile?.ec_phone ||
    profile?.emergency_contact_phone ||
    profile?.ec_relationship ||
    profile?.emergency_contact_relationship
  );

  const openProfile = ({ keepEmergencyFormOpen = false, syncEmergencyForm = true } = {}) => {
    setProfileLoading(true);
    setProfileLoadError('');
    apiGet('/api/my-profile')
      .then((r) => {
        if (!r.ok) throw new Error('Unable to load your profile.');
        return r.json();
      })
      .then((d) => {
        const p = d?.data ?? d;
        if (!p) return;
        setProfile(p);
        const newForm = {
          name: p.name || [p.first_name, p.last_name].filter(Boolean).join(' ').trim(),
          email: p.email || '',
          phone: p.phone || '',
          unit_floor: p.address_unit_floor || p.unit_floor || '',
          street_address: p.address_street || p.street_address || '',
          barangay: p.address_barangay || p.barangay || '',
          city_municipality: p.address_city || p.city_municipality || '',
          province: p.address_province || p.province || '',
          postal_code: p.address_postal_code || p.postal_code || '',
          country: p.address_country || p.country || 'PH',
          ec_name:
            p.ec_name ||
            p.emergency_contact_name ||
            combineName(p.ec_first_name, p.ec_last_name),
          ec_phone: p.ec_phone || p.emergency_contact_phone || '',
          ec_relationship: p.ec_relationship || p.emergency_contact_relationship || '',
        };
        setForm(newForm);
        setShowECForm(
          keepEmergencyFormOpen ||
            (syncEmergencyForm &&
              !!(
                p.ec_name ||
                p.emergency_contact_name ||
                p.ec_first_name ||
                p.ec_last_name ||
                p.ec_phone ||
                p.emergency_contact_phone ||
                p.ec_relationship ||
                p.emergency_contact_relationship
              ))
        );
      })
      .catch((error) => setProfileLoadError(error?.message || 'Unable to load your profile.'))
      .finally(() => setProfileLoading(false));
  };

  const openProfileEditor = () => {
    setProfileEditMode('profile');
    setShowECForm(false);
    setSaveError('');
    setFieldErrors({});
    setIsEditing(true);
    openProfile({ syncEmergencyForm: false });
  };

  const openEmergencyContactEditor = () => {
    setTab('profile');
    setProfileEditMode('emergency');
    setSaveError('');
    setFieldErrors({});
    setIsEditing(true);
    setShowECForm(true);
    openProfile({ keepEmergencyFormOpen: true });
  };

  useEffect(() => {
    if (!isOpen) return;
    openProfile();
    setTab('profile');
    setProfileEditMode('profile');
    setIsEditing(false);
    setSaveError('');
    setFieldErrors({});
  }, [isOpen]);

  const validateAddressFields = () => {
    const errs = {};
    if (!form.street_address.trim()) errs.street_address = 'Required.';
    if (!form.barangay.trim()) errs.barangay = 'Required.';
    if (!form.city_municipality.trim()) errs.city_municipality = 'Required.';
    if (!form.province.trim()) errs.province = 'Required.';
    if (!form.postal_code.trim()) errs.postal_code = 'Required.';
    if (!form.country.trim()) errs.country = 'Required.';
    return errs;
  };

  const validateProfileDraft = () => {
    const errs = {};
    const normalizedEmail = normalizeEmail(form.email);
    const normalizedPhone = normalizePHPhone(form.phone);
    const normalizedPostal = String(form.postal_code || '').replace(/\D/g, '').slice(0, 4);
    const normalizedCountry = 'PH';
    if (!form.name.trim()) errs.name = 'Required.';
    if (!normalizedEmail) errs.email = 'Required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
      errs.email = 'Please enter a valid email address.';
    if (!normalizedPhone) errs.phone = 'Required.';
    else if (!PH_PHONE_REGEX.test(normalizedPhone)) errs.phone = 'Use PH format: 09XXXXXXXXX.';
    if (normalizedPostal.length !== 4) errs.postal_code = 'Use 4-digit postal code.';
    if (normalizedCountry !== 'PH') errs.country = 'Country must be PH.';
    if (showECForm && form.ec_phone.trim() && !PH_PHONE_REGEX.test(normalizePHPhone(form.ec_phone)))
      errs.ec_phone = 'Use PH format: 09XXXXXXXXX.';
    Object.assign(errs, validateAddressFields());
    return errs;
  };

  const handleSave = async () => {
    const errs = {};
    const isEmergencyEdit = profileEditMode === 'emergency';
    const normalizedEmail = normalizeEmail(form.email);
    const normalizedPhone = normalizePHPhone(form.phone);
    const normalizedEcPhone = normalizePHPhone(form.ec_phone);
    const normalizedPostal = String(form.postal_code || '').replace(/\D/g, '').slice(0, 4);
    const normalizedCountry = 'PH';
    if (isEmergencyEdit) {
      if (showECForm && form.ec_phone.trim() && !PH_PHONE_REGEX.test(normalizedEcPhone))
        errs.ec_phone = 'Use PH format: 09XXXXXXXXX.';
    } else {
      if (!form.name.trim()) errs.name = 'Required.';
      if (!normalizedEmail) errs.email = 'Required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
        errs.email = 'Please enter a valid email address.';
      if (!normalizedPhone) errs.phone = 'Required.';
      else if (!PH_PHONE_REGEX.test(normalizedPhone)) errs.phone = 'Use PH format: 09XXXXXXXXX.';
      if (normalizedPostal.length !== 4) errs.postal_code = 'Use 4-digit postal code.';
      if (normalizedCountry !== 'PH') errs.country = 'Country must be PH.';
      const addressErrs = validateAddressFields();
      Object.assign(errs, addressErrs);
    }
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const parts = form.name.trim().split(/\s+/);
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ');
      const ecNameParts = splitFullName(form.ec_name);
      const payload = isEmergencyEdit
        ? {
            ec_first_name: showECForm ? ecNameParts.firstName || null : null,
            ec_last_name: showECForm ? ecNameParts.lastName || null : null,
            ec_phone: showECForm ? normalizedEcPhone || null : null,
            ec_relationship: showECForm ? form.ec_relationship.trim() || null : null,
          }
        : {
            first_name,
            last_name: last_name || null,
            email: normalizedEmail,
            phone: normalizedPhone || null,
            address_unit_floor: form.unit_floor.trim() || null,
            address_street: form.street_address.trim() || null,
            address_barangay: form.barangay.trim() || null,
            address_city: form.city_municipality.trim() || null,
            address_province: form.province.trim() || null,
            address_postal_code: normalizedPostal || null,
            address_country: normalizedCountry || 'PH',
            address:
              [
                [form.unit_floor.trim(), form.street_address.trim()].filter(Boolean).join(', '),
                form.barangay.trim() ? `Brgy. ${form.barangay.trim()}` : '',
                form.city_municipality.trim(),
                form.province.trim(),
                normalizedPostal,
                normalizedCountry || 'PH',
              ]
                .filter(Boolean)
                .join(', ') || null,
          };
      const res = await apiFetch('/api/my-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.errors) {
          const m = {};
          Object.entries(data.errors).forEach(([k, v]) => {
            m[k] = Array.isArray(v) ? v[0] : v;
          });
          setFieldErrors(m);
        } else setSaveError(data?.message || 'Failed to save.');
        return;
      }
      const responseProfile = data?.data ?? data;
      const p = {
        ...(profile || {}),
        ...responseProfile,
        ...(isEmergencyEdit
          ? {
              ec_first_name: payload.ec_first_name,
              ec_last_name: payload.ec_last_name,
              ec_phone: payload.ec_phone,
              ec_relationship: payload.ec_relationship,
            }
          : {}),
      };
      setProfile(p);
      setForm((prevForm) => ({
        name: p.name || [p.first_name, p.last_name].filter(Boolean).join(' ').trim(),
        email: p.email || '',
        phone: p.phone || '',
        unit_floor:
          (p.address_unit_floor ?? p.unit_floor) !== undefined
            ? p.address_unit_floor ?? p.unit_floor
            : prevForm.unit_floor,
        street_address:
          (p.address_street ?? p.street_address) !== undefined
            ? p.address_street ?? p.street_address
            : prevForm.street_address,
        barangay:
          (p.address_barangay ?? p.barangay) !== undefined
            ? p.address_barangay ?? p.barangay
            : prevForm.barangay,
        city_municipality:
          (p.address_city ?? p.city_municipality) !== undefined
            ? p.address_city ?? p.city_municipality
            : prevForm.city_municipality,
        province:
          (p.address_province ?? p.province) !== undefined
            ? p.address_province ?? p.province
            : prevForm.province,
        postal_code:
          (p.address_postal_code ?? p.postal_code) !== undefined
            ? p.address_postal_code ?? p.postal_code
            : prevForm.postal_code,
        country: p.country !== undefined ? p.country : prevForm.country,
        ec_name:
          isEmergencyEdit && !showECForm
            ? ''
            : p.ec_name ||
              p.emergency_contact_name ||
              combineName(p.ec_first_name, p.ec_last_name) ||
              prevForm.ec_name,
        ec_phone:
          isEmergencyEdit && !showECForm
            ? ''
            : p.ec_phone || p.emergency_contact_phone || prevForm.ec_phone,
        ec_relationship:
          isEmergencyEdit && !showECForm
            ? ''
            : p.ec_relationship || p.emergency_contact_relationship || prevForm.ec_relationship,
      }));
      setShowECForm(
        !!(
          p.ec_name ||
          p.emergency_contact_name ||
          p.ec_first_name ||
          p.ec_last_name ||
          p.ec_phone ||
          p.emergency_contact_phone ||
          p.ec_relationship ||
          p.emergency_contact_relationship
        )
      );
      setIsEditing(false);
    } catch {
      setSaveError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[140] bg-brand-dark/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-[150] flex h-screen w-[min(90vw,360px)] flex-col overflow-hidden border-l border-brand-teal/35 bg-brand-teal text-white shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-brand-teal-light/60 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white shrink-0">
              {getInitials(panelName)}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white truncate">{panelName}</p>
              <p className="text-sm font-medium text-brand-teal-light truncate">
                {panelEmail || 'Signed in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white"
            aria-label="Close profile panel"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex border-b border-brand-teal-light/60">
          <button
            type="button"
            onClick={() => {
              if (isEditing) {
                const errs = validateProfileDraft();
                if (Object.keys(errs).length) {
                  setFieldErrors(errs);
                  return;
                }
              }
              setTab('profile');
            }}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              tab === 'profile'
                ? 'bg-white/15 text-white'
                : 'text-brand-teal-light hover:bg-white/10'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => {
              if (isEditing) {
                const errs = validateProfileDraft();
                if (Object.keys(errs).length) {
                  setFieldErrors(errs);
                  return;
                }
              }
              setTab('password');
            }}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              tab === 'password'
                ? 'bg-white/15 text-white'
                : 'text-brand-teal-light hover:bg-white/10'
            }`}
          >
            Password
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-teal bg-brand-surface p-6 text-brand-dark">
          {tab === 'profile' ? (
            <>
              {saveError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {saveError}
                </p>
              )}
              {profileLoading && !profile ? (
                <div className="space-y-3" aria-label="Loading profile">
                  <AdminSkeleton variant="cards" rows={4} />
                </div>
              ) : profileLoadError && !profile ? (
                <AdminLoadState error={profileLoadError} onRetry={() => openProfile()} />
              ) : !isEditing ? (
                <div className="space-y-4">
                  <ProfileRow label="Name" value={panelName} />
                  <ProfileRow label="Email" value={panelEmail || ''} />
                  <ProfileRow label="Phone" value={panelPhone} />
                  <ProfileRow label="Address" value={panelAddress} />
                  {hasECData && (
                    <div className="pt-2">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand-teal">
                        Emergency Contact
                      </p>
                      <CompactProfileRow label="Name" value={form.ec_name || '—'} />
                      <CompactProfileRow label="Phone" value={form.ec_phone || '—'} />
                      <CompactProfileRow
                        label="Relation"
                        value={
                          RELATIONSHIP_OPTIONS.find((o) => o.value === form.ec_relationship)
                            ?.label ||
                          form.ec_relationship ||
                          '—'
                        }
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={openProfileEditor}
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-brand-teal bg-brand-teal py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-teal-dark"
                  >
                    <i className="fa-solid fa-pen text-xs" />
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={openEmergencyContactEditor}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-brand-teal bg-white py-2 text-xs font-semibold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                  >
                    <i className="fa-solid fa-shield-halved text-xs" />
                    {hasECData ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto scrollbar-teal space-y-3 rounded-xl border border-brand-dark-light bg-white p-5">
                    {profileEditMode === 'profile' && (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                            NAME
                          </label>
                          <input
                            value={form.name}
                            onChange={(e) => {
                              setForm((p) => ({ ...p, name: e.target.value }));
                              setFieldErrors((p) => ({ ...p, name: null }));
                            }}
                            className={inputCls(fieldErrors.name)}
                          />
                          {fieldErrors.name && (
                            <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                            EMAIL
                          </label>
                          <input
                            type="email"
                            value={form.email}
                            onChange={(e) => {
                              setForm((p) => ({ ...p, email: e.target.value }));
                              setFieldErrors((p) => ({ ...p, email: null }));
                            }}
                            onBlur={(e) =>
                              setForm((p) => ({ ...p, email: normalizeEmail(e.target.value) }))
                            }
                            className={inputCls(fieldErrors.email)}
                          />
                          {fieldErrors.email && (
                            <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                            PHONE
                          </label>
                          <input
                            value={form.phone}
                            onChange={(e) => {
                              setForm((p) => ({
                                ...p,
                                phone: normalizePHPhone(e.target.value),
                              }));
                              setFieldErrors((p) => ({ ...p, phone: null }));
                            }}
                            className={inputCls(fieldErrors.phone)}
                            maxLength={11}
                            inputMode="numeric"
                          />
                          {fieldErrors.phone && (
                            <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>
                          )}
                        </div>
                        <div className="space-y-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark-soft">
                            ADDRESS
                          </p>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                              Unit/Floor (Optional)
                            </label>
                            <input
                              value={form.unit_floor}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, unit_floor: e.target.value }))
                              }
                              className={inputCls(false)}
                              placeholder="Unit 3B"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                              Street Address
                            </label>
                            <input
                              value={form.street_address}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, street_address: e.target.value }));
                                setFieldErrors((p) => ({ ...p, street_address: null }));
                              }}
                              className={inputCls(fieldErrors.street_address)}
                              placeholder="207 F. Blumentritt St."
                            />
                            {fieldErrors.street_address && (
                              <p className="mt-1 text-xs text-red-500">
                                {fieldErrors.street_address}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                              Barangay
                            </label>
                            <input
                              value={form.barangay}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, barangay: e.target.value }));
                                setFieldErrors((p) => ({ ...p, barangay: null }));
                              }}
                              className={inputCls(fieldErrors.barangay)}
                              placeholder="Kabayanan"
                            />
                            {fieldErrors.barangay && (
                              <p className="mt-1 text-xs text-red-500">
                                {fieldErrors.barangay}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                              City / Municipality
                            </label>
                            <input
                              value={form.city_municipality}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, city_municipality: e.target.value }));
                                setFieldErrors((p) => ({ ...p, city_municipality: null }));
                              }}
                              className={inputCls(fieldErrors.city_municipality)}
                              placeholder="San Juan City"
                            />
                            {fieldErrors.city_municipality && (
                              <p className="mt-1 text-xs text-red-500">
                                {fieldErrors.city_municipality}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                              Province
                            </label>
                            <input
                              value={form.province}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, province: e.target.value }));
                                setFieldErrors((p) => ({ ...p, province: null }));
                              }}
                              className={inputCls(fieldErrors.province)}
                              placeholder="Metro Manila"
                            />
                            {fieldErrors.province && (
                              <p className="mt-1 text-xs text-red-500">
                                {fieldErrors.province}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                              Postal Code
                            </label>
                            <input
                              value={form.postal_code}
                              onChange={(e) => {
                                setForm((p) => ({
                                  ...p,
                                  postal_code: e.target.value.replace(/\D/g, '').slice(0, 4),
                                }));
                                setFieldErrors((p) => ({ ...p, postal_code: null }));
                              }}
                              className={inputCls(fieldErrors.postal_code)}
                              placeholder="1550"
                              maxLength={4}
                              inputMode="numeric"
                            />
                            {fieldErrors.postal_code && (
                              <p className="mt-1 text-xs text-red-500">
                                {fieldErrors.postal_code}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                              Country
                            </label>
                            <input value="PH" readOnly className={inputCls(false)} />
                            {fieldErrors.country && (
                              <p className="mt-1 text-xs text-red-500">{fieldErrors.country}</p>
                            )}
                          </div>
                          <div>
                            <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-dark-soft">
                              Formatted Address
                            </p>
                            <div className="rounded-lg bg-brand-surface px-3 py-2 text-xs text-brand-dark-soft break-words">
                              {[
                                form.unit_floor,
                                form.street_address,
                                form.barangay,
                                form.city_municipality,
                                form.province,
                                form.postal_code,
                                form.country,
                              ]
                                .filter(Boolean)
                                .join(', ') || 'PH'}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="pt-1">
                      {profileEditMode === 'emergency' && showECForm && (
                        <div className="space-y-2">
                          <div className="flex justify-start">
                            <button
                              type="button"
                              onClick={() => {
                                setShowECForm(false);
                                setForm((p) => ({
                                  ...p,
                                  ec_name: '',
                                  ec_phone: '',
                                  ec_relationship: '',
                                }));
                              }}
                              className="inline-flex items-center rounded-lg border border-brand-dark-light bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-dark-soft hover:border-brand-teal/40 hover:text-brand-teal"
                            >
                              - Remove Emergency Contact
                            </button>
                          </div>
                          <div className="rounded-xl border border-brand-teal/25 bg-white p-4 space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-teal">
                              Emergency Contact (Optional)
                            </p>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                                EMERGENCY CONTACT NAME
                              </label>
                              <input
                                value={form.ec_name}
                                onChange={(e) =>
                                  setForm((p) => ({ ...p, ec_name: e.target.value }))
                                }
                                className={inputCls(false)}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                                EMERGENCY CONTACT PHONE
                              </label>
                              <input
                                value={form.ec_phone}
                                onChange={(e) => {
                                  setForm((p) => ({
                                    ...p,
                                    ec_phone: normalizePHPhone(e.target.value),
                                  }));
                                  setFieldErrors((p) => ({ ...p, ec_phone: null }));
                                }}
                                className={inputCls(fieldErrors.ec_phone)}
                                maxLength={11}
                                inputMode="numeric"
                              />
                              {fieldErrors.ec_phone && (
                                <p className="mt-1 text-xs text-red-500">
                                  {fieldErrors.ec_phone}
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">
                                RELATIONSHIP
                              </label>
                              <SelectDropdown
                                value={form.ec_relationship}
                                onChange={(value) => setForm((p) => ({ ...p, ec_relationship: value }))}
                                options={[{ value: '', label: 'Select relationship' }, ...RELATIONSHIP_OPTIONS]}
                                buttonClassName={inputCls(false)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-brand-dark-light pt-4 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        openProfile();
                      }}
                      className="rounded-xl border border-brand-dark-light py-2 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-full bg-brand-teal py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : tab === 'password' ? (
            <ClientSecurityTab
              currentUser={currentUser}
              profile={profile}
              setProfile={setProfile}
              panelEmail={panelEmail}
            />
          ) : null}
        </div>

        <div className="border-t border-brand-teal-light/60 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onLogoutClick}
            className="inline-flex w-full items-center justify-end gap-2 py-2.5 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
          >
            <i className="fa-solid fa-right-from-bracket text-sm" />
            Logout
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}
