import React, { useEffect, useMemo, useRef, useState } from 'react';
import NCCard, { NCBack, CARD_COLORS } from './NCCard';
import { COLOR_NAMES } from '@/lib/nomadCards/game';
import { ncSfx } from './ncSfx';

export function useLogSounds(v, meId) {
  const last = useRef(null);
  useEffect(() => {
    if (!v) return;
    if (last.current == null) { last.current = v.seq; return; }
    const fresh = v.log.filter(e => e.seq > last.current);
    last.current = v.seq;
    for (const e of fresh.slice(-3)) {
      if (e.kind === 'play') { const c = e.card; if (c && c.c === 'w') ncSfx.wild(); else if (c && (c.v === 'd2')) ncSfx.plus(); else ncSfx.card(); }
      else if (e.kind === 'skip') ncSfx.skip();
      else if (e.kind === 'rev') ncSfx.reverse();
      else if (e.kind === 'draw' || e.kind === 'drew') ncSfx.draw();
      else if (e.kind === 'call') ncSfx.nomad();
      else if (e.kind === 'catch') ncSfx.caught();
      else if (e.kind === 'win' || e.kind === 'final') ncSfx.win();
    }
    if (fresh.length && v.turn === meId && v.phase === 'play' && !fresh.some(e => e.pid === meId && e.kind === 'play')) ncSfx.turn();
  }, [v && v.seq]); // eslint-disable-line react-hooks/exhaustive-deps
}

const fmt = (ms) => Math.max(0, Math.ceil(ms / 1000));

/** One player's hand (phone in party mode, or the whole screen in solo). */
export default function NCHand({ v, act, now, onExit, solo = false, isHost = false, onLobby, onNewGame }) {
  const me = v.me;
  const players = useMemo(() => Object.fromEntries(v.players.map(p => [p.id, p])), [v.players]);
  const [pick, setPick] = useState(null); // { card, need: 'color' | 'target' }
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  useLogSounds(v, me?.id);
  const say = (msg, kind = 'info') => setToast({ msg, kind, k: Math.random() });
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }, [toast]);
  // news from the table
  const lastSeq = useRef(v.seq);
  useEffect(() => {
    const fresh = v.log.filter(e => e.seq > lastSeq.current); lastSeq.current = v.seq;
    for (const e of fresh) {
      if (e.kind === 'catch' && e.pid === me?.id) say('Caught! You forgot to call OUT! — +2 cards', 'bad');
      else if (e.kind === 'catch' && e.by === me?.id) say(`You caught ${players[e.pid]?.name}! +2 for them`, 'ok');
      else if (e.kind === 'swap' && e.target === me?.id) say(`${players[e.pid]?.name} swapped hands with you!`, 'info');
      else if (e.kind === 'rotate') say('Hands rotated!', 'info');
      else if (e.kind === 'timeout' && e.pid === me?.id) say('Out of time — you drew a card', 'bad');
    }
  }, [v.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return <div className="nc-wrap"><div className="nc-panel" style={{ textAlign: 'center' }}><h2 className="nc-h">Watching this game</h2><p className="nc-sub">You joined after it started — you’re in the next one.</p>{onExit && <button type="button" className="nc-btn ghost" onClick={onExit}>Leave</button>}</div></div>;

  const run = async (type, payload = {}) => {
    if (busy) return null; setBusy(true); ncSfx.unlock();
    try { const r = await act(type, payload); if (r && r.ok === false && r.error) { say(r.error, 'bad'); ncSfx.bad(); } return r; }
    finally { setBusy(false); }
  };
  const tapCard = (c) => {
    if (!me.myTurn) { say(`It’s ${players[v.turn]?.name}’s turn`, 'info'); return; }
    if (!me.playable.includes(c.id)) { ncSfx.bad(); say(v.drawStack ? `Stack a +${v.stackKind === 'w4' ? 4 : 2} or draw ${v.drawStack}` : c.v === 'w4' ? 'Wild +4 only when you have no cards of the current colour' : 'That one doesn’t match', 'bad'); return; }
    const callNow = me.hand.length === 2 && me.called;
    if (c.c === 'w') { setPick({ card: c, need: 'color' }); return; }
    if (v.settings.sevenZero && c.v === '7' && v.players.length > 1) { setPick({ card: c, need: 'target' }); return; }
    run('play', { card: c.id, call: callNow });
  };
  const finishPick = (extra) => { const c = pick.card; setPick(null); run('play', { card: c.id, call: me.hand.length === 2 && me.called, ...extra }); };

  const left = v.turnEndsAt - now;
  const turnP = players[v.turn];
  const myTurn = me.myTurn;
  const vulnerable = v.players.filter(p => p.id !== me.id && p.vulnerable);
  const status = v.phase !== 'play' ? '' : myTurn ? (me.drawn != null ? 'You drew a playable card — play it or keep it' : v.drawStack ? `+${v.drawStack} coming at you — stack or draw!` : 'Your turn!') : `${turnP?.name}’s turn`;
  const fanW = Math.max(46, Math.min(104, (typeof window !== 'undefined' ? window.innerWidth : 400) / (me.hand.length * 0.55 + 1.2)));

  return (
    <div className={`nc-hand-screen${solo ? ' solo' : ''}`}>
      <div className="nc-hhead">
        <div className={`nc-status${myTurn ? ' mine' : ''}`}>{status}</div>
        {v.phase === 'play' && <div className="nc-timer"><i style={{ width: `${Math.max(0, Math.min(100, (left / (v.settings.turnSec * 1000)) * 100))}%` }} /></div>}
        {v.phase === 'play' && <span className="nc-tsec">{fmt(left)}s</span>}
        {onExit && <button type="button" className="nc-btn ghost small" onClick={onExit} aria-label="Leave">✕</button>}
      </div>
      <div className="nc-opps">
        {v.players.filter(p => p.id !== me.id).map(p => (
          <div key={p.id} className={`nc-opp${v.turn === p.id ? ' turn' : ''}`} style={{ '--c': p.color }}>
            <b>{p.name}</b>
            <span className="cnt">{p.count} card{p.count === 1 ? '' : 's'}</span>
            {p.called && p.count === 1 && <span className="tag">OUT!</span>}
            {p.vulnerable && <button type="button" className="nc-btn catch small" onClick={() => run('catch', { target: p.id })}>Catch!</button>}
          </div>
        ))}
      </div>
      <div className="nc-center">
        <button type="button" className={`nc-pile${myTurn && !me.drawn ? ' can' : ''}`} onClick={() => myTurn && !me.drawn && run('draw')} aria-label="Draw a card">
          <NCBack w={solo ? 86 : 66} />
          <span>{v.drawStack ? `Draw ${v.drawStack}` : 'Draw'}</span>
        </button>
        <div className="nc-discard">
          <NCCard key={v.top.id} card={v.top} chosen={v.color} w={solo ? 96 : 74} className="landed" />
          <span className="nc-colorchip" style={{ background: CARD_COLORS[v.color] }}>{COLOR_NAMES[v.color]}</span>
        </div>
        <div className={`nc-dir ${v.dir === 1 ? 'cw' : 'ccw'}`} title="Direction of play">{v.dir === 1 ? '↻' : '↺'}</div>
      </div>
      <div className="nc-actions">
        {me.drawn != null && myTurn && <button type="button" className="nc-btn" onClick={() => run('pass')}>Keep it</button>}
        <button type="button" className={`nc-btn nomad${me.canCall ? ' hot' : ''}`} disabled={!me.canCall && !(me.called && me.hand.length <= 2)} onClick={() => run('call')}>{me.called && me.hand.length <= 2 ? 'OUT! ✓' : 'OUT!'}</button>
        {vulnerable.length > 0 && <button type="button" className="nc-btn catch" onClick={() => run('catch', { target: vulnerable[0].id })}>Catch {vulnerable[0].name}!</button>}
      </div>
      <div className="nc-fan" style={{ '--cw': `${fanW}px` }}>
        {me.hand.map((c, i) => {
          const ok = myTurn && me.playable.includes(c.id);
          return <div key={c.id} className={`nc-slot${ok ? ' up' : ''}${me.drawn === c.id ? ' drawn' : ''}`} style={{ zIndex: i }}><NCCard card={c} w={fanW} playable={ok} dim={myTurn && !ok} onClick={() => tapCard(c)} /></div>;
        })}
      </div>
      <div className="nc-me"><span className="nc-dot" style={{ background: players[me.id]?.color }} />{players[me.id]?.name} · {me.hand.length} card{me.hand.length === 1 ? '' : 's'} · {players[me.id]?.score} pts{v.settings.target ? ` / ${v.settings.target}` : ''}</div>

      {pick && (
        <div className="nc-modal" onClick={() => setPick(null)}>
          <div className="nc-panel" onClick={e => e.stopPropagation()}>
            {pick.need === 'color' ? (
              <>
                <h3 className="nc-h">Pick a colour</h3>
                <div className="nc-colors">{['r', 'y', 'g', 'b'].map(k => <button key={k} type="button" style={{ background: CARD_COLORS[k] }} onClick={() => finishPick({ color: k })}>{COLOR_NAMES[k]}</button>)}</div>
              </>
            ) : (
              <>
                <h3 className="nc-h">Swap hands with…</h3>
                <div className="nc-targets">{v.players.filter(p => p.id !== me.id).map(p => <button key={p.id} type="button" className="nc-btn" style={{ borderColor: p.color }} onClick={() => finishPick({ target: p.id })}>{p.name} · {p.count}</button>)}</div>
              </>
            )}
            <button type="button" className="nc-btn ghost small" style={{ marginTop: 10 }} onClick={() => setPick(null)}>Cancel</button>
          </div>
        </div>
      )}
      {(v.phase === 'roundover' || v.phase === 'final') && v.roundSummary && (
        <div className="nc-modal">
          <div className="nc-panel" style={{ textAlign: 'center' }}>
            <h2 className="nc-h" style={{ fontSize: 44, color: v.roundSummary.winner === me.id ? '#3ef08a' : 'var(--nc-gold)' }}>
              {v.phase === 'final' ? (v.winner === me.id ? 'You win the game!' : `${players[v.winner]?.name} wins the game!`) : (v.roundSummary.winner === me.id ? 'You won the round!' : `${players[v.roundSummary.winner]?.name} wins the round`)}
            </h2>
            <p className="nc-sub">+{v.roundSummary.points} points from everyone’s leftover cards</p>
            <div className="nc-scores">{v.players.slice().sort((a, b) => b.score - a.score).map(p => <div key={p.id} style={{ fontWeight: p.id === me.id ? 900 : 500 }}><span className="nc-dot" style={{ background: p.color }} />{p.name}<b>{p.score}</b></div>)}</div>
            {v.phase === 'roundover' ? <p className="nc-sub">Next round in {fmt(v.nextAt - now)}…</p> : solo || isHost ? (
              <div className="nc-row" style={{ justifyContent: 'center' }}><button type="button" className="nc-btn primary" onClick={onNewGame}>Play again</button>{isHost && <button type="button" className="nc-btn" onClick={onLobby}>Back to lobby</button>}{onExit && <button type="button" className="nc-btn ghost" onClick={onExit}>Menu</button>}</div>
            ) : <p className="nc-sub">Waiting for the host…</p>}
          </div>
        </div>
      )}
      {toast && <div key={toast.k} className={`nc-toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
