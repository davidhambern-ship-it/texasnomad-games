import React, { useRef, useEffect } from 'react';
import TXDDomino from './TXDDomino';

const W = 32;   // narrow dim of a tile in px
const GAP = 4;  // gap between tiles

// Compute pixel layout for all tiles relative to a virtual origin
function buildLayout(board) {
  if (!board || board.length === 0) return { tiles: [], w: 0, h: 0, originX: 0, originY: 0 };

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
      placed.push({ ...piece, px, py, tw, th });
      lx = px - GAP;
      rx = px + tw + GAP;
      ty = py - GAP;
      by = py + th + GAP;
      spinX = px + tw / 2;
      return;
    }
    if (side === 'left') {
      const px = lx - tw;
      const py = -th / 2;
      placed.push({ ...piece, px, py, tw, th });
      lx = px - GAP;
      return;
    }
    if (side === 'right') {
      const px = rx;
      const py = -th / 2;
      placed.push({ ...piece, px, py, tw, th });
      rx = px + tw + GAP;
      return;
    }
    if (side === 'top') {
      const px = spinX - tw / 2;
      const py = ty - th;
      placed.push({ ...piece, px, py, tw, th });
      ty = py - GAP;
      return;
    }
    if (side === 'bottom') {
      const px = spinX - tw / 2;
      const py = by;
      placed.push({ ...piece, px, py, tw, th });
      by = py + th + GAP;
      return;
    }
    // fallback
    placed.push({ ...piece, px: 0, py: 0, tw, th });
  });

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach(t => {
    minX = Math.min(minX, t.px);
    minY = Math.min(minY, t.py);
    maxX = Math.max(maxX, t.px + t.tw);
    maxY = Math.max(maxY, t.py + t.th);
  });

  const PADDING = W * 2;
  const totalW = maxX - minX + PADDING * 2;
  const totalH = maxY - minY + PADDING * 2;
  const originX = -minX + PADDING;
  const originY = -minY + PADDING;

  return {
    tiles: placed,
    w: totalW,
    h: totalH,
    originX,
    originY,
    openEnds: { lx, rx, ty, by, spinX },
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
  const containerRef = useRef(null);

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
  const { tiles, w, h, originX, originY, openEnds: oe } = layout;

  const firstPiece = board[0];
  const isFirstDouble = firstPiece?.top === firstPiece?.bottom;
  const hasSpinnerArms = isFirstDouble || spinnerActive;

  // Drop zone sizes
  const DZ_HORIZ_W = W * 2, DZ_HORIZ_H = W;
  const DZ_VERT_W  = W * 2, DZ_VERT_H  = W * 2;

  const spinnerVal = firstPiece?.top ?? 0;
  const topLastPiece    = [...board].reverse().find(p => p.side === 'top');
  const bottomLastPiece = [...board].reverse().find(p => p.side === 'bottom');
  const topEndVal    = topLastPiece    ? (topLastPiece.exposedValue    ?? spinnerVal) : spinnerVal;
  const bottomEndVal = bottomLastPiece ? (bottomLastPiece.exposedValue ?? spinnerVal) : spinnerVal;

  function DropZone({ endId, value, px, py, dw, dh }) {
    const isPlayable = playableEndIds.has(endId);
    const active = isPlayable || !!draggingDominoId;
    return (
      <div
        onDragOver={active ? (e) => e.preventDefault() : undefined}
        onDrop={active ? (e) => { e.preventDefault(); const id = e.dataTransfer.getData('dominoId'); if (id && onDropOnEnd) onDropOnEnd(endId, id); } : undefined}
        onClick={isPlayable ? () => { if (selectedDomino && onDropOnEnd) onDropOnEnd(endId, selectedDomino.id); } : undefined}
        style={{
          position: 'absolute',
          left: originX + px,
          top: originY + py,
          width: dw,
          height: dh,
          borderRadius: 8,
          border: isPlayable ? '2px dashed #00ff78' : '1px dashed rgba(255,255,255,0.12)',
          background: isPlayable ? 'rgba(0,255,120,0.15)' : 'transparent',
          boxShadow: isPlayable ? '0 0 14px rgba(0,255,120,0.6)' : 'none',
          cursor: isPlayable ? 'pointer' : 'default',
          pointerEvents: active ? 'auto' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace', color: isPlayable ? '#00ff78' : 'rgba(255,255,255,0.2)' }}>
          {value ?? '?'}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative', scrollbarWidth: 'none' }}
    >
      {/* Virtual canvas — sized to fit all tiles */}
      <div style={{ position: 'relative', width: w, height: h, margin: 'auto' }}>

        {/* Render each tile at its fixed pixel position */}
        {tiles.map((t) => {
          const orientation = t.placedOrientation
            || ((['top', 'bottom'].includes(t.side) || t.top === t.bottom) ? 'vertical' : 'horizontal');
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: originX + t.px,
                top: originY + t.py,
                zIndex: 1,
                filter: t.isSpinner
                  ? 'drop-shadow(0 0 8px rgba(0,255,120,0.9)) drop-shadow(0 0 12px rgba(255,95,31,0.7))'
                  : undefined,
              }}
            >
              <TXDDomino top={t.top} bottom={t.bottom} width={W} orientation={orientation} />
            </div>
          );
        })}

        {/* Drop zones — only rendered when onDropOnEnd is provided */}
        {onDropOnEnd && oe && (
          <>
            {/* Left */}
            <DropZone endId="left" value={leftEnd ?? firstPiece?.top}
              px={oe.lx - DZ_HORIZ_W} py={-DZ_HORIZ_H / 2}
              dw={DZ_HORIZ_W} dh={DZ_HORIZ_H} />
            {/* Right */}
            <DropZone endId="right" value={rightEnd ?? firstPiece?.bottom}
              px={oe.rx} py={-DZ_HORIZ_H / 2}
              dw={DZ_HORIZ_W} dh={DZ_HORIZ_H} />
            {/* Top */}
            {hasSpinnerArms && (
              <DropZone endId="top" value={topEndVal}
                px={oe.spinX - DZ_VERT_W / 2} py={oe.ty - DZ_VERT_H}
                dw={DZ_VERT_W} dh={DZ_VERT_H} />
            )}
            {/* Bottom */}
            {hasSpinnerArms && (
              <DropZone endId="bottom" value={bottomEndVal}
                px={oe.spinX - DZ_VERT_W / 2} py={oe.by}
                dw={DZ_VERT_W} dh={DZ_VERT_H} />
            )}
          </>
        )}
      </div>
    </div>
  );
}