import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

// Tile dimensions on the board
const W = 32;  // narrow dimension in px
const GAP = 3; // gap between tiles

export default function TXDBoard({
  board = [],
  leftEnd = null,
  rightEnd = null,
  spinnerActive = false,
  selectedDomino = null,
  playableEndIds = new Set(),
  onDropOnEnd,
  draggingDominoId = null,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setTimeout(() => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }, 30);
  }, [board.length]);

  // ── Empty board ────────────────────────────────────────────────────────────
  if (board.length === 0) {
    const canPlay = !!onDropOnEnd;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <div
          onDragOver={(e) => { if (canPlay) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd('first', id); }}
          onClick={() => { if (selectedDomino && onDropOnEnd) onDropOnEnd('first', selectedDomino.id); }}
          style={{
            width: W * 2 + 16, height: W + 16, borderRadius: 10,
            border: canPlay ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.15)',
            background: canPlay ? 'rgba(0,255,120,0.1)' : 'rgba(255,255,255,0.03)',
            boxShadow: canPlay ? '0 0 18px rgba(0,255,120,0.5)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canPlay ? 'pointer' : 'default',
          }}
        >
          <span style={{ fontSize: 8, color: canPlay ? '#00ff78' : 'rgba(255,255,255,0.2)', fontFamily: "'Press Start 2P', monospace" }}>
            {canPlay ? 'PLAY HERE' : '— empty —'}
          </span>
        </div>
      </div>
    );
  }

  // ── Reconstruct arms from board ─────────────────────────────────────────────
  // Normalize side assignments (handle legacy records without `side`)
  const normalized = [];
  let curLeft = null;
  let curRight = null;

  board.forEach((p, i) => {
    if (i === 0) {
      curLeft  = p.orientedTop    ?? p.top;
      curRight = p.orientedBottom ?? p.bottom;
      normalized.push({ ...p, side: 'first' });
      return;
    }
    if (p.side && ['left','right','top','bottom'].includes(p.side)) {
      // Trust stored side, update open ends
      const connectVal = p.top === curLeft || p.top === curRight ? p.top : p.bottom;
      const exposedVal = connectVal === p.top ? p.bottom : p.top;
      if (p.side === 'left')   curLeft  = p.exposedValue ?? exposedVal;
      if (p.side === 'right')  curRight = p.exposedValue ?? exposedVal;
      normalized.push({ ...p });
      return;
    }
    // Legacy inference
    const fitsLeft  = p.top === curLeft  || p.bottom === curLeft;
    const fitsRight = p.top === curRight || p.bottom === curRight;
    let side = fitsLeft ? 'left' : fitsRight ? 'right' : (i % 2 === 1 ? 'right' : 'left');
    if (fitsLeft && fitsRight) side = i % 2 === 1 ? 'right' : 'left';
    if (side === 'left')  curLeft  = p.top === curLeft  ? p.bottom : p.top;
    if (side === 'right') curRight = p.top === curRight ? p.bottom : p.top;
    normalized.push({ ...p, side });
  });

  const firstPiece = normalized[0];
  const isFirstDouble = firstPiece?.top === firstPiece?.bottom;
  const hasSpinnerArms = isFirstDouble || spinnerActive;

  const leftArm   = normalized.filter(p => p.side === 'left');   // stored outermost-last
  const rightArm  = normalized.filter(p => p.side === 'right');
  const topArm    = normalized.filter(p => p.side === 'top');
  const bottomArm = normalized.filter(p => p.side === 'bottom');

  // Open end values
  const leftVal   = leftEnd   ?? firstPiece?.top;
  const rightVal  = rightEnd  ?? firstPiece?.bottom;
  const spinVal   = firstPiece?.top; // spinner always shows the double's value on top/bottom

  const topEndVal    = topArm.length    > 0 ? (topArm[topArm.length-1].exposedValue    ?? spinVal) : spinVal;
  const bottomEndVal = bottomArm.length > 0 ? (bottomArm[bottomArm.length-1].exposedValue ?? spinVal) : spinVal;

  // ── Subcomponents ──────────────────────────────────────────────────────────
  const Tile = ({ piece, flip = false }) => {
    const orientation = piece.placedOrientation || (piece.top === piece.bottom ? 'vertical' : 'horizontal');
    return (
      <div style={{
        flexShrink: 0,
        filter: piece.isSpinner
          ? 'drop-shadow(0 0 8px rgba(0,255,120,0.9)) drop-shadow(0 0 12px rgba(255,95,31,0.7))'
          : undefined,
      }}>
        <TXDDomino
          top={flip ? piece.bottom : piece.top}
          bottom={flip ? piece.top  : piece.bottom}
          width={W}
          orientation={orientation}
        />
      </div>
    );
  };

  const DropZone = ({ endId, value, horiz = false }) => {
    const isPlayable = playableEndIds.has(endId);
    const active = isPlayable || !!draggingDominoId;
    // horiz=true → zone is placed in the horizontal row (left/right ends)
    // horiz=false → zone is placed in vertical column (top/bottom ends)
    const zW = horiz ? W * 2 : W * 2;
    const zH = horiz ? W     : W * 2;
    return (
      <div
        onDragOver={(e) => { if (active) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd(endId, id); }}
        onClick={() => { if (isPlayable && selectedDomino && onDropOnEnd) onDropOnEnd(endId, selectedDomino.id); }}
        style={{
          width: zW, height: zH, flexShrink: 0, borderRadius: 8,
          border: isPlayable ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.12)',
          background: isPlayable ? 'rgba(0,255,120,0.15)' : 'transparent',
          boxShadow: isPlayable ? '0 0 14px rgba(0,255,120,0.6)' : 'none',
          cursor: isPlayable ? 'pointer' : 'default',
          pointerEvents: active ? 'auto' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace', color: isPlayable ? '#00ff78' : 'rgba(255,255,255,0.2)' }}>
          {value ?? '?'}
        </span>
      </div>
    );
  };

  // ── Render — cross layout centered in the table ────────────────────────────
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP }}>

        {/* Top arm + drop zone (only if spinner active) */}
        {hasSpinnerArms && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP }}>
            {onDropOnEnd && <DropZone endId="top" value={topEndVal} horiz={false} />}
            {/* Top arm tiles — first played is closest to spinner, render reversed */}
            {[...topArm].reverse().map((p, i) => <Tile key={p.id || i} piece={p} />)}
          </div>
        )}

        {/* Horizontal row: left drop zone → left arm → spinner → right arm → right drop zone */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex', flexDirection: 'row', alignItems: 'center', gap: GAP,
            overflowX: 'auto', overflowY: 'visible',
            maxWidth: '100%', padding: '4px 6px', boxSizing: 'border-box',
            scrollbarWidth: 'none',
          }}
        >
          {/* Left drop zone */}
          {onDropOnEnd && <DropZone endId="left" value={leftVal} horiz />}

          {/* Left arm — outermost tile first (leftArm[0] is oldest/outermost) */}
          {[...leftArm].reverse().map((p, i) => <Tile key={p.id || i} piece={p} flip />)}

          {/* Spinner / first tile */}
          {firstPiece && <Tile piece={firstPiece} />}

          {/* Right arm */}
          {rightArm.map((p, i) => <Tile key={p.id || i} piece={p} />)}

          {/* Right drop zone */}
          {onDropOnEnd && <DropZone endId="right" value={rightVal} horiz />}
        </div>

        {/* Bottom arm + drop zone */}
        {hasSpinnerArms && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP }}>
            {bottomArm.map((p, i) => <Tile key={p.id || i} piece={p} />)}
            {onDropOnEnd && <DropZone endId="bottom" value={bottomEndVal} horiz={false} />}
          </div>
        )}

      </div>
    </div>
  );
}