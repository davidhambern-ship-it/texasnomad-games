import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Users,
  Play,
  SkipForward,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Radio,
  Trophy,
  Volume2,
  Frown,
  Sparkles,
  Zap,
  Undo2,
  Pencil,
  Mic,
  MicOff,
} from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import { armBffSoundUnlock, playBffSound, preloadBffSounds } from '@/lib/bffSound';
import { useBffVoiceRelay } from '@/lib/useBffVoiceRelay';
import { getPublicTngName } from '@/lib/publicTngName';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const ANSWER_COLORS = [
  '#BC13FE',
  '#FF5F1F',
  '#22D3EE',
  '#FFD700',
  '#4ADE80',
  '#F472B6',
  '#8B5CF6',
  '#FB7185',
];

function TeamCard({
  team,
  name,
  score,
  players,
  active,
  accent,
  onRename,
  selectedFaceoffId,
  activePlayerId,
  onSelectFaceoff,
  canSelectFaceoff,
}) {
  return (
    <section
      className="relative min-w-0 overflow-hidden rounded-2xl border bg-black/60 p-3"
      style={{
        borderColor: active ? '#FFD700' : `${accent}55`,
        boxShadow: active
          ? `0 0 24px rgba(255,215,0,.20), inset 0 0 24px ${accent}10`
          : `inset 0 0 24px ${accent}08`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onRename}
          className="group min-w-0 text-left"
          title="Edit family name"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="truncate text-[8px] font-black uppercase tracking-wide sm:text-[10px]"
              style={{ color: accent }}
            >
              {name}
            </span>
            <Pencil className="h-3 w-3 shrink-0 opacity-25 transition-opacity group-hover:opacity-70" />
          </div>
          <div className="mt-1 text-[5px] uppercase tracking-widest text-white/25" style={PS2}>
            TEAM {team}
          </div>
        </button>

        {active && (
          <span
            className="rounded-md border border-[#FFD700]/45 bg-[#FFD700]/10 px-1.5 py-1 text-[5px] text-[#FFD700]"
            style={PS2}
          >
            CONTROL
          </span>
        )}
      </div>

      <div
        className="my-3 text-center font-heading text-5xl leading-none sm:text-6xl"
        style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
      >
        {score}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[5px] uppercase tracking-widest text-white/28" style={PS2}>
          {players.length} PLAYER{players.length === 1 ? '' : 'S'}
        </div>
      </div>

      <div className="mt-2 flex min-h-[38px] flex-wrap content-start gap-1">
        {players.length ? players.map((player) => {
          const selected = String(selectedFaceoffId || '') === String(player.playerId);
          const isActive = String(activePlayerId || '') === String(player.playerId);

          return (
            <button
              type="button"
              key={player.playerId}
              disabled={!canSelectFaceoff}
              onClick={() => onSelectFaceoff?.(player.playerId)}
              className="max-w-full truncate rounded-md border px-1.5 py-1 text-[8px] transition-transform active:scale-95 disabled:cursor-default"
              style={{
                borderColor: isActive ? '#FFD700' : selected ? '#22D3EE' : `${accent}35`,
                background: isActive
                  ? 'rgba(255,215,0,.14)'
                  : selected
                    ? 'rgba(34,211,238,.12)'
                    : `${accent}08`,
                color: isActive ? '#FFD700' : selected ? '#8DEEFF' : 'rgba(255,255,255,.70)',
                boxShadow: isActive
                  ? '0 0 12px rgba(255,215,0,.30)'
                  : selected
                    ? '0 0 10px rgba(34,211,238,.22)'
                    : 'none',
              }}
              title={canSelectFaceoff ? 'Choose for faceoff' : undefined}
            >
              {getPublicTngName(player)}
              {selected ? ' ★' : ''}
            </button>
          );
        }) : (
          <span className="text-[8px] italic text-white/18">No players assigned</span>
        )}
      </div>
    </section>
  );
}

function BFFCenterCard({ round, bank, controlTeam, stealMode }) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border-2 border-[#FF7A1A]/60 bg-[#080512] p-3 text-center"
      style={{
        boxShadow: '0 0 28px rgba(188,19,254,.18), inset 0 0 26px rgba(255,95,31,.08)',
      }}
    >
      <div className="absolute inset-[7px] rounded-xl border-2 border-dotted border-[#FFD784]/45" />
      <div className="relative z-10">
        <div className="text-[5px] uppercase tracking-[.20em] text-[#FFD700]" style={PS2}>
          TEXASNOMAD GAMES
        </div>
        <div
          className="mt-2 font-heading text-5xl leading-none sm:text-6xl"
          style={{
            color: '#FFF8ED',
            WebkitTextStroke: '1px #FF5F1F',
            textShadow: '0 0 10px #FF5F1F, 0 0 20px rgba(188,19,254,.65)',
          }}
        >
          BFF
        </div>
        <div className="mt-1 text-[6px] uppercase tracking-widest text-[#22D3EE]" style={PS2}>
          BIG FAMILY FEUD
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-white/10 bg-white/[.025] p-2">
            <div className="text-[5px] text-white/25" style={PS2}>ROUND</div>
            <div className="mt-1 font-heading text-xl text-white">{round}</div>
          </div>
          <div className="rounded-lg border border-[#22D3EE]/25 bg-[#22D3EE]/5 p-2">
            <div className="text-[5px] text-[#22D3EE]/60" style={PS2}>BANK</div>
            <div className="mt-1 font-heading text-xl text-[#22D3EE]">{bank}</div>
          </div>
        </div>

        <div
          className={`mt-2 rounded-lg border px-2 py-1.5 text-[5px] uppercase tracking-widest ${
            stealMode
              ? 'border-[#FFD700]/55 bg-[#FFD700]/10 text-[#FFD700]'
              : 'border-white/10 text-white/35'
          }`}
          style={PS2}
        >
          {stealMode ? 'STEAL LIVE' : `TEAM ${controlTeam} IN CONTROL`}
        </div>
      </div>
    </section>
  );
}

function AnswerSlot({ slot, index, selected, onSelect }) {
  const accent = ANSWER_COLORS[index % ANSWER_COLORS.length];
  const revealed = Boolean(slot?.revealed);

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className="relative min-h-[76px] overflow-hidden rounded-xl border-2 p-2 text-left transition-transform active:scale-[.99]"
      style={{
        borderColor: selected ? '#FFD700' : `${accent}75`,
        background: revealed
          ? `linear-gradient(135deg, ${accent}24, rgba(255,255,255,.04))`
          : `linear-gradient(135deg, ${accent}12, rgba(0,0,0,.55))`,
        boxShadow: selected
          ? '0 0 18px rgba(255,215,0,.26)'
          : `inset 0 0 20px ${accent}08`,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
      />

      <div className="flex h-full items-center gap-3 pl-1">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-heading text-lg"
          style={{
            borderColor: `${accent}80`,
            color: accent,
            background: `${accent}10`,
          }}
        >
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-[5px] uppercase tracking-[.16em]"
            style={{ ...PS2, color: revealed ? '#FFD700' : `${accent}cc` }}
          >
            {revealed ? 'REVEALED TO PLAYERS' : 'HOST ANSWER'}
          </div>
          <div className="mt-2 truncate text-sm font-black text-white sm:text-base">
            {slot?.text || '—'}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[5px] uppercase text-white/20" style={PS2}>PTS</div>
          <div className="mt-1 font-heading text-lg" style={{ color: accent }}>
            {Number(slot?.points) || 0}
          </div>
        </div>
      </div>
    </button>
  );
}

function ByeMeter({ count, onStrike, onUndo, busy }) {
  const letters = ['B', 'Y', 'E'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {letters.map((letter, index) => {
        const active = index < count;
        const isNext = index === count;
        const canUndo = active && index === count - 1;
        const disabled = busy || (!isNext && !canUndo);

        return (
          <button
            type="button"
            key={letter}
            disabled={disabled}
            onClick={() => {
              if (isNext) onStrike();
              else if (canUndo) onUndo();
            }}
            className="flex h-14 items-center justify-center rounded-xl border-2 font-heading text-3xl transition-transform active:scale-95 disabled:cursor-default"
            style={{
              borderColor: active ? '#FF174D' : isNext ? '#FF174D88' : 'rgba(255,255,255,.10)',
              background: active ? 'rgba(255,23,77,.14)' : isNext ? 'rgba(255,23,77,.06)' : 'rgba(255,255,255,.025)',
              color: active ? '#FF174D' : isNext ? '#FF174D88' : 'rgba(255,255,255,.12)',
              textShadow: active ? '0 0 12px #FF174D' : 'none',
            }}
            title={isNext ? `Give strike ${letter}` : canUndo ? `Undo strike ${letter}` : ''}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

function ControlButton({ label, icon: Icon, accent = '#BC13FE', active = false, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center disabled:opacity-25"
      style={{
        borderColor: active ? accent : `${accent}55`,
        color: accent,
        background: active ? `${accent}18` : `${accent}06`,
        boxShadow: active ? `0 0 12px ${accent}24` : 'none',
      }}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="text-[5px] uppercase leading-tight tracking-wider" style={PS2}>{label}</span>
    </button>
  );
}

function PlayerRow({ player, team, onAssign, busy, voiceLive }) {
  const accent = team === 1 ? '#BC13FE' : team === 2 ? '#FF5F1F' : '#FFD700';

  return (
    <div
      className="rounded-lg border bg-black/40 p-2"
      style={{ borderColor: `${accent}38` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-bold text-white/75">
            {getPublicTngName(player)}
          </div>
          <div className="mt-0.5 text-[5px] uppercase text-white/22" style={PS2}>
            SEAT {player.seatNumber ?? '—'}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {voiceLive && <Mic className="h-3 w-3 text-[#22D3EE]" />}
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ade80]" />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {[1, 2].map((teamNumber) => {
          const teamAccent = teamNumber === 1 ? '#BC13FE' : '#FF5F1F';
          return (
            <button
              key={teamNumber}
              type="button"
              disabled={busy}
              onClick={() => onAssign(player.playerId, teamNumber)}
              className="rounded-md border px-1 py-1.5 text-[5px] disabled:opacity-25"
              style={{
                ...PS2,
                borderColor: team === teamNumber ? teamAccent : `${teamAccent}35`,
                color: teamAccent,
                background: team === teamNumber ? `${teamAccent}14` : 'transparent',
              }}
            >
              T{teamNumber}
            </button>
          );
        })}
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign(player.playerId, null)}
          className="rounded-md border border-white/10 px-1 py-1.5 text-[5px] text-white/25 disabled:opacity-25"
          style={PS2}
        >
          OPEN
        </button>
      </div>
    </div>
  );
}

function waitForIceComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();

  return new Promise((resolve) => {
    const onState = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onState);
        resolve();
      }
    };

    pc.addEventListener('icegatheringstatechange', onState);
    window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onState);
      resolve();
    }, 3500);
  });
}

function createSilentAudioTrack() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  const destination = context.createMediaStreamDestination();
  const track = destination.stream.getAudioTracks()[0];
  return { context, track };
}

export default function NeonBFFHostPanel({ controllerId }) {
  const [room, setRoom] = useState(null);
  const [actionError, setActionError] = useState('');
  const [pollError, setPollError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(0);
  const [manualPoints, setManualPoints] = useState(10);
  const lastSoundCueRef = useRef(null);
  const voicePeersRef = useRef(new Map());
  const handledVoiceOffersRef = useRef(new Map());
  const voiceAudioRef = useRef(null);
  const playerVoiceTracksRef = useRef(new Map());
  const silentAudioRef = useRef(null);
  const hostMicStreamRef = useRef(null);
  const hostMicTrackRef = useRef(null);
  const activePlayerIdRef = useRef(null);
  const [hostMuted, setHostMuted] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const handledDeadlineRef = useRef(null);
  const hostMicAutoAttemptedRef = useRef(false);
  const hostVoiceMountedRef = useRef(true);
  const publishedVoiceAnswersRef = useRef(new Set());
  const reportedVoiceLiveRef = useRef(new Set());
  const voiceSignalQueueRef = useRef(Promise.resolve());

  const gameState = room?.gameState || {};
  const hostVoiceRelay = useBffVoiceRelay({
    roomCode: room?.roomCode || null,
    role: 'host',
    identity: controllerId,
    shouldSend: !hostMuted,
    autoStart: Boolean(room?.roomCode && controllerId),
  });
  const hostMicReady = Boolean(
    hostVoiceRelay.micReady && hostVoiceRelay.status === 'live'
  );
  const hostMicBusy = hostVoiceRelay.status === 'connecting';
  const players = Array.isArray(gameState.players)
    ? gameState.players
    : Array.isArray(room?.players)
      ? room.players
      : [];
  const teamMap = gameState.playerTeams || {};

  const team1 = useMemo(
    () => players.filter((player) => Number(teamMap[player.playerId] ?? player.familyTeam) === 1),
    [players, teamMap],
  );
  const team2 = useMemo(
    () => players.filter((player) => Number(teamMap[player.playerId] ?? player.familyTeam) === 2),
    [players, teamMap],
  );

  const answers = Array.isArray(gameState.answers) ? gameState.answers : [];
  const byeCount = Math.max(0, Math.min(3, Number(gameState.bye_count) || 0));
  const controlTeam = Number(gameState.control_team || gameState.active_turn || 1) === 2 ? 2 : 1;
  const roundStage = gameState.round_stage || 'setup';
  const faceoffPlayers = gameState.faceoff_players || {};
  const faceoffOne = faceoffPlayers['1'] || faceoffPlayers[1] || null;
  const faceoffTwo = faceoffPlayers['2'] || faceoffPlayers[2] || null;
  const faceoffReady = Boolean(faceoffOne && faceoffTwo && gameState.current_question);
  const activePlayer = players.find(
    (player) => String(player.playerId) === String(gameState.active_player_id || ''),
  ) || null;
  const answerSeconds = gameState.answer_deadline_at
    ? Math.max(0, Math.ceil((Number(gameState.answer_deadline_at) - clockNow) / 1000))
    : null;
  const selectingFaceoff = ['faceoff_setup', 'faceoff_ready', 'faceoff_unresolved'].includes(roundStage);
  const micsReady = Boolean(gameState.mics_ready);
  const voiceSessionLocked = Boolean(gameState.voice_session_locked);
  const assignedPlayers = [...team1, ...team2];
  const backendVoiceVerified = gameState.voice_verified || {};
  const relayConnected = gameState.voice_relay_connected || {};
  const liveMicsReady = Boolean(
    assignedPlayers.length >= 2
    && team1.length > 0
    && team2.length > 0
    && assignedPlayers.every((player) => Boolean(relayConnected[player.playerId]))
  );
  const micStatusRows = assignedPlayers.map((player) => {
    const playerId = String(player.playerId);
    const live = Boolean(relayConnected[playerId]);
    const verified = Boolean(backendVoiceVerified[playerId]);
    return {
      playerId,
      name: getPublicTngName(player),
      status: live ? 'live' : verified ? 'reconnecting' : 'off',
    };
  });
  const missingMicNames = micStatusRows
    .filter((row) => row.status !== 'live')
    .map((row) => row.name);
  const canActivateBuzz = Boolean(
    !gameState.buzzer_open
    && (
      (faceoffReady && ['faceoff_ready', 'faceoff_setup', 'faceoff_unresolved'].includes(roundStage))
      || roundStage === 'steal_ready'
    )
  );
  const isMatchComplete = Boolean(gameState.match_complete);
  const isMatchTie = roundStage === 'match_tie' || Boolean(gameState.match_tied);
  const dysfunction = gameState.dysfunction || null;
  const canJudgeAnswer = ['faceoff_answer', 'family_play', 'steal_answer'].includes(roundStage);
  const selectedSlot = answers[selectedAnswer] || null;
  const canRevealSelected = Boolean(canJudgeAnswer && selectedSlot && !selectedSlot.revealed);
  const canHideSelected = Boolean(selectedSlot?.revealed);
  const canManualAwardBank = ['family_play', 'steal_ready', 'steal_buzz', 'steal_answer', 'round_complete'].includes(roundStage);
  const canStartDysfunction = Boolean(
    isMatchComplete
    && !dysfunction
    && [1, 2].includes(Number(gameState.winning_team))
    && (Number(gameState.winning_team) === 1 ? team1.length : team2.length) >= 4
  );

  const enableHostMic = useCallback(async () => {
    setActionError('');
    const ok = await hostVoiceRelay.start();
    if (!ok && hostVoiceRelay.error) {
      setActionError(hostVoiceRelay.error);
    }
  }, [hostVoiceRelay]);

  const toggleHostMute = useCallback(() => {
    if (!hostVoiceRelay.micReady) {
      enableHostMic();
      return;
    }
    setHostMuted((current) => !current);
  }, [enableHostMic, hostVoiceRelay.micReady]);

  const refresh = useCallback(async () => {
    if (!controllerId) return;
    try {
      const payload = await tngApi.bff.getHostState(controllerId);
      setRoom(payload.room || null);
      setPollError('');
    } catch (err) {
      setPollError(err?.message || 'Could not load BFF Host state.');
    }
  }, [controllerId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 800);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    preloadBffSounds();
    armBffSoundUnlock();
  }, []);
  useEffect(() => {
    if (hostMicAutoAttemptedRef.current || hostMicReady || hostMicBusy) return;
    hostMicAutoAttemptedRef.current = true;
    enableHostMic();
  }, [enableHostMic, hostMicBusy, hostMicReady]);


  useEffect(() => {
    const cue = gameState.sound_cue;
    if (!cue?.at || cue.at === lastSoundCueRef.current) return;
    const cueAge = Date.now() - Number(cue.at);
    if (!Number.isFinite(cueAge) || cueAge > 8000) {
      lastSoundCueRef.current = cue.at;
      return;
    }
    lastSoundCueRef.current = cue.at;
    playBffSound(String(cue.name || ''));
  }, [gameState.sound_cue]);

  const act = useCallback(async (action, payload = {}) => {
    if (!controllerId || busy) return false;
    setBusy(true);
    setActionError('');

    try {
      const result = await tngApi.bff.hostAction(controllerId, action, payload);
      setRoom(result.room || null);
      return true;
    } catch (err) {
      setActionError(err?.message || 'That BFF Host action could not be completed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, controllerId]);

  const assignPlayer = (playerId, team) => act('assign_player', { playerId, team });
  const selectFaceoffPlayer = (team, playerId) =>
    act('set_faceoff_player', { team, playerId });

  const renameFamily = async (team) => {
    const current = team === 1
      ? (gameState.family1 || 'Family 1')
      : (gameState.family2 || 'Family 2');
    const nextName = window.prompt(`Team ${team} family name`, current);
    if (nextName == null) return;

    await act('set_family_names', {
      family1: team === 1 ? nextName : (gameState.family1 || 'Family 1'),
      family2: team === 2 ? nextName : (gameState.family2 || 'Family 2'),
    });
  };

  if (!room && !pollError) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#BC13FE]" />
        <span className="text-sm text-white/40">Loading BFF Host controls…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1650px] space-y-2.5">
      {actionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
          {actionError}
        </div>
      )}

      {!room && pollError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
          {pollError}
        </div>
      )}

      <section className={`rounded-xl border px-3 py-2 ${
        gameState.family_names_set && hostMicReady && (voiceSessionLocked || liveMicsReady)
          ? 'border-[#4ADE80]/35 bg-[#4ADE80]/[.05]'
          : 'border-[#FF5F1F]/35 bg-[#FF5F1F]/[.05]'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[6px] uppercase tracking-[.16em] text-white/50" style={PS2}>
              ROUND SETUP STATUS
            </div>
            <div className="mt-1 text-[10px] text-white/55">
              {!gameState.family_names_set
                ? 'Enter both family names.'
                : !hostMicReady
                  ? 'Enable the Host microphone.'
                  : voiceSessionLocked
                    ? missingMicNames.length
                      ? `VOICE LOCKED · Reconnecting in background: ${missingMicNames.join(', ')}`
                      : 'VOICE LOCKED · All players live.'
                    : missingMicNames.length
                      ? `Waiting on mic connection: ${missingMicNames.join(', ')}`
                      : 'READY · Start Round is unlocked.'}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {micStatusRows.map((row) => (
              <span
                key={row.playerId}
                className={`rounded-md border px-2 py-1 text-[6px] uppercase ${
                  row.status === 'live'
                    ? 'border-[#4ADE80]/35 text-[#4ADE80]'
                    : row.status === 'reconnecting'
                      ? 'border-[#FFD700]/35 text-[#FFD700]'
                      : 'border-[#FF5F1F]/35 text-[#FF5F1F]'
                }`}
                style={PS2}
              >
                {row.name} · {row.status === 'live' ? 'MIC LIVE' : row.status === 'reconnecting' ? 'RECONNECTING' : 'MIC OFF'}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#22D3EE]/25 bg-[#22D3EE]/[.035] px-3 py-2">
        <div>
          <div className="text-[6px] uppercase tracking-[.16em] text-[#22D3EE]" style={PS2}>
            ROOM AUDIO
          </div>
          <div className="mt-1 text-[10px] text-white/40">
            Host is heard by every player. Only the active player's mic is routed back to the room.
          </div>
        </div>

        <button
          type="button"
          disabled={hostMicBusy}
          onClick={hostMicReady ? toggleHostMute : enableHostMic}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[6px] uppercase tracking-widest disabled:opacity-40 ${
            hostMicReady && !hostMuted
              ? 'border-[#4ADE80]/50 bg-[#4ADE80]/10 text-[#4ADE80]'
              : hostMicReady
                ? 'border-[#FF5F1F]/50 bg-[#FF5F1F]/10 text-[#FF5F1F]'
                : 'border-[#22D3EE]/40 bg-[#22D3EE]/5 text-[#22D3EE]'
          }`}
          style={PS2}
        >
          {hostMicReady && !hostMuted
            ? <Mic className="h-4 w-4" />
            : <MicOff className="h-4 w-4" />}
          {hostMicBusy
            ? 'MIC…'
            : !hostMicReady
              ? 'ENABLE HOST MIC'
              : hostMuted
                ? 'HOST MUTED'
                : 'HOST LIVE'}
        </button>
      </section>

      <div className="grid grid-cols-1 gap-2 min-[600px]:grid-cols-[minmax(0,1fr)_minmax(130px,.62fr)_minmax(0,1fr)]">
        <TeamCard
          team={1}
          name={gameState.family1 || 'Family 1'}
          score={Number(gameState.score1) || 0}
          players={team1}
          active={controlTeam === 1}
          accent="#BC13FE"
          onRename={() => renameFamily(1)}
          selectedFaceoffId={faceoffOne}
          activePlayerId={gameState.active_player_id}
          canSelectFaceoff={selectingFaceoff}
          onSelectFaceoff={(playerId) => selectFaceoffPlayer(1, playerId)}
        />

        <BFFCenterCard
          round={Number(gameState.round_number) || 1}
          bank={Number(gameState.round_bank) || 0}
          controlTeam={controlTeam}
          stealMode={Boolean(gameState.steal_mode)}
        />

        <TeamCard
          team={2}
          name={gameState.family2 || 'Family 2'}
          score={Number(gameState.score2) || 0}
          players={team2}
          active={controlTeam === 2}
          accent="#FF5F1F"
          onRename={() => renameFamily(2)}
          selectedFaceoffId={faceoffTwo}
          activePlayerId={gameState.active_player_id}
          canSelectFaceoff={selectingFaceoff}
          onSelectFaceoff={(playerId) => selectFaceoffPlayer(2, playerId)}
        />
      </div>

      <section className="rounded-xl border border-[#22D3EE]/25 bg-[#22D3EE]/[.035] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[6px] uppercase tracking-[.18em] text-[#22D3EE]" style={PS2}>
              FACEOFF
            </div>
            <div className="mt-1 text-[10px] text-white/45">
              {faceoffReady
                ? 'Faceoff pair selected.'
                : gameState.current_question
                  ? 'Choose one player from each family card.'
                  : 'Start the round, then choose the faceoff pair.'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activePlayer && ['faceoff_answer', 'family_play', 'steal_answer', 'dysfunction_defense'].includes(roundStage) && (
              <div className="rounded-lg border border-[#FFD700]/45 bg-[#FFD700]/10 px-3 py-2 text-center">
                <div className="text-[5px] text-[#FFD700]/65" style={PS2}>
                  {roundStage === 'dysfunction_defense' ? 'DEFENDING' : 'ANSWERING'}
                </div>
                <div className="mt-1 text-sm font-black text-[#FFD700]">
                  {getPublicTngName(activePlayer)}
                </div>
                <div className="mt-1 font-heading text-2xl text-white">
                  {answerSeconds ?? 0}s
                </div>
              </div>
            )}

            {roundStage === 'faceoff_answer' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => act('faceoff_wrong')}
                className="flex h-[66px] w-[66px] items-center justify-center rounded-xl border-2 border-red-500 bg-red-500/10 font-heading text-5xl text-red-500 shadow-[0_0_18px_rgba(239,68,68,.25)] disabled:opacity-30"
                title="Wrong faceoff answer"
              >
                X
              </button>
            )}
          </div>
        </div>
      </section>

      {(roundStage === 'play_pass' || isMatchComplete || isMatchTie || dysfunction) && (
        <section className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/[.04] px-3 py-3">
          {roundStage === 'play_pass' && (
            <div className="text-center">
              <div className="text-[6px] uppercase tracking-[.18em] text-[#FFD700]" style={PS2}>
                FACEOFF WON
              </div>
              <div className="mt-2 text-sm font-black text-white">
                {getPublicTngName(activePlayer, 'Winner')} chooses PLAY or PASS on their device.
              </div>
            </div>
          )}

          {isMatchTie && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[6px] uppercase tracking-[.18em] text-[#FFD700]" style={PS2}>
                  FIVE-ROUND TIE
                </div>
                <div className="mt-1 text-xs text-white/50">Run one sudden-death faceoff to choose the finalist.</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => act('start_tiebreak')}
                className="rounded-lg border border-[#FFD700]/50 bg-[#FFD700]/10 px-3 py-2 text-[6px] text-[#FFD700] disabled:opacity-30"
                style={PS2}
              >
                START TIEBREAK
              </button>
            </div>
          )}

          {isMatchComplete && !dysfunction && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[6px] uppercase tracking-[.18em] text-[#FFD700]" style={PS2}>
                  FIVE ROUNDS COMPLETE
                </div>
                <div className="mt-1 text-sm font-black text-white">
                  {Number(gameState.winning_team) === 2 ? gameState.family2 : gameState.family1} advances to FAMILY DYSFUNCTION.
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => act('start_dysfunction')}
                disabled={busy || !canStartDysfunction}
                className="rounded-lg border border-[#F472B6]/50 bg-[#F472B6]/10 px-3 py-2 text-[6px] text-[#F472B6] disabled:opacity-30"
                style={PS2}
                title={canStartDysfunction ? 'Start Family Dysfunction' : 'Winning family needs at least 4 connected mic-ready players'}
              >
                START FAMILY DYSFUNCTION
              </button>
            </div>
          )}

          {dysfunction && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[6px] uppercase tracking-[.18em] text-[#F472B6]" style={PS2}>
                    FAMILY DYSFUNCTION · {dysfunction.sudden_death ? 'SUDDEN DEATH' : `PROMPT ${dysfunction.prompt_number || 1}/5`}
                  </div>
                  <div className="mt-2 font-heading text-lg text-white">
                    {dysfunction.prompt || 'Loading the next dysfunctional family prompt…'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#BC13FE]/30 bg-[#BC13FE]/5 px-3 py-2 text-center">
                    <div className="text-[5px] text-[#BC13FE]" style={PS2}>SIDE A</div>
                    <div className="mt-1 font-heading text-2xl">{Number(dysfunction.scoreA) || 0}</div>
                    <div className="mt-1 text-[8px] text-white/35">
                      {players
                        .filter((player) => dysfunction.side_assignments?.[String(player.playerId)] === 'A')
                        .map((player) => getPublicTngName(player))
                        .join(' · ') || '—'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 px-3 py-2 text-center">
                    <div className="text-[5px] text-[#FF5F1F]" style={PS2}>SIDE B</div>
                    <div className="mt-1 font-heading text-2xl">{Number(dysfunction.scoreB) || 0}</div>
                    <div className="mt-1 text-[8px] text-white/35">
                      {players
                        .filter((player) => dysfunction.side_assignments?.[String(player.playerId)] === 'B')
                        .map((player) => getPublicTngName(player))
                        .join(' · ') || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {roundStage === 'dysfunction_vote' && (
                <div className="mt-2 text-[10px] text-white/40">
                  Waiting for secret votes. Votes remain hidden until everybody has voted.
                </div>
              )}

              {dysfunction.votes_revealed && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className={`rounded-lg border px-2 py-2 text-center text-[6px] ${
                    Number(dysfunction.last_pointsA) === 3
                      ? 'border-[#FFD700]/50 bg-[#FFD700]/10 text-[#FFD700]'
                      : 'border-white/10 text-white/35'
                  }`} style={PS2}>
                    {Number(dysfunction.last_pointsA) === 3 ? 'DYSFUNCTION!' : `SIDE A +${Number(dysfunction.last_pointsA) || 0}`}
                  </div>
                  <div className={`rounded-lg border px-2 py-2 text-center text-[6px] ${
                    Number(dysfunction.last_pointsB) === 3
                      ? 'border-[#FFD700]/50 bg-[#FFD700]/10 text-[#FFD700]'
                      : 'border-white/10 text-white/35'
                  }`} style={PS2}>
                    {Number(dysfunction.last_pointsB) === 3 ? 'DYSFUNCTION!' : `SIDE B +${Number(dysfunction.last_pointsB) || 0}`}
                  </div>
                </div>
              )}

              {roundStage === 'dysfunction_defense' && (
                <div className="mt-2 text-[10px] text-[#FFD700]">
                  Defense mic is live for {getPublicTngName(activePlayer, 'the selected family member')}.
                </div>
              )}

              {roundStage === 'dysfunction_complete' && (
                <div className="mt-3 rounded-lg border border-[#FFD700]/40 bg-[#FFD700]/10 p-3 text-center font-heading text-2xl text-[#FFD700]">
                  SIDE {dysfunction.winner_side} WINS FAMILY DYSFUNCTION
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section
        className="rounded-xl border border-[#22D3EE]/30 bg-black/60 px-3 py-3 text-center"
        style={{ boxShadow: 'inset 0 0 20px rgba(34,211,238,.06)' }}
      >
        <div className="text-[5px] uppercase tracking-[.20em] text-[#22D3EE]/65" style={PS2}>
          SURVEY QUESTION · ROUND {Number(gameState.round_number) || 1}
        </div>
        <div className="mt-2 font-heading text-base leading-snug text-white sm:text-xl">
          {gameState.current_question || 'Waiting for the survey question…'}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 min-[680px]:grid-cols-[minmax(0,1fr)_minmax(285px,335px)]">
        <section className="rounded-xl border border-white/10 bg-black/50 p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="text-[6px] uppercase tracking-[.18em] text-white/35" style={PS2}>
              ANSWER BOARD
            </div>
            <div className="text-[5px] uppercase tracking-widest text-[#FFD700]/55" style={PS2}>
              HOST JUDGE VIEW · ANSWERS PRIVATE
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {answers.map((slot, index) => (
              <AnswerSlot
                key={index}
                slot={slot}
                index={index}
                selected={selectedAnswer === index}
                onSelect={setSelectedAnswer}
              />
            ))}
          </div>
        </section>

        <aside className="rounded-xl border border-[#FF5F1F]/25 bg-black/60 p-2.5">
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div className={`rounded-lg border px-2 py-1.5 text-center text-[5px] uppercase ${
              voiceSessionLocked || (micsReady && liveMicsReady)
                ? 'border-[#4ADE80]/30 text-[#4ADE80]'
                : 'border-[#FF5F1F]/30 text-[#FF5F1F]'
            }`} style={PS2}>
              PLAYERS {
                voiceSessionLocked
                  ? missingMicNames.length
                    ? 'VOICE LOCKED'
                    : 'MIC READY'
                  : micsReady && liveMicsReady
                    ? 'MIC READY'
                    : 'NEED MICS'
              }
            </div>
            <div className={`rounded-lg border px-2 py-1.5 text-center text-[5px] uppercase ${
              hostMicReady && !hostMuted ? 'border-[#4ADE80]/30 text-[#4ADE80]' : 'border-[#FF5F1F]/30 text-[#FF5F1F]'
            }`} style={PS2}>
              HOST {hostMicReady && !hostMuted ? 'LIVE' : hostMicReady ? 'MUTED' : 'MIC OFF'}
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <div className="text-[6px] uppercase tracking-[.18em] text-[#FF9A3D]" style={PS2}>
              GAME CONTROLS
            </div>
            <div className="text-right">
              <div className="text-[5px] text-white/25" style={PS2}>
                SLOT {selectedAnswer + 1}
              </div>
              <div
                className={`mt-1 text-[5px] uppercase ${gameState.buzzer_open ? 'text-[#22D3EE]' : gameState.buzz_winner ? 'text-[#FFD700]' : 'text-white/20'}`}
                style={PS2}
              >
                {gameState.buzzer_open
                  ? 'BUZZERS LIVE'
                  : gameState.buzz_winner
                    ? `${getPublicTngName(gameState.buzz_winner, 'PLAYER')} BUZZED`
                    : 'BUZZERS HIDDEN'}
              </div>
            </div>
          </div>

          {roundStage === 'family_play' ? (
            <ByeMeter
              count={byeCount}
              busy={busy}
              onStrike={() => act('add_bye')}
              onUndo={() => act('undo_bye')}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[.02] px-3 py-3 text-center">
              <div className="text-[5px] uppercase tracking-[.16em] text-white/25" style={PS2}>
                B Y E STRIKES
              </div>
              <div className="mt-2 text-[9px] text-white/25">
                Available after the faceoff.
              </div>
            </div>
          )}

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <ControlButton
              label={
                !gameState.family_names_set
                  ? 'Need Names'
                  : !hostMicReady
                    ? 'Host Mic'
                    : !voiceSessionLocked && !liveMicsReady
                      ? 'Need Mics'
                      : 'Start Round'
              }
              icon={Play}
              accent="#4ADE80"
              onClick={() => act('start_round')}
              disabled={
                busy
                || gameState.phase === 'playing'
                || Boolean(gameState.current_question)
                || !gameState.family_names_set
                || !hostMicReady
                || (!voiceSessionLocked && (!micsReady || !liveMicsReady))
              }
            />
            <ControlButton
              label="Reset Round"
              icon={RotateCcw}
              accent="#FF5F1F"
              onClick={() => act('reset_round')}
              disabled={busy || !gameState.current_question}
            />
            <ControlButton
              label="Next Q"
              icon={SkipForward}
              accent="#22D3EE"
              onClick={() => act('next_question')}
              disabled={busy || roundStage !== 'round_complete' || Number(gameState.round_number || 1) >= 5}
            />

            <ControlButton
              label="Reset Game"
              icon={RotateCcw}
              accent="#FF174D"
              onClick={() => {
                const confirmed = window.confirm(
                  'Reset the entire BFF game? Scores, rounds, survey history, strikes, faceoff and finale progress will reset. Connected players, family setup and voice stay intact.',
                );
                if (confirmed) act('reset_game');
              }}
              disabled={busy}
            />
            <ControlButton
              label="Undo"
              icon={Undo2}
              accent="#FFD700"
              onClick={() => act('undo_last_action')}
              disabled={busy}
            />

            <ControlButton
              label="Reveal"
              icon={Eye}
              accent="#BC13FE"
              onClick={() => act('reveal_answer', { index: selectedAnswer })}
              disabled={busy || !canRevealSelected}
            />
            <ControlButton
              label="Hide"
              icon={EyeOff}
              accent="#8B5CF6"
              onClick={() => act('hide_answer', { index: selectedAnswer })}
              disabled={busy || !canHideSelected}
            />
            <ControlButton
              label="+ Points"
              icon={Plus}
              accent="#FFD700"
              onClick={() => act('add_points', { amount: Number(manualPoints) || 0 })}
              disabled={busy}
            />

            <ControlButton
              label="Team 1 Ctrl"
              icon={Radio}
              accent="#BC13FE"
              active={controlTeam === 1}
              onClick={() => act('set_control_team', { team: 1 })}
              disabled={busy}
            />
            <ControlButton
              label="Activate Buzz"
              icon={Radio}
              accent="#22D3EE"
              active={Boolean(gameState.buzzer_open)}
              onClick={() => act('open_buzzers')}
              disabled={busy || !canActivateBuzz}
            />
            <ControlButton
              label="Team 2 Ctrl"
              icon={Radio}
              accent="#FF5F1F"
              active={controlTeam === 2}
              onClick={() => act('set_control_team', { team: 2 })}
              disabled={busy}
            />

            <ControlButton
              label="Deactivate Buzz"
              icon={EyeOff}
              accent="#64748B"
              onClick={() => act('hide_buzzers')}
              disabled={busy || !gameState.buzzer_open}
            />

            {roundStage === 'steal_answer' && (
              <ControlButton
                label="MISS STEAL"
                icon={Frown}
                accent="#FF174D"
                onClick={() => act('steal_miss')}
                disabled={busy}
              />
            )}

            <ControlButton
              label="Bank → T1"
              icon={Trophy}
              accent="#BC13FE"
              onClick={() => act('award_bank', { team: 1 })}
              disabled={busy || !canManualAwardBank}
            />
            <ControlButton
              label="Bank → T2"
              icon={Trophy}
              accent="#FF5F1F"
              onClick={() => act('award_bank', { team: 2 })}
              disabled={busy || !canManualAwardBank}
            />

          </div>

          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/[.03] p-2">
            <label className="text-[5px] uppercase text-[#FFD700]/60" style={PS2}>
              MANUAL PTS
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={manualPoints}
              onChange={(event) => setManualPoints(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/60 px-2 py-1.5 text-center text-sm text-white outline-none focus:border-[#FFD700]/40"
            />
          </div>

          <div className="mt-3 border-t border-white/10 pt-2.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-white/40">
                <Users className="h-3.5 w-3.5" />
                <span className="text-[6px] uppercase tracking-[.16em]" style={PS2}>
                  CONNECTED PLAYERS
                </span>
              </div>
              <span className="font-heading text-base text-[#FFD700]">{players.length}</span>
            </div>

            <div className="grid max-h-[210px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 min-[680px]:grid-cols-1">
              {players.length ? players.map((player) => (
                <PlayerRow
                  key={player.playerId}
                  player={player}
                  team={Number(teamMap[player.playerId] ?? player.familyTeam) || null}
                  onAssign={assignPlayer}
                  busy={busy}
                  voiceLive={Boolean(relayConnected[player.playerId])}
                />
              )) : (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[9px] text-white/20">
                  No connected players
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
