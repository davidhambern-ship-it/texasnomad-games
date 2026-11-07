import React, { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Mail, Lock, User, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { authClient, startTngBrowserSession, waitForNeonSession } from "@/lib/neonAuth";

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function Field({ id, label, icon: Icon, ...props }) {
  return (
    <div>
      <label htmlFor={id} style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.48)', display: 'block', marginBottom: 7 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Icon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'rgba(188,19,254,0.6)' }} />
        <input
          id={id}
          required
          {...props}
          style={{
            width: '100%', paddingLeft: 38, paddingRight: 14, height: 46,
            background: 'rgba(0,0,0,0.6)', border: '1.5px solid rgba(188,19,254,0.35)',
            borderRadius: 10, color: 'white', fontSize: 14, fontFamily: "'Inter', sans-serif",
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const cleanName = name.trim().slice(0, 80);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const result = await authClient.signUp.email({
        name: cleanName,
        email: cleanEmail,
        password,
        callbackURL: `${window.location.origin}/onboarding`,
      });

      if (result?.error) {
        throw new Error(result.error.message || 'TNG could not create your account.');
      }

      startTngBrowserSession();
      const session = await waitForNeonSession({ attempts: 8, initialDelayMs: 300 });
      if (session?.user) {
        window.location.replace('/onboarding');
        return;
      }

      setMessage('Your TNG account request was accepted. If email verification is required, check your inbox, then sign in.');
    } catch (signupError) {
      setError(signupError?.message || 'TNG could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create a TNG Account"
      subtitle="Create your TexasNomad Games account directly."
      footer={
        <>
          Already have a TNG account?{' '}
          <Link to="/login" style={{ color: '#BC13FE', fontWeight: 600 }}>Sign in</Link>
        </>
      }
    >
      {error && (
        <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}
      {message && (
        <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.3)', color: '#67E8F9', fontSize: 13 }}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field id="name" label="DISPLAY NAME" icon={User} type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
        <Field id="email" label="EMAIL" icon={Mail} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field id="password" label="PASSWORD" icon={Lock} type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button
          type="submit"
          disabled={loading || !name.trim() || !email.trim() || password.length < 8}
          style={{
            width: '100%', height: 46, marginTop: 4, borderRadius: 10, border: '2px solid #BC13FE',
            background: loading ? 'rgba(188,19,254,0.1)' : 'rgba(188,19,254,0.2)',
            color: loading ? 'rgba(188,19,254,0.5)' : '#BC13FE',
            fontFamily: "'Teko', sans-serif", fontSize: 18, letterSpacing: '0.15em',
            cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          {loading && <Loader2 style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} />}
          {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT →'}
        </button>
      </form>
    </AuthLayout>
  );
}
