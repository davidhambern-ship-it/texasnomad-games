import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient, waitForNeonSession } from "@/lib/neonAuth";
import { useAuth } from "@/lib/AuthContext";
import { tngApi } from "@/api/tngApi";
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
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const requestedNext = new URLSearchParams(window.location.search).get('next');
  const nextPath = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/';

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [routing, setRouting] = useState(false);
  const routeAttemptedRef = useRef(false);

  async function routeSignedInDevice() {
    setRouting(true);

    const session = await waitForNeonSession();
    if (!session?.user) {
      throw new Error('TNG could not confirm your signed-in session. Please try again.');
    }

    try {
      await tngApi.profile.get();
    } catch (profileError) {
      if (profileError?.code === 'PROFILE_NOT_FOUND' || profileError?.status === 404) {
        const next = encodeURIComponent(nextPath);
        window.location.replace(`/onboarding?next=${next}`);
        return;
      }
      throw profileError;
    }

    let destination = nextPath;

    try {
      const isExplicitPlayerJoin = nextPath.startsWith('/join/');
      const currentDeviceId = localStorage.getItem('tng_device_id');

      if (!isExplicitPlayerJoin) {
        const route = await tngApi.host.getAccountRoute(currentDeviceId);

        if (route?.route === 'display') {
          localStorage.setItem('tng_connection_role', 'display');
          localStorage.removeItem('tng_display_device_id');
          localStorage.removeItem('tng_display_token');
          destination = '/display';
        } else if (route?.route === 'host') {
          localStorage.setItem('tng_connection_role', 'host_controller');
          if (nextPath === '/') destination = '/host';
        }
      }
    } catch (routeError) {
      console.warn('[TNG Login] account device routing check failed:', routeError);
    }

    window.location.replace(destination);
  }

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || routeAttemptedRef.current) return;

    routeAttemptedRef.current = true;
    routeSignedInDevice().catch((routeError) => {
      console.error('[TNG Login] post-auth routing failed:', routeError);
      routeAttemptedRef.current = false;
      setRouting(false);
      setError(routeError?.message || 'TNG could not finish signing you in.');
    });
  }, [isAuthenticated, isLoadingAuth, nextPath]);

  if (!isLoadingAuth && isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#05030b] flex items-center justify-center px-4 text-center">
        <div>
          <Loader2 className="w-10 h-10 mx-auto mb-5 text-[#BC13FE] animate-spin" />
          <div style={{ ...PS2, fontSize: 8, color: '#BC13FE' }}>
            ROUTING THIS DEVICE…
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // Existing Neon/TNG account: ordinary sign-in.
      const signInResult = await authClient.signIn.email({
        email: cleanEmail,
        password,
      });

      if (!signInResult?.error) {
        await routeSignedInDevice();
        return;
      }

      // First visit from the legacy LIVE site: activate the same email in the
      // new Neon/TNG auth system instead of making the user understand that
      // LIVE and LIVE TEST previously had separate identity stores.
      const signUpResult = await authClient.signUp.email({
        email: cleanEmail,
        password,
        name: cleanEmail.split('@')[0] || 'Nomad',
      });

      if (!signUpResult?.error) {
        const session = await waitForNeonSession();
        if (!session?.user) {
          throw new Error('Your TNG login was created, but the session did not finish starting. Please try Continue once more.');
        }
        const next = encodeURIComponent(nextPath);
        window.location.replace(`/onboarding?next=${next}`);
        return;
      }

      // If sign-up also fails, this is normally an existing Neon account with
      // the wrong password (or another credential problem). Do not create a
      // duplicate identity; send the user toward recovery.
      throw new Error(
        signInResult?.error?.message
        || 'We could not sign you in. Check your password or use Forgot.'
      );
    } catch (err) {
      setError(
        err?.message
        || 'We could not sign you in. Check your password or use Forgot.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
        additionalParams: {
          prompt: "select_account",
        },
      });
      if (result?.error) throw new Error(result.error.message || "Google sign-in failed");
    } catch (err) {
      setError(err.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Enter TNG"
      subtitle="Sign in or activate your TNG account"
      footer={
        <>
          Don't have an account?{' '}
          <Link to={`/register?next=${encodeURIComponent(nextPath)}`} style={{ color: '#BC13FE', fontWeight: 600 }}>Create one free</Link>
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

      <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(34,211,238,0.24)', background: 'rgba(34,211,238,0.05)', color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.55 }}>
        First time on the new TNG system? Use the email and password you want for TNG. If your TNG login does not exist yet, it will be activated automatically and you’ll create your TNG ID next.
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="email" style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>EMAIL</label>
          <TNGInput id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus autoComplete="email" />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label htmlFor="password" style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)' }}>PASSWORD</label>
            <Link to={`/forgot-password?next=${encodeURIComponent(nextPath)}`} style={{ ...PS2, fontSize: 6, color: '#BC13FE', textDecoration: 'none' }}>Forgot?</Link>
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
            {loading ? 'ENTERING TNG…' : 'CONTINUE →'}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}