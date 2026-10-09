import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Boxes, ChevronRight, Clock3, CreditCard, Database, FileSpreadsheet, ImageUp, Lightbulb, Lock, Plus, Search, ScrollText, Settings2, ShieldCheck, Trash2, UserRound, WalletCards, X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import { useAuthStore } from '../../../stores/authStore';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { useSuppliesFeatureEnabled } from '../../../utils/featureFlags';
import AuditLogsPage from './AuditLogsPage';
import SettingsBackupPage from './SettingsBackupPage';
import ManageHoursModal from '../appointment/ManageHoursModal';
import { SkeletonBlock } from '../../../components/admin/AdminLoading';
import ImageCropModal from '../../../components/modals/ImageCropModal';
import { useAppointmentStore } from '../../../stores/appointmentStore';
import { BANK_OPTIONS as PAYMENT_BANK_OPTIONS, EWALLET_OPTIONS as PAYMENT_EWALLET_OPTIONS } from '../../../constants/paymentProviders';
import {
  fetchPaymentAccounts,
  sanitizePaymentAccountNumber,
  usesMobileAccountNumber,
  validatePaymentAccount,
} from '../../../utils/paymentAccounts';

function ProfileInformation({ onSaved }) {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const nameParts = String(user?.name || '').trim().split(/\s+/);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ first_name: user?.first_name || nameParts[0] || '', last_name: user?.last_name || nameParts.slice(1).join(' '), email: user?.email || '', phone: user?.phone || user?.contact_number || '' });
  const save = async () => {
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`/api/admin/users/${user?.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, name: `${form.first_name} ${form.last_name}`.trim(), contact_number: form.phone || null }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Unable to update profile.');
      const next = payload?.data || form;
      updateUser((previous) => ({ ...previous, ...next, phone: next.phone ?? next.contact_number ?? form.phone }));
      onSaved?.();
    } catch (saveError) { setError(saveError?.message || 'Unable to update profile.'); } finally { setBusy(false); }
  };
  return (
    <div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white">
        <label className="block px-5 py-3.5">
          <span className="block text-xs font-semibold text-brand-dark-soft">First name</span>
          <input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1 w-full bg-transparent text-base font-semibold text-brand-dark outline-none" />
        </label>
        <label className="block border-t border-brand-dark-light px-5 py-3.5">
          <span className="block text-xs font-semibold text-brand-dark-soft">Last name</span>
          <input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1 w-full bg-transparent text-base font-semibold text-brand-dark outline-none" />
        </label>
        <label className="block border-t border-brand-dark-light px-5 py-3.5">
          <span className="block text-xs font-semibold text-brand-dark-soft">Email address</span>
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" className="mt-1 w-full bg-transparent text-base font-semibold text-brand-dark outline-none" />
        </label>
        <label className="block border-t border-brand-dark-light px-5 py-3.5">
          <span className="block text-xs font-semibold text-brand-dark-soft">Contact number</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full bg-transparent text-base font-semibold text-brand-dark outline-none" />
        </label>
      </div>
      <p className="mt-3 text-xs leading-5 text-brand-dark-soft">Review your information carefully before saving your changes.</p>
      <button type="button" onClick={save} disabled={busy} className="mt-6 w-full rounded-full bg-brand-teal px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save Changes'}</button>
    </div>
  );
}

function SuppliesPreference() {
  const [enabled, setEnabled] = useSuppliesFeatureEnabled();
  return <section className="rounded-2xl border border-brand-teal/15 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Boxes size={18} className="text-brand-teal" /><div><h3 className="font-extrabold text-brand-dark">Supplies &amp; Retail</h3><p className="text-sm text-brand-dark-soft">Show Supplies and retail tools in the Admin navigation.</p></div></div><button type="button" onClick={() => setEnabled(!enabled)} aria-pressed={enabled} className={`relative h-6 w-11 rounded-full transition ${enabled ? 'bg-brand-teal' : 'bg-brand-dark-light'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} /></button></div></section>;
}

function AccountSecurity() {
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [twoFactorBusy, setTwoFactorBusy] = useState(false); const [twoFactorMessage, setTwoFactorMessage] = useState(''); const [twoFactorError, setTwoFactorError] = useState(''); const [setup, setSetup] = useState(null); const [code, setCode] = useState('');
  const [openPanel, setOpenPanel] = useState(null);
  const setupQrValue = setup?.otpauth_url || setup?.provisioning_uri || (setup?.secret ? `otpauth://totp/The%20Fur%20Club:PawsitiveCare?secret=${encodeURIComponent(setup.secret)}&issuer=The%20Fur%20Club` : '');
  const savePassword = async (event) => { event.preventDefault(); setBusy(true); setError(''); setNotice(''); try { const response = await apiFetch('/api/me/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: form.current_password, new_password: form.password, new_password_confirmation: form.password_confirmation }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.message || Object.values(payload?.errors || {}).flat()[0] || 'Unable to change password.'); setNotice('Password changed successfully.'); setForm({ current_password: '', password: '', password_confirmation: '' }); } catch (saveError) { setError(saveError?.message || 'Unable to change password.'); } finally { setBusy(false); } };
  const start2fa = async () => { setTwoFactorBusy(true); setTwoFactorError(''); try { const response = await apiFetch('/api/me/otp/authenticator/setup', { method: 'POST' }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.message || 'Unable to start 2FA setup.'); setSetup(payload?.data || payload); } catch (setupError) { setTwoFactorError(setupError?.message || 'Unable to start 2FA setup.'); } finally { setTwoFactorBusy(false); } };
  const confirm2fa = async () => { setTwoFactorBusy(true); setTwoFactorError(''); try { const response = await apiFetch('/api/me/otp/authenticator/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.message || 'Unable to confirm 2FA.'); setTwoFactorMessage('Authenticator 2FA is enabled.'); setSetup(null); } catch (confirmError) { setTwoFactorError(confirmError?.message || 'Unable to confirm 2FA.'); } finally { setTwoFactorBusy(false); } };
  const rowClass = 'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-brand-teal/5 sm:px-6';
  const closePanel = () => setOpenPanel(null);

  return (
    <div className="space-y-5 py-1">
      <div>
        <h1 className="text-3xl font-extrabold text-brand-teal-dark">Account <span className="text-brand-dark">&amp; Security</span></h1>
        <p className="mt-1 text-sm text-brand-dark-soft">Manage your profile, password, and account security.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-[0_6px_12px_rgba(23,53,81,0.06)]">
        <button type="button" onClick={() => setOpenPanel('profile')} className={rowClass}>
          <span className="flex items-center gap-3"><UserRound size={19} className="text-brand-teal" /><span><span className="block text-sm font-bold text-brand-dark">Profile Information</span><span className="mt-0.5 block text-xs text-brand-dark-soft">Name, email, role, and contact number</span></span></span>
          <ChevronRight size={19} className="shrink-0 text-brand-dark-soft" />
        </button>
        <div className="border-t border-brand-dark-light">
          <button type="button" onClick={() => setOpenPanel('password')} className={rowClass}>
            <span className="flex items-center gap-3"><Lock size={19} className="text-brand-teal" /><span><span className="block text-sm font-bold text-brand-dark">Change Password</span><span className="mt-0.5 block text-xs text-brand-dark-soft">Update the password used to access your account</span></span></span>
            <ChevronRight size={19} className="shrink-0 text-brand-dark-soft" />
          </button>
        </div>
        <div className="border-t border-brand-dark-light">
          <button type="button" onClick={() => setOpenPanel('two-factor')} className={rowClass}>
            <span className="flex items-center gap-3"><ShieldCheck size={19} className="text-brand-teal" /><span><span className="block text-sm font-bold text-brand-dark">Two-Factor Authentication</span><span className="mt-0.5 block text-xs text-brand-dark-soft">Add an authenticator app for extra protection</span></span></span>
            <ChevronRight size={19} className="shrink-0 text-brand-dark-soft" />
          </button>
        </div>
      </section>

      {openPanel && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[320] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm" onClick={closePanel}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-brand-teal px-5 py-4 text-white">
              <h2 className="font-extrabold">{openPanel === 'profile' ? 'Edit Profile' : openPanel === 'password' ? 'Change Password' : 'Two-Factor Authentication'}</h2>
              <button type="button" onClick={closePanel} className="rounded-full bg-white/15 p-1.5 hover:bg-white/25" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-5 sm:p-6">
              {openPanel === 'profile' && <ProfileInformation onSaved={closePanel} />}
              {openPanel === 'password' && <>{error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}{notice && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}<form onSubmit={savePassword} className="space-y-3"><input required type="password" autoComplete="current-password" placeholder="Current password" value={form.current_password} onChange={(event) => setForm({ ...form, current_password: event.target.value })} className="w-full rounded-2xl border border-brand-dark-light px-5 py-4 text-base text-brand-dark outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/10" /><input required type="password" autoComplete="new-password" placeholder="New password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full rounded-2xl border border-brand-dark-light px-5 py-4 text-base text-brand-dark outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/10" /><input required type="password" autoComplete="new-password" placeholder="Re-type new password" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} className="w-full rounded-2xl border border-brand-dark-light px-5 py-4 text-base text-brand-dark outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/10" /><p className="px-1 pt-1 text-xs leading-5 text-brand-dark-soft">Use a strong password that you do not use for other accounts.</p><button disabled={busy} className="mt-3 w-full rounded-full bg-brand-teal px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Updating…' : 'Change Password'}</button></form></>}
              {openPanel === 'two-factor' && <>{twoFactorError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{twoFactorError}</p>}{twoFactorMessage && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{twoFactorMessage}</p>}{setup ? <div className="space-y-4"><div><h3 className="text-lg font-semibold text-brand-dark">Connect your authenticator app</h3><p className="mt-1 text-sm text-brand-dark-soft">Scan the QR code or enter the secret, then confirm the six-digit code.</p></div>{setupQrValue && <div className="mx-auto w-fit rounded-xl border border-brand-dark-light bg-white p-2"><QRCodeSVG value={setupQrValue} size={176} includeMargin aria-label="Authenticator setup QR code" /></div>}{setup.secret && <code className="block overflow-x-auto rounded-xl bg-brand-surface p-3 text-xs text-brand-dark">{setup.secret}</code>}<input inputMode="numeric" maxLength={6} placeholder="Enter 6-digit code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="w-full rounded-2xl border border-brand-dark-light px-5 py-4 text-base outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/10" /><button type="button" disabled={twoFactorBusy || code.length !== 6} onClick={confirm2fa} className="w-full rounded-full bg-brand-teal px-5 py-3 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-50">{twoFactorBusy ? 'Confirming…' : 'Confirm Authenticator'}</button></div> : <div><h3 className="text-xl font-semibold text-brand-dark">Set up extra protection for your account</h3><p className="mt-2 text-sm text-brand-dark-soft">Add an extra sign-in step to confirm it is really you.</p><div className="mt-7 space-y-5"><div className="flex items-start gap-4"><ShieldCheck size={24} className="mt-0.5 shrink-0 text-brand-teal" /><p className="text-sm leading-6 text-brand-dark">Keeps your account protected even if your password is guessed or stolen.</p></div><div className="flex items-start gap-4"><Settings2 size={24} className="mt-0.5 shrink-0 text-brand-teal" /><p className="text-sm leading-6 text-brand-dark">Use an authenticator app to securely confirm new sign-ins.</p></div><div className="flex items-start gap-4"><Lightbulb size={24} className="mt-0.5 shrink-0 text-brand-teal" /><p className="text-sm leading-6 text-brand-dark">Recommended for accounts that manage customer and pet information.</p></div></div><button type="button" disabled={twoFactorBusy} onClick={start2fa} className="mt-8 w-full rounded-full bg-brand-teal px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-50">{twoFactorBusy ? 'Preparing…' : 'Get Started'}</button></div>}</>}
            </div>
          </div>
        </div>, document.body,
      )}
    </div>
  );
}

function AddPaymentAccountModal({ account, setAccount, providerOptions, onClose, onAdd, title = 'Add Payment Account', submitLabel = 'Add Payment Account', busy = false }) {
  const [validationError, setValidationError] = useState('');
  const [qrCrop, setQrCrop] = useState(null);
  if (!account || typeof document === 'undefined') return null;
  const selectedProvider = account.provider === 'Other' ? 'Other' : account.label;
  const uploadQr = (file) => {
    if (!file || !file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setQrCrop(String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  const applyQrCrop = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setAccount((current) => ({ ...current, qr_code: String(reader.result || '') }));
      setQrCrop(null);
    };
    reader.readAsDataURL(file);
  };
  const fieldClass = 'w-full rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-sm text-brand-dark outline-none focus:border-brand-teal';

  return createPortal(
    <>
    {qrCrop && <ImageCropModal imageSrc={qrCrop} cropShape="rect" minZoom={0.5} title="Edit Payment QR Code" fileName="payment-qr.png" outputType="image/png" onDone={applyQrCrop} onCancel={() => setQrCrop(null)} />}
    <div className="fixed inset-0 z-[350] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-brand-teal px-5 py-4 text-white">
          <h3 className="font-extrabold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 p-1.5 hover:bg-white/25" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {validationError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{validationError}</p>}
          <label className="block"><span className="mb-1 block text-xs font-semibold text-brand-dark-soft">Account type</span>
            <select value={account.type} onChange={(event) => setAccount((current) => ({ ...current, type: event.target.value, provider: '', label: '', account_number: '' }))} className={fieldClass}>
              <option value="">Select account type</option><option value="ewallet">E-Wallet</option><option value="bank">Bank</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-brand-dark-soft">Provider name</span>
            <select value={selectedProvider} disabled={!account.type} onChange={(event) => setAccount((current) => event.target.value === 'Other' ? { ...current, provider: 'Other', label: '', account_number: '' } : { ...current, provider: event.target.value, label: event.target.value, account_number: '' })} className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-brand-dark-soft`}>
              <option value="">{account.type ? 'Select provider' : 'Select account type first'}</option>
              {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {selectedProvider === 'Other' && <label className="block"><span className="mb-1 block text-xs font-semibold text-brand-dark-soft">Other provider name</span><input value={account.label} onChange={(event) => setAccount((current) => ({ ...current, provider: 'Other', label: event.target.value }))} placeholder={account.type === 'bank' ? 'Enter bank name' : 'Enter e-wallet name'} className={fieldClass} /></label>}
          <label className="block"><span className="mb-1 block text-xs font-semibold text-brand-dark-soft">Account name</span><input value={account.account_name} onChange={(event) => setAccount((current) => ({ ...current, account_name: event.target.value }))} placeholder="Account holder name" className={fieldClass} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-brand-dark-soft">Account number</span><input value={account.account_number} inputMode={usesMobileAccountNumber(account.label) ? 'numeric' : 'text'} maxLength={usesMobileAccountNumber(account.label) ? 11 : 80} onChange={(event) => setAccount((current) => ({ ...current, account_number: sanitizePaymentAccountNumber(current.label, event.target.value) }))} placeholder="Mobile or account number" className={fieldClass} /></label>
          {account.qr_code ? (
            <div className="rounded-xl border border-brand-dark-light bg-brand-surface/50 p-3">
              <p className="mb-2 text-xs font-semibold text-brand-dark-soft">QR Code</p>
              <div className="flex flex-wrap items-center gap-3">
                <img src={account.qr_code} alt="Payment QR code" className="h-24 w-24 rounded-lg bg-white object-contain p-1" />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-teal px-3 py-2 text-xs font-bold text-brand-teal-dark hover:bg-brand-teal/5">
                    <ImageUp size={14} /> Replace QR
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { uploadQr(event.target.files?.[0]); event.target.value = ''; }} />
                  </label>
                  <button type="button" onClick={() => setAccount((current) => ({ ...current, qr_code: '' }))} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">Remove QR</button>
                </div>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-teal/50 bg-brand-teal/5 px-4 py-5 text-sm font-bold text-brand-teal-dark">
              <ImageUp size={18} />Upload QR image
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { uploadQr(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
          )}
          <div className="flex justify-end gap-2 border-t border-brand-dark-light pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-brand-dark-light px-5 py-2.5 text-sm font-bold text-brand-dark-soft hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => { const message = validatePaymentAccount(account); setValidationError(message); if (!message) onAdd(); }} disabled={busy || !account.type || !String(account.label || '').trim()} className="rounded-full bg-brand-teal px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : (title.startsWith('Edit') ? 'Save Changes' : submitLabel)}</button>
          </div>
        </div>
      </div>
    </div>
    </>, document.body,
  );
}

function PaymentAccountsSkeleton() {
  return (
    <div role="status" aria-label="Loading payment accounts" className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white">
      <span className="sr-only">Loading payment accounts</span>
      {[0, 1].map((item) => (
        <div key={item} className={`p-4 sm:p-5 ${item ? 'border-t border-brand-dark-light' : ''}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2"><SkeletonBlock className="h-4 w-4 rounded-full" /><SkeletonBlock className="h-4 w-32" /></div>
            <SkeletonBlock className="h-9 w-9 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['Account type', 'Provider name', 'Account name', 'Account number'].map((label) => (
              <div key={label}><SkeletonBlock className="mb-2 h-3 w-24" /><SkeletonBlock className="h-12 w-full rounded-xl" /></div>
            ))}
          </div>
          <div className="mt-4"><SkeletonBlock className="mb-2 h-3 w-24" /><SkeletonBlock className="h-28 w-full rounded-xl" /></div>
        </div>
      ))}
    </div>
  );
}

function PaymentAccountView({ account, onEdit }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(account)}
      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-brand-teal/5 focus:bg-brand-teal/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal sm:gap-4 sm:p-4"
      aria-label={`Edit ${account.label || 'payment account'}`}
    >
      {account.qr_code ? (
        <img src={account.qr_code} alt="" aria-hidden="true" className="h-16 w-16 shrink-0 rounded-lg border border-brand-dark-light bg-white object-contain p-1" />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-brand-dark-light text-center text-[10px] text-brand-dark-soft">
          No QR code
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-base font-extrabold text-brand-dark">{account.label || '—'}</p>
        <p className="truncate text-xs font-semibold text-brand-dark-soft">{account.type === 'ewallet' ? 'E-Wallet' : 'Bank'}</p>
        <p className="truncate text-xs text-brand-dark-soft">{account.account_name || '—'}</p>
        <p className="truncate text-xs font-semibold text-brand-dark">{account.account_number || '—'}</p>
      </div>
      <ChevronRight size={19} className="shrink-0 text-brand-dark-soft" aria-hidden="true" />
    </button>
  );
}

function PaymentSettings({ onSaved }) {
  const [error, setError] = useState('');
  const [newAccount, setNewAccount] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    let active = true;
    fetchPaymentAccounts().then((savedAccounts) => {
      if (active) setAccounts(savedAccounts);
    }).catch((loadError) => {
      console.error('Unable to load payment accounts:', loadError);
      if (active) setError('Unable to load payment accounts. Please try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const persistAccounts = async (nextAccounts, closeAfterSave = false) => {
    const validationError = nextAccounts.map(validatePaymentAccount).find(Boolean);
    if (validationError) {
      setError(validationError);
      return false;
    }
    setError(''); setBusy(true);
    try {
      const response = await apiFetch('/api/admin/clinic/payment-accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accounts: nextAccounts }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || Object.values(payload?.errors || {}).flat()[0] || 'Unable to save payment accounts.');
      const saved = Array.isArray(payload?.data) ? payload.data : nextAccounts;
      setAccounts(saved);
      window.dispatchEvent(new CustomEvent('pawsitivecare:payment-accounts-updated', { detail: saved }));
      if (closeAfterSave) onSaved?.();
      return true;
    } catch (saveError) {
      console.error('Unable to save payment accounts:', saveError);
      setError('Unable to save payment accounts. Please try again.');
      return false;
    } finally { setBusy(false); }
  };
  const addAccount = () => setNewAccount({ id: `payment-${Date.now()}`, label: '', provider: '', type: '', account_name: '', account_number: '', qr_code: '' });
  const providerOptionsFor = (type) => (type === 'bank' ? PAYMENT_BANK_OPTIONS : PAYMENT_EWALLET_OPTIONS).filter((option) => option.value);
  const saveEditedAccount = async () => {
    if (!editingAccount) return;
    const nextAccounts = accounts.map((item) => item.id === editingAccount.id ? editingAccount : item);
    if (await persistAccounts(nextAccounts)) setEditingAccount(null);
  };
  const addNewAccount = async () => {
    if (!newAccount || !String(newAccount.label || '').trim()) return;
    if (await persistAccounts([...accounts, newAccount])) setNewAccount(null);
  };
  return <div><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-brand-dark-soft">Add the e-wallet and bank accounts that can receive payments.</p><button type="button" onClick={addAccount} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-teal-dark sm:w-auto"><Plus size={15} />Add Account</button></div>{error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}{loading && <PaymentAccountsSkeleton />} {!loading && <div className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white">{accounts.length ? accounts.map((account, index) => <div key={account.id} className={index ? 'border-t border-brand-dark-light' : ''}><PaymentAccountView account={account} onEdit={setEditingAccount} /></div>) : <p className="px-5 py-8 text-center text-sm text-brand-dark-soft">No configured payment accounts.</p>}</div>}{editingAccount && <AddPaymentAccountModal account={editingAccount} setAccount={setEditingAccount} providerOptions={providerOptionsFor(editingAccount.type)} title="Edit Payment Account" submitLabel="Save" busy={busy} onClose={() => setEditingAccount(null)} onAdd={saveEditedAccount} />}{newAccount && <AddPaymentAccountModal account={newAccount} setAccount={setNewAccount} providerOptions={providerOptionsFor(newAccount.type)} busy={busy} onClose={() => setNewAccount(null)} onAdd={addNewAccount} />}</div>;
}

function SystemPreferences() {
  const [openPanel, setOpenPanel] = useState(null);
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursError, setHoursError] = useState('');
  const schedule = useAppointmentStore((state) => state.schedule);
  const scheduleEdit = useAppointmentStore((state) => state.scheduleEdit);
  const isSavingManageHours = useAppointmentStore((state) => state.isSavingManageHours);
  const loadSchedule = useAppointmentStore((state) => state.loadSchedule);
  const saveManageHours = useAppointmentStore((state) => state.saveManageHours);
  const setScheduleTime = useAppointmentStore((state) => state.setScheduleTime);
  const toggleScheduleClosed = useAppointmentStore((state) => state.toggleScheduleClosed);
  const resetScheduleEdit = useAppointmentStore((state) => state.resetScheduleEdit);
  useEffect(() => { let active = true; Promise.resolve(loadSchedule?.()).then((ok) => { if (!active) return; setHoursLoading(false); if (!ok) setHoursError('Unable to load the saved shop hours. Please try again.'); }); return () => { active = false; }; }, [loadSchedule]);
  const openHours = async () => {
    setHoursError(''); setHoursLoading(true); setOpenPanel('hours');
    const ok = await loadSchedule?.();
    setHoursLoading(false);
    if (!ok || !Object.keys(useAppointmentStore.getState().schedule?.shop_hours || {}).length) setHoursError('Unable to load the saved shop hours. Please try again.');
  };
  const rowClass = 'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-brand-teal/5 sm:px-6';
  return (
    <div className="mx-auto w-full max-w-[1736px] px-0 pb-10 pt-4">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-brand-teal-dark">System <span className="text-brand-dark">&amp; Features</span></h1>
        <p className="text-sm text-brand-dark-soft">Manage application-level features and clinic operations.</p>
      </div>
      {hoursError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{hoursError}</p>}
      <section className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-[0_6px_12px_rgba(23,53,81,0.06)]">
        <button type="button" onClick={() => setOpenPanel('payments')} className={rowClass}>
          <span className="flex items-center gap-3">
            <WalletCards size={19} className="text-brand-teal" />
            <span>
              <span className="block text-sm font-bold text-brand-dark">Manage Payments</span>
              <span className="mt-0.5 block text-xs text-brand-dark-soft">Set up receiving accounts and payment QR codes</span>
            </span>
          </span>
          <ChevronRight size={19} className="text-brand-dark-soft" />
        </button>
        <div className="border-t border-brand-dark-light">
          <button type="button" onClick={openHours} className={rowClass}>
            <span className="flex items-center gap-3">
              <Clock3 size={19} className="text-brand-teal" />
              <span>
                <span className="block text-sm font-bold text-brand-dark">Manage Shop Hours</span>
                <span className="mt-0.5 block text-xs text-brand-dark-soft">Opening hours and blocked dates</span>
              </span>
            </span>
            <ChevronRight size={19} className="text-brand-dark-soft" />
          </button>
        </div>
      </section>
      <div className="mt-5"><SuppliesPreference /></div>
      {openPanel === 'payments' && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[320] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm" onClick={() => setOpenPanel(null)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-brand-teal px-5 py-4 text-white">
              <h2 className="font-extrabold">Manage Payments</h2>
              <button type="button" onClick={() => setOpenPanel(null)} className="rounded-full bg-white/15 p-1.5 hover:bg-white/25" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-5 sm:p-6"><PaymentSettings onSaved={() => setOpenPanel(null)} /></div>
          </div>
        </div>,
        document.body
      )}
      <ManageHoursModal isOpen={openPanel === 'hours'} isLoading={hoursLoading} onClose={() => setOpenPanel(null)} schedule={schedule} scheduleEdit={scheduleEdit} setScheduleTime={setScheduleTime} toggleScheduleClosed={toggleScheduleClosed} resetScheduleEdit={resetScheduleEdit} saveManageHours={saveManageHours} isSavingManageHours={isSavingManageHours} />
    </div>
  );
}

const getSettingsSectionFromHash = (isAdmin) => {
  if (typeof window === 'undefined') return 'security';
  if (window.location.hash.startsWith('#settings/manage-services')) return isAdmin ? 'system' : 'security';
  const requestedSection = window.location.hash.slice('#settings/'.length);
  if (window.location.hash.startsWith('#settings/') && (requestedSection === 'security' || (isAdmin && ['templates', 'backup', 'activity', 'system'].includes(requestedSection)))) return requestedSection;
  return 'security';
};

export default function SettingsPage({ onBack }) {
  const isAdmin = String(useAuthStore((state) => state.user?.role || '')).toLowerCase() === 'admin';
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [section, setSection] = useState(() => getSettingsSectionFromHash(isAdmin));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() => typeof window !== 'undefined' && window.location.hash.startsWith('#settings/'));
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const handleHistoryChange = () => {
      setSection(getSettingsSectionFromHash(isAdmin));
      setMobileDetailOpen(window.location.hash.startsWith('#settings/'));
    };
    window.addEventListener('popstate', handleHistoryChange);
    window.addEventListener('hashchange', handleHistoryChange);
    return () => {
      window.removeEventListener('popstate', handleHistoryChange);
      window.removeEventListener('hashchange', handleHistoryChange);
    };
  }, [isAdmin]);
  const items = [
    { id: 'security', label: 'Account & Security', icon: Lock, group: 'Personal', description: 'Profile, password and two-factor authentication', keywords: 'account profile password security authenticator' },
    ...(isAdmin ? [
      { id: 'templates', label: 'Templates', icon: FileSpreadsheet, group: 'Administration', description: 'Manage saved templates', keywords: 'templates documents' },
      { id: 'backup', label: 'Backup & Data', icon: Database, group: 'Administration', description: 'Review backup and data options', keywords: 'backup recovery data' },
      { id: 'activity', label: 'Activity History', icon: ScrollText, group: 'Administration', description: 'Review recorded activity', keywords: 'activity audit history logs' },
      { id: 'system', label: 'System Settings', icon: Settings2, group: 'Administration', description: 'Payments, shop hours and supplies', keywords: 'system payments shop hours supplies preferences' },
    ] : []),
  ];
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(normalizedSearch));
  const selectedItem = items.find((item) => item.id === section);
  const selectSection = (id) => {
    if (isMobile) {
      window.history.pushState({}, '', `#settings/${id}`);
      setMobileDetailOpen(true);
    } else if (id === 'system' || id === 'security') {
      window.history.pushState({}, '', id === 'system' ? '#settings/system' : '#settings');
    }
    setSection(id);
  };
  const backToSettings = () => {
    window.history.pushState({}, '', '#settings');
    setMobileDetailOpen(false);
  };

  return (
    <div className="grid w-full gap-5 px-4 py-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-0 lg:py-4">
      <aside className={`${mobileDetailOpen ? 'hidden' : ''} min-w-0 lg:hidden`}>
        <div className="mb-5 flex min-h-11 items-center gap-2">
          <button type="button" onClick={onBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-teal-dark hover:bg-brand-teal/10" aria-label="Back to dashboard"><ArrowLeft size={20} /></button>
          <h1 className="min-w-0 text-xl font-extrabold text-brand-teal-dark">System Settings</h1>
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-brand-teal/20 bg-white px-4 text-brand-dark-soft focus-within:border-brand-teal focus-within:ring-2 focus-within:ring-brand-teal/10">
          <Search size={19} className="shrink-0" aria-hidden="true" />
          <span className="sr-only">Search settings</span>
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search settings..." className="min-w-0 w-full bg-transparent py-3 text-sm text-brand-dark outline-none placeholder:text-brand-dark-soft" />
        </label>
        {filteredItems.length === 0 ? (
          <p className="py-10 text-center text-sm text-brand-dark-soft">No settings found</p>
        ) : (
          <div className="mt-5 space-y-5">
            {['Personal', 'Administration'].map((group) => {
              const groupItems = filteredItems.filter((item) => item.group === group);
              if (!groupItems.length) return null;
              return <section key={group}>
                <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-brand-dark-soft">{group}</h2>
                <div className="divide-y divide-brand-teal/10 overflow-hidden rounded-xl border border-brand-teal/15 bg-white">
                  {groupItems.map(({ id, label, description, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => selectSection(id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-teal/5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal-dark"><Icon size={18} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-brand-dark">{label}</span><span className="mt-0.5 block text-xs leading-4 text-brand-dark-soft">{description}</span></span>
                      <ChevronRight size={18} className="shrink-0 text-brand-dark-soft" />
                    </button>
                  ))}
                </div>
              </section>;
            })}
          </div>
        )}
      </aside>
      <aside className="hidden h-fit rounded-2xl border border-brand-teal/15 bg-white p-3 shadow-sm lg:block">
        <h1 className="px-3 pb-3 text-xl font-extrabold text-brand-teal-dark">Settings</h1>
        <label className="mb-4 flex min-h-10 items-center gap-2 rounded-xl border border-brand-teal/20 bg-white px-3 text-brand-dark-soft focus-within:border-brand-teal focus-within:ring-2 focus-within:ring-brand-teal/10">
          <Search size={16} className="shrink-0" aria-hidden="true" />
          <span className="sr-only">Search settings</span>
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search settings..." className="min-w-0 w-full bg-transparent py-2 text-xs text-brand-dark outline-none placeholder:text-brand-dark-soft" />
        </label>
        {filteredItems.length === 0 ? (
          <p className="px-3 py-5 text-center text-xs text-brand-dark-soft">No settings found</p>
        ) : ['Personal', 'Administration'].map((group) => {
          const groupItems = filteredItems.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return <div key={group} className={group === 'Administration' ? 'mt-5' : ''}>
            <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-dark-soft">{group}</p>
            <nav className="space-y-1">
              {groupItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => selectSection(id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${section === id ? 'bg-brand-teal/10 text-brand-teal-dark' : 'text-brand-dark hover:bg-brand-teal/10'}`}><Icon size={16} className="shrink-0" />{label}</button>)}
            </nav>
          </div>;
        })}
      </aside>
      <main className={`${isMobile && !mobileDetailOpen ? 'hidden' : ''} min-w-0`}>
        {isMobile && <div className="mb-5 flex min-w-0 items-center gap-2"><button type="button" onClick={backToSettings} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-teal-dark hover:bg-brand-teal/10" aria-label="Back to System Settings"><ArrowLeft size={20} /></button><div className="min-w-0"><h1 className="text-lg font-extrabold text-brand-teal-dark">{selectedItem?.label || 'System Settings'}</h1>{selectedItem?.description && <p className="text-xs text-brand-dark-soft">{selectedItem.description}</p>}</div></div>}
        {section === 'security' && <AccountSecurity />}
        {section === 'templates' && isAdmin && <SettingsBackupPage mode="templates" />}
        {section === 'backup' && isAdmin && <SettingsBackupPage mode="backup" />}
        {section === 'activity' && isAdmin && <AuditLogsPage />}
        {section === 'system' && isAdmin && <SystemPreferences />}
      </main>
    </div>
  );
}
