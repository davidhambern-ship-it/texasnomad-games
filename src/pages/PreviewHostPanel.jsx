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

  function recoverExpiredPreviewSession(authError) {
    if (
      !(authError instanceof TngApiError) ||
      !['INVALID_IDENTITY', 'AUTH_REQUIRED'].includes(authError.code) ||
      authRecoveryStartedRef.current
    ) {
      return false;
    }

    authRecoveryStartedRef.current = true;

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
        return tngApi.host.startSession(deviceId, true, resumeTestRoom);
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
            return tngApi.host.startSession(replacementId, true, resumeTestRoom);
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
        if (recoverExpiredPreviewSession(initializeError)) return;

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
        if (recoverExpiredPreviewSession(pollError)) return;
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
        if (recoverExpiredPreviewSession(roomError)) return;

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
      <header className="h-14 border-b border-[#BC13FE]/40 flex items-center justify-between px-4">
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

      <main className="flex-1 p-6">
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

        {phase === 'pairing' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-xl w-full">
              <Monitor className="w-14 h-14 mx-auto mb-4 text-[#FFD700]" />
              <h1 className="text-3xl mb-3">Connect Game Display</h1>
              <p className="text-white/45 mb-6">
                {repairingDisplay
                  ? 'Open /display on the replacement TV/second screen and enter this fresh code. Your live room stays intact.'
                  : 'Open the Game Display on a second screen and enter this code.'}
              </p>
              <div className="border-2 border-[#FFD700]/50 rounded-2xl p-8 font-mono text-6xl tracking-[0.25em] text-[#FFD700]">
                {pairing?.code || '------'}
              </div>
              <div className="mt-6 flex flex-col items-center gap-3">
                <Link
                  to="/display"
                  target="_blank"
                  className="inline-block px-5 py-3 bg-[#FFD700] text-black rounded-lg"
                  style={PS2}
                >
                  OPEN DISPLAY
                </Link>

                {!repairingDisplay && (
                  <>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">or</div>
                    <button
                      type="button"
                      onClick={continueWithoutDisplay}
                      disabled={busy}
                      className="px-5 py-3 rounded-lg border-2 border-[#BC13FE]/70 bg-[#BC13FE]/10 text-[#BC13FE] hover:bg-[#BC13FE]/20 transition-all disabled:opacity-50"
                      style={{ ...PS2, fontSize: 8 }}
                    >
                      {busy ? 'STARTING TEST MODE…' : 'CONTINUE WITHOUT DISPLAY'}
                    </button>
                    <p className="max-w-md text-xs leading-relaxed text-white/35">
                      Live-test mode only. Use the Host Controller on this device without pairing a separate Game Display.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-2xl text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <h1 className="text-3xl mb-6">Host System Ready</h1>

              {error && <p className="text-red-400 mb-4">{error}</p>}

              <div className="grid sm:grid-cols-3 gap-4">
                {ALL_GAMES.map((game) => (
                  <button
                    key={game.id}
                    disabled={busy}
                    onClick={() => createRoom(game)}
                    className="border-2 rounded-xl p-6 bg-black/50"
                    style={{ borderColor: game.color + '55' }}
                  >
                    <div className="text-5xl mb-3">{game.emoji}</div>
                    <div style={{ ...PS2, color: game.color, fontSize: 10 }}>
                      {game.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === 'room' && activeRoom && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-5 rounded-xl border border-[#BC13FE]/30 bg-black/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-[8px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>
                  LIVE HOST CONTROLLER
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-2xl">{roomGame?.emoji || '🎮'}</span>
                  <span className="text-xl">{roomGame?.title || activeRoom.gameId}</span>
                  <span className="font-mono text-xl tracking-[0.18em] text-[#FFD700]">
                    {activeRoom.roomCode}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/35">
                  This controller is hard-locked to this room until you disconnect it.
                </p>
                {playerTestMode && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#FFD700]/40 bg-[#FFD700]/10 px-3 py-2 text-[#FFD700]">
                    <span className="h-2 w-2 rounded-full bg-[#FFD700] animate-pulse" />
                    <span className="text-[7px] uppercase tracking-widest" style={PS2}>
                      PLAYER TEST MODE · DISPLAY RELEASED
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {!playerTestMode && (
                  <button
                    onClick={releaseDisplayForPlayerTesting}
                    disabled={busy}
                    className="px-5 py-3 border border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80] rounded-lg"
                  >
                    <ShieldCheck className="w-4 h-4 inline mr-2" />
                    PLAYER TEST MODE
                  </button>
                )}

                <button
                  onClick={replaceDisplay}
                  disabled={busy}
                  className="px-5 py-3 border border-[#FFD700]/50 text-[#FFD700] rounded-lg"
                >
                  <Monitor className="w-4 h-4 inline mr-2" />
                  {playerTestMode ? 'RESTORE DISPLAY' : 'RE-PAIR DISPLAY'}
                </button>

                <button
                  onClick={endRoom}
                  disabled={busy}
                  className="px-5 py-3 border border-red-500/50 text-red-400 rounded-lg"
                >
                  <Unplug className="w-4 h-4 inline mr-2" />
                  DISCONNECT ROOM
                </button>
              </div>
            </div>

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
