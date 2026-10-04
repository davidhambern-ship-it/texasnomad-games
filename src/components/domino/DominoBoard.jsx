import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import DominoTile from './DominoTile';
import coinImg from './assets/tn-coin.png';
import { layoutBoard, previewPlacement } from '@/lib/dominoEngine';

// Which way a tile slides in from, by the seat that played it (relative to the viewer)
const FROM = { bottom: [0, 1], left: [-1, 0], top: [0, -1], right: [1, 0] };

/**
 * DominoBoard — draws the played chain, auto-fitted to the felt.
 *  board      engine board (play order)
 *  ghostMoves [{ side, domino }] legal spots for the selected tile — shown as glowing ghosts, tap to play there
 *  onGhost    (side) => void
 *  seatPos    (seat) => 'bottom'|'left'|'top'|'right'  (for slide-in direction)
 *  hint       text shown on an empty board
 *  maxUnit    biggest tile size in px
 */
export default function DominoBoard({ board = [], ghostMoves = [], onGhost, seatPos, hint, maxUnit = 46, highlightN = null }) {
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The soft layout box follows the felt's shape: wide tables get long rows, phones get compact snakes
  const aspect = dims.w && dims.h ? dims.w / dims.h : 1.6;
  const halfH = 5.5, halfW = Math.max(5.5, Math.min(13, Math.round(halfH * aspect * 2) / 2));
  const box = useMemo(() => ({ halfW, halfH }), [halfW]);
  const layout = useMemo(() => layoutBoard(board, box), [board, box]);
  const ghosts = useMemo(() => ghostMoves.map(m => ({ side: m.side, tile: previewPlacement(board, m.domino, m.side, box) })), [ghostMoves, board, box]);

  // Fit everything (placed tiles + ghost previews) inside the felt
  let { minX, maxX, minY, maxY } = layout.bbox;
  for (const g of ghosts) { const r = g.tile.rect; minX = Math.min(minX, r.cx - r.w / 2); maxX = Math.max(maxX, r.cx + r.w / 2); minY = Math.min(minY, r.cy - r.h / 2); maxY = Math.max(maxY, r.cy + r.h / 2); }
  if (!board.length) { minX = -1; maxX = 1; minY = -1; maxY = 1; }
  const pad = 0.8;
  const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
  const W = dims.w || 600, H = dims.h || 400;
  const U = Math.max(12, Math.min(maxUnit, W / bw, H / bh));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const toPx = (r) => ({ left: W / 2 + (r.cx - cx - r.w / 2) * U, top: H / 2 + (r.cy - cy - r.h / 2) * U });
  const newestN = board.length ? board.length - 1 : -1;

  const renderTile = (t, extra = {}) => {
    const p = toPx(t.rect);
    const horizontal = t.rect.w > t.rect.h;
    // First half = left (horizontal) / top (vertical)
    const [h1, h2] = [...t.halves].sort((x, y) => (horizontal ? x.cx - y.cx : x.cy - y.cy));
    return { p, horizontal, a: h1.pip, b: h2.pip };
  };

  return (
    <div ref={ref} className="tnd-board">
      <img src={coinImg} alt="" className="tnd-coin" draggable={false} style={{ width: Math.min(W, H) * 0.42, height: Math.min(W, H) * 0.42 }} />
      {!board.length && !ghosts.length && hint && <div className="tnd-board-hint">{hint}</div>}

      {layout.tiles.map(t => {
        const { p, horizontal, a, b } = renderTile(t);
        const isNew = t.n === newestN;
        const from = FROM[(seatPos && t.seat != null && seatPos(t.seat)) || 'bottom'];
        return (
          <div key={t.id} className={`tnd-placed${isNew ? ' is-new' : ''}${highlightN === t.n ? ' is-last' : ''}`}
            style={{ left: p.left, top: p.top, '--fx': `${from[0] * Math.max(W, H) * 0.45}px`, '--fy': `${from[1] * Math.max(W, H) * 0.45}px` }}>
            <DominoTile a={a} b={b} unit={U} horizontal={horizontal} />
          </div>
        );
      })}

      {ghosts.map(g => {
        const { p, horizontal, a, b } = renderTile(g.tile);
        return (
          <div key={`ghost-${g.side}`} className="tnd-placed tnd-ghost-wrap" style={{ left: p.left, top: p.top }}>
            <DominoTile a={a} b={b} unit={U} horizontal={horizontal} ghost onClick={() => onGhost && onGhost(g.side)} title={`Play here (${g.side})`} />
          </div>
        );
      })}
    </div>
  );
}
