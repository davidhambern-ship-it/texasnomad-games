import React, { useLayoutEffect, useRef, useState } from 'react';

const ROWS = 'ABCDEFGHI';

/**
 * BSGrid — a 9×9 grid. `cell(i)` returns { cls, text, title } for each cell.
 *  ocean   blue water styling (enemy waters / fleets)
 *  axis    show A–I / 1–9 labels
 *  overlay extra absolutely-positioned nodes (e.g. sonar badges) given the cell size
 */
export default function BSGrid({ cell, onCell, ocean = false, mine = false, axis = false, overlay = null, className = '' }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const up = () => setW(el.clientWidth); up();
    const ro = new ResizeObserver(up); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fs = Math.max(10, (w / 9) * 0.62);
  const grid = (
    <div ref={ref} className={`bs-board${ocean ? ' bs-ocean' : ''}${mine ? ' mine' : ''} ${className}`} style={{ '--fs': `${fs}px`, position: 'relative' }}>
      {Array.from({ length: 81 }, (_, i) => {
        const c = cell(i) || {};
        const r = Math.floor(i / 9), col = i % 9;
        return (
          <div key={i} className={`bs-cell r${r} c${col} ${c.cls || ''}`} title={c.title || `${ROWS[r]}${col + 1}`}
            onClick={onCell ? () => onCell(i) : undefined} role={onCell ? 'button' : undefined} aria-label={`${ROWS[r]}${col + 1}${c.text ? ` ${c.text}` : ''}`}>
            {c.text || ''}
          </div>
        );
      })}
      {overlay && w > 0 && overlay(w / 9)}
    </div>
  );
  if (!axis) return grid;
  return (
    <div className="bs-axis">
      <span />
      <div className="top">{Array.from({ length: 9 }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
      <div className="left">{ROWS.split('').map(r => <span key={r}>{r}</span>)}</div>
      {grid}
    </div>
  );
}
