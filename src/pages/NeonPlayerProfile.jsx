import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Loader2, ShieldCheck, UserRound } from 'lucide-react';

import Header from '@/components/home/Header';
import { tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 p-4 text-center">
      <div className="text-[6px] uppercase tracking-[0.14em] text-white/30" style={PS2}>
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-[#FFD700]">{value}</div>
    </div>
  );
}

export default function NeonPlayerProfile() {
  const { user, logout } = useAuth();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const result = await tngApi.profile.get();
        if (cancelled) return;
        setPayload(result || {});
      } catch (profileError) {
        if (cancelled) return;
        setError(profileError?.message || 'TNG could not load your Neon profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = payload?.profile || null;
  const gameStats = payload?.gameStats || payload?.stats?.games || [];
  const hostStats = payload?.hostStats || payload?.stats?.host || {};

  const totals = useMemo(() => {
    if (!Array.isArray(gameStats)) {
      return {
        gamesPlayed: Number(gameStats?.gamesPlayed || 0),
        wins: Number(gameStats?.wins || 0),
        losses: Number(gameStats?.losses || 0),
      };
    }

    return gameStats.reduce(
      (acc, item) => {
        acc.gamesPlayed += Number(item?.gamesPlayed || item?.games_played || 0);
        acc.wins += Number(item?.wins || 0);
        acc.losses += Number(item?.losses || 0);
        return acc;
      },
      { gamesPlayed: 0, wins: 0, losses: 0 },
    );
  }, [gameStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050308] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#BC13FE]" />
          <div className="mt-4 text-[7px] tracking-widest text-white/35" style={PS2}>
            LOADING TNG PROFILE
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#050308] text-white">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-2xl border border-red-500/35 bg-red-500/5 p-6">
            <div className="text-red-400" style={{ ...PS2, fontSize: 8 }}>
              PROFILE UNAVAILABLE
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              {error || 'TNG could not find your permanent player profile.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                to="/onboarding"
                className="rounded-lg border border-[#FFD700]/60 px-4 py-2 text-[#FFD700]"
              >
                OPEN TNG SETUP
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-lg border border-[#BC13FE]/60 px-4 py-2 text-[#BC13FE]"
              >
                SIGN OUT
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const joined = profile.createdAt || profile.created_at || profile.onboardingCompletedAt || profile.onboarding_completed_at;
  const displayName = profile.displayName || profile.display_name || user?.full_name || 'Nomad';
  const handle = profile.handle || '';
  const hostSessions = Number(hostStats?.sessionsHosted || hostStats?.sessions_hosted || 0);
  const hostedGames = Number(hostStats?.gamesCompleted || hostStats?.games_completed || 0);

  return (
    <div className="min-h-screen bg-[#050308] text-white">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <section className="rounded-2xl border border-[#BC13FE]/35 bg-[#BC13FE]/5 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-[#BC13FE] bg-black/50 shadow-[0_0_25px_rgba(188,19,254,.22)]">
                <UserRound className="h-9 w-9 text-[#BC13FE]" />
              </div>
              <div>
                <div className="text-[7px] uppercase tracking-[0.16em] text-[#BC13FE]" style={PS2}>
                  PERMANENT TNG ID
                </div>
                <h1 className="mt-2 text-4xl font-bold">{displayName}</h1>
                <div className="mt-1 font-mono text-lg text-[#FFD700]">
                  {handle ? `@${handle}` : 'Handle unavailable'}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-green-400/25 bg-green-400/5 px-4 py-3">
              <div className="flex items-center gap-2 text-green-400">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[7px] tracking-widest" style={PS2}>SYSTEM OWNED PROFILE</span>
              </div>
              <div className="mt-2 max-w-xs text-xs leading-relaxed text-white/35">
                This profile is generated by TNG for identity, game history, host history, and notifications. It is not user-editable.
              </div>
            </div>
          </div>

          {joined && (
            <div className="mt-6 border-t border-white/10 pt-4 text-xs text-white/30">
              TNG member since {new Date(joined).toLocaleDateString()}
            </div>
          )}
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="GAMES PLAYED" value={totals.gamesPlayed} />
          <StatCard label="WINS" value={totals.wins} />
          <StatCard label="LOSSES" value={totals.losses} />
          <StatCard label="HOST SESSIONS" value={hostSessions} />
        </section>

        <section className="mt-5 rounded-2xl border border-[#FFD700]/20 bg-black/35 p-5">
          <div className="flex items-center gap-2 text-[#FFD700]">
            <Gamepad2 className="h-5 w-5" />
            <span className="text-[7px] tracking-widest" style={PS2}>LIVE TNG RECORD</span>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-white/50 sm:grid-cols-2">
            <div className="rounded-lg border border-white/8 bg-white/[.02] p-3">
              Completed games hosted: <span className="text-white">{hostedGames}</span>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/[.02] p-3">
              Account: <span className="text-white">{user?.email || 'Signed in'}</span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-white/25">
            Stats update from Neon as TNG records completed multiplayer activity. During live testing, unfinished or abandoned rooms are not counted as completed games.
          </p>
        </section>
      </main>
    </div>
  );
}
