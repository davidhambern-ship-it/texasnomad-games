import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import BSGrid from './BSGrid';
import { sfx } from './bsSfx';
import { TEAMS } from '@/lib/battleSudoku/game';

const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const PH = { setup: 'Hide your fleets', solve: 'Solve!', battle: 'Battle stations', reveal: 'Incoming!', final: 'Game over' };
const DIFFS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
const SOLVES = [30, 40, 60], BATTLES = [10, 15, 20], VOLLEYS = [6, 8, 10];

export function Confetti({ on }) {
  const bits = useMemo(() => Array.from({ length: 80 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.8, color: ['#f2c14e', '#5fc8ff', '#3ef08a', '#ff5f6d', '#c77dff', '#ff7a2f'][i % 6] })), [on]);
  if (!on) return null;
  return <div className="st-confetti" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 70, overflow: 'hidden' }} aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ position: 'absolute', top: -20, width: 10, height: 14, borderRadius: 2, left: `${b.left}%`, background: b.color, animation: `bs-fall ${b.dur}s linear ${b.delay}s forwards` }} />)}<style>{'@keyframes bs-fall{to{transform:translateY(110vh) rotate(720deg)}}'}</style></div>;
}

/** The TV: lobby, the ocean map of every fleet, volley reveals, podium. */
export default function BSBigScreen({ data, isHost, act, offset = 0, onExit, joinUrl }) {
  const room = data.room;
  const g = room.game;
  const [now, setNow] = useState(Date.now() + offset);
  const [banner, setBanner] = useState(null);
  const heard = useRef(new Set());
  const lastPhase = useRef(null);
  // size the fleet area so every captain's ocean fits on the TV without scrolling
  const fleetsRef = useRef(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = fleetsRef.current; if (!el) return undefined;
    const up = () => setArea({ w: el.clientWidth, h: window.innerWidth < 900 ? 1e5 : el.clientHeight }); up();
    const ro = new ResizeObserver(up); ro.observe(el);
    return () => ro.disconnect();
  }, [!!g]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offset), 120); return () => clearInterval(t); }, [offset]);
  useEffect(() => { if (!banner) return undefined; const t = setTimeout(() => setBanner(null), 2200); return () => clearTimeout(t); }, [banner]);
  useEffect(() => {
    if (!g) return;
    if (lastPhase.current !== g.phase) { if (g.phase === 'battle') sfx.horn(); if (g.phase === 'final') sfx.win(); lastPhase.current = g.phase; }
  }, [g?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // reveal pacing: shots land one after another on the TV
  const rv = g?.phase === 'reveal' ? g.reveal : null;
  const shots = rv ? rv.events.filter(e => e.result) : [];
  const revealStart = g ? g.phaseEndsAt - g.settings.revealSec * 1000 : 0;
  const pace = shots.length ? Math.min(450, Math.max(120, (g.settings.revealSec * 1000 - 2200) / shots.length)) : 400;
  const shown = rv ? Math.max(0, Math.min(shots.length, Math.floor((now - revealStart - 400) / pace) + 1)) : 0;
  useEffect(() => {
    if (!rv) return;
    for (let k = 0; k < shown; k++) {
      const key = `${rv.volley}-${k}`;
      if (heard.current.has(key)) continue;
      heard.current.add(key);
      const e = shots[k];
      if (k === shown - 1) { if (e.result === 'hit') (e.sunk ? sfx.sink : sfx.hit)(); else if (e.result === 'miss') sfx.splash(); }
      if (e.sunk) { const P = g.players.find(p => p.id === e.by), T = g.players.find(p => p.id === e.target); setBanner({ k: key, c: P?.color, text: `${P?.name} sank ${T?.name}'s ${e.shipName}!` }); }
    }
  }, [shown, rv?.volley]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── lobby ──
  if (!g) {
    const S = room.settings;
    const teamMode = S.mode === 'teams';
    const chip = (p) => <span key={p.id} className="bs-chip" style={{ '--c': p.color }}><span className="bs-dot" style={{ background: p.color }} />{p.name}{p.cpu ? ' · CPU' : ''}{isHost && <button type="button" className="bs-btn small ghost" style={{ padding: '0 4px' }} onClick={() => act('kick', { playerId: p.id })} aria-label={`Remove ${p.name}`}>✕</button>}</span>;
    const teamEmpty = teamMode && [0, 1].some(t => !room.roster.some(p => (p.team || 0) === t));
    return (
      <div className="bs-wrap" style={{ maxWidth: 1200 }}>
        <div className="bs-lobby">
          <div className="bs-card" style={{ textAlign: 'center' }}>
            <h1 className="bs-h bs-logo" style={{ fontSize: 'clamp(40px, 4.4vw, 76px)', overflowWrap: 'anywhere' }}>Battle<b>Sudoku</b></h1>
            <p className="bs-sub">On your phone, go to <b style={{ color: 'var(--bs-text)' }}>{joinUrl}</b> and enter</p>
            <div className="bs-joincode">{room.code}</div>
            {teamMode ? (
              <div className="bs-teamcols">
                {TEAMS.map(t => (
                  <div key={t.id} className="bs-teamcol" style={{ '--tc': t.color }}>
                    <h4>{t.name}</h4>
                    {room.roster.filter(p => (p.team || 0) === t.id).map(p => (
                      <span key={p.id} className="bs-chip" style={{ '--c': t.color }}>
                        {isHost ? <button type="button" className="bs-chip" style={{ border: 0, padding: 0, margin: 0, background: 'none' }} title={`Move ${p.name} to the other fleet`} onClick={() => act('team', { playerId: p.id })}>{p.name}{p.cpu ? ' · CPU' : ''} ⇄</button> : <>{p.name}{p.cpu ? ' · CPU' : ''}</>}
                        {isHost && <button type="button" className="bs-btn small ghost" style={{ padding: '0 4px' }} onClick={() => act('kick', { playerId: p.id })} aria-label={`Remove ${p.name}`}>✕</button>}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bs-row" style={{ justifyContent: 'center', marginTop: 12 }}>
                {room.roster.length ? room.roster.map(chip) : <span className="bs-sub">Waiting for captains to join…</span>}
              </div>
            )}
          </div>
          {isHost ? (
            <div className="bs-card bs-grid2">
              <div className="bs-row"><span className="bs-label" style={{ width: 120 }}>Mode</span><div className="bs-seg">{[['ffa', 'Free-for-all'], ['teams', 'Fleet vs Fleet']].map(([k, l]) => <button key={k} type="button" aria-pressed={(S.mode || 'ffa') === k} onClick={() => act('settings', { mode: k })}>{l}</button>)}</div></div>
              {teamMode && <div className="bs-row"><button type="button" className="bs-btn small" onClick={() => act('shuffleTeams')}>🔀 Shuffle teams</button><span className="bs-sub" style={{ margin: 0 }}>Tap a captain to swap fleets</span></div>}
              <div className="bs-row"><span className="bs-label" style={{ width: 120 }}>Puzzle</span><div className="bs-seg">{DIFFS.map(([k, l]) => <button key={k} type="button" aria-pressed={S.difficulty === k} onClick={() => act('settings', { difficulty: k })}>{l}</button>)}</div></div>
              <div className="bs-row"><span className="bs-label" style={{ width: 120 }}>Solve phase</span><div className="bs-seg">{SOLVES.map(s => <button key={s} type="button" aria-pressed={S.solveSec === s} onClick={() => act('settings', { solveSec: s })}>{s}s</button>)}</div></div>
              <div className="bs-row"><span className="bs-label" style={{ width: 120 }}>Battle phase</span><div className="bs-seg">{BATTLES.map(s => <button key={s} type="button" aria-pressed={S.battleSec === s} onClick={() => act('settings', { battleSec: s })}>{s}s</button>)}</div></div>
              <div className="bs-row"><span className="bs-label" style={{ width: 120 }}>Volleys</span><div className="bs-seg">{VOLLEYS.map(n => <button key={n} type="button" aria-pressed={S.volleys === n} onClick={() => act('settings', { volleys: n })}>{n}</button>)}</div></div>
              <div className="bs-row"><button type="button" className="bs-btn" disabled={room.roster.length >= 8} onClick={() => act('addCpu')}>+ Add CPU captain</button><span className="bs-sub" style={{ margin: 0 }}>2–8 captains</span></div>
              <button type="button" className="bs-btn primary" style={{ padding: 16, fontSize: 20 }} disabled={room.roster.length < 2 || teamEmpty} onClick={() => { sfx.unlock(); act('start'); }}>{room.roster.length < 2 ? 'Need 2+ captains' : teamEmpty ? 'Both fleets need a captain' : 'Start the battle'}</button>
              <div className="bs-row"><button type="button" className="bs-btn ghost small" onClick={onExit}>← Exit</button><span className="bs-sub" style={{ margin: 0 }}>Put this screen on the TV.</span></div>
            </div>
          ) : <div className="bs-card"><p className="bs-sub">Waiting for the host to start the battle…</p></div>}
        </div>
      </div>
    );
  }

  // ── game ──
  const players = g.players;
  const hidden = new Set(shots.slice(shown).map(e => `${e.target}:${e.cell}`));
  const last = shown ? shots[shown - 1] : null;
  const ranked = players.slice().sort((a, b) => b.score - a.score);
  const teams = g.mode === 'teams' && g.teams;
  const isBounty = (id) => (g.bounties || []).includes(id) && (g.phase === 'battle' || g.phase === 'reveal');
  // Fleet vs Fleet splits the TV into a Red side and a Blue side
  const groups = teams ? TEAMS.map(t => ({ team: g.teams[t.id], list: players.filter(p => p.team === t.id) })) : [{ team: null, list: players }];
  const GAP = 10, PADW = 24, PADH = 76, HEAD = teams ? 46 : 0; // card chrome around the ocean grid
  // one shared card size so both sides match
  let cardW = 0; const colsFor = {};
  if (area.w > 0) {
    const gw = (area.w - (groups.length - 1) * 18) / groups.length, gh = area.h - HEAD;
    let size = Infinity;
    groups.forEach((G, gi) => {
      const n = Math.max(1, G.list.length); let best = -1;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const sz = Math.min((gw - (c - 1) * GAP) / c - PADW, (gh - (r - 1) * GAP) / r - PADH);
        if (sz > best) { best = sz; colsFor[gi] = c; }
      }
      size = Math.min(size, best);
    });
    cardW = Math.max(150, Math.floor(size + PADW));
  }
  return (
    <div className="bs-big">
      <div className="bs-btop">
        <span className="bs-h brand">Battle<b>Sudoku</b></span>
        <span className={`ph ${g.phase}`}>{PH[g.phase]}{g.volley ? ` · ${g.volley}/${g.settings.volleys}` : ''}</span>
        <span className="timer">{g.phase === 'final' ? '' : fmt(g.phaseEndsAt - now)}</span>
        <span className="code"><b>{room.code}</b><small>{joinUrl}</small></span>
      </div>
      <div className="bs-bmain">
        <div ref={fleetsRef} className={`bs-sides${teams ? ' teams' : ''}`}>
          {groups.map((G, gi) => (
          <div key={gi} className="bs-sidegroup" style={G.team ? { '--tc': G.team.color } : undefined}>
            {G.team && <div className="bs-teamhead"><b>{G.team.name}</b><span>{'🚢'.repeat(Math.min(G.team.shipsLeft, 12))}{G.team.shipsLeft > 12 ? ` ×${G.team.shipsLeft}` : ''}{G.team.shipsLeft ? '' : 'fleet sunk'}</span><span className="sc">{G.team.score}</span></div>}
            <div className="bs-fleets" style={{ '--cols': colsFor[gi] || 2, '--cardw': cardW ? `${cardW}px` : '1fr' }}>
          {G.list.map(p => {
            const sunkCells = new Set(p.sunk.flatMap(s => s.cells));
            return (
              <div key={p.id} className={`bs-pcard${isBounty(p.id) ? ' leader' : ''}${p.ghost ? ' ghost' : ''}`} style={{ borderColor: isBounty(p.id) ? undefined : G.team ? `${G.team.color}aa` : `${p.color}66` }}>
                {isBounty(p.id) && <span className="bs-tag">★ BOUNTY</span>}
                {p.ghost && <span className="bs-tag" style={{ background: '#c8b6ff' }}>👻 GHOST</span>}
                <div className="hd"><span className="bs-dot" style={{ background: p.color }} />{p.name}{p.cpu ? <small style={{ color: 'var(--bs-dim)' }}> CPU</small> : null}<span className="sc">{p.score}</span></div>
                <BSGrid ocean cell={(i) => {
                  const hide = hidden.has(`${p.id}:${i}`);
                  const m = hide ? null : p.marks[i];
                  const anim = last && last.target === p.id && last.cell === i ? (last.result === 'hit' ? 'boom' : 'spl') : '';
                  return { cls: [m === 'hit' ? (sunkCells.has(i) ? 'sunk' : 'hit') : m === 'miss' ? 'miss' : '', anim].join(' ') };
                }} />
                <div className="bs-prog"><i style={{ width: `${(p.solved / Math.max(1, p.toSolve)) * 100}%` }} /></div>
                <div className="meta">
                  <span>{'🚢'.repeat(p.shipsLeft)}{p.shipsLeft ? '' : 'fleet sunk'}</span>
                  <span>{g.phase === 'setup' ? (p.ready ? 'Ready ✓' : 'hiding fleet…') : g.phase === 'battle' ? `${p.ordersIn} order${p.ordersIn === 1 ? '' : 's'} in` : `${p.solved}/${p.toSolve} solved`}{p.frozen ? ' · ❄ frozen' : ''}</span>
                </div>
              </div>
            );
          })}
            </div>
          </div>
          ))}
        </div>
        <div className="bs-side">
          <div className="bs-panel">
            <h4>Battle log</h4>
            <div className="bs-feed">{g.feed.slice().reverse().map((f, i) => <div key={`${f.t}-${i}`} className={f.kind}>{f.text}</div>)}</div>
          </div>
          <div className="bs-panel">
            <h4>Leaderboard</h4>
            {teams && <div className="bs-lb" style={{ marginBottom: 8 }}>{g.teams.slice().sort((a, b) => b.score - a.score).map(t => <div key={t.id} className="bs-lbrow team" style={{ '--tc': t.color }}><span>⚓</span><span style={{ color: t.color, fontWeight: 900 }}>{t.name}</span><span className="pts">{t.score}</span></div>)}</div>}
            <div className="bs-lb">{ranked.map((p, i) => <div key={p.id} className="bs-lbrow"><span>{i + 1}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="bs-dot" style={{ background: teams ? TEAMS[p.team]?.color : p.color }} />{p.name}{p.ghost ? ' 👻' : ''}</span><span className="pts">{p.score}</span></div>)}</div>
          </div>
          {isHost && g.phase !== 'final' && <button type="button" className="bs-btn ghost small" onClick={() => { if (window.confirm('End this battle?')) act('lobby'); }}>End battle</button>}
        </div>
      </div>
      {banner && <div key={banner.k} className="bs-bigbanner" style={{ '--c': banner.c }}>{banner.text}</div>}
      {g.phase === 'final' && (
        <div className="bs-overlay">
          <div className="bs-card" style={{ width: 'min(640px, 100%)', textAlign: 'center' }}>
            {teams && g.winnerTeam != null ? (
              <>
                <h2 className="bs-h" style={{ fontSize: 64, color: TEAMS[g.winnerTeam].color }}>{TEAMS[g.winnerTeam].name} wins!</h2>
                <p className="bs-sub">{g.winReason === 'admiral' ? `${players.find(p => p.id === g.winner)?.name} finished the Sudoku — Admiral's Victory` : g.winReason === 'fleet' ? 'The enemy fleet is at the bottom of the sea' : 'Most combined points after the final volley'}</p>
                <div className="bs-row" style={{ justifyContent: 'center', gap: 18, margin: '6px 0 2px' }}>{g.teams.map(t => <span key={t.id} className="bs-chip" style={{ '--c': t.color, fontSize: 18 }}>{t.name} · <b>{t.score}</b></span>)}</div>
                <p className="bs-sub">MVP: <b style={{ color: 'var(--bs-text)' }}>{players.find(p => p.id === g.winner)?.name}</b></p>
              </>
            ) : (
              <>
                <h2 className="bs-h" style={{ fontSize: 60, color: 'var(--bs-brass)' }}>{players.find(p => p.id === g.winner)?.name || 'Nobody'} wins!</h2>
                <p className="bs-sub">{g.winReason === 'admiral' ? "Admiral's Victory — finished the Sudoku first" : g.winReason === 'last' ? 'Last Fleet Floating' : 'Most points after the final volley'}</p>
              </>
            )}
            <div className="bs-podium">{[1, 0, 2].map(i => ranked[i] && <div key={ranked[i].id} style={{ '--c': ranked[i].color, height: [190, 150, 120][i] }}><span>{['🥇', '🥈', '🥉'][i]}</span><b>{ranked[i].score}</b><span style={{ fontWeight: 800 }}>{ranked[i].name}</span><br /><small>{ranked[i].stats.sinks} sinks · {ranked[i].stats.hits} hits</small></div>)}</div>
            {isHost && <div className="bs-row" style={{ justifyContent: 'center' }}><button type="button" className="bs-btn primary" onClick={() => act('start')}>New battle</button><button type="button" className="bs-btn" onClick={() => act('lobby')}>Back to lobby</button><button type="button" className="bs-btn ghost" onClick={onExit}>Exit</button></div>}
          </div>
        </div>
      )}
      <Confetti on={g.phase === 'final'} />
    </div>
  );
}
