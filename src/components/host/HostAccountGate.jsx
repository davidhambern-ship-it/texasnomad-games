import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function HostAccountGate({ onSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Check if already signed in
  useEffect(() => {
    base44.auth.isAuthenticated().then(authed => {
      if (authed) {
        base44.auth.me().then(user => { if (user) onSuccess(user); });
      }
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      const user = await base44.auth.me();
      onSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setOtpStep(true);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await base44.auth.verifyOtp({ email, otpCode });
      base44.auth.setToken(access_token);
      const user = await base44.auth.me();
      onSuccess(user);
    } catch (err) {
      setError(err.message || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError) =>
    `w-full px-4 py-3 rounded-lg bg-black/80 border-2 text-white placeholder:text-white/20 focus:outline-none transition-colors font-body ${hasError ? 'border-red-500' : 'border-[#BC13FE]/50 focus:border-[#BC13FE]'}`;

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-[#BC13FE]/20 border-2 border-[#BC13FE]/50 flex items-center justify-center mx-auto mb-4 text-2xl">
            🎛
          </div>
          <h2 className="text-2xl text-white uppercase tracking-widest font-heading">Host Account</h2>
          <p className="text-[9px] text-[#FF5F1F]/80 uppercase tracking-widest mt-1" style={PS2}>
            Step 2 of 2 — TNG Identity
          </p>
        </div>

        {/* OTP Step */}
        {otpStep ? (
          <form onSubmit={handleVerifyOtp} className="p-6 border border-[#BC13FE]/40 rounded-xl bg-black/60 space-y-4"
            style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}>
            <p className="text-[9px] text-white/60 uppercase tracking-widest text-center" style={PS2}>
              Enter the code sent to<br /><span className="text-[#FFD700]">{email}</span>
            </p>
            <input
              type="text"
              value={otpCode}
              onChange={e => { setOtpCode(e.target.value); setError(''); }}
              placeholder="000000"
              className={inputClass(!!error) + ' text-center text-2xl tracking-[0.5em]'}
              maxLength={6}
              autoFocus
            />
            {error && <p className="text-red-400 text-xs text-center tracking-widest font-heading uppercase">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#BC13FE] text-white uppercase rounded-lg hover:bg-[#BC13FE]/80 transition-all text-[10px] tracking-[0.2em] disabled:opacity-50"
              style={PS2}>
              {loading ? 'VERIFYING…' : 'VERIFY CODE'}
            </button>
            <button type="button" onClick={() => base44.auth.resendOtp(email)}
              className="w-full py-2 text-[8px] text-white/40 hover:text-white/70 transition-colors uppercase tracking-widest" style={PS2}>
              Resend Code
            </button>
          </form>
        ) : mode === 'login' ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="p-6 border border-[#BC13FE]/40 rounded-xl bg-black/60 space-y-4"
            style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}>
            <div>
              <label className="block text-[9px] tracking-[0.2em] text-white/60 uppercase mb-1" style={PS2}>Email</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="host@example.com" className={inputClass(!!error)} autoFocus required />
            </div>
            <div>
              <label className="block text-[9px] tracking-[0.2em] text-white/60 uppercase mb-1" style={PS2}>Password</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••" className={inputClass(!!error)} required />
            </div>
            {error && <p className="text-red-400 text-xs text-center tracking-widest font-heading uppercase">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#BC13FE] text-white uppercase rounded-lg hover:bg-[#BC13FE]/80 transition-all text-[10px] tracking-[0.2em] disabled:opacity-50"
              style={PS2}>
              {loading ? 'SIGNING IN…' : 'SIGN IN AS HOST'}
            </button>
            <p className="text-center text-[8px] text-white/40 uppercase tracking-widest" style={PS2}>
              No account?{' '}
              <button type="button" onClick={() => { setMode('register'); setError(''); }}
                className="text-[#FFD700] hover:text-[#FFD700]/80 transition-colors">
                CREATE ONE
              </button>
            </p>
          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegister} className="p-6 border border-[#BC13FE]/40 rounded-xl bg-black/60 space-y-4"
            style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}>
            <div>
              <label className="block text-[9px] tracking-[0.2em] text-white/60 uppercase mb-1" style={PS2}>Email</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="host@example.com" className={inputClass(!!error)} autoFocus required />
            </div>
            <div>
              <label className="block text-[9px] tracking-[0.2em] text-white/60 uppercase mb-1" style={PS2}>Password</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••" className={inputClass(!!error)} required />
            </div>
            <div>
              <label className="block text-[9px] tracking-[0.2em] text-white/60 uppercase mb-1" style={PS2}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="••••••••" className={inputClass(!!error)} required />
            </div>
            {error && <p className="text-red-400 text-xs text-center tracking-widest font-heading uppercase">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#FFD700] text-black uppercase rounded-lg hover:bg-[#FFD700]/80 transition-all text-[10px] tracking-[0.2em] disabled:opacity-50"
              style={PS2}>
              {loading ? 'CREATING…' : 'CREATE ACCOUNT'}
            </button>
            <p className="text-center text-[8px] text-white/40 uppercase tracking-widest" style={PS2}>
              Have an account?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(''); }}
                className="text-[#BC13FE] hover:text-[#BC13FE]/80 transition-colors">
                SIGN IN
              </button>
            </p>
          </form>
        )}

        <p className="text-center text-[8px] text-white/20 mt-4 uppercase tracking-widest" style={PS2}>
          Your TNG profile will show hosting activity
        </p>
      </div>
    </div>
  );
}