import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import apiClient from '../api/apiClient';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

const inputClass = (hasError) =>
  `w-full rounded-lg bg-white/10 border ${hasError ? 'border-red-400' : 'border-white/15'} px-4 py-2.5 text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-brand-teal transition-all`;
const labelClass = 'block text-xs font-semibold tracking-widest mb-2 text-white/80';
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character', test: (p) => /[!@#$%^&*()\-_=+{};:,<.>/?\\|[\]`~"']/.test(p) },
];
const STRENGTH_META = [
  { label: '', color: 'text-white/30', bar: 'bg-white/10' },
  { label: 'Very Weak', color: 'text-red-400', bar: 'bg-red-500' },
  { label: 'Weak', color: 'text-orange-400', bar: 'bg-orange-500' },
  { label: 'Fair', color: 'text-yellow-400', bar: 'bg-yellow-400' },
  { label: 'Strong', color: 'text-lime-400', bar: 'bg-lime-500' },
  { label: 'Very Strong', color: 'text-green-400', bar: 'bg-green-500' },
];

const ForgotPassword = ({ isOpen, onClose, onBackToLogin }) => {
  useBodyScrollLock(isOpen);
  const [step, setStep]               = useState('email'); // email | otp | reset | success
  const [email, setEmail]             = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otpCode, setOtpCode]         = useState('');
  const [resetToken, setResetToken]   = useState('');
  const [resetEmail, setResetEmail]   = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [resendIn, setResendIn]       = useState(0);
  const otpInputsRef                  = useRef([]);

  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setChallengeId('');
      setOtpCode('');
      setResetToken('');
      setResetEmail('');
      setPassword('');
      setConfirm('');
      setError('');
      setResendIn(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step !== 'otp' || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [step, resendIn]);

  useEffect(() => {
    if (step !== 'otp') return;
    const t = setTimeout(() => otpInputsRef.current?.[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, [step]);

  if (!isOpen) return null;

  // ── OTP box helpers ──────────────────────────────────────────────────────────
  const otpChars = otpCode.padEnd(6, ' ').split('');
  const setOtpDigit = (index, value) => {
    const chars = otpCode.padEnd(6, ' ').split('');
    chars[index] = value;
    setOtpCode(chars.join('').replace(/\s/g, '').slice(0, 6));
  };

  // ── Step 1: request OTP ──────────────────────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiClient('/forgot-password/request-otp', {
        method: 'POST',
        body: { email: email.trim() },
        skipAuthRedirect: true,
      });
      setChallengeId(data?.data?.challenge_id || '');
      setResendIn(30);
      setOtpCode('');
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Could not send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ───────────────────────────────────────────────────────
  const handleVerifyOtp = async (explicitCode) => {
    const code = explicitCode !== undefined ? explicitCode : otpCode;
    if (code.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const data = await apiClient('/forgot-password/verify-otp', {
        method: 'POST',
        body: { challenge_id: challengeId, otp_code: code },
        skipAuthRedirect: true,
      });
      setResetToken(data?.data?.reset_token || '');
      setResetEmail(data?.data?.email || email.trim());
      setPassword('');
      setConfirm('');
      setStep('reset');
    } catch (err) {
      if (err.status === 422 && err.errors) {
        setError(Object.values(err.errors).flat().join(' '));
      } else {
        setError(err.message || 'Invalid code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendIn > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      const data = await apiClient('/forgot-password/request-otp', {
        method: 'POST',
        body: { email: email.trim() },
        skipAuthRedirect: true,
      });
      setChallengeId(data?.data?.challenge_id || '');
      setOtpCode('');
      setResendIn(30);
      setError('A new code was sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: reset password ───────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    const missing = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);
    if (missing.length > 0) {
      setError(`Password needs: ${missing.join(', ')}.`);
      return;
    }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await apiClient('/reset-password', {
        method: 'POST',
        body: { email: resetEmail, token: resetToken, password, password_confirmation: confirm },
        skipAuthRedirect: true,
      });
      setStep('success');
    } catch (err) {
      setError(err.message || 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Masked email hint ────────────────────────────────────────────────────────
  const maskedEmail = email.includes('@')
    ? email.replace(/(^.).*(@.*$)/, '$1***$2')
    : 'your email';
  const strength = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const sm = STRENGTH_META[strength];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="register-modal-glass relative flex w-full max-w-[340px] overflow-hidden rounded-2xl border-0 font-poppins shadow-2xl sm:max-w-md max-h-[92dvh]" onClick={(e) => e.stopPropagation()} style={{ contain: 'layout style paint' }}>
        {/* Close button — top-right of card */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark text-sm" />
        </button>

        <div className="register-glass-panel register-form-glass-panel relative max-h-[92dvh] flex-1 overflow-y-auto px-5 py-8 text-white sm:px-8 sm:py-10">
          {/* ── Step 1: Email ── */}
          {step === 'email' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Forgot Password?</h2>
              <p className="text-sm text-white/70 mb-6">
                Enter your email and we'll send you a 6-digit code.
              </p>
              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div>
                  <label className={labelClass}>EMAIL</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass(false)}
                    required
                    autoFocus
                  />
                </div>
                {error && <ErrorBanner message={error} />}
                <button type="submit" disabled={loading} className={submitBtn}>
                  {loading ? 'Sending...' : 'Send Code'}
                </button>
                <BackToLogin onClick={onBackToLogin} />
              </form>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Check Your Email</h2>
              <div className="mb-5 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5">
                <p className="text-xs text-white/90">
                  We sent a 6-digit code to <span className="font-semibold">{maskedEmail}</span>.
                </p>
              </div>
              <div className="space-y-3">
                <label className={labelClass}>6-DIGIT CODE</label>
                <div className="grid grid-cols-6 gap-2">
                  {otpChars.map((ch, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputsRef.current[idx] = el; }}
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
                        if (nextCode.length === 6 && !loading) {
                          setTimeout(() => handleVerifyOtp(nextCode), 50);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !(otpChars[idx] && otpChars[idx] !== ' ') && idx > 0) {
                          otpInputsRef.current?.[idx - 1]?.focus();
                        }
                      }}
                      className="h-12 w-full rounded-lg border border-white/20 bg-white/10 text-center text-base font-semibold text-white outline-none transition-colors focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-white/70 mt-2">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading || resendIn > 0}
                    className="hover:text-brand-orange transition-colors disabled:opacity-50"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setOtpCode(''); setError(''); }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Back to email step"
                    title="Back"
                  >
                    <ArrowLeft size={16} strokeWidth={2.4} />
                  </button>
                </div>
                {error && <ErrorBanner message={error} />}
                <button
                  type="button"
                  disabled={loading || otpCode.length < 6}
                  onClick={() => handleVerifyOtp()}
                  className={submitBtn}
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: New Password ── */}
          {step === 'reset' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Set New Password</h2>
              <p className="text-sm text-white/70 mb-6">Choose a strong password for your account.</p>
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <label className={labelClass}>NEW PASSWORD</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass(false)} pr-10`}
                      required
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div key={i} className={`flex-1 rounded-full transition-all ${i < strength ? sm.bar : 'bg-white/10'}`} />
                        ))}
                      </div>
                      <p className={`text-[11px] ${sm.color}`}>{sm.label}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>CONFIRM PASSWORD</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="********"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={`${inputClass(false)} pr-10`}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                      <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                    </button>
                  </div>
                </div>
                {error && <ErrorBanner message={error} />}
                <button type="submit" disabled={loading} className={submitBtn}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* ── Step 4: Success ── */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/30 ring-2 ring-brand-teal/40">
                <i className="fa-solid fa-check text-2xl text-brand-teal" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password Reset!</h2>
              <p className="text-sm text-white/70 mb-6">
                Your password has been updated. You can now log in with your new password.
              </p>
              <button type="button" onClick={onBackToLogin} className={submitBtn}>
                Back to Login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

const submitBtn = 'w-full bg-brand-teal hover:bg-brand-teal-dark text-white font-bauhaus font-bold text-lg py-3 rounded-full shadow-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const ErrorBanner = ({ message }) => (
  <div className="rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-300">
    {message}
  </div>
);

const BackToLogin = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="mx-auto flex w-fit items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
    aria-label="Back to login"
    title="Back to Login"
  >
    <ArrowLeft size={16} strokeWidth={2.5} />
    <span>Back to Login</span>
  </button>
);

export default ForgotPassword;

