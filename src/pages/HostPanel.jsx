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

  const handlePassword = (pw) => {
    if (pw === HOST_PASSWORD) {
      setAuthenticated(true);
    } else {
      return false;
    }
  };

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'TN';
    for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleGameSelect = (game) => {
    setSelectedGame(game);
    setActiveRoom(generateRoomCode());
  };

  const handleDisconnect = () => {
    setActiveRoom(null);
    setSelectedGame(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/40 bg-[#050505]/95 backdrop-blur-xl">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#BC13FE]/20 border-2 border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-[#FFD700] text-xs">TN</span>
              </div>
              <div className="hidden sm:block">
                <span className="font-heading text-sm tracking-widest text-white uppercase leading-none">TEXASNOMAD</span>
                <span className="block text-[9px] tracking-[0.3em] text-[#FF5F1F] uppercase">HOST CONTROL</span>
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
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 border border-red-500/50 text-red-400 text-xs font-bold tracking-widest uppercase rounded hover:bg-red-500/20 transition-all"
            >
              DISCONNECT
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {!authenticated && (
          <HostPasswordGate onSuccess={handlePassword} />
        )}
        {authenticated && !selectedGame && (
          <HostGameSelect onSelect={handleGameSelect} />
        )}
        {authenticated && selectedGame && activeRoom && (
          <HostConsole game={selectedGame} roomCode={activeRoom} onDisconnect={handleDisconnect} />
        )}
      </main>
    </div>
  );
}