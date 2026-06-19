import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import HostPasswordGate from '@/components/host/HostPasswordGate';
import HostAccountGate from '@/components/host/HostAccountGate';
import HostGameSelect from '@/components/host/HostGameSelect';
import HostConsole from '@/components/host/HostConsole';
import LivePlayersPanel from '@/components/host/admin/LivePlayersPanel.jsx';
import PlayerProfilesPanel from '@/components/host/admin/PlayerProfilesPanel.jsx';
import useHostSession from '@/hooks/useHostSession';

const HOST_PASSWORD = 'BERNA88@tx';
const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function HostPanel() {
  const [step, setStep] = useState('password'); // 'password' | 'account' | 'panel'
  const [hostUser, setHostUser] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [changingRoom, setChangingRoom] = useState(false);
  const [adminView, setAdminView] = useState(null); // null | 'live-players' | 'player-profiles'
  const { startHostSession, endHostSession } = useHostSession();

  const handlePassword = (pw) => {
    if (pw === HOST_PASSWORD) {
      setStep('account');
    } else {
      return false;
    }
  };

  const handleAccountSuccess = (user) => {
    setHostUser(user);
    setStep('panel');
    startHostSession(null);
  };

  const handleGameSelect = (game, roomCode) => {
    setSelectedGame(game);
    setActiveRoom(roomCode);
    setChangingRoom(false);
    startHostSession(game?.id || null);
  };

  const handleDisconnect = () => {
    endHostSession();
    setActiveRoom(null);
    setSelectedGame(null);
    setChangingRoom(false);
  };

  const handleChangeRoom = () => {
    setChangingRoom(true);
  };

  const handleSignOut = () => {
    endHostSession();
    setStep('password');
    setHostUser(null);
    setSelectedGame(null);
    setActiveRoom(null);
    setChangingRoom(false);
  };

  const authenticated = step === 'panel';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/40 bg-[#050505]/95 backdrop-blur-xl">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TexasNomad Logo" className="w-9 h-9 object-contain" />
              <div className="hidden sm:block">
                <span className="tracking-widest text-white uppercase leading-none text-sm" style={{ fontFamily: "'Rye', serif" }}>TEXASNOMAD</span>
                <span className="block text-[8px] tracking-[0.2em] text-kinetic-orange uppercase leading-none mt-0.5" style={PS2}>HOST CONTROL</span>
              </div>
            </Link>
            {activeRoom && selectedGame && (
              <div className="flex items-center gap-2 ml-4">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-heading text-xs tracking-widest text-[#FFD700] uppercase">
                  {selectedGame.title} — {activeRoom}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Step indicator */}
            {step === 'account' && (
              <div className="px-2 py-1 rounded border border-[#FFD700]/30 text-[#FFD700]/60 text-[7px] tracking-widest uppercase" style={PS2}>
                Step 2: Account
              </div>
            )}
            {/* Host user badge */}
            {hostUser && (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded border border-[#BC13FE]/40 bg-[#BC13FE]/10">
                <span className="text-[7px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>🎛 HOST</span>
                <span className="text-[7px] text-white/60 font-body">{hostUser.full_name || hostUser.email}</span>
              </div>
            )}
            {authenticated && activeRoom && !changingRoom && (
              <button onClick={handleChangeRoom}
                className="px-3 py-1 border border-[#FFD700]/50 text-[#FFD700] rounded hover:bg-[#FFD700]/10 transition-all text-[9px] tracking-widest uppercase" style={PS2}>
                ⇄ CHANGE ROOM
              </button>
            )}
            {authenticated && activeRoom && (
              <button onClick={handleDisconnect}
                className="px-3 py-1 border border-red-500/50 text-red-400 rounded hover:bg-red-500/20 transition-all text-[9px] tracking-widest uppercase" style={PS2}>
                DISCONNECT
              </button>
            )}
            {authenticated && (
              <button onClick={handleSignOut}
                className="px-3 py-1 border border-white/20 text-white/40 rounded hover:bg-white/10 transition-all text-[9px] tracking-widest uppercase" style={PS2}>
                SIGN OUT
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for steps */}
        {step !== 'panel' && (
          <div className="h-0.5 bg-[#BC13FE]/10">
            <div
              className="h-full bg-[#BC13FE] transition-all duration-500"
              style={{ width: step === 'password' ? '50%' : '100%' }}
            />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {step === 'password' && (
          <>
            <div className="text-center pt-8 pb-2">
              <div className="inline-flex items-center gap-6 px-6 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#BC13FE] flex items-center justify-center text-xs font-bold">1</div>
                  <span className="text-[8px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>Host Password</span>
                </div>
                <div className="w-8 h-px bg-white/20" />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs text-white/40">2</div>
                  <span className="text-[8px] text-white/30 uppercase tracking-widest" style={PS2}>TNG Account</span>
                </div>
              </div>
            </div>
            <HostPasswordGate onSuccess={handlePassword} />
          </>
        )}

        {step === 'account' && (
          <>
            <div className="text-center pt-8 pb-2">
              <div className="inline-flex items-center gap-6 px-6 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs">✓</div>
                  <span className="text-[8px] text-green-400 uppercase tracking-widest" style={PS2}>Host Password</span>
                </div>
                <div className="w-8 h-px bg-[#BC13FE]/60" />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#BC13FE] flex items-center justify-center text-xs font-bold">2</div>
                  <span className="text-[8px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>TNG Account</span>
                </div>
              </div>
            </div>
            <HostAccountGate onSuccess={handleAccountSuccess} />
          </>
        )}

        {authenticated && adminView === 'live-players' && (
          <LivePlayersPanel onBack={() => setAdminView(null)} />
        )}
        {authenticated && adminView === 'player-profiles' && (
          <PlayerProfilesPanel onBack={() => setAdminView(null)} />
        )}
        {authenticated && !adminView && (!selectedGame || changingRoom) && (
          <HostGameSelect onSelect={handleGameSelect} currentGame={selectedGame} onAdminSelect={setAdminView} />
        )}
        {authenticated && !adminView && selectedGame && activeRoom && !changingRoom && (
          <HostConsole game={selectedGame} roomCode={activeRoom} onDisconnect={handleDisconnect} />
        )}
      </main>
    </div>
  );
}