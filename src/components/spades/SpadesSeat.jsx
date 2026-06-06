import React from 'react';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesSeat({ 
  seatNumber, 
  player, 
  isMe, 
  isAvailable, 
  isSpectator, 
  onSit, 
  onStand,
  onTakeOver,
  currentTurnSeat, 
  isPlaying
}) {
  const isMyTurn = currentTurnSeat === seatNumber && isPlaying;
  const occupied = !!player;
  const isCPU = player?.playerType === 'cpu';

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

        {occupied ? (
          <>
            <div className="font-heading text-sm tracking-widest text-white">
              {isMe ? 'YOU' : `SEAT ${seatNumber}`}
            </div>
            <div className="flex items-center gap-1 justify-center mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
              <span className="text-[6px] text-[#4ade80]/70 uppercase" style={PS2}>
                {player.role === 'hostPlayer' ? 'HOST' : isMe ? 'PLAYER' : player.playerType === 'cpu' ? 'CPU' : 'PLAYER'}
              </span>
            </div>
            {player.bid != null && (
              <div className="text-[6px] text-[#FFD700]/60 mt-0.5 uppercase" style={PS2}>
                Bid: {player.bid}
              </div>
            )}
            
            {/* STAND button for seated players */}
            {isMe && (
              <button
                onClick={onStand}
                className="mt-1.5 px-2 py-1 rounded border border-red-500/60 text-red-400 text-[6px] tracking-widest uppercase hover:bg-red-500/20 transition-all active:scale-95 w-full"
                style={PS2}
              >
                Stand
              </button>
            )}
            
            {/* TAKE OVER button for CPU seats */}
            {isCPU && isSpectator && (
              <button
                onClick={onTakeOver}
                className="mt-1.5 px-2 py-1 rounded border border-[#FFD700]/60 text-[#FFD700] text-[6px] tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95 w-full"
                style={PS2}
              >
                Take Over
              </button>
            )}
            
            {/* Player's hand - show face-down for other players, face-up only for current viewer */}
            {player?.hand?.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-0.5" style={{ maxWidth: 200 }}>
                {[...player.hand].slice(0, 7).map((card, i) => (
                  <div
                    key={card.id || i}
                    className="w-6 h-8 rounded border border-white/20 overflow-hidden shadow-sm"
                    style={{ transform: `rotate(${(i - 3) * 3}deg)`, marginLeft: i > 0 ? '-8px' : '0' }}
                  >
                    <img 
                      src={isMe ? getCardImage(card) : getCardBack()} 
                      alt={isMe ? `${card.value}${card.suit}` : 'Card'} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                ))}
                {player.hand.length > 7 && (
                  <div className="w-6 h-8 rounded border border-white/20 bg-black/60 flex items-center justify-center text-[6px] text-white/60" style={{ marginLeft: '-8px' }}>
                    +{player.hand.length - 7}
                  </div>
                )}
              </div>
            )}
          </>
        ) : isAvailable ? (
          <>
            <div className="font-heading text-xs tracking-widest text-white/30 mb-1">EMPTY</div>
            <button
              onClick={onSit}
              className="px-2 py-1 rounded border border-[#4ade80]/60 text-[#4ade80] text-[7px] tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all active:scale-95"
              style={PS2}
            >
              SIT
            </button>
          </>
        ) : (
          <div className="font-heading text-xs tracking-widest text-white/20">EMPTY</div>
        )}
      </div>
    </div>
  );
}