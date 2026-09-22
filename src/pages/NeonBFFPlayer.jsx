import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Radio, Users, Zap, Mic, MicOff } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import BFFTngBoard from '@/components/bff/BFFTngBoard.jsx';
import { TngNotificationToaster } from '@/components/social/TngNotificationToaster';
import { armBffSoundUnlock, playBffSound, preloadBffSounds } from '@/lib/bffSound';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

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

function DysfunctionPlayerPanel({
  gameState,
  players,
  myPlayerId,
  busy,
  onVote,
}) {
  const dysfunction = gameState.dysfunction || {};
  const assignments = dysfunction.side_assignments || {};
  const mySide = assignments[String(myPlayerId || '')] || null;
  const opponentSide = mySide === 'A' ? 'B' : mySide === 'B' ? 'A' : null;
  const votes = dysfunction.votes || {};
  const myVote = dysfunction.my_vote || null;
  const playerById = Object.fromEntries(
    players.map((player) => [String(player.playerId), player]),
  );
  const candidates = Object.entries(assignments)
    .filter(([, side]) => side === opponentSide)
    .map(([playerId]) => playerById[playerId])
    .filter(Boolean);
  const sideAPlayers = Object.entries(assignments)
    .filter(([, side]) => side === 'A')
    .map(([playerId]) => playerById[playerId])
    .filter(Boolean);
  const sideBPlayers = Object.entries(assignments)
    .filter(([, side]) => side === 'B')
    .map(([playerId]) => playerById[playerId])
    .filter(Boolean);
  const stage = gameState.round_stage || '';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const defenseSeconds = gameState.answer_deadline_at
    ? Math.max(0, Math.ceil((Number(gameState.answer_deadline_at) - now) / 1000))
    : null;
  const defensePlayer = playerById[String(gameState.active_player_id || '')] || null;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#F472B6]/30 bg-[#080516]/95 p-3 sm:p-4">
      <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-[#BC13FE]/20 blur-3xl" />
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#FF5F1F]/20 blur-3xl" />

      <div className="relative z-10 space-y-3">
        <div className="text-center">
          <div className="text-[7px] uppercase tracking-[.22em] text-[#F472B6]" style={PS2}>
            FAMILY DYSFUNCTION
          </div>
          <div className="mt-2 font-heading text-3xl text-white">
            {dysfunction.family_name || 'Winning Family'}
          </div>
          <div className="mt-1 text-[6px] uppercase tracking-[.16em] text-white/30" style={PS2}>
            {dysfunction.sudden_death
              ? 'SUDDEN DEATH'
              : `PROMPT ${dysfunction.prompt_number || 1} OF 5`}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[#BC13FE]/35 bg-[#BC13FE]/5 p-3 text-center">
            <div className="text-[6px] text-[#BC13FE]" style={PS2}>SIDE A</div>
            <div className="mt-1 font-heading text-3xl text-white">{Number(dysfunction.scoreA) || 0}</div>
            <div className="mt-2 text-[9px] text-white/40">
              {sideAPlayers.map((player) => player.playerName || player.name).join(' · ') || '—'}
            </div>
          </div>
          <div className="rounded-xl border border-[#FF5F1F]/35 bg-[#FF5F1F]/5 p-3 text-center">
            <div className="text-[6px] text-[#FF5F1F]" style={PS2}>SIDE B</div>
            <div className="mt-1 font-heading text-3xl text-white">{Number(dysfunction.scoreB) || 0}</div>
            <div className="mt-2 text-[9px] text-white/40">
              {sideBPlayers.map((player) => player.playerName || player.name).join(' · ') || '—'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 p-4 text-center">
          <div className="text-[5px] uppercase tracking-[.18em] text-[#FFD700]/60" style={PS2}>
            DYSFUNCTION PROMPT
          </div>
          <div className="mt-2 font-heading text-xl leading-snug text-white sm:text-2xl">
            {dysfunction.prompt || 'Loading prompt…'}
          </div>
        </div>

        {!mySide && stage !== 'dysfunction_complete' && (
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4 text-center">
            <div className="font-heading text-xl text-white/45">SPECTATOR MODE</div>
            <div className="mt-2 text-[10px] text-white/30">
              The winning family is battling itself. You can hear the action live.
            </div>
          </div>
        )}

        {mySide && stage === 'dysfunction_vote' && (
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-center text-[6px] uppercase tracking-[.18em] text-white/40" style={PS2}>
              {myVote ? 'VOTE LOCKED' : `YOU ARE SIDE ${mySide} · PICK SOMEONE ON SIDE ${opponentSide}`}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {candidates.map((player) => {
                const selected = String(myVote || '') === String(player.playerId);
                return (
                  <button
                    type="button"
                    key={player.playerId}
                    disabled={busy || Boolean(myVote)}
                    onClick={() => onVote(player.playerId)}
                    className="rounded-xl border p-3 text-center disabled:cursor-default"
                    style={{
                      borderColor: selected ? '#FFD700' : 'rgba(255,255,255,.12)',
                      background: selected ? 'rgba(255,215,0,.10)' : 'rgba(255,255,255,.025)',
                      color: selected ? '#FFD700' : 'rgba(255,255,255,.72)',
                    }}
                  >
                    <div className="font-heading text-base">
                      {player.playerName || player.name || 'Player'}
                    </div>
                  </button>
                );
              })}
            </div>

            {myVote && (
              <div className="mt-3 text-center text-[9px] text-white/30">
                Your vote is secret until everyone votes.
              </div>
            )}
          </div>
        )}

        {dysfunction.votes_revealed && stage !== 'dysfunction_vote' && (
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-[6px] uppercase tracking-[.18em] text-white/35" style={PS2}>
              THE FAMILY HAS SPOKEN
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {Object.entries(votes).map(([voterId, targetId]) => (
                <div key={voterId} className="rounded-lg border border-white/8 bg-white/[.02] px-2 py-2 text-[10px] text-white/55">
                  <strong>{playerById[voterId]?.playerName || playerById[voterId]?.name || 'Player'}</strong>
                  {' → '}
                  <strong className="text-[#FFD700]">
                    {playerById[String(targetId)]?.playerName || playerById[String(targetId)]?.name || 'Player'}
                  </strong>
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className={`rounded-lg border p-2 text-[9px] ${
                Number(dysfunction.last_pointsA) === 3
                  ? 'border-[#FFD700]/55 bg-[#FFD700]/10 text-[#FFD700]'
                  : 'border-[#BC13FE]/20 text-[#BC13FE]'
              }`}>
                {Number(dysfunction.last_pointsA) === 3
                  ? 'DYSFUNCTION! +3'
                  : `SIDE A +${Number(dysfunction.last_pointsA) || 0}`}
              </div>
              <div className={`rounded-lg border p-2 text-[9px] ${
                Number(dysfunction.last_pointsB) === 3
                  ? 'border-[#FFD700]/55 bg-[#FFD700]/10 text-[#FFD700]'
                  : 'border-[#FF5F1F]/20 text-[#FF5F1F]'
              }`}>
                {Number(dysfunction.last_pointsB) === 3
                  ? 'DYSFUNCTION! +3'
                  : `SIDE B +${Number(dysfunction.last_pointsB) || 0}`}
              </div>
            </div>
          </div>
        )}

        {stage === 'dysfunction_defense' && (
          <div className="rounded-xl border border-[#FFD700]/45 bg-[#FFD700]/10 p-4 text-center">
            <div className="text-[6px] uppercase tracking-[.18em] text-[#FFD700]" style={PS2}>
              THE DEFENSE
            </div>
            <div className="mt-2 font-heading text-2xl text-white">
              {defensePlayer?.playerName || defensePlayer?.name || 'Player'}
            </div>
            <div className="mt-2 font-heading text-4xl text-[#FFD700]">{defenseSeconds ?? 0}s</div>
            <div className="mt-2 text-[10px] text-white/40">
              Their mic is live to the whole room. Explain yourself.
            </div>
          </div>
        )}

        {stage === 'dysfunction_complete' && (
          <div className="rounded-xl border-2 border-[#FFD700]/55 bg-[#FFD700]/10 p-6 text-center">
            <div className="text-[6px] uppercase tracking-[.18em] text-[#FFD700]" style={PS2}>
              FAMILY DYSFUNCTION CHAMPION
            </div>
            <div className="mt-3 font-heading text-5xl text-[#FFD700]">
              SIDE {dysfunction.winner_side}
            </div>
          </div>
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
  const voicePcRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const appliedVoiceAnswerRef = useRef('');
  const remoteAudioRef = useRef(null);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);

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
  const faceoffPlayers = gameState.faceoff_players || {};
  const selectedFaceoffIds = [
    faceoffPlayers['1'] || faceoffPlayers[1] || null,
    faceoffPlayers['2'] || faceoffPlayers[2] || null,
  ].filter(Boolean);
  const isFaceoffPlayer = selectedFaceoffIds.some(
    (playerId) => String(playerId) === String(myAccountId || ''),
  );
  const roundStage = gameState.round_stage || 'setup';
  const stealTeam = Number(gameState.steal_team || 0) || null;
  const canBuzz = Boolean(
    buzzerOpen
    && !buzzWinner
    && (
      roundStage === 'steal_buzz'
        ? myTeam === stealTeam
        : isFaceoffPlayer
    )
  );
  const isActiveSpeaker = Boolean(
    micOn
    && myAccountId
    && String(gameState.active_player_id || '') === String(myAccountId)
    && ['faceoff_answer', 'play_pass', 'family_play', 'steal_answer', 'dysfunction_defense'].includes(roundStage)
  );
  const showPlayPass = Boolean(
    roundStage === 'play_pass'
    && String(gameState.faceoff_winner_id || '') === String(myAccountId || '')
  );
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
    preloadBffSounds();
    armBffSoundUnlock();
  }, []);

  useEffect(() => {
    const cue = gameState.sound_cue;
    if (!cue?.at || cue.at === lastSoundCueRef.current) return;

    const cueAge = Date.now() - Number(cue.at);
    if (!Number.isFinite(cueAge) || cueAge > 8000) {
      lastSoundCueRef.current = cue.at;
      return;
    }

    lastSoundCueRef.current = cue.at;
    const cueName = String(cue.name || '');
    setFlashCue(cueName.toUpperCase());
    playBffSound(cueName);

    if (cueName === 'buzz' && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }

    const timeout = window.setTimeout(() => setFlashCue(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [gameState.sound_cue]);

  useEffect(() => {
    const track = voiceStreamRef.current?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = Boolean(isActiveSpeaker);
  }, [isActiveSpeaker]);

  useEffect(() => {
    const voiceAnswer = gameState.voice_answer;
    const pc = voicePcRef.current;
    if (!voiceAnswer?.sdp || !pc) return;

    const key = `${voiceAnswer.at || ''}:${voiceAnswer.sdp.length}`;
    if (appliedVoiceAnswerRef.current === key) return;
    appliedVoiceAnswerRef.current = key;

    pc.setRemoteDescription({ type: 'answer', sdp: voiceAnswer.sdp })
      .catch((voiceError) => {
        console.warn('[BFF Voice] Player could not apply Host answer', voiceError);
        setError('Your microphone connection could not finish. Tap MIC OFF, then MIC ON.');
      });
  }, [gameState.voice_answer]);

  useEffect(() => () => {
    voiceStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    voicePcRef.current?.close?.();
  }, []);

  const enableMic = useCallback(async () => {
    if (!deviceId || !roomCode || micBusy || micOn) return;

    setMicBusy(true);
    setError('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support live microphone audio.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      voiceStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      voicePcRef.current?.close?.();
      voicePcRef.current = pc;
      appliedVoiceAnswerRef.current = '';

      const localTrack = stream.getAudioTracks()[0];
      if (!localTrack) {
        throw new Error('No microphone track was available.');
      }

      localTrack.enabled = false;
      pc.addTransceiver(localTrack, {
        direction: 'sendonly',
        streams: [stream],
      });
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (!remoteAudioRef.current) return;

        let audio = remoteAudioRef.current.querySelector(
          `audio[data-track-id="${event.track.id}"]`,
        );

        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.playsInline = true;
          audio.dataset.trackId = event.track.id;
          remoteAudioRef.current.appendChild(audio);
        }

        audio.srcObject = new MediaStream([event.track]);
        audio.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          setMicOn(false);
        }
      };

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);

      if (!pc.localDescription?.sdp) {
        throw new Error('Microphone connection could not create an offer.');
      }

      const payload = await tngApi.bff.playerAction(deviceId, roomCode, 'voice_offer', {
        sdp: pc.localDescription.sdp,
      });

      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
      setMicOn(true);
    } catch (voiceError) {
      voiceStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      voicePcRef.current?.close?.();
      voicePcRef.current = null;
      setMicOn(false);
      setError(voiceError?.message || 'Microphone permission or connection failed.');
    } finally {
      setMicBusy(false);
    }
  }, [deviceId, micBusy, micOn, roomCode]);

  const disableMic = useCallback(async () => {
    if (micBusy) return;

    setMicBusy(true);

    try {
      voiceStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      voicePcRef.current?.close?.();
      voicePcRef.current = null;
      appliedVoiceAnswerRef.current = '';

      if (deviceId && roomCode) {
        await tngApi.bff.playerAction(deviceId, roomCode, 'voice_stop').catch(() => {});
      }

      setMicOn(false);
    } finally {
      setMicBusy(false);
    }
  }, [deviceId, micBusy, roomCode]);

  const buzz = useCallback(async () => {
    if (!deviceId || !roomCode || !canBuzz || busy) return;

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
  }, [busy, canBuzz, deviceId, roomCode]);

  const choosePlayPass = useCallback(async (choice) => {
    if (!deviceId || !roomCode || busy || !showPlayPass) return;

    setBusy(true);
    setError('');

    try {
      const payload = await tngApi.bff.playerAction(
        deviceId,
        roomCode,
        'play_pass',
        { choice },
      );
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
    } catch (actionError) {
      setError(actionError?.message || 'PLAY/PASS could not be submitted.');
    } finally {
      setBusy(false);
    }
  }, [busy, deviceId, roomCode, showPlayPass]);

  const submitDysfunctionVote = useCallback(async (targetPlayerId) => {
    if (!deviceId || !roomCode || busy) return;

    setBusy(true);
    setError('');

    try {
      const payload = await tngApi.bff.playerAction(
        deviceId,
        roomCode,
        'dysfunction_vote',
        { targetPlayerId },
      );
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
    } catch (actionError) {
      setError(actionError?.message || 'Your Family Dysfunction vote could not be submitted.');
    } finally {
      setBusy(false);
    }
  }, [busy, deviceId, roomCode]);

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
      <div ref={remoteAudioRef} className="hidden" aria-hidden="true" />

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
              <button
                type="button"
                disabled={micBusy || (micOn && ['playing', 'dysfunction'].includes(gameState.phase))}
                onClick={micOn ? disableMic : enableMic}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[6px] uppercase tracking-widest disabled:opacity-40 ${
                  micOn
                    ? 'border-[#22D3EE]/50 bg-[#22D3EE]/10 text-[#22D3EE]'
                    : 'border-white/15 text-white/45'
                }`}
                style={PS2}
              >
                {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                {micBusy ? 'MIC…' : micOn ? 'MIC ON' : 'MIC OFF'}
              </button>

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

        <div
          className={`rounded-lg border px-3 py-2 text-center text-[6px] uppercase tracking-[.14em] ${
            micOn
              ? 'border-[#22D3EE]/30 bg-[#22D3EE]/5 text-[#22D3EE]'
              : 'border-white/10 bg-white/[.02] text-white/30'
          }`}
          style={PS2}
        >
          {micOn
            ? isActiveSpeaker
              ? 'MIC LIVE · EVERYONE CAN HEAR YOU'
              : 'MIC READY · OPENS AUTOMATICALLY ON YOUR TURN'
            : 'MIC REQUIRED · TURN IT ON TO PLAY'}
        </div>

        {showPlayPass && (
          <section className="grid grid-cols-2 gap-2 rounded-xl border border-[#FFD700]/35 bg-[#FFD700]/5 p-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => choosePlayPass('play')}
              className="rounded-xl border-2 border-[#4ADE80] bg-[#4ADE80]/10 px-4 py-4 font-heading text-2xl text-[#4ADE80] disabled:opacity-30"
            >
              PLAY
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => choosePlayPass('pass')}
              className="rounded-xl border-2 border-[#FF5F1F] bg-[#FF5F1F]/10 px-4 py-4 font-heading text-2xl text-[#FF5F1F] disabled:opacity-30"
            >
              PASS
            </button>
            <div className="col-span-2 text-center text-[6px] uppercase tracking-[.16em] text-[#FFD700]/70" style={PS2}>
              YOU WON THE FACEOFF · CHOOSE
            </div>
          </section>
        )}

        <main className="min-h-0 flex-1">
          {gameState.dysfunction ? (
            <DysfunctionPlayerPanel
              gameState={gameState}
              players={players}
              myPlayerId={myAccountId}
              busy={busy}
              onVote={submitDysfunctionVote}
            />
          ) : (
            <BFFTngBoard
              gs={{
                ...gameState,
                family1: gameState.family1 || 'Family 1',
                family2: gameState.family2 || 'Family 2',
              }}
              myPlayerId={myAccountId}
              canBuzz={canBuzz}
              buzzerBusy={busy}
              onBuzz={buzz}
              showBuzzer
            />
          )}
        </main>

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
