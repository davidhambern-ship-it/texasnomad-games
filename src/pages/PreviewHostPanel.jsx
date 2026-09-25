import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Monitor, ShieldCheck, Unplug } from 'lucide-react';

import { ALL_GAMES } from '@/components/host/HostGameSelect';
import HangmanHostPanel from '@/components/host/panels/HangmanHostPanel';
import NeonSpadesHostPanel from '@/components/host/panels/NeonSpadesHostPanel';
import NeonWordSearchHostPanel from '@/components/host/panels/NeonWordSearchHostPanel';
import NeonSquareBizHostPanel from '@/components/host/panels/NeonSquareBizHostPanel';
import NeonBFFHostPanel from '@/components/host/panels/NeonBFFHostPanel';
import { TngApiError, tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';
import { getNeonSession } from '@/lib/neonAuth';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function PreviewHostPanel() {
  const { user, logout } = useAuth();
  const [phase, setPhase] = useState('loading');
  const [controllerId, setControllerId] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [repairingDisplay, setRepairingDisplay] = useState(false);
  const [playerTestMode, setPlayerTestMode] = useState(
    () => localStorage.getItem('tng_player_test_mode') === '1',
  );
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [error, setError] = useState('');
  const [roomPollError, setRoomPollError] = useState('');
  const [busy, setBusy] = useState(false);
  const authRecoveryStartedRef = useRef(false);

  function isStaleRoom(room) {
    if (!room) return false;
    const stamp =
      room.updatedAt ||
      room.updated_at ||
      room.createdAt ||
      room.created_at ||
      null;
    if (!stamp) return false;
    const value = new Date(stamp).getTime();
    if (!Number.isFinite(value)) return false;
    return Date.now() - value > 30 * 60 * 1000;
  }

  const roomGame = useMemo(
    () => ALL_GAMES.find((game) => game.id === activeRoom?.gameId) || selectedGame,
    [activeRoom, selectedGame],
  );

  async function recoverExpiredPreviewSession(authError) {
    if (
      !(authError instanceof TngApiError) ||
      !['INVALID_IDENTITY', 'AUTH_REQUIRED'].includes(authError.code) ||
      authRecoveryStartedRef.current
    ) {
      return false;
    }

    authRecoveryStartedRef.current = true;

    try {
      // Do not bounce an active Host back to Login because one game poll caught
      // a stale token or transient auth-rate-limit response. Confirm the actual
      // Neon browser session first.
      const session = await getNeonSession({
        forceRefresh: true,
        allowStaleOnError: true,
      });

      if (session?.user) {
        authRecoveryStartedRef.current = false;
        return false;
      }
    } catch (sessionError) {
      console.warn('[PreviewHostPanel] auth recheck failed; keeping Host panel alive:', sessionError);
      authRecoveryStartedRef.current = false;
      return false;
    }

    try {
      localStorage.setItem('tng_preview_expect_user_login', '1');
      localStorage.removeItem('tng_preview_user_access_token');
      localStorage.removeItem('base44_access_token');
    } catch {}

    const next = encodeURIComponent(
      window.location.pathname + window.location.search + window.location.hash,
    );
    window.location.href = `/login?next=${next}`;
    return true;
  }

  async function createController() {
    const { device } = await tngApi.devices.create({
      role: 'host_controller',
      deviceLabel: 'Host Controller',
    });
    localStorage.setItem('tng_device_id', device.id);
    localStorage.setItem('tng_connection_role', 'host_controller');
    return device.id;
  }

  async function startOrReplaceController(deviceId) {
    const resumeTestRoom = localStorage.getItem('tng_player_test_mode') === '1';

    try {
      return await tngApi.host.startSession(deviceId, false, resumeTestRoom);
    } catch (sessionError) {
      if (
        sessionError instanceof TngApiError &&
        sessionError.code === 'HOST_ALREADY_CONTROLLED'
      ) {
        // Never steal an active Host session from another device.
        // A second device on the same account belongs on the Game Display.
        localStorage.setItem('tng_connection_role', 'display');
        localStorage.removeItem('tng_display_device_id');
        localStorage.removeItem('tng_display_token');
        window.location.replace('/display');
        throw sessionError;
      }

      if (
        sessionError instanceof TngApiError &&
        ['INVALID_CONTROLLER', 'CONTROLLER_REQUIRED'].includes(sessionError.code)
      ) {
        localStorage.removeItem('tng_device_id');
        const replacementId = await createController();
        setControllerId(replacementId);

        try {
          return await tngApi.host.startSession(replacementId, false, resumeTestRoom);
        } catch (replacementError) {
          if (
            replacementError instanceof TngApiError &&
            replacementError.code === 'HOST_ALREADY_CONTROLLED'
          ) {
            localStorage.setItem('tng_connection_role', 'display');
            localStorage.removeItem('tng_display_device_id');
            localStorage.removeItem('tng_display_token');
            window.location.replace('/display');
          }
          throw replacementError;
        }
      }
      throw sessionError;
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let deviceId = localStorage.getItem('tng_device_id');

        if (
          !deviceId ||
          localStorage.getItem('tng_connection_role') !== 'host_controller'
        ) {
          deviceId = await createController();
        }

        if (cancelled) return;
        setControllerId(deviceId);

        const session = await startOrReplaceController(deviceId);
        if (cancelled) return;

        setActiveRoom(session.activeRoom || null);

        if (session.activeRoom) {
          // Do not blindly mount a long-abandoned live room. A stale recovered
          // room can contain old game state and should require an explicit
          // recovery choice before game-specific controls are mounted.
          if (isStaleRoom(session.activeRoom)) {
            setError('');
            setPhase('stale-room');
            return;
          }

          // Preview is currently being used for controller + player testing.
          // Once a current live room exists, resume it headlessly instead of
          // forcing the Game Display requirement back on after auth refresh.
          localStorage.setItem('tng_player_test_mode', '1');
          setPlayerTestMode(true);
          setPhase('room');
          return;
        }

        const testModeActive =
          localStorage.getItem('tng_player_test_mode') === '1';

        if (session.hostSession?.displayDeviceId) {
          setPlayerTestMode(testModeActive);
          setError('');
          setPhase('ready');
          return;
        }

        if (testModeActive) {
          const pairingPayload = await tngApi.host.createPairing(deviceId);
          if (cancelled) return;

          await tngApi.display.pair(pairingPayload.pairing.code);
          if (cancelled) return;

          const refreshedSession = await tngApi.host.startSession(deviceId);
          if (cancelled) return;

          setPlayerTestMode(true);
          setPairing(null);
          setRepairingDisplay(false);
          setActiveRoom(refreshedSession.activeRoom || null);
          setError('');
          setPhase(refreshedSession.activeRoom ? 'room' : 'ready');
          return;
        }

        const pairingPayload = await tngApi.host.createPairing(deviceId);
        if (cancelled) return;

        setPairing(pairingPayload.pairing);
        setPhase('pairing');
      } catch (initializeError) {
        if (await recoverExpiredPreviewSession(initializeError)) return;

        if (!cancelled) {
          setError(initializeError.message || 'The Host Controller could not start.');
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'pairing' || !controllerId) return undefined;

    const interval = window.setInterval(async () => {
      try {
        const session = await tngApi.host.startSession(controllerId);

        if (repairingDisplay) {
          if (session.hostSession?.displayDeviceId) {
            setPairing(null);
            setRepairingDisplay(false);
            localStorage.removeItem('tng_player_test_mode');
            setPlayerTestMode(false);
            setActiveRoom(session.activeRoom || null);
            setPhase(session.activeRoom ? 'room' : 'ready');
          }
          return;
        }

        if (session.activeRoom) {
          setActiveRoom(session.activeRoom);
          setPhase('room');
          return;
        }

        if (session.hostSession?.displayDeviceId) {
          setPairing(null);
          setPhase('ready');
        }
      } catch (pollError) {
        if (await recoverExpiredPreviewSession(pollError)) return;
        console.error('[PreviewHostPanel] display pairing poll failed:', pollError);
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [phase, controllerId, repairingDisplay]);

  useEffect(() => {
    if (phase !== 'room' || !controllerId) {
      setRoomState(null);
      return undefined;
    }

    let cancelled = false;

    async function refreshRoomState() {
      try {
        const payload = await tngApi.host.getRoomState(controllerId);
        if (!cancelled) {
          setRoomState(payload.room);
          setActiveRoom((current) => ({ ...current, ...payload.room }));
          setRoomPollError('');
          setError('');
        }
      } catch (roomError) {
        if (await recoverExpiredPreviewSession(roomError)) return;

        if (!cancelled) {
          setRoomPollError(roomError.message || 'The live room state could not be loaded.');
        }
      }
    }

    refreshRoomState();
    const interval = window.setInterval(refreshRoomState, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, controllerId]);

  async function replaceDisplay() {
    if (!controllerId || busy) return;

    setBusy(true);
    setError('');

    try {
      const payload = await tngApi.host.createPairing(controllerId, true);
      setPairing(payload.pairing);
      setRepairingDisplay(true);
      setPhase('pairing');
    } catch (pairingError) {
      setError(pairingError.message || 'A new Game Display code could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function releaseDisplayForPlayerTesting() {
    if (!controllerId || !activeRoom || busy) return;

    setBusy(true);
    setError('');

    try {
      // The existing replace-display backend path disconnects the current
      // Game Display while preserving the active Host session and room.
      // We intentionally discard the temporary pairing code here so this
      // second device can be reused as a signed-in Player screen.
      await tngApi.host.createPairing(controllerId, true);
      localStorage.setItem('tng_player_test_mode', '1');
      setPlayerTestMode(true);
      setPairing(null);
      setRepairingDisplay(false);
      setPhase('room');
    } catch (releaseError) {
      setError(releaseError.message || 'The Game Display could not be released for player testing.');
    } finally {
      setBusy(false);
    }
  }

  async function continueWithoutDisplay() {
    if (!pairing?.code || !controllerId || busy) return;

    setBusy(true);
    setError('');

    try {
      // Pair a virtual test display in the background. This satisfies the
      // backend's real display requirement without opening a second screen.
      await tngApi.display.pair(pairing.code);

      localStorage.setItem('tng_player_test_mode', '1');
      setPlayerTestMode(true);
      setPairing(null);
      setRepairingDisplay(false);

      const session = await tngApi.host.startSession(controllerId);
      setActiveRoom(session.activeRoom || null);
      setPhase(session.activeRoom ? 'room' : 'ready');
    } catch (bypassError) {
      setError(
        bypassError?.message ||
          'TNG could not start the no-display live-test session.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function createRoom(game) {
    setBusy(true);
    setError('');

    try {
      const { room } = await tngApi.host.createRoom(controllerId, game.id);
      setSelectedGame(game);
      setActiveRoom(room);
      setRoomState(null);
      setPhase('room');
    } catch (roomError) {
      setError(roomError.message || 'The live room could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function updateGameState(statePatch) {
    if (!controllerId) return;

    const payload = await tngApi.host.updateRoomState(controllerId, statePatch);
    setRoomState(payload.room);
    setActiveRoom((current) => ({ ...current, ...payload.room }));
  }

  async function sendCommand(command) {
    if (!controllerId) return;

    const payload = await tngApi.host.sendRoomCommand(controllerId, command);
    setRoomState(payload.room);
    setActiveRoom((current) => ({ ...current, ...payload.room }));
  }

  async function endRoom() {
    if (!controllerId || busy) return;

    setBusy(true);
    setError('');

    try {
      await tngApi.host.endRoom(controllerId);
      setActiveRoom(null);
      setRoomState(null);
      setSelectedGame(null);

      if (playerTestMode) {
        setPairing(null);
        setRepairingDisplay(false);
        localStorage.setItem('tng_player_test_mode', '1');
        setPlayerTestMode(true);
        setPhase('ready');
      } else {
        setPhase('ready');
      }
    } catch (roomError) {
      setError(roomError.message || 'The room could not be disconnected.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      if (controllerId) await tngApi.host.endSession(controllerId);
    } catch (sessionError) {
      console.error('[PreviewHostPanel] host sign-out failed:', sessionError);
    }

    localStorage.removeItem('tng_device_id');
    localStorage.removeItem('tng_connection_role');
    localStorage.removeItem('tng_player_test_mode');
    logout(true);
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-[#BC13FE]/40 bg-[#050505]/95 backdrop-blur-xl flex items-center justify-between px-4">
        <Link to="/" className="font-heading tracking-widest">
          TEXASNOMAD <span className="text-[#FF5F1F]">HOST</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">
            {user?.full_name || user?.email}
          </span>
          <button onClick={signOut} className="text-xs text-white/40">
            SIGN OUT
          </button>
        </div>
      </header>

      <main className="flex-1 px-2 pb-3 pt-[68px] sm:px-3 sm:pb-4">
        {phase === 'loading' && (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#BC13FE]" />
              <div style={PS2}>STARTING HOST CONTROLLER</div>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="h-full flex items-center justify-center text-center text-red-400">
            <div>
              <div style={PS2}>HOST CONTROLLER ERROR</div>
              <p className="mt-4">{error}</p>
            </div>
          </div>
        )}

        {phase === 'stale-room' && activeRoom && (
          <div className="h-full flex items-center justify-center px-4">
            <div className="max-w-xl w-full text-center rounded-2xl border border-[#FFD700]/35 bg-[#FFD700]/5 p-8">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-[#FFD700]" />
              <div className="text-[#FFD700]" style={PS2}>OLD LIVE ROOM FOUND</div>
              <h2 className="mt-4 text-2xl">Recover previous room?</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                TNG found an older live {activeRoom.gameId || 'game'} room
                {activeRoom.roomCode ? ` (${activeRoom.roomCode})` : ''}.
                It will not auto-load old game controls until you choose what to do.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('tng_player_test_mode', '1');
                    setPlayerTestMode(true);
                    setPhase('room');
                  }}
                  className="px-5 py-3 rounded-lg border border-[#BC13FE]/60 bg-[#BC13FE]/10 text-[#BC13FE]"
                >
                  RESUME ROOM
                </button>
                <button
                  type="button"
                  onClick={endRoom}
                  disabled={busy}
                  className="px-5 py-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 disabled:opacity-50"
                >
                  DISCONNECT OLD ROOM
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'test-recovery' && (
          <div className="h-full flex items-center justify-center px-4">
            <div className="max-w-xl text-center rounded-2xl border border-[#FFD700]/35 bg-[#FFD700]/5 p-8">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-[#FFD700]" />
              <div className="text-[#FFD700]" style={PS2}>PLAYER TEST MODE</div>
              <h2 className="mt-4 text-2xl">Test room recovery needed</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                {error || 'TNG could not find a recoverable live test room for this Host session.'}
              </p>
              <p className="mt-3 text-sm text-white/65">
                Your Host login is valid. Reconnect the normal display only if you want to start a new room.
              </p>
            </div>
          </div>
        )}

        {(phase === 'pairing' || phase === 'ready') && (
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-3xl text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <h1 className="text-3xl mb-4">Host System Ready</h1>

              {error && <p className="text-red-400 mb-4">{error}</p>}

              <div className="mb-6 rounded-2xl border border-[#FFD700]/35 bg-[#FFD700]/[0.04] p-5 sm:p-6">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:text-left">
                  <div>
                    <div className="text-[7px] uppercase tracking-[0.2em] text-[#FFD700]" style={PS2}>
                      GAME DISPLAY
                    </div>
                    <div className="mt-2 text-sm text-white/45">
                      {phase === 'pairing'
                        ? repairingDisplay
                          ? 'Enter this fresh code on the replacement Display. Your live Host session stays intact.'
                          : 'Enter this code on the Game Display before choosing a game.'
                        : 'Your Game Display is connected and ready.'}
                    </div>
                  </div>

                  {phase === 'pairing' ? (
                    <div className="shrink-0 rounded-xl border-2 border-[#FFD700]/55 bg-black/70 px-5 py-4 font-mono text-4xl tracking-[0.22em] text-[#FFD700] shadow-[0_0_24px_rgba(255,215,0,.12)]">
                      {pairing?.code || '------'}
                    </div>
                  ) : (
                    <div className="shrink-0 rounded-xl border border-green-400/35 bg-green-400/[0.07] px-4 py-3">
                      <div className="flex items-center gap-2 text-green-400">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,.75)]" />
                        <span className="text-[7px] uppercase tracking-[0.18em]" style={PS2}>
                          DISPLAY CONNECTED
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Link
                    to="/display"
                    target="_blank"
                    className="rounded-lg border border-[#FFD700]/45 bg-[#FFD700]/10 px-4 py-2 text-[#FFD700]"
                    style={{ ...PS2, fontSize: 7 }}
                  >
                    OPEN DISPLAY
                  </Link>

                  {phase === 'ready' && (
                    <button
                      type="button"
                      onClick={replaceDisplay}
                      disabled={busy}
                      className="rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-white/55 disabled:opacity-40"
                      style={{ ...PS2, fontSize: 7 }}
                    >
                      RE-PAIR DISPLAY
                    </button>
                  )}

                  {phase === 'pairing' && !repairingDisplay && (
                    <button
                      type="button"
                      onClick={continueWithoutDisplay}
                      disabled={busy}
                      className="rounded-lg border border-[#BC13FE]/50 bg-[#BC13FE]/10 px-4 py-2 text-[#BC13FE] disabled:opacity-40"
                      style={{ ...PS2, fontSize: 7 }}
                    >
                      {busy ? 'STARTING…' : 'TEST WITHOUT DISPLAY'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-3 text-left">
                <div className="text-[7px] uppercase tracking-[0.18em] text-white/25" style={PS2}>
                  CHOOSE A GAME
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {ALL_GAMES.map((game) => {
                  const displayReady = phase === 'ready';
                  return (
                    <button
                      key={game.id}
                      disabled={busy || !displayReady}
                      onClick={() => createRoom(game)}
                      className="border-2 rounded-xl p-6 bg-black/50 transition disabled:cursor-not-allowed disabled:opacity-30"
                      style={{ borderColor: game.color + '55' }}
                      title={displayReady ? `Start ${game.title}` : 'Connect the Game Display first'}
                    >
                      <div className="text-5xl mb-3">{game.emoji}</div>
                      <div style={{ ...PS2, color: game.color, fontSize: 10 }}>
                        {game.title}
                      </div>
                    </button>
                  );
                })}
              </div>

              {phase === 'pairing' && (
                <p className="mt-4 text-xs text-white/30">
                  Game selection unlocks as soon as the Display connects.
                </p>
              )}
            </div>
          </div>
        )}

        {phase === 'room' && activeRoom && (
          <div className="mx-auto max-w-[1650px]">
            <div className="fixed inset-x-2 top-14 z-40 sm:inset-x-3">
              <div className="mx-auto max-w-[1650px] rounded-xl border border-[#BC13FE]/30 bg-black/95 px-2.5 py-2 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xl">{roomGame?.emoji || '🎮'}</span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-black uppercase sm:text-base">
                        {roomGame?.title || activeRoom.gameId}
                      </span>
                      <span className="shrink-0 rounded-md border border-[#FFD700]/20 bg-[#FFD700]/[0.04] px-2 py-1 font-mono text-xs tracking-[0.12em] text-[#FFD700] sm:text-sm">
                        ROOM {activeRoom.roomCode}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[6px] uppercase tracking-widest text-[#BC13FE]" style={PS2}>
                        LIVE HOST
                      </span>
                      {playerTestMode && (
                        <span className="inline-flex items-center gap-1 text-[6px] uppercase tracking-widest text-[#FFD700]" style={PS2}>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#FFD700] animate-pulse" />
                          TEST MODE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {!playerTestMode && (
                    <button
                      onClick={releaseDisplayForPlayerTesting}
                      disabled={busy}
                      className="rounded-lg border border-[#4ade80]/50 bg-[#4ade80]/10 px-2.5 py-2 text-[#4ade80] disabled:opacity-40"
                      title="Player test mode"
                    >
                      <ShieldCheck className="h-4 w-4 sm:mr-1.5 sm:inline" />
                      <span className="hidden text-[9px] sm:inline">TEST</span>
                    </button>
                  )}

                  <button
                    onClick={replaceDisplay}
                    disabled={busy}
                    className="rounded-lg border border-[#FFD700]/50 bg-[#FFD700]/5 px-2.5 py-2 text-[#FFD700] disabled:opacity-40"
                    title={playerTestMode ? 'Restore display' : 'Emergency re-pair display'}
                  >
                    <Monitor className="h-4 w-4 sm:mr-1.5 sm:inline" />
                    <span className="hidden text-[9px] sm:inline">
                      {playerTestMode ? 'DISPLAY' : 'RE-PAIR'}
                    </span>
                  </button>

                  <button
                    onClick={endRoom}
                    disabled={busy}
                    className="rounded-lg border border-red-500/50 bg-red-500/5 px-2.5 py-2 text-red-400 disabled:opacity-40"
                    title="Disconnect room"
                  >
                    <Unplug className="h-4 w-4 sm:mr-1.5 sm:inline" />
                    <span className="hidden text-[9px] sm:inline">END</span>
                  </button>
                </div>
              </div>
              </div>
            </div>

            <div className="h-[58px] sm:h-[60px]" aria-hidden="true" />

            {error && <p className="text-red-400 mb-4 text-center">{error}</p>}
            {!roomState && roomPollError && (
              <p className="text-red-400 mb-4 text-center">{roomPollError}</p>
            )}

            {!roomState && (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#BC13FE]" />
                <span className="text-sm text-white/40">Loading game controls…</span>
              </div>
            )}

            {roomState?.gameId === 'hangman' && (
              <HangmanHostPanel controllerId={controllerId} />
            )}

            {roomState?.gameId === 'spades' && (
              <NeonSpadesHostPanel controllerId={controllerId} />
            )}

            {roomState?.gameId === 'word-search' && (
              <NeonWordSearchHostPanel controllerId={controllerId} />
            )}

            {roomState?.gameId === 'square-biz' && (
              <NeonSquareBizHostPanel controllerId={controllerId} />
            )}

            {roomState?.gameId === 'bff' && (
              <NeonBFFHostPanel controllerId={controllerId} />
            )}

            {roomState && !['hangman', 'spades', 'word-search', 'square-biz', 'bff'].includes(roomState.gameId) && (
              <div className="py-16 text-center text-white/40">
                <div className="text-4xl mb-4">{roomGame?.emoji || '🎮'}</div>
                <p>
                  {roomGame?.title || roomState.gameId} is connected to the new Neon room.
                  Its game controls are next in the migration queue.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
