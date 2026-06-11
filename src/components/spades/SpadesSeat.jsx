import React from 'react';
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

  const isTopBottom = position === 'top' || position === 'bottom';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative rounded-xl border-2 text-center transition-all duration-300`}
        style={{
          minWidth: isTNCharacter ? 96 : (isTopBottom ? 'auto' : 80),
          padding: isTNCharacter ? '6px 10px' : '6px 10px',
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
              <div className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <img
                    src={player.characterAvatar}
                    alt={player.name}
                    className="w-8 h-8 rounded-lg border-2 object-cover"
                    style={{ borderColor: `${charColor}60` }}
                  />
                  {isMyTurn && (
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-[#070311]"
                      style={{ background: '#FFD700' }} />
                  )}
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <div className="font-heading text-xs tracking-widest uppercase" style={{ color: charColor }}>
                    {player.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: charColor }} />
                    <span className="text-[6px] text-white/40 uppercase tracking-widest" style={PS2}>
                      {player.characterRole || 'CPU'}
                    </span>
                  </div>
                  {player.bid != null && (
                    <div className="text-[6px] text-[#FFD700]/60 uppercase" style={PS2}>
                      Bid: {player.bid}
                    </div>
                  )}
                  {isJoinable && (
                    <button onClick={onTakeOver}
                      className="px-2 py-0.5 rounded border border-[#FFD700]/60 text-[#FFD700] text-[6px] tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
                      style={PS2}>
                      Sit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Human or generic CPU seat */
              <div className={`flex items-center gap-2 ${isTopBottom ? 'flex-row' : 'flex-col'}`}>
                <div className="font-heading text-sm tracking-widest text-white">
                  {isMe ? 'YOU' : `SEAT ${seatNumber}`}
                </div>
                <div className="flex items-center gap-1 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                  <span className="text-[6px] text-[#4ade80]/70 uppercase" style={PS2}>
                    {player.role === 'hostPlayer' ? 'HOST' : isMe ? 'PLAYER' : isCPU ? 'CPU' : 'PLAYER'}
                  </span>
                </div>
                {player.bid != null && (
                  <div className="text-[6px] text-[#FFD700]/60 uppercase" style={PS2}>
                    Bid: {player.bid}
                  </div>
                )}
                {isMe && (
                  <button onClick={onStand}
                    className="px-2 py-1 rounded border border-red-500/60 text-red-400 text-[6px] tracking-widest uppercase hover:bg-red-500/20 transition-all active:scale-95"
                    style={PS2}>
                    Stand
                  </button>
                )}
                {isCPU && isJoinable && (
                  <button onClick={onTakeOver}
                    className="px-2 py-1 rounded border border-[#FFD700]/60 text-[#FFD700] text-[6px] tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
                    style={PS2}>
                    Sit
                  </button>
                )}
              </div>
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