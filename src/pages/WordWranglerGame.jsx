import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/home/Header';
import WWSolo from '@/components/wordWrangler/WWSolo';
import WWOnline from '@/components/wordWrangler/WWOnline';
import WWIcon from '@/components/wordWrangler/WWIcons';
import { Avatar, RIVALS, loadBest, loadName, saveName } from '@/components/wordWrangler/WWShared';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import { loadWordDict } from '@/lib/wordWranglerDict';
import { SPECIALS } from '@/lib/wordWranglerEngine';
import '@/components/wordWrangler/ww.css';

export default function WordWranglerGame() {
  const [params, setParams] = useSearchParams();
  const roomParam = (params.get('room') || '').toUpperCase();
  const validRoom = /^[A-Z]{5}$/.test(roomParam) ? roomParam : '';
  const [launchedFromHost] = useState(() => params.get('host') === '1');
  const [screen, setScreen] = useState(validRoom || launchedFromHost ? 'online' : 'menu'); // menu | solo | cpu | pickcpu | online
  const [dict, setDict] = useState(null);
  const [dictErr, setDictErr] = useState('');
  const [name, setName] = useState(loadName);
  const [rival, setRival] = useState(RIVALS[2]);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('ww_muted') === '1'; } catch { return false; } });
  const best = loadBest();

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

  let body;
  if (!dict) {
    body = (
      <div className="ww-menu"><div className="ww-card" style={{ textAlign: 'center' }}>
        <h1 className="ww-h ww-title">Word Wrangler</h1>
        <p className="ww-sub">{dictErr || 'Saddling up the dictionary…'}</p>
      </div></div>
    );
  } else if (screen === 'solo') {
    body = <WWSolo dict={dict} playerName={name || 'You'} onExit={toMenu} muted={muted} setMuted={setMuted} />;
  } else if (screen === 'cpu') {
    body = <WWSolo dict={dict} rival={rival} playerName={name || 'You'} onExit={toMenu} muted={muted} setMuted={setMuted} />;
  } else if (screen === 'online') {
    body = <WWOnline dict={dict} code={validRoom} name={name} setName={(n) => { setName(n); }} onCode={setRoom} onExit={toMenu} muted={muted} setMuted={setMuted} autoHost={launchedFromHost} />;
  } else if (screen === 'pickcpu') {
    body = (
      <div className="ww-menu">
        <div className="ww-card">
          <h2 className="ww-h" style={{ fontSize: 44, color: 'var(--ww-gold)' }}>Pick your rival</h2>
          <p className="ww-sub">You both get the same tiles. Most points when the clock runs out wins.</p>
          <div className="ww-crew" style={{ marginTop: 14 }}>
            {RIVALS.map(r => (
              <button key={r.id} type="button" className="ww-crewbtn" aria-pressed={rival.id === r.id} onClick={() => setRival(r)}>
                <Avatar name={r.name} charId={r.id} color={r.color} />
                <span><b>{r.name}</b><small>{r.title} · level {r.level}</small>{best[`cpu_${r.id}`] ? <small>Your best: {best[`cpu_${r.id}`].toLocaleString()}</small> : null}</span>
              </button>
            ))}
          </div>
          <div className="ww-row" style={{ marginTop: 16 }}>
            <button type="button" className="ww-btn primary" onClick={() => setScreen('cpu')}>Saddle up vs {rival.name}</button>
            <button type="button" className="ww-btn ghost" onClick={toMenu}>Back</button>
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="ww-menu">
        <div className="ww-hero">
          <h1 className="ww-h ww-title">Word Wrangler</h1>
          <p className="ww-sub">Drag through touching letters to rope in real words. Long words and rare letters pay big.</p>
        </div>
        <div className="ww-card">
          <div className="ww-label" style={{ marginBottom: 6 }}>Your name</div>
          <input className="ww-input" value={name} maxLength={18} placeholder="YOUR NAME" onChange={e => setName(e.target.value)} onBlur={() => saveName(name.trim())} />
        </div>
        <div className="ww-modes">
          <button type="button" className="ww-mode" onClick={() => setScreen('solo')}>
            <div className="ww-h">Solo Rush</div>
            <p>Score big before the rope burns down. Sapphires add time. Chase your best score.</p>
            <span className="tag">{best.solo ? `Best ${best.solo.toLocaleString()}` : '1 player'}</span>
          </button>
          <button type="button" className="ww-mode" onClick={() => setScreen('pickcpu')}>
            <div className="ww-h">Vs CPU</div>
            <p>Race a Texas Nomad rival on the same tiles — from Tank the rookie to Berna the legend.</p>
            <span className="tag">6 rivals</span>
          </button>
          <button type="button" className="ww-mode" onClick={() => { saveName(name.trim()); setScreen('online'); }}>
            <div className="ww-h">Online Race</div>
            <p>Host a room, share the code, and race friends live on identical boards.</p>
            <span className="tag">Up to 8 players</span>
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
