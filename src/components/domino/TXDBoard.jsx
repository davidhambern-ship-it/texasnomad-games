import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

// Each domino half = 28px wide, so a horizontal tile = 56px wide, 28px tall
// A vertical (double) tile = 28px wide, 56px tall
const HALF = 28;

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

  // Keep the chain centered/scrolled into view when board grows
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [board.length]);

  // ── Empty board ──────────────────────────────────────────────────────────
  if (board.length === 0) {
    const canPlay = !!onDropOnEnd;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <div
          onDragOver={(e) => { if (canPlay) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd('first', id); }}
          onClick={() => { if (selectedDomino && onDropOnEnd) onDropOnEnd('first', selectedDomino.id); }}
          style={{
            width: 112, height: 56, borderRadius: 10,
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

  // ── Build the chain ──────────────────────────────────────────────────────
  // We split the board into 4 arms: left[], center (first tile), right[]
  // top[] and bottom[] hang off the spinner (first double)
  const firstPiece = board[0];
  const isFirstDouble = firstPiece && firstPiece.top === firstPiece.bottom;

  const leftArm  = board.filter(p => p.side === 'left').reverse();  // rendered right-to-left
  const rightArm = board.filter(p => p.side === 'right');
  const topArm   = board.filter(p => p.side === 'top').reverse();   // rendered bottom-to-top
  const bottomArm= board.filter(p => p.side === 'bottom');

  // Drop zone component
  const DropZone = ({ endId, value, vertical = false }) => {
    const isPlayable = playableEndIds.has(endId);
    const active = isPlayable || !!draggingDominoId;
    const w = vertical ? HALF * 2 : HALF * 2;
    const h = vertical ? HALF * 2 : HALF;
    return (
      <div
        onDragOver={(e) => { if (active) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd(endId, id); }}
        onClick={() => { if (isPlayable && selectedDomino && onDropOnEnd) onDropOnEnd(endId, selectedDomino.id); }}
        style={{
          width: w, height: h, borderRadius: 8, flexShrink: 0,
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

  // Render a single domino tile in the chain
  const ChainTile = ({ piece, flip = false }) => {
    const isDouble = piece.top === piece.bottom;
    const orientation = isDouble ? 'vertical' : 'horizontal';
    return (
      <div style={{
        flexShrink: 0,
        filter: piece.isSpinner
          ? 'drop-shadow(0 0 8px rgba(0,255,120,0.9)) drop-shadow(0 0 12px rgba(255,95,31,0.7))'
          : undefined,
      }}>
        <TXDDomino
          top={flip ? piece.bottom : piece.top}
          bottom={flip ? piece.top : piece.bottom}
          width={HALF}
          orientation={orientation}
        />
      </div>
    );
  };

  // The horizontal chain: [left arm reversed] [first tile] [right arm]
  // Wrapped in a scrollable container
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 4 }}>

      {/* Top arm (vertical, above spinner) */}
      {(isFirstDouble || spinnerActive) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {onDropOnEnd && <DropZone endId="top" value={topArm.length > 0 ? topArm[0].exposedValue : firstPiece?.top} vertical />}
          {topArm.map((p, i) => <ChainTile key={p.id || i} piece={p} />)}
        </div>
      )}

      {/* Main horizontal row */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: 2, overflowX: 'auto', overflowY: 'visible',
          maxWidth: '100%', padding: '8px 12px',
          scrollbarWidth: 'none',
        }}
      >
        {/* Left drop zone */}
        {onDropOnEnd && <DropZone endId="left" value={leftEnd} />}

        {/* Left arm — tiles grow outward from center so we show them reversed */}
        {leftArm.map((p, i) => <ChainTile key={p.id || i} piece={p} flip />)}

        {/* Center / first tile */}
        <ChainTile piece={firstPiece} />

        {/* Right arm */}
        {rightArm.map((p, i) => <ChainTile key={p.id || i} piece={p} />)}

        {/* Right drop zone */}
        {onDropOnEnd && <DropZone endId="right" value={rightEnd} />}
      </div>

      {/* Bottom arm (vertical, below spinner) */}
      {(isFirstDouble || spinnerActive) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {bottomArm.map((p, i) => <ChainTile key={p.id || i} piece={p} />)}
          {onDropOnEnd && <DropZone endId="bottom" value={bottomArm.length > 0 ? bottomArm[bottomArm.length - 1].exposedValue : firstPiece?.top} vertical />}
        </div>
      )}
    </div>
  );
}