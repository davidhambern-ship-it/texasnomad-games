import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * WWRope — the timer: a rope fuse wrapped around the board that burns down
 * toward a powder keg at the top. `frac` is the share of time left (0–1).
 */
export default function WWRope({ frac = 1, lit = false, low = false }) {
  const wrap = useRef(null);
  const pathRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [len, setLen] = useState(0);
  const [pt, setPt] = useState(null);

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return undefined;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = box;
  const d = 11, r = 18, cx = w / 2;
  const path = w ? `M ${cx} ${d} H ${w - d - r} A ${r} ${r} 0 0 1 ${w - d} ${d + r} V ${h - d - r} A ${r} ${r} 0 0 1 ${w - d - r} ${h - d} H ${d + r} A ${r} ${r} 0 0 1 ${d} ${h - d - r} V ${d + r} A ${r} ${r} 0 0 1 ${d + r} ${d} H ${cx}` : '';

  useLayoutEffect(() => {
    const p = pathRef.current; if (!p || !w) return;
    const L = p.getTotalLength(); setLen(L);
    const f = Math.max(0, Math.min(1, frac));
    const q = p.getPointAtLength(Math.max(0.01, f * L));
    setPt({ x: q.x, y: q.y });
  }, [path, frac, w]);

  const f = Math.max(0, Math.min(1, frac));
  const left = f * len;
  const burntOut = f <= 0.0005;

  return (
    <div ref={wrap} className={`ww-rope${low ? ' low' : ''}${lit ? ' lit' : ''}`} aria-hidden="true">
      {w > 0 && (
        <svg width={w} height={h}>
          <defs>
            <linearGradient id="wwFlame" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ff3d00" /><stop offset=".45" stopColor="#ff9100" /><stop offset="1" stopColor="#ffe066" />
            </linearGradient>
            <radialGradient id="wwGlow"><stop offset="0" stopColor="#ffb347" stopOpacity=".85" /><stop offset="1" stopColor="#ff5f1f" stopOpacity="0" /></radialGradient>
          </defs>
          {/* scorch trail where the rope already burned */}
          <path d={path} className="char" />
          {/* the rope that's left */}
          <path ref={pathRef} d={path} className="rope" style={{ strokeDasharray: `${left} ${len + 20}` }} />
          <path d={path} className="twistA" mask="url(#wwRopeMask)" style={{ display: left > 0 ? undefined : 'none' }} />
          <path d={path} className="twistB" mask="url(#wwRopeMask)" style={{ display: left > 0 ? undefined : 'none' }} />
          <mask id="wwRopeMask"><path d={path} stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round" style={{ strokeDasharray: `${left} ${len + 20}` }} /></mask>
          {/* powder keg at the end of the fuse */}
          <g className={`keg${burntOut && lit ? ' boom' : ''}`} transform={`translate(${cx} ${d})`}>
            <ellipse cx="0" cy="0" rx="17" ry="13" fill="#6b3a12" stroke="#2a1405" strokeWidth="2" />
            <path d="M -15 -5 H 15 M -15 5 H 15" stroke="#c9a24a" strokeWidth="2.5" />
            <text x="0" y="3.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffd700" fontFamily="Teko, Impact, sans-serif">TNG</text>
          </g>
          {/* the flame riding the fuse */}
          {lit && !burntOut && pt && (
            <g className="flame" style={{ transform: `translate(${pt.x}px, ${pt.y}px)` }}>
              <circle r={low ? 30 : 22} fill="url(#wwGlow)" className="glow" />
              <g className="fl">
                <path d="M0,-20 C8,-9 10,0 0,6 C-10,0 -8,-9 0,-20Z" fill="url(#wwFlame)" />
                <path d="M0,-10 C4,-4 5,1 0,4 C-5,1 -4,-4 0,-10Z" fill="#fff6c2" />
              </g>
              {[0, 1, 2, 3, 4].map(i => <circle key={i} r="1.6" className={`spark s${i}`} fill="#ffd36b" />)}
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
