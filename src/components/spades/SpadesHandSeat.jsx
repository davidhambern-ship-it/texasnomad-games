import React, { useState } from 'react';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const CHAR_COLORS = {
  berna: '#BC13FE', dexter: '#22d3ee', lemonade: '#FFD700',
  carlos: '#FF5F1F', violet: '#8b5cf6', tank: '#4ade80',
};

/**
 * Compute card width + overlap so the whole fan fits within maxWidth pixels.
 * Returns { cardW, cardH, overlap }
 */
function fitCards(count, maxWidth, baseW = 54, baseH = 76, minW = 28, maxOverlapFrac = 0.45) {
  if (count <= 1) return { cardW: baseW, cardH: baseH, overlap: 0 };
  // Total width = cardW + (count-1) * (cardW - overlap)
  // Try progressively more overlap until it fits, then shrink card size if needed
  let cardW = baseW;
  let overlap = 0;
  for (let w = baseW; w >= minW; w--) {
    // Try increasing overlap fractions at this card size
    for (let frac = 0.3; frac <= maxOverlapFrac; frac += 0.05) {
      const ov = Math.round(w * frac);
      const total = w + (count - 1) * (w - ov);
      if (total <= maxWidth) {
        cardW = w;
        overlap = ov;
        return { cardW, cardH: Math.round(cardW * (baseH / baseW)), overlap };
      }
    }
    if (w === minW) {
      // Force fit at minimum size
      const ov2 = Math.ceil((w * count - maxWidth) / Math.max(count - 1, 1));
      cardW = w;
      overlap = Math.min(Math.floor(w * maxOverlapFrac), Math.max(0, ov2));
    }
  }
  return { cardW, cardH: Math.round(cardW * (baseH / baseW)), overlap };
}

/**
 * Vertical fit for side-column card backs.
 * Returns { cardW, cardH, overlap }
 */
function fitCardsVertical(count, maxHeight, baseW = 32, baseH = 46, minH = 18) {
  if (count <= 1) return { cardW: baseW, cardH: baseH, overlap: 0 };
  for (let h = baseH; h >= minH; h--) {
    const w = Math.round(h * (baseW / baseH));
    const ov = Math.round(h * 0.6);
    const total = h + (count - 1) * (h - ov);
    if (total <= maxHeight) return { cardW: w, cardH: h, overlap: ov };
  }
  const h = minH;
  const ov = Math.ceil((h * count - maxHeight) / Math.max(count - 1, 1));
  return { cardW: Math.round(h * (baseW / baseH)), cardH: h, overlap: Math.max(0, ov) };
}

export default function SpadesHandSeat({
  position,
  player,
  seatNumber,
  isMe,
  isMyTurn,
  isBidding,
  cardCount,
  hand,
  onPlayCard,
  isJoinable,
  onSit,
  onTakeOver,
  gs,
  // layout constraints passed from SpadesTable
  maxWidth,   // px — available horizontal space for bottom/top hands
  maxHeight,  // px — available vertical space for left/right hands
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);

  const isCPU = player?.playerType === 'cpu';
  const charColor = isCPU && player?.characterId
    ? (CHAR_COLORS[player.characterId] || '#BC13FE')
    : isMe ? '#4ade80' : '#BC13FE';

  const playerName = player?.playerName || player?.name || (player ? `Seat ${seatNumber}` : null);
  const bid = player?.bid;
  const books = player?.tricksWon ?? 0;
  const hasBid = bid != null;

  const isHorizontal = position === 'top' || position === 'bottom';
  const backCount = cardCount > 0 ? Math.min(cardCount, 13) : (player?.hand?.length ?? 0);

  const glowStyle = isMyTurn
    ? { boxShadow: '0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2)', borderColor: '#FFD700' }
    : isMe
    ? { borderColor: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.15)' }
    : { borderColor: `${charColor}40` };

  // ── Info strip ────────────────────────────────────────────────
  const InfoStrip = ({ compact = false }) => (
    <div
      className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg ${isMyTurn ? 'animate-pulse' : ''}`}
      style={{
        background: isMyTurn ? 'rgba(255,215,0,0.08)' : 'rgba(0,0,0,0.6)',
        border: `1px solid ${isMyTurn ? '#FFD70040' : charColor + '30'}`,
        maxWidth: compact ? 100 : 200,
        flexShrink: 0,
      }}>
      {isCPU && player?.characterAvatar ? (
        <img src={player.characterAvatar} alt={playerName}
          className="w-5 h-5 rounded object-cover shrink-0 border"
          style={{ borderColor: `${charColor}60` }} />
      ) : (
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: charColor }} />
      )}
      <div className="flex flex-col leading-none gap-0.5 min-w-0">
        <div className="text-[6px] tracking-widest uppercase truncate font-heading" style={{ color: charColor, maxWidth: 70 }}>
          {isMe ? 'YOU' : (playerName || `S${seatNumber}`)}
        </div>
        {!compact && (
          <div className="flex gap-1.5">
            <span className="text-[5px] text-white/40 uppercase" style={PS2}>{hasBid ? `B:${bid}` : '—'}</span>
            <span className="text-[5px] text-white/40 uppercase" style={PS2}>📚{books}</span>
          </div>
        )}
      </div>
      {isMyTurn && <div className="text-[5px] text-[#FFD700] animate-bounce" style={PS2}>▶</div>}
      {isJoinable && (
        <button
          onClick={isCPU ? onTakeOver : onSit}
          className="px-1 py-0.5 rounded border text-[5px] uppercase tracking-widest transition-all active:scale-95"
          style={{ borderColor: `${charColor}60`, color: charColor, ...PS2 }}>
          SIT
        </button>
      )}
    </div>
  );

  // ── Horizontal card backs fan (top seat) ─────────────────────
  const HorizontalBacks = () => {
    if (backCount === 0) return <div className="text-[6px] text-white/20 uppercase px-2 py-1" style={PS2}>No cards</div>;
    const avail = (maxWidth || 200) - 8; // small padding
    const { cardW, cardH, overlap } = fitCards(backCount, avail, 30, 43, 16, 0.6);
    const totalW = cardW + (backCount - 1) * (cardW - overlap);
    return (
      <div style={{ position: 'relative', width: totalW, height: cardH, flexShrink: 0 }}>
        {Array.from({ length: backCount }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: i * (cardW - overlap), top: 0,
            width: cardW, height: cardH, zIndex: i,
          }}>
            <img src={getCardBack()} alt="Card" className="w-full h-full rounded shadow-sm" style={{ objectFit: 'contain' }} />
          </div>
        ))}
      </div>
    );
  };

  // ── Vertical card backs stack (left/right seats) ──────────────
  const VerticalBacks = () => {
    if (backCount === 0) return <div className="text-[6px] text-white/20 uppercase" style={PS2}>—</div>;
    const avail = Math.max(60, (maxHeight || 160) - 32); // leave room for InfoStrip
    const { cardW, cardH, overlap } = fitCardsVertical(backCount, avail);
    const totalH = Math.min(avail, cardH + (backCount - 1) * (cardH - overlap));
    return (
      <div style={{ position: 'relative', width: cardW, height: totalH, flexShrink: 0, overflow: 'hidden' }}>
        {Array.from({ length: backCount }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: i * (cardH - overlap), left: 0,
            width: cardW, height: cardH, zIndex: i,
          }}>
            <img src={getCardBack()} alt="Card" className="w-full h-full rounded shadow-sm" style={{ objectFit: 'contain' }} />
          </div>
        ))}
      </div>
    );
  };

  // ── My face-up fanned hand ────────────────────────────────────
  const MyCards = () => {
    if (!hand || hand.length === 0) return null;
    const canPlay = isMyTurn && gs?.phase === 'playing';
    const count = hand.length;
    const avail = (maxWidth || 320) - 16;
    const { cardW, cardH, overlap } = fitCards(count, avail, 56, 78, 30, 0.62);
    const totalW = cardW + (count - 1) * (cardW - overlap);

    return (
      <>
        {/* Card preview overlay (mobile tap-to-preview) */}
        {previewCard && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
            onClick={() => setPreviewCard(null)}>
            <div className="flex flex-col items-center gap-3">
              <img
                src={getCardImage(previewCard)}
                alt={`${previewCard.suit}${previewCard.value}`}
                className="rounded-xl shadow-2xl"
                style={{ width: 120, height: 168, objectFit: 'contain' }}
              />
              {canPlay && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPlayCard?.(previewCard); setPreviewCard(null); }}
                  className="px-6 py-3 rounded-xl border-2 border-[#FFD700] text-[#FFD700] font-heading text-sm tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
                  style={PS2}>
                  PLAY THIS CARD
                </button>
              )}
              <div className="text-[7px] text-white/40 uppercase" style={PS2}>Tap outside to cancel</div>
            </div>
          </div>
        )}

        <div style={{ position: 'relative', width: totalW, height: cardH + 24, flexShrink: 0 }}>
          {hand.map((card, i) => {
            const isHovered = hoveredIdx === i;
            const liftY = isHovered ? -18 : 0;
            return (
              <div
                key={card.id || i}
                style={{
                  position: 'absolute',
                  left: i * (cardW - overlap),
                  bottom: 0,
                  width: cardW,
                  height: cardH,
                  zIndex: isHovered ? 50 : i,
                  transform: `translateY(${liftY}px)`,
                  transition: 'transform 0.15s ease, z-index 0s',
                  cursor: canPlay ? 'pointer' : 'default',
                  filter: canPlay ? (isHovered ? 'brightness(1.25) drop-shadow(0 0 8px #FFD700)' : 'brightness(1)') : 'brightness(0.8)',
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => {
                  if (!canPlay) return;
                  // On small screens, first tap previews; second tap plays
                  if (window.innerWidth < 640 && previewCard?.id !== card.id) {
                    setPreviewCard(card);
                  } else {
                    onPlayCard?.(card);
                    setPreviewCard(null);
                  }
                }}
              >
                <img
                  src={getCardImage(card)}
                  alt={`${card.suit}${card.value}`}
                  className="w-full h-full rounded-lg shadow-lg"
                  style={{ objectFit: 'contain' }}
                  onError={(e) => { e.target.src = getCardBack(); }}
                />
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ── Empty seat ────────────────────────────────────────────────
  if (!player) {
    if (isJoinable) {
      return (
        <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-col'} items-center gap-1`}>
          <div className="text-[5px] text-white/20 uppercase tracking-widest" style={PS2}>Seat {seatNumber}</div>
          <button onClick={onSit}
            className="px-2 py-1 rounded border border-[#4ade80]/40 text-[#4ade80] text-[5px] tracking-widest uppercase hover:bg-[#4ade80]/10 transition-all"
            style={PS2}>SIT</button>
        </div>
      );
    }
    return <div className="text-[5px] text-white/15 uppercase tracking-widest" style={PS2}>Seat {seatNumber}</div>;
  }

  const borderStyle = {
    border: `1px solid ${isMyTurn ? '#FFD70050' : charColor + '25'}`,
    borderRadius: 10,
    padding: '4px 6px',
    ...glowStyle,
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  // ── Bottom (human, face-up) ───────────────────────────────────
  if (position === 'bottom' && isMe) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', ...borderStyle, padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center' }}>
          <InfoStrip />
          {isMyTurn && (
            <div className="text-[5px] text-[#FFD700] uppercase tracking-widest animate-pulse" style={PS2}>
              ▶ TAP A CARD
            </div>
          )}
        </div>
        <MyCards />
      </div>
    );
  }

  // ── Top (opponent, horizontal backs) ─────────────────────────
  if (position === 'top') {
    return (
      <div style={{ ...borderStyle, flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <HorizontalBacks />
        <InfoStrip compact />
      </div>
    );
  }

  // ── Bottom but not me (spectating someone) ───────────────────
  if (position === 'bottom' && !isMe) {
    return (
      <div style={{ ...borderStyle, flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <InfoStrip compact />
        <HorizontalBacks />
      </div>
    );
  }

  // ── Left seat (seat 2) — fan cards horizontally, rotate whole thing 90° CW ──
  if (position === 'left') {
    const fanW = maxHeight || 160; // after rotation this becomes the height
    const avail = fanW - 8;
    const { cardW, cardH, overlap } = fitCards(backCount, avail - 28, 30, 43, 16, 0.65);
    const totalCardW = backCount > 0 ? cardW + (backCount - 1) * (cardW - overlap) : 0;
    // Inner div is horizontal (name + fan), we rotate it 90° CW so it reads top→bottom for left player
    return (
      <div style={{ position: 'relative', width: cardH + 28, height: fanW, overflow: 'visible' }}>
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(90deg)',
          transformOrigin: 'center center',
          width: fanW,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          ...borderStyle,
        }}>
          <InfoStrip compact />
          <div style={{ position: 'relative', width: totalCardW, height: cardH, flexShrink: 0 }}>
            {Array.from({ length: backCount }).map((_, i) => (
              <div key={i} style={{ position: 'absolute', left: i * (cardW - overlap), top: 0, width: cardW, height: cardH, zIndex: i }}>
                <img src={getCardBack()} alt="Card" className="w-full h-full rounded shadow-sm" style={{ objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Right seat (seat 4) — fan cards horizontally, rotate whole thing 90° CCW ──
  if (position === 'right') {
    const fanW = maxHeight || 160;
    const avail = fanW - 8;
    const { cardW, cardH, overlap } = fitCards(backCount, avail - 28, 30, 43, 16, 0.65);
    const totalCardW = backCount > 0 ? cardW + (backCount - 1) * (cardW - overlap) : 0;
    return (
      <div style={{ position: 'relative', width: cardH + 28, height: fanW, overflow: 'visible' }}>
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          width: fanW,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          ...borderStyle,
        }}>
          <InfoStrip compact />
          <div style={{ position: 'relative', width: totalCardW, height: cardH, flexShrink: 0 }}>
            {Array.from({ length: backCount }).map((_, i) => (
              <div key={i} style={{ position: 'absolute', left: i * (cardW - overlap), top: 0, width: cardW, height: cardH, zIndex: i }}>
                <img src={getCardBack()} alt="Card" className="w-full h-full rounded shadow-sm" style={{ objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}