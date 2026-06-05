import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesSeat({ seatNumber, player, isMe, isAvailable, isSpectator, onSit, currentTurnSeat, isPlaying }) {
  const isMyTurn = currentTurnSeat === seatNumber && isPlaying;
  const occupied = !!player;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative px-3 py-2 rounded-xl border-2 text-center min-w-[80px] transition-all duration-300 ${
          isMyTurn
            ? 'border-[#FFD700] bg-[#FFD700]/15'
            : isMe
            ? 'border-[#4ade80] bg-[#4ade80]/10'
            : occupied
            ? 'border-[#BC13FE]/50 bg-[#BC13FE]/08'
            : 'border-white/10 bg-white/5'
        }`}
        style={{
          boxShadow: isMyTurn
            ? '0 0 20px rgba(255,215,0,0.4)'
            : isMe
            ? '0 0 10px rgba(74,222,128,0.2)'
            : 'none',
        }}
      >
        {isMyTurn && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[6px] tracking-widest text-[#FFD700] uppercase px-1.5 py-0.5 rounded bg-[#070311] border border-[#FFD700]/40"
            style={PS2}>▶ TURN</div>
        )}

        <div className="text-[7px] tracking-widest uppercase mb-0.5" style={{ ...PS2, color: isMe ? '#4ade80' : '#ffffff50' }}>
          {isMe ? 'YOU' : `SEAT ${seatNumber}`}
        </div>

        {occupied ? (
          <>
            <div className="font-heading text-sm tracking-widest text-white">
              SEAT {seatNumber}
            </div>
            <div className="flex items-center gap-1 justify-center mt-0.5">
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
    </div>
  );
}