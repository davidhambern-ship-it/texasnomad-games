import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Users } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import BFFTngBoard from '@/components/bff/BFFTngBoard.jsx';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function PlayerCard({ player, team, onAssign, busy }) {
  const accent = team === 1 ? '#BC13FE' : team === 2 ? '#FF5F1F' : '#FFD700';
  return (
    <div
      className="rounded-xl border bg-black/45 p-3"
      style={{
        borderColor: `${accent}55`,
        boxShadow: team ? `0 0 16px ${accent}18` : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{player.playerName || player.name || 'Player'}</div>
          <div className="mt-1 text-[7px] uppercase tracking-widest text-white/30" style={PS2}>
            SEAT {player.seatNumber ?? '—'}{player.handle ? ` · @${player.handle}` : ''}
          </div>
        </div>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#4ade80]"
          title="Connected"
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign(player.playerId, 1)}
          className="rounded-lg border px-2 py-2 text-[6px] uppercase tracking-widest disabled:opacity-30"
          style={{ ...PS2, borderColor: team === 1 ? '#BC13FE' : '#BC13FE55', color: '#BC13FE', background: team === 1 ? '#BC13FE18' : 'transparent' }}
        >
          TEAM 1
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign(player.playerId, 2)}
          className="rounded-lg border px-2 py-2 text-[6px] uppercase tracking-widest disabled:opacity-30"
          style={{ ...PS2, borderColor: team === 2 ? '#FF5F1F' : '#FF5F1F55', color: '#FF5F1F', background: team === 2 ? '#FF5F1F18' : 'transparent' }}
        >
          TEAM 2
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign(player.playerId, null)}
          className="rounded-lg border border-white/15 px-2 py-2 text-[6px] uppercase tracking-widest text-white/35 disabled:opacity-30"
          style={PS2}
        >
          CLEAR
        </button>
      </div>
    </div>
  );
}

export default function NeonBFFHostPanel({ controllerId }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [family1, setFamily1] = useState('');
  const [family2, setFamily2] = useState('');

  const gameState = room?.gameState || {};
  const players = Array.isArray(gameState.players)
    ? gameState.players
    : Array.isArray(room?.players)
      ? room.players
      : [];

  const refresh = useCallback(async () => {
    if (!controllerId) return;
    try {
      const payload = await tngApi.bff.getHostState(controllerId);
      setRoom(payload.room || null);
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not load BFF Host state.');
    }
  }, [controllerId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 800);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    setFamily1(gameState.family1 || '');
    setFamily2(gameState.family2 || '');
  }, [gameState.family1, gameState.family2]);

  const updateState = useCallback(async (patch) => {
    if (!controllerId || busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = await tngApi.host.updateRoomState(controllerId, patch);
      const fresh = await tngApi.bff.getHostState(controllerId);
      setRoom(fresh.room || payload.room || null);
    } catch (err) {
      setError(err?.message || 'BFF Host state could not be updated.');
    } finally {
      setBusy(false);
    }
  }, [busy, controllerId]);

  const teamMap = gameState.playerTeams || {};

  const assignPlayer = async (playerId, team) => {
    const next = { ...teamMap };
    if (team == null) delete next[playerId];
    else next[playerId] = team;
    await updateState({ playerTeams: next });
  };

  const saveFamilyNames = async () => {
    await updateState({
      family1: family1.trim() || 'Family 1',
      family2: family2.trim() || 'Family 2',
    });
  };

  const team1 = useMemo(() => players.filter((p) => Number(teamMap[p.playerId]) === 1), [players, teamMap]);
  const team2 = useMemo(() => players.filter((p) => Number(teamMap[p.playerId]) === 2), [players, teamMap]);
  const unassigned = useMemo(() => players.filter((p) => !teamMap[p.playerId]), [players, teamMap]);

  if (!room && !error) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#BC13FE]" />
        <span className="text-sm text-white/40">Loading BFF Host controls…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
          {error}
        </div>
      )}

      <header className="rounded-xl border border-[#BC13FE]/25 bg-black/55 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[7px] uppercase tracking-[.22em] text-[#BC13FE]" style={PS2}>
              BFF · NEON HOST CONTROL
            </div>
            <div className="mt-1 text-sm text-white/40">
              Lobby, teams, board state, and player presence now come from the Neon room.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-[#FFD700]/40 px-3 py-2 text-[7px] uppercase tracking-widest text-[#FFD700]" style={PS2}>
              ROOM {room?.roomCode || '—'}
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={busy}
              className="rounded-lg border border-white/15 p-2 text-white/40 disabled:opacity-30"
              title="Refresh"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <div className="space-y-3">
          <BFFTngBoard
            gs={{
              ...gameState,
              players,
              family1: gameState.family1 || family1 || 'Family 1',
              family2: gameState.family2 || family2 || 'Family 2',
            }}
          />

          <div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/[.03] p-4">
            <div className="mb-3 text-[7px] uppercase tracking-[.18em] text-[#FFD700]" style={PS2}>
              FAMILY NAMES
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={family1}
                onChange={(e) => setFamily1(e.target.value)}
                placeholder="Family 1"
                className="rounded-lg border border-[#BC13FE]/35 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#BC13FE]"
              />
              <input
                value={family2}
                onChange={(e) => setFamily2(e.target.value)}
                placeholder="Family 2"
                className="rounded-lg border border-[#FF5F1F]/35 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={saveFamilyNames}
                className="rounded-lg border border-[#4ade80]/45 px-4 py-2 text-[7px] uppercase tracking-widest text-[#4ade80] disabled:opacity-30"
                style={PS2}
              >
                SAVE
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <section className="rounded-xl border border-white/10 bg-black/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/55">
                <Users className="h-4 w-4" />
                <span className="text-[7px] uppercase tracking-[.18em]" style={PS2}>CONNECTED PLAYERS</span>
              </div>
              <div className="font-heading text-xl text-[#FFD700]">{players.length}</div>
            </div>

            <div className="space-y-2">
              {players.length ? players.map((player) => (
                <PlayerCard
                  key={player.playerId}
                  player={player}
                  team={teamMap[player.playerId] || null}
                  onAssign={assignPlayer}
                  busy={busy}
                />
              )) : (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-white/25">
                  No players are registered in this BFF room yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-black/45 p-4">
            <div className="text-[6px] uppercase tracking-[.18em] text-white/30" style={PS2}>TEAM BREAKDOWN</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-[#BC13FE]/25 bg-[#BC13FE]/5 p-2">
                <div className="text-[5px] text-[#BC13FE]/70" style={PS2}>TEAM 1</div>
                <div className="mt-1 text-xl text-[#BC13FE]">{team1.length}</div>
              </div>
              <div className="rounded-lg border border-[#FF5F1F]/25 bg-[#FF5F1F]/5 p-2">
                <div className="text-[5px] text-[#FF5F1F]/70" style={PS2}>TEAM 2</div>
                <div className="mt-1 text-xl text-[#FF5F1F]">{team2.length}</div>
              </div>
              <div className="rounded-lg border border-[#FFD700]/25 bg-[#FFD700]/5 p-2">
                <div className="text-[5px] text-[#FFD700]/70" style={PS2}>OPEN</div>
                <div className="mt-1 text-xl text-[#FFD700]">{unassigned.length}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#22D3EE]/20 bg-[#22D3EE]/[.03] p-4">
            <div className="text-[6px] uppercase tracking-[.18em] text-[#22D3EE]" style={PS2}>MIGRATION STATUS</div>
            <div className="mt-2 text-xs leading-relaxed text-white/40">
              Neon lobby sync is live. The next pass is moving BFF player actions and the 331-survey bank off Base44 so Host and Players operate on this same state.
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
