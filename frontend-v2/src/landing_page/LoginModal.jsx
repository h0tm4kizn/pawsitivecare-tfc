import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import { removeDisposableApiCache, safeStorageGet, safeStorageSet } from '../utils/browserStorage';

const inputClass = (hasError) =>
  `w-full rounded-lg bg-white/10 border ${hasError ? 'border-red-400' : 'border-white/15'} px-4 py-2.5 text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-brand-teal transition-all`;
const labelClass = "block text-xs font-semibold tracking-widest mb-2 text-white/80";

const validateIdentifier = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  if (value.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? ''
      : 'Please enter a valid email address.';
  }

  if (/^[\d+\s()-]+$/.test(value)) {
    const normalized = value.replace(/\D/g, '').replace(/^63/, '0');
    return /^09\d{9}$/.test(normalized)
      ? ''
      : 'Phone must start with 09 and be exactly 11 digits.';
  }

  return 'Please enter a valid email address or PH mobile number (09XXXXXXXXX).';
};

const getOrCreateDeviceId = () => {
  if (typeof window === 'undefined') return '';
  const key = 'furclub_device_id';
  const existing = safeStorageGet(window.localStorage, key);
  if (existing) return existing;

  const generated = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
  if (!safeStorageSet(window.localStorage, key, generated)) {
    removeDisposableApiCache();
    safeStorageSet(window.localStorage, key, generated);
  }
  return generated;
};

const findNestedValue = (value, predicate, depth = 0) => {
  if (!value || depth > 4 || typeof value !== 'object') return null;
  if (predicate(value)) return value;
  const values = Array.isArray(value) ? value : Object.values(value);
  for (const child of values) {
    const match = findNestedValue(child, predicate, depth + 1);
    if (match) return match;
  }
  return null;
};

const LoginModal = ({ isOpen, onLogin, onClose, onOpenRegister, onForgotPassword }) => {
  useBodyScrollLock(isOpen);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMode, setOtpMode] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [trustDevice, setTrustDevice] = useState(false);
  const [otpTargetHint, setOtpTargetHint] = useState('your email');
  const [otpMethod, setOtpMethod] = useState('email');
  const otpInputsRef = useRef([]);

  useEffect(() => {
    if (!otpMode || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [otpMode, resendIn]);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setIdentifierError('');
      setErrorMessage('');
      setOtpMode(false);
      setOtpChallengeId('');
      setOtpCode('');
      setResendIn(0);
      setTrustDevice(false);
      setOtpMethod('email');
    }
  }, [isOpen]);
  useEffect(() => {
    if (!otpMode) return;
    const t = setTimeout(() => otpInputsRef.current?.[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, [otpMode]);

  const otpChars = otpCode.padEnd(6, ' ').split('');
  const setOtpDigit = (index, value) => {
    const chars = otpCode.padEnd(6, ' ').split('');
    chars[index] = value;
    setOtpCode(chars.join('').replace(/\s/g, '').slice(0, 6));
  };
  if (!isOpen) return null;

  const submitLogin = async (explicitOtpCode) => {
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const methodToUse = otpMode ? otpMethod : 'email';
      if (!otpMode) setOtpMethod(methodToUse);
      const codeToSend = explicitOtpCode !== undefined ? explicitOtpCode : otpCode;

      const data = await apiClient('/login', {
        method: 'POST',
        body: {
          identifier,
          password,
          remember_me: remember,
          // authenticator uses no challenge_id; only send if present and using email OTP
          otp_challenge_id: otpMode && otpChallengeId ? otpChallengeId : undefined,
          otp_code: otpMode ? codeToSend : undefined,
          otp_method: methodToUse,
          device_id: deviceId || undefined,
          trust_device: trustDevice,
        },
        skipAuthRedirect: true,
      });

      // Accept both the current `{ requires_otp, data }` response and the
      // older wrapped `{ data: { requires_otp, data } }` response still
      // possible while production services are rolling out together.
      const otpResponse = findNestedValue(data, (candidate) => candidate?.requires_otp === true);

      if (otpResponse?.requires_otp) {
        setOtpMode(true);
        setOtpMethod(otpResponse?.otp_method || methodToUse);
        const otpData = findNestedValue(otpResponse, (candidate) => candidate?.challenge_id || candidate?.expires_in);
        setOtpChallengeId(otpData?.challenge_id || otpResponse?.challenge_id || '');
        setOtpCode('');
        setResendIn((otpResponse?.otp_method || methodToUse) === 'email' ? 30 : 0);
        const id = String(identifier || '').trim();
        const isEmail = id.includes('@');
        const maskedEmail = isEmail
          ? id.replace(/(^.).*(@.*$)/, '$1***$2')
          : 'your email';
        setOtpTargetHint(maskedEmail);
        setErrorMessage('');
        return;
      }

      // Login success is normally `{ data: { token, user } }`, but support
      // nested/legacy wrappers so production and backend deploys stay
      // compatible during rollout.
      const payload = findNestedValue(data, (candidate) => (
        (candidate?.token || candidate?.access_token || candidate?.accessToken)
        && (candidate?.user || candidate?.data?.user)
      ));
      const token = payload?.token || payload?.access_token || payload?.accessToken;
      const user = payload?.user || payload?.data?.user;

      if (!token || !user) {
        setErrorMessage('Login response is incomplete. Please refresh the page and try again.');
        return;
      }

      onLogin({ token, user, remember });
    } catch (err) {
      if (err.status === 422 && err.errors) {
        const messages = Object.values(err.errors).flat().join(' ');
        setErrorMessage(messages || err.message);
      } else {
        setErrorMessage(err.message || 'Cannot connect to server. Please make sure backend is running.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextIdentifierError = validateIdentifier(identifier);
    setIdentifierError(nextIdentifierError);
    if (nextIdentifierError) return;
    await submitLogin();
  };

  const handleResendOtp = async () => {
    if (otpMethod !== 'email' || !otpChallengeId || resendIn > 0) return;
    setIsSubmitting(true);
    try {
      await apiClient('/login/otp/resend', {
        method: 'POST',
        body: { challenge_id: otpChallengeId, device_id: deviceId || undefined },
        skipAuthRedirect: true,
      });
      setResendIn(30);
      setErrorMessage('A new code was sent to your email.');
    } catch (err) {
      setErrorMessage(err.message || 'Could not resend code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen overflow-y-auto" onClick={onClose}>
      <div className="register-modal-glass relative flex w-full max-w-[340px] md:max-w-3xl rounded-2xl overflow-hidden shadow-2xl font-poppins border-0 max-h-[92dvh]" onClick={(e) => e.stopPropagation()} style={{ contain: 'layout style paint' }}>

        {/* Close button — top-right of card, mobile only */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white md:hidden"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark text-sm" />
        </button>

        {/* -- Left panel: Login form -------------------------------------- */}
        <div className="register-glass-panel register-form-glass-panel relative text-white flex flex-col justify-center px-4 py-6 sm:px-10 sm:py-12 flex-1 overflow-y-auto">

          {/* Heading */}
          <h1 className="font-poppins text-2xl sm:text-3xl font-bold text-dark">
            {otpMode ? 'Verify Login' : 'Welcome Back!'}
          </h1>
          <p className="text-sm text-white/70 mt-1 mb-4 sm:mb-5">
            {otpMode ? 'We need to verify it’s you.' : 'Login with your credentials'}
          </p>
          {otpMode && (
            <div className="mb-5 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5">
              <p className="text-xs text-white/90">
                {otpMethod === 'email'
                  ? <>We sent a 6-digit code to <span className="font-semibold">{otpTargetHint}</span>.</>
                  : 'Open your authenticator app and enter the 6-digit code.'}
              </p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} autoComplete="off">

            {!otpMode ? (
              <>
                {/* Identifier — email or phone */}
                <div>
                  <label htmlFor="login-identifier" className={labelClass}>EMAIL OR PHONE</label>
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="off"
                    placeholder="Enter your email or mobile"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setIdentifierError(''); }}
                    onBlur={() => {
                      setIdentifierError(validateIdentifier(identifier));
                    }}
                    className={inputClass(!!identifierError)}
                  />
                  {identifierError && <p className="mt-1.5 text-xs text-red-400">{identifierError}</p>}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="login-password" className={labelClass}>PASSWORD</label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="off"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass(false)} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text- hover:text-white transition-colors select-none"
                    >
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <label htmlFor="login-otp" className={labelClass}>6-DIGIT CODE</label>
                <div className="grid grid-cols-6 gap-2">
                  {otpChars.map((ch, idx) => (
                    <input
                      key={`otp-${idx}`}
                      ref={(el) => { otpInputsRef.current[idx] = el; }}
                      id={idx === 0 ? 'login-otp' : undefined}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={ch === ' ' ? '' : ch}
                      onChange={(e) => {
                        const digit = e.target.value.replace(/\D/g, '').slice(-1);
                        setOtpDigit(idx, digit);
                        if (digit && idx < 5) otpInputsRef.current?.[idx + 1]?.focus();
                        const nextChars = otpCode.padEnd(6, ' ').split('');
                        nextChars[idx] = digit;
                        const nextCode = nextChars.join('').replace(/\s/g, '').slice(0, 6);
                        if (nextCode.length === 6 && !isSubmitting) {
                          // Pass nextCode explicitly — avoids stale closure reading the pre-update otpCode state
                          setTimeout(() => { submitLogin(nextCode); }, 50);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !(otpChars[idx] && otpChars[idx] !== ' ') && idx > 0) {
                          otpInputsRef.current?.[idx - 1]?.focus();
                        }
                      }}
                      className="h-12 w-full rounded-lg border border-white/20 bg-white/10 text-center text-base font-semibold tracking-[0.15em] text-white outline-none transition-colors focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpMethod !== 'email' || isSubmitting || resendIn > 0}
                    className="hover:text-brand-orange transition-colors disabled:opacity-50"
                  >
                    {otpMethod !== 'email' ? 'Authenticator active' : (resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpMode(false);
                      setOtpChallengeId('');
                      setOtpCode('');
                      setErrorMessage('');
                    }}
                    className="hover:text-brand-orange transition-colors"
                  >
                    Back
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (otpMethod === 'email') {
                      // Stay in OTP mode — authenticator needs no challenge_id, just the TOTP code
                      setOtpMethod('authenticator');
                      setOtpChallengeId('');
                      setOtpCode('');
                      setErrorMessage('');
                    } else {
                      // Go back to credentials so backend can issue a fresh email OTP challenge
                      setOtpMethod('email');
                      setOtpMode(false);
                      setOtpChallengeId('');
                      setOtpCode('');
                      setResendIn(0);
                      setErrorMessage('');
                    }
                  }}
                  className="mt-1 text-xs text-white/80 underline decoration-white/40 hover:text-brand-orange"
                >
                  {otpMethod === 'email' ? 'Use Authenticator Instead' : 'Use Email Instead'}
                </button>
                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(e) => setTrustDevice(e.target.checked)}
                      className="accent-brand-orange w-3 h-3"
                      style={{ appearance: 'checkbox' }}
                    />
                    Trust this device
                  </label>
                  <p className="mt-1 text-[11px] text-white/65">
                    Use only on your personal device. Trusted for 30 days.
                  </p>
                </div>
              </div>
            )}

            {/* Remember me + Forgot password */}
            <div className={`text-xs text-white/70 ${otpMode ? 'flex justify-end' : 'flex items-center justify-between'}`}>
              {!otpMode && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="accent-brand-orange w-3 h-3"
                    style={{ appearance: 'checkbox' }}
                  />
                  Remember me
                </label>
              )}
              <button
                type="button"
                className="hover:text-brand-orange transition-colors"
                onClick={onForgotPassword}
                disabled={otpMode}
              >
                Forgot Password?
              </button>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white font-bauhaus font-bold text-lg py-3 rounded-full shadow-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (otpMode ? 'Verifying...' : 'Logging in...') : (otpMode ? 'Verify' : 'Login')}
            </button>

            

          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-xs text-white/70">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onOpenRegister}
              className="text-brand-orange hover:underline font-semibold"
            >
              Register Here.
            </button>
          </p>

        </div>

        {/* -- Right panel: Branding — hidden on mobile -------------------- */}
        <div className="hidden md:flex bg-brand-teal flex-col items-center justify-center px-10 py-12 w-[320px] lg:w-[400px] shrink-0 relative">
          {/* Close button in right panel */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/85 transition-colors hover:bg-white/25 hover:text-white"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>

          {/* Paw logo circle */}
          <div className="w-20 h-20 rounded-full bg-brand-teal flex items-center justify-center ">
            <img
              src="/assets/paw-teal.webp"
              alt="The Fur Club"
              className="w-20 h-20 object-contain"
            />
          </div>

          {/* Branding text */}
          <img
              src="/assets/furclub_text.webp"
              alt="The Fur Club Logo"
              className="w-60 h-auto object-contain mx-auto mt-3 mb-2"
            />
          <p className="text-[15px] tracking-[0.2em] text-white/70 text-center mt-2 uppercase">
            <span className="font-bold">Tail-Wagging Access </span>
          </p>
          <p className="text-xs text-brand-dark/80 text-center mt-3 leading-relaxed">
            Step inside to manage your pet’s stay <br/>
            at The Fur Club.
          </p>

        </div>

      </div>
    </div>
  );
};

export default LoginModal;
