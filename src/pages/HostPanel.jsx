import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import HostPasswordGate from '@/components/host/HostPasswordGate';
import HostGameSelect from '@/components/host/HostGameSelect';
import HostConsole from '@/components/host/HostConsole';

const HOST_PASSWORD = 'BERNA88@tx';

export default function HostPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [changingRoom, setChangingRoom] = useState(false);

  const handlePassword = (pw) => {
    if (pw === HOST_PASSWORD) {
      setAuthenticated(true);
    } else {
      return false;
    }
  };

  const handleGameSelect = (game, roomCode) => {
    setSelectedGame(game);
    setActiveRoom(roomCode);
    setChangingRoom(false);
  };

  const handleDisconnect = () => {
    setActiveRoom(null);
    setSelectedGame(null);
    setChangingRoom(false);
  };

  const handleChangeRoom = () => {
    setChangingRoom(true);
  };

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
                <span className="block text-[8px] tracking-[0.2em] text-kinetic-orange uppercase leading-none mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>HOST CONTROL</span>
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
          {authenticated && (
            <div className="flex items-center gap-2">
              {activeRoom && !changingRoom && (
                <button
                  onClick={handleChangeRoom}
                  className="px-3 py-1 border border-[#FFD700]/50 text-[#FFD700] rounded hover:bg-[#FFD700]/10 transition-all text-[9px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                  ⇄ CHANGE ROOM
                </button>
              )}
              <button
                onClick={handleDisconnect}
                className="px-3 py-1 border border-red-500/50 text-red-400 rounded hover:bg-red-500/20 transition-all text-[9px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {!authenticated && (
          <HostPasswordGate onSuccess={handlePassword} />
        )}
        {authenticated && (!selectedGame || changingRoom) && (
          <HostGameSelect onSelect={handleGameSelect} currentGame={selectedGame} />
        )}
        {authenticated && selectedGame && activeRoom && !changingRoom && (
          <HostConsole game={selectedGame} roomCode={activeRoom} onDisconnect={handleDisconnect} />
        )}
      </main>
    </div>
  );
}