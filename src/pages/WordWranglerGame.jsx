import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/home/Header';
import WWOnline, { WWDisplay } from '@/components/wordWrangler/WWOnline';
import WWIcon from '@/components/wordWrangler/WWIcons';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import { loadWordDict } from '@/lib/wordWranglerDict';
import { SPECIALS } from '@/lib/wordWranglerEngine';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';
import '@/components/wordWrangler/ww.css';

export default function WordWranglerGame() {
  const [params, setParams] = useSearchParams();
  const roomParam = (params.get('room') || '').toUpperCase();
  const validRoom = /^[A-Z]{5}$/.test(roomParam) ? roomParam : '';
  const displayParam = (params.get('display') || '').toUpperCase();
  const validDisplay = /^[A-Z]{5}$/.test(displayParam) ? displayParam : '';
  const [launchedFromHost] = useState(() => params.get('host') === '1');
  const [screen, setScreen] = useState(validRoom || launchedFromHost ? 'online' : 'menu'); // menu | online
  const [dict, setDict] = useState(null);
  const [dictErr, setDictErr] = useState('');
  const identity = useTngGameIdentity();
  const name = identity.publicName;
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('ww_muted') === '1'; } catch { return false; } });

  useEffect(() => { try { localStorage.setItem('ww_muted', muted ? '1' : '0'); } catch { /* ignore */ } }, [muted]);
  useEffect(() => {
    let alive = true;
    loadWordDict().then(d => { if (alive) { setDict(d); setTimeout(() => d.trie(), 50); } }).catch(() => alive && setDictErr('Couldn’t load the dictionary. Check your connection and refresh.'));
    return () => { alive = false; };
  }, []);

  const toMenu = () => {
    if (launchedFromHost) {
      window.location.replace('/host');
      return;
    }
    setScreen('menu');
    if (params.get('room')) setParams({}, { replace: true });
  };
  const setRoom = (c) => setParams(
    c
      ? { room: c, ...(launchedFromHost ? { host: '1' } : {}) }
      : (launchedFromHost ? { host: '1' } : {}),
    { replace: true },
  );

  if (validDisplay) {
    return (
      <div className="ww-root">
        <div className="ww-wrap">
          <WWDisplay code={validDisplay} />
        </div>
      </div>
    );
  }

  let body;
  if (!dict) {
    body = (
      <div className="ww-menu"><div className="ww-card" style={{ textAlign: 'center' }}>
        <h1 className="ww-h ww-title">Word Wrangler</h1>
        <p className="ww-sub">{dictErr || 'Saddling up the dictionary…'}</p>
      </div></div>
    );
  } else if (screen === 'online') {
    body = <WWOnline dict={dict} code={validRoom} name={name} identityReady={!identity.loading && Boolean(name)} onCode={setRoom} onExit={toMenu} muted={muted} setMuted={setMuted} autoHost={launchedFromHost} />;
  } else {
    body = (
      <div className="ww-menu">
        <div className="ww-hero">
          <h1 className="ww-h ww-title">Word Wrangler</h1>
          <p className="ww-sub">Drag through touching letters to rope in real words. Long words and rare letters pay big.</p>
        </div>
        <div className="ww-card">
          <div className="ww-label" style={{ marginBottom: 6 }}>TNG player</div>
          <div className="ww-sub">
            Playing as <b style={{ color: 'var(--ww-gold)' }}>{name || (identity.loading ? 'Loading profile…' : 'TNG profile unavailable')}</b>
          </div>
          {identity.error && <div className="ww-err">{identity.error}</div>}
        </div>
        <div className="ww-modes">
          <button type="button" className="ww-mode" onClick={() => setScreen('online')}>
            <div className="ww-h">Online Race</div>
            <p>Host a room, share the code, and race friends live on identical boards.</p>
            <span className="tag">2–8 players</span>
          </button>
        </div>
        <div className="ww-card">
          <h3 className="ww-label">How it plays</h3>
          <ul className="ww-rules">
            <li><span className="ww-chip">CAT</span><span><b>Trace a word.</b> Drag through touching tiles (diagonals count), then let go. Or tap tiles one by one and tap the last one again.</span></li>
            <li><span className="ww-chip">8×</span><span><b>Longer = richer.</b> 3 letters ×1, 5 letters ×2, 7 letters ×3, 8+ up to ×8 — times each letter’s value.</span></li>
            <li><span className="ww-chip">🔥</span><span><b>Beat the rope.</b> The fuse around the board is your clock — when the flame reaches the powder keg, time’s up.</span></li>
            <li><span className="ww-chip">⬇</span><span><b>Tiles drop.</b> Used letters vanish and new ones fall in. Each word only scores once per game.</span></li>
            <li><span className="ww-chip">Qu</span><span><b>Qu</b> sits on one tile. <b>5-letter</b> words drop an Emerald, <b>6</b> a Ruby, <b>7+</b> a Diamond (plus a wild Amethyst).</span></li>
            {Object.entries(SPECIALS).map(([k, v]) => (
              <li key={k}><span className="ww-chip sp"><WWIcon kind={k} size={20} /></span><span><b>{v.name}.</b> {v.desc}.</span></li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="ww-root">
      <Header />
      <div className="ww-wrap">{body}</div>
      <TestFeedbackButton gameId="word-wrangler" roomCode={validRoom} testerName={name} />
    </div>
  );
}
