import React, { useRef, useState } from 'react';

const R = 62; // stick travel in px

/**
 * On-screen controller for phones & tablets. Writes into `state` (a mutable
 * snapshot object) so the game loop can read it every frame without re-rendering.
 * Left half: a floating thumbstick that appears wherever your thumb lands.
 * Right side: LIGHT · HEAVY · JUMP · DODGE.
 */
export default function TouchPad({ state }) {
  const stick = useRef(null);
  const [knob, setKnob] = useState(null);
  const [down, setDown] = useState({});

  const onStickDown = (e) => {
    e.preventDefault();
    if (stick.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stick.current = { id: e.pointerId, bx: e.clientX, by: e.clientY };
    setKnob({ bx: e.clientX, by: e.clientY, kx: e.clientX, ky: e.clientY });
  };
  const onStickMove = (e) => {
    const s = stick.current; if (!s || s.id !== e.pointerId) return;
    let dx = e.clientX - s.bx, dy = e.clientY - s.by;
    const d = Math.hypot(dx, dy);
    // drag past the edge and the base follows your thumb
    if (d > R * 1.4) { const k = (d - R * 1.4) / d; s.bx += dx * k; s.by += dy * k; dx = e.clientX - s.bx; dy = e.clientY - s.by; }
    const dd = Math.min(R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    state.x = (Math.cos(a) * dd) / R; state.y = (Math.sin(a) * dd) / R;
    setKnob({ bx: s.bx, by: s.by, kx: s.bx + Math.cos(a) * dd, ky: s.by + Math.sin(a) * dd });
  };
  const onStickUp = (e) => {
    const s = stick.current; if (!s || s.id !== e.pointerId) return;
    stick.current = null; state.x = 0; state.y = 0; setKnob(null);
  };

  const btn = (k) => ({
    onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); state[k] = true; setDown(d => ({ ...d, [k]: true })); try { navigator.vibrate && navigator.vibrate(8); } catch { /* ignore */ } },
    onPointerUp: () => { state[k] = false; setDown(d => ({ ...d, [k]: false })); },
    onPointerCancel: () => { state[k] = false; setDown(d => ({ ...d, [k]: false })); },
    onLostPointerCapture: () => { state[k] = false; setDown(d => ({ ...d, [k]: false })); },
    onContextMenu: (e) => e.preventDefault(),
    className: `rr-btn rr-${k}${down[k] ? ' on' : ''}`,
  });

  return (
    <div className="rr-touch" onContextMenu={e => e.preventDefault()}>
      <div className="rr-stickzone" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp}>
        {knob ? (
          <>
            <div className="rr-stickbase" style={{ left: knob.bx, top: knob.by }} />
            <div className="rr-knob" style={{ left: knob.kx, top: knob.ky }} />
          </>
        ) : <div className="rr-stickhint">MOVE</div>}
      </div>
      <div className="rr-buttons">
        <div {...btn('heavy')}><b>HEAVY</b><small>smash · special</small></div>
        <div {...btn('dodge')}><b>DODGE</b><small>shield · roll</small></div>
        <div {...btn('light')}><b>LIGHT</b><small>attack</small></div>
        <div {...btn('jump')}><b>JUMP</b></div>
      </div>
    </div>
  );
}