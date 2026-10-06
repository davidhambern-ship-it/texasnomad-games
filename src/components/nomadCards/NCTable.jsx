import React, { useEffect, useState } from 'react';
import NCCard, { NCBack, CARD_COLORS } from './NCCard';
import { COLOR_NAMES, cardLabel } from '@/lib/nomadCards/game';
import { useLogSounds } from './NCHand';
import { ncSfx } from './ncSfx';

const fmt = (ms) => Math.max(0, Math.ceil(ms / 1000));
const TARGETS = [[0, 'One round'], [100, '100'], [250, '250'], [500, '500']];
const TURNS = [20, 30, 45, 60];

function TableOptions({ value, opts, field, act }) {
  return <div className="nc-seg">{opts.map(([v, l]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => act('settings', { [field]: v })}>{l}</button>)}</div>;
}
/** The TV: lobby, then the table with every seat, the piles and the action. */
export default function NCTable({ data, isHost, act, offset = 0, onExit, joinUrl }) {
  const room = data.room;
  const g = room.game;
  const [now, setNow] = useState(Date.now() + offset);
  const [banner, setBanner] = useState(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offset), 200); return () => clearInterval(t); }, [offset]);
  useLogSounds(g, null);
  // big call-outs for the room
  const [lastSeq, setLastSeq] = useState(g ? g.seq : 0);
  useEffect(() => {
    if (!g) return;
    const fresh = g.log.filter(e => e.seq > lastSeq); setLastSeq(g.seq);
    const big = fresh.reverse().find(e => ['call', 'catch', 'swap', 'rotate', 'win', 'final', 'rev', 'skip', 'stack'].includes(e.kind) || (e.kind === 'play' && e.card && e.card.c === 'w'));
    if (big) setBanner({ k: big.seq, text: big.kind === 'call' ? `${big.text.split(':')[0]}: OUT!` : big.kind === 'rev' ? 'REVERSE!' : big.kind === 'skip' ? big.text : big.text, kind: big.kind });
  }, [g && g.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!banner) return undefined; const t = setTimeout(() => setBanner(null), 1800); return () => clearTimeout(t); }, [banner]);

  // ── lobby ──
  if (!g) {
    const S = room.settings;
    return (
      <div className="nc-wrap" style={{ maxWidth: 1200 }}>
        <div className="nc-lobby">
          <div className="nc-panel" style={{ textAlign: 'center' }}>
            <h1 className="nc-h nc-logo" style={{ fontSize: 'clamp(44px, 5vw, 84px)' }}>OUT!</h1>
            <p className="nc-sub">On your phone go to <b style={{ color: '#fff' }}>{joinUrl}</b> and enter</p>
            <div className="nc-joincode">{room.code}</div>
            <div className="nc-row" style={{ justifyContent: 'center', marginTop: 10 }}>
              {room.roster.length ? room.roster.map(p => <span key={p.id} className="nc-chip" style={{ '--c': p.color }}><span className="nc-dot" style={{ background: p.color }} />{p.name}{p.cpu ? ' · CPU' : ''}{isHost && !p.isHost && <button type="button" className="nc-x" onClick={() => act('kick', { playerId: p.id })} aria-label={`Remove ${p.name}`}>✕</button>}</span>) : <span className="nc-sub">Waiting for players to join…</span>}
            </div>
            <div className="nc-fanlogo">{[{ c: 'r', v: '7' }, { c: 'y', v: 'skip' }, { c: 'w', v: 'wild' }, { c: 'g', v: 'rev' }, { c: 'b', v: 'd2' }].map((c, i) => <NCCard key={i} card={c} w={70} style={{ transform: `rotate(${(i - 2) * 9}deg) translateY(${Math.abs(i - 2) * 6}px)` }} />)}</div>
          </div>
          {isHost ? (
            <div className="nc-panel nc-settings">
              <div className="nc-row"><span className="nc-label">Play to</span><TableOptions act={act} value={S.target} field="target" opts={TARGETS} /></div>
              <div className="nc-row"><span className="nc-label">Turn timer</span><TableOptions act={act} value={S.turnSec} field="turnSec" opts={TURNS.map(t => [t, `${t}s`])} /></div>
              <div className="nc-row"><span className="nc-label">Stacking</span><TableOptions act={act} value={S.stacking} field="stacking" opts={[[false, 'Off'], [true, 'On']]} /></div>
              <p className="nc-sub" style={{ margin: '-4px 0 0' }}>Stack a +2 on a +2 (or a +4 on either) to pass the pain along.</p>
              <div className="nc-row"><span className="nc-label">7-0 swaps</span><TableOptions act={act} value={S.sevenZero} field="sevenZero" opts={[[false, 'Off'], [true, 'On']]} /></div>
              <p className="nc-sub" style={{ margin: '-4px 0 0' }}>A 7 swaps hands with anyone; a 0 passes every hand along.</p>
              <div className="nc-row"><button type="button" className="nc-btn" disabled={room.roster.length >= 10} onClick={() => act('addCpu')}>+ Add CPU player</button><span className="nc-sub" style={{ margin: 0 }}>2–10 players</span></div>
              <button type="button" className="nc-btn primary big" disabled={room.roster.length < 2} onClick={() => { ncSfx.unlock(); act('start'); }}>{room.roster.length < 2 ? 'Need 2+ players' : 'Deal the cards'}</button>
              <div className="nc-row"><button type="button" className="nc-btn ghost small" onClick={onExit}>← Exit</button><span className="nc-sub" style={{ margin: 0 }}>You play too. A TV is optional.</span></div>
            </div>
          ) : <div className="nc-panel"><p className="nc-sub">Waiting for the host to deal…</p></div>}
        </div>
      </div>
    );
  }

  // ── table ──
  const n = g.players.length;
  const seats = g.players.map((p, i) => {
    const a = Math.PI / 2 + (i / n) * Math.PI * 2; // first seat at the bottom, clockwise
    return { p, x: 50 + Math.cos(a) * 41, y: 50 + Math.sin(a) * 38 };
  });
  const turnP = g.players.find(p => p.id === g.turn);
  const left = g.turnEndsAt - now;
  const ranked = g.players.slice().sort((a, b) => b.score - a.score);
  return (
    <div className="nc-tv">
      <div className="nc-tvtop">
        <span className="nc-h nc-brand">OUT!</span>
        <span className="nc-round">Round {g.round}{g.settings.target ? ` · to ${g.settings.target}` : ' · one round'}{g.settings.stacking ? ' · stacking' : ''}{g.settings.sevenZero ? ' · 7-0' : ''}</span>
        <span className="nc-code"><b>{room.code}</b><small>{joinUrl}</small></span>
      </div>
      <div className="nc-felt">
        <div className={`nc-ring ${g.dir === 1 ? 'cw' : 'ccw'}`} style={{ '--cc': CARD_COLORS[g.color] }} />
        {seats.map(({ p, x, y }) => {
          const turn = g.turn === p.id && g.phase === 'play';
          return (
            <div key={p.id} className={`nc-seat${turn ? ' turn' : ''}${p.count === 1 ? ' last' : ''}`} style={{ left: `${x}%`, top: `${y}%`, '--c': p.color }}>
              <div className="nc-minifan">{Array.from({ length: Math.min(p.count, 12) }, (_, k) => <NCBack key={k} w={26} style={{ transform: `rotate(${(k - Math.min(p.count, 12) / 2) * 6}deg)`, marginLeft: k ? -18 : 0 }} />)}</div>
              <div className="nc-seatname"><span className="nc-dot" style={{ background: p.color }} />{p.name}{p.cpu ? <small> CPU</small> : null}</div>
              <div className="nc-seatmeta">{p.count} card{p.count === 1 ? '' : 's'} · {p.score} pts</div>
              {p.called && p.count === 1 && <span className="nc-badge">OUT!</span>}
              {p.vulnerable && <span className="nc-badge warn">didn’t call!</span>}
              {turn && <div className="nc-turnbar"><i style={{ width: `${Math.max(0, Math.min(100, (left / (g.settings.turnSec * 1000)) * 100))}%` }} /></div>}
            </div>
          );
        })}
        <div className="nc-piles">
          <div className="nc-deck"><NCBack w={92} /><span>{g.deckCount}</span></div>
          <div className="nc-discardpile">
            {g.under.map((c, i) => <NCCard key={c.id} card={c} w={110} className="under" style={{ transform: `rotate(${((c.id * 37) % 30) - 15}deg)`, opacity: 0.55 + i * 0.1 }} />)}
            <NCCard key={g.top.id} card={g.top} chosen={g.color} w={110} className="landed top" style={{ transform: `rotate(${((g.top.id * 37) % 20) - 10}deg)` }} />
          </div>
          <div className="nc-colorbig" style={{ background: CARD_COLORS[g.color] }}>{COLOR_NAMES[g.color]}</div>
          {g.drawStack > 0 && <div className="nc-stackbadge">+{g.drawStack}</div>}
        </div>
        {g.phase === 'play' && <div className="nc-turnlabel">{turnP?.name}’s turn · {fmt(left)}s</div>}
      </div>
      <div className="nc-side">
        <div className="nc-panel">
          <h4>Table talk</h4>
          <div className="nc-feed">{g.log.slice().reverse().map(e => <div key={e.seq} className={e.kind}>{e.text}</div>)}</div>
        </div>
        <div className="nc-panel">
          <h4>Scores</h4>
          {ranked.map((p, i) => <div key={p.id} className="nc-lbrow"><span>{i + 1}</span><span><span className="nc-dot" style={{ background: p.color }} />{p.name}</span><b>{p.score}</b></div>)}
        </div>
        {isHost && g.phase !== 'final' && <button type="button" className="nc-btn ghost small" onClick={() => { if (window.confirm('End this game?')) act('lobby'); }}>End game</button>}
      </div>
      {banner && <div key={banner.k} className={`nc-banner ${banner.kind}`}>{banner.text}</div>}
      {(g.phase === 'roundover' || g.phase === 'final') && g.roundSummary && (
        <div className="nc-modal">
          <div className="nc-panel" style={{ width: 'min(620px, 100%)', textAlign: 'center' }}>
            <h2 className="nc-h" style={{ fontSize: 60, color: 'var(--nc-gold)' }}>{g.phase === 'final' ? `${g.players.find(p => p.id === g.winner)?.name} wins!` : `${g.players.find(p => p.id === g.roundSummary.winner)?.name} takes round ${g.round}`}</h2>
            <p className="nc-sub">+{g.roundSummary.points} points · {g.roundSummary.lines.map(l => `${l.name} ${l.cards} card${l.cards === 1 ? '' : 's'}`).join(' · ')}</p>
            <div className="nc-scores big">{ranked.map(p => <div key={p.id}><span className="nc-dot" style={{ background: p.color }} />{p.name}<b>{p.score}</b></div>)}</div>
            {g.phase === 'roundover' ? <p className="nc-sub">Next round in {fmt(g.nextAt - now)}…</p> : isHost && (
              <div className="nc-row" style={{ justifyContent: 'center' }}><button type="button" className="nc-btn primary" onClick={() => act('start')}>New game</button><button type="button" className="nc-btn" onClick={() => act('lobby')}>Back to lobby</button><button type="button" className="nc-btn ghost" onClick={onExit}>Exit</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export { cardLabel };
