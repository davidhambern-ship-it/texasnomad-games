import React from 'react';
import TXDDomino from './TXDDomino';

const W = 32;  // narrow tile dimension px
const GAP = 4;

function buildLayout(board) {
  const placed = [];
  let lx = 0, rx = 0, ty = 0, by = 0, spinX = 0;

  board.forEach((piece, idx) => {
    const side = idx === 0 ? 'first' : (piece.side || 'right');
    const isDouble = piece.top === piece.bottom;
    const tw = isDouble ? W : W * 2;
    const th = isDouble ? W * 2 : W;

    if (side === 'first') {
      const px = -tw / 2;
      const py = -th / 2;
      placed.push({ ...piece, _px: px, _py: py, _tw: tw, _th: th });
      lx = px - GAP; rx = px + tw + GAP;
      ty = py - GAP; by = py + th + GAP;
      spinX = px + tw / 2;
    } else if (side === 'left') {
      const px = lx - tw;
      placed.push({ ...piece, _px: px, _py: -th / 2, _tw: tw, _th: th });
      lx = px - GAP;
    } else if (side === 'right') {
      placed.push({ ...piece, _px: rx, _py: -th / 2, _tw: tw, _th: th });
      rx = rx + tw + GAP;
    } else if (side === 'top') {
      const py = ty - th;
      placed.push({ ...piece, _px: spinX - tw / 2, _py: py, _tw: tw, _th: th });
      ty = py - GAP;
    } else if (side === 'bottom') {
      placed.push({ ...piece, _px: spinX - tw / 2, _py: by, _tw: tw, _th: th });
      by = by + th + GAP;
    } else {
      placed.push({ ...piece, _px: 0, _py: 0, _tw: tw, _th: th });
    }
  });

  if (placed.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach(t => {
    minX = Math.min(minX, t._px); minY = Math.min(minY, t._py);
    maxX = Math.max(maxX, t._px + t._tw); maxY = Math.max(maxY, t._py + t._th);
  });

  const PAD = W * 2;
  return {
    placed,
    canvasW: maxX - minX + PAD * 2,
    canvasH: maxY - minY + PAD * 2,
    ox: -minX + PAD,  // origin offset x
    oy: -minY + PAD,  // origin offset y
    lx, rx, ty, by, spinX,
  };
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
  // Empty board
  if (board.length === 0) {
    const canPlay = !!onDropOnEnd;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <div
          onDragOver={canPlay ? (e) => e.preventDefault() : undefined}
          onDrop={canPlay ? (e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id) onDropOnEnd('first', id); } : undefined}
          onClick={canPlay ? () => { if (selectedDomino) onDropOnEnd('first', selectedDomino.id); } : undefined}
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

  const layout = buildLayout(board);
  if (!layout) return null;

  const { placed, canvasW, canvasH, ox, oy, lx, rx, ty, by, spinX } = layout;

  const firstPiece = board[0];
  const isFirstDouble = firstPiece && firstPiece.top === firstPiece.bottom;
  const hasSpinnerArms = isFirstDouble || spinnerActive;
  const spinnerVal = firstPiece ? firstPiece.top : 0;

  const topLast    = [...board].reverse().find(p => p.side === 'top');
  const bottomLast = [...board].reverse().find(p => p.side === 'bottom');
  const topEndVal    = topLast    ? (topLast.exposedValue    ?? spinnerVal) : spinnerVal;
  const bottomEndVal = bottomLast ? (bottomLast.exposedValue ?? spinnerVal) : spinnerVal;

  const DZH = { w: W * 2, h: W };       // horizontal drop zone size
  const DZV = { w: W * 2, h: W * 2 };   // vertical drop zone size

  function renderDropZone(endId, value, px, py, dw, dh) {
    const isPlayable = playableEndIds.has(endId);
    const active = isPlayable || !!draggingDominoId;
    if (!active && !isPlayable) return null;
    return (
      <div
        key={'dz-' + endId}
        onDragOver={active ? (e) => e.preventDefault() : undefined}
        onDrop={active ? (e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd(endId, id); } : undefined}
        onClick={isPlayable ? () => { if (selectedDomino && onDropOnEnd) onDropOnEnd(endId, selectedDomino.id); } : undefined}
        style={{
          position: 'absolute',
          left: ox + px,
          top: oy + py,
          width: dw,
          height: dh,
          borderRadius: 8,
          border: isPlayable ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.08)',
          background: isPlayable ? 'rgba(0,255,120,0.15)' : 'transparent',
          boxShadow: isPlayable ? '0 0 14px rgba(0,255,120,0.6)' : 'none',
          cursor: isPlayable ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace', color: isPlayable ? '#00ff78' : 'rgba(255,255,255,0.15)' }}>
          {value ?? '?'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', scrollbarWidth: 'none' }}>
      <div style={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}>

        {placed.map((t) => {
          const orientation = t.placedOrientation
            || ((t.side === 'top' || t.side === 'bottom' || t.top === t.bottom) ? 'vertical' : 'horizontal');
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: ox + t._px,
                top: oy + t._py,
                zIndex: 1,
                filter: t.isSpinner ? 'drop-shadow(0 0 8px rgba(0,255,120,0.9)) drop-shadow(0 0 12px rgba(255,95,31,0.7))' : undefined,
              }}
            >
              <TXDDomino top={t.top} bottom={t.bottom} width={W} orientation={orientation} />
            </div>
          );
        })}

        {onDropOnEnd && renderDropZone('left',   leftEnd  ?? firstPiece?.top,   lx - DZH.w,         -DZH.h / 2, DZH.w, DZH.h)}
        {onDropOnEnd && renderDropZone('right',  rightEnd ?? firstPiece?.bottom, rx,                 -DZH.h / 2, DZH.w, DZH.h)}
        {onDropOnEnd && hasSpinnerArms && renderDropZone('top',    topEndVal,    spinX - DZV.w / 2, ty - DZV.h, DZV.w, DZV.h)}
        {onDropOnEnd && hasSpinnerArms && renderDropZone('bottom', bottomEndVal, spinX - DZV.w / 2, by,         DZV.w, DZV.h)}

      </div>
    </div>
  );
}