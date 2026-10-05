import React, { useEffect, useMemo, useRef, useState } from 'react';
import BSGrid from './BSGrid';
import { sfx } from './bsSfx';
import { COST, MAX_SHELLS, TEAMS, cellName, lineName } from '@/lib/battleSudoku/game';
import { LINES } from '@/lib/battleSudoku/sudoku';

const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const PHASE = { setup: 'Hide your fleet', solve: 'Solve', battle: 'Battle!', reveal: 'Incoming…', final: 'Game over' };

function Shells({ have, spent = 0 }) {
  return (
    <span className="bs-shells" title={`${have} shells`}>
      {Array.from({ length: MAX_SHELLS }, (_, i) => <i key={i} className={`bs-shell${i >= have ? ' off' : i >= have - spent ? ' spent' : ''}`} />)}
    </span>
  );
}

/**
 * BSPhone — one captain's screen. v = game view (with v.me), act(type, payload) → Promise<result>
 */
export default function BSPhone({ v, act, now, onExit }) {
  const me = v.me;
  const players = useMemo(() => Object.fromEntries(v.players.map(p => [p.id, p])), [v.players]);
  const [sel, setSel] = useState(null);
  const [flash, setFlash] = useState(null);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('enemy');
  const [target, setTarget] = useState(null);
  const [tool, setTool] = useState('fire');
  const [dir, setDir] = useState('h');
  const [defOwner, setDefOwner] = useState(null);
  const [busy, setBusy] = useState(false);
  const lastPhase = useRef(null);
  const lastIntel = useRef(null);
  const lastReveal = useRef(null);

  const left = v.phaseEndsAt - now;
  const teams = v.mode === 'teams';
  const myTeam = teams && me ? TEAMS[me.team] : null;
  const foes = v.players.filter(p => p.id !== me?.id && !p.ghost && (!teams || p.team !== me?.team));
  const isBounty = (id) => (v.bounties || []).includes(id);
  const tgt = target && foes.find(f => f.id === target) ? target : (me?.rival && foes.find(f => f.id === me.rival) ? me.rival : foes[0]?.id);

  const say = (msg, kind = 'info') => setToast({ msg, kind, k: Date.now() + Math.random() });
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(null), 450); return () => clearTimeout(t); }, [flash]);

  // phase changes & news → sounds / toasts
  useEffect(() => {
    if (lastPhase.current && lastPhase.current !== v.phase) {
      if (v.phase === 'battle') { sfx.horn(); setTab('enemy'); setTool('fire'); setDefOwner(null); say(isBounty(me?.id) ? 'Battle stations — there’s a bounty on YOU!' : 'Battle stations! Spend your shells.', 'info'); }
      if (v.phase === 'solve') setSel(null);
      if (v.phase === 'final') sfx.win();
    }
    lastPhase.current = v.phase;
  }, [v.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const n = me?.intel?.length || 0;
    if (lastIntel.current != null && n > lastIntel.current) {
      const p = me.intel[n - 1]; sfx.sonar();
      const via = p.from && p.from !== me.id ? `${players[p.from]?.name || 'Teammate'}’s sonar` : 'Sonar';
      say(`${via}: ${players[p.target]?.name || 'rival'} has ${p.count} ship piece${p.count === 1 ? '' : 's'} in ${lineName(p.type, p.idx)}`, 'sonar');
    }
    lastIntel.current = n;
  }, [me?.intel?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!v.reveal || lastReveal.current === v.reveal.volley || !me) return;
    lastReveal.current = v.reveal.volley;
    const mineHits = v.reveal.events.filter(e => e.target === me.id && e.result === 'hit');
    const myHits = v.reveal.events.filter(e => e.by === me.id && e.result === 'hit');
    if (mineHits.some(e => e.sunk)) sfx.sink(); else if (mineHits.length || myHits.length) sfx.hit(); else sfx.splash();
  }, [v.reveal?.volley]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) {
    return (
      <div className="bs-phone"><div className="bs-pbody" style={{ justifyContent: 'center' }}>
        <div className="bs-card" style={{ textAlign: 'center' }}><h2 className="bs-h" style={{ fontSize: 38, color: 'var(--bs-brass)' }}>Watching this battle</h2><p className="bs-sub">You joined after it started — you’re in the next game. Watch the big screen!</p>{onExit && <button type="button" className="bs-btn ghost small" onClick={onExit}>Leave</button>}</div>
      </div></div>
    );
  }

  const run = async (type, payload, onRes) => {
    if (busy) return null;
    setBusy(true); sfx.unlock();
    try { const r = await act(type, payload); if (r && r.ok === false && r.error) say(r.error, 'bad'); if (onRes && r) onRes(r); return r; }
    finally { setBusy(false); }
  };

  const shipAt = {}; me.ships.forEach(s => s.cells.forEach(c => { shipAt[c] = s; }));
  const hitSet = new Set(me.ships.flatMap(s => s.hits));
  const spent = (me.orders || []).reduce((n, o) => n + COST[o.kind], 0);
  const frozen = now < me.frozenUntil;

  // ── header ──
  const header = (
    <div className="bs-phead" style={myTeam ? { boxShadow: `inset 0 -3px 0 ${myTeam.color}` } : undefined}>
      <span className="nm"><span className="bs-dot" style={{ background: players[me.id]?.color }} /><span className="t">{players[me.id]?.name}{me.ghost ? ' 👻' : ''}</span></span>
      <Shells have={me.shells} spent={v.phase === 'battle' ? spent : 0} />
      <span className={`bs-phase ${v.phase}`}><b>{v.phase === 'final' ? 'Done' : fmt(left)}</b><small>{PHASE[v.phase]}{v.volley ? ` · ${v.volley}/${v.settings.volleys}` : ''}</small></span>
      {onExit && <button type="button" className="bs-btn small ghost" onClick={onExit} aria-label="Leave">✕</button>}
    </div>
  );

  let body = null;
  if (v.phase === 'setup') {
    body = (
      <>
        {myTeam && <div className="bs-banner">You sail with the <span className="bs-teampill" style={{ '--tc': myTeam.color }}>{myTeam.name}</span>{(me.allies || []).length ? <> alongside {(me.allies || []).map(a => players[a.id]?.name).join(', ')}</> : ''}</div>}
        <div className="bs-banner"><b>Hide your fleet.</b> {teams ? 'The other fleet' : 'Rivals'} will fire at these squares — shuffle until you like it.</div>
        <BSGrid ocean mine axis cell={(i) => ({ cls: shipAt[i] ? 'ship' : '' })} />
        <div className="bs-fleetkey">{me.ships.map(s => <span key={s.id}>{s.name} ({s.size})</span>)}</div>
        <div className="bs-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="bs-btn" disabled={me.ready} onClick={() => run('shuffle')}>🔀 Shuffle fleet</button>
          <button type="button" className="bs-btn primary" disabled={me.ready} onClick={() => run('ready')}>{me.ready ? 'Ready ✓' : 'Ready!'}</button>
        </div>
        <div className="bs-banner">{v.players.filter(p => p.ready).length}/{v.players.length} captains ready</div>
      </>
    );
  } else if (v.phase === 'solve') {
    const count = Array(10).fill(0); me.board.forEach(d => { if (d) count[d]++; });
    const selDigit = sel != null ? me.board[sel] : 0;
    const peer = (i) => sel != null && (Math.floor(i / 9) === Math.floor(sel / 9) || i % 9 === sel % 9 || (Math.floor(i / 27) === Math.floor(sel / 27) && Math.floor((i % 9) / 3) === Math.floor((sel % 9) / 3)));
    const pick = (d) => {
      if (sel == null) { say('Tap an empty square first', 'info'); return; }
      run('place', { cell: sel, digit: d }, (r) => {
        if (r.correct) { sfx.correct(r.streak); setFlash({ cell: sel, kind: 'good' }); if (r.earned > 1) say(`Streak! +${r.earned} shells`, 'ok'); setSel(null); }
        else if (r.ok && r.correct === false) { sfx.wrong(); setFlash({ cell: sel, kind: 'bad' }); say('Wrong — −1 shell', 'bad'); }
      });
    };
    body = (
      <>
        <div className="bs-banner">{me.rival ? <>Your rival: <b style={{ color: players[me.rival]?.color }}>{players[me.rival]?.name}</b> — finish a row, column or box to ping sonar on them</> : 'Solve to load your cannon'}{me.streak >= 2 ? ` · streak ${me.streak}` : ''}</div>
        <div style={{ position: 'relative' }}>
          <BSGrid cell={(i) => {
            const given = v.puzzle[i], d = me.board[i];
            const cls = [given ? 'given' : '', shipAt[i] ? 'ship' : '', hitSet.has(i) ? 'hitme' : '', me.scorched.includes(i) && !d ? 'scorch' : '', me.shields.includes(i) ? 'shield' : '',
              sel === i ? 'sel' : peer(i) ? 'peer' : '', d && d === selDigit ? 'same' : '', flash && flash.cell === i ? flash.kind : ''].join(' ');
            return { cls, text: d || '' };
          }} onCell={(i) => { if (!me.board[i]) setSel(i === sel ? null : i); else setSel(i); }} />
          {frozen && <div className="bs-freeze">❄ Frozen!<br /><span style={{ fontSize: 22 }}>a ship of yours was sunk · {Math.ceil((me.frozenUntil - now) / 1000)}s</span></div>}
        </div>
        <div className="bs-numpad">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => <button key={d} type="button" disabled={count[d] >= 9 || frozen || now < me.lockUntil} onClick={() => pick(d)}>{d}</button>)}</div>
        <div className="bs-fleetkey">{me.ships.map(s => <span key={s.id} className={s.hits.length >= s.size ? 'dead' : ''}>{s.name}{s.hits.length && s.hits.length < s.size ? ` ${s.hits.length}/${s.size}` : ''}</span>)}</div>
      </>
    );
  } else if (v.phase === 'battle') {
    const T = players[tgt];
    const myOrdersOn = (me.orders || []).filter(o => o.target === tgt);
    const aim = new Set(myOrdersOn.flatMap(o => o.cells || [o.cell]));
    const allyAim = new Set((me.allyOrders || []).filter(o => o.target === tgt).flatMap(o => o.cells));
    const sunkCells = new Set((T?.sunk || []).flatMap(s => s.cells));
    // latest ping per line wins (counts drop as ships get hit)
    const intelMap = new Map();
    for (const x of (me.intel || [])) if (x.target === tgt) intelMap.set(`${x.type}${x.idx}`, x);
    const intel = [...intelMap.values()];
    const lineCells = (x) => LINES.find(L => L.type === x.type && L.idx === x.idx).cells;
    const lit = new Set(intel.filter(x => x.count > 0).flatMap(lineCells));
    const clear = new Set(intel.filter(x => x.count === 0).flatMap(lineCells));
    const canAfford = (k) => me.shells - spent >= COST[k];
    const fireAt = (i) => {
      const existing = myOrdersOn.find(o => (o.cells || [o.cell]).includes(i));
      if (existing) { run('cancel', { orderId: existing.id }); return; }
      const kind = tool === 'torpedo' ? 'torpedo' : 'fire';
      if (!canAfford(kind)) { say(me.shells - spent <= 0 ? 'Out of shells — solve more next round!' : `Torpedo needs ${COST.torpedo} shells`, 'bad'); return; }
      run('order', { kind, target: tgt, cell: i, dir }, (r) => { if (r.ok) sfx.order(); });
    };
    // which fleet am I defending? mine, or (Fleet vs Fleet) a teammate's
    const defendable = [{ id: me.id, ghost: me.ghost, ships: me.ships, shields: me.shields }, ...(me.allies || [])].filter(f => !f.ghost);
    const D = defendable.find(f => f.id === defOwner) || defendable[0] || null;
    const dShipAt = {}; (D?.ships || []).forEach(sh => sh.cells.forEach(c => { dShipAt[c] = sh; }));
    const dHits = new Set((D?.ships || []).flatMap(sh => sh.hits));
    const defOrders = (me.orders || []).filter(o => (o.kind === 'repair' || o.kind === 'shield') && (o.owner || me.id) === D?.id);
    const allyDef = new Set((me.allyOrders || []).filter(o => (o.kind === 'repair' || o.kind === 'shield') && o.owner === D?.id).flatMap(o => o.cells));
    const fleetTap = (i) => {
      if (!D) return;
      const existing = defOrders.find(o => o.cell === i);
      if (existing) { run('cancel', { orderId: existing.id }); return; }
      if (!dShipAt[i]) { say('Tap one of the ships', 'info'); return; }
      const kind = dHits.has(i) ? 'repair' : 'shield';
      if (!canAfford(kind)) { say('Out of shells', 'bad'); return; }
      run('order', { kind, cell: i, ...(D.id !== me.id ? { owner: D.id } : {}) }, (r) => { if (r.ok) sfx.order(); });
    };
    const myDef = new Set(defOrders.map(o => o.cell));
    body = (
      <>
        <div className="bs-targets">
          {defendable.length > 0 && <button type="button" aria-pressed={tab === 'fleet'} style={{ '--c': '#8fc4ff' }} onClick={() => setTab('fleet')}>🛡 {teams ? 'Defend' : 'My fleet'}</button>}
          {foes.map(f => <button key={f.id} type="button" aria-pressed={tab === 'enemy' && tgt === f.id} style={{ '--c': f.color }} onClick={() => { setTab('enemy'); setTarget(f.id); }}>
            <span className="bs-dot" style={{ background: f.color }} />{f.name}{isBounty(f.id) ? <span className="bty">★</span> : null}{me.rival === f.id ? ' · rival' : ''}</button>)}
        </div>
        {tab === 'enemy' && T ? (
          <>
            <div className="bs-banner"><b style={{ color: T.color }}>{T.name}’s waters</b> · {T.shipsLeft} ship{T.shipsLeft === 1 ? '' : 's'} afloat{isBounty(T.id) ? ' · ★ bounty: hits pay +1 shell' : ''}{allyAim.size ? <> · <span style={{ color: '#7dffb2' }}>◌ = teammate’s aim</span></> : ''}</div>
            <BSGrid ocean axis cell={(i) => {
              const m = T.marks[i];
              return { cls: [sunkCells.has(i) ? 'sunk' : m === 'hit' ? 'hit' : m === 'miss' ? 'miss' : '', aim.has(i) ? 'aim' : '', allyAim.has(i) && !m && !aim.has(i) ? 'allyaim' : '', lit.has(i) && !m ? 'lit' : '', clear.has(i) && !m && !lit.has(i) ? 'clear' : ''].join(' ') };
            }} onCell={fireAt}
              overlay={(cs) => intel.map((x, k) => {
                // rows: badge on the right edge · columns: bottom edge · boxes: box centre
                const half = 8;
                const pos = x.type === 'row' ? { left: 9 * cs - 2 * half - 2, top: x.idx * cs + cs / 2 - half }
                  : x.type === 'col' ? { left: x.idx * cs + cs / 2 - half, top: 9 * cs - 2 * half - 2 }
                    : { left: ((x.idx % 3) * 3 + 1.5) * cs - half, top: (Math.floor(x.idx / 3) * 3 + 1.5) * cs - half };
                return <span key={k} className={`bs-intel${x.count ? '' : ' zero'}`} style={pos} title={`Sonar: ${x.count} in ${lineName(x.type, x.idx)}`}>{x.count}</span>;
              })} />
            <div className="bs-tools">
              <button type="button" aria-pressed={tool === 'fire'} onClick={() => setTool('fire')}>💥 Fire<small>1 shell</small></button>
              <button type="button" aria-pressed={tool === 'torpedo'} disabled={me.shells < COST.torpedo} onClick={() => setTool('torpedo')}>🚀 Torpedo<small>3 · 3 squares</small></button>
              <button type="button" disabled={tool !== 'torpedo'} onClick={() => setDir(d => (d === 'h' ? 'v' : 'h'))}>{dir === 'h' ? '↔' : '↕'}<small>torpedo direction</small></button>
              <button type="button" onClick={() => setTab('fleet')} disabled={!defendable.length}>🛡 Defend<small>repair / shield</small></button>
            </div>
          </>
        ) : (
          <>
            {defendable.length > 1 && <div className="bs-fleetpick">{defendable.map(f => <button key={f.id} type="button" className="bs-chip" aria-pressed={D?.id === f.id} style={{ '--c': D?.id === f.id ? players[f.id]?.color : 'var(--bs-line)', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => setDefOwner(f.id)}><span className="bs-dot" style={{ background: players[f.id]?.color }} />{f.id === me.id ? 'My fleet' : players[f.id]?.name}{f.ships.some(sh => sh.hits.length && sh.hits.length < sh.size) ? ' 🔧' : ''}</button>)}</div>}
            <div className="bs-banner"><b>{!D || D.id === me.id ? 'Your fleet.' : `${players[D.id]?.name}’s fleet.`}</b> Tap a damaged piece to <b>repair</b> it, or a healthy piece to <b>shield</b> it (1 shell each).</div>
            {D ? <BSGrid ocean mine axis cell={(i) => ({ cls: [dShipAt[i] ? 'ship' : '', dHits.has(i) ? (dShipAt[i] && dShipAt[i].hits.length >= dShipAt[i].size ? 'sunk' : 'hit') : '', D.shields.includes(i) ? 'shield' : '', myDef.has(i) ? 'aim' : allyDef.has(i) ? 'allyaim' : ''].join(' ') })} onCell={fleetTap} /> : <div className="bs-banner">Nothing left to defend — fire away!</div>}
          </>
        )}
        <div className="bs-banner">{me.shells - spent} shell{me.shells - spent === 1 ? '' : 's'} left · tap an aimed square again to cancel · leftover shells are banked</div>
      </>
    );
  } else if (v.phase === 'reveal' && v.reveal) {
    const mine = v.reveal.events.filter(e => e.by === me.id || e.target === me.id);
    const allyIds = new Set((me.allies || []).map(a => a.id));
    const teamNews = teams ? v.reveal.events.filter(e => e.result === 'hit' && e.by !== me.id && e.target !== me.id && (allyIds.has(e.by) || allyIds.has(e.target))) : [];
    body = (
      <>
        <div className="bs-banner"><b>Volley {v.reveal.volley}</b> — watch the big screen!</div>
        <BSGrid ocean mine cell={(i) => ({ cls: [shipAt[i] ? 'ship' : '', hitSet.has(i) ? (shipAt[i].hits.length >= shipAt[i].size ? 'sunk' : 'hit') : '', me.shields.includes(i) ? 'shield' : ''].join(' ') })} />
        <div className="bs-list">
          {mine.length ? mine.map((e, k) => {
            const byMe = e.by === me.id; const who = players[byMe ? e.target : e.by]?.name;
            if (e.type === 'repair' || e.type === 'shield') return null;
            if (e.result === 'hit') return <div key={k} className={e.sunk ? 'sink' : 'hit'}>{byMe ? `You hit ${who} at ${cellName(e.cell)}` : `${who} hit you at ${cellName(e.cell)}`}{e.blown ? ` · ${e.blown} number${e.blown > 1 ? 's' : ''} blown out` : ''}{e.sunk ? ` — ${byMe ? 'you sank their' : 'they sank your'} ${e.shipName}!` : ''}</div>;
            if (e.result === 'blocked') return <div key={k} className="miss">{byMe ? `${who}’s shield blocked your shot` : `Your shield blocked ${who}`}</div>;
            if (e.result === 'miss' && byMe) return <div key={k} className="miss">Splash at {cellName(e.cell)} on {who}</div>;
            return null;
          }) : <div className="miss">Quiet volley for you.</div>}
          {teamNews.map((e, k) => <div key={`t${k}`} className={e.sunk ? 'sink' : allyIds.has(e.by) ? 'hit' : 'miss'}>{allyIds.has(e.by) ? `${players[e.by]?.name} hit ${players[e.target]?.name}` : `${players[e.by]?.name} hit your teammate ${players[e.target]?.name}`}{e.sunk ? ` — sank the ${e.shipName}!` : ''}</div>)}
        </div>
      </>
    );
  } else if (v.phase === 'final') {
    const ranked = v.players.slice().sort((a, b) => b.score - a.score);
    const rank = ranked.findIndex(p => p.id === me.id) + 1;
    const teamWin = teams && v.winnerTeam != null;
    const won = teamWin ? v.winnerTeam === me.team : v.winner === me.id;
    body = (
      <div className="bs-card" style={{ textAlign: 'center' }}>
        <h2 className="bs-h" style={{ fontSize: 48, color: won ? 'var(--bs-green)' : 'var(--bs-brass)' }}>{won ? 'Victory!' : teamWin ? `${TEAMS[v.winnerTeam].name} wins` : `${players[v.winner]?.name || 'Someone'} wins`}</h2>
        {teamWin ? (
          <>
            <p className="bs-sub">{v.winReason === 'admiral' ? `${players[v.winner]?.name} finished the Sudoku — Admiral's Victory` : v.winReason === 'fleet' ? 'The enemy fleet was sunk' : 'Most combined points after the final volley'}</p>
            <div className="bs-row" style={{ justifyContent: 'center' }}>{(v.teams || []).map(t => <span key={t.id} className="bs-chip" style={{ '--c': t.color }}>{t.name} · {t.score}</span>)}</div>
          </>
        ) : <p className="bs-sub">{v.winReason === 'admiral' ? "Admiral's Victory — finished the Sudoku" : v.winReason === 'last' ? 'Last Fleet Floating' : 'Most points after the final volley'}</p>}
        <p className="bs-sub">You finished <b>#{rank}</b> · {players[me.id].score} pts · {players[me.id].stats.hits} hits · {players[me.id].stats.sinks} sinks</p>
        <div className="bs-list" style={{ marginTop: 10, textAlign: 'left' }}>{ranked.map((p, i) => <div key={p.id}>{i + 1}. <b style={{ color: teams ? TEAMS[p.team]?.color : p.color }}>{p.name}</b> — {p.score}</div>)}</div>
        {onExit && <button type="button" className="bs-btn ghost small" style={{ marginTop: 12 }} onClick={onExit}>Leave</button>}
      </div>
    );
  }

  return (
    <div className="bs-phone">
      {header}
      <div className="bs-pbody">{body}</div>
      {toast && <div key={toast.k} className={`bs-toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
