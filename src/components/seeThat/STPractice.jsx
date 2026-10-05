import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import STPhone from './STPhone';
import { Confetti } from './STBigScreen';
import { sfx } from './stSfx';
import { applyHint, applyTap, createRound, roundOver } from '@/lib/seeThatEngine';
import { loadLibrary } from './stCompose';

const ME = 'me';

/** Solo practice on one scene — same rules as the party game, all on this device. */
// Fresh placement every game: never reuse last game's spots on this device.
function newRound(scene, library, count, seconds, difficulty) {
  const key = `st_last_${scene.id}`;
  let avoid = [];
  try { avoid = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* ignore */ }
  const r = createRound(scene, { count, seconds, startsAt: Date.now() + 3000, seed: `${Date.now()}-${Math.random()}`, library, difficulty, avoid });
  if (r.placements) { try { localStorage.setItem(key, JSON.stringify(r.placements.map(p => ({ x: p.bx, y: p.by })))); } catch { /* ignore */ } }
  return r;
}

export default function STPractice(props) {
  const { scene, library: libProp = null } = props;
  const [library, setLibrary] = useState(scene.mode === 'dynamic' ? libProp : []);
  useEffect(() => { if (scene.mode === 'dynamic' && !library) loadLibrary().then(setLibrary).catch(() => setLibrary([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!library) return <div className="st-phone"><div className="st-lock" style={{ background: 'transparent' }}><div><b style={{ color: '#ffc85c' }}>Hiding the objects…</b></div></div></div>;
  return <PracticeRound {...props} library={library} />;
}

function PracticeRound({ scene, imageUrl, library, count = 10, seconds = 120, difficulty = 'normal', name = 'You', onExit }) {
  const [round, setRound] = useState(() => newRound(scene, library, count, seconds, difficulty));
  const [, force] = useState(0);
  const [now, setNow] = useState(Date.now());
  const done = useRef(false);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(`st_best_${scene.id}`) || 0); } catch { return 0; } });

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const over = roundOver(round, now);
  useEffect(() => {
    if (over && !done.current) {
      done.current = true; sfx.end();
      const s = round.p[ME]?.score || 0;
      if (s > best) { setBest(s); try { localStorage.setItem(`st_best_${scene.id}`, String(s)); } catch { /* ignore */ } }
    }
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => Object.fromEntries((round.objects || scene.objects).map(o => [o.id, o])), [scene, round]);
  const targets = round.ids.map(id => { const o = byId[id]; const f = round.found[id]; return { id, name: o.name, found: f ? { by: f.by } : null, box: (f || over) ? { shape: o.shape, x: o.x, y: o.y, w: o.w, h: o.h } : null }; });
  const ps = round.p[ME] || {};
  const mine = { lockUntil: ps.lockUntil || 0, hintsLeft: ps.hintsLeft ?? 2, hints: (ps.hints || []).filter(h => !round.found[h.id]), score: ps.score || 0 };

  const onTap = useCallback(async (x, y) => { const r = applyTap(round, scene, ME, x, y, Date.now()); force(n => n + 1); return r; }, [round, scene]);
  const onHint = useCallback(async () => { const r = applyHint(round, scene, ME, Date.now()); force(n => n + 1); return r; }, [round, scene]);
  const again = () => { done.current = false; setRound(newRound(scene, library, count, seconds, difficulty)); };

  const cd = Math.ceil((round.startsAt - now) / 1000);
  const view = { image: imageUrl || `/see-that/scenes/${scene.image}`, width: scene.width, height: scene.height };
  const foundN = targets.filter(t => t.found).length;
  const isBest = over && (ps.score || 0) >= best && (ps.score || 0) > 0;

  return (
    <>
      <STPhone scene={view} placements={round.placements || null} library={library} targets={targets} players={{ [ME]: { name, color: '#ffc85c' } }} myId={ME} mine={mine} now={now} startsAt={round.startsAt} endsAt={round.endsAt}
        onTap={onTap} onHint={onHint} onExit={onExit} roundLabel={scene.title || 'Practice'} />
      {cd > 0 && <div className="st-overlay-full" style={{ background: 'rgba(5,2,10,.5)' }}><div key={cd} className="st-count">{cd}</div></div>}
      {over && (
        <div className="st-overlay-full" style={{ background: 'rgba(5,2,10,.45)', alignItems: 'end' }}>
          <div className="st-card st-result">
            <h2 className="st-h" style={{ fontSize: 52, color: 'var(--st-gold)' }}>{foundN === targets.length ? 'You found them all!' : 'Time!'}</h2>
            <p className="st-sub">Found {foundN} of {targets.length} · score <b style={{ color: 'var(--st-gold)' }}>{(ps.score || 0).toLocaleString()}</b>{best ? ` · best ${best.toLocaleString()}` : ''}</p>
            {foundN < targets.length && <p className="st-sub">The ones you missed are circled in red.</p>}
            <div className="st-row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <button type="button" className="st-btn primary" onClick={again}>Play again</button>
              <button type="button" className="st-btn ghost" onClick={onExit}>Menu</button>
            </div>
          </div>
        </div>
      )}
      <Confetti on={over && (foundN === targets.length || isBest)} />
    </>
  );
}
