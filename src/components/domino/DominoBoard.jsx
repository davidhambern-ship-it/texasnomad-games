import React, { useRef, useState, useLayoutEffect } from 'react';
import DominoTile from './DominoTile';

// ─────────────────────────────────────────────────────────────────────────────
// DominoBoard — renders played tiles inside a FIXED, non-scrolling table.
// Coordinates (x,y in 0-100) map onto a square board layer centered in the
// table. Dominoes stay a fixed size; branches turn inward at the table edges.
// ─────────────────────────────────────────────────────────────────────────────

export default function DominoBoard({ board = [], openEnds = {}, playableEnds = new Set(), onEndClick, interactive = false }) {
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const update = () => {
      const r = ref.current.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Board layer is a square of side S = min(w,h), centered in the table.
  const S = Math.min(dims.w, dims.h) || 300;
  const offX = (dims.w - S) / 2;
  const offY = (dims.h - S) / 2;
  const unit = S * 0.045;   // domino narrow dimension (one half) in px
  const dz = S * 0.07;     // drop-zone size in px

  const px = (x, y) => ({ left: x / 100 * S + offX, top: y / 100 * S + offY });

  // ── Empty board ──
  if (board.length === 0) {
    const canPlay = interactive && !!onEndClick;
    const c = px(50, 50);
    return (
      <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <div
          onClick={canPlay ? () => onEndClick('first') : undefined}
          style={{
            position: 'absolute', left: c.left, top: c.top,
            width: dz, height: dz, transform: 'translate(-50%,-50%)',
            borderRadius: 8,
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

  const DropZone = ({ side, pos, value, active }) => {
    if (!pos) return null;
    const p = px(pos.x, pos.y);
    return (
      <div
        onClick={active ? () => onEndClick(side) : undefined}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (active && onEndClick) onEndClick(side); }}
        style={{
          position: 'absolute', left: p.left, top: p.top,
          width: dz, height: dz, transform: 'translate(-50%,-50%)',
          borderRadius: 8,
          border: active ? '2px dashed rgba(0,255,120,0.9)' : '1px dashed rgba(255,255,255,0.07)',
          background: active ? 'rgba(0,255,120,0.12)' : 'transparent',
          boxShadow: active ? '0 0 14px rgba(0,255,120,0.5)' : 'none',
          cursor: active ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', zIndex: 2,
        }}
      >
        {active && value !== null && value !== undefined && (
          <span style={{ fontSize: S * 0.04, fontWeight: 'bold', color: 'rgba(0,255,120,0.9)', fontFamily: 'monospace' }}>
            {value}
          </span>
        )}
      </div>
    );
  };

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {board.map(t => {
        const p = px(t.x ?? 50, t.y ?? 50);
        return (
          <div key={t.id} style={{
            position: 'absolute', left: p.left, top: p.top,
            transform: 'translate(-50%,-50%)',
            zIndex: 1,
          }}>
            <DominoTile
              a={t.flip ? t.b : t.a}
              b={t.flip ? t.a : t.b}
              unit={unit}
              vertical={t.orientation === 'v'}
            />
          </div>
        );
      })}

      {interactive && onEndClick && (
        <>
          <DropZone side="left"   pos={openEnds.leftPos}   value={openEnds.left}   active={playableEnds.has('left')} />
          <DropZone side="right"  pos={openEnds.rightPos}  value={openEnds.right}  active={playableEnds.has('right')} />
          {openEnds.hasSpinner && (
            <>
              <DropZone side="top"    pos={openEnds.topPos}    value={openEnds.top}    active={playableEnds.has('top')} />
              <DropZone side="bottom" pos={openEnds.bottomPos} value={openEnds.bottom} active={playableEnds.has('bottom')} />
            </>
          )}
        </>
      )}
    </div>
  );
}