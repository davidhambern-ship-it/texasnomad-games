import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Monitor, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';

import HostPasswordGate from '@/components/host/HostPasswordGate';
import { ALL_GAMES } from '@/components/host/HostGameSelect';
import { TngApiError, tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';

const HOST_PASSWORD = 'BERNA88@tx';
const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function HostShell({ children, user, status, onSignOut }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/40 bg-[#050505]/95 backdrop-blur-xl">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png"
              alt="TexasNomad Logo"
              className="w-9 h-9 object-contain"
            />
            <div className="hidden sm:block">
              <span className="tracking-widest text-white uppercase leading-none text-sm" style={{ fontFamily: "'Rye', serif" }}>TEXASNOMAD</span>
              <span className="block text-[8px] tracking-[0.2em] text-kinetic-orange uppercase leading-none mt-0.5" style={PS2}>NEON HOST CONTROL</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {status && (
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded border border-[#4ade80]/30 bg-[#4ade80]/10">
                <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
                <span className="text-[7px] text-[#4ade80] uppercase tracking-widest" style={PS2}>{status}</span>
              </div>
            )}
            {user && (
              <div className="hidden md:block text-right mr-2">
                <div className="text-[8px] text-white/60">{user.name || user.full_name || user.email}</div>
                <div className="text-[7px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>TNG HOST</div>
              </div>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-3 py-1 border border-white/20 text-white/50 rounded hover:bg-white/10 transition-all text-[8px] tracking-widest uppercase"
                style={PS2}
              >
                SIGN OUT
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

function StatusScreen({ text, detail, error = false }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-lg">
        {!error && <Loader2 className="w-10 h-10 mx-auto mb-5 text-[#BC13FE] animate-spin" />}
        <div className="uppercase tracking-widest" style={{ ...PS2, fontSize: 9, color: error ? '#ef4444' : '#BC13FE' }}>{text}</div>
        {detail && <p className="mt-4 text-sm text-white/45 leading-relaxed">{detail}</p>}
      </div>
    </div>
  );
}

export default function NeonHostPanel() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const [passwordAccepted, setPasswordAccepted] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [controllerId, setControllerId] = useState(null);
  const [, setHostSession] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const roomGame = useMemo(() => {
    if (!activeRoom) return null;
    return ALL_GAMES.find((game) => game.id === activeRoom.gameId) || selectedGame;
  }, [activeRoom, selectedGame]);

  async function createController() {
    const { device } = await tngApi.devices.create({
      role: 'host_controller',
      deviceLabel: 'Host Controller',
    });
    localStorage.setItem('tng_device_id', device.id);
    localStorage.setItem('tng_connection_role', 'host_controller');
    return device.id;
  }

  async function startOrResumeHost(deviceId) {
    try {
      return await tngApi.host.startSession(deviceId);
    } catch (hostError) {
      if (hostError instanceof TngApiError && ['INVALID_CONTROLLER', 'CONTROLLER_REQUIRED'].includes(hostError.code)) {
        const replacementId = await createController();
        setControllerId(replacementId);
        return tngApi.host.startSession(replacementId);
      }
      throw hostError;
    }
  }

  useEffect(() => {
    if (!passwordAccepted || !isAuthenticated || isLoadingAuth) return undefined;

    let cancelled = false;

    async function initializeHost() {
      setPhase('loading');
      setError('');
      try {
        try {
          await tngApi.profile.get();
        } catch (profileError) {
          if (profileError instanceof TngApiError && profileError.code === 'PROFILE_NOT_FOUND') {
            navigate('/onboarding?next=%2Fhost', { replace: true });
            return;
          }
          throw profileError;
        }

        let deviceId = localStorage.getItem('tng_device_id');
        const savedRole = localStorage.getItem('tng_connection_role');
        if (!deviceId || savedRole !== 'host_controller') {
          deviceId = await createController();
        }
        if (cancelled) return;
        setControllerId(deviceId);

        const sessionPayload = await startOrResumeHost(deviceId);
        if (cancelled) return;
        setHostSession(sessionPayload.hostSession);
        setActiveRoom(sessionPayload.activeRoom || null);

        if (sessionPayload.activeRoom) {
          setPhase('room');
          return;
        }

        if (sessionPayload.hostSession?.displayDeviceId) {
          setPhase('ready');
          return;
        }

        const pairingPayload = await tngApi.host.createPairing(deviceId);
        if (cancelled) return;
        setPairing(pairingPayload.pairing);
        setPhase('pairing');
      } catch (initializeError) {
        if (cancelled) return;
        setError(initializeError.message || 'The Host Controller could not start.');
        setPhase('error');
      }
    }

    initializeHost();
    return () => { cancelled = true; };
  }, [passwordAccepted, isAuthenticated, isLoadingAuth, navigate]);

  useEffect(() => {
    if (phase !== 'pairing' || !controllerId) return undefined;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const payload = await tngApi.host.startSession(controllerId);
        if (cancelled) return;
        setHostSession(payload.hostSession);
        setActiveRoom(payload.activeRoom || null);
        if (payload.activeRoom) {
          setPhase('room');
        } else if (payload.hostSession?.displayDeviceId) {
          setPairing(null);
          setPhase('ready');
        }
      } catch (pollError) {
        console.error('[NeonHostPanel] display pairing poll failed:', pollError);
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, controllerId]);

  async function refreshPairing() {
    if (!controllerId) return;
    setBusy(true);
    setError('');
    try {
      const payload = await tngApi.host.createPairing(controllerId);
      setPairing(payload.pairing);
    } catch (pairingError) {
      setError(pairingError.message || 'A new pairing code could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function createRoom(game) {
    if (!controllerId || busy) return;
    setBusy(true);
    setError('');
    setSelectedGame(game);
    try {
      const payload = await tngApi.host.createRoom(controllerId, game.id);
      setActiveRoom(payload.room);
      setPhase('room');
    } catch (roomError) {
      if (roomError instanceof TngApiError && roomError.code === 'HOST_ROOM_ALREADY_ACTIVE') {
        const resumed = await tngApi.host.startSession(controllerId);
        setHostSession(resumed.hostSession);
        setActiveRoom(resumed.activeRoom || null);
        if (resumed.activeRoom) setPhase('room');
      }
      setError(roomError.message || 'The live room could not be created.');
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
      setSelectedGame(null);
      setPhase('ready');
    } catch (roomError) {
      setError(roomError.message || 'The room could not be disconnected.');
    } finally {
      setBusy(false);
    }
  }

  async function signOutHost() {
    if (busy) return;
    setBusy(true);
    try {
      if (controllerId) await tngApi.host.endSession(controllerId);
    } catch (sessionError) {
      console.error('[NeonHostPanel] end session failed:', sessionError);
    } finally {
      localStorage.removeItem('tng_device_id');
      localStorage.removeItem('tng_connection_role');
      await logout(true);
    }
  }

  if (isLoadingAuth) {
    return <HostShell><StatusScreen text="CHECKING TNG ACCOUNT" /></HostShell>;
  }

  if (!isAuthenticated) {
    return (
      <HostShell>
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md text-center p-8 rounded-2xl border border-[#BC13FE]/40 bg-black/60">
            <ShieldCheck className="w-12 h-12 mx-auto mb-5 text-[#BC13FE]" />
            <h1 className="text-2xl uppercase tracking-wider mb-3" style={{ fontFamily: "'Rye', serif" }}>Host Sign-In Required</h1>
            <p className="text-sm text-white/45 leading-relaxed mb-6">Sign in with your TNG account before this device can become a Host Controller.</p>
            <Link to="/login?next=%2Fhost" className="inline-flex px-5 py-3 rounded-lg border-2 border-[#BC13FE] bg-[#BC13FE]/20 text-[#BC13FE] uppercase tracking-widest" style={{ ...PS2, fontSize: 8 }}>
              SIGN IN TO HOST
            </Link>
          </div>
        </div>
      </HostShell>
    );
  }

  if (!passwordAccepted) {
    return (
      <HostShell user={user} onSignOut={signOutHost}>
        <HostPasswordGate onSuccess={(password) => {
          if (password !== HOST_PASSWORD) return false;
          setPasswordAccepted(true);
          return true;
        }} />
      </HostShell>
    );
  }

  if (phase === 'idle' || phase === 'loading') {
    return <HostShell user={user} onSignOut={signOutHost}><StatusScreen text="STARTING HOST CONTROLLER" detail="Registering this device and checking for an existing Host session." /></HostShell>;
  }

  if (phase === 'error') {
    return <HostShell user={user} onSignOut={signOutHost}><StatusScreen text="HOST CONTROLLER ERROR" detail={error} error /></HostShell>;
  }

  if (phase === 'pairing') {
    return (
      <HostShell user={user} status="PAIRING DISPLAY" onSignOut={signOutHost}>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl text-center">
            <Monitor className="w-14 h-14 mx-auto mb-5 text-[#FFD700]" />
            <h1 className="text-3xl uppercase tracking-wider" style={{ fontFamily: "'Rye', serif" }}>Connect Game Display</h1>
            <p className="mt-3 text-sm text-white/45 leading-relaxed">Open the TNG Game Display on the TV, laptop, or second screen you want players to watch, then enter this code.</p>

            <div className="my-8 rounded-2xl border-2 border-[#FFD700]/60 bg-[#FFD700]/5 px-6 py-8" style={{ boxShadow: '0 0 35px rgba(255,215,0,0.12)' }}>
              <div className="text-[8px] text-white/35 uppercase tracking-[0.3em] mb-4" style={PS2}>DISPLAY PAIRING CODE</div>
              <div className="font-mono text-5xl sm:text-6xl tracking-[0.28em] text-[#FFD700] pl-[0.28em]">{pairing?.code || '------'}</div>
              {pairing?.expiresAt && <div className="mt-4 text-xs text-white/30">Expires {new Date(pairing.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>}
            </div>

            {error && <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/display" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#FFD700] text-black uppercase tracking-widest" style={{ ...PS2, fontSize: 8 }}>
                <Monitor className="w-4 h-4" /> OPEN DISPLAY
              </Link>
              <button onClick={refreshPairing} disabled={busy} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-white/20 text-white/60 hover:text-white disabled:opacity-50 uppercase tracking-widest" style={{ ...PS2, fontSize: 8 }}>
                <RefreshCw className="w-4 h-4" /> NEW CODE
              </button>
            </div>

            <p className="mt-6 text-xs text-white/25">This Host Panel will unlock automatically when the Game Display connects.</p>
          </div>
        </div>
      </HostShell>
    );
  }

  if (phase === 'room' && activeRoom) {
    return (
      <HostShell user={user} status="LIVE ROOM ACTIVE" onSignOut={signOutHost}>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl text-center">
            <div className="text-6xl mb-4">{roomGame?.emoji || '🎮'}</div>
            <div className="text-[8px] text-[#4ade80] uppercase tracking-[0.3em] mb-3" style={PS2}>HOST PANEL LOCKED TO ACTIVE ROOM</div>
            <h1 className="text-3xl sm:text-4xl uppercase tracking-wider" style={{ fontFamily: "'Rye', serif" }}>{roomGame?.title || activeRoom.gameId}</h1>

            <div className="my-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#BC13FE]/40 bg-[#BC13FE]/5 p-6">
                <div className="text-[7px] text-white/35 uppercase tracking-widest mb-3" style={PS2}>ROOM CODE</div>
                <div className="font-mono text-4xl tracking-[0.22em] text-[#BC13FE] pl-[0.22em]">{activeRoom.roomCode}</div>
              </div>
              <div className="rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/5 p-6">
                <div className="text-[7px] text-white/35 uppercase tracking-widest mb-3" style={PS2}>GAME DISPLAY</div>
                <div className="text-lg text-[#FFD700] uppercase tracking-wider">CONNECTED</div>
              </div>
            </div>

            <p className="text-sm text-white/40 leading-relaxed max-w-xl mx-auto">The Neon backend now owns this room. A second live room cannot be created from this Host Panel until this room is disconnected.</p>
            {error && <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

            <button onClick={endRoom} disabled={busy} className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 uppercase tracking-widest" style={{ ...PS2, fontSize: 8 }}>
              <Unplug className="w-4 h-4" /> {busy ? 'DISCONNECTING…' : 'DISCONNECT ROOM'}
            </button>
          </div>
        </div>
      </HostShell>
    );
  }

  return (
    <HostShell user={user} status="DISPLAY CONNECTED" onSignOut={signOutHost}>
      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="text-center max-w-xl mb-10">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-[#4ade80]" />
          <h1 className="text-3xl uppercase tracking-wider" style={{ fontFamily: "'Rye', serif" }}>Host System Ready</h1>
          <p className="mt-3 text-sm text-white/40">Your Host Controller and Game Display are paired. Choose the game this Host session will control.</p>
        </div>

        {error && <div className="w-full max-w-2xl mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-2xl">
          {ALL_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => createRoom(game)}
              disabled={busy}
              className="group flex flex-col items-center p-6 border-2 rounded-xl bg-black/60 hover:scale-105 transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:hover:scale-100"
              style={{ borderColor: game.color + '40' }}
            >
              <span className="text-5xl mb-3">{game.emoji}</span>
              <span className="text-lg tracking-widest uppercase" style={{ ...PS2, color: game.color, textShadow: '0 0 15px ' + game.color + '60' }}>{game.title}</span>
              <span className="text-[7px] tracking-[0.2em] text-white/50 uppercase mt-2" style={PS2}>{game.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </HostShell>
  );
}
