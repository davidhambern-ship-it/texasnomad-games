import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

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
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = '#BC13FE'}
        onBlur={e => e.target.style.borderColor = 'rgba(188,19,254,0.35)'}
      />
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome Back"
      subtitle="Log in to your account"
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#BC13FE', fontWeight: 600 }}>Create one free</Link>
        </>
      }
    >
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label htmlFor="password" style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)' }}>PASSWORD</label>
            <Link to="/forgot-password" style={{ ...PS2, fontSize: 6, color: '#BC13FE', textDecoration: 'none' }}>Forgot?</Link>
          </div>
          <TNGInput id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div style={{ marginTop: 4 }}>
          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', height: 46, borderRadius: 10, border: '2px solid #BC13FE',
              background: loading ? 'rgba(188,19,254,0.1)' : 'rgba(188,19,254,0.2)',
              color: loading ? 'rgba(188,19,254,0.5)' : '#BC13FE',
              fontFamily: "'Teko', sans-serif", fontSize: 18, letterSpacing: '0.15em',
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : '0 0 16px rgba(188,19,254,0.3)',
            }}
          >
            {loading && <Loader2 style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} />}
            {loading ? 'LOGGING IN…' : 'LOG IN →'}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}