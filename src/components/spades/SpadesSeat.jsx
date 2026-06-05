import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesSeat({ seatNumber, player, isMe, isAvailable, isSpectator, onSit, currentTurnSeat, isPlaying }) {
  const isMyTurn = currentTurnSeat === seatNumber && isPlaying;
  const occupied = !!player;

  // Only show styled box for my turn or my seat
  if (isMyTurn || isMe) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className={`relative px-3 py-2 rounded-xl border-2 text-center min-w-[80px] transition-all duration-300 ${
            isMyTurn
              ? 'border-[#FFD700] bg-[#FFD700]/15'
              : 'border-[#4ade80] bg-[#4ade80]/10'
          }`}
          style={{
            boxShadow: isMyTurn ? '0 0 20px rgba(255,215,0,0.4)' : '0 0 10px rgba(74,222,128,0.2)',
          }}
        >
          {isMyTurn && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[6px] tracking-widest text-[#FFD700] uppercase px-1.5 py-0.5 rounded bg-[#070311] border border-[#FFD700]/40"
              style={PS2}>▶ TURN</div>
          )}
          <div className="font-heading text-sm tracking-widest text-white">YOU</div>
          <div className="flex items-center gap-1 justify-center mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
            <span className="text-[6px] text-[#4ade80]/70 uppercase" style={PS2}>PLAYER</span>
          </div>
          {player?.bid != null && (
            <div className="text-[6px] text-[#FFD700]/60 mt-0.5 uppercase" style={PS2}>
              Bid: {player.bid}
            </div>
          )}
        </div>
      </div>
    );
  }

  // For other occupied seats, just show indicator dot with no box
  if (occupied) {
    return (
      <div className="w-2 h-2 rounded-full bg-[#BC13FE]" style={{ boxShadow: '0 0 8px rgba(188,19,254,0.5)' }} />
    );
  }

  // For available seats when spectating
  if (isAvailable && isSpectator) {
    return (
      <button
        onClick={onSit}
        className="px-2 py-1 rounded border border-[#4ade80]/60 text-[#4ade80] text-[7px] tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all active:scale-95"
        style={PS2}
      >
        Sit
      </button>
    );
  }

  return null;
}