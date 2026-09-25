import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Link2, Loader2, ShieldCheck, UserRound } from 'lucide-react';

import Header from '@/components/home/Header';
import { tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';
import TngSocialPanel from '@/components/social/TngSocialPanel';
import { getPublicTngName } from '@/lib/publicTngName';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const GAME_LABELS = {
  'square-biz': 'Square Biz!',
  spades: 'Spades',
  hangman: 'Hangman',
  'word-search': 'Word Search',
  bff: 'BFF',
  sudoku: 'Sudoku TN',
  'see-that': 'See That?',
  'word-wrangler': 'Word Wrangler',
  txd: 'TND Dominoes',
};

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
  const [bernaStatus, setBernaStatus] = useState(null);
  const [bernaLoading, setBernaLoading] = useState(false);
  const [bernaCode, setBernaCode] = useState('');
  const [bernaNotice, setBernaNotice] = useState('');
  const [bernaError, setBernaError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [result, restoredStats] = await Promise.all([
          tngApi.profile.get(),
          tngApi.stats.getProfile().catch(() => null),
        ]);
        if (cancelled) return;

        const next = result || {};
        if (next.profile && Array.isArray(restoredStats?.playerStats)) {
          next.profile = {
            ...next.profile,
            playerStats: restoredStats.playerStats,
          };
        }
        setPayload(next);
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

  useEffect(() => {
    if (!profile) return;

    let cancelled = false;

    async function loadBernaVerse() {
      setBernaLoading(true);
      setBernaError('');

      try {
        const status = await tngApi.bernaverse.status();
        if (!cancelled) setBernaStatus(status || { linked: false });
      } catch (statusError) {
        if (!cancelled) {
          setBernaError(statusError?.message || 'BERNAverse status is unavailable.');
        }
      } finally {
        if (!cancelled) setBernaLoading(false);
      }
    }

    loadBernaVerse();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.accountId, profile?.account_id, profile?.handle]);

  const gameStats = Array.isArray(profile?.playerStats) ? profile.playerStats : [];
  const hostStats = profile?.hostStats || {};

  const totals = useMemo(() => (
    gameStats.reduce(
      (acc, item) => {
        const completed = Number(item?.gamesPlayed || item?.games_played || 0);
        const quits = Number(item?.quitGames || item?.quit_games || 0);
        acc.completedGames += completed;
        acc.quitGames += quits;
        acc.gamesPlayed += completed + quits;
        acc.wins += Number(item?.wins || 0);
        acc.losses += Number(item?.losses || 0);
        acc.totalScore += Number(item?.totalScore || item?.total_score || 0);
        return acc;
      },
      { gamesPlayed: 0, completedGames: 0, quitGames: 0, wins: 0, losses: 0, totalScore: 0 },
    )
  ), [gameStats]);

  const mostPlayed = useMemo(() => (
    [...gameStats].sort((a, b) => {
      const aPlayed =
        Number(a?.gamesPlayed || a?.games_played || 0) +
        Number(a?.quitGames || a?.quit_games || 0);
      const bPlayed =
        Number(b?.gamesPlayed || b?.games_played || 0) +
        Number(b?.quitGames || b?.quit_games || 0);
      return bPlayed - aPlayed;
    })[0] || null
  ), [gameStats]);

  const highScores = useMemo(() => (
    [...gameStats]
      .sort((a, b) => Number(b?.bestScore || b?.best_score || 0) - Number(a?.bestScore || a?.best_score || 0))
  ), [gameStats]);

  const winRate = totals.gamesPlayed > 0
    ? Math.round((totals.wins / totals.gamesPlayed) * 100)
    : 0;

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
  const accountName = profile.displayName || profile.display_name || user?.full_name || 'Nomad';
  const publicName = getPublicTngName(profile, 'Nomad');
  const hostSessions = Number(hostStats?.sessionsHosted || hostStats?.sessions_hosted || 0);
  const hostedGames = Number(hostStats?.gamesCompleted || hostStats?.games_completed || 0);

  async function connectBernaVerse(event) {
    event.preventDefault();
    const code = bernaCode.trim();

    if (!code) {
      setBernaError('Enter the link code from your TacTalk BERNAverse wallet.');
      return;
    }

    setBernaLoading(true);
    setBernaError('');
    setBernaNotice('');

    try {
      const result = await tngApi.bernaverse.link(code);
      setBernaStatus(result || { linked: true });
      setBernaCode('');

      const claimed = Number(result?.pending_rewards_claimed || 0);
      const tacs = Number(result?.tacs_claimed || 0);

      if (claimed > 0) {
        setBernaNotice(
          `Connected. We also found ${claimed} waiting reward${claimed === 1 ? '' : 's'}${tacs ? ` worth ${tacs} tacs` : ''}.`
        );
      } else {
        setBernaNotice('Connected. TNG and TacTalk now recognize the same BERNAverse wallet.');
      }
    } catch (linkError) {
      setBernaError(linkError?.message || 'That BERNAverse link code did not work.');
    } finally {
      setBernaLoading(false);
    }
  }

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
                <h1 className="mt-2 text-4xl font-bold text-[#FFD700]">{publicName}</h1>
                <div className="mt-2 text-xs text-white/30">
                  Account name: {accountName}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-green-400/25 bg-green-400/5 px-4 py-3">
                <div className="flex items-center gap-2 text-green-400">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-[7px] tracking-widest" style={PS2}>SYSTEM OWNED PROFILE</span>
                </div>
                <div className="mt-2 max-w-xs text-xs leading-relaxed text-white/35">
                  This profile is generated by TNG for identity, game history, host history, and notifications. It is not user-editable.
                </div>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className="w-full rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                style={{ ...PS2, fontSize: 7 }}
              >
                ↪ SIGN OUT / SWITCH ACCOUNT
              </button>
            </div>
          </div>

          {joined && (
            <div className="mt-6 border-t border-white/10 pt-4 text-xs text-white/30">
              TNG member since {new Date(joined).toLocaleDateString()}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-[#00E5FF]/25 bg-[#00E5FF]/[.035] p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[#00E5FF]">
                <Link2 className="h-5 w-5" />
                <span className="text-[7px] tracking-widest" style={PS2}>BERNAVERSE PASSPORT</span>
              </div>

              {bernaStatus?.linked ? (
                <>
                  <h2 className="mt-3 text-2xl font-black">CONNECTED</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    This TNG profile is connected to your BERNAverse wallet. Rewards earned here can follow you into TacTalk and future BERNAverse sites.
                  </p>
                  <div className="mt-4 inline-flex rounded-full border border-[#FFD700]/30 bg-[#FFD700]/5 px-4 py-2 text-sm font-bold text-[#FFD700]">
                    {Number(bernaStatus?.balance || 0)} TACS
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-2xl font-black">CONNECT YOUR WALLET</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    Open TacTalk, click your Tac balance, choose <strong className="text-white/70">Connect TNG</strong>, then enter the one-time code here.
                  </p>
                </>
              )}
            </div>

            {!bernaStatus?.linked && (
              <form onSubmit={connectBernaVerse} className="w-full max-w-sm rounded-xl border border-white/10 bg-black/30 p-4">
                <label className="text-[6px] tracking-widest text-white/30" style={PS2}>
                  TACTALK LINK CODE
                </label>
                <input
                  value={bernaCode}
                  onChange={(event) => {
                    setBernaCode(event.target.value.toUpperCase());
                    setBernaError('');
                    setBernaNotice('');
                  }}
                  placeholder="XXXX-XXXX-XXXX"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="mt-3 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-3 font-mono uppercase tracking-[.12em] text-white outline-none focus:border-[#00E5FF]/70"
                />
                <button
                  type="submit"
                  disabled={bernaLoading}
                  className="mt-3 w-full rounded-lg border border-[#00E5FF]/50 bg-[#00E5FF]/10 px-4 py-3 text-[#00E5FF] disabled:opacity-50"
                  style={{ ...PS2, fontSize: 7 }}
                >
                  {bernaLoading ? 'CONNECTING...' : 'CONNECT BERNAverse'}
                </button>
              </form>
            )}
          </div>

          {bernaNotice && (
            <div className="mt-4 rounded-lg border border-green-400/25 bg-green-400/5 px-4 py-3 text-sm text-green-300">
              {bernaNotice}
            </div>
          )}
          {bernaError && (
            <div className="mt-4 rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              {bernaError}
            </div>
          )}
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
          <StatCard label="GAMES PLAYED" value={totals.gamesPlayed} />
          <StatCard label="COMPLETED" value={totals.completedGames} />
          <StatCard label="WINS" value={totals.wins} />
          <StatCard label="LOSSES" value={totals.losses} />
          <StatCard label="QUIT GAMES" value={totals.quitGames} />
          <StatCard label="WIN RATE" value={`${winRate}%`} />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
          <div className="rounded-2xl border border-[#FF5F1F]/20 bg-[#FF5F1F]/[.03] p-5">
            <div className="text-[7px] tracking-widest text-[#FF5F1F]" style={PS2}>MOST PLAYED</div>
            {mostPlayed ? (
              <>
                <div className="mt-4 text-3xl font-black text-white">
                  {GAME_LABELS[mostPlayed.gameId] || mostPlayed.gameId}
                </div>
                <div className="mt-2 text-sm text-white/45">
                  {Number(mostPlayed.gamesPlayed || mostPlayed.games_played || 0) + Number(mostPlayed.quitGames || mostPlayed.quit_games || 0)} games · {Number(mostPlayed.wins || 0)} wins · {Number(mostPlayed.losses || 0)} losses · {Number(mostPlayed.quitGames || mostPlayed.quit_games || 0)} quits
                </div>
              </>
            ) : (
              <div className="mt-4 text-sm text-white/30">No completed games recorded yet.</div>
            )}
          </div>

          <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/[.025] p-5">
            <div className="text-[7px] tracking-widest text-[#FFD700]" style={PS2}>HIGH SCORES BY GAME</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {highScores.length > 0 ? highScores.map((item) => (
                <div key={item.gameId} className="rounded-xl border border-white/8 bg-black/30 p-3">
                  <div className="text-sm font-black text-white/80">{GAME_LABELS[item.gameId] || item.gameId}</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[6px] tracking-widest text-white/25" style={PS2}>BEST SCORE</div>
                      <div className="mt-1 text-2xl font-black text-[#FFD700]">
                        {Number(item.bestScore || item.best_score || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right text-xs text-white/30">
                      Total {Number(item.totalScore || item.total_score || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-white/30">Your high-score wall wakes up after completed games are recorded.</div>
              )}
            </div>
          </div>
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
            TNG keeps completed games and quit games separate. A quit is only recorded when a player intentionally exits a started multiplayer game before it is completed; refreshes and connection drops do not automatically count as quits.
          </p>
        </section>

        <TngSocialPanel />
      </main>
    </div>
  );
}
