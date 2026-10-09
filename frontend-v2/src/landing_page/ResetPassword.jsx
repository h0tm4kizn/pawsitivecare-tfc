import { useState, useEffect } from 'react';
import { apiFetch } from '../api/apiClient';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

const inputClass = "w-full rounded-lg bg-white/10 border border-white/15 px-4 py-2.5 text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-brand-teal transition-all";
const labelClass = "block text-xs font-semibold tracking-widest mb-2 text-white/80";

const ResetPassword = ({ isOpen, onClose, onBackToLogin }) => {
  useBodyScrollLock(isOpen);
  const [token, setToken]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
    setEmail(params.get('email') || '');
  }, []);

  if (!isOpen) return null;

    const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res  = await apiFetch('/api/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email,
          token,
          password,
          password_confirmation: confirm,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || 'Something went wrong.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

      return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="register-modal-glass w-full max-w-md rounded-2xl overflow-hidden shadow-2xl font-poppins border-0">
        <div className="register-glass-panel relative text-white px-8 py-10">

          <button type="button" onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-brand-orange transition-colors">
            <i className="fa-solid fa-xmark text-2xl" />
          </button>

          {success ? (
            <div className="text-center">
              <div className="text-5xl mb-4">Success</div>
              <h2 className="text-xl font-bold text-white mb-2">Password Reset!</h2>
              <p className="text-sm text-white/70 mb-6">
                Your password has been successfully reset. You can now log in with your new password.
              </p>
              <button type="button" onClick={onBackToLogin}
                className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white font-bold py-3 rounded-full transition-colors">
                Back to Login
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Reset Password</h2>
              <p className="text-sm text-white/70 mb-6">Enter your new password below.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={labelClass}>NEW PASSWORD</label>
                  <input type="password" placeholder="********"
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required />
                </div>

                <div>
                  <label className={labelClass}>CONFIRM PASSWORD</label>
                  <input type="password" placeholder="********"
                    className={inputClass}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white font-bold py-3 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

                <button type="button" onClick={onBackToLogin}
                  className="w-full text-sm text-white/60 hover:text-white transition-colors text-center">
                  &larr; Back to Login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;




