import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

const HALF = 28; // px — half-tile size; horizontal tile = HALF*2 wide, HALF tall

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
    // Center the scroll position so the chain is always in view
    setTimeout(() => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }, 0);
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

  // ── Normalize board entries (handle legacy records without `side`) ──────────
  // Reconstruct which side each tile belongs to by simulating the play chain.
  // We track the "open ends" as we replay each tile in order.
  const normalized = [];
  let curLeft = null;
  let curRight = null;
  let hasSpinner = false;

  board.forEach((p, i) => {
    if (i === 0) {
      // First tile — always 'first'
      const isDouble = p.top === p.bottom;
      curLeft = p.top;
      curRight = p.bottom;
      hasSpinner = isDouble;
      normalized.push({ ...p, side: p.side || 'first', isSpinner: isDouble });
      return;
    }

    // If side is already set and valid, trust it
    if (p.side && ['left', 'right', 'top', 'bottom'].includes(p.side)) {
      // Update the open ends
      const val = p.top === curLeft || p.bottom === curLeft ? 
        (p.top === curLeft ? p.bottom : p.top) : null;
      if (p.side === 'left' && val !== null) curLeft = val;
      if (p.side === 'right') curRight = p.top === curRight ? p.bottom : p.top;
      normalized.push({ ...p });
      return;
    }

    // Legacy: infer side from which end this tile connects to
    const fitsLeft  = p.top === curLeft  || p.bottom === curLeft;
    const fitsRight = p.top === curRight || p.bottom === curRight;

    let side;
    if (fitsLeft && fitsRight) {
      // Fits both — alternate based on index parity to spread the chain
      side = i % 2 === 1 ? 'right' : 'left';
    } else if (fitsLeft) {
      side = 'left';
    } else if (fitsRight) {
      side = 'right';
    } else {
      // Can't determine — use index parity
      side = i % 2 === 1 ? 'right' : 'left';
    }

    // Update open ends
    if (side === 'left') {
      curLeft = p.top === curLeft ? p.bottom : p.top;
    } else {
      curRight = p.top === curRight ? p.bottom : p.top;
    }

    normalized.push({ ...p, side });
  });

  // ── Split into arms ────────────────────────────────────────────────────────
  const firstPiece = normalized[0];
  const isFirstDouble = firstPiece?.top === firstPiece?.bottom;
  const showSpinnerArms = isFirstDouble || spinnerActive;

  const leftArm   = normalized.filter(p => p.side === 'left').reverse();  // visually: closest to center first
  const rightArm  = normalized.filter(p => p.side === 'right');
  const topArm    = normalized.filter(p => p.side === 'top').reverse();
  const bottomArm = normalized.filter(p => p.side === 'bottom');

  // ── Subcomponents ──────────────────────────────────────────────────────────
  const ChainTile = ({ piece, flip = false }) => {
    const isDouble = piece.top === piece.bottom;
    // Use stored placedOrientation if available, otherwise default by type
    const orientation = piece.placedOrientation || (isDouble ? 'vertical' : 'horizontal');
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

  const DropZone = ({ endId, value, vertical = false }) => {
    const isPlayable = playableEndIds.has(endId);
    const active = isPlayable || !!draggingDominoId;
    return (
      <div
        onDragOver={(e) => { if (active) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd(endId, id); }}
        onClick={() => { if (isPlayable && selectedDomino && onDropOnEnd) onDropOnEnd(endId, selectedDomino.id); }}
        style={{
          width: vertical ? HALF * 2 : HALF * 2,
          height: vertical ? HALF * 2 : HALF,
          borderRadius: 8, flexShrink: 0,
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', width: '100%', height: '100%', gap: 2,
      overflow: 'hidden',
    }}>

      {/* Top arm */}
      {showSpinnerArms && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {onDropOnEnd && <DropZone endId="top" value={topArm.length > 0 ? (topArm[0].exposedValue ?? firstPiece?.top) : firstPiece?.top} vertical />}
          {topArm.map((p, i) => <ChainTile key={p.id || i} piece={p} />)}
        </div>
      )}

      {/* Main horizontal chain */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          justifyContent: 'center',
          gap: 2, overflowX: 'auto', overflowY: 'visible',
          width: '100%', padding: '4px 8px', boxSizing: 'border-box',
          scrollbarWidth: 'none',
        }}
      >
        {/* Left drop zone */}
        {onDropOnEnd && <DropZone endId="left" value={leftEnd} />}

        {/* Left arm — tiles closest to center are last in the array, so reverse gives correct order */}
        {leftArm.map((p, i) => <ChainTile key={p.id || i} piece={p} flip />)}

        {/* First/spinner tile */}
        {firstPiece && <ChainTile piece={firstPiece} />}

        {/* Right arm */}
        {rightArm.map((p, i) => <ChainTile key={p.id || i} piece={p} />)}

        {/* Right drop zone */}
        {onDropOnEnd && <DropZone endId="right" value={rightEnd} />}
      </div>

      {/* Bottom arm */}
      {showSpinnerArms && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {bottomArm.map((p, i) => <ChainTile key={p.id || i} piece={p} />)}
          {onDropOnEnd && <DropZone endId="bottom" value={bottomArm.length > 0 ? (bottomArm[bottomArm.length - 1].exposedValue ?? firstPiece?.top) : firstPiece?.top} vertical />}
        </div>
      )}
    </div>
  );
}