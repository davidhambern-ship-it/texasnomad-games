import React, { useState, useEffect } from 'react';
import { getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function HostSeatSlot({ seatNumber, player, onKick, onForceTurn, currentBidderSeat, currentTurnSeat, isBidding, isPlaying, onSetBid }) {
  const [bidInput, setBidInput] = useState('');
  const [countdown, setCountdown] = useState(15);
  const isBiddingTurn = isBidding && currentBidderSeat === seatNumber;
  const isPlayingTurn = isPlaying && currentTurnSeat === seatNumber;
  const isHighlighted = isBiddingTurn || isPlayingTurn;
  const occupied = !!player;
  const isCPU = player?.playerType === 'cpu';

  useEffect(() => {
    if (!isBiddingTurn || !occupied || player?.bid != null) {
      setCountdown(15);
      return;
    }
    setCountdown(15);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          onSetBid(player.playerId, 3);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isBiddingTurn, player?.playerId]);

  return (
    <div className={`px-3 py-2 rounded-xl border-2 text-center min-w-[90px] transition-all ${
      isHighlighted ? 'border-[#FFD700] bg-[#FFD700]/15' : occupied ? 'border-[#BC13FE]/40 bg-[#BC13FE]/05' : 'border-white/10 bg-white/5'
    }`}
      style={{ boxShadow: isHighlighted ? '0 0 15px rgba(255,215,0,0.3)' : 'none' }}>
      <div className="text-[7px] text-white/40 uppercase mb-1" style={PS2}>Seat {seatNumber}</div>
      {occupied ? (
        <>
          <div className="font-heading text-xs text-white flex items-center justify-center gap-1">
            {player.role === 'hostPlayer' ? '🎛 HOST' : isCPU ? '🤖 CPU' : `👤 SEAT ${seatNumber}`}
          </div>
          {isBidding && (
            <>
              {player.bid != null ? (
                <div className="text-[6px] text-[#4ade80] mt-0.5 font-heading uppercase" style={PS2}>Bid: {player.bid}</div>
              ) : isBiddingTurn ? (
                <>
                  <div className="text-[6px] text-[#FFD700] mt-0.5" style={PS2}>⏱ {countdown}s</div>
                  <div className="mt-1 flex gap-1">
                    <input type="number" min="0" max="13"
                      className="w-10 px-1 py-0.5 rounded bg-black/80 border border-white/20 text-white text-xs text-center focus:outline-none"
                      value={bidInput} onChange={e => setBidInput(e.target.value)} placeholder="0" />
                    <button onClick={() => { onSetBid(player.playerId, Number(bidInput)); setBidInput(''); }}
                      className="px-1.5 py-0.5 rounded border border-[#4ade80]/60 text-[#4ade80] text-[7px] hover:bg-[#4ade80]/20 font-heading"
                      style={PS2}>SET</button>
                  </div>
                </>
              ) : (
                <div className="text-[6px] text-white/30 mt-0.5" style={PS2}>Waiting...</div>
              )}
            </>
          )}
          {isPlaying && player.bid != null && (
            <div className="text-[6px] text-[#FFD700]/60 mt-0.5" style={PS2}>Bid: {player.bid} | Books: {player.tricksWon || 0}</div>
          )}
          {player.hand && player.hand.length > 0 && (
            <div className="mt-1 text-[6px] text-white/30 font-heading uppercase" style={PS2}>
              🂠 {player.hand.length} cards
            </div>
          )}
          <div className="flex gap-1 mt-1 justify-center flex-wrap">
            <button onClick={() => onForceTurn(seatNumber)}
              className="px-1.5 py-0.5 rounded border border-[#FFD700]/40 text-[#FFD700]/70 text-[6px] hover:bg-[#FFD700]/10 font-heading uppercase"
              style={PS2}>▶</button>
            {player.role !== 'hostPlayer' && (
              <button onClick={() => onKick(player.playerId)}
                className="px-1.5 py-0.5 rounded border border-red-500/40 text-red-400 text-[6px] hover:bg-red-500/20 font-heading uppercase"
                style={PS2}>Kick</button>
            )}
          </div>
        </>
      ) : (
        <div className="font-heading text-xs text-white/20">Empty</div>
      )}
    </div>
  );
}