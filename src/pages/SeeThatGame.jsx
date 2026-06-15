import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

// ─── Object Definitions ───────────────────────────────────────────────────────
const OBJECT_POOL = [
  { id: 'frog',         label: 'Frog',          emoji: '🐸', color: '#4ade80', size: 48 },
  { id: 'gold_bean',    label: 'Gold Bean',      emoji: '🫘', color: '#FFD700', size: 40 },
  { id: 'cowboy_hat',   label: 'Cowboy Hat',     emoji: '🤠', color: '#FF5F1F', size: 52 },
  { id: 'lantern',      label: 'Lantern',        emoji: '🏮', color: '#FF5F1F', size: 44 },
  { id: 'boot',         label: 'Boot',           emoji: '👢', color: '#CD7F32', size: 46 },
  { id: 'snake',        label: 'Snake',          emoji: '🐍', color: '#4ade80', size: 56 },
  { id: 'diamond',      label: 'Diamond',        emoji: '💎', color: '#22d3ee', size: 42 },
  { id: 'playing_card', label: 'Playing Card',   emoji: '🃏', color: '#ffffff', size: 44 },
  { id: 'camera',       label: 'Camera',         emoji: '📷', color: '#BC13FE', size: 46 },
  { id: 'ring_light',   label: 'Ring Light',     emoji: '💡', color: '#FFD700', size: 50 },
  { id: 'microphone',   label: 'Microphone',     emoji: '🎤', color: '#BC13FE', size: 44 },
  { id: 'sheriff_badge',label: 'Sheriff Badge',  emoji: '⭐', color: '#FFD700', size: 48 },
  { id: 'texas_flag',   label: 'Texas Flag',     emoji: '🚩', color: '#FF5F1F', size: 46 },
  { id: 'bigo_dino',    label: 'Bigo Dino',      emoji: '🦕', color: '#4ade80', size: 60 },
  { id: 'dexter',       label: 'Dexter',         emoji: '🤖', color: '#22d3ee', size: 54 },
];

// ─── Scene Background Elements (SVG-based saloon scene) ───────────────────────
function SaloonBackground() {
  return (
    <svg
      width="100%" height="100%"
      viewBox="0 0 900 600"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Sky */}
      <defs>
        <radialGradient id="skyGrad" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#1a0a2e" />
          <stop offset="100%" stopColor="#050310" />
        </radialGradient>
        <radialGradient id="floorGrad" cx="50%" cy="50%" r="80%">
          <stop offset="0%" stopColor="#2a1a0a" />
          <stop offset="100%" stopColor="#0a0805" />
        </radialGradient>
        <pattern id="wood" patternUnits="userSpaceOnUse" width="40" height="200">
          <rect width="40" height="200" fill="#3d1c0a" />
          <line x1="0" y1="0" x2="0" y2="200" stroke="#4a2210" strokeWidth="1" opacity="0.5" />
          <line x1="20" y1="0" x2="20" y2="200" stroke="#2a1008" strokeWidth="1" opacity="0.3" />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background wall */}
      <rect width="900" height="600" fill="url(#skyGrad)" />

      {/* Back wall wooden panels */}
      <rect x="0" y="0" width="900" height="420" fill="url(#wood)" opacity="0.7" />
      <rect x="0" y="0" width="900" height="420" fill="none" stroke="#5a2c12" strokeWidth="2" opacity="0.3" />

      {/* Ceiling beams */}
      {[0, 300, 600].map((x, i) => (
        <rect key={i} x={x} y="0" width="40" height="420" fill="#2a1008" opacity="0.6" />
      ))}

      {/* Back bar shelf */}
      <rect x="50" y="180" width="800" height="18" rx="4" fill="#5a2c12" />
      <rect x="50" y="198" width="800" height="8" rx="2" fill="#3d1c0a" />

      {/* Bottles on shelf */}
      {[80, 140, 200, 260, 320, 420, 480, 540, 650, 710, 770].map((x, i) => (
        <g key={i}>
          <rect x={x} y={140} width={16} height={40} rx={4}
            fill={['#BC13FE', '#4ade80', '#22d3ee', '#FF5F1F', '#FFD700'][i % 5]}
            opacity="0.7" />
          <rect x={x + 4} y={136} width={8} height={6} rx={2} fill="#555" />
        </g>
      ))}

      {/* Mirror behind bar */}
      <rect x="350" y="40" width="200" height="130" rx="8" fill="#1a1a3a" stroke="#FFD700" strokeWidth="3" opacity="0.8" />
      <rect x="358" y="48" width="184" height="114" rx="4" fill="#0a0a1a" opacity="0.9" />
      <text x="450" y="112" textAnchor="middle" fill="#FFD700" fontSize="14" fontFamily="serif" opacity="0.6">TEXASNOMAD</text>
      <text x="450" y="128" textAnchor="middle" fill="#FF5F1F" fontSize="10" fontFamily="serif" opacity="0.6">SALOON</text>

      {/* Wanted poster left */}
      <rect x="60" y="60" width="90" height="115" rx="4" fill="#d4aa70" />
      <rect x="65" y="65" width="80" height="105" rx="2" fill="#c49a50" />
      <text x="105" y="85" textAnchor="middle" fill="#3d1c0a" fontSize="9" fontWeight="bold" fontFamily="serif">WANTED</text>
      <circle cx="105" cy="118" r="28" fill="#8B4513" opacity="0.8" />
      <text x="105" y="123" textAnchor="middle" fill="#d4aa70" fontSize="22">🤠</text>
      <text x="105" y="152" textAnchor="middle" fill="#3d1c0a" fontSize="7" fontFamily="serif">DEAD OR ALIVE</text>
      <text x="105" y="163" textAnchor="middle" fill="#3d1c0a" fontSize="6" fontFamily="serif">$500 REWARD</text>

      {/* Wanted poster right */}
      <rect x="750" y="60" width="90" height="115" rx="4" fill="#d4aa70" />
      <rect x="755" y="65" width="80" height="105" rx="2" fill="#c49a50" />
      <text x="795" y="85" textAnchor="middle" fill="#3d1c0a" fontSize="9" fontWeight="bold" fontFamily="serif">WANTED</text>
      <circle cx="795" cy="118" r="28" fill="#8B4513" opacity="0.8" />
      <text x="795" y="123" textAnchor="middle" fill="#d4aa70" fontSize="22">🦄</text>
      <text x="795" y="152" textAnchor="middle" fill="#3d1c0a" fontSize="7" fontFamily="serif">DEAD OR ALIVE</text>
      <text x="795" y="163" textAnchor="middle" fill="#3d1c0a" fontSize="6" fontFamily="serif">$1000 REWARD</text>

      {/* Bar counter */}
      <rect x="0" y="380" width="900" height="30" rx="0" fill="#5a2c12" />
      <rect x="0" y="380" width="900" height="6" fill="#7a3c18" />

      {/* Bar stools */}
      {[80, 200, 320, 440, 560, 680, 800].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={370} r={18} fill="#3d1c0a" stroke="#5a2c12" strokeWidth="2" />
          <rect x={x - 3} y={370} width={6} height={40} fill="#2a1008" />
        </g>
      ))}

      {/* Floor */}
      <rect x="0" y="410" width="900" height="190" fill="url(#floorGrad)" />
      {/* Floor planks */}
      {[430, 460, 490, 520, 550, 580].map((y, i) => (
        <line key={i} x1="0" y1={y} x2="900" y2={y} stroke="#3d1c0a" strokeWidth="2" opacity="0.4" />
      ))}
      {[100, 200, 300, 450, 600, 750].map((x, i) => (
        <line key={i} x1={x} y1="410" x2={x} y2="600" stroke="#3d1c0a" strokeWidth="1" opacity="0.2" />
      ))}

      {/* Saloon tables */}
      <ellipse cx="200" cy="490" rx="90" ry="28" fill="#4a2210" stroke="#5a2c12" strokeWidth="2" />
      <rect x="185" y="490" width="30" height="60" fill="#3d1c0a" />

      <ellipse cx="700" cy="490" rx="90" ry="28" fill="#4a2210" stroke="#5a2c12" strokeWidth="2" />
      <rect x="685" y="490" width="30" height="60" fill="#3d1c0a" />

      {/* Center table */}
      <ellipse cx="450" cy="530" rx="110" ry="32" fill="#4a2210" stroke="#5a2c12" strokeWidth="2" />
      <rect x="435" y="530" width="30" height="60" fill="#3d1c0a" />

      {/* Lantern lights hanging */}
      {[150, 450, 750].map((x, i) => (
        <g key={i} filter="url(#glow)">
          <line x1={x} y1="0" x2={x} y2="50" stroke="#555" strokeWidth="2" />
          <ellipse cx={x} cy="65" rx="16" ry="22" fill="#FF5F1F" opacity="0.8" />
          <ellipse cx={x} cy="65" rx="10" ry="16" fill="#FFD700" opacity="0.9" />
          <circle cx={x} cy="65" r="5" fill="white" opacity="0.9" />
          {/* Glow aura */}
          <ellipse cx={x} cy="65" rx="40" ry="40" fill="#FF5F1F" opacity="0.08" />
        </g>
      ))}

      {/* Neon sign */}
      <rect x="310" y="10" width="280" height="50" rx="8" fill="none" stroke="#BC13FE" strokeWidth="2" opacity="0.6" filter="url(#glow)" />
      <text x="450" y="42" textAnchor="middle" fill="#BC13FE" fontSize="22" fontFamily="'Rye', serif" filter="url(#glow)" opacity="0.9">
        SEE THAT! SALOON
      </text>

      {/* Swamp window left */}
      <rect x="170" y="220" width="120" height="140" rx="8" fill="#0a1a0a" stroke="#3a2c12" strokeWidth="3" />
      <rect x="175" y="225" width="110" height="130" rx="4" fill="#0d2010" />
      {/* Swamp scene in window */}
      <ellipse cx="230" cy="310" rx="50" ry="20" fill="#1a3a1a" />
      <text x="230" y="305" textAnchor="middle" fontSize="28">🌿</text>
      <text x="210" y="325" textAnchor="middle" fontSize="18">🐊</text>
      <text x="250" y="330" textAnchor="middle" fontSize="14">🐸</text>
      <line x1="228" y1="220" x2="228" y2="360" stroke="#3a2c12" strokeWidth="3" />
      <line x1="170" y1="290" x2="290" y2="290" stroke="#3a2c12" strokeWidth="3" />

      {/* Creator window right */}
      <rect x="610" y="220" width="120" height="140" rx="8" fill="#0a0a1a" stroke="#3a2c12" strokeWidth="3" />
      <rect x="615" y="225" width="110" height="130" rx="4" fill="#0d0d20" />
      {/* Creator studio in window */}
      <circle cx="670" cy="265" r="20" fill="none" stroke="#BC13FE" strokeWidth="3" opacity="0.8" />
      <circle cx="670" cy="265" r="12" fill="#1a0a2e" />
      <text x="670" y="310" textAnchor="middle" fontSize="18">🎥</text>
      <text x="670" y="330" textAnchor="middle" fontSize="14">💡</text>
      <line x1="668" y1="220" x2="668" y2="360" stroke="#3a2c12" strokeWidth="3" />
      <line x1="610" y1="290" x2="730" y2="290" stroke="#3a2c12" strokeWidth="3" />

      {/* Atmospheric dust particles */}
      {[120, 250, 380, 520, 660, 800].map((x, i) => (
        <circle key={i} cx={x} cy={150 + i * 30} r="2" fill="#FFD700" opacity="0.15" />
      ))}
    </svg>
  );
}

// ─── Utility: shuffle array ───────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Place objects without overlap ───────────────────────────────────────────
function placeObjects(objects, sceneW, sceneH) {
  const margin = 20;
  const placed = [];

  for (const obj of objects) {
    const half = obj.size / 2 + 6;
    let attempts = 0;
    let pos;

    while (attempts < 200) {
      const x = margin + half + Math.random() * (sceneW - 2 * margin - obj.size);
      const y = margin + half + Math.random() * (sceneH - 2 * margin - obj.size);

      // Check overlap with already placed objects
      const overlaps = placed.some(p => {
        const minDist = (obj.size / 2 + p.size / 2) + 12;
        const dx = p.x - x, dy = p.y - y;
        return Math.sqrt(dx * dx + dy * dy) < minDist;
      });

      if (!overlaps) {
        pos = { x, y };
        break;
      }
      attempts++;
    }

    if (!pos) {
      // Fallback: place anywhere with some spacing
      pos = {
        x: margin + half + Math.random() * (sceneW - 2 * margin - obj.size),
        y: margin + half + Math.random() * (sceneH - 2 * margin - obj.size),
      };
    }

    placed.push({ ...obj, x: pos.x, y: pos.y, found: false });
  }

  return placed;
}

// ─── Ripple click effect ──────────────────────────────────────────────────────
function ClickRipple({ x, y, correct, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%,-50%)',
        width: 60,
        height: 60,
        borderRadius: '50%',
        border: `3px solid ${correct ? '#4ade80' : '#ef4444'}`,
        pointerEvents: 'none',
        zIndex: 30,
        animation: 'rippleOut 0.7s ease-out forwards',
      }}
    />
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

  return (
    <div
      onClick={handleClick}
      title={showHitbox ? obj.label : ''}
      style={{
        position: 'absolute',
        left: obj.x - obj.size / 2,
        top: obj.y - obj.size / 2,
        width: obj.size,
        height: obj.size,
        cursor: gameActive && !obj.found ? 'pointer' : 'default',
        zIndex: obj.found ? 5 : 10,
        transition: 'transform 0.15s, filter 0.15s',
        transform: highlighted ? 'scale(1.4)' : obj.found ? 'scale(0.8)' : 'scale(1)',
        filter: obj.found
          ? 'grayscale(1) opacity(0.3)'
          : highlighted
          ? `drop-shadow(0 0 12px ${obj.color}) drop-shadow(0 0 6px white)`
          : 'drop-shadow(0 0 3px rgba(0,0,0,0.8))',
      }}
    >
      {/* Hitbox overlay */}
      {showHitbox && (
        <div style={{
          position: 'absolute', inset: 0,
          border: `2px dashed ${obj.color}`,
          borderRadius: 6,
          background: `${obj.color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 7,
            color: obj.color,
            fontFamily: "'Press Start 2P', monospace",
            textAlign: 'center',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            padding: 2,
          }}>{obj.label}</span>
        </div>
      )}

      {/* Emoji / sprite */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: obj.size * 0.72,
        lineHeight: 1,
        userSelect: 'none',
        filter: highlighted ? 'brightness(1.5)' : 'brightness(1)',
      }}>
        {obj.emoji}
      </div>

      {/* Found sparkle */}
      {highlighted && (
        <div style={{
          position: 'absolute',
          inset: -10,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${obj.color}60 0%, transparent 70%)`,
          pointerEvents: 'none',
          animation: 'sparkle 0.5s ease-out',
        }} />
      )}
    </div>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────
const GAME_DURATION = 60;
const POINTS_CORRECT = 100;
const POINTS_WRONG = -10;
const TARGETS_COUNT = 5;
const SCENE_ASPECT = 900 / 600;

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

export default function SeeThatGame() {
  const sceneRef = useRef(null);
  const [sceneDims, setSceneDims] = useState({ w: 900, h: 600 });
  const [phase, setPhase] = useState('lobby'); // lobby | playing | win | lose
  const [targets, setTargets] = useState([]); // 5 objects to find
  const [allObjects, setAllObjects] = useState([]); // all 15 placed objects
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [foundCount, setFoundCount] = useState(0);
  const [showHitbox, setShowHitbox] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [feedback, setFeedback] = useState(null); // { text, correct, x, y }
  const timerRef = useRef(null);
  const rippleIdRef = useRef(0);

  // Measure scene container
  useEffect(() => {
    const measure = () => {
      if (!sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      setSceneDims({ w: rect.width, h: rect.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setPhase('lose');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const startGame = useCallback(() => {
    const selectedTargets = shuffle(OBJECT_POOL).slice(0, TARGETS_COUNT);
    // Place all 15 objects in the scene
    const shuffledAll = shuffle(OBJECT_POOL);
    const placed = placeObjects(shuffledAll, sceneDims.w, sceneDims.h);

    setTargets(selectedTargets.map(t => ({ ...t, found: false })));
    setAllObjects(placed);
    setScore(0);
    setFoundCount(0);
    setTimeLeft(GAME_DURATION);
    setPhase('playing');
    setRipples([]);
    setFeedback(null);
  }, [sceneDims]);

  const handleObjectFound = useCallback((objectId, x, y) => {
    const isTarget = targets.some(t => t.id === objectId && !t.found);

    if (isTarget) {
      // Correct!
      setScore(s => s + POINTS_CORRECT);
      setTargets(prev => prev.map(t => t.id === objectId ? { ...t, found: true } : t));
      setAllObjects(prev => prev.map(o => o.id === objectId ? { ...o, found: true } : o));
      setFoundCount(c => {
        const newCount = c + 1;
        if (newCount >= TARGETS_COUNT) {
          clearInterval(timerRef.current);
          setTimeout(() => setPhase('win'), 400);
        }
        return newCount;
      });
      setFeedback({ text: '+100', correct: true, x, y });
    } else {
      // Wrong (non-target object)
      setScore(s => s + POINTS_WRONG);
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 400);
      setFeedback({ text: '-10 Not a Target!', correct: false, x, y });
    }
    setTimeout(() => setFeedback(null), 900);
  }, [targets]);

  const handleSceneClick = useCallback((e) => {
    if (phase !== 'playing') return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click hits any object hitbox
    const hitObj = allObjects.find(obj => {
      if (obj.found) return false;
      const half = obj.size / 2 + 4;
      return Math.abs(obj.x - x) < half && Math.abs(obj.y - y) < half;
    });

    if (!hitObj) {
      // Missed entirely
      setScore(s => s + POINTS_WRONG);
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 400);
      setFeedback({ text: '-10 Miss!', correct: false, x, y });
      setTimeout(() => setFeedback(null), 900);
    }

    // Add ripple
    const id = ++rippleIdRef.current;
    const correct = hitObj && targets.some(t => t.id === hitObj.id && !t.found);
    setRipples(r => [...r, { id, x, y, correct: !!correct }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 700);
  }, [phase, allObjects, targets]);

  const timerPct = timeLeft / GAME_DURATION;
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#FF5F1F' : '#4ade80';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#05030b',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Rye&family=Press+Start+2P&display=swap');
        @keyframes rippleOut {
          0% { transform: translate(-50%,-50%) scale(0.3); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
        @keyframes sparkle {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes feedbackFloat {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-50px); opacity: 0; }
        }
        @keyframes wrongShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 10px #BC13FE60; }
          50% { box-shadow: 0 0 25px #BC13FE, 0 0 50px #BC13FE60; }
        }
        @keyframes countBounce {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        @keyframes winPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; background: #0a0510; }
        ::-webkit-scrollbar-thumb { background: #BC13FE40; border-radius: 3px; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid rgba(188,19,254,0.3)',
        background: 'rgba(5,3,11,0.95)',
        backdropFilter: 'blur(10px)',
        padding: '0 16px',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <img
              src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png"
              alt="TN" style={{ width: 28, height: 28, objectFit: 'contain' }}
            />
          </Link>
          <span style={{ ...PS2, fontSize: 11, color: '#BC13FE', textShadow: '0 0 10px #BC13FE' }}>SEE THAT!</span>
          <span style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>by TexasNomad</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Dev mode toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div
              onClick={() => setShowHitbox(h => !h)}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: showHitbox ? '#BC13FE' : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(188,19,254,0.5)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: 2,
                left: showHitbox ? 18 : 2,
                transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ ...PS2, fontSize: 6, color: showHitbox ? '#BC13FE' : 'rgba(255,255,255,0.4)' }}>HITBOXES</span>
          </label>

          <Link to="/games" style={{
            ...PS2, fontSize: 7,
            padding: '4px 10px',
            border: '1px solid rgba(255,215,0,0.4)',
            color: 'rgba(255,215,0,0.8)',
            borderRadius: 4,
            textDecoration: 'none',
          }}>← LOBBY</Link>
        </div>
      </header>

      {/* ── Title Banner ───────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center',
        padding: '8px 16px 4px',
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(188,19,254,0.08) 0%, transparent 100%)',
      }}>
        <h1 style={{
          fontFamily: "'Rye', serif",
          fontSize: 'clamp(28px, 5vw, 52px)',
          color: '#FFD700',
          textShadow: '0 0 20px #FFD700, 0 0 40px rgba(255,215,0,0.4)',
          margin: 0,
          lineHeight: 1,
          letterSpacing: '0.05em',
        }}>
          SEE THAT!
        </h1>
        <p style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.3)', margin: '4px 0 0' }}>
          HIDDEN OBJECT CHALLENGE • TEXASNOMAD ARCADE
        </p>
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 12px 12px',
        maxWidth: 1280,
        margin: '0 auto',
        width: '100%',
      }}>

        {/* ── HUD Row ──── */}
        {phase === 'playing' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 8,
            alignItems: 'center',
            flexShrink: 0,
          }}>
            {/* Found count */}
            <div style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(74,222,128,0.3)',
              background: 'rgba(74,222,128,0.05)',
              textAlign: 'center',
            }}>
              <div style={{ ...PS2, fontSize: 7, color: 'rgba(74,222,128,0.6)', marginBottom: 3 }}>FOUND</div>
              <div style={{ fontFamily: "'Teko', sans-serif", fontSize: 32, color: '#4ade80', lineHeight: 1 }}>
                {foundCount} <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>/ {TARGETS_COUNT}</span>
              </div>
            </div>

            {/* Timer — center */}
            <div style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: `2px solid ${timerColor}60`,
              background: `${timerColor}08`,
              textAlign: 'center',
              minWidth: 120,
              animation: timeLeft <= 10 ? 'wrongShake 0.3s ease-in-out infinite' : 'none',
            }}>
              <div style={{ ...PS2, fontSize: 7, color: `${timerColor}80`, marginBottom: 3 }}>TIME</div>
              <div style={{
                ...PS2,
                fontSize: 26,
                color: timerColor,
                textShadow: `0 0 20px ${timerColor}`,
                lineHeight: 1,
              }}>
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
              {/* Timer bar */}
              <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', width: '100%' }}>
                <div style={{
                  height: '100%',
                  width: `${timerPct * 100}%`,
                  background: timerColor,
                  transition: 'width 1s linear, background 0.3s',
                  borderRadius: 2,
                }} />
              </div>
            </div>

            {/* Score */}
            <div style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,215,0,0.3)',
              background: 'rgba(255,215,0,0.05)',
              textAlign: 'center',
            }}>
              <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,215,0,0.6)', marginBottom: 3 }}>SCORE</div>
              <div style={{
                fontFamily: "'Teko', sans-serif",
                fontSize: 32,
                color: score < 0 ? '#ef4444' : '#FFD700',
                lineHeight: 1,
                textShadow: `0 0 12px ${score < 0 ? '#ef4444' : '#FFD700'}60`,
              }}>
                {score >= 0 ? score : score}
              </div>
            </div>
          </div>
        )}

        {/* ── Scene + Side Panels ──── */}
        <div style={{
          display: 'flex',
          gap: 8,
          flex: 1,
          minHeight: 0,
        }}>
          {/* Left panel: targets */}
          {phase === 'playing' && (
            <div style={{
              width: 150,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{ ...PS2, fontSize: 7, color: '#BC13FE', textAlign: 'center', marginBottom: 4 }}>
                FIND THESE
              </div>
              {targets.map(t => (
                <div
                  key={t.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: `2px solid ${t.found ? '#4ade80' : `${t.color}50`}`,
                    background: t.found ? 'rgba(74,222,128,0.1)' : `${t.color}08`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.3s',
                    opacity: t.found ? 0.6 : 1,
                  }}
                >
                  <span style={{
                    fontSize: 24,
                    filter: t.found ? 'grayscale(1) opacity(0.5)' : `drop-shadow(0 0 4px ${t.color})`,
                    flexShrink: 0,
                  }}>{t.emoji}</span>
                  <div>
                    <div style={{
                      fontFamily: "'Teko', sans-serif",
                      fontSize: 14,
                      color: t.found ? '#4ade80' : 'white',
                      lineHeight: 1.1,
                      textDecoration: t.found ? 'line-through' : 'none',
                    }}>{t.label}</div>
                    {t.found && <div style={{ ...PS2, fontSize: 6, color: '#4ade80' }}>✓ FOUND</div>}
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
              flex: 1,
              minHeight: 320,
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              border: wrongFlash
                ? '3px solid #ef4444'
                : phase === 'playing'
                ? '2px solid rgba(188,19,254,0.5)'
                : '2px solid rgba(188,19,254,0.2)',
              cursor: phase === 'playing' ? 'crosshair' : 'default',
              boxShadow: wrongFlash
                ? '0 0 40px rgba(239,68,68,0.5), inset 0 0 40px rgba(239,68,68,0.1)'
                : '0 0 30px rgba(188,19,254,0.2)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              background: '#050310',
            }}
          >
            {/* Background scene */}
            <SaloonBackground />

            {/* Objects */}
            {phase === 'playing' && allObjects.map(obj => (
              <ObjectToken
                key={obj.id}
                obj={obj}
                showHitbox={showHitbox}
                gameActive={phase === 'playing'}
                onFound={(id) => {
                  const rect = sceneRef.current.getBoundingClientRect();
                  handleObjectFound(id, obj.x, obj.y);
                }}
              />
            ))}

            {/* Click ripples */}
            {ripples.map(r => (
              <ClickRipple key={r.id} x={r.x} y={r.y} correct={r.correct} onDone={() => {}} />
            ))}

            {/* Floating feedback text */}
            {feedback && (
              <div style={{
                position: 'absolute',
                left: feedback.x,
                top: feedback.y - 20,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                zIndex: 50,
                ...PS2,
                fontSize: 10,
                color: feedback.correct ? '#4ade80' : '#ef4444',
                textShadow: `0 0 10px ${feedback.correct ? '#4ade80' : '#ef4444'}`,
                animation: 'feedbackFloat 0.9s ease-out forwards',
                whiteSpace: 'nowrap',
              }}>
                {feedback.text}
              </div>
            )}

            {/* Lobby overlay */}
            {phase === 'lobby' && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(5,3,11,0.85)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                zIndex: 40,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: "'Rye', serif",
                    fontSize: 'clamp(32px, 6vw, 64px)',
                    color: '#FFD700',
                    textShadow: '0 0 30px #FFD700',
                    lineHeight: 1,
                  }}>SEE THAT!</div>
                  <div style={{ ...PS2, fontSize: 8, color: '#BC13FE', marginTop: 8 }}>
                    HIDDEN OBJECT CHALLENGE
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 360 }}>
                  {[
                    { icon: '👁', label: '5 Objects', sub: 'Find them all' },
                    { icon: '⏱', label: '60 Seconds', sub: 'Race the clock' },
                    { icon: '🎯', label: 'No Misses', sub: '-10 per miss' },
                  ].map(f => (
                    <div key={f.label} style={{
                      padding: '12px 8px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 28 }}>{f.icon}</div>
                      <div style={{ ...PS2, fontSize: 7, color: '#FFD700', marginTop: 4 }}>{f.label}</div>
                      <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{f.sub}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={startGame}
                  style={{
                    padding: '14px 48px',
                    background: 'linear-gradient(135deg, #BC13FE, #9333ea)',
                    border: 'none',
                    borderRadius: 12,
                    color: 'white',
                    fontFamily: "'Teko', sans-serif",
                    fontSize: 28,
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
                    boxShadow: '0 0 30px rgba(188,19,254,0.5)',
                    animation: 'pulseGlow 2s ease-in-out infinite',
                    textTransform: 'uppercase',
                  }}
                >
                  ▶ START GAME
                </button>
              </div>
            )}

            {/* Win overlay */}
            {phase === 'win' && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(5,3,11,0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                zIndex: 40,
              }}>
                <div style={{
                  padding: '32px 48px',
                  borderRadius: 20,
                  border: '3px solid #FFD700',
                  background: 'rgba(5,3,11,0.95)',
                  textAlign: 'center',
                  boxShadow: '0 0 60px rgba(255,215,0,0.4)',
                  animation: 'winPop 0.5s ease-out',
                }}>
                  <div style={{ fontSize: 64 }}>🏆</div>
                  <div style={{
                    fontFamily: "'Rye', serif",
                    fontSize: 'clamp(28px, 5vw, 52px)',
                    color: '#FFD700',
                    textShadow: '0 0 30px #FFD700',
                  }}>YOU WIN!</div>
                  <div style={{ ...PS2, fontSize: 9, color: '#4ade80', marginTop: 8 }}>
                    ALL OBJECTS FOUND!
                  </div>
                  <div style={{
                    fontFamily: "'Teko', sans-serif",
                    fontSize: 48,
                    color: '#FFD700',
                    marginTop: 8,
                  }}>
                    {score} PTS
                  </div>
                  <div style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    TIME REMAINING: {timeLeft}s
                  </div>
                  <button
                    onClick={startGame}
                    style={{
                      marginTop: 20,
                      padding: '12px 36px',
                      background: 'linear-gradient(135deg,#4ade80,#22c55e)',
                      border: 'none',
                      borderRadius: 10,
                      color: 'black',
                      fontFamily: "'Teko', sans-serif",
                      fontSize: 24,
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    PLAY AGAIN
                  </button>
                </div>
              </div>
            )}

            {/* Lose overlay */}
            {phase === 'lose' && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(5,3,11,0.92)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 40,
              }}>
                <div style={{
                  padding: '32px 48px',
                  borderRadius: 20,
                  border: '3px solid #ef4444',
                  background: 'rgba(5,3,11,0.95)',
                  textAlign: 'center',
                  boxShadow: '0 0 60px rgba(239,68,68,0.4)',
                  animation: 'winPop 0.5s ease-out',
                }}>
                  <div style={{ fontSize: 64 }}>⏰</div>
                  <div style={{
                    fontFamily: "'Rye', serif",
                    fontSize: 'clamp(24px, 4vw, 44px)',
                    color: '#ef4444',
                    textShadow: '0 0 20px #ef4444',
                  }}>TIME'S UP!</div>
                  <div style={{ ...PS2, fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                    {foundCount} / {TARGETS_COUNT} FOUND
                  </div>
                  <div style={{
                    fontFamily: "'Teko', sans-serif",
                    fontSize: 48,
                    color: score < 0 ? '#ef4444' : '#FFD700',
                    marginTop: 8,
                  }}>
                    {score} PTS
                  </div>

                  {/* Show where the objects were */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                      MISSING OBJECTS WERE:
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {targets.filter(t => !t.found).map(t => (
                        <div key={t.id} style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: `1px solid ${t.color}50`,
                          background: `${t.color}10`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          <span style={{ fontSize: 18 }}>{t.emoji}</span>
                          <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 14, color: t.color }}>{t.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={startGame}
                    style={{
                      marginTop: 20,
                      padding: '12px 36px',
                      background: 'linear-gradient(135deg,#BC13FE,#9333ea)',
                      border: 'none',
                      borderRadius: 10,
                      color: 'white',
                      fontFamily: "'Teko', sans-serif",
                      fontSize: 24,
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                    }}
                  >
                    TRY AGAIN
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom bar ──── */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
          paddingTop: 4,
        }}>
          {phase !== 'lobby' && (
            <button
              onClick={() => setPhase('lobby')}
              style={{
                padding: '8px 24px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.6)',
                fontFamily: "'Teko', sans-serif",
                fontSize: 18,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              ↩ BACK TO LOBBY
            </button>
          )}
          {phase === 'playing' && (
            <button
              onClick={startGame}
              style={{
                padding: '8px 28px',
                background: 'linear-gradient(135deg,#FF5F1F,#cc4a18)',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontFamily: "'Teko', sans-serif",
                fontSize: 20,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              🔄 NEW GAME
            </button>
          )}
          <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            TEXASNOMAD GAMES • SEE THAT! v1.0
          </div>
        </div>
      </div>
    </div>
  );
}