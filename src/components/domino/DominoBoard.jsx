import React from 'react';
import DominoTile from './DominoTile';

// ─────────────────────────────────────────────────────────────────────────────
// DominoBoard — renders the chain of played tiles + open-end drop zones
//
// Props:
//   board          — array of board entries from engine
//   openEnds       — { left, right, top, bottom, hasSpinner } from getOpenEnds()
//   playableEnds   — Set of end strings the selected domino can play on
//   onEndClick(side) — called when player taps a valid drop zone
//   interactive    — show drop zones at all
// ─────────────────────────────────────────────────────────────────────────────

const U = 34;   // unit px (half-tile narrow dimension)
const GAP = 5;  // gap between tiles

function buildLayout(board) {
  if (!board || board.length === 0) return null;

  const tiles = [];
  // cursors: where the next open edge is, in virtual px (relative to canvas origin)
  let leftX  = 0; // right edge of leftmost tile
  let rightX = 0; // left edge of rightmost tile
  let topY   = 0; // bottom edge of topmost tile
  let botY   = 0; // top edge of bottommost tile
  let spinCX = 0; // center-x of spinner

  board.forEach((entry, idx) => {
    const isVert = entry.orientation === 'v';
    const tw = isVert ? U       : U * 2;
    const th = isVert ? U * 2   : U;
    let px, py;

    const side = idx === 0 ? 'first' : entry.side;

    if (side === 'first') {
      px = -(tw / 2); py = -(th / 2);
      leftX  = px - GAP;
      rightX = px + tw + GAP;
      topY   = py - GAP;
      botY   = py + th + GAP;
      spinCX = px + tw / 2;
    } else if (side === 'left') {
      px = leftX - tw; py = -(th / 2);
      leftX = px - GAP;
    } else if (side === 'right') {
      px = rightX; py = -(th / 2);
      rightX = px + tw + GAP;
    } else if (side === 'top') {
      px = spinCX - tw / 2; py = topY - th;
      topY = py - GAP;
    } else { // bottom
      px = spinCX - tw / 2; py = botY;
      botY = py + th + GAP;
    }

    tiles.push({ ...entry, _px: px, _py: py, _tw: tw, _th: th });
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  tiles.forEach(t => {
    minX = Math.min(minX, t._px); minY = Math.min(minY, t._py);
    maxX = Math.max(maxX, t._px + t._tw); maxY = Math.max(maxY, t._py + t._th);
  });

  const PAD = U * 3;
  return {
    tiles,
    cw: maxX - minX + PAD * 2,
    ch: maxY - minY + PAD * 2,
    ox: -minX + PAD,
    oy: -minY + PAD,
    leftX, rightX, topY, botY, spinCX,
  };
}

function DropZone({ side, value, active, style: s, onClick }) {
  if (!active && value === null) return null;
  const isActive = !!active;
  return (
    <div
      onClick={isActive ? onClick : undefined}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); if (isActive && onClick) onClick(); }}
      style={{
        position: 'absolute',
        borderRadius: 8,
        border: isActive ? '2px dashed rgba(0,255,120,0.9)' : '1px dashed rgba(255,255,255,0.07)',
        background: isActive ? 'rgba(0,255,120,0.12)' : 'transparent',
        boxShadow: isActive ? '0 0 14px rgba(0,255,120,0.5)' : 'none',
        cursor: isActive ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        zIndex: 2,
        ...s,
      }}
    >
      {isActive && value !== null && (
        <span style={{ fontSize: 14, fontWeight: 'bold', color: 'rgba(0,255,120,0.9)', fontFamily: 'monospace' }}>
          {value}
        </span>
      )}
    </div>
  );
}

export default function DominoBoard({ board = [], openEnds = {}, playableEnds = new Set(), onEndClick, interactive = false }) {
  // Empty board
  if (board.length === 0) {
    const canPlay = interactive && !!onEndClick;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          onClick={canPlay ? () => onEndClick('first') : undefined}
          style={{
            width: U * 2 + 20, height: U + 20, borderRadius: 10,
            border: canPlay ? '2px dashed rgba(0,255,120,0.8)' : '1px dashed rgba(255,255,255,0.12)',
            background: canPlay ? 'rgba(0,255,120,0.08)' : 'transparent',
            boxShadow: canPlay ? '0 0 18px rgba(0,255,120,0.3)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canPlay ? 'pointer' : 'default',
          }}
        >
          <span style={{ fontSize: 7, fontFamily: "'Press Start 2P',monospace", color: canPlay ? 'rgba(0,255,120,0.8)' : 'rgba(255,255,255,0.15)' }}>
            {canPlay ? 'PLAY FIRST TILE' : '— WAITING —'}
          </span>
        </div>
      </div>
    );
  }

  const layout = buildLayout(board);
  if (!layout) return null;
  const { tiles, cw, ch, ox, oy, leftX, rightX, topY, botY, spinCX } = layout;
  const dzH = { w: U * 2, h: U };
  const dzV = { w: U,     h: U * 2 };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', scrollbarWidth: 'none' }}>
      <div style={{ position: 'relative', width: cw, height: ch, flexShrink: 0 }}>

        {tiles.map(t => (
          <div key={t.id} style={{
            position: 'absolute', left: ox + t._px, top: oy + t._py, zIndex: 1,
            filter: t.isSpinner ? 'drop-shadow(0 0 8px rgba(0,255,120,0.7)) drop-shadow(0 0 12px rgba(255,160,20,0.5))' : undefined,
          }}>
            <DominoTile a={t.a} b={t.b} unit={U} vertical={t.orientation === 'v'} />
          </div>
        ))}

        {interactive && onEndClick && (
          <>
            <DropZone side="left"   value={openEnds.left}   active={playableEnds.has('left')}   onClick={() => onEndClick('left')}
              style={{ left: ox + leftX - dzH.w, top: oy - dzH.h / 2, width: dzH.w, height: dzH.h }} />
            <DropZone side="right"  value={openEnds.right}  active={playableEnds.has('right')}  onClick={() => onEndClick('right')}
              style={{ left: ox + rightX, top: oy - dzH.h / 2, width: dzH.w, height: dzH.h }} />
            {openEnds.hasSpinner && (
              <>
                <DropZone side="top"    value={openEnds.top}    active={playableEnds.has('top')}    onClick={() => onEndClick('top')}
                  style={{ left: ox + spinCX - dzV.w / 2, top: oy + topY - dzV.h, width: dzV.w, height: dzV.h }} />
                <DropZone side="bottom" value={openEnds.bottom} active={playableEnds.has('bottom')} onClick={() => onEndClick('bottom')}
                  style={{ left: ox + spinCX - dzV.w / 2, top: oy + botY, width: dzV.w, height: dzV.h }} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}