import React, { useState } from 'react';
import { WORD_POOL, CATEGORY_MAP } from '@/data/wordSearchPool';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Reuse the same puzzle-building logic from the game page
const DIFFICULTIES = {
  simpleton: { label: 'Simpleton', words: 10, size: 12, bonus: 0 },
  reader:    { label: 'Reader',    words: 15, size: 16, bonus: 50 },
  scholar:   { label: 'Scholar',   words: 25, size: 22, bonus: 100 },
};

const DIRS = [
  { key: 'E',  dx:  1, dy:  0, points: 100 },
  { key: 'W',  dx: -1, dy:  0, points: 150 },
  { key: 'S',  dx:  0, dy:  1, points: 100 },
  { key: 'N',  dx:  0, dy: -1, points: 150 },
  { key: 'SE', dx:  1, dy:  1, points: 200 },
  { key: 'SW', dx: -1, dy:  1, points: 200 },
  { key: 'NE', dx:  1, dy: -1, points: 250 },
  { key: 'NW', dx: -1, dy: -1, points: 250 },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const clean = (w) => w.replace(/[^A-Z]/g, '').toUpperCase();

function getWordList(cat, difficulty, count) {
  const poolKey = cat === 'random' ? null : CATEGORY_MAP[cat];
  let src;
  if (!poolKey) {
    src = Object.values(WORD_POOL).flatMap(c => c[difficulty] || []);
  } else {
    const pool = WORD_POOL[poolKey] || WORD_POOL.general;
    src = pool[difficulty] || pool.simpleton;
  }
  return [...new Set(src.map(clean))].sort(() => Math.random() - 0.5).slice(0, count);
}

function buildPuzzle(difficulty, category) {
  const cfg = DIFFICULTIES[difficulty];
  const g = Array.from({ length: cfg.size }, () => Array.from({ length: cfg.size }, () => ''));
  const placed = [];
  getWordList(category, difficulty, cfg.words)
    .sort((a, b) => b.length - a.length)
    .forEach(w => {
      for (let a = 0; a < 700; a++) {
        const d = rand(DIRS);
        const x = Math.floor(Math.random() * g.length);
        const y = Math.floor(Math.random() * g.length);
        let ok = true;
        for (let i = 0; i < w.length; i++) {
          const nx = x + d.dx * i, ny = y + d.dy * i;
          if (nx < 0 || ny < 0 || ny >= g.length || nx >= g.length) { ok = false; break; }
          if (g[ny][nx] && g[ny][nx] !== w[i]) { ok = false; break; }
        }
        if (!ok) continue;
        const cells = [];
        for (let i = 0; i < w.length; i++) {
          const nx = x + d.dx * i, ny = y + d.dy * i;
          g[ny][nx] = w[i];
          cells.push(`${ny}-${nx}`);
        }
        placed.push({ word: w, found: false, foundBy: null, cells, direction: d.key, points: d.points + cfg.bonus });
        break;
      }
    });
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g.length; x++)
      if (!g[y][x]) g[y][x] = rand(ALPHABET);
  return { grid: g, words: placed };
}

const PLAYER_COLORS = ['#BC13FE', '#FF5F1F', '#FFD700', '#22d3ee'];

export default function WordSearchHostPanel({ gs, updateState }) {
  const [difficulty, setDifficulty] = useState('simpleton');
  const [category, setCategory] = useState('random');
  const [mode, setMode] = useState('single');

  const running = gs.running;
  const paused = gs.paused;
  const words = gs.words || [];
  const players = gs.players || [];
  const found = words.filter(w => w.found);
  const wordsLeft = words.length - found.length;

  const catOptions = [
    { value: 'random',     label: 'Random' },
    { value: 'popculture', label: 'Pop Culture' },
    { value: 'online',     label: 'Online Culture' },
    { value: 'food',       label: 'Food' },
    { value: 'spiritual',  label: 'Bible / Spiritual' },
    { value: 'gaming',     label: 'Gaming' },
    { value: 'music',      label: 'Music' },
    { value: 'travel',     label: 'Travel' },
    { value: 'general',    label: 'General' },
  ];

  const handleStart = async () => {
    const cfg = DIFFICULTIES[difficulty];
    const { grid, words: puzzleWords } = buildPuzzle(difficulty, category);

    const activePlayers = players.length > 0
      ? players.map((p, i) => ({ ...p, score: 0, color: PLAYER_COLORS[i % 4] }))
      : [{ seatNumber: 1, name: 'Player 1', isAI: false, score: 0, color: PLAYER_COLORS[0] }];

    const timeEnd = Date.now() + (mode === 'single' ? 300000 : 60000);
    await updateState({
      mode,
      difficulty,
      category,
      grid: puzzleWords.length > 0 ? grid : [],
      words: puzzleWords,
      players: activePlayers,
      active: 0,
      running: true,
      paused: false,
      time_end: timeEnd,
      message: null,
      last_action: null,
    });
  };

  const handleReset = async () => {
    await updateState({
      running: false,
      paused: false,
      grid: [],
      words: [],
      players: [],
      message: null,
      last_action: null,
      time_end: null,
    });
  };

  const handleRevealWord = async () => {
    const unfound = words.find(w => !w.found);
    if (!unfound) return;
    const updatedWords = words.map(w => w.word === unfound.word ? { ...w, found: true, foundBy: 'host' } : w);
    const allFound = updatedWords.every(w => w.found);
    await updateState({
      words: updatedWords,
      ...(allFound ? { running: false, message: 'All words found! Game Over.' } : {}),
    });
  };

  const Select = ({ label, value, onChange, options }) => (
    <div className="space-y-1">
      <label className="block text-[7px] tracking-widest text-white/40 uppercase" style={PS2}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-white text-xs font-body focus:outline-none"
        style={{ background: '#07040d', border: '1px solid rgba(188,19,254,0.3)', color: '#fff' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 rounded-full" style={{ background: '#00c875', boxShadow: '0 0 10px #00c875' }} />
        <div>
          <h2 className="font-heading text-2xl tracking-widest text-white uppercase">Word Search</h2>
          <p className="text-[7px] tracking-[0.2em] text-white/30 uppercase" style={PS2}>Host Control Panel</p>
        </div>
      </div>

      {/* Stats row */}
      {running && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Words Left', value: wordsLeft, color: '#BC13FE' },
            { label: 'Found', value: found.length, color: '#00c875' },
            { label: 'Status', value: paused ? 'PAUSED' : 'LIVE', color: paused ? '#FF5F1F' : '#4ade80' },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl text-center"
              style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[6px] tracking-widest text-white/30 uppercase mb-1" style={PS2}>{s.label}</div>
              <div className="font-heading text-2xl" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Players scoreboard */}
      {running && players.length > 0 && (
        <div className="p-4 rounded-xl space-y-2"
          style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(255,215,0,0.2)' }}>
          <h3 className="text-[8px] tracking-[0.2em] text-[#FFD700]/70 uppercase mb-3" style={PS2}>Scoreboard</h3>
          {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
            <div key={p.seatNumber} className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: `${p.color}10`, border: `1px solid ${p.color}30` }}>
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-white/40" style={PS2}>#{i + 1}</span>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                <span className="text-[8px] tracking-widest text-white uppercase" style={PS2}>{p.name}</span>
              </div>
              <div className="font-heading text-xl" style={{ color: p.color }}>{p.score || 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Word list */}
      {running && words.length > 0 && (
        <div className="p-4 rounded-xl space-y-3"
          style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(188,19,254,0.2)' }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[8px] tracking-[0.2em] text-[#BC13FE] uppercase" style={PS2}>Words</h3>
            <span style={{ ...PS2, fontSize: 7, color: '#FFD700' }}>{found.length}/{words.length}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: words.length ? `${(found.length / words.length) * 100}%` : '0%', background: 'linear-gradient(90deg,#BC13FE,#00c875)' }} />
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {words.map(w => (
              <div key={w.word} className="px-2 py-1 rounded text-center"
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 6,
                  background: w.found ? 'rgba(0,200,117,0.1)' : 'rgba(255,255,255,0.03)',
                  border: w.found ? '1px solid rgba(0,200,117,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: w.found ? '#00c875' : 'rgba(255,255,255,0.35)',
                  textDecoration: w.found ? 'line-through' : 'none',
                }}>
                {w.word}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {running ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => updateState({ paused: !paused })}
            className="py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{ border: `2px solid ${paused ? '#4ade80' : '#FF5F1F'}`, color: paused ? '#4ade80' : '#FF5F1F', background: 'transparent' }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={handleRevealWord}
            disabled={wordsLeft === 0}
            className="py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
            style={{ border: '2px solid #FFD700', color: '#FFD700', background: 'transparent' }}>
            💡 Reveal Word
          </button>
          <button
            onClick={handleReset}
            className="col-span-2 py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{ border: '2px solid #ef4444', color: '#ef4444', background: 'transparent' }}>
            ↺ Reset Game
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-xl space-y-4"
          style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(0,200,117,0.4)' }}>
          <h3 className="text-[8px] tracking-[0.2em] text-[#00c875] uppercase" style={PS2}>Start New Game</h3>
          <Select
            label="Game Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: 'All Players — Same Timer' },
              { value: 'multi',  label: 'Turn-Based — 1 min each' },
            ]}
          />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'simpleton', label: 'Simpleton — 10 words, 12×12' },
              { value: 'reader',    label: 'Reader — 15 words, 16×16' },
              { value: 'scholar',   label: 'Scholar — 25 words, 22×22' },
            ]}
          />
          <Select label="Category" value={category} onChange={setCategory} options={catOptions} />
          <button
            onClick={handleStart}
            className="w-full py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#00c87540,#00c87520)', border: '2px solid #00c875', color: '#00c875', boxShadow: '0 0 20px rgba(0,200,117,0.3)' }}>
            ▶ START GAME
          </button>
        </div>
      )}
    </div>
  );
}