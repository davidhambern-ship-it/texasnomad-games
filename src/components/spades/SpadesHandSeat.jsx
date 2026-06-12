import React from 'react';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const CHAR_COLORS = {
  berna: '#BC13FE', dexter: '#22d3ee', lemonade: '#FFD700',
  carlos: '#FF5F1F', violet: '#8b5cf6', tank: '#4ade80',
};

/**
 * SpadesHandSeat — renders one seat's hand + player info as a single unit.
 * position: 'top' | 'bottom' | 'left' | 'right'
 * For 'bottom' (human): shows face-up clickable cards.
 * For others: shows card backs.
 */
export default function SpadesHandSeat({
  position,
  player,
  seatNumber,
  isMe,
  isMyTurn,
  isBidding,
  cardCount,         // for deal animation (local count)
  hand,              // actual hand array (only populated for 'me')
  onPlayCard,
  isJoinable,
  onSit,
  onTakeOver,
  gs,
}) {
  const isCPU = player?.playerType === 'cpu';
  const charColor = isCPU && player?.characterId
    ? (CHAR_COLORS[player.characterId] || '#BC13FE')
    : isMe ? '#4ade80' : '#BC13FE';

  const playerName = player?.playerName || player?.name || (player ? `Seat ${seatNumber}` : null);
  const bid = player?.bid;
  const books = player?.tricksWon ?? 0;
  const hasBid = bid != null;

  const isHorizontal = position === 'top' || position === 'bottom';

  // How many card backs to show for CPU/opponent
  const backCount = cardCount > 0 ? Math.min(cardCount, 13) : (player?.hand?.length ?? 0);

  // Glow style when it's this seat's turn
  const glowStyle = isMyTurn
    ? { boxShadow: '0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2)', borderColor: '#FFD700' }
    : isMe
    ? { borderColor: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.15)' }
    : { borderColor: `${charColor}40` };

  // ── Info strip (name / bid / books) ──────────────────────────
  const InfoStrip = () => (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${isMyTurn ? 'animate-pulse' : ''}`}
      style={{
        background: isMyTurn ? 'rgba(255,215,0,0.08)' : 'rgba(0,0,0,0.5)',
        border: `1px solid ${isMyTurn ? '#FFD70040' : charColor + '30'}`,
        maxWidth: isHorizontal ? 220 : 120,
      }}>
      {/* Avatar or color dot */}
      {isCPU && player?.characterAvatar ? (
        <img src={player.characterAvatar} alt={playerName}
          className="w-6 h-6 rounded object-cover shrink-0 border"
          style={{ borderColor: `${charColor}60` }} />
      ) : (
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: charColor }} />
      )}
      <div className="flex flex-col leading-none gap-0.5 min-w-0">
        <div className="text-[7px] tracking-widest uppercase truncate font-heading" style={{ color: charColor, maxWidth: 90 }}>
          {isMe ? 'YOU' : (playerName || `Seat ${seatNumber}`)}
        </div>
        <div className="flex gap-2">
          <span className="text-[5px] text-white/40 uppercase tracking-widest" style={PS2}>
            {hasBid ? `Bid:${bid}` : '—'}
          </span>
          <span className="text-[5px] text-white/40 uppercase tracking-widest" style={PS2}>
            📚{books}
          </span>
        </div>
      </div>
      {isMyTurn && (
        <div className="text-[5px] text-[#FFD700] uppercase tracking-widest animate-bounce" style={PS2}>▶</div>
      )}
      {isJoinable && (
        <button
          onClick={isCPU ? onTakeOver : onSit}
          className="px-1.5 py-0.5 rounded border text-[5px] uppercase tracking-widest transition-all active:scale-95"
          style={{ borderColor: `${charColor}60`, color: charColor, ...PS2 }}>
          SIT
        </button>
      )}
    </div>
  );

  // ── Card backs fan (opponents) ─────────────────────────────────
  const CardBacks = () => {
    if (backCount === 0) {
      return (
        <div className="text-[6px] text-white/20 uppercase tracking-widest px-3 py-2" style={PS2}>
          No cards
        </div>
      );
    }
    if (isHorizontal) {
      return (
        <div className="flex items-end" style={{ gap: -10 }}>
          {Array.from({ length: backCount }).map((_, i) => (
            <div key={i} className="shrink-0"
              style={{ width: 32, height: 46, marginLeft: i > 0 ? -16 : 0, position: 'relative', zIndex: i }}>
              <img src={getCardBack()} alt="Card" className="w-full h-full rounded shadow-md" style={{ objectFit: 'contain' }} />
            </div>
          ))}
        </div>
      );
    } else {
      // vertical stack
      return (
        <div className="flex flex-col items-center" style={{ gap: -28 }}>
          {Array.from({ length: backCount }).map((_, i) => (
            <div key={i} className="shrink-0"
              style={{ width: 32, height: 46, marginTop: i > 0 ? -28 : 0, position: 'relative', zIndex: i }}>
              <img src={getCardBack()} alt="Card" className="w-full h-full rounded shadow-md" style={{ objectFit: 'contain' }} />
            </div>
          ))}
        </div>
      );
    }
  };

  // ── My hand (face up, clickable) ──────────────────────────────
  const MyCards = () => {
    if (!hand || hand.length === 0) return null;
    return (
      <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', maxWidth: '100%' }}>
        {hand.map((card, i) => {
          const canPlay = isMyTurn && gs?.phase === 'playing';
          return (
            <div key={card.id || i}
              onClick={() => canPlay && onPlayCard?.(card)}
              className={`relative rounded-lg overflow-hidden shadow-lg transition-all duration-150 select-none shrink-0 ${
                canPlay ? 'cursor-pointer hover:-translate-y-4 hover:shadow-[0_0_16px_rgba(255,215,0,0.7)] active:scale-95' : 'opacity-80'
              }`}
              style={{
                width: 54, height: 76,
                filter: canPlay ? 'brightness(1.1)' : 'brightness(0.85)',
              }}>
              <img
                src={getCardImage(card)}
                alt={`${card.suit}${card.value}`}
                className="w-full h-full"
                style={{ objectFit: 'contain' }}
                onError={(e) => { e.target.src = getCardBack(); }}
              />
              {canPlay && (
                <div className="absolute inset-0 bg-[#FFD700]/10 opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                  <span className="text-[5px] text-[#FFD700]" style={PS2}>PLAY</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Empty seat ────────────────────────────────────────────────
  if (!player) {
    if (isJoinable) {
      return (
        <div className={`flex ${isHorizontal ? 'flex-col items-center' : 'flex-row items-center'} gap-1`}>
          <div className="text-[6px] text-white/20 uppercase tracking-widest" style={PS2}>Seat {seatNumber}</div>
          <button onClick={onSit}
            className="px-2 py-1 rounded border border-[#4ade80]/40 text-[#4ade80] text-[6px] tracking-widest uppercase hover:bg-[#4ade80]/10 transition-all"
            style={PS2}>
            SIT
          </button>
        </div>
      );
    }
    return (
      <div className="text-[6px] text-white/15 uppercase tracking-widest" style={PS2}>
        Seat {seatNumber}
      </div>
    );
  }

  // ── Occupied seat layouts ─────────────────────────────────────
  const borderStyle = {
    border: `1px solid ${isMyTurn ? '#FFD70050' : charColor + '25'}`,
    borderRadius: 12,
    padding: isHorizontal ? '6px 8px' : '6px 6px',
    ...glowStyle,
    transition: 'all 0.3s ease',
  };

  if (position === 'bottom' && isMe) {
    // Full face-up hand at bottom
    return (
      <div className="flex flex-col items-center gap-1.5 w-full" style={borderStyle}>
        <InfoStrip />
        {isMyTurn && (
          <div className="text-[6px] text-[#FFD700] uppercase tracking-widest animate-pulse" style={PS2}>
            ▶ YOUR TURN — TAP A CARD TO PLAY
          </div>
        )}
        <MyCards />
      </div>
    );
  }

  if (position === 'top') {
    return (
      <div className="flex flex-col items-center gap-1" style={borderStyle}>
        <CardBacks />
        <InfoStrip />
      </div>
    );
  }

  if (position === 'bottom' && !isMe) {
    // Spectator or someone else at bottom
    return (
      <div className="flex flex-col items-center gap-1" style={borderStyle}>
        <InfoStrip />
        <CardBacks />
      </div>
    );
  }

  if (position === 'left') {
    return (
      <div className="flex flex-row items-center gap-1.5" style={borderStyle}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          <InfoStrip />
        </div>
        <CardBacks />
      </div>
    );
  }

  if (position === 'right') {
    return (
      <div className="flex flex-row-reverse items-center gap-1.5" style={borderStyle}>
        <div style={{ writingMode: 'vertical-rl' }}>
          <InfoStrip />
        </div>
        <CardBacks />
      </div>
    );
  }

  return null;
}