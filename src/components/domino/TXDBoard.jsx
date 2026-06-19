import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

const W = 32;
const GAP = 3;

function Tile({ piece }) {
  const orientation = piece.placedOrientation
    || ((['top', 'bottom'].includes(piece.side) || piece.top === piece.bottom) ? 'vertical' : 'horizontal');
  return (
    <div style={{
      flexShrink: 0,
      filter: piece.isSpinner
        ? 'drop-shadow(0 0 8px rgba(0,255,120,0.9)) drop-shadow(0 0 12px rgba(255,95,31,0.7))'
        : undefined,
    }}>
      <TXDDomino
        top={piece.top}
        bottom={piece.bottom}
        width={W}
        orientation={orientation}
      />
    </div>
  );
}

function DropZone({ endId, value, horiz, isPlayable, dragging, selectedDomino, onDropOnEnd }) {
  const active = isPlayable || dragging;
  const zW = W * 2;
  const zH = horiz ? W : W * 2;
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
}

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
    setTimeout(() => { el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; }, 30);
  }, [board.length]);

  // ── Empty board ─────────────────────────────────────────────────────────────
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

  // ── Split board into arms — trust stored side, never reclassify ─────────────
  const firstPiece = board[0];
  const isFirstDouble = firstPiece?.top === firstPiece?.bottom;
  const hasSpinnerArms = isFirstDouble || spinnerActive;

  const leftArm   = board.filter(p => p.side === 'left');
  const rightArm  = board.filter(p => p.side === 'right');
  const topArm    = board.filter(p => p.side === 'top');
  const bottomArm = board.filter(p => p.side === 'bottom');

  const leftVal      = leftEnd  ?? firstPiece?.top;
  const rightVal     = rightEnd ?? firstPiece?.bottom;
  const spinVal      = firstPiece?.top;
  const topEndVal    = topArm.length    > 0 ? (topArm[topArm.length - 1].exposedValue    ?? spinVal) : spinVal;
  const bottomEndVal = bottomArm.length > 0 ? (bottomArm[bottomArm.length - 1].exposedValue ?? spinVal) : spinVal;

  const dzProps = (endId, value, horiz) => ({
    endId, value, horiz,
    isPlayable: playableEndIds.has(endId),
    dragging: !!draggingDominoId,
    selectedDomino,
    onDropOnEnd,
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP }}>

        {/* Top arm */}
        {hasSpinnerArms && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP }}>
            {onDropOnEnd && <DropZone {...dzProps('top', topEndVal, false)} />}
            {[...topArm].reverse().map((p) => <Tile key={p.id} piece={p} />)}
          </div>
        )}

        {/* Horizontal row: left zone → left arm → spinner → right arm → right zone */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex', flexDirection: 'row', alignItems: 'center', gap: GAP,
            overflowX: 'auto', overflowY: 'visible',
            maxWidth: '100%', padding: '4px 6px', boxSizing: 'border-box',
            scrollbarWidth: 'none',
          }}
        >
          {onDropOnEnd && <DropZone {...dzProps('left', leftVal, true)} />}
          {[...leftArm].reverse().map((p) => <Tile key={p.id} piece={p} />)}
          {firstPiece && <Tile piece={firstPiece} />}
          {rightArm.map((p) => <Tile key={p.id} piece={p} />)}
          {onDropOnEnd && <DropZone {...dzProps('right', rightVal, true)} />}
        </div>

        {/* Bottom arm */}
        {hasSpinnerArms && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: GAP }}>
            {bottomArm.map((p) => <Tile key={p.id} piece={p} />)}
            {onDropOnEnd && <DropZone {...dzProps('bottom', bottomEndVal, false)} />}
          </div>
        )}

      </div>
    </div>
  );
}