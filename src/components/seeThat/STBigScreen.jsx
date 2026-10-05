import React, { useEffect, useMemo, useRef, useState } from 'react';
import STSceneView from './STSceneView';
import { sfx } from './stSfx';
import { useSceneImage } from './stCompose';

const fmt = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, '0')}`;
const COUNTS = [6, 8, 10, 12, 15];
const TIMES = [[60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00']];
const ROUNDS = [1, 3, 5];
const DIFFS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];

export function Confetti({ on }) {
  const bits = useMemo(() => Array.from({ length: 80 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.8, color: ['#ffc85c', '#ff6a2b', '#3ef08a', '#22d3ee', '#ff7ad9', '#a855f7'][i % 6] })), [on]);
  if (!on) return null;
  return <div className="st-confetti" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />)}</div>;
}

/**
 * STBigScreen — the TV / big-screen view. The host's screen also gets the controls;
 * the read-only Game Display (?display=1) shows the same thing without them.
 */
export default function STBigScreen({ data, isHost, act, scenes = [], offset = 0, onExit, joinUrl }) {
  const room = data.room;
  const sceneSrc = useSceneImage(room.scene, room.placements);
  const [now, setNow] = useState(Date.now() + offset);
  const [toast, setToast] = useState(null);
  const seen = useRef(null);
  const lastTick = useRef(null);
  const ended = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offset), 200); return () => clearInterval(t); }, [offset]);

  const players = useMemo(() => Object.fromEntries(room.players.map(p => [p.id, p])), [room.players]);
  const ranked = room.players.slice().sort((a, b) => b.total - a.total);

  // new finds → big toast + chime
  useEffect(() => {
    const key = `${room.roundNo}`;
    if (!seen.current || seen.current.key !== key) { seen.current = { key, n: room.log.length ? room.log[room.log.length - 1].t : 0 }; return; }
    const fresh = room.log.filter(l => l.t > seen.current.n);
    if (fresh.length) {
      const l = fresh[fresh.length - 1];
      const p = players[l.pid]; const tgt = room.targets.find(t => t.id === l.id);
      setToast({ k: l.t, c: p?.color || '#fff', who: p?.name || 'Someone', what: tgt?.name || '', pts: l.points });
      sfx.found(0);
      seen.current.n = l.t;
    }
  }, [room.log, room.roundNo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }, [toast]);

  // countdown ticks + end fanfare
  const cd = room.startsAt ? Math.ceil((room.startsAt - now) / 1000) : 0;
  useEffect(() => { if (room.phase === 'countdown' && cd > 0 && cd <= 3 && lastTick.current !== cd) { lastTick.current = cd; sfx.tick(); } if (room.phase === 'playing' && lastTick.current !== 'go') { lastTick.current = 'go'; sfx.go(); } }, [cd, room.phase]);
  useEffect(() => { if ((room.phase === 'roundover' || room.phase === 'final') && ended.current !== room.roundNo) { ended.current = room.roundNo; sfx.end(); } }, [room.phase, room.roundNo]);

  const left = room.endsAt ? (room.endsAt - now) / 1000 : null;
  const S = room.settings;
  const sceneMeta = scenes.find(s => s.id === S.sceneId);

  // ── lobby ──
  if (room.phase === 'lobby') {
    return (
      <div className="st-wrap" style={{ maxWidth: 1200 }}>
        <div className="st-lobby">
          <div className="st-card" style={{ textAlign: 'center' }}>
            <h1 className="st-h st-logo" style={{ fontSize: 'clamp(48px, 6vw, 84px)' }}>See That<span className="q">?!</span></h1>
            <p className="st-sub">On your phone, go to <b style={{ color: 'var(--st-text)' }}>{joinUrl}</b> and enter</p>
            <div className="st-joincode">{room.code}</div>
            <div className="st-players" style={{ justifyContent: 'center', marginTop: 14 }}>
              {room.players.length ? room.players.map(p => <span key={p.id} className="st-pchip" style={{ '--c': p.color }}><span className="st-dot" style={{ background: p.color }} />{p.name}{isHost && <button type="button" className="st-btn small ghost" style={{ padding: '0 4px' }} onClick={() => act('kick', { playerId: p.id })} aria-label={`Remove ${p.name}`}>✕</button>}</span>) : <span className="st-sub">Waiting for players to join…</span>}
            </div>
          </div>
          {isHost ? (
            <div className="st-card st-grid">
              <div>
                <div className="st-label-sm" style={{ marginBottom: 8 }}>Scene</div>
                <div className="st-scenes">
                  <button type="button" className="st-scene" aria-pressed={S.sceneId === 'random'} onClick={() => act('settings', { sceneId: 'random' })}><div className="rand">🎲</div><span>Surprise me</span></button>
                  {scenes.map(s => <button key={s.id} type="button" className="st-scene" aria-pressed={S.sceneId === s.id} onClick={() => act('settings', { sceneId: s.id })}><img src={s.image} alt="" loading="lazy" /><span>{s.title}{s.dynamic ? ' · new layout every game' : ` · ${s.count}`}</span></button>)}
                </div>
              </div>
              <div className="st-row"><span className="st-label-sm" style={{ width: 110 }}>Objects</span><div className="st-seg">{COUNTS.map(n => <button key={n} type="button" aria-pressed={S.count === n} onClick={() => act('settings', { count: n })}>{n}</button>)}</div></div>
              <div className="st-row"><span className="st-label-sm" style={{ width: 110 }}>Time</span><div className="st-seg">{TIMES.map(([s, l]) => <button key={s} type="button" aria-pressed={S.seconds === s} onClick={() => act('settings', { seconds: s })}>{l}</button>)}</div></div>
              <div className="st-row"><span className="st-label-sm" style={{ width: 110 }}>Difficulty</span><div className="st-seg">{DIFFS.map(([k, l]) => <button key={k} type="button" aria-pressed={(S.difficulty || 'normal') === k} onClick={() => act('settings', { difficulty: k })}>{l}</button>)}</div></div>
              <div className="st-row"><span className="st-label-sm" style={{ width: 110 }}>Rounds</span><div className="st-seg">{ROUNDS.map(n => <button key={n} type="button" aria-pressed={S.rounds === n} onClick={() => act('settings', { rounds: n })}>{n}</button>)}</div></div>
              <button type="button" className="st-btn primary" style={{ padding: 16, fontSize: 20 }} disabled={!room.players.length} onClick={() => { sfx.unlock(); act('start'); }}>{room.players.length ? 'Start the hunt' : 'Waiting for players…'}</button>
              <div className="st-row"><button type="button" className="st-btn ghost small" onClick={onExit}>← Exit</button><span className="st-sub" style={{ margin: 0 }}>Tip: put this screen on the TV.</span></div>
            </div>
          ) : (
            <div className="st-card"><p className="st-sub">Waiting for the host to start… {sceneMeta ? `Next scene: ${sceneMeta.title}` : ''}</p></div>
          )}
        </div>
      </div>
    );
  }

  // ── round (countdown / playing / roundover / final) ──
  const reveal = room.phase === 'roundover' || room.phase === 'final';
  const markers = room.targets.filter(t => t.box).map(t => ({ key: t.id, ...t.box, color: t.found ? (players[t.found.by]?.color || '#fff') : '#ff4d5e', label: t.found ? `${t.name} · ${players[t.found.by]?.name || ''}` : t.name, reveal: !t.found }));
  const roundScores = room.players.slice().sort((a, b) => b.round - a.round);
  return (
    <div className="st-big">
      <div className="st-btop">
        <span className="st-h brand">See That?!</span>
        <span className="round">Round {room.roundNo}/{S.rounds}{room.scene ? ` · ${room.scene.title}` : ''}</span>
        <span className={`timer${left != null && left <= 10 && room.phase === 'playing' ? ' low' : ''}`}>{room.phase === 'playing' ? fmt(left) : room.phase === 'countdown' ? 'GET READY' : 'TIME'}</span>
        <span className="code"><b>{room.code}</b><small>{joinUrl}</small></span>
      </div>
      <div className="st-bscene">
        {room.scene && sceneSrc && <STSceneView src={sceneSrc} width={room.scene.width} height={room.scene.height} markers={markers} zoomable={false} />}
        {toast && <div key={toast.k} className="st-bigtoast" style={{ '--c': toast.c }}><b>{toast.who}</b> found the {toast.what}! +{toast.pts}</div>}
      </div>
      <div className="st-bside">
        <div className="st-panel">
          <h4>Find these · {room.targets.filter(t => t.found).length}/{room.targets.length}</h4>
          <div className="st-list">
            {room.targets.map(t => <div key={t.id} className={`st-litem${t.found ? ' done' : ''}`}>{t.name}{t.found && <span className="who" style={{ background: players[t.found.by]?.color || '#888' }}>{players[t.found.by]?.name || ''}</span>}</div>)}
          </div>
        </div>
        <div className="st-panel">
          <h4>Leaderboard</h4>
          <div className="st-lb">
            {ranked.map((p, i) => <div key={p.id} className="st-lbrow"><span className="rk">{i + 1}</span><span className="nm"><span className="st-dot" style={{ background: p.color }} />{p.name}</span><span className="pts">{p.total.toLocaleString()}</span></div>)}
          </div>
        </div>
        {isHost && room.phase === 'playing' && <button type="button" className="st-btn ghost small" onClick={onExit}>Exit game</button>}
      </div>

      {room.phase === 'countdown' && cd > 0 && <div className="st-overlay-full" style={{ background: 'rgba(5,2,10,.5)' }}><div key={cd} className="st-count">{cd > 3 ? 'READY' : cd}</div></div>}
      {room.phase === 'roundover' && (
        <div className="st-overlay-full" style={{ background: 'rgba(5,2,10,.55)', alignItems: 'end' }}>
          <div className="st-card st-result">
            <h2 className="st-h" style={{ fontSize: 52, color: 'var(--st-gold)' }}>Round {room.roundNo} done!</h2>
            <p className="st-sub">{room.targets.filter(t => !t.found).length ? `Missed (in red): ${room.targets.filter(t => !t.found).map(t => t.name).join(', ')}` : 'Every object found!'}</p>
            <div className="st-lb" style={{ marginTop: 12, textAlign: 'left' }}>
              {roundScores.map((p, i) => <div key={p.id} className="st-lbrow"><span className="rk">{i + 1}</span><span className="nm"><span className="st-dot" style={{ background: p.color }} />{p.name} · {p.finds} found</span><span className="pts">+{p.round}</span></div>)}
            </div>
            {isHost ? <div className="st-row" style={{ justifyContent: 'center', marginTop: 14 }}><button type="button" className="st-btn primary" onClick={() => act('next')}>Next round</button><button type="button" className="st-btn ghost" onClick={onExit}>Exit</button></div> : <p className="st-sub">Next round coming up…</p>}
          </div>
        </div>
      )}
      {room.phase === 'final' && (
        <div className="st-overlay-full">
          <div className="st-card st-result">
            <h2 className="st-h" style={{ fontSize: 60, color: 'var(--st-gold)' }}>{ranked[0] ? `${ranked[0].name} wins!` : 'Game over'}</h2>
            <div className="st-podium">
              {[1, 0, 2].map(i => ranked[i] && <div key={ranked[i].id} style={{ '--c': ranked[i].color, height: [190, 150, 120][i] }}><span>{['🥇', '🥈', '🥉'][i]}</span><b>{ranked[i].total.toLocaleString()}</b><span>{ranked[i].name}</span></div>)}
            </div>
            {ranked.length > 3 && <p className="st-sub">{ranked.slice(3).map((p, i) => `${i + 4}. ${p.name} ${p.total}`).join(' · ')}</p>}
            {isHost && <div className="st-row" style={{ justifyContent: 'center', marginTop: 14 }}><button type="button" className="st-btn primary" onClick={() => act('reset')}>Play again</button><button type="button" className="st-btn ghost" onClick={onExit}>Exit</button></div>}
          </div>
        </div>
      )}
      <Confetti on={room.phase === 'final'} />
    </div>
  );
}
