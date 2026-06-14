import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import RoleSelector from '@/components/game/RoleSelector.jsx';
import HostPanel from '@/components/nameThatTrack/HostPanel.jsx';
import GameScreen from '@/components/nameThatTrack/GameScreen.jsx';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function NameThatTrackGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <NameThatTrackViewer roomCode={roomCode} />;
}

function NameThatTrackViewer({ roomCode }) {
  const { room, loading, updateState, registerPlayer } = useGameRoom(roomCode, 'name-that-track', 'viewer');
  const gs = room?.game_state || {};
  
  const [chosenRole, setChosenRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'name-that-track', updateState, false, chosenRole);

  useEffect(() => {
    if (isSeated && playerId) registerPlayer(playerId);
  }, [isSeated, playerId, registerPlayer]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const displayMode = gs.display_mode;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#05030b] text-white flex flex-col relative">
      {!chosenRole && isSeated && displayMode === 'game' && !loading && (
        <RoleSelector seatNumber={seatNumber} isSeated={isSeated} onChooseRole={handleChooseRole} loading={roleLoading} />
      )}

      <header className="sticky top-0 z-40 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FF5F1F] uppercase text-[10px] tracking-widest" style={PS2}>Name That Track</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span className="text-[9px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
            </div>
            {room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[8px] tracking-widest uppercase" style={PS2}>🔴 HOST LIVE</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
            <Link to="/games" className="px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[8px] tracking-widest uppercase" style={PS2}>← LOBBY</Link>
            <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }} className="px-3 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[8px] tracking-widest uppercase" style={PS2}>
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#8a22ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !displayMode ? (
        <WaitingForHost />
      ) : displayMode === 'host' ? (
        <HostPanel gs={gs} updateState={updateState} />
      ) : (
        <GameScreen gs={gs} updateState={updateState} playerId={playerId} />
      )}
    </div>
  );

  function handleChooseRole(role) {
    setRoleLoading(true);
    setChosenRole(role);
    setTimeout(() => setRoleLoading(false), 1000);
  }
}

function WaitingForHost() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8">
      <div className="w-16 h-16 border-4 border-[#8a22ff]/40 border-t-[#8a22ff] rounded-full animate-spin" />
      <div className="font-heading text-2xl tracking-widest text-white/40 uppercase">Waiting for Host…</div>
    </div>
  );
}