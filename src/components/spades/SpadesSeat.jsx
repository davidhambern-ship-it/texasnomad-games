import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesSeat({ seatNumber, player, isMe, isAvailable, isSpectator, onSit, currentTurnSeat, isPlaying }) {
  const isMyTurn = currentTurnSeat === seatNumber && isPlaying;
  const occupied = !!player;

  return (
    <div className="flex flex-col items-center gap-1">
      {isMyTurn && (
        <div className="text-[6px] tracking-widest text-[#FFD700] uppercase px-1.5 py-0.5 rounded bg-[#070311] border border-[#FFD700]/40"
          style={PS2}>▶ TURN</div>
      )}

      {occupied ? (
        <div className="flex flex-col items-center">
          <div className="font-heading text-sm tracking-widest text-white">
            {isMe ? 'YOU' : `SEAT ${seatNumber}`}
          </div>
          <div className="flex items-center gap-1 justify-center mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
            <span className="text-[6px] text-[#4ade80]/70 uppercase" style={PS2}>
              {player.role === 'hostPlayer' ? 'HOST' : isMe ? 'PLAYER' : 'PLAYER'}
            </span>
          </div>
          {player.bid != null && (
            <div className="text-[6px] text-[#FFD700]/60 mt-0.5 uppercase" style={PS2}>
              Bid: {player.bid}
            </div>
          )}
        </div>
      ) : isAvailable && isSpectator ? (
        <>
          <div className="font-heading text-xs tracking-widest text-white/30 mb-1">EMPTY</div>
          <button
            onClick={onSit}
            className="px-2 py-1 rounded border border-[#4ade80]/60 text-[#4ade80] text-[7px] tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all active:scale-95"
            style={PS2}
          >
            Sit
          </button>
        </>
      ) : (
        <div className="font-heading text-xs tracking-widest text-white/20">EMPTY</div>
      )}
    </div>
  );
}