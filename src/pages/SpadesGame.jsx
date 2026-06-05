import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import RoleSelection from '@/components/game/RoleSelection.jsx';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) {
    window.location.href = '/';
    return null;
  }
  return <SpadesViewer roomCode={roomCode} />;
}

function SpadesViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'spades', 'viewer');
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'spades', updateState);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [myRole, setMyRole] = useState(() => localStorage.getItem(`spades_role_${roomCode}`) || null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [myTeam, setMyTeam] = useState(null);

  const containerRef = useRef(null);
  const gs = room?.game_state || {};

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!playerId || !gs.players) return;
    const me = (gs.players || []).find(p => p.playerId === playerId);
    if (me?.team && !myTeam) setMyTeam(me.team);
  }, [gs.players, playerId]);

  const handleChooseRole = async (role) => {
    setRoleLoading(true);
    try {
      const updatedPlayers = (gs.players || []).map(p =>
        p.playerId === playerId ? { ...p, role } : p
      );
      await updateState({ players: updatedPlayers });
      localStorage.setItem(`spades_role_${roomCode}`, role);
      setMyRole(role);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleChooseTeam = async (team) => {
    const updatedPlayers = (gs.players || []).map(p =>
      p.playerId === playerId ? { ...p, team, role: 'participant' } : p
    );
    await updateState({ players: updatedPlayers });
    setMyTeam(team);
  };

  const players = gs.players || [];
  const isParticipant = myRole === 'participant';
  const isPlaying = gs.phase === 'playing';

  if (isSeated && !myRole) {
    return (
      <div ref={containerRef} className="min-h-screen bg-[#070311] text-white">
        <SpadesHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} />
        <RoleSelection
          roomCode={roomCode}
          seatNumber={seatNumber}
          onChooseRole={handleChooseRole}
          loading={roleLoading}
        />
      </div>
    );
  }

  if (isParticipant && !myTeam) {
    return (
      <div ref={containerRef} className="min-h-screen bg-[#070311] text-white">
        <SpadesHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} />
        <TeamSelector gs={gs} onChoose={handleChooseTeam} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />
      <SpadesHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !isPlaying ? (
        <WaitingScreen isSeated={isSeated} seatNumber={seatNumber} role={myRole} gs={gs} />
      ) : (
        <GameScreen
          gs={gs}
          playerId={playerId}
          seatNumber={seatNumber}
          players={players}
          isParticipant={isParticipant}
          myTeam={myTeam}
        />
      )}
    </div>
  );
}

function SpadesHeader({ roomCode, room, isFullscreen, containerRef, seatNumber, isSeated }) {
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
          <Link to="/" className="px-2 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[7px] tracking-widest uppercase hidden sm:block" style={PS2}>← LOBBY</Link>
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

function TeamSelector({ gs, onChoose }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div>
          <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase mb-2">Choose Your Team</div>
          <div className="text-[8px] tracking-widest text-white/40 uppercase" style={PS2}>Pick your partner</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { team: 1, name: 'Team 1', color: '#BC13FE' },
            { team: 2, name: 'Team 2', color: '#FF5F1F' },
          ].map(({ team, name, color }) => (
            <button key={team} onClick={() => onChoose(team)}
              className="p-6 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 text-center"
              style={{ borderColor: `${color}60`, background: `${color}08` }}>
              <div className="font-heading text-lg tracking-widest uppercase mb-2" style={{ color }}>{name}</div>
              <div className="text-[8px] text-white/40 uppercase" style={PS2}>Partner across the table</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameScreen({ gs, playerId, seatNumber, players, isParticipant, myTeam }) {
  const isPlaying = gs.phase === 'playing';

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-4xl mx-auto w-full">
      {/* Table Layout */}
      <div className="flex-1 relative bg-[#0a1a0a] rounded-3xl border-4 border-[#3d2817]" style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)', minHeight: '500px' }}>
        {/* Center - Played Cards */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-2 border-white/10 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[8px] tracking-widest text-white/30 uppercase" style={PS2}>Center</div>
            <div className="text-[7px] text-white/20 mt-1" style={PS2}>Played Cards</div>
          </div>
        </div>

        {/* Player Positions */}
        {/* Top (Partner) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
          <div className="px-4 py-2 rounded-lg border border-[#BC13FE]/40 bg-[#BC13FE]/10">
            <div className="text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>Partner</div>
            <div className="text-[8px] text-white/60" style={PS2}>Seat ?</div>
          </div>
        </div>

        {/* Bottom (You) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
          <div className="px-4 py-2 rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/10">
            <div className="text-[7px] tracking-widest text-[#4ade80] uppercase" style={PS2}>You</div>
            <div className="text-[8px] text-white" style={PS2}>Seat {seatNumber}</div>
          </div>
          {/* Hand placeholder */}
          <div className="mt-2 flex gap-1 justify-center">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-10 h-14 rounded bg-white border border-gray-300" />
            ))}
          </div>
        </div>

        {/* Left (Opponent 1) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-center">
          <div className="px-4 py-2 rounded-lg border border-[#FF5F1F]/40 bg-[#FF5F1F]/10">
            <div className="text-[7px] tracking-widest text-[#FF5F1F] uppercase" style={PS2}>Opponent</div>
            <div className="text-[8px] text-white/60" style={PS2}>Seat ?</div>
          </div>
        </div>

        {/* Right (Opponent 2) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-center">
          <div className="px-4 py-2 rounded-lg border border-[#FF5F1F]/40 bg-[#FF5F1F]/10">
            <div className="text-[7px] tracking-widest text-[#FF5F1F] uppercase" style={PS2}>Opponent</div>
            <div className="text-[8px] text-white/60" style={PS2}>Seat ?</div>
          </div>
        </div>
      </div>

      {/* Score Board */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border-2 rounded-xl text-center" style={{ borderColor: '#BC13FE30', background: '#BC13FE08' }}>
          <div className="font-heading text-sm tracking-widest text-white uppercase">Team 1</div>
          <div className="font-heading text-2xl text-[#BC13FE] mt-1">0</div>
          <div className="text-[7px] text-white/30 mt-1" style={PS2}>Bid: -</div>
        </div>
        <div className="p-4 border-2 rounded-xl text-center" style={{ borderColor: '#FF5F1F30', background: '#FF5F1F08' }}>
          <div className="font-heading text-sm tracking-widest text-white uppercase">Team 2</div>
          <div className="font-heading text-2xl text-[#FF5F1F] mt-1">0</div>
          <div className="text-[7px] text-white/30 mt-1" style={PS2}>Bid: -</div>
        </div>
      </div>

      {/* Game Info */}
      <div className="px-4 py-3 border border-[#FFD700]/30 rounded-xl bg-[#FFD700]/5 text-center">
        <div className="text-[8px] tracking-widest text-[#FFD700]/50 uppercase mb-1" style={PS2}>Current Trick</div>
        <div className="font-heading text-lg text-[#FFD700]">Waiting for play...</div>
      </div>

      {!isParticipant && (
        <div className="text-center px-4 py-3 border border-white/10 rounded-xl bg-white/5">
          <div className="text-[8px] tracking-widest text-white/30 uppercase" style={PS2}>👁 Watching — no controls</div>
        </div>
      )}
    </div>
  );
}

function WaitingScreen({ isSeated, seatNumber, role, gs }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4">
      <div className="space-y-5">
        <div className="text-6xl">♠️</div>
        <div className="text-lg tracking-widest text-white/40 uppercase" style={PS2}>Waiting for Host…</div>
        {isSeated ? (
          <div className="px-6 py-4 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/10"
            style={{ boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}>
            <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={PS2}>You are</div>
            <div className="text-3xl text-white" style={PS2}>SEAT {seatNumber}</div>
            {role && <div className="text-[7px] text-[#4ade80]/60 uppercase mt-2" style={PS2}>{role === 'participant' ? '🃏 Player' : '👁 Watcher'}</div>}
          </div>
        ) : (
          <div className="text-[8px] tracking-widest text-white/20 uppercase" style={PS2}>Assigning seat…</div>
        )}
      </div>
    </div>
  );
}