import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import SpadesTable from '@/components/spades/SpadesTable';
import { fillEmptySeatsWithCPU } from '@/lib/spadesCPU';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SPADES_SEATS = [1, 2, 3, 4];

export default function SpadesGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) {
    window.location.href = '/games';
    return null;
  }
  return <SpadesViewer roomCode={roomCode} />;
}

function SpadesViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'spades', 'viewer');

  // Stable playerId per room
  const [playerId] = useState(() => {
    const key = `tn_pid_${roomCode}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);

  // overlay: null = not shown, 'choosing' = show sit/spectate, 'done' = chosen
  const [overlayState, setOverlayState] = useState('choosing');
  const [myRole, setMyRole] = useState(() => localStorage.getItem(`spades_role_${roomCode}`) || null);
  const [mySeatNumber, setMySeatNumber] = useState(null);

  // CPU choice state
  const [showCPUChoice, setShowCPUChoice] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);

  const containerRef = useRef(null);
  const gs = room?.game_state || {};
  const players = gs.players || [];

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Sync my seat from room state on load / updates
  useEffect(() => {
    if (!room || !playerId) return;
    const me = players.find(p => p.playerId === playerId);
    if (me) {
      setMySeatNumber(me.seatNumber);
      setMyRole(me.role);
      localStorage.setItem(`spades_role_${roomCode}`, me.role);
      setOverlayState('done');
    }
  }, [room, playerId]);

  // If we already have a saved role, skip overlay
  useEffect(() => {
    if (myRole) setOverlayState('done');
  }, []);

  const occupiedSeats = players.filter(p => p.role === 'player' || p.role === 'hostPlayer').map(p => p.seatNumber);
  const availableSeats = SPADES_SEATS.filter(s => !occupiedSeats.includes(s));

  const handleChooseSpectate = async () => {
    if (!room) return;
    const newPlayer = {
      playerId,
      seatNumber: null,
      role: 'spectator',
      connected: true,
      joinedAt: Date.now(),
      lastActionAt: Date.now(),
    };
    const existing = players.find(p => p.playerId === playerId);
    const updatedPlayers = existing
      ? players.map(p => p.playerId === playerId ? { ...p, role: 'spectator', connected: true } : p)
      : [...players, newPlayer];
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'spectator');
    setMyRole('spectator');
    setOverlayState('done');
  };

  const handleChooseSit = async () => {
    if (!room) return;
    if (availableSeats.length === 0) {
      await handleChooseSpectate();
      setNotification({ message: 'All seats full — you are spectating', type: 'info' });
      return;
    }
    const seat = availableSeats[0];
    await sitInSeat(seat);
    // After sitting, show CPU choice
    setShowCPUChoice(true);
    setSelectedSeat(seat);
  };

  const sitInSeat = async (seatNum) => {
    if (!room) return;
    const newPlayer = {
      playerId,
      seatNumber: seatNum,
      role: 'player',
      playerType: 'human',
      connected: true,
      joinedAt: Date.now(),
      lastActionAt: Date.now(),
    };
    const existing = players.find(p => p.playerId === playerId);
    const updatedPlayers = existing
      ? players.map(p => p.playerId === playerId ? { ...p, seatNumber: seatNum, role: 'player', playerType: 'human', connected: true } : p)
      : [...players, newPlayer];
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'player');
    setMyRole('player');
    setMySeatNumber(seatNum);
    setOverlayState('done');
  };

  const handlePlayAgainstCPU = async () => {
    if (!room) return;
    // Fill empty seats with CPU players
    const currentPlayers = gs.players || [];
    const filledPlayers = fillEmptySeatsWithCPU(currentPlayers, gs);
    await updateState({ players: filledPlayers, cpu_enabled: true });
    setShowCPUChoice(false);
    setNotification({ message: 'CPU players joined the table', type: 'success' });
  };

  const handleWaitForRealPlayers = async () => {
    if (!room) return;
    setShowCPUChoice(false);
    setNotification({ message: 'Waiting for more players...', type: 'info' });
  };

  const isPlayer = myRole === 'player' || myRole === 'hostPlayer';
  const isSpectator = myRole === 'spectator';

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />
      <SpadesHeader
        roomCode={roomCode}
        room={room}
        isFullscreen={isFullscreen}
        containerRef={containerRef}
        seatNumber={mySeatNumber}
        isSeated={isPlayer}
        myRole={myRole}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 relative">
          {/* Game board always visible behind overlay */}
          <div className={overlayState === 'choosing' ? 'filter blur-sm pointer-events-none select-none' : ''}>
            <SpadesTable
              gs={gs}
              playerId={playerId}
              mySeatNumber={mySeatNumber}
              myRole={myRole}
              isPlayer={isPlayer}
              isSpectator={isSpectator}
              updateState={updateState}
              availableSeats={availableSeats}
              onSitInSeat={sitInSeat}
              roomCode={roomCode}
            />
          </div>

          {/* Sit or Spectate Overlay */}
          {overlayState === 'choosing' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="max-w-sm w-full mx-4 p-8 rounded-2xl border-2 border-[#BC13FE]/60 bg-[#070311]/95 text-center"
                style={{ boxShadow: '0 0 60px rgba(188,19,254,0.3)' }}>
                <div className="text-4xl mb-4">♠️</div>
                <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase mb-2">SPADES</div>
                <div className="text-[8px] tracking-widest text-white/40 uppercase mb-6" style={PS2}>
                  ROOM {roomCode}
                </div>
                <div className="font-heading text-lg tracking-widest text-white uppercase mb-6">
                  Would you like to sit or spectate?
                </div>
                {availableSeats.length > 0 ? (
                  <div className="text-[7px] text-[#4ade80]/60 mb-6 uppercase" style={PS2}>
                    {availableSeats.length} seat{availableSeats.length !== 1 ? 's' : ''} available
                  </div>
                ) : (
                  <div className="text-[7px] text-[#FF5F1F]/60 mb-6 uppercase" style={PS2}>
                    All 4 seats taken — spectate only
                  </div>
                )}
                <div className="flex gap-4">
                  <button
                    onClick={handleChooseSit}
                    disabled={availableSeats.length === 0}
                    className="flex-1 py-4 rounded-xl border-2 font-heading text-lg tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ borderColor: '#4ade80', color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}
                  >
                    Sit
                  </button>
                  <button
                    onClick={handleChooseSpectate}
                    className="flex-1 py-4 rounded-xl border-2 font-heading text-lg tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                    style={{ borderColor: '#BC13FE', color: '#BC13FE', background: 'rgba(188,19,254,0.08)' }}
                  >
                    Spectate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CPU Choice Overlay */}
          {showCPUChoice && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="max-w-md w-full mx-4 p-8 rounded-2xl border-2 border-[#FFD700]/60 bg-[#070311]/95 text-center"
                style={{ boxShadow: '0 0 60px rgba(255,215,0,0.3)' }}>
                <div className="text-4xl mb-4">🤠</div>
                <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase mb-2">PLAY MODE</div>
                <div className="text-[8px] tracking-widest text-white/40 uppercase mb-6" style={PS2}>
                  ROOM {roomCode} — SEAT {selectedSeat}
                </div>
                <div className="font-heading text-lg tracking-widest text-white uppercase mb-6">
                  Would you like to play against the computer while waiting for more players?
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handlePlayAgainstCPU}
                    className="flex-1 py-4 rounded-xl border-2 font-heading text-lg tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                    style={{ borderColor: '#4ade80', color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}
                  >
                    Play Against CPU
                  </button>
                  <button
                    onClick={handleWaitForRealPlayers}
                    className="flex-1 py-4 rounded-xl border-2 font-heading text-lg tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                    style={{ borderColor: '#BC13FE', color: '#BC13FE', background: 'rgba(188,19,254,0.08)' }}
                  >
                    Wait For Real Players
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpadesHeader({ roomCode, room, isFullscreen, containerRef, seatNumber, isSeated, myRole }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#070311]/90 backdrop-blur-xl">
      <div className="px-4 h-12 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="shrink-0">
            <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
          </Link>
          <span className="text-[#FFD700] uppercase text-[9px] tracking-widest hidden sm:block" style={PS2}>SPADES</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse shrink-0" />
            <span className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
          </div>
          {room?.host_connected && (
            <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[7px] tracking-widest uppercase hidden sm:inline" style={PS2}>
              🔴 HOST LIVE
            </span>
          )}
          {myRole === 'spectator' && (
            <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-white/40 text-[7px] tracking-widest uppercase" style={PS2}>
              👁 SPECTATING
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSeated && seatNumber && (
            <div className="px-2 py-1 rounded border border-[#BC13FE] bg-[#BC13FE]/10 text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>
              SEAT {seatNumber}
            </div>
          )}
          <Link to="/games" className="px-2 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[7px] tracking-widest uppercase hidden sm:block" style={PS2}>← LOBBY</Link>
          <button
            onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
            className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[7px] tracking-widest uppercase" style={PS2}>
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>
      </div>
    </header>
  );
}