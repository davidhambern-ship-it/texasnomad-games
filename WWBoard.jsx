import React, { useLayoutEffect, useRef, useState } from 'react';
import WWIcon, { GemFace, GEMS } from './WWIcons';
import { LETTER_VALUES, tileText, isAdjacent } from '@/lib/wordWranglerEngine';

/**
 * WWBoard — the letter grid. Drag through tiles to trace a word (release to play),
 * or tap tiles one by one and tap the last tile again to play.
 *  state      engine state
 *  path       [[r,c],...] current trace
 *  onPath     (path) => void
 *  onSubmit   (path) => void
 *  status     'valid' | 'bad' | null   (colour of the current trace)
 *  freshIds   Set of tile ids that just fell in (animate the drop)
 *  popped     [{id, r, c, text, s}] tiles that were just used (pop animation)
 *  hintPath   path to highlight (Opal hint)
 *  shakeKey   change to shake the board
 */
export default function WWBoard({ state, path, onPath, onSubmit, status, freshIds, popped = [], hintPath = null, shakeKey = 0, disabled = false }) {
  const wrap = useRef(null);
  const [W, setW] = useState(0);
  const drag = useRef(null);
  const N = state.size;

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cell = W / N;
  const inPath = (r, c) => path.findIndex(p => p[0] === r && p[1] === c);

  // Which tile is under the pointer? (forgiving centre hit-test so diagonals are easy)
  const hit = (e, strict) => {
    const rect = wrap.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const c = Math.floor(x / cell), r = Math.floor(y / cell);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    if (strict) {
      const dx = x - (c + 0.5) * cell, dy = y - (r + 0.5) * cell;
      if (Math.hypot(dx, dy) > cell * 0.44) return null;
    }
    return [r, c];
  };

  const down = (e) => {
    if (disabled || !cell) return;
    const X = hit(e, false); if (!X) return;
    e.preventDefault();
    try { wrap.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const last = path[path.length - 1];
    let next, mode;
    if (last && last[0] === X[0] && last[1] === X[1]) { next = path; mode = 'again'; }
    else if (last && isAdjacent(last, X) && inPath(X[0], X[1]) < 0) { next = [...path, X]; mode = 'extend'; }
    else if (inPath(X[0], X[1]) >= 0) { next = path.slice(0, inPath(X[0], X[1]) + 1); mode = 'trim'; }
    else { next = [X]; mode = 'new'; }
    drag.current = { mode, moved: false, path: next };
    if (next !== path) onPath(next);
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const Y = hit(e, true); if (!Y) return;
    const p = d.path, last = p[p.length - 1];
    if (last[0] === Y[0] && last[1] === Y[1]) return;
    const prev = p[p.length - 2];
    let next = null;
    if (prev && prev[0] === Y[0] && prev[1] === Y[1]) next = p.slice(0, -1);
    else if (isAdjacent(last, Y) && !p.some(q => q[0] === Y[0] && q[1] === Y[1])) next = [...p, Y];
    if (next) { d.moved = true; d.path = next; onPath(next); }
  };
  const up = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (d.moved) { if (d.path.length >= 2) onSubmit(d.path); return; }
    if (d.mode === 'again' && d.path.length >= 2) onSubmit(d.path);
  };

  const pts = path.map(([r, c]) => `${(c + 0.5) * cell},${(r + 0.5) * cell}`).join(' ');
  const tiles = [];
  state.board.forEach((row, r) => row.forEach((t, c) => { if (t) tiles.push({ t, r, c }); }));
  const hintSet = new Set((hintPath || []).map(([r, c]) => r * 32 + c));
  const fs = Math.max(14, cell * 0.46);

  return (
    <div className={`ww-board${shakeKey ? ' shake-' + (shakeKey % 2) : ''}${disabled ? ' is-off' : ''}`}
      ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ '--cell': `${cell}px`, '--fs': `${fs}px` }} role="grid" aria-label="Letter board">
      {cell > 0 && tiles.map(({ t, r, c }) => {
        const i = inPath(r, c);
        const fresh = freshIds && freshIds.has(t.id);
        const cls = ['ww-tile', t.s ? `sp-${t.s}` : '', i >= 0 ? 'on' : '', i >= 0 && status ? `st-${status}` : '', hintSet.has(r * 32 + c) ? 'hint' : '', fresh ? 'fresh' : ''].filter(Boolean).join(' ');
        const val = LETTER_VALUES[t.l];
        return (
          <div key={t.id} className={cls} role="gridcell" aria-label={`${tileText(t)}${t.s ? ' ' + t.s : ''}`}
            style={{ transform: `translate(${c * cell}px, ${r * cell}px)`, '--fall': `${-(r + 1.5) * cell}px`, '--x': `${c * cell}px`, '--y': `${r * cell}px`, '--delay': `${(N - r) * 18 + c * 6}ms` }}>
            <div className="face">
              {GEMS[t.s] && <GemFace kind={t.s} />}
              {GEMS[t.s] && <i className="glint" />}
              <span className="ltr">{tileText(t)}</span>
              {t.l !== '*' && <span className="val">{val}</span>}
              {t.s === 'outlaw' && <span className="ico"><WWIcon kind="outlaw" size={Math.max(12, cell * 0.5)} /></span>}
            </div>
          </div>
        );
      })}
      {cell > 0 && popped.map(p => (
        <div key={`pop-${p.id}`} className={`ww-tile popped${p.s ? ' sp-' + p.s : ''}`} style={{ transform: `translate(${p.c * cell}px, ${p.r * cell}px)` }}>
          <div className="face">{GEMS[p.s] && <GemFace kind={p.s} />}<span className="ltr">{p.text}</span></div>
        </div>
      ))}
      {path.length > 1 && cell > 0 && (
        <svg className={`ww-trace${status ? ' st-' + status : ''}`} width={W} height={W} aria-hidden="true">
          <polyline points={pts} />
        </svg>
      )}
    </div>
  );
}
