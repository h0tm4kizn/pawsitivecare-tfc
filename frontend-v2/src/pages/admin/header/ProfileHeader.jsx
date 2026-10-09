import { createPortal } from 'react-dom';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, LogOut, User, X, Settings } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import { useAuthStore } from '../../../stores/authStore';

const inputClass =
  'w-full rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-sm text-brand-dark outline-none transition focus:border-brand-teal/60 focus:ring-2 focus:ring-brand-teal/15';

const passwordRules = [
  { key: 'length', test: (value) => value.length >= 8 },
  { key: 'upper', test: (value) => /[A-Z]/.test(value) },
  { key: 'lower', test: (value) => /[a-z]/.test(value) },
  { key: 'digit', test: (value) => /\d/.test(value) },
  { key: 'symbol', test: (value) => /[!@#$%^&*()_\-+=[\]{};:'",.<>/?`~\\|]/.test(value) },
];

const splitName = (value = '') => {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
  };
};

const formatRoleLabel = (role = '') => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'Administrator';
  if (normalized === 'staff') return 'Staff';
  if (normalized === 'front_desk') return 'Front Desk';
  if (normalized === 'groomer') return 'Groomer';
  return role || 'Staff';
};

const ProfileHeader = forwardRef(function ProfileHeader({ onLogout, onNavigate, buttonClassName = '' }, ref) {
  useImperativeHandle(ref, () => ({ open: () => setIsOpen(true) }));
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [pwForm, setPwForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [isPwSaving, setIsPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const handleLogoutClick = () => setShowLogoutConfirm(true);
  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
      return;
    }
    logout();
  };
  const updateUser = useAuthStore((state) => state.updateUser);

  const [editForm, setEditForm] = useState({
    first_name: user?.first_name || splitName(user?.name).first_name,
    last_name: user?.last_name || splitName(user?.name).last_name,
    email: user?.email || '',
    phone: user?.phone || user?.contact_number || '',
  });

  const displayName =
    user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Administrator';
  const email = user?.email || 'Signed in';
  const contact = user?.phone || user?.contact_number || '—';
  const staffType = formatRoleLabel(user?.role || user?.staff_type || 'Staff');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  const passwordStrength = useMemo(
    () => passwordRules.reduce((count, rule) => (rule.test(pwForm.password) ? count + 1 : count), 0),
    [pwForm.password],
  );

  const closePanel = () => {
    setIsOpen(false);
    setIsEditing(false);
    setSaveError('');
    setFieldErrors({});
    setPwError('');
    setPwSuccess('');
  };

  const resetProfileForm = () => {
    setEditForm({
      first_name: user?.first_name || splitName(user?.name).first_name,
      last_name: user?.last_name || splitName(user?.name).last_name,
      email: user?.email || '',
      phone: user?.phone || user?.contact_number || '',
    });
    setFieldErrors({});
    setSaveError('');
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSaveProfile = async () => {
    const nextErrors = {};
    if (!editForm.first_name.trim()) nextErrors.first_name = 'First name is required.';
    if (!editForm.email.trim()) nextErrors.email = 'Email is required.';
    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      nextErrors.email = 'Enter a valid email.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      const phoneValue = editForm.phone.trim();
      const fullName = [editForm.first_name.trim(), editForm.last_name.trim()].filter(Boolean).join(' ');
      const response = await apiFetch(`/api/admin/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          email: editForm.email.trim(),
          phone: phoneValue || null,
          contact_number: phoneValue || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiErrors = payload?.errors || {};
        if (Object.keys(apiErrors).length > 0) {
          const mapped = {};
          Object.entries(apiErrors).forEach(([key, value]) => {
            const msg = Array.isArray(value) ? value[0] : value;
            if (key === 'contact_number') mapped.phone = msg;
            else mapped[key] = msg;
          });
          setFieldErrors(mapped);
        } else {
          setSaveError(payload?.message || 'Failed to save profile.');
        }
        return;
      }

      const nextUser = payload?.data || {};
      const mergedName = (
        nextUser.name
        || [nextUser.first_name, nextUser.last_name].filter(Boolean).join(' ').trim()
        || fullName
      );
      updateUser((prev) => ({
        ...prev,
        first_name: nextUser.first_name ?? editForm.first_name.trim(),
        last_name: nextUser.last_name ?? editForm.last_name.trim(),
        name: mergedName,
        email: nextUser.email ?? editForm.email.trim(),
        phone: nextUser.phone ?? nextUser.contact_number ?? phoneValue,
        contact_number: nextUser.contact_number ?? nextUser.phone ?? phoneValue,
      }));
      setIsEditing(false);
    } catch {
      setSaveError('Network error while saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (!pwForm.current_password || !pwForm.password || !pwForm.password_confirmation) {
      setPwError('All password fields are required.');
      return;
    }
    if (pwForm.password !== pwForm.password_confirmation) {
      setPwError('Password confirmation does not match.');
      return;
    }
    if (passwordStrength < 3) {
      setPwError('Use a stronger password.');
      return;
    }

    setIsPwSaving(true);
    try {
      const response = await apiFetch(`/api/admin/users/${user?.id}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pwForm,
          new_password: pwForm.password,
          new_password_confirmation: pwForm.password_confirmation,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const validationError =
          payload?.errors ? Object.values(payload.errors).flat().join(' ') : '';
        setPwError(validationError || payload?.message || 'Failed to change password.');
        return;
      }
      setPwSuccess('Password changed successfully.');
      setPwForm({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
    } catch {
      setPwError('Network error while changing password.');
    } finally {
      setIsPwSaving(false);
    }
  };

  const panelUI = (
    <>
      <div
        className={`fixed inset-0 z-[140] bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closePanel}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-[150] flex h-screen w-[min(90vw,360px)] flex-col overflow-hidden border-l border-brand-teal/35 bg-brand-teal text-white shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        style={{ contain: 'layout style paint' }}
      >
        <div className="flex items-center justify-between border-b border-brand-teal-light/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{displayName}</p>
              <p className="text-sm font-medium text-brand-teal-light">{email}</p>
            </div>
          </div>
          <button type="button" onClick={closePanel} className="text-white/70 hover:text-white" aria-label="Close profile panel">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white p-6 text-brand-dark">
          <>
              {saveError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {saveError}
                </p>
              )}

              {!isEditing ? (
                <div>
                  <div className="divide-y divide-brand-dark-light">
                    <ProfileRow label="Name" value={displayName} />
                    <ProfileRow label="Email" value={email} />
                    <ProfileRow label="Role" value={staffType} />
                    <ProfileRow label="Contact Number" value={contact} />
                  </div>

                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-brand-dark-light bg-white p-5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">FIRST NAME</label>
                      <input
                        name="first_name"
                        value={editForm.first_name}
                        onChange={handleEditChange}
                        className={inputClass}
                      />
                      {fieldErrors.first_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.first_name}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">LAST NAME</label>
                      <input
                        name="last_name"
                        value={editForm.last_name}
                        onChange={handleEditChange}
                        className={inputClass}
                      />
                      {fieldErrors.last_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.last_name}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">EMAIL</label>
                    <input
                      name="email"
                      type="email"
                      autoComplete="off"
                      value={editForm.email}
                      onChange={handleEditChange}
                      className={inputClass}
                    />
                    {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">CONTACT NUMBER</label>
                    <input
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditChange}
                      className={inputClass}
                    />
                    {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
                  </div>


                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        resetProfileForm();
                      }}
                      className="rounded-full border border-brand-dark-light bg-white py-2 text-sm font-semibold text-brand-dark hover:bg-brand-dark/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="rounded-full bg-brand-teal py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
          </>

          {pwError && showLogoutConfirm && (
            <form autoComplete="off" className="space-y-3">
              {pwError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {pwError}
                </p>
              )}
              {pwSuccess && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {pwSuccess}
                </p>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">CURRENT PASSWORD</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="off"
                    value={pwForm.current_password}
                    onChange={(event) =>
                      setPwForm((prev) => ({ ...prev, current_password: event.target.value }))
                    }
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark"
                    aria-label="Toggle current password visibility"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">NEW PASSWORD</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="off"
                    value={pwForm.password}
                    onChange={(event) =>
                      setPwForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark"
                    aria-label="Toggle new password visibility"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">CONFIRM PASSWORD</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="off"
                    value={pwForm.password_confirmation}
                    onChange={(event) =>
                      setPwForm((prev) => ({ ...prev, password_confirmation: event.target.value }))
                    }
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <div className="mb-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <span
                      key={level}
                      className={`h-1.5 flex-1 rounded-full ${level <= passwordStrength ? 'bg-brand-teal' : 'bg-brand-dark-light'}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={isPwSaving}
                  className="w-full rounded-xl border-2 border-brand-teal bg-brand-teal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-60"
                >
                  {isPwSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="border-t border-brand-teal-light/60 bg-white">
          <button type="button" onClick={() => { closePanel(); onNavigate?.('settings'); }} data-testid="profile-settings" className="flex w-full items-center gap-2.5 px-5 py-3.5 text-sm font-semibold text-brand-dark hover:bg-brand-dark-light transition-colors"><Settings size={15} className="text-brand-teal" /> Settings</button>
          <button
            type="button"
            onClick={handleLogoutClick}
            className="flex w-full items-center gap-2.5 px-5 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Confirm Logout</h3>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25"
                aria-label="Close logout confirmation"
              >
                <X size={16} strokeWidth={2.8} />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-brand-dark">Are you sure you want to log out?</p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-brand-dark-light px-5 py-4">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-xl border border-brand-dark-light py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-dark/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-white shadow transition-colors hover:bg-brand-teal-dark ${buttonClassName}`}
        aria-label="Open profile menu"
        aria-expanded={isOpen}
        data-testid="icon-profile"
      >
        <User size={20} strokeWidth={2.4} />
      </button>

      {typeof document !== 'undefined' ? createPortal(panelUI, document.body) : panelUI}
    </>
  );
});

export default ProfileHeader;

function ProfileRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-dark-soft">{label}</p>
      <p className="text-right text-sm font-semibold text-brand-dark">{value || '—'}</p>
    </div>
  );
}
