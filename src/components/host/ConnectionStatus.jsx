import React from 'react';

export default function ConnectionStatus({ room, roomCode, gameId }) {
  const hostOk = room?.host_connected;
  const screenOk = room?.screen_connected;
  // Derive live player count from game_state.players (players_connected field is never kept in sync)
  const players = (room?.game_state?.players || []).length;
  const status = room?.status || 'waiting';

  const Dot = ({ on, label }) => (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${on ? 'bg-green-400' : 'bg-red-500'}`}
        style={on ? { boxShadow: '0 0 8px #4ade80' } : { boxShadow: '0 0 8px #ef4444' }} />
      <span className="font-heading text-xs tracking-widest text-white/70 uppercase">{label}</span>
      <span className={`font-heading text-xs tracking-widest uppercase ${on ? 'text-green-400' : 'text-red-400'}`}>
        {on ? 'CONNECTED' : 'DISCONNECTED'}
      </span>
    </div>
  );

  return (
    <div className="border-b border-[#BC13FE]/20 bg-black/40 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      {/* Room Code */}
      <div className="flex items-center gap-2">
        <span className="font-heading text-[10px] tracking-[0.25em] text-white/40 uppercase">Room:</span>
        <span className="font-mono text-[#FFD700] font-bold tracking-widest text-sm">{roomCode}</span>
        <span className="font-heading text-[10px] tracking-[0.2em] text-white/30 uppercase">/games/{gameId}?room={roomCode}</span>
      </div>

      <div className="h-4 w-px bg-white/10 hidden sm:block" />

      <Dot on={hostOk} label="Host:" />

      <div className="h-4 w-px bg-white/10 hidden sm:block" />

      <Dot on={screenOk} label="Game Screen:" />

      <div className="h-4 w-px bg-white/10 hidden sm:block" />

      {/* Players */}
      <div className="flex items-center gap-2">
        <span className="font-heading text-[10px] tracking-[0.25em] text-white/40 uppercase">Players:</span>
        <span className="font-heading text-[#BC13FE] font-bold tracking-widest">{players}</span>
      </div>

      <div className="h-4 w-px bg-white/10 hidden sm:block" />

      {/* Live Status */}
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-[#BC13FE] animate-pulse' : 'bg-white/20'}`} />
        <span className={`font-heading text-xs tracking-widest uppercase ${status === 'active' ? 'text-[#BC13FE]' : 'text-white/40'}`}>
          {status === 'active' ? 'LIVE' : status === 'waiting' ? 'STANDBY' : 'FINISHED'}
        </span>
      </div>
    </div>
  );
}