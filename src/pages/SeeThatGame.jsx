import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SaloonBackground from '@/components/seeThis/SaloonBackground';
import ArcadeCabinetShell from '@/components/arcade/ArcadeCabinetShell';

// ─── Object Definitions ───────────────────────────────────────────────────────
// Objects are small and semi-transparent so they blend into the cluttered scene
const OBJECT_POOL = [
  { id: 'frog',         label: 'Frog',         emoji: '🐸', color: '#4ade80', size: 28, opacity: 0.85 },
  { id: 'gold_bean',    label: 'Gold Bean',    emoji: '🫘', color: '#FFD700', size: 24, opacity: 0.80 },
  { id: 'cowboy_hat',   label: 'Cowboy Hat',   emoji: '🤠', color: '#FF5F1F', size: 30, opacity: 0.82 },
  { id: 'lantern',      label: 'Lantern',      emoji: '🏮', color: '#FF5F1F', size: 26, opacity: 0.78 },
  { id: 'boot',         label: 'Boot',         emoji: '👢', color: '#CD7F32', size: 28, opacity: 0.80 },
  { id: 'snake',        label: 'Snake',        emoji: '🐍', color: '#4ade80', size: 32, opacity: 0.75 },
  { id: 'diamond',      label: 'Diamond',      emoji: '💎', color: '#22d3ee', size: 22, opacity: 0.80 },
  { id: 'playing_card', label: 'Playing Card', emoji: '🃏', color: '#ffffff', size: 26, opacity: 0.78 },
  { id: 'camera',       label: 'Camera',       emoji: '📷', color: '#BC13FE', size: 28, opacity: 0.82 },
  { id: 'ring_light',   label: 'Ring Light',   emoji: '💡', color: '#FFD700', size: 26, opacity: 0.75 },
  { id: 'microphone',   label: 'Microphone',   emoji: '🎤', color: '#BC13FE', size: 24, opacity: 0.80 },
  { id: 'sheriff_badge',label: 'Sheriff Badge',emoji: '⭐', color: '#FFD700', size: 26, opacity: 0.78 },
  { id: 'texas_flag',   label: 'Texas Flag',   emoji: '🚩', color: '#FF5F1F', size: 26, opacity: 0.80 },
  { id: 'bigo_dino',    label: 'Bigo Dino',    emoji: '🦕', color: '#4ade80', size: 32, opacity: 0.82 },
  { id: 'dexter',       label: 'Dexter',       emoji: '🤖', color: '#22d3ee', size: 30, opacity: 0.80 },
];

// ─── Clutter zones — areas of scene packed with stuff, where objects hide ────
// [xFrac, yFrac, widthFrac, heightFrac] relative to scene dimensions
const CLUTTER_ZONES = [
  [0.00, 0.09, 0.19, 0.65],  // left bookcase
  [0.81, 0.09, 0.19, 0.65],  // right bookcase
  [0.19, 0.09, 0.62, 0.37],  // back bar bottles wall
  [0.00, 0.70, 0.16, 0.30],  // left corner crate pile
  [0.84, 0.70, 0.16, 0.30],  // right corner crate pile
  [0.08, 0.60, 0.38, 0.25],  // left table area
  [0.54, 0.60, 0.38, 0.25],  // right table area
  [0.28, 0.77, 0.44, 0.23],  // front center table
  [0.10, 0.72, 0.20, 0.18],  // floor debris left
  [0.70, 0.72, 0.20, 0.18],  // floor debris right
  [0.19, 0.60, 0.10, 0.08],  // fireplace mantle
];

// ─── Utils ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Place objects inside clutter zones with anti-overlap
function placeObjects(objects, sceneW, sceneH) {
  const placed = [];
  for (const obj of objects) {
    const half = obj.size / 2;
    let pos = null;
    for (let attempt = 0; attempt < 300; attempt++) {
      const zone = CLUTTER_ZONES[Math.floor(Math.random() * CLUTTER_ZONES.length)];
      const x = zone[0] * sceneW + half + Math.random() * Math.max(0, zone[2] * sceneW - obj.size);
      const y = zone[1] * sceneH + half + Math.random() * Math.max(0, zone[3] * sceneH - obj.size);
      if (x - half < 2 || x + half > sceneW - 2 || y - half < 2 || y + half > sceneH - 2) continue;
      const overlaps = placed.some(p => {
        const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
        return d < (obj.size / 2 + p.size / 2 + 6);
      });
      if (!overlaps) { pos = { x, y }; break; }
    }
    if (!pos) {
      const zone = CLUTTER_ZONES[Math.floor(Math.random() * CLUTTER_ZONES.length)];
      pos = {
        x: zone[0] * sceneW + half + Math.random() * Math.max(1, zone[2] * sceneW - obj.size),
        y: zone[1] * sceneH + half + Math.random() * Math.max(1, zone[3] * sceneH - obj.size),
      };
    }
    placed.push({ ...obj, x: pos.x, y: pos.y, rotation: (Math.random() - 0.5) * 30, found: false });
  }
  return placed;
}

// ─── Ripple effect ────────────────────────────────────────────────────────────
function ClickRipple({ x, y, correct }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-50%,-50%)',
      width: 60, height: 60, borderRadius: '50%',
      border: `3px solid ${correct ? '#4ade80' : '#ef4444'}`,
      pointerEvents: 'none', zIndex: 30,
      animation: 'rippleOut 0.7s ease-out forwards',
    }} />
  );
}

// ─── Object Token ─────────────────────────────────────────────────────────────
function ObjectToken({ obj, showHitbox, onFound, gameActive }) {
  const [highlighted, setHighlighted] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!gameActive || obj.found) return;
    setHighlighted(true);
    setTimeout(() => setHighlighted(false), 600);
    onFound(obj.id);
  };

  const base = `rotate(${obj.rotation || 0}deg)`;
  return (
    <div
      onClick={handleClick}
      title={showHitbox ? obj.label : ''}
      style={{
        position: 'absolute',
        left: obj.x - obj.size / 2,
        top: obj.y - obj.size / 2,
        width: obj.size, height: obj.size,
        cursor: gameActive && !obj.found ? 'pointer' : 'default',
        zIndex: obj.found ? 5 : 10,
        transition: 'transform 0.15s, filter 0.15s, opacity 0.15s',
        transform: highlighted ? `${base} scale(1.5)` : obj.found ? `${base} scale(0.7)` : base,
        opacity: obj.found ? 0.15 : (obj.opacity || 0.8),
        filter: obj.found
          ? 'grayscale(1)'
          : highlighted
          ? `drop-shadow(0 0 10px ${obj.color}) drop-shadow(0 0 4px white) brightness(1.4)`
          : 'none',
      }}
    >
      {showHitbox && (
        <div style={{
          position: 'absolute', inset: 0,
          border: `2px dashed ${obj.color}`,
          borderRadius: 4,
          background: `${obj.color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 6, color: obj.color, fontFamily: "'Press Start 2P', monospace", textAlign: 'center', wordBreak: 'break-word', padding: 1 }}>{obj.label}</span>
        </div>
      )}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: obj.size * 0.72, lineHeight: 1, userSelect: 'none' }}>
        {obj.emoji}
      </div>
      {highlighted && (
        <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: `radial-gradient(circle, ${obj.color}60 0%, transparent 70%)`, pointerEvents: 'none', animation: 'sparkle 0.5s ease-out' }} />
      )}
    </div>
  );
}

// ─── Game Constants ───────────────────────────────────────────────────────────
const GAME_DURATION = 60;
const POINTS_CORRECT = 100;
const POINTS_WRONG = -10;
const TARGETS_COUNT = 5;
const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SeeThatGame() {
  const sceneRef = useRef(null);
  const [sceneDims, setSceneDims] = useState({ w: 900, h: 600 });
  const [phase, setPhase] = useState('lobby');
  const [targets, setTargets] = useState([]);
  const [allObjects, setAllObjects] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [foundCount, setFoundCount] = useState(0);
  const [showHitbox, setShowHitbox] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef(null);
  const rippleId = useRef(0);

  useEffect(() => {
    const measure = () => {
      if (!sceneRef.current) return;
      const r = sceneRef.current.getBoundingClientRect();
      setSceneDims({ w: r.width, h: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setPhase('lose'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const startGame = useCallback(() => {
    const selectedTargets = shuffle(OBJECT_POOL).slice(0, TARGETS_COUNT);
    const placed = placeObjects(shuffle(OBJECT_POOL), sceneDims.w, sceneDims.h);
    setTargets(selectedTargets.map(t => ({ ...t, found: false })));
    setAllObjects(placed);
    setScore(0); setFoundCount(0); setTimeLeft(GAME_DURATION);
    setPhase('playing'); setRipples([]); setFeedback(null);
  }, [sceneDims]);

  const handleObjectFound = useCallback((objectId, x, y) => {
    const isTarget = targets.some(t => t.id === objectId && !t.found);
    if (isTarget) {
      setScore(s => s + POINTS_CORRECT);
      setTargets(prev => prev.map(t => t.id === objectId ? { ...t, found: true } : t));
      setAllObjects(prev => prev.map(o => o.id === objectId ? { ...o, found: true } : o));
      setFoundCount(c => {
        const n = c + 1;
        if (n >= TARGETS_COUNT) { clearInterval(timerRef.current); setTimeout(() => setPhase('win'), 400); }
        return n;
      });
      setFeedback({ text: '+100', correct: true, x, y });
    } else {
      setScore(s => s + POINTS_WRONG);
      setWrongFlash(true); setTimeout(() => setWrongFlash(false), 400);
      setFeedback({ text: '-10 Not a target!', correct: false, x, y });
    }
    setTimeout(() => setFeedback(null), 900);
  }, [targets]);

  const handleSceneClick = useCallback((e) => {
    if (phase !== 'playing') return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const hitObj = allObjects.find(o => !o.found && Math.abs(o.x - x) < o.size / 2 + 4 && Math.abs(o.y - y) < o.size / 2 + 4);
    if (!hitObj) {
      setScore(s => s + POINTS_WRONG);
      setWrongFlash(true); setTimeout(() => setWrongFlash(false), 400);
      setFeedback({ text: '-10 Miss!', correct: false, x, y });
      setTimeout(() => setFeedback(null), 900);
    }
    const id = ++rippleId.current;
    const correct = hitObj && targets.some(t => t.id === hitObj.id && !t.found);
    setRipples(r => [...r, { id, x, y, correct: !!correct }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 700);
  }, [phase, allObjects, targets]);

  const timerPct = timeLeft / GAME_DURATION;
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#FF5F1F' : '#4ade80';

  const cabinetHeader = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: 44, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" style={{ width: 26, height: 26, objectFit: 'contain' }} />
        </Link>
        <span style={{ ...PS2, fontSize: 9, color: '#f43f5e', textShadow: '0 0 10px #f43f5e' }}>SEE THAT!</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(244,63,94,0.4)', background: 'rgba(244,63,94,0.08)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', boxShadow: '0 0 6px #f43f5e', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <span style={{ ...PS2, fontSize: 6, color: '#f43f5e' }}>LIVE</span>
        </div>
        {phase === 'playing' && (
          <div style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.08)' }}>
            <span style={{ ...PS2, fontSize: 6, color: '#4ade80' }}>PLAYING • {foundCount}/{TARGETS_COUNT} FOUND</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to="/games" style={{ ...PS2, fontSize: 6, padding: '3px 8px', border: '1px solid rgba(255,215,0,0.4)', color: 'rgba(255,215,0,0.8)', borderRadius: 4, textDecoration: 'none' }}>← LOBBY</Link>
      </div>
    </div>
  );

  const deckCenter = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {phase === 'playing' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...PS2, fontSize: 6, color: 'rgba(74,222,128,0.6)' }}>FOUND</div>
            <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 22, color: '#4ade80', lineHeight: 1 }}>{foundCount}/{TARGETS_COUNT}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '2px 10px', border: `1px solid ${timerColor}60`, borderRadius: 6 }}>
            <div style={{ ...PS2, fontSize: 6, color: `${timerColor}80` }}>TIME</div>
            <div style={{ ...PS2, fontSize: 14, color: timerColor, textShadow: `0 0 10px ${timerColor}` }}>{String(Math.floor(timeLeft / 60)).padStart(2,'0')}:{String(timeLeft % 60).padStart(2,'0')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,215,0,0.6)' }}>SCORE</div>
            <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 22, color: score < 0 ? '#ef4444' : '#FFD700', lineHeight: 1 }}>{score}</div>
          </div>
        </div>
      )}
      {phase === 'lobby' && <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>HIDDEN OBJECT</div>}
    </div>
  );

  const deckControls = [
    ...(phase === 'lobby' ? [{ label: '▶ START', action: startGame }] : []),
    ...(phase === 'playing' ? [
      { label: '🔄 NEW', action: startGame },
      { label: 'HITBOX', action: () => setShowHitbox(h => !h), variant: showHitbox ? 'primary' : 'secondary' },
      { label: '↩ QUIT', action: () => setPhase('lobby'), variant: 'secondary' },
    ] : []),
    ...((phase === 'win' || phase === 'lose') ? [
      { label: '▶ AGAIN', action: startGame },
      { label: '↩ LOBBY', action: () => setPhase('lobby'), variant: 'secondary' },
    ] : []),
  ];

  return (
    <>
      <style>{`
        @keyframes rippleOut { 0% { transform: translate(-50%,-50%) scale(0.3); opacity:1; } 100% { transform: translate(-50%,-50%) scale(1.8); opacity:0; } }
        @keyframes sparkle { 0% { transform:scale(0); opacity:1; } 100% { transform:scale(1.5); opacity:0; } }
        @keyframes feedbackFloat { 0% { transform:translateY(0); opacity:1; } 100% { transform:translateY(-50px); opacity:0; } }
        @keyframes wrongShake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-6px); } 60% { transform:translateX(6px); } }
        @keyframes pulseGlow { 0%,100% { box-shadow:0 0 10px #BC13FE60; } 50% { box-shadow:0 0 25px #BC13FE,0 0 50px #BC13FE60; } }
        @keyframes winPop { 0% { transform:scale(0.5); opacity:0; } 70% { transform:scale(1.05); opacity:1; } 100% { transform:scale(1); opacity:1; } }
      `}</style>

      <ArcadeCabinetShell
        gameId="see-that"
        gameTitle="SEE THAT!"
        controls={deckControls}
        centerInfo={deckCenter}
        header={cabinetHeader}
      >
        {/* Scene row */}
        <div style={{ display: 'flex', gap: 8, padding: 8 }}>

          {/* Target list */}
          {phase === 'playing' && (
            <div style={{ width: 130, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ ...PS2, fontSize: 6, color: '#f43f5e', textAlign: 'center', marginBottom: 2 }}>FIND THESE</div>
              {targets.map(t => (
                <div key={t.id} style={{ padding: '5px 8px', borderRadius: 8, border: `2px solid ${t.found ? '#4ade80' : t.color + '50'}`, background: t.found ? 'rgba(74,222,128,0.1)' : t.color + '08', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.3s', opacity: t.found ? 0.6 : 1 }}>
                  <span style={{ fontSize: 18, filter: t.found ? 'grayscale(1) opacity(0.5)' : `drop-shadow(0 0 4px ${t.color})`, flexShrink: 0 }}>{t.emoji}</span>
                  <div>
                    <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 13, color: t.found ? '#4ade80' : 'white', lineHeight: 1.1, textDecoration: t.found ? 'line-through' : 'none' }}>{t.label}</div>
                    {t.found && <div style={{ ...PS2, fontSize: 5, color: '#4ade80' }}>✓ FOUND</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scene */}
          <div
            ref={sceneRef}
            onClick={handleSceneClick}
            style={{
              flex: 1, position: 'relative', borderRadius: 8, overflow: 'hidden',
              aspectRatio: '900 / 560', minWidth: 0, minHeight: 240,
              border: wrongFlash ? '3px solid #ef4444' : phase === 'playing' ? '2px solid rgba(244,63,94,0.5)' : '2px solid rgba(244,63,94,0.2)',
              cursor: phase === 'playing' ? 'crosshair' : 'default',
              boxShadow: wrongFlash ? '0 0 40px rgba(239,68,68,0.5), inset 0 0 40px rgba(239,68,68,0.1)' : '0 0 20px rgba(244,63,94,0.2)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              background: '#050310',
            }}
          >
            <SaloonBackground />

            {phase === 'playing' && allObjects.map(obj => (
              <ObjectToken key={obj.id} obj={obj} showHitbox={showHitbox} gameActive={true} onFound={(id) => handleObjectFound(id, obj.x, obj.y)} />
            ))}

            {ripples.map(r => <ClickRipple key={r.id} x={r.x} y={r.y} correct={r.correct} />)}

            {feedback && (
              <div style={{ position: 'absolute', left: feedback.x, top: feedback.y - 20, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 50, ...PS2, fontSize: 10, color: feedback.correct ? '#4ade80' : '#ef4444', textShadow: `0 0 10px ${feedback.correct ? '#4ade80' : '#ef4444'}`, animation: 'feedbackFloat 0.9s ease-out forwards', whiteSpace: 'nowrap' }}>
                {feedback.text}
              </div>
            )}

            {/* Lobby overlay */}
            {phase === 'lobby' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,3,11,0.85)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 40 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Rye', serif", fontSize: 'clamp(28px, 5vw, 56px)', color: '#FFD700', textShadow: '0 0 30px #FFD700', lineHeight: 1 }}>SEE THAT!</div>
                  <div style={{ ...PS2, fontSize: 7, color: '#f43f5e', marginTop: 6 }}>HIDDEN OBJECT CHALLENGE</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 320 }}>
                  {[{ icon: '👁', label: '5 Objects', sub: 'Find them all' }, { icon: '⏱', label: '60 Seconds', sub: 'Race the clock' }, { icon: '🎯', label: 'No Misses', sub: '-10 per miss' }].map(f => (
                    <div key={f.label} style={{ padding: '10px 6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', textAlign: 'center' }}>
                      <div style={{ fontSize: 24 }}>{f.icon}</div>
                      <div style={{ ...PS2, fontSize: 6, color: '#FFD700', marginTop: 3 }}>{f.label}</div>
                      <div style={{ ...PS2, fontSize: 5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{f.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Win overlay */}
            {phase === 'win' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,3,11,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
                <div style={{ padding: '24px 36px', borderRadius: 16, border: '3px solid #FFD700', background: 'rgba(5,3,11,0.95)', textAlign: 'center', boxShadow: '0 0 60px rgba(255,215,0,0.4)', animation: 'winPop 0.5s ease-out' }}>
                  <div style={{ fontSize: 52 }}>🏆</div>
                  <div style={{ fontFamily: "'Rye', serif", fontSize: 'clamp(24px, 4vw, 44px)', color: '#FFD700', textShadow: '0 0 30px #FFD700' }}>YOU WIN!</div>
                  <div style={{ ...PS2, fontSize: 8, color: '#4ade80', marginTop: 6 }}>ALL OBJECTS FOUND!</div>
                  <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 40, color: '#FFD700', marginTop: 6 }}>{score} PTS</div>
                  <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>TIME REMAINING: {timeLeft}s</div>
                </div>
              </div>
            )}

            {/* Lose overlay */}
            {phase === 'lose' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,3,11,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
                <div style={{ padding: '24px 36px', borderRadius: 16, border: '3px solid #ef4444', background: 'rgba(5,3,11,0.95)', textAlign: 'center', boxShadow: '0 0 60px rgba(239,68,68,0.4)', animation: 'winPop 0.5s ease-out' }}>
                  <div style={{ fontSize: 52 }}>⏰</div>
                  <div style={{ fontFamily: "'Rye', serif", fontSize: 'clamp(20px, 3vw, 36px)', color: '#ef4444', textShadow: '0 0 20px #ef4444' }}>TIME'S UP!</div>
                  <div style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{foundCount} / {TARGETS_COUNT} FOUND</div>
                  <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 40, color: score < 0 ? '#ef4444' : '#FFD700', marginTop: 6 }}>{score} PTS</div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>MISSING:</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {targets.filter(t => !t.found).map(t => (
                        <div key={t.id} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.color}50`, background: `${t.color}10`, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 14 }}>{t.emoji}</span>
                          <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 12, color: t.color }}>{t.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ArcadeCabinetShell>
    </>
  );
}