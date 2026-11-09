import React, { useEffect, useMemo, useRef, useState } from 'react';
import '@/components/nomadCards/nc.css';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Unplug, ShieldCheck } from 'lucide-react';

import { ALL_GAMES, RoomGameIcon } from '@/components/rooms/RoomGameCatalog';
import HangmanGameBoard from '@/components/games/HangmanGameBoard';
import SpadesGameBoard from '@/components/games/SpadesGameBoard';
import WordSearchGameBoard from '@/components/games/WordSearchGameBoard';
import SquareBizGameBoard from '@/components/games/SquareBizGameBoard';
import BFFGameBoard from '@/components/games/BFFGameBoard';
import RoomGameBoard from '@/components/rooms/RoomGameBoard';
import SharedRoomLobby from '@/components/rooms/SharedRoomLobby';
import { TngApiError, tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';
import { getNeonSession } from '@/lib/neonAuth';
import { getStoredGuestIdentity } from '@/lib/guestIdentity';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function detectHostViewport() {
  if (typeof window === 'undefined') {
    return { kind: 'desktop', orientation: 'landscape', width: 1280, height: 800 };
  }

  const width = window.innerWidth || 1280;
  const height = window.innerHeight || 800;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches === true;
  const shortSide = Math.min(width, height);
  const orientation = width >= height ? 'landscape' : 'portrait';

  let kind = 'desktop';
  if (width <= 680 || (coarsePointer && shortSide <= 560)) {
    kind = 'phone';
  } else if (width <= 1180 || (coarsePointer && shortSide <= 900)) {
    kind = 'tablet';
  }

  return { kind, orientation, width, height, coarsePointer };
}

export default function SharedRoomPage() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [phase, setPhase] = useState('loading');
  const [controllerId, setControllerId] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [error, setError] = useState('');
  const [roomPollError, setRoomPollError] = useState('');
  const [roomPeople, setRoomPeople] = useState([]);
  const [rosterError, setRosterError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hostName, setHostName] = useState(() => getStoredGuestIdentity()?.name || '');
  const [pendingGame, setPendingGame] = useState(null);
  const [recoveryRoute, setRecoveryRoute] = useState(null);
  const [hostViewport, setHostViewport] = useState(detectHostViewport);
  const authRecoveryStartedRef = useRef(false);
  const hostBoardRef = useRef(null);
  const requestedGameHandledRef = useRef(false);
  const requestedGameIdRef = useRef(
    typeof window === 'undefined'
      ? ''
      : String(new URLSearchParams(window.location.search).get('game') || '').trim(),
  );

  // React Router can reuse this page when navigating from one /room?game=... URL
  // to another. Refresh the requested game for every search-param change instead
  // of keeping the first game's ID for the lifetime of the mounted component.
  useEffect(() => {
    const nextGameId = String(new URLSearchParams(location.search).get('game') || '').trim();
    if (nextGameId !== requestedGameIdRef.current) {
      requestedGameIdRef.current = nextGameId;
      requestedGameHandledRef.current = false;
    }
  }, [location.search]);

  function clearRequestedGameParam() {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('game')) return;
    url.searchParams.delete('game');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

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

  const hostOnlyActive = true;

  const hostBoardSideBySide =
    hostOnlyActive &&
    (
      hostViewport.kind === 'desktop' ||
      (hostViewport.kind === 'tablet' && hostViewport.orientation === 'landscape')
    );

  const hostBoardHeight =
    hostViewport.kind === 'phone'
      ? hostViewport.orientation === 'landscape'
        ? 'clamp(300px, 72dvh, 520px)'
        : 'clamp(320px, 52dvh, 480px)'
      : hostViewport.kind === 'tablet'
        ? hostViewport.orientation === 'landscape'
          ? 'calc(100dvh - 150px)'
          : 'clamp(420px, 54dvh, 650px)'
        : 'calc(100dvh - 150px)';

  useEffect(() => {
    const updateViewport = () => setHostViewport(detectHostViewport());
    updateViewport();

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  async function toggleHostBoardFullscreen() {
    const board = hostBoardRef.current;
    if (!board) return;

    try {
      if (!document.fullscreenElement) {
        await board.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      setError('Fullscreen was blocked by this browser.');
    }
  }

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
      console.warn('[SharedRoomPage] auth recheck failed; keeping the room screen alive:', sessionError);
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
      deviceLabel: 'Room Controller',
    });
    localStorage.setItem('tng_device_id', device.id);
    localStorage.setItem('tng_connection_role', 'host_controller');
    return device.id;
  }

  async function startOrReplaceController(deviceId) {
    try {
      return await tngApi.host.startSession(deviceId);
    } catch (sessionError) {
      if (
        sessionError instanceof TngApiError &&
        ['INVALID_CONTROLLER', 'CONTROLLER_REQUIRED'].includes(sessionError.code)
      ) {
        localStorage.removeItem('tng_device_id');
        const replacementId = await createController();
        setControllerId(replacementId);
        return await tngApi.host.startSession(replacementId);
      }

      // HOST_ALREADY_CONTROLLED is intentionally allowed to bubble up.
      // The Room will show an explicit recovery choice instead of
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

        let session;

        try {
          session = await startOrReplaceController(deviceId);
        } catch (sessionError) {
          if (
            sessionError instanceof TngApiError &&
            sessionError.code === 'HOST_ALREADY_CONTROLLED'
          ) {
            const route = await tngApi.host.getAccountRoute(
              localStorage.getItem('tng_device_id') || deviceId,
            ).catch(() => null);

            if (cancelled) return;

            setRecoveryRoute(route || { activeHost: true, activeRoom: null });
            setActiveRoom(route?.activeRoom || null);
            setError('');
            setPhase('host-recovery');
            return;
          }

          throw sessionError;
        }

        if (cancelled) return;

        setRecoveryRoute(null);
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
          setPhase('room');
          return;
        }

        // A host session is ready to create rooms immediately. Game boards
        // are rendered from the live room API inside this host screen.
        setError('');
        setPhase('ready');
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
    if (phase !== 'room' || !controllerId) {
      setRoomPeople([]);
      setRosterError('');
      return undefined;
    }

    let cancelled = false;

    async function refreshRoster() {
      try {
        const payload = await tngApi.host.getRoster(controllerId);
        if (cancelled) return;
        setRoomPeople(Array.isArray(payload?.people) ? payload.people : []);
        setRosterError('');
      } catch (rosterLoadError) {
        if (cancelled) return;
        setRosterError(
          rosterLoadError?.message ||
            'TNG could not load the people currently in this room.',
        );
      }
    }

    refreshRoster();
    const interval = window.setInterval(refreshRoster, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, controllerId]);

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

  async function reclaimHostController() {
    if (!controllerId || busy) return;

    setBusy(true);
    setError('');

    try {
      const session = await tngApi.host.startSession(controllerId, true, true);

      localStorage.setItem('tng_connection_role', 'host_controller');
      setRecoveryRoute(null);
      setActiveRoom(session.activeRoom || null);

      if (session.activeRoom) {
        if (isStaleRoom(session.activeRoom)) {
          setPhase('stale-room');
        } else {
          setPhase('room');
        }
        return;
      }
      setPhase('ready');
    } catch (reclaimError) {
      setError(
        reclaimError?.message ||
          'TNG could not reclaim this Host Controller. The live room was not changed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function createRoom(game) {
    setPendingGame(game);
    setError('');
  }

  async function confirmCreateRoom() {
    if (!pendingGame || !controllerId || hostName.trim().length < 2 || busy) return;
    setBusy(true);
    setError('');
    try {
      const { room } = await tngApi.host.createRoom(controllerId, pendingGame.id, hostName.trim());
      setSelectedGame(pendingGame);
      setPendingGame(null);
      setActiveRoom(room);
      setRoomState(null);
      setPhase('room');
    } catch (roomError) {
      setError(roomError.message || 'The live room could not be created.');
    } finally {
      setBusy(false);
    }
  }

  // The arcade can deep-link a core multiplayer game with /room?game=<id>.
  // Wait until the room controller is ready before creating the live room.
  // actually ready before creating the Neon room. Consume the query once so a
  // reload/end-room cycle can never create duplicate rooms by accident.
  useEffect(() => {
    const requestedGameId = requestedGameIdRef.current;
    if (!requestedGameId || requestedGameHandledRef.current) return;

    const game = ALL_GAMES.find((entry) => entry.id === requestedGameId);
    if (!game) {
      requestedGameHandledRef.current = true;
      clearRequestedGameParam();
      setError(`TNG does not recognize the requested game: ${requestedGameId}`);
      return;
    }

    // A new game selection must not silently keep rendering the previously
    // recovered room (for example BFF). Preserve the room only when the
    // requested game is the same; otherwise end the old room before opening
    // the selected game's normal create-room flow.
    if (phase === 'host-recovery' || !controllerId || busy) return;

    if (activeRoom) {
      if (activeRoom.gameId === requestedGameId) {
        requestedGameHandledRef.current = true;
        clearRequestedGameParam();
        return;
      }

      if (phase !== 'room' && phase !== 'stale-room') return;

      requestedGameHandledRef.current = true;
      clearRequestedGameParam();
      setBusy(true);
      setError('');
      (async () => {
        try {
          await tngApi.host.endRoom(controllerId);
          setActiveRoom(null);
          setRoomState(null);
          setRoomPeople([]);
          setRosterError('');
          setSelectedGame(null);
          setPendingGame(game);
          setPhase('ready');
        } catch (replaceError) {
          setError(replaceError?.message || 'The previous room could not be closed.');
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    if (phase !== 'ready') return;

    requestedGameHandledRef.current = true;
    clearRequestedGameParam();
    createRoom(game);
  }, [phase, controllerId, activeRoom, busy, location.search]);

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

  async function startGame() {
    if (!controllerId || busy) return;

    setBusy(true);
    setError('');

    try {
      // Square Biz owns its own phase and player assignment. Starting it
      // through the generic room endpoint leaves an empty gameState, which
      // the Square Biz state refresh correctly normalizes back to the lobby.
      // Start the first round through its dedicated API instead.
      const isSquareBiz = (roomState?.gameId || activeRoom?.gameId) === 'square-biz';
      const payload = isSquareBiz
        ? await tngApi.squareBiz.hostAction(controllerId, 'start_round')
        : await tngApi.host.startGame(controllerId);
      setRoomState(payload.room);
      setActiveRoom((current) => ({ ...current, ...payload.room }));
    } catch (startError) {
      setError(startError?.message || 'The game could not be started.');
    } finally {
      setBusy(false);
    }
  }

  async function endRoom() {
    if (!controllerId || busy) return;

    setBusy(true);
    setError('');

    try {
      await tngApi.host.endRoom(controllerId);
      setActiveRoom(null);
      setRoomState(null);
      setRoomPeople([]);
      setRosterError('');
      setSelectedGame(null);
      setPhase('ready');
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
      console.error('[SharedRoomPage] host sign-out failed:', sessionError);
    }

    localStorage.removeItem('tng_device_id');
    localStorage.removeItem('tng_connection_role');
    localStorage.removeItem('tng_player_test_mode');
    logout(true);
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <main className="flex-1 px-2 pb-3 pt-2 sm:px-3 sm:pb-4">
        {phase === 'loading' && (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#BC13FE]" />
              <div style={PS2}>SETTING UP YOUR ROOM</div>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="h-full flex items-center justify-center text-center text-red-400">
            <div>
              <div style={PS2}>ROOM SETUP ERROR</div>
              <p className="mt-4">{error}</p>
            </div>
          </div>
        )}

        {phase === 'host-recovery' && (
          <div className="h-full flex items-center justify-center px-4">
            <div className="max-w-xl w-full text-center rounded-2xl border border-[#FFD700]/35 bg-[#FFD700]/5 p-8">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-[#FFD700]" />
              <div className="text-[#FFD700]" style={PS2}>LIVE HOST SESSION FOUND</div>

              <h2 className="mt-4 text-2xl">
                Rejoin as the Host?
              </h2>

              {recoveryRoute?.activeRoom ? (
                <div className="mt-4 rounded-xl border border-[#BC13FE]/25 bg-black/35 p-4">
                  <div className="text-xs uppercase tracking-widest text-white/30">
                    ACTIVE LIVE GAME
                  </div>
                  <div className="mt-2 text-xl font-bold uppercase text-white">
                    {String(recoveryRoute.activeRoom.gameId || 'game').replaceAll('-', ' ')}
                  </div>
                  <div className="mt-2 font-mono text-lg tracking-[0.18em] text-[#FFD700]">
                    ROOM {recoveryRoute.activeRoom.roomCode}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-white/50">
                  TNG still sees an active Host Controller for this account.
                </p>
              )}

              <p className="mt-4 text-sm leading-relaxed text-white/55">
                Rejoining transfers Host control to this device. The existing room, players,
                scores and board state stay attached to the same live session.
              </p>

              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={reclaimHostController}
                  disabled={busy}
                  className="px-5 py-3 rounded-lg border border-[#BC13FE]/60 bg-[#BC13FE]/10 text-[#BC13FE] disabled:opacity-40"
                >
                  {busy ? 'REJOINING…' : 'REJOIN ROOM'}
                </button>


              </div>
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

        {phase === 'ready' && (
          <div className="flex min-h-[65vh] items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#BC13FE]/35 bg-black/70 p-6 text-left">
              <div className="text-[8px] uppercase tracking-[0.2em] text-[#BC13FE]" style={PS2}>PLAYER IDENTITY</div>
              <h2 className="mt-3 text-2xl font-black text-white">What name should players see?</h2>
              <p className="mt-2 text-sm text-white/50">This name appears beside you in the room roster. No account or sign-in is required.</p>
              <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-white/60">
                Host display name
                <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={32} autoComplete="nickname" placeholder="Enter your player name" className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-base text-white outline-none focus:border-[#BC13FE]" />
              </label>
              {pendingGame && <p className="mt-3 text-xs text-white/45">Creating a room for {pendingGame.title}.</p>}
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              <button type="button" onClick={confirmCreateRoom} disabled={!pendingGame || hostName.trim().length < 2 || busy} className="mt-5 w-full rounded-xl border border-[#BC13FE]/60 bg-[#BC13FE]/20 px-5 py-3 text-sm font-bold tracking-widest text-white disabled:opacity-40">
                {busy ? 'CREATING ROOM…' : 'CREATE ROOM'}
              </button>
            </div>
          </div>
        )}

        {phase === 'room' && activeRoom && (
          <div className="nc-root mx-auto min-h-screen max-w-[1650px] px-2 py-2 sm:px-3">
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

            {roomState && roomState.status === 'lobby' && (
              <SharedRoomLobby
                room={activeRoom}
                game={roomGame}
                people={roomPeople}
                isHost
                busy={busy}
                onStart={startGame}
                rosterError={rosterError}
                error={error}
              />
            )}

            {roomState && roomState.status !== 'lobby' && roomState.gameId === 'word-search' && (
              <div ref={hostBoardRef} className="nc-panel min-w-0 w-full p-3" style={{ minHeight: hostBoardHeight }}>
                <WordSearchGameBoard
                  controllerId={controllerId}
                  roomCode={activeRoom.roomCode}
                  roomPeople={roomPeople}
                  rosterError={rosterError}
                  onEndRoom={endRoom}
                  endRoomBusy={busy}
                />
              </div>
            )}

            {roomState && roomState.status !== 'lobby' && roomState.gameId !== 'word-search' && (
              <div
                className={
                  hostBoardSideBySide
                    ? roomState?.gameId === 'square-biz'
                      ? 'grid min-w-0 grid-cols-[minmax(0,1.8fr)_minmax(240px,.5fr)] items-start gap-3'
                      : 'grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] items-start gap-3'
                    : 'min-w-0 space-y-3'
                }
              >
                <section
                  ref={hostBoardRef}
                  className="nc-panel min-w-0 overflow-hidden p-3"
                  style={{ minHeight: hostBoardHeight }}
                >
                  <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
                    <span className="h-2 w-2 rounded-full bg-[#BC13FE] animate-pulse" />
                    <span className="text-[7px] uppercase tracking-[0.16em] text-[#BC13FE]" style={PS2}>
                      PLAYABLE HOST GAME · {roomGame?.title || activeRoom.gameId}
                    </span>
                  </div>
                  {roomState?.gameId === 'hangman' && <HangmanGameBoard controllerId={controllerId} />}
                  {roomState?.gameId === 'spades' && <SpadesGameBoard controllerId={controllerId} />}
                  {roomState?.gameId === 'square-biz' && <SquareBizGameBoard controllerId={controllerId} />}
                  {roomState?.gameId === 'bff' && <BFFGameBoard controllerId={controllerId} />}
                  {['out', 'viral', 'dominoes', 'see-that', 'word-wrangler', 'sudoku', 'rodeo-rumble'].includes(roomState?.gameId) && (
                    <RoomGameBoard gameId={roomState.gameId} roomCode={activeRoom.roomCode} />
                  )}
                </section>

                <section className="min-w-0 space-y-3">
                  <div className="nc-panel px-3 py-3">
                    <div className="text-[7px] uppercase tracking-[0.16em] text-[#BC13FE]" style={PS2}>ROOM INFORMATION</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-white/45">Share this code</span>
                      <span className="font-mono text-lg tracking-[0.16em] text-[#FFD700]">{activeRoom.roomCode}</span>
                    </div>
                    <div className="mt-2 text-xs text-white/35">{roomGame?.title || activeRoom.gameId} · {roomPeople.length} connected</div>
                  </div>
                              <section className="nc-panel mb-3 px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="text-[7px] uppercase tracking-[0.16em] text-green-400" style={PS2}>
                                      PEOPLE IN ROOM
                                    </div>
                                    <div className="rounded-full border border-green-400/25 bg-green-400/[0.06] px-2 py-1 text-[10px] text-green-400">
                                      {roomPeople.length}
                                    </div>
                                  </div>
                  
                                  <div className="text-[10px] text-white/25">
                                    Players and active spectators update automatically.
                                  </div>
                                </div>
                  
                                {rosterError ? (
                                  <div className="mt-3 text-xs text-red-400">{rosterError}</div>
                                ) : roomPeople.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {roomPeople.map((person, index) => {
                                      const label =
                                        ['host', 'host_player'].includes(person.role)
                                          ? 'HOST'
                                          : person.role === 'spectator'
                                            ? 'SPECTATOR'
                                            : person.seatNumber
                                              ? `SEAT ${person.seatNumber}`
                                              : 'PLAYER';
                  
                                      return (
                                        <div
                                          key={person.accountId || person.handle || `${person.role}-${index}`}
                                          className={`rounded-lg border px-3 py-2 ${
                                            person.role === 'spectator'
                                              ? 'border-[#22D3EE]/30 bg-[#22D3EE]/[0.05]'
                                              : ['host', 'host_player'].includes(person.role)
                                                ? 'border-[#FFD700]/30 bg-[#FFD700]/[0.05]'
                                                : 'border-[#BC13FE]/30 bg-[#BC13FE]/[0.05]'
                                          }`}
                                        >
                                          <div className="max-w-[180px] truncate text-sm text-white/80">
                                            {person.displayName || person.name || person.handle || 'Player'}
                                          </div>
                                          <div
                                            className={`mt-1 text-[6px] uppercase tracking-widest ${
                                              person.role === 'spectator'
                                                ? 'text-[#8DEEFF]'
                                                : ['host', 'host_player'].includes(person.role)
                                                  ? 'text-[#FFD700]'
                                                  : 'text-[#BC13FE]'
                                            }`}
                                            style={PS2}
                                          >
                                            {label}
                                            {person.handle ? ` · @${person.handle}` : ''}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-sm text-white/30">
                                    No connected players or spectators are being reported yet.
                                  </div>
                                )}
                              </section>
                  <section className="nc-panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[7px] uppercase tracking-widest text-[#f2c14e]" style={PS2}>HOST CONTROLS</span>
                      <button type="button" onClick={endRoom} disabled={busy}
                        className="rounded-lg border border-red-500/45 px-3 py-2 text-[7px] tracking-widest text-red-300 disabled:opacity-40" style={PS2}>
                        {busy ? 'ENDING…' : 'DISCONNECT'}
                      </button>
                    </div>
                  </section>
                  {roomState && !['hangman', 'spades', 'word-search', 'square-biz', 'bff'].includes(roomState.gameId) && (
                    <div className="rounded-xl border border-white/10 bg-black/50 p-4 text-sm text-white/40">
                      {roomGame?.title || roomState.gameId} host controls are not yet available in this shared console.
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
