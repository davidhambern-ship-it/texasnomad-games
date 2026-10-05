import React, { useEffect, useRef, useState } from 'react';
import STSceneView from './STSceneView';
import { sfx } from './stSfx';
import { useSceneImage } from './stCompose';

const fmt = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, '0')}`;

/**
 * STPhone — a player's hunting screen: zoomable scene, list of things to find,
 * hints, score, and the misclick lockout.
 */
export default function STPhone({ scene, placements = null, library = null, targets, players = {}, myId, mine = {}, now, endsAt, startsAt, onTap, onHint, onExit, banner = null, disabled = false, title = null, roundLabel = '' }) {
  const src = useSceneImage(scene, placements, library);
  const [ripples, setRipples] = useState([]);
  const [toast, setToast] = useState(null);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);
  const rk = useRef(0);
  const prevFound = useRef(new Set());

  // someone else found something → small chime + toast
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) {
      for (const t of targets) {
        if (t.found && !prevFound.current.has(t.id) && t.found.by !== myId) {
          sfx.other(); setToast({ k: Date.now(), kind: 'info', msg: `${players[t.found.by]?.name || 'Someone'} found the ${t.name}` });
        }
      }
    }
    inited.current = true;
    prevFound.current = new Set(targets.filter(t => t.found).map(t => t.id));
  }, [targets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 1800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!ripples.length) return undefined; const t = setTimeout(() => setRipples(r => r.slice(1)), 650); return () => clearTimeout(t); }, [ripples]);

  const left = endsAt ? (endsAt - now) / 1000 : null;
  const lockLeft = mine.lockUntil ? (mine.lockUntil - now) / 1000 : 0;
  const playing = !disabled && startsAt && now >= startsAt && left > 0;

  const tap = async (x, y) => {
    if (!playing || lockLeft > 0 || busy) return;
    sfx.unlock();
    const key = ++rk.current;
    setBusy(true);
    try {
      const r = await onTap(x, y);
      if (!r) return;
      if (r.kind === 'found') {
        sfx.found(r.combo); setRipples(rs => [...rs, { key, x, y, ok: true }]);
        setToast({ k: key, kind: 'ok', msg: `${r.name}! +${r.points}${r.combo ? `  (combo ×${r.combo + 1})` : ''}` });
      } else if (r.kind === 'miss') {
        r.spam ? sfx.lock() : sfx.miss(); setRipples(rs => [...rs, { key, x, y, ok: false }]);
        setToast({ k: key, kind: 'bad', msg: r.spam ? 'Easy, cowboy! Stop spamming' : `Nope −${r.penalty}` });
      } else if (r.kind === 'already') {
        setToast({ k: key, kind: 'info', msg: 'Already found' });
      }
    } finally { setBusy(false); }
  };

  const hint = async () => {
    if (!playing || !mine.hintsLeft || busy) return;
    sfx.unlock();
    const r = await onHint();
    if (r?.kind === 'hint') { sfx.hint(); setFocus({ x: r.hint.cx, y: r.hint.cy, k: Date.now() }); setToast({ k: Date.now(), kind: 'info', msg: `Look around here for the ${r.name}` }); }
  };

  const markers = targets.filter(t => t.box).map(t => ({
    key: t.id, ...t.box, color: t.found ? (players[t.found.by]?.color || '#fff') : '#ff4d5e', label: t.name, reveal: !t.found,
  }));
  const hints = (mine.hints || []).map(h => ({ key: h.id, cx: h.cx, cy: h.cy, r: h.r }));
  const me = players[myId];

  return (
    <div className="st-phone">
      <div className="st-phead">
        <span className="me"><span className="st-dot" style={{ background: me?.color || '#ffc85c' }} />{me?.name || title || 'You'}</span>
        <span className="sc">{(mine.score || 0).toLocaleString()}</span>
        <span className={`tm${left != null && left <= 10 && !banner ? ' low' : ''}`}>{left != null && !banner ? fmt(left) : ''}</span>
        {onExit && <button type="button" className="st-btn small ghost" onClick={onExit} aria-label="Leave">✕</button>}
      </div>
      <div className="st-pscene">
        {src ? <STSceneView src={src} width={scene.width} height={scene.height} markers={markers} hints={hints} ripples={ripples} onTap={tap} disabled={!playing} focus={focus} /> : <div className="st-lock" style={{ background: 'transparent' }}><div><b style={{ color: '#ffc85c' }}>Hiding the objects…</b></div></div>}
        {lockLeft > 0 && <div className="st-lock"><div><b>Whoa there!</b>Locked for {Math.ceil(lockLeft)}s — no wild tapping</div></div>}
        {toast && <div key={toast.k} className={`st-toast ${toast.kind}`}>{toast.msg}</div>}
        {banner && <div className="st-lock" style={{ background: 'rgba(5,2,10,.55)' }}><div style={{ padding: 16 }}><b style={{ color: '#ffc85c' }}>{banner.title}</b>{banner.text}</div></div>}
      </div>
      <div className="st-pfoot">
        <div className="st-targets" aria-label="Things to find">
          {targets.map(t => (
            <span key={t.id} className={`st-target${t.found ? ' done' : ''}${t.found?.by === myId ? ' mine' : ''}`}>
              {t.found && <span className="st-dot" style={{ background: players[t.found.by]?.color || '#888' }} />}{t.name}
            </span>
          ))}
        </div>
        <div className="st-row">
          <span className="st-label-sm">{roundLabel}{targets.length ? ` · ${targets.filter(t => t.found).length}/${targets.length} found` : ''}</span>
          <button type="button" className="st-btn small" disabled={!playing || !mine.hintsLeft} onClick={hint}>💡 Hint ({mine.hintsLeft ?? 0})</button>
        </div>
      </div>
    </div>
  );
}
