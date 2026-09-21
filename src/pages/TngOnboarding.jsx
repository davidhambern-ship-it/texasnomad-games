import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Gamepad2, Loader2, MonitorUp, UserRound } from 'lucide-react';

import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/lib/AuthContext';
import {
  createCurrentTngProfile,
  getCurrentTngProfile,
  registerCurrentDeviceRole,
} from '@/lib/tngProfile';
import { backendMigration } from '@/config/backendMigration';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function TngOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  const requestedNext = new URLSearchParams(location.search).get('next');
  const nextPath =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/';

  const [stage, setStage] = useState('loading');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoadingAuth) return undefined;

    let cancelled = false;

    async function initialize() {
      if (!isAuthenticated || !user) {
        navigate(`/login?next=${encodeURIComponent(nextPath)}`, { replace: true });
        return;
      }

      setDisplayName(
        user.name ||
        user.full_name ||
        user.email?.split('@')[0] ||
        ''
      );

      try {
        const profile = await getCurrentTngProfile(user);
        if (cancelled) return;

        if (profile) {
          navigate(nextPath, { replace: true });
          return;
        }

        setStage('profile');
      } catch (initializeError) {
        if (cancelled) return;
        setError(initializeError.message || 'TNG onboarding could not load.');
        setStage('error');
      }
    }

    initialize();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoadingAuth, navigate, nextPath, user]);

  async function createProfile(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await createCurrentTngProfile(user, { displayName, handle });
      setStage('welcome');
    } catch (profileError) {
      setError(profileError.message || 'Your TNG profile could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseRole(role) {
    setSubmitting(true);
    setError('');

    try {
      await registerCurrentDeviceRole(role);

      if (role === 'host_controller') {
        navigate(
          backendMigration.tngBackendEnabled ? '/host?setup=display' : '/host',
          { replace: true }
        );
      } else {
        navigate('/games', { replace: true });
      }
    } catch (roleError) {
      setError(roleError.message || 'TNG could not register this device.');
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === 'loading') {
    return <OnboardingStatus text="CHECKING YOUR TNG PROFILE" />;
  }

  if (stage === 'error') {
    return <OnboardingStatus text={error || 'TNG ONBOARDING IS UNAVAILABLE'} error />;
  }

  if (stage === 'profile') {
    return (
      <AuthLayout
        icon={UserRound}
        title="Create Your TNG ID"
        subtitle="Your permanent game identity"
      >
        <form onSubmit={createProfile} className="space-y-4">
          <OnboardingError error={error} />

          <label className="block">
            <span
              className="block mb-2 text-white/50 uppercase"
              style={{ ...PS2, fontSize: 7 }}
            >
              Display Name
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={50}
              required
              className="w-full h-12 px-4 rounded-lg border border-[#BC13FE]/40 bg-black/60 text-white outline-none focus:border-[#BC13FE]"
              placeholder="The name players will see"
            />
          </label>

          <label className="block">
            <span
              className="block mb-2 text-white/50 uppercase"
              style={{ ...PS2, fontSize: 7 }}
            >
              Unique TNG Handle
            </span>

            <div className="flex h-12 rounded-lg border border-[#FFD700]/40 bg-black/60 focus-within:border-[#FFD700]">
              <span className="flex items-center pl-4 text-[#FFD700]">@</span>
              <input
                value={handle}
                onChange={(event) =>
                  setHandle(
                    event.target.value
                      .replace(/[^a-zA-Z0-9_]/g, '')
                      .toLowerCase()
                  )
                }
                minLength={3}
                maxLength={24}
                required
                className="flex-1 px-2 bg-transparent text-white outline-none"
                placeholder="your_handle"
              />
            </div>
          </label>

          <p className="text-xs leading-relaxed text-white/35">
            Your TNG profile is a system-owned live stats page. Your permanent
            identity is created here and is not a customizable social profile.
          </p>

          <button
            disabled={submitting}
            className="w-full h-12 rounded-lg border-2 border-[#BC13FE] bg-[#BC13FE]/20 text-[#BC13FE] disabled:opacity-50"
            style={{ ...PS2, fontSize: 8 }}
          >
            {submitting ? 'CREATING…' : 'CREATE TNG PROFILE'}
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (stage === 'welcome') {
    return (
      <AuthLayout
        icon={Gamepad2}
        title="Welcome to TNG"
        subtitle="Your profile is ready"
      >
        <OnboardingError error={error} />
        <button
          onClick={() => setStage('role')}
          className="w-full h-12 rounded-lg border-2 border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]"
          style={{ ...PS2, fontSize: 8 }}
        >
          CHOOSE HOW TO CONNECT →
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={MonitorUp}
      title="Choose Your Role"
      subtitle="This identifies what this device controls"
    >
      <OnboardingError error={error} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RoleButton
          title="Player"
          description="Join a community game from this device."
          color="#FFD700"
          disabled={submitting}
          onClick={() => chooseRole('player')}
        />

        <RoleButton
          title="Host"
          description="Use this device as the Host Controller. The new backend will pair a separate Game Display as the migration reaches that environment."
          color="#BC13FE"
          disabled={submitting}
          onClick={() => chooseRole('host_controller')}
        />
      </div>
    </AuthLayout>
  );
}

function RoleButton({ title, description, color, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border-2 p-5 text-left disabled:opacity-50"
      style={{ borderColor: color, background: `${color}12` }}
    >
      <span
        className="block uppercase mb-3"
        style={{ ...PS2, color, fontSize: 10 }}
      >
        {title}
      </span>
      <span className="text-sm leading-relaxed text-white/55">
        {description}
      </span>
    </button>
  );
}

function OnboardingError({ error }) {
  if (!error) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
      {error}
    </div>
  );
}

function OnboardingStatus({ text, error = false }) {
  return (
    <div className="min-h-screen bg-[#05030b] flex items-center justify-center px-4 text-center">
      <div>
        {!error && (
          <Loader2 className="w-10 h-10 mx-auto mb-5 text-[#BC13FE] animate-spin" />
        )}
        <div
          style={{
            ...PS2,
            fontSize: 9,
            color: error ? '#ef4444' : '#BC13FE',
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}
