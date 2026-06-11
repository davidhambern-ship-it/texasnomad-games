import React from 'react';
import { getCardBack } from '@/lib/spadesCardImages';
import TNCharacterStatus, { getAIStatus } from './TNCharacterStatus';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesSeat({ 
  seatNumber, 
  player, 
  isMe, 
  isJoinable, 
  onSit, 
  onStand,
  onTakeOver,
  currentTurnSeat, 
  isPlaying,
  gs,
  position,
}) {
  // isMyTurn drives the seat badge glow — no external golden ring
  const isMyTurn = currentTurnSeat === seatNumber && isPlaying;
  const occupied = !!player;
  const isCPU = player?.playerType === 'cpu';
  const isTNCharacter = isCPU && !!player?.characterId;
  const aiStatus = isTNCharacter ? getAIStatus(player, gs || {}) : null;

  // Character color based on characterId
  const charColors = {
    berna: '#BC13FE', dexter: '#22d3ee', lemonade: '#FFD700',
    carlos: '#FF5F1F', violet: '#8b5cf6', tank: '#4ade80',
  };
  const charColor = isTNCharacter ? (charColors[player.characterId] || '#BC13FE') : '#BC13FE';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative rounded-xl border-2 text-center transition-all duration-300`}
        style={{
          minWidth: isTNCharacter ? 96 : 80,
          padding: isTNCharacter ? '8px 10px' : '8px 12px',
          borderColor: isMyTurn ? '#FFD700' : isMe ? '#4ade80' : isTNCharacter ? `${charColor}60` : occupied ? '#BC13FE50' : '#ffffff10',
          background: isMyTurn ? '#FFD70015' : isMe ? '#4ade8010' : isTNCharacter ? `${charColor}10` : occupied ? '#BC13FE08' : '#ffffff05',
          boxShadow: isMyTurn ? '0 0 20px rgba(255,215,0,0.4)' : isMe ? '0 0 10px rgba(74,222,128,0.2)' : isTNCharacter ? `0 0 12px ${charColor}25` : 'none',
        }}
      >
        {isMyTurn && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[6px] tracking-widest text-[#FFD700] uppercase px-1.5 py-0.5 rounded bg-[#070311] border border-[#FFD700]/40"
            style={PS2}>▶ TURN</div>
        )}

        {occupied ? (
          <>
            {/* TN Character: show avatar + name + role */}
            {isTNCharacter ? (
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <img
                    src={player.characterAvatar}
                    alt={player.name}
                    className="w-10 h-10 rounded-lg border-2 object-cover"
                    style={{ borderColor: `${charColor}60` }}
                  />
                  {isMyTurn && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-[#070311]"
                      style={{ background: '#FFD700' }} />
                  )}
                </div>
                <div className="font-heading text-xs tracking-widest uppercase" style={{ color: charColor }}>
                  {player.name}
                </div>
                <div className="text-[6px] text-white/40 uppercase tracking-widest" style={PS2}>
                  {player.characterRole}
                </div>
                {aiStatus && <TNCharacterStatus status={aiStatus} />}
                {player.bid != null && (
                  <div className="text-[6px] text-[#FFD700]/60 uppercase" style={PS2}>
                    Bid: {player.bid}
                  </div>
                )}
                {/* SIT button to replace AI */}
                {isJoinable && (
                  <button onClick={onTakeOver}
                    className="mt-1 px-2 py-0.5 rounded border border-[#FFD700]/60 text-[#FFD700] text-[6px] tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95 w-full"
                    style={PS2}>
                    Sit
                  </button>
                )}
              </div>
            ) : (
              /* Human or generic CPU seat */
              <>
                <div className="font-heading text-sm tracking-widest text-white">
                  {isMe ? 'YOU' : `SEAT ${seatNumber}`}
                </div>
                <div className="flex items-center gap-1 justify-center mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                  <span className="text-[6px] text-[#4ade80]/70 uppercase" style={PS2}>
                    {player.role === 'hostPlayer' ? 'HOST' : isMe ? 'PLAYER' : isCPU ? 'CPU' : 'PLAYER'}
                  </span>
                </div>
                {player.bid != null && (
                  <div className="text-[6px] text-[#FFD700]/60 mt-0.5 uppercase" style={PS2}>
                    Bid: {player.bid}
                  </div>
                )}
                {isMe && (
                  <button onClick={onStand}
                    className="mt-1.5 px-2 py-1 rounded border border-red-500/60 text-red-400 text-[6px] tracking-widest uppercase hover:bg-red-500/20 transition-all active:scale-95 w-full"
                    style={PS2}>
                    Stand
                  </button>
                )}
                {isCPU && isJoinable && (
                  <button onClick={onTakeOver}
                    className="mt-1.5 px-2 py-1 rounded border border-[#FFD700]/60 text-[#FFD700] text-[6px] tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95 w-full"
                    style={PS2}>
                    Sit
                  </button>
                )}
              </>
            )}

            {/* Show face-down card count for all occupied seats */}
            {player?.hand?.length > 0 && !isMe && (() => {
              const isLR = position === 'left' || position === 'right';
              const cards = [...player.hand].slice(0, Math.min(5, player.hand.length));
              return (
                <div className={`mt-1 flex justify-center ${isLR ? 'flex-col items-center' : ''}`}
                  style={{ gap: isLR ? '-8px' : '0' }}>
                  {cards.map((card, i) => {
                    const spread = (i - (cards.length - 1) / 2) * 3;
                    const baseRot = isLR ? 90 : 0;
                    return (
                      <div key={i} className="w-4 h-6 rounded border border-white/20 overflow-hidden shadow-sm"
                        style={{
                          transform: `rotate(${baseRot + spread}deg)`,
                          marginLeft: i > 0 && !isLR ? '-6px' : '0',
                          marginTop: i > 0 && isLR ? '-8px' : '0',
                        }}>
                        <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
                      </div>
                    );
                  })}
                  {player.hand.length > 5 && (
                    <div className="w-4 h-6 rounded border border-white/20 bg-black/60 flex items-center justify-center text-[5px] text-white/60"
                      style={{ marginLeft: !isLR ? '-6px' : '0', marginTop: isLR ? '-8px' : '0' }}>
                      +{player.hand.length - 5}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Stand up — only for the human "me" seat */}
            {isMe && isTNCharacter === false && (
              <button onClick={onStand}
                className="mt-1.5 px-2 py-1 rounded border border-red-500/60 text-red-400 text-[6px] tracking-widest uppercase hover:bg-red-500/20 transition-all active:scale-95 w-full"
                style={PS2}>
                Stand
              </button>
            )}
          </>
        ) : isJoinable ? (
          <>
            <div className="font-heading text-xs tracking-widest text-white/30 mb-1">SEAT {seatNumber}</div>
            <button onClick={onSit}
              className="px-2 py-1 rounded border border-[#4ade80]/60 text-[#4ade80] text-[7px] tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all active:scale-95"
              style={PS2}>
              SIT
            </button>
          </>
        ) : (
          <div className="font-heading text-xs tracking-widest text-white/20">SEAT {seatNumber}</div>
        )}
      </div>

      <div className="text-[6px] text-white/20 uppercase tracking-widest" style={PS2}>
        {seatNumber === 1 || seatNumber === 3 ? 'T1' : 'T2'}
      </div>
    </div>
  );
}