import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesSeat({ seatNumber, player, isMe, isAvailable, isSpectator, onSit, currentTurnSeat, isPlaying }) {
  const isMyTurn = currentTurnSeat === seatNumber && isPlaying;
  const occupied = !!player;

  return (
    <div className="flex flex-col items-center gap-1">
      {occupied ? (
        <>
          {isMyTurn && (
            <div className="text-[6px] tracking-widest text-[#FFD700] uppercase px-1.5 py-0.5 rounded bg-[#070311] border border-[#FFD700]/40"
              style={PS2}>▶ TURN</div>
          )}
          <div className="font-heading text-xs tracking-widest text-white/80">
            SEAT {seatNumber}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
            <span className="text-[6px] text-[#4ade80]/70 uppercase" style={PS2}>
              {player.role === 'hostPlayer' ? 'HOST' : 'PLAYER'}
            </span>
          </div>
          {player.bid != null && (
            <div className="text-[6px] text-[#FFD700]/60 mt-0.5 uppercase" style={PS2}>
              Bid: {player.bid}
            </div>
          )}
        </>
      ) : isAvailable && isSpectator ? (
        <button
          onClick={onSit}
          className="px-3 py-1.5 rounded-lg border-2 border-[#4ade80]/60 text-[#4ade80] text-[7px] tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all active:scale-95"
          style={PS2}
        >
          SIT
        </button>
      ) : (
        <div className="text-[7px] tracking-widest text-white/20 uppercase" style={PS2}>
          Seat {seatNumber}
        </div>
      )}
    </div>
  );
}