import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * STSceneView — shows a scene picture that you can pinch / scroll to zoom and drag to pan.
 * A quick tap reports normalized (0–1) image coordinates to onTap.
 *  src, width, height   the picture and its natural size
 *  markers   [{ key, shape, x, y, w, h, color, label }]   found objects (normalized box)
 *  hints     [{ key, cx, cy, r }]                          hint rings (r = fraction of width)
 *  ripples   [{ key, x, y, ok }]                           tap feedback
 *  onTap(x, y)
 *  zoomable  allow zoom & pan (phones). The big screen turns this off.
 */
export default function STSceneView({ src, width = 1600, height = 1000, markers = [], hints = [], ripples = [], onTap, zoomable = true, disabled = false, focus = null }) {
  const wrap = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [t, setT] = useState({ z: 1, x: 0, y: 0 });
  const tRef = useRef(t); tRef.current = t;
  const ptrs = useRef(new Map());
  const gesture = useRef(null);

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return undefined;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s0 = box.w && box.h ? Math.min(box.w / width, box.h / height) : 0;
  const clamp = useCallback((z, x, y) => {
    z = Math.max(1, Math.min(5, z));
    const dw = width * s0 * z, dh = height * s0 * z;
    x = dw <= box.w ? (box.w - dw) / 2 : Math.min(0, Math.max(box.w - dw, x));
    y = dh <= box.h ? (box.h - dh) / 2 : Math.min(0, Math.max(box.h - dh, y));
    return { z, x, y };
  }, [box.w, box.h, s0, width, height]);

  // re-centre when the box size changes
  useEffect(() => { setT(p => clamp(p.z, p.x, p.y)); }, [clamp]);

  const zoomAt = useCallback((factor, px, py) => {
    setT(p => {
      const z = Math.max(1, Math.min(5, p.z * factor));
      const k = z / p.z;
      return clamp(z, px - (px - p.x) * k, py - (py - p.y) * k);
    });
  }, [clamp]);

  // zoom to a point (e.g. a hint) — focus = {x,y} normalized
  useEffect(() => {
    if (!focus || !s0 || !zoomable) return;
    setT(() => {
      const z = 2.2, dw = width * s0 * z, dh = height * s0 * z;
      return clamp(z, box.w / 2 - focus.x * dw, box.h / 2 - focus.y * dh);
    });
  }, [focus?.k]); // eslint-disable-line react-hooks/exhaustive-deps

  // wheel zoom (needs a non-passive listener)
  useEffect(() => {
    const el = wrap.current; if (!el || !zoomable) return undefined;
    const onWheel = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, zoomable]);

  const local = (e) => { const r = wrap.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const down = (e) => {
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    try { wrap.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (ptrs.current.size === 1) gesture.current = { type: 'tap', sx: p.x, sy: p.y, t0: performance.now(), ox: tRef.current.x, oy: tRef.current.y };
    else if (ptrs.current.size === 2 && zoomable) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: tRef.current.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ox: tRef.current.x, oy: tRef.current.y };
    }
  };
  const move = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    const g = gesture.current; if (!g) return;
    if (g.type === 'tap' || g.type === 'pan') {
      const dx = p.x - g.sx, dy = p.y - g.sy;
      if (g.type === 'tap' && Math.hypot(dx, dy) > 9) g.type = 'pan';
      if (g.type === 'pan' && zoomable) setT(clamp(tRef.current.z, g.ox + dx, g.oy + dy));
    } else if (g.type === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = Math.max(1, Math.min(5, g.z0 * (d / (g.d0 || 1))));
      const k = z / g.z0;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      setT(clamp(z, mx - (g.mx - g.ox) * k, my - (g.my - g.oy) * k));
    }
  };
  const up = (e) => {
    const g = gesture.current;
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size === 0) {
      if (g && g.type === 'tap' && performance.now() - g.t0 < 600 && onTap && !disabled) {
        const { z, x, y } = tRef.current; const dw = width * s0 * z, dh = height * s0 * z;
        const nx = (g.sx - x) / dw, ny = (g.sy - y) / dh;
        if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) onTap(nx, ny);
      }
      gesture.current = null;
    } else if (g?.type === 'pinch') {
      const [a] = [...ptrs.current.values()];
      gesture.current = { type: 'pan', sx: a.x, sy: a.y, ox: tRef.current.x, oy: tRef.current.y };
    }
  };

  const dw = width * s0 * t.z, dh = height * s0 * t.z;
  const aspect = width / height;
  return (
    <div className={`st-view${zoomable ? ' zoomable' : ''}`} ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {s0 > 0 && (
        <div className="st-stage" style={{ width: dw, height: dh, transform: `translate(${t.x}px, ${t.y}px)` }}>
          <img src={src} alt="" draggable={false} />
          <svg className="st-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {hints.map(h => <ellipse key={h.key} className="st-hint" cx={h.cx} cy={h.cy} rx={h.r} ry={h.r * aspect} />)}
            {markers.map(m => (m.shape === 'ellipse'
              ? <ellipse key={m.key} className={`st-mark${m.reveal ? ' reveal' : ''}`} cx={m.x + m.w / 2} cy={m.y + m.h / 2} rx={m.w / 2 + 0.008} ry={m.h / 2 + 0.008 * aspect} style={{ stroke: m.color }} />
              : <rect key={m.key} className={`st-mark${m.reveal ? ' reveal' : ''}`} x={m.x - 0.006} y={m.y - 0.006 * aspect} width={m.w + 0.012} height={m.h + 0.012 * aspect} rx={0.01} ry={0.01 * aspect} style={{ stroke: m.color }} />))}
          </svg>
          {markers.filter(m => m.label).map(m => (
            <div key={`l-${m.key}`} className={`st-label${m.reveal ? ' reveal' : ''}`} style={{ left: (m.x + m.w / 2) * dw, top: m.y * dh, '--c': m.color }}>{m.label}</div>
          ))}
          {ripples.map(r => <div key={r.key} className={`st-ripple ${r.ok ? 'ok' : 'bad'}`} style={{ left: r.x * dw, top: r.y * dh }} />)}
        </div>
      )}
      {zoomable && (
        <div className="st-zoom" onPointerDown={e => e.stopPropagation()}>
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.5, box.w / 2, box.h / 2)}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.5, box.w / 2, box.h / 2)}>−</button>
          {t.z > 1.01 && <button type="button" aria-label="Fit" onClick={() => setT(clamp(1, 0, 0))}>⤢</button>}
        </div>
      )}
    </div>
  );
}
