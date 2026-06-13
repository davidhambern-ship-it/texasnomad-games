import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WORD_POOL, CATEGORY_MAP } from '@/data/wordSearchPool';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

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
const PLAYER_COLORS = ['#BC13FE', '#FF5F1F', '#FFD700', '#22d3ee'];
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
      for (let attempt = 0; attempt < 700; attempt++) {
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

function selectedCells(a, b) {
  if (!a || !b) return [];
  const dy = b.y - a.y, dx = b.x - a.x, adx = Math.abs(dx), ady = Math.abs(dy);
  if (!(dx === 0 || dy === 0 || adx === ady)) return [];
  const sx = Math.sign(dx), sy = Math.sign(dy), len = Math.max(adx, ady) + 1;
  const c = [];
  for (let i = 0; i < len; i++) c.push(`${a.y + sy * i}-${a.x + sx * i}`);
  return c;
}

function sameCells(a, b) {
  return [...a].sort().join('|') === [...b].sort().join('|');
}

// ── Host Grid (interactive) ────────────────────────────────────────────────────
function HostWordGrid({ grid, words, players, onWordFound }) {
  const [selectStart, setSelectStart] = useState(null);
  const [previewCells, setPreviewCells] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const boardRef = useRef(null);

  const foundMap = {};
  words.filter(w => w.found).forEach(w => {
    const player = players.find(p => p.seatNumber === w.foundBy);
    w.cells.forEach(id => { foundMap[id] = player?.color || '#00c875'; });
  });

  const getCellFromTouch = (touch) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    const y = el.dataset?.y, x = el.dataset?.x;
    if (y === undefined || x === undefined) return null;
    return { y: Number(y), x: Number(x) };
  };

  const cellSize = Math.min(32, Math.floor(Math.min(window.innerWidth * 0.55, 560) / (grid.length || 1)));

  const handleUp = (y, x) => {
    if (!isSelecting || !selectStart) return;
    setIsSelecting(false);
    const cells = selectedCells(selectStart, { x, y });
    setPreviewCells([]);
    setSelectStart(null);
    if (!cells.length) return;

    const text = cells.map(id => { const [ry, rx] = id.split('-').map(Number); return grid[ry]?.[rx] || ''; }).join('');
    const rev = text.split('').reverse().join('');
    const found = words.find(w => !w.found && (w.word === text || w.word === rev) && sameCells(w.cells, cells));
    if (found) onWordFound(found);
  };

  return (
    <div
      ref={boardRef}
      className="overflow-auto rounded-xl p-2 scanline-overlay relative select-none"
      style={{
        background: 'linear-gradient(135deg,#07040d,#0d0620)',
        border: '2px solid rgba(0,200,117,0.5)',
        boxShadow: '0 0 30px rgba(0,200,117,0.15), inset 0 0 40px rgba(0,200,117,0.04)',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{ display: 'grid', gridTemplateColumns: `repeat(${grid.length}, ${cellSize}px)`, gap: 2 }}
        onMouseUp={e => {
          const el = e.target.closest('[data-y]');
          if (el) handleUp(Number(el.dataset.y), Number(el.dataset.x));
        }}
        onTouchEnd={e => {
          e.preventDefault();
          const pt = getCellFromTouch(e.changedTouches[0]);
          if (pt) handleUp(pt.y, pt.x);
        }}
      >
        {grid.map((row, y) =>
          row.map((ch, x) => {
            const id = `${y}-${x}`;
            const isFound = !!foundMap[id];
            const isPreview = previewCells.includes(id);
            return (
              <div
                key={id}
                data-y={y}
                data-x={x}
                style={{
                  width: cellSize, height: cellSize,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 3,
                  fontSize: Math.max(8, cellSize * 0.46),
                  fontWeight: 700,
                  fontFamily: "'Press Start 2P', monospace",
                  cursor: 'pointer',
                  background: isFound ? `${foundMap[id]}25` : isPreview ? 'rgba(0,200,117,0.2)' : 'rgba(0,200,117,0.05)',
                  color: isFound ? foundMap[id] : isPreview ? '#00c875' : 'rgba(255,255,255,0.7)',
                  border: isFound ? `1px solid ${foundMap[id]}80` : isPreview ? '2px solid #00c875' : '1px solid rgba(0,200,117,0.15)',
                  boxShadow: isFound ? `0 0 8px ${foundMap[id]}60` : isPreview ? '0 0 10px rgba(0,200,117,0.5)' : 'none',
                  textShadow: isFound ? `0 0 8px ${foundMap[id]}` : isPreview ? '0 0 8px #00c875' : 'none',
                  transition: 'background 0.06s, color 0.06s',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onMouseDown={() => { setIsSelecting(true); setSelectStart({ x, y }); setPreviewCells([`${y}-${x}`]); }}
                onMouseEnter={() => { if (isSelecting && selectStart) setPreviewCells(selectedCells(selectStart, { x, y })); }}
                onTouchStart={e => { e.preventDefault(); setIsSelecting(true); setSelectStart({ x, y }); setPreviewCells([`${y}-${x}`]); }}
                onTouchMove={e => {
                  e.preventDefault();
                  const pt = getCellFromTouch(e.touches[0]);
                  if (pt && isSelecting && selectStart) setPreviewCells(selectedCells(selectStart, { x: pt.x, y: pt.y }));
                }}
              >
                {ch}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main Host Panel ────────────────────────────────────────────────────────────
export default function WordSearchHostPanel({ gs, updateState }) {
  const [difficulty, setDifficulty] = useState('simpleton');
  const [category, setCategory] = useState('random');
  const [mode, setMode] = useState('single');

  const running = gs.running;
  const paused = gs.paused;
  const words = gs.words || [];
  const players = gs.players || [];
  const grid = gs.grid || [];
  const found = words.filter(w => w.found);
  const wordsLeft = words.length - found.length;

  // Live timer display
  const [timeDisplay, setTimeDisplay] = useState('--');
  useEffect(() => {
    if (!running || paused || !gs.time_end) { setTimeDisplay('--'); return; }
    const tick = () => {
      const rem = Math.max(0, Math.floor((gs.time_end - Date.now()) / 1000));
      const m = Math.floor(rem / 60);
      const s = String(rem % 60).padStart(2, '0');
      setTimeDisplay(`${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [running, paused, gs.time_end]);

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
    const { grid: newGrid, words: puzzleWords } = buildPuzzle(difficulty, category);
    const activePlayers = players.length > 0
      ? players.map((p, i) => ({ ...p, score: 0, color: PLAYER_COLORS[i % 4] }))
      : [{ seatNumber: 'host', name: 'Host', isAI: false, score: 0, color: PLAYER_COLORS[0] }];
    const timeEnd = Date.now() + (mode === 'single' ? 300000 : 60000);
    await updateState({
      mode, difficulty, category,
      grid: newGrid, words: puzzleWords,
      players: activePlayers, active: 0,
      running: true, paused: false,
      time_end: timeEnd, message: null, last_action: null,
    });
  };

  const handleReset = async () => {
    await updateState({ running: false, paused: false, grid: [], words: [], players: [], message: null, last_action: null, time_end: null });
  };

  const handleWordFound = useCallback(async (foundWord) => {
    const updatedWords = words.map(w => w.word === foundWord.word ? { ...w, found: true, foundBy: 'host' } : w);
    const allFound = updatedWords.every(w => w.found);
    const hostPlayer = players.find(p => p.seatNumber === 'host');
    const updatedPlayers = players.map(p =>
      p.seatNumber === 'host' ? { ...p, score: (p.score || 0) + foundWord.points } : p
    );
    await updateState({
      words: updatedWords,
      players: updatedPlayers,
      last_action: { word: foundWord.word, result: 'correct', seatNumber: 'host', timestamp: Date.now() },
      ...(allFound ? { running: false, message: 'All words found! Game Over.' } : {}),
    });
  }, [words, players, updateState]);

  const handleRevealWord = async () => {
    const unfound = words.find(w => !w.found);
    if (!unfound) return;
    const updatedWords = words.map(w => w.word === unfound.word ? { ...w, found: true, foundBy: 'reveal' } : w);
    const allFound = updatedWords.every(w => w.found);
    await updateState({ words: updatedWords, ...(allFound ? { running: false, message: 'All words found! Game Over.' } : {}) });
  };

  const Select = ({ label, value, onChange, options }) => (
    <div className="space-y-1">
      <label className="block text-[7px] tracking-widest text-white/40 uppercase" style={PS2}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-white text-xs font-body focus:outline-none"
        style={{ background: '#07040d', border: '1px solid rgba(0,200,117,0.3)', color: '#fff' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ background: '#00c875', boxShadow: '0 0 10px #00c875' }} />
          <div>
            <h2 className="font-heading text-2xl tracking-widest text-white uppercase">Word Search</h2>
            <p className="text-[7px] tracking-[0.2em] text-white/30 uppercase" style={PS2}>Host Control Panel</p>
          </div>
        </div>
        {running && (
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-xl"
              style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(0,200,117,0.3)' }}>
              <div className="text-[6px] text-white/30 uppercase tracking-widest mb-0.5" style={PS2}>Time</div>
              <div className="font-heading text-2xl" style={{ color: '#FFD700', textShadow: '0 0 12px #FFD700' }}>{timeDisplay}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main layout: grid left, controls right */}
      <div className="flex-1 flex gap-5 min-h-0">

        {/* ── LEFT: Game Board ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {grid.length > 0 ? (
            <>
              {/* Turn / status bar */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(0,200,117,0.06)', border: '1px solid rgba(0,200,117,0.2)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: paused ? '#FF5F1F' : '#00c875' }} />
                  <span className="text-[8px] uppercase tracking-widest" style={{ ...PS2, color: paused ? '#FF5F1F' : '#00c875' }}>
                    {paused ? 'PAUSED' : running ? 'LIVE — Drag to select words' : 'GAME OVER'}
                  </span>
                </div>
                <span className="text-[7px] text-white/40 uppercase tracking-widest" style={PS2}>
                  {found.length}/{words.length} found
                </span>
              </div>

              <HostWordGrid
                grid={grid}
                words={words}
                players={players}
                onWordFound={handleWordFound}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '2px dashed rgba(0,200,117,0.2)', minHeight: 300 }}>
              <div className="text-center space-y-3">
                <div className="text-5xl">🔍</div>
                <div className="font-heading text-xl tracking-widest text-[#00c875] uppercase">No Game Active</div>
                <div className="text-[7px] text-white/30 uppercase tracking-widest" style={PS2}>Configure and start a game →</div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Controls + Word List ── */}
        <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">

          {/* Setup / Controls */}
          {!running ? (
            <div className="p-4 rounded-xl space-y-3"
              style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(0,200,117,0.4)' }}>
              <h3 className="text-[8px] tracking-[0.2em] text-[#00c875] uppercase" style={PS2}>New Game</h3>
              <Select label="Game Mode" value={mode} onChange={setMode} options={[
                { value: 'single', label: 'All Players — 5 min' },
                { value: 'multi',  label: 'Turn-Based — 1 min each' },
              ]} />
              <Select label="Difficulty" value={difficulty} onChange={setDifficulty} options={[
                { value: 'simpleton', label: 'Simpleton — 10 words' },
                { value: 'reader',    label: 'Reader — 15 words' },
                { value: 'scholar',   label: 'Scholar — 25 words' },
              ]} />
              <Select label="Category" value={category} onChange={setCategory} options={catOptions} />
              <button onClick={handleStart}
                className="w-full py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#00c87540,#00c87520)', border: '2px solid #00c875', color: '#00c875', boxShadow: '0 0 20px rgba(0,200,117,0.3)' }}>
                ▶ START GAME
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={() => updateState({ paused: !paused })}
                className="w-full py-2.5 rounded-xl font-heading text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ border: `2px solid ${paused ? '#4ade80' : '#FF5F1F'}`, color: paused ? '#4ade80' : '#FF5F1F', background: 'transparent' }}>
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button onClick={handleRevealWord} disabled={wordsLeft === 0}
                className="w-full py-2.5 rounded-xl font-heading text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                style={{ border: '2px solid #FFD700', color: '#FFD700', background: 'transparent' }}>
                💡 Reveal a Word
              </button>
              <button onClick={handleReset}
                className="w-full py-2.5 rounded-xl font-heading text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ border: '2px solid #ef4444', color: '#ef4444', background: 'transparent' }}>
                ↺ Reset
              </button>
            </div>
          )}

          {/* Scoreboard */}
          {players.length > 0 && (
            <div className="p-3 rounded-xl space-y-2"
              style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <h3 className="text-[7px] tracking-[0.2em] text-[#FFD700]/70 uppercase mb-2" style={PS2}>Scores</h3>
              {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.seatNumber} className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                  style={{ background: `${p.color}10`, border: `1px solid ${p.color}30` }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-[7px] text-white uppercase tracking-widest" style={PS2}>{p.name}</span>
                  </div>
                  <span className="font-heading text-base" style={{ color: p.color }}>{p.score || 0}</span>
                </div>
              ))}
            </div>
          )}

          {/* Word list */}
          {words.length > 0 && (
            <div className="p-3 rounded-xl space-y-2"
              style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(188,19,254,0.2)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[7px] tracking-[0.2em] text-[#BC13FE] uppercase" style={PS2}>Words</span>
                <span style={{ ...PS2, fontSize: 7, color: '#FFD700' }}>{found.length}/{words.length}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: words.length ? `${(found.length / words.length) * 100}%` : '0%', background: 'linear-gradient(90deg,#BC13FE,#00c875)' }} />
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {words.map(w => (
                  <div key={w.word} className="px-1.5 py-1 rounded text-center"
                    style={{
                      fontFamily: "'Press Start 2P', monospace", fontSize: 5,
                      background: w.found ? 'rgba(0,200,117,0.1)' : 'rgba(255,255,255,0.03)',
                      border: w.found ? '1px solid rgba(0,200,117,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: w.found ? '#00c875' : 'rgba(255,255,255,0.4)',
                      textDecoration: w.found ? 'line-through' : 'none',
                      textShadow: w.found ? '0 0 6px #00c875' : 'none',
                    }}>
                    {w.word}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game over message */}
          {gs.message && !running && (
            <div className="p-4 rounded-xl text-center"
              style={{ background: 'linear-gradient(135deg,#07040d,#1a0730)', border: '2px solid rgba(255,215,0,0.5)', boxShadow: '0 0 20px rgba(255,215,0,0.1)' }}>
              <div className="text-2xl mb-1">🏆</div>
              <div className="font-heading text-sm tracking-widest text-[#FFD700] uppercase">{gs.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}