import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/home/Header';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import STPractice from '@/components/seeThat/STPractice';
import STEditor from '@/components/seeThat/STEditor';
import { STDisplay, STHost, STPlayer } from '@/components/seeThat/STOnline';
import { sfx } from '@/components/seeThat/stSfx';
import { loadScene, loadSceneList } from '@/api/seeThatApi';
import '@/components/seeThat/st.css';

// /games/see-that              menu
// /games/see-that?room=CODE    join on a phone
// /games/see-that?host=1      host directly from the TNG Host Panel
// /games/see-that?display=CODE read-only big screen (TNG Game Display / second TV)
// /games/see-that?editor=1     scene editor
export default function SeeThatGame() {
  const [params, setParams] = useSearchParams();
  const room = (params.get('room') || '').toUpperCase();
  const display = (params.get('display') || '').toUpperCase();
  const directHost = params.get('host') === '1';
  const [screen, setScreen] = useState(
    params.get('editor') ? 'editor' : room ? 'join' : directHost ? 'host' : 'menu',
  );
  const [scenes, setScenes] = useState([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState(() => { try { return localStorage.getItem('st_name') || ''; } catch { return ''; } });
  const [practice, setPractice] = useState(null);
  const [muted, setMuted] = useState(sfx.muted);
  const [err, setErr] = useState('');

  useEffect(() => { loadSceneList().then(setScenes).catch(() => setScenes([])); }, []);
  const toMenu = () => { setScreen('menu'); setPractice(null); setParams({}, { replace: true }); };
  const leaveHost = () => {
    if (directHost) {
      window.location.replace('/host');
      return;
    }
    toMenu();
  };

  if (display) return <div className="st-root"><STDisplay code={display} scenes={scenes} /></div>;

  let body;
  if (screen === 'host') body = <STHost scenes={scenes} onExit={leaveHost} />;
  else if (screen === 'join' && /^[A-Z]{5}$/.test(room)) body = <STPlayer code={room} name={name} setName={setName} onExit={toMenu} />;
  else if (screen === 'editor') body = <STEditor onExit={toMenu} />;
  else if (screen === 'practice' && practice) body = <STPractice key={practice.k} scene={practice.scene} imageUrl={practice.scene.__img} count={10} seconds={120} name={name || 'You'} onExit={toMenu} />;
  else if (screen === 'pickscene') {
    body = (
      <div className="st-wrap">
        <div className="st-card st-grid">
          <h2 className="st-h" style={{ fontSize: 44, color: 'var(--st-gold)' }}>Practice — pick a scene</h2>
          <div className="st-scenes">
            {scenes.map(s => <button key={s.id} type="button" className="st-scene" onClick={async () => { try { sfx.unlock(); const sc = await loadScene(s.id); setPractice({ scene: sc, k: Date.now() }); setScreen('practice'); } catch { setErr('Couldn’t load that scene.'); } }}><img src={s.image} alt="" loading="lazy" /><span>{s.title} · {s.dynamic ? 'new layout every game' : `${s.count} objects`}</span></button>)}
          </div>
          {!scenes.length && <p className="st-sub">No scenes installed yet — make one in the scene editor.</p>}
          {err && <div className="st-err">{err}</div>}
          <div><button type="button" className="st-btn ghost small" onClick={toMenu}>← Back</button></div>
        </div>
      </div>
    );
  } else {
    const join = () => {
      const c = code.trim().toUpperCase();
      if (!/^[A-Z]{5}$/.test(c)) { setErr('Game codes are 5 letters.'); return; }
      setParams({ room: c }, { replace: true }); setScreen('join');
    };
    body = (
      <div className="st-wrap">
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          <h1 className="st-h st-logo">See That<span className="q">?!</span></h1>
          <p className="st-sub">The hidden-object party game. The scene goes on the big screen — everyone races to spot things on their phones.</p>
        </div>
        <div className="st-grid">
          <div className="st-card">
            <div className="st-label-sm" style={{ marginBottom: 8 }}>Joining a game? Enter the code from the big screen</div>
            <div className="st-row">
              <input className="st-input" style={{ flex: '1 1 160px', textTransform: 'uppercase', letterSpacing: '.25em', fontSize: 22 }} maxLength={5} placeholder="CODE" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} onKeyDown={e => e.key === 'Enter' && join()} />
              <button type="button" className="st-btn primary" style={{ padding: '12px 22px', fontSize: 18 }} onClick={join}>Join</button>
            </div>
            {err && <div className="st-err">{err}</div>}
          </div>
          <div className="st-modes">
            <button type="button" className="st-mode" onClick={() => { sfx.unlock(); setScreen('host'); }}>
              <div className="st-h">Host a game</div>
              <p>Open this on the TV or a laptop. You pick the scene, players join with the code, and the hunt plays out on the big screen.</p>
            </button>
            <button type="button" className="st-mode" onClick={() => setScreen('pickscene')}>
              <div className="st-h">Practice solo</div>
              <p>Hunt on your own against the clock — same rules, no room needed.</p>
            </button>
            <button type="button" className="st-mode" onClick={() => { setScreen('editor'); setParams({ editor: '1' }, { replace: true }); }}>
              <div className="st-h">Scene editor</div>
              <p>Turn a GPT picture into a new scene: box the hidden objects, test it, download the files.</p>
            </button>
          </div>
          <div className="st-card">
            <div className="st-label-sm">How it plays</div>
            <ul className="st-steps">
              <li><b>Spot it, tap it.</b> First player to tap an object claims it: +100, and quick back-to-back finds build a combo.</li>
              <li><b>Pinch or scroll to zoom</b> into the scene on your phone, and drag to look around.</li>
              <li><b>Hints:</b> 2 per round — a ring shows roughly where something is hiding (−25).</li>
              <li><b>No wild tapping:</b> a miss costs 10 points and locks you out for a moment; spam taps lock you out longer.</li>
            </ul>
            <div className="st-row" style={{ marginTop: 10 }}>
              <button type="button" className="st-btn small ghost" onClick={() => { sfx.setMuted(!muted); setMuted(!muted); }}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fullScreen = screen === 'host' || screen === 'practice';
  return (
    <div className="st-root">
      {!fullScreen && <Header />}
      {body}
      {!fullScreen && <TestFeedbackButton gameId="see-that" roomCode={room} testerName={name} />}
    </div>
  );
}
