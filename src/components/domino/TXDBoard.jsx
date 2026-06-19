import React, { useRef, useEffect, useState } from 'react';
import TXDDomino from './TXDDomino';

// ─────────────────────────────────────────────────────────────────────────────
// TXDBoard — renders the domino chain on a scrollable canvas
//
// Props:
//   board           array of board entries (from engine)
//   gameState       { leftEnd, rightEnd, topEnd, bottomEnd, spinnerPlayed }
//   selectedDomino  domino object currently selected from hand (or null)
//   playableEnds    Set of end IDs the selected domino can play on
//   onPlayEnd(side) called when user taps a drop zone (pass the side string)
//   interactive     boolean — show drop zones at all
// ─────────────────────────────────────────────────────────────────────────────

// Tile unit: W = narrow dimension of one half of a domino
const W = 36;   // px — each "cell" of the domino
const GAP = 6;  // gap between tiles

// A tile is 2W × W (horizontal) or W × 2W (vertical) using W as the base unit

function buildLayout(board) {
  if (!board || board.length === 0) return null;

  const tiles = [];

  // Cursors track where the NEXT tile attaches (the open edge pixel coordinate)
  // left: next tile's right edge x
  // right: next tile's left edge x
  // top: next tile's bottom edge y
  // bottom: next tile's top edge y
  let leftEdgeX  = 0;
  let rightEdgeX = 0;
  let topEdgeY   = 0;
  let botEdgeY   = 0;
  let spinnerCX  = 0; // center-x of the spinner tile

  board.forEach((piece, idx) => {
    const { orientation, side: rawSide } = piece;
    const side = idx === 0 ? 'first' : (rawSide || 'right');
    const isVert = orientation === 'vertical';

    // Tile pixel dimensions
    const tw = isVert ? W       : W * 2;
    const th = isVert ? W * 2   : W;

    let px, py;

    if (side === 'first') {
      px = -(tw / 2);
      py = -(th / 2);
      leftEdgeX  = px - GAP;
      rightEdgeX = px + tw + GAP;
      topEdgeY   = py - GAP;
      botEdgeY   = py + th + GAP;
      spinnerCX  = px + tw / 2;
    } else if (side === 'left') {
      px = leftEdgeX - tw;
      py = -(th / 2);
      leftEdgeX = px - GAP;
    } else if (side === 'right') {
      px = rightEdgeX;
      py = -(th / 2);
      rightEdgeX = px + tw + GAP;
    } else if (side === 'top') {
      px = spinnerCX - tw / 2;
      py = topEdgeY - th;
      topEdgeY = py - GAP;
    } else { // bottom
      px = spinnerCX - tw / 2;
      py = botEdgeY;
      botEdgeY = py + th + GAP;
    }

    tiles.push({ ...piece, _px: px, _py: py, _tw: tw, _th: th });
  });

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  tiles.forEach(t => {
    minX = Math.min(minX, t._px);
    minY = Math.min(minY, t._py);
    maxX = Math.max(maxX, t._px + t._tw);
    maxY = Math.max(maxY, t._py + t._th);
  });

  const PAD = W * 3;
  return {
    tiles,
    canvasW: maxX - minX + PAD * 2,
    canvasH: maxY - minY + PAD * 2,
    ox: -minX + PAD,
    oy: -minY + PAD,
    // Open edge positions (in virtual coords, before ox/oy offset)
    leftEdgeX,
    rightEdgeX,
    topEdgeY,
    botEdgeY,
    spinnerCX,
  };
}

export default function TXDBoard({
  board = [],
  gameState = {},
  selectedDomino = null,
  playableEnds = new Set(),
  onPlayEnd,
  interactive = false,
}) {
  const containerRef = useRef(null);

  const { leftEnd, rightEnd, topEnd, bottomEnd, spinnerPlayed } = gameState;
  const hasSpinnerArms = spinnerPlayed || (board[0] && board[0].top === board[0].bottom);

  // Drop zone size
  const DZ_H = { w: W * 2, h: W };     // horizontal drop zone
  const DZ_V = { w: W, h: W * 2 };     // vertical drop zone

  // ── Empty board ──────────────────────────────────────────────────────────
  if (board.length === 0) {
    const canPlay = interactive && !!onPlayEnd;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          onClick={canPlay ? () => onPlayEnd('first') : undefined}
          onDragOver={canPlay ? e => e.preventDefault() : undefined}
          onDrop={canPlay ? e => { e.preventDefault(); onPlayEnd('first'); } : undefined}
          style={{
            width: W * 2 + 20, height: W + 20, borderRadius: 10,
            border: canPlay ? '2px dashed rgba(0,255,120,0.8)' : '1px dashed rgba(255,255,255,0.15)',
            background: canPlay ? 'rgba(0,255,120,0.08)' : 'rgba(255,255,255,0.03)',
            boxShadow: canPlay ? '0 0 20px rgba(0,255,120,0.4)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canPlay ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 7, color: canPlay ? 'rgba(0,255,120,0.9)' : 'rgba(255,255,255,0.2)', fontFamily: "'Press Start 2P', monospace", letterSpacing: 1 }}>
            {canPlay ? 'PLAY FIRST TILE' : '— WAITING —'}
          </span>
        </div>
      </div>
    );
  }

  const layout = buildLayout(board);
  if (!layout) return null;

  const { tiles, canvasW, canvasH, ox, oy, leftEdgeX, rightEdgeX, topEdgeY, botEdgeY, spinnerCX } = layout;

  function DropZone({ side, value, style: dzStyle }) {
    const isActive = interactive && onPlayEnd && playableEnds.has(side);
    if (!interactive || !onPlayEnd) return null;
    return (
      <div
        onClick={isActive ? () => onPlayEnd(side) : undefined}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (isActive) onPlayEnd(side); }}
        style={{
          position: 'absolute',
          borderRadius: 8,
          border: isActive ? '2px dashed rgba(0,255,120,0.9)' : '1px dashed rgba(255,255,255,0.08)',
          background: isActive ? 'rgba(0,255,120,0.12)' : 'rgba(255,255,255,0.02)',
          boxShadow: isActive ? '0 0 16px rgba(0,255,120,0.5)' : 'none',
          cursor: isActive ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          zIndex: 2,
          ...dzStyle,
        }}
      >
        {isActive && (
          <span style={{ fontSize: 13, fontWeight: 'bold', color: 'rgba(0,255,120,0.9)', fontFamily: 'monospace' }}>
            {value ?? '?'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        overflow: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        scrollbarWidth: 'none',
      }}
    >
      <div style={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}>

        {/* Tiles */}
        {tiles.map((t) => (
          <div
            key={t.id}
            style={{
              position: 'absolute',
              left: ox + t._px,
              top: oy + t._py,
              zIndex: 1,
              filter: t.isSpinner
                ? 'drop-shadow(0 0 8px rgba(0,255,120,0.8)) drop-shadow(0 0 12px rgba(255,95,31,0.6))'
                : undefined,
            }}
          >
            <TXDDomino
              top={t.top}
              bottom={t.bottom}
              width={W}
              orientation={t.orientation || 'horizontal'}
            />
          </div>
        ))}

        {/* Drop zones */}
        <DropZone
          side="left"
          value={leftEnd}
          style={{ left: ox + leftEdgeX - DZ_H.w, top: oy - DZ_H.h / 2, width: DZ_H.w, height: DZ_H.h }}
        />
        <DropZone
          side="right"
          value={rightEnd}
          style={{ left: ox + rightEdgeX, top: oy - DZ_H.h / 2, width: DZ_H.w, height: DZ_H.h }}
        />
        {hasSpinnerArms && (
          <DropZone
            side="top"
            value={topEnd}
            style={{ left: ox + spinnerCX - DZ_V.w / 2, top: oy + topEdgeY - DZ_V.h, width: DZ_V.w, height: DZ_V.h }}
          />
        )}
        {hasSpinnerArms && (
          <DropZone
            side="bottom"
            value={bottomEnd}
            style={{ left: ox + spinnerCX - DZ_V.w / 2, top: oy + botEdgeY, width: DZ_V.w, height: DZ_V.h }}
          />
        )}

      </div>
    </div>
  );
}