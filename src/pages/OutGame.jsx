import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/home/Header';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import NCSolo from '@/components/nomadCards/NCSolo';
import NCCard from '@/components/nomadCards/NCCard';
import { NCDisplay, NCHost, NCPlayer } from '@/components/nomadCards/NCOnline';
import { ncSfx } from '@/components/nomadCards/ncSfx';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';
import '@/components/nomadCards/nc.css';

// OUT! — /games/out
//   ?host=1        host on the TV (TNG Host Panel)
//   ?room=CODE     join on a phone (your hand)
//   ?display=CODE  read-only table for TNG Game Display / a second TV
function SoloOptions({ field, opts, solo, setSolo }) {
  return <div className="nc-seg">{opts.map(([v, l]) => <button key={String(v)} type="button" aria-pressed={solo[field] === v} onClick={() => setSolo(s => ({ ...s, [field]: v }))}>{l}</button>)}</div>;
}
export default function NomadCardsGame() {
  const [params, setParams] = useSearchParams();
  const room = (params.get('room') || '').toUpperCase();
  const display = (params.get('display') || '').toUpperCase();
  const [screen, setScreen] = useState(room ? 'join' : params.get('host') === '1' ? 'host' : 'menu');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [solo, setSolo] = useState({ rivals: 3, level: 'normal', target: 250, stacking: false, sevenZero: false });
  const [muted, setMuted] = useState(ncSfx.muted);
  const identity = useTngGameIdentity();
  const name = identity.publicName;
  const toMenu = () => { setScreen('menu'); setParams({}, { replace: true }); };

  if (display) return <div className="nc-root full"><NCDisplay code={display} /></div>;
  if (screen === 'host') return <div className="nc-root full"><NCHost onExit={toMenu} /></div>;
  if (screen === 'join' && /^[A-Z]{5}$/.test(room)) return <div className="nc-root full"><NCPlayer code={room} name={name} identityReady={!identity.loading && Boolean(name)} onExit={toMenu} /></div>;
  if (screen === 'solo') return <div className="nc-root full"><NCSolo name={name || 'You'} rivals={solo.rivals} level={solo.level} settings={{ target: solo.target, stacking: solo.stacking, sevenZero: solo.sevenZero }} onExit={toMenu} /></div>;

  const join = () => { const c = code.trim().toUpperCase(); if (!/^[A-Z]{5}$/.test(c)) { setErr('Table codes are 5 letters.'); return; } setParams({ room: c }, { replace: true }); setScreen('join'); };
  return (
    <div className="nc-root">
      <Header />
      <div className="nc-wrap" style={{ maxWidth: 860 }}>
        <div style={{ textAlign: 'center', padding: '14px 0 4px' }}>
          <h1 className="nc-h nc-logo">OUT!</h1>
          <p className="nc-sub">Match the colour or the number. Skip ’em, reverse ’em, make ’em draw — and holler <b>OUT!</b> on your last card.</p>
          <div className="nc-fanlogo">{[{ c: 'r', v: '7' }, { c: 'y', v: 'skip' }, { c: 'w', v: 'w4' }, { c: 'g', v: 'rev' }, { c: 'b', v: 'd2' }].map((c, i) => <NCCard key={i} card={c} w={64} style={{ transform: `rotate(${(i - 2) * 10}deg) translateY(${Math.abs(i - 2) * 6}px)` }} />)}</div>
        </div>
        <div className="nc-panel" style={{ textAlign: 'center' }}>
          <div className="nc-label" style={{ marginBottom: 8 }}>Got a table code?</div>
          <div className="nc-row" style={{ justifyContent: 'center' }}>
            <input className="nc-input" style={{ maxWidth: 220 }} value={code} maxLength={5} placeholder="CODE" onChange={e => { setCode(e.target.value.toUpperCase()); setErr(''); }} onKeyDown={e => e.key === 'Enter' && join()} />
            <button type="button" className="nc-btn primary" onClick={join}>Join</button>
          </div>
          {err && <div className="nc-err">{err}</div>}
        </div>
        <div className="nc-modes">
          <button type="button" className="nc-mode" onClick={() => { ncSfx.unlock(); setScreen('host'); }}><b>Host a table</b><span>Play together on your own devices. 2–10 seats including you, with a private hand for everyone. CPUs can fill seats.</span></button>
          <div className="nc-mode solo">
            <b>Solo vs CPU</b>
            <div className="nc-row"><span className="nc-label">Rivals</span><SoloOptions solo={solo} setSolo={setSolo} field="rivals" opts={[[1, '1'], [2, '2'], [3, '3'], [5, '5']]} /></div>
            <div className="nc-row"><span className="nc-label">CPU skill</span><SoloOptions solo={solo} setSolo={setSolo} field="level" opts={[['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Sharp']]} /></div>
            <div className="nc-row"><span className="nc-label">Play to</span><SoloOptions solo={solo} setSolo={setSolo} field="target" opts={[[0, 'One round'], [100, '100'], [250, '250']]} /></div>
            <div className="nc-row"><span className="nc-label">House rules</span><SoloOptions solo={solo} setSolo={setSolo} field="stacking" opts={[[false, 'No stacking'], [true, 'Stacking']]} /><SoloOptions solo={solo} setSolo={setSolo} field="sevenZero" opts={[[false, 'No 7-0'], [true, '7-0 swaps']]} /></div>
            <p className="nc-sub" style={{ margin: 0 }}>Playing as <b style={{ color: 'var(--nc-gold)' }}>{name || (identity.loading ? 'Loading profile…' : 'Guest')}</b></p>
            <div className="nc-row"><button type="button" className="nc-btn primary" onClick={() => { ncSfx.unlock(); setScreen('solo'); }}>Deal me in</button><button type="button" className="nc-btn ghost small" onClick={() => { ncSfx.setMuted(!muted); setMuted(!muted); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button></div>
          </div>
        </div>
        <details className="nc-panel nc-rules">
          <summary>How to play</summary>
          <ul>
            <li>Everyone starts with 7 cards. On your turn, play a card that matches the top card’s <b>colour</b> or its <b>number/symbol</b>.</li>
            <li><b>Skip</b> skips the next player · <b>Reverse</b> flips the direction · <b>+2</b> makes the next player draw 2 and lose their turn.</li>
            <li><b>Wild</b> lets you pick the colour. <b>Wild +4</b> picks the colour and the next player draws 4 — only when you have no card of the current colour.</li>
            <li>Can’t play? Draw one. If it fits, you can play it right away.</li>
            <li>Down to one card? Hit <b>OUT!</b> before the next player moves — anyone who catches you first makes you draw 2.</li>
            <li>First to empty their hand wins the round and scores everyone’s leftover cards (numbers = face value, Skip/Reverse/+2 = 20, Wilds = 50).</li>
            <li>House rules: <b>Stacking</b> (answer a +2 with a +2, or a +4 on either, to pass it on) and <b>7-0</b> (a 7 swaps hands with anyone, a 0 passes every hand along).</li>
          </ul>
        </details>
      </div>
      <TestFeedbackButton gameId="out" roomCode={room} testerName={name} />
    </div>
  );
}
