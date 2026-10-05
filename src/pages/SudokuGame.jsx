import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/home/Header';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import { BSDisplay, BSHost, BSPlayer } from '@/components/battleSudoku/BSOnline';
import { sfx } from '@/components/battleSudoku/bsSfx';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';
import '@/components/battleSudoku/bs.css';

// BattleSudoku — /games/sudoku
//   ?room=CODE     join on a phone
//   ?display=CODE  read-only big screen (TNG Game Display / second TV)
//   ?host=1        host directly from the TNG Host Panel
export default function SudokuGame() {
  const [params, setParams] = useSearchParams();
  const room = (params.get('room') || '').toUpperCase();
  const display = (params.get('display') || '').toUpperCase();
  const [screen, setScreen] = useState(room ? 'join' : params.get('host') === '1' ? 'host' : 'menu');
  const [code, setCode] = useState('');
  const identity = useTngGameIdentity();
  const name = identity.publicName;
  const [muted, setMuted] = useState(sfx.muted);
  const [err, setErr] = useState('');
  const toMenu = () => { setScreen('menu'); setParams({}, { replace: true }); };

  if (display) return <div className="bs-root"><BSDisplay code={display} /></div>;

  let body;
  if (screen === 'host') body = <BSHost onExit={toMenu} />;
  else if (screen === 'join' && /^[A-Z]{5}$/.test(room)) body = <BSPlayer code={room} name={name} identityReady={!identity.loading && Boolean(name)} onExit={toMenu} />;
  else {
    const join = () => { const c = code.trim().toUpperCase(); if (!/^[A-Z]{5}$/.test(c)) { setErr('Battle codes are 5 letters.'); return; } setParams({ room: c }, { replace: true }); setScreen('join'); };
    body = (
      <div className="bs-wrap">
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          <h1 className="bs-h bs-logo">Battle<b>Sudoku</b></h1>
          <p className="bs-sub">Everyone solves the same Sudoku. Every correct number loads your cannon — then every volley, fire at your rivals’ hidden fleets.</p>
        </div>
        <div className="bs-grid2">
          <div className="bs-card">
            <div className="bs-label" style={{ marginBottom: 8 }}>Joining a battle? Enter the code from the big screen</div>
            <div className="bs-row">
              <input className="bs-input" style={{ flex: '1 1 160px', textTransform: 'uppercase', letterSpacing: '.25em', fontSize: 22 }} maxLength={5} placeholder="CODE" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} onKeyDown={e => e.key === 'Enter' && join()} />
              <button type="button" className="bs-btn primary" style={{ padding: '12px 22px', fontSize: 18 }} onClick={join}>Join</button>
            </div>
            {err && <div className="bs-err">{err}</div>}
          </div>
          <div className="bs-card">
            <div className="bs-label">TNG player</div>
            <p className="bs-sub" style={{ marginTop: 8 }}>
              Playing as <b style={{ color: 'var(--bs-brass)' }}>{name || (identity.loading ? 'Loading profile…' : 'TNG profile unavailable')}</b>
            </p>
            {identity.error && <div className="bs-err">{identity.error}</div>}
          </div>
          <div className="bs-modes">
            <button type="button" className="bs-mode" onClick={() => { sfx.unlock(); setScreen('host'); }}><div className="bs-h">Host a battle</div><p>Open the battle from the Host Panel. Captains join on their phones — 2 to 8 human players.</p></button>
          </div>
          <div className="bs-card">
            <div className="bs-label">How it plays</div>
            <ul className="bs-steps">
              <li><b>Hide your fleet</b> — 5 ships on your 9×9 grid (shuffle until you like it).</li>
              <li><b>Solve phase:</b> correct numbers earn shells (4 in a row = bonus). Wrong numbers cost a shell. Finish a row, column or box to <b>ping sonar</b> on your rival.</li>
              <li><b>Battle phase:</b> boards lock. <b>Fire</b> (1 shell), <b>torpedo</b> 3 squares (3), <b>repair</b> a damaged piece or <b>shield</b> one (1). Unspent shells bank (max 8).</li>
              <li><b>Reveal:</b> every shot lands at once. A hit blows out the numbers you’d solved there. Sinking a ship freezes its captain and steals shells.</li>
              <li><b>★ Bounty</b> on whoever has solved the most — hits on them pay extra. Sunk fleets become <b>Ghosts</b> who keep firing.</li>
              <li><b>Win:</b> finish the Sudoku first (Admiral’s Victory), be the Last Fleet Floating, or have the most points after the last volley.</li>
            </ul>
            <div className="bs-row" style={{ marginTop: 10 }}><button type="button" className="bs-btn small ghost" onClick={() => { sfx.setMuted(!muted); setMuted(!muted); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button></div>
          </div>
        </div>
      </div>
    );
  }
  const full = screen === 'host';
  return (
    <div className="bs-root">
      {!full && <Header />}
      {body}
      {!full && <TestFeedbackButton gameId="sudoku" roomCode={room} testerName={name} />}
    </div>
  );
}
