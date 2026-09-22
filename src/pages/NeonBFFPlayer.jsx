import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Radio, Users, Zap } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import BFFTngBoard from '@/components/bff/BFFTngBoard.jsx';
import { TngNotificationToaster } from '@/components/social/TngNotificationToaster';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function statusFor(gameState, myTeam, buzzWinner) {
  const phase = gameState.phase || 'waiting';

  if (buzzWinner) {
    return buzzWinner.playerName ? `${buzzWinner.playerName} BUZZED` : 'BUZZ LOCKED';
  }
  if (gameState.buzzer_open || gameState.buzzer_phase === 'buzzer_active') return 'BUZZERS OPEN';
  if (gameState.steal_mode) return myTeam === gameState.control_team ? 'DEFEND THE BANK' : 'STEAL CHANCE';
  if (phase === 'waiting' || phase === 'setup') return 'WAITING FOR HOST';
  if (phase === 'round_over') return 'ROUND OVER';
  if (phase === 'playing') {
    return Number(gameState.control_team || gameState.active_turn || 1) === myTeam
      ? 'YOUR FAMILY HAS CONTROL'
      : 'OTHER FAMILY IN CONTROL';
  }
  return String(phase).replace(/_/g, ' ').toUpperCase();
}

function FamilyBadge({ team, name, active }) {
  const accent = team === 1 ? '#BC13FE' : '#FF5F1F';

  return (
    <div
      className="rounded-lg border px-2.5 py-2 text-center"
      style={{
        borderColor: active ? accent : `${accent}40`,
        background: active ? `${accent}12` : 'rgba(255,255,255,.02)',
        boxShadow: active ? `0 0 14px ${accent}20` : 'none',
      }}
    >
      <div className="text-[5px] uppercase tracking-widest text-white/25" style={PS2}>
        YOUR FAMILY
      </div>
      <div className="mt-1 truncate text-sm font-black uppercase" style={{ color: accent }}>
        {name}
      </div>
    </div>
  );
}

function TeamPlayers({ players, team, familyName }) {
  const accent = team === 1 ? '#BC13FE' : '#FF5F1F';
  const familyPlayers = players.filter((player) => Number(player.familyTeam) === team);

  return (
    <section
      className="rounded-xl border bg-black/50 p-2.5"
      style={{ borderColor: `${accent}30` }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="truncate text-[7px] font-black uppercase" style={{ color: accent }}>
          {familyName}
        </div>
        <div className="text-[5px] uppercase tracking-widest text-white/25" style={PS2}>
          {familyPlayers.length} PLAYER{familyPlayers.length === 1 ? '' : 'S'}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {familyPlayers.length ? familyPlayers.map((player) => (
          <span
            key={player.playerId}
            className="rounded-md border px-2 py-1 text-[9px]"
            style={{
              borderColor: `${accent}35`,
              background: `${accent}08`,
              color: 'rgba(255,255,255,.70)',
            }}
          >
            {player.playerName || player.name || 'Player'}
          </span>
        )) : (
          <span className="text-[9px] italic text-white/18">Waiting for family members…</span>
        )}
      </div>
    </section>
  );
}

export default function NeonBFFPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flashCue, setFlashCue] = useState(null);
  const lastSoundCueRef = useRef(null);

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const myAccountId = participant?.accountId || participant?.playerId || null;
  const myPlayer = players.find((player) =>
    String(player.accountId || player.playerId || '') === String(myAccountId || '')
    || String(player.deviceSessionId || '') === String(deviceId || '')
  ) || null;
  const myTeam = Number(myPlayer?.familyTeam || participant?.familyTeam || 0) || null;
  const myFamilyName = myTeam === 2
    ? (gameState.family2 || 'Family 2')
    : (gameState.family1 || 'Family 1');
  const controlTeam = Number(gameState.control_team || gameState.active_turn || 1) === 2 ? 2 : 1;
  const buzzWinner = gameState.buzz_winner || null;
  const buzzerOpen = Boolean(gameState.buzzer_open || gameState.buzzer_phase === 'buzzer_active');
  const iWonBuzz = Boolean(
    buzzWinner
    && myAccountId
    && String(buzzWinner.playerId || '') === String(myAccountId),
  );

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode) return;

    try {
      const payload = await tngApi.bff.getPlayerState(deviceId, roomCode);
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
      setError('');
    } catch (stateError) {
      setError(stateError?.message || 'The live BFF room could not be loaded.');
    }
  }, [deviceId, roomCode]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 750);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const cue = gameState.sound_cue;
    if (!cue?.at || cue.at === lastSoundCueRef.current) return;
    lastSoundCueRef.current = cue.at;
    setFlashCue(String(cue.name || '').toUpperCase());
    const timeout = window.setTimeout(() => setFlashCue(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [gameState.sound_cue]);

  const buzz = useCallback(async () => {
    if (!deviceId || !roomCode || !buzzerOpen || buzzWinner || busy) return;

    setBusy(true);
    setError('');

    try {
      const payload = await tngApi.bff.playerAction(deviceId, roomCode, 'buzz');
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
    } catch (actionError) {
      setError(actionError?.message || 'Your buzz could not be submitted.');
    } finally {
      setBusy(false);
    }
  }, [busy, buzzerOpen, buzzWinner, deviceId, roomCode]);

  const status = useMemo(
    () => statusFor(gameState, myTeam, buzzWinner),
    [buzzWinner, gameState, myTeam],
  );

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center px-4 text-center">
        <div>
          <div className="mb-4 text-red-400">Player device not registered.</div>
          <Link to={`/join/${roomCode}`} className="text-[#FFD700] underline">
            Rejoin room {roomCode}
          </Link>
        </div>
      </div>
    );
  }

  if (!room && !error) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#BC13FE]" />
          <div className="text-sm text-white/40">Syncing with BFF room {roomCode}…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#070311] text-white">
      <TngNotificationToaster />

      <div className="mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col gap-2 p-2 sm:p-3">
        <header className="sticky top-0 z-30 rounded-xl border border-[#BC13FE]/25 bg-[#080512]/95 px-3 py-2.5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[6px] uppercase tracking-[.22em] text-[#BC13FE]" style={PS2}>
                TEXASNOMAD BFF
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <span className="font-mono text-base tracking-[.15em] text-[#FFD700]">{roomCode}</span>
                <span className="text-[10px] text-white/35">
                  Seat {participant?.seatNumber ?? '—'}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div
                className="max-w-[180px] truncate rounded-lg border border-[#22D3EE]/35 bg-[#22D3EE]/5 px-2 py-2 text-[5px] uppercase tracking-widest text-[#22D3EE]"
                style={PS2}
              >
                {status}
              </div>
              <Link
                to="/"
                replace
                className="rounded-lg border border-white/15 px-2.5 py-2 text-[6px] uppercase tracking-widest text-white/40"
                style={PS2}
              >
                EXIT
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
            {error}
          </div>
        )}

        {flashCue && (
          <div
            className="rounded-xl border border-[#FFD700]/45 bg-[#FFD700]/10 px-3 py-2 text-center text-[7px] uppercase tracking-[.20em] text-[#FFD700]"
            style={PS2}
          >
            {flashCue}
          </div>
        )}

        {myTeam ? (
          <FamilyBadge
            team={myTeam}
            name={myFamilyName}
            active={controlTeam === myTeam}
          />
        ) : (
          <div className="rounded-lg border border-[#FFD700]/25 bg-[#FFD700]/5 px-3 py-2 text-center text-[7px] uppercase tracking-widest text-[#FFD700]" style={PS2}>
            WAITING FOR FAMILY ASSIGNMENT
          </div>
        )}

        {buzzerOpen && !buzzWinner && (
          <button
            type="button"
            disabled={busy}
            onClick={buzz}
            className="relative min-h-[92px] overflow-hidden rounded-2xl border-2 border-[#FF174D] bg-[#FF174D]/12 px-4 py-3 text-center disabled:opacity-40"
            style={{ boxShadow: '0 0 30px rgba(255,23,77,.25), inset 0 0 26px rgba(255,23,77,.10)' }}
          >
            <div className="absolute inset-0 animate-pulse bg-[#FF174D]/5" />
            <div className="relative z-10">
              <Radio className="mx-auto h-7 w-7 text-[#FF174D]" />
              <div className="mt-1 font-heading text-3xl text-[#FF174D]">BUZZ!</div>
              <div className="mt-1 text-[5px] uppercase tracking-[.18em] text-[#FF174D]/70" style={PS2}>
                TAP FAST
              </div>
            </div>
          </button>
        )}

        {buzzWinner && (
          <div
            className={`rounded-xl border px-3 py-3 text-center ${
              iWonBuzz
                ? 'border-[#4ADE80]/50 bg-[#4ADE80]/10'
                : 'border-[#FFD700]/35 bg-[#FFD700]/5'
            }`}
          >
            <Zap className={`mx-auto h-5 w-5 ${iWonBuzz ? 'text-[#4ADE80]' : 'text-[#FFD700]'}`} />
            <div
              className={`mt-1 text-[7px] uppercase tracking-[.18em] ${
                iWonBuzz ? 'text-[#4ADE80]' : 'text-[#FFD700]'
              }`}
              style={PS2}
            >
              {iWonBuzz ? 'YOU BUZZED FIRST!' : `${buzzWinner.playerName || 'A PLAYER'} BUZZED FIRST`}
            </div>
          </div>
        )}

        <main className="min-h-0 flex-1">
          <BFFTngBoard
            gs={{
              ...gameState,
              family1: gameState.family1 || 'Family 1',
              family2: gameState.family2 || 'Family 2',
            }}
          />
        </main>

        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TeamPlayers
            players={players}
            team={1}
            familyName={gameState.family1 || 'Family 1'}
          />
          <TeamPlayers
            players={players}
            team={2}
            familyName={gameState.family2 || 'Family 2'}
          />
        </section>

        <footer className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/45 px-3 py-2 text-[9px] text-white/35">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{players.length} connected</span>
          </div>
          {busy && <span className="text-[#FFD700]">SYNCING…</span>}
        </footer>
      </div>
    </div>
  );
}
