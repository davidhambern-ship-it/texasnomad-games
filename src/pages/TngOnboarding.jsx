import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, UserRound } from 'lucide-react';

import AuthLayout from '@/components/AuthLayout';
import { tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';
import { startTngBrowserSession, waitForNeonSession } from '@/lib/neonAuth';
import {
  createPreviewTngProfile,
  getPreviewTngProfile,
} from '@/lib/previewTngProfile';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function TngOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth, checkUserAuth } = useAuth();
  const requestedNext = new URLSearchParams(location.search).get('next');
  const nextPath = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
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
        const recoveredSession = await waitForNeonSession({
          attempts: 12,
          initialDelayMs: 150,
        });

        if (recoveredSession?.user) {
          await checkUserAuth();
          return;
        }

        navigate(`/login?next=${encodeURIComponent(nextPath)}`, { replace: true });
        return;
      }

      setDisplayName(user.full_name || user.email?.split('@')[0] || '');

      try {
        const profile = await getPreviewTngProfile(user);
        if (cancelled) return;

        if (profile) {
          startTngBrowserSession();
          if (nextPath !== '/') {
            navigate(nextPath, { replace: true });
          } else {
            try { sessionStorage.removeItem('tng_welcome_complete'); } catch {}
            navigate('/welcome', { replace: true });
          }
          return;
        }

        setStage('invite');
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
  }, [checkUserAuth, isAuthenticated, isLoadingAuth, navigate, user]);

  async function createProfile(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await createPreviewTngProfile(user, { displayName, handle });
      await tngApi.stats.getProfile().catch(() => null);
      startTngBrowserSession();
      if (nextPath !== '/') {
        navigate(nextPath, { replace: true });
      } else {
        try { sessionStorage.removeItem('tng_welcome_complete'); } catch {}
        navigate('/welcome', { replace: true });
      }
    } catch (profileError) {
      setError(profileError.message || 'Your TNG profile could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === 'loading') {
    return <Status text="CHECKING YOUR TNG PROFILE" />;
  }

  if (stage === 'error') {
    return <Status text={error || 'TNG ONBOARDING IS UNAVAILABLE'} error />;
  }

  if (stage === 'invite') {
    return (
      <AuthLayout
        icon={UserRound}
        title="Create Your FREE TNG Profile"
        subtitle="Your sign-in is ready. Now create your TNG identity."
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/[.04] p-5">
            <div className="text-[7px] uppercase tracking-[.18em] text-[#FFD700]" style={PS2}>
              TNG PROFILE
            </div>

            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Your Google or email sign-in only verifies who you are. Your TNG Profile is the identity people see inside TexasNomad Games. There is no charge to create it.
            </p>

            <div className="mt-4 grid gap-2 text-sm text-white/65">
              <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                <span className="text-[#FFD700]">@handle</span> — your public TNG name that other players see
              </div>
              <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                Add and keep <span className="text-white">friends</span>, including players and hosts
              </div>
              <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                Send <span className="text-white">direct messages</span> to your TNG friends
              </div>
              <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                Send and receive <span className="text-white">game invites</span>
              </div>
              <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                Keep your <span className="text-white">game stats, wins, scores, and host history</span> tied to one permanent TNG ID
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStage('profile')}
            className="w-full h-12 rounded-lg border-2 border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/15 transition-colors"
            style={{ ...PS2, fontSize: 8 }}
          >
            CREATE MY FREE TNG PROFILE →
          </button>

          <p className="text-center text-[10px] leading-relaxed text-white/25">
            TNG keeps your account name on your profile record, but the community sees your public @handle.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (stage === 'profile') {
    return (
      <AuthLayout
        icon={UserRound}
        title="Choose Your TNG Identity"
        subtitle="Your @handle is what the community sees"
      >
        <form onSubmit={createProfile} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <label className="block">
            <span className="block mb-2 text-white/50 uppercase" style={{ ...PS2, fontSize: 7 }}>
              Account Name
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={50}
              required
              className="w-full h-12 px-4 rounded-lg border border-[#BC13FE]/40 bg-black/60 text-white outline-none focus:border-[#BC13FE]"
              placeholder="Your name (kept with your account)"
            />
          </label>

          <label className="block">
            <span className="block mb-2 text-white/50 uppercase" style={{ ...PS2, fontSize: 7 }}>
              Public TNG Handle
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
            Your <span className="text-[#FFD700]">@handle</span> is your public TNG identity. It is what other
            players see in rooms, friends, messages, invites, profiles, and community activity.
            Your account name stays attached to your TNG account record; your @handle is the name shown publicly.
          </p>

          <button
            disabled={submitting}
            className="w-full h-12 rounded-lg border-2 border-[#BC13FE] bg-[#BC13FE]/20 text-[#BC13FE] disabled:opacity-50"
            style={{ ...PS2, fontSize: 8 }}
          >
            {submitting ? 'CREATING…' : 'CREATE FREE TNG PROFILE'}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return <Status text="FINISHING YOUR TNG PROFILE" />;
}

function Status({ text, error = false }) {
  return (
    <div className="min-h-screen bg-[#05030b] flex items-center justify-center px-4 text-center">
      <div>
        {!error && (
          <Loader2 className="w-10 h-10 mx-auto mb-5 text-[#BC13FE] animate-spin" />
        )}
        <div style={{ ...PS2, fontSize: 9, color: error ? '#ef4444' : '#BC13FE' }}>
          {text}
        </div>
      </div>
    </div>
  );
}
