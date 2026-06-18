import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function TNGInput({ id, type, placeholder, value, onChange, autoFocus, autoComplete }) {
  return (
    <div style={{ position: 'relative' }}>
      {type === 'email'
        ? <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'rgba(188,19,254,0.5)' }} />
        : <Lock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'rgba(188,19,254,0.5)' }} />
      }
      <input
        id={id} type={type} placeholder={placeholder} value={value} onChange={onChange}
        autoFocus={autoFocus} autoComplete={autoComplete} required
        style={{
          width: '100%', paddingLeft: 38, paddingRight: 14, height: 46,
          background: 'rgba(0,0,0,0.6)', border: '1.5px solid rgba(188,19,254,0.35)',
          borderRadius: 10, color: 'white', fontSize: 14, fontFamily: "'Inter', sans-serif",
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = '#BC13FE'}
        onBlur={e => e.target.style.borderColor = 'rgba(188,19,254,0.35)'}
      />
    </div>
  );
}

function TNGButton({ onClick, disabled, loading, children, type = 'button', color = '#BC13FE' }) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        width: '100%', height: 46, borderRadius: 10, border: `2px solid ${color}`,
        background: disabled ? `${color}20` : `${color}25`,
        color: disabled ? `${color}60` : color,
        fontFamily: "'Teko', sans-serif", fontSize: 18, letterSpacing: '0.15em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'background 0.2s, box-shadow 0.2s',
        boxShadow: disabled ? 'none' : `0 0 16px ${color}30`,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}40`; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = `${color}25`; }}
    >
      {loading && <Loader2 style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} />}
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  const FreeBanner = () => (
    <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,215,0,0.4)', background: 'rgba(255,215,0,0.06)', textAlign: 'center' }}>
      <div style={{ ...PS2, fontSize: 8, background: 'linear-gradient(90deg, #BC13FE, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>
        ⚡ FREE SIGN UP — LIMITED TIME
      </div>
      <p style={{ ...PS2, fontSize: 6, color: 'rgba(255,215,0,0.65)', lineHeight: 1.9, margin: 0 }}>
        Join now for FREE. At launch, membership will be{' '}
        <span style={{ color: '#FF5F1F' }}>$10/month</span>.{' '}
        Lock in your spot today.
      </p>
    </div>
  );

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Verify Your Email" subtitle={`We sent a 6-digit code to ${email}`}>
        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <TNGButton onClick={handleVerify} disabled={loading || otpCode.length < 6} loading={loading} color="#BC13FE">
          {loading ? 'VERIFYING…' : 'VERIFY CODE'}
        </TNGButton>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 16, fontFamily: "'Inter', sans-serif" }}>
          Didn't get it?{' '}
          <button onClick={handleResend} style={{ color: '#BC13FE', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            Resend code
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Join the Arena"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#BC13FE', fontWeight: 600 }}>Log in</Link>
        </>
      }
    >
      <FreeBanner />

      {/* Google */}
      <button
        onClick={handleGoogle}
        style={{
          width: '100%', height: 46, borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 10, cursor: 'pointer', fontSize: 14,
          fontFamily: "'Inter', sans-serif", marginBottom: 18, transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      >
        <GoogleIcon style={{ width: 18, height: 18 }} />
        Continue with Google
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.2)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="email" style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>EMAIL</label>
          <TNGInput id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password" style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>PASSWORD</label>
          <TNGInput id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="confirm" style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>CONFIRM PASSWORD</label>
          <TNGInput id="confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div style={{ marginTop: 4 }}>
          <TNGButton type="submit" disabled={loading} loading={loading} color="#BC13FE">
            {loading ? 'CREATING ACCOUNT…' : 'CREATE FREE ACCOUNT →'}
          </TNGButton>
        </div>
      </form>
    </AuthLayout>
  );
}