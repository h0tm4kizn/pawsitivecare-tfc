import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch } from '../../../api/apiClient';
import {
  inputCls,
  PASSWORD_RULES,
  STRENGTH_META,
  getStrength,
} from './sidebarHelpers';

export default function ClientSecurityTab({
  currentUser,
  profile,
  setProfile,
  panelEmail,
}) {
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwErr, setPwErr] = useState({});
  const [pwGenErr, setPwGenErr] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [authSetupSecret, setAuthSetupSecret] = useState('');
  const [authSetupOtpAuthUrl, setAuthSetupOtpAuthUrl] = useState('');
  const [authOtpCode, setAuthOtpCode] = useState('');
  const [authCurrentPassword, setAuthCurrentPassword] = useState('');
  const [authRecoveryCodes, setAuthRecoveryCodes] = useState([]);
  const [authMsg, setAuthMsg] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [showAuthSetupKey, setShowAuthSetupKey] = useState(false);
  const [showDisableAuthForm, setShowDisableAuthForm] = useState(false);

  const isAuthenticatorEnabled = Boolean(
    profile?.authenticator_enabled ||
    profile?.otp_authenticator_enabled ||
    profile?.totp_enabled ||
    profile?.two_factor_enabled ||
    profile?.two_factor_confirmed_at ||
    profile?.totp_confirmed_at ||
    profile?.otp_enabled_at
  );

  const passwordStrength = getStrength(pw.password || '');
  const strengthMeta = STRENGTH_META[passwordStrength] || STRENGTH_META[0];

  const validateCurrentPassword = async () => {
    const current = pw.current_password?.trim();
    if (!current) return;
    try {
      const res = await apiFetch('/api/my-profile/check-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, password: current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.valid === false) {
        setPwErr((prev) => ({ ...prev, current: 'Current password is incorrect.' }));
        return;
      }
      setPwErr((prev) => ({ ...prev, current: null }));
    } catch {
      setPwErr((prev) => ({ ...prev, current: 'Current password is incorrect.' }));
    }
  };

  const validateNewPassword = () => {
    if (!pw.password || !pw.current_password) return;
    if (pw.password === pw.current_password) {
      setPwErr((prev) => ({ ...prev, newPw: 'New password must be different from current password.' }));
      return;
    }
    setPwErr((prev) => ({ ...prev, newPw: null }));
  };

  const validatePasswordMatchRealtime = (nextPassword, nextConfirmation) => {
    setTimeout(() => {
      const passwordValue = nextPassword ?? pw.password;
      const confirmValue = nextConfirmation ?? pw.password_confirmation;
      if (!passwordValue || !confirmValue) {
        setPwErr((prev) => ({ ...prev, confirm: null }));
        return;
      }
      if (passwordValue !== confirmValue) {
        setPwErr((prev) => ({ ...prev, confirm: 'Passwords do not match.' }));
        return;
      }
      setPwErr((prev) => ({ ...prev, confirm: null }));
    }, 0);
  };

  const handleChangePw = async () => {
    const errs = {};
    if (!pw.current_password) errs.current = 'Required.';
    if (!pw.password) errs.newPw = 'Required.';
    else if (pw.password.length < 8) errs.newPw = 'At least 8 characters.';
    else if (pw.password === pw.current_password) errs.newPw = 'New password must be different from current password.';
    if (pw.password !== pw.password_confirmation) errs.confirm = 'Passwords do not match.';
    if (Object.keys(errs).length) { setPwErr(errs); return; }

    setPwSaving(true);
    setPwGenErr('');
    setPwSuccess('');
    try {
      const res = await apiFetch('/api/my-profile/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pw),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.errors) {
          const m = {};
          Object.entries(data.errors).forEach(([k, v]) => { m[k] = Array.isArray(v) ? v[0] : v; });
          setPwErr(m);
        } else setPwGenErr(data?.message || 'Failed to change password.');
        return;
      }
      setPwSuccess('Password changed successfully.');
      setPw({ current_password: '', password: '', password_confirmation: '' });
      setPwErr({});
    } catch {
      setPwGenErr('Network error.');
    } finally {
      setPwSaving(false);
    }
  };

  const startAuthenticatorSetup = async () => {
    if (isAuthenticatorEnabled && !authSetupSecret) {
      setAuthErr('');
      setAuthMsg('Authenticator is already enabled.');
      return;
    }
    if (authSetupSecret) {
      setAuthMsg('Use the current setup key below, or confirm the code to finish.');
      return;
    }
    setAuthBusy(true);
    setAuthErr('');
    setAuthMsg('');
    try {
      const res = await apiFetch('/api/me/otp/authenticator/setup', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Could not start authenticator setup.');
      const secret = data?.data?.secret || '';
      const issuer = encodeURIComponent('The Fur Club');
      const account = encodeURIComponent(panelEmail || profile?.email || currentUser?.email || 'user');
      const otpauthFromApi = data?.data?.otpauth_url || data?.data?.provisioning_uri || '';
      const fallbackOtpAuth = secret ? `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}` : '';
      setAuthSetupSecret(secret);
      setAuthSetupOtpAuthUrl(otpauthFromApi || fallbackOtpAuth);
      setShowAuthSetupKey(false);
      setAuthMsg('Setup key ready. Add it in Google Authenticator, then enter the 6-digit code.');
    } catch (err) {
      setAuthErr(err?.message || 'Could not start authenticator setup.');
    } finally {
      setAuthBusy(false);
    }
  };

  const confirmAuthenticatorSetup = async () => {
    if (!authOtpCode.trim()) {
      setAuthErr('Enter the 6-digit authenticator code.');
      return;
    }
    setAuthBusy(true);
    setAuthErr('');
    setAuthMsg('');
    try {
      const res = await apiFetch('/api/me/otp/authenticator/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_code: authOtpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Could not confirm authenticator.');
      setAuthRecoveryCodes(Array.isArray(data?.data?.recovery_codes) ? data.data.recovery_codes : []);
      setAuthSetupSecret('');
      setAuthSetupOtpAuthUrl('');
      setAuthOtpCode('');
      setShowDisableAuthForm(false);
      setProfile((prev) => (prev ? { ...prev, authenticator_enabled: true, two_factor_enabled: true, totp_enabled: true } : prev));
      setAuthMsg('Authenticator enabled.');
    } catch (err) {
      setAuthErr(err?.message || 'Could not confirm authenticator.');
    } finally {
      setAuthBusy(false);
    }
  };

  const copyAuthSetupKey = async () => {
    if (!authSetupSecret) return;
    try {
      await navigator.clipboard.writeText(authSetupSecret);
      setAuthMsg('Setup key copied.');
      setAuthErr('');
    } catch {
      setAuthErr('Could not copy key. Please copy manually.');
    }
  };

  const disableAuthenticator = async () => {
    if (!authCurrentPassword.trim()) {
      setAuthErr('Enter current password to disable authenticator.');
      return;
    }
    setAuthBusy(true);
    setAuthErr('');
    setAuthMsg('');
    try {
      const res = await apiFetch('/api/me/otp/authenticator/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: authCurrentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Could not disable authenticator.');
      setAuthCurrentPassword('');
      setAuthRecoveryCodes([]);
      setAuthSetupSecret('');
      setAuthSetupOtpAuthUrl('');
      setAuthOtpCode('');
      setShowDisableAuthForm(false);
      setProfile((prev) => (prev ? { ...prev, authenticator_enabled: false, two_factor_enabled: false, totp_enabled: false, two_factor_confirmed_at: null, totp_confirmed_at: null } : prev));
      setAuthMsg('Authenticator disabled.');
    } catch (err) {
      setAuthErr(err?.message || 'Could not disable authenticator.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAuthenticatorPrimaryAction = () => {
    if (isAuthenticatorEnabled && !authSetupSecret) {
      setShowDisableAuthForm((prev) => !prev);
      const disableInput = document.getElementById('auth-disable-current-password');
      setTimeout(() => disableInput?.focus(), 0);
      setAuthErr('');
      setAuthMsg('Enter your current password below to disable authenticator.');
      return;
    }
    startAuthenticatorSetup();
  };

  return (
    <div className="space-y-3">
      {pwGenErr && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pwGenErr}</p>}
      {pwSuccess && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pwSuccess}</p>}
      <div className="rounded-xl border border-brand-dark-light bg-white p-4 space-y-3">
        <p className="text-sm font-bold text-brand-dark">Change Password</p>
        {[
          { key: 'current_password', label: 'CURRENT PASSWORD', show: showCurrentPw, toggle: () => setShowCurrentPw((v) => !v), err: pwErr.current },
          { key: 'password', label: 'NEW PASSWORD', show: showNewPw, toggle: () => setShowNewPw((v) => !v), err: pwErr.newPw },
          { key: 'password_confirmation', label: 'CONFIRM PASSWORD', show: showConfirmPw, toggle: () => setShowConfirmPw((v) => !v), err: pwErr.confirm },
        ].map(({ key, label, show, toggle, err }) => (
          <div key={key}>
            <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">{label}</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pw[key]}
                onChange={(e) => {
                  const value = e.target.value;
                  setPw((p) => ({ ...p, [key]: value }));
                  setPwErr((p) => ({ ...p, [key === 'current_password' ? 'current' : key === 'password' ? 'newPw' : 'confirm']: null }));
                  if (key === 'password') validatePasswordMatchRealtime(value, pw.password_confirmation);
                  if (key === 'password_confirmation') validatePasswordMatchRealtime(pw.password, value);
                }}
                onBlur={
                  key === 'current_password'
                    ? validateCurrentPassword
                    : key === 'password'
                      ? validateNewPassword
                      : undefined
                }
                className={`${inputCls(err)} pr-10`}
              />
              <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {key === 'password' && pw.password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 h-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthMeta.bar : 'bg-brand-dark-light/70'}`} />
                  ))}
                </div>
                <p className={`text-xs mt-1 font-medium ${strengthMeta.color}`}>{strengthMeta.label}</p>
                <ul className="mt-2 space-y-0.5">
                  {PASSWORD_RULES.map((r) => {
                    const ok = r.test(pw.password);
                    return (
                      <li key={r.label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-brand-dark-soft'}`}>
                        <i className={`fa-solid ${ok ? 'fa-check' : 'fa-xmark'} text-[10px]`} />
                        {r.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
          </div>
        ))}
        <button type="button" onClick={handleChangePw} disabled={pwSaving}
          className="w-full rounded-xl border-2 border-brand-teal bg-brand-teal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-60">
          {pwSaving ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      <div className="rounded-2xl border border-brand-dark-light bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-brand-dark">Authenticator Security</p>
            <p className="text-[11px] text-brand-dark-soft">Protect your account on new-device logins.</p>
            {isAuthenticatorEnabled && (
              <span className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Authenticator is active on this account
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAuthenticatorPrimaryAction}
            disabled={authBusy}
            className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-60 ${
              isAuthenticatorEnabled && !authSetupSecret
                ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'bg-brand-teal text-white'
            }`}
          >
            {authBusy ? 'Please wait...' : (isAuthenticatorEnabled && !authSetupSecret ? 'Disable' : 'Enable')}
          </button>
        </div>

        {authMsg && <p className="text-[11px] text-brand-teal">{authMsg}</p>}
        {authErr && <p className="text-[11px] text-red-600">{authErr}</p>}

        {authSetupSecret && (
          <div className="space-y-2 rounded-xl border border-brand-dark-light bg-brand-surface px-3 py-3">
            {authSetupOtpAuthUrl && (
              <div className="rounded-lg border border-brand-dark-light bg-white p-3">
                <p className="text-[11px] font-semibold text-brand-dark">Scan QR code</p>
                <p className="mb-2 text-[11px] text-brand-dark-soft">Open Google Authenticator, tap +, then Scan a QR code.</p>
                <div className="flex justify-center">
                  <div className="rounded-md border border-brand-dark-light bg-white p-2">
                    <QRCodeSVG value={authSetupOtpAuthUrl} size={144} includeMargin />
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] text-brand-dark-soft">Can’t scan? Use setup key below.</p>
              </div>
            )}
            <p className="text-[11px] text-brand-dark-soft">Google Authenticator: tap + then Enter setup key.</p>
            <div className="relative rounded-lg border border-brand-dark-light bg-white px-3 py-2 pr-16 text-xs font-semibold break-all">
              {showAuthSetupKey ? authSetupSecret : '•'.repeat(Math.max(16, authSetupSecret.length))}
              <button
                type="button"
                onClick={copyAuthSetupKey}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark"
                aria-label="Copy setup key"
                title="Copy setup key"
              >
                <i className="fa-regular fa-copy text-[12px]" />
              </button>
              <button
                type="button"
                onClick={() => setShowAuthSetupKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark"
                aria-label={showAuthSetupKey ? 'Hide setup key' : 'Show setup key'}
              >
                {showAuthSetupKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input
              value={authOtpCode}
              onChange={(e) => setAuthOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={inputCls(false)}
              placeholder="Enter 6-digit code"
              inputMode="numeric"
              maxLength={6}
            />
            <button
              type="button"
              onClick={confirmAuthenticatorSetup}
              disabled={authBusy}
              className="w-full rounded-lg border border-brand-teal px-3 py-2 text-xs font-semibold text-brand-teal disabled:opacity-60"
            >
              Confirm and Enable
            </button>
          </div>
        )}

        {authRecoveryCodes.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-700">Recovery Codes (save these)</p>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {authRecoveryCodes.map((c) => (
                <code key={c} className="text-[11px] text-amber-800">{c}</code>
              ))}
            </div>
          </div>
        )}

        {isAuthenticatorEnabled && showDisableAuthForm && (
          <div className="pt-2 border-t border-brand-dark-light space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="auth-disable-current-password"
                type="password"
                value={authCurrentPassword}
                onChange={(e) => setAuthCurrentPassword(e.target.value)}
                className={inputCls(false)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={disableAuthenticator}
                disabled={authBusy}
                className="shrink-0 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60"
              >
                Confirm Disable
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
