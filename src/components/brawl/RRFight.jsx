import React, { useEffect, useRef, useState } from 'react';
import { createMatch, step, STAGE_LIST } from '@/lib/brawl/engine';
import { createRenderer, pctColor } from './draw';
import { createKeyboard, readGamepad, merge, touchState } from './input';
import TouchPad from './TouchPad';
import { rrSfx } from './rrSfx';

const STEP = 1000 / 60;
export const SLOT_COLORS = ['#ff5f6d', '#3ec5ff', '#ffd23f', '#3ef08a', '#c77dff', '#ff9f1c', '#f15bb5', '#e5e7eb'];
const isTouch = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

/**
 * One match. players: [{ id, fighter, name, cpu, pad, you, color }]
 * `you` = driven by this device (keyboard + touch + gamepad 0); `pad` = another gamepad index;
 * `remote` = a phone controller in party mode (read through the `remote` prop).
 * Party mode: onStatus(status) gets ~4 updates a second for the phones; onResult(result) at the end.
 */
export default function RRFight({ players, stocks = 3, stage = 'mesa', onExit, onSetup, remote = null, party = false, onStatus = null, onFrame = null, onResult = null, setupLabel = 'Change fighters' }) {
  const canvasRef = useRef(null);
  const touch = useRef(touchState());
  const [hud, setHud] = useState([]);
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState(null);
  const [showTouch, setShowTouch] = useState(() => isTouch() && (!party || players.some(p => p.you)));
  const [muted, setMuted] = useState(rrSfx.muted);
  const [portrait, setPortrait] = useState(false);
  const [round, setRound] = useState(0);
  const pausedRef = useRef(false); pausedRef.current = paused;
  const tags = useRef({});

  useEffect(() => {
    const cvs = canvasRef.current; const ctx = cvs.getContext('2d');
    const renderer = createRenderer();
    const kb = createKeyboard();
    // same fighter twice? give the copy a different colour
    const seen = {};
    const cfg = players.map((p, i) => {
      seen[p.fighter] = (seen[p.fighter] || 0) + 1;
      const alt = seen[p.fighter] > 1 ? ['#9aa7ff', '#7cf0b4', '#ff9ad5'][seen[p.fighter] - 2] : null;
      tags.current[p.id] = { label: p.remote ? p.name : p.you ? (players.filter(q => q.you || q.pad != null || q.remote).length > 1 ? (party ? p.name || 'HOST' : 'P1') : 'YOU') : p.pad != null ? `P${i + 1}` : p.name, color: p.slotColor || SLOT_COLORS[i % 8] };
      return { ...p, color: alt || undefined };
    });
    const pick = stage === 'random' ? STAGE_LIST[Math.floor(Math.random() * STAGE_LIST.length)].id : stage;
    const g = createMatch({ players: cfg, stocks, stage: pick, seed: `${Date.now()}-${Math.random()}` });
    if (typeof window !== 'undefined') window.__rrGame = g; // handy for debugging & tests
    let raf = 0, acc = 0, last = performance.now(), countStart = performance.now(), started = false, slow = 0, endTimer = 0, hudTick = 0, lastCount = 4;
    const shakeUntil = {};
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cvs.width = Math.round(cvs.clientWidth * dpr); cvs.height = Math.round(cvs.clientHeight * dpr);
      setPortrait(cvs.clientHeight > cvs.clientWidth && isTouch());
    };
    resize(); window.addEventListener('resize', resize);
    const sounds = (evs) => {
      for (const e of evs) {
        if (e.type === 'hit') { rrSfx.hit(e.kb); shakeUntil[e.id] = performance.now() + 260; }
        else if (e.type === 'block') rrSfx.block();
        else if (e.type === 'ko') rrSfx.ko();
        else if (e.type === 'jump') rrSfx.jump();
        else if (e.type === 'shoot') rrSfx.shoot();
        else if (e.type === 'swing') rrSfx.swing();
        else if (e.type === 'shieldbreak') rrSfx.shieldbreak();
        else if (e.type === 'gameover') { slow = 70; }
      }
    };
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - last); last = now;
      if (!started) {
        const c = 3 - Math.floor((now - countStart) / 650);
        if (c !== lastCount) { lastCount = c; setCount(c); if (c > 0) rrSfx.count(); else if (c === 0) rrSfx.go(); }
        if (c <= 0) { started = true; setTimeout(() => setCount(null), 500); }
      } else if (!pausedRef.current && !endTimer) {
        acc += dt;
        while (acc >= STEP) {
          acc -= STEP;
          if (slow > 0) { slow--; if (slow % 3) continue; }
          const inputs = {};
          for (const p of cfg) {
            if (p.cpu) continue;
            inputs[p.id] = p.remote ? (remote ? remote.read(p.id) : null) : p.you ? merge(kb.read(), touch.current, readGamepad(0)) : readGamepad(p.pad);
          }
          step(g, inputs);
          if (remote && remote.consumed) remote.consumed();
          renderer.events(g, g.events); sounds(g.events);
          if (g.over && slow <= 0 && !endTimer) {
            endTimer = 1; rrSfx.win();
            const ranked = g.fighters.slice().sort((a, b) => (b.stocks - a.stocks) || (b.stats.kos - a.stats.kos) || (a.stats.falls - b.stats.falls));
            const res = { winner: g.fighters.find(F => F.id === g.winner), ranked: ranked.map(F => ({ id: F.id, name: F.name, ch: F.ch, tag: tags.current[F.id], kos: F.stats.kos, falls: F.stats.falls, dealt: Math.round(F.stats.dealt) })) };
            setTimeout(() => { setResult(res); if (onResult) onResult(res); }, 900);
            break;
          }
        }
      }
      const W = cvs.width, H = cvs.height, dpr = W / Math.max(1, cvs.clientWidth);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save(); ctx.scale(dpr, dpr);
      renderer.render(ctx, g, cvs.clientWidth, cvs.clientHeight, { tags: tags.current, hudH: g.fighters.length > 4 ? 52 : 64 });
      ctx.restore();
      if (onStatus && !endTimer && hudTick % 15 === 0) onStatus({ phase: started ? 'fight' : 'countdown', stage: g.stage.id, fighters: g.fighters.map(F => ({ id: F.id, ch: F.ch.id, dmg: Math.floor(F.dmg), stocks: F.stocks, color: tags.current[F.id].color })) });
      if (onFrame && !endTimer && hudTick % 6 === 0) {
        onFrame({
          game: g,
          tags: tags.current,
          count: started ? null : Math.max(0, 3 - Math.floor((now - countStart) / 650)),
        });
      }
      if (++hudTick % 4 === 0) {
        setHud(g.fighters.map(F => ({ id: F.id, name: tags.current[F.id].label === 'YOU' ? `${F.ch.name} (you)` : `${tags.current[F.id].label} · ${F.ch.name}`, color: tags.current[F.id].color, dmg: Math.floor(F.dmg), stocks: F.stocks, out: F.stocks <= 0, shake: (shakeUntil[F.id] || 0) > now })));
      }
    };
    raf = requestAnimationFrame(frame);
    const onKey = (e) => { if (e.code === 'Escape' || e.code === 'KeyP') setPaused(p => !p); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); kb.dispose(); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey); };
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const rematch = () => { setResult(null); setCount(3); setPaused(false); setRound(r => r + 1); };

  return (
    <div className="rr-stage" onPointerDown={() => rrSfx.unlock()}>
      <canvas ref={canvasRef} />
      <div className={`rr-hud${hud.length > 4 ? ' compact' : ''}`}>
        {hud.map(p => (
          <div key={p.id} className={`rr-pcard${p.out ? ' out' : ''}`} style={{ '--c': p.color }}>
            <div className="who"><b>{p.name}</b><div className="stocks">{Array.from({ length: p.stocks }, (_, i) => <i key={i} />)}</div></div>
            <div className={`pct${p.shake ? ' shake' : ''}`} style={{ color: pctColor(p.dmg) }}>{p.dmg}<small>%</small></div>
          </div>
        ))}
      </div>
      <div className="rr-corner l"><button type="button" className="rr-icon" aria-label="Pause" onClick={() => setPaused(true)}>⏸</button></div>
      <div className="rr-corner r">
        <button type="button" className="rr-icon" aria-label="Touch controls" onClick={() => setShowTouch(s => !s)}>🎮</button>
      </div>
      {showTouch && !result && <TouchPad state={touch.current} />}
      {portrait && showTouch && <div className="rr-rotate">↻ Turn your phone sideways for the best grip</div>}
      {count != null && <div key={count} className="rr-count">{count > 0 ? count : 'GO!'}</div>}
      {paused && !result && (
        <div className="rr-overlay">
          <div className="rr-card" style={{ textAlign: 'center', minWidth: 280 }}>
            <h2 className="rr-h" style={{ fontSize: 56, color: 'var(--rr-gold)' }}>Paused</h2>
            <div className="rr-row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button type="button" className="rr-btn primary" onClick={() => setPaused(false)}>Resume</button>
              <button type="button" className="rr-btn" onClick={rematch}>Restart</button>
              <button type="button" className="rr-btn ghost" onClick={() => { rrSfx.setMuted(!muted); setMuted(!muted); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            </div>
            <div className="rr-row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button type="button" className="rr-btn ghost" onClick={onSetup}>{setupLabel}</button>
              <button type="button" className="rr-btn ghost" onClick={onExit}>Quit</button>
            </div>
          </div>
        </div>
      )}
      {result && (
        <div className="rr-overlay">
          <div className="rr-card rr-results">
            <h2 className="rr-h" style={{ fontSize: 'clamp(48px, 9vw, 80px)', color: result.winner ? tags.current[result.winner.id].color : 'var(--rr-gold)' }}>{result.winner ? `${tags.current[result.winner.id].label === 'YOU' ? 'You win!' : `${result.winner.ch.name} wins!`}` : 'Draw!'}</h2>
            <p className="rr-sub">{result.winner ? `${result.winner.ch.name} — ${result.winner.ch.title}` : ''}</p>
            <table>
              <thead><tr><th>#</th><th style={{ textAlign: 'left' }}>Fighter</th><th>KOs</th><th>Falls</th><th>Damage</th></tr></thead>
              <tbody>{result.ranked.map((r, i) => <tr key={r.id}><td>{i + 1}</td><td style={{ textAlign: 'left', color: r.tag.color, fontWeight: 900 }}>{r.tag.label === 'YOU' ? 'You' : r.tag.label} · {r.ch.name}</td><td>{r.kos}</td><td>{r.falls}</td><td>{r.dealt}%</td></tr>)}</tbody>
            </table>
            <div className="rr-row" style={{ justifyContent: 'center' }}>
              <button type="button" className="rr-btn primary" onClick={rematch}>Rematch</button>
              <button type="button" className="rr-btn" onClick={onSetup}>{setupLabel}</button>
              <button type="button" className="rr-btn ghost" onClick={onExit}>Quit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}