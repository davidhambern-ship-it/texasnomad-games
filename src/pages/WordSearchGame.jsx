import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameInstructions from '@/components/game/GameInstructions.jsx';
import useGameStats from '@/hooks/useGameStats';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import { base44 } from '@/api/base44Client';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import { WORD_POOL, CATEGORY_MAP } from '@/data/wordSearchPool';
import { runAITurn, validateAISubmission } from '@/lib/wordSearchAI';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// ── Constants ─────────────────────────────────────────────────────────────────
const DIFFICULTIES = {
  simpleton: { label: 'Simpleton', words: 10, size: 12, bonus: 0,   aiChance: 0.35, aiMin: 35, aiMax: 55 },
  reader:    { label: 'Reader',    words: 15, size: 16, bonus: 50,  aiChance: 0.5,  aiMin: 25, aiMax: 45 },
  scholar:   { label: 'Scholar',   words: 25, size: 22, bonus: 100, aiChance: 0.7,  aiMin: 10, aiMax: 35 },
};

const DIRS = [
  { key: 'E',  dx:  1, dy:  0, label: 'Horizontal',          points: 100 },
  { key: 'W',  dx: -1, dy:  0, label: 'Horizontal Backward', points: 150 },
  { key: 'S',  dx:  0, dy:  1, label: 'Vertical',            points: 100 },
  { key: 'N',  dx:  0, dy: -1, label: 'Vertical Backward',   points: 150 },
  { key: 'SE', dx:  1, dy:  1, label: 'Diagonal',            points: 200 },
  { key: 'SW', dx: -1, dy:  1, label: 'Diagonal',            points: 200 },
  { key: 'NE', dx:  1, dy: -1, label: 'Diagonal Backward',   points: 250 },
  { key: 'NW', dx: -1, dy: -1, label: 'Diagonal Backward',   points: 250 },
];

const PLAYER_COLORS = ['#BC13FE', '#FF5F1F', '#FFD700', '#22d3ee'];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const clean = (w) => w.replace(/[^A-Z]/g, '').toUpperCase();

// ── Puzzle generation ─────────────────────────────────────────────────────────
function getWordList(cat, difficulty, count) {
  const poolKey = cat === 'random' ? null : CATEGORY_MAP[cat];
  let src;
  if (!poolKey) {
    // Random: pull from all categories at the matching difficulty tier
    src = Object.values(WORD_POOL).flatMap(cat => cat[difficulty] || []);
  } else {
    const pool = WORD_POOL[poolKey] || WORD_POOL.general;
    src = pool[difficulty] || pool.simpleton;
  }
  return [...new Set(src.map(clean))].sort(() => Math.random() - 0.5).slice(0, count);
}

function emptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
}

function canPlace(g, w, x, y, d) {
  for (let i = 0; i < w.length; i++) {
    const nx = x + d.dx * i, ny = y + d.dy * i;
    if (nx < 0 || ny < 0 || ny >= g.length || nx >= g.length) return false;
    if (g[ny][nx] && g[ny][nx] !== w[i]) return false;
  }
  return true;
}

function placeWord(g, w, bonus) {
  for (let a = 0; a < 700; a++) {
    const d = rand(DIRS);
    const x = Math.floor(Math.random() * g.length);
    const y = Math.floor(Math.random() * g.length);
    if (!canPlace(g, w, x, y, d)) continue;
    const cells = [];
    for (let i = 0; i < w.length; i++) {
      const nx = x + d.dx * i, ny = y + d.dy * i;
      g[ny][nx] = w[i];
      cells.push(`${ny}-${nx}`);
    }
    return { word: w, found: false, foundBy: null, cells, direction: d.key, directionLabel: d.label, points: d.points + bonus };
  }
  return null;
}

function buildPuzzle(difficulty, category) {
  const cfg = DIFFICULTIES[difficulty];
  const g = emptyGrid(cfg.size);
  const placed = [];
  getWordList(category, difficulty, cfg.words)
    .sort((a, b) => b.length - a.length)
    .forEach(w => { const p = placeWord(g, w, cfg.bonus); if (p) placed.push(p); });
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WordSearchGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const cpuId = params.get('cpu');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <WordSearchViewer roomCode={roomCode} cpuId={cpuId} />;
}

function WordSearchViewer({ roomCode, cpuId }) {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(() => !sessionStorage.getItem(`tn_instructions_word-search_${roomCode}`));
  const dismissInstructions = () => { sessionStorage.setItem(`tn_instructions_word-search_${roomCode}`, '1'); setShowInstructions(false); };
  const { room, loading, updateState, registerUser } = useGameRoom(roomCode, 'word-search', 'viewer');
  const gs = room?.game_state || {};
  const isSinglePlayer = !!(cpuId || gs.single_player);
  const { recordStat, resetStat } = useGameStats('word-search');
  const statRecordedRef = useRef(false);

  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'word-search', updateState, false, null, registerUser);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [tick, setTick] = useState(0);
  const notifTimerRef = useRef(null);
  const containerRef = useRef(null);

  // Local selection state (not synced — each player selects independently)
  const [selectStart, setSelectStart] = useState(null);
  const [previewCells, setPreviewCells] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);

  // Throttle cursor sync — don't flood the server on every mouse move
  const cursorSyncRef = useRef(null);

  // AI visual state — cells the AI is currently "looking at"
  const [aiPreviewCells, setAiPreviewCells] = useState([]);
  const [aiPreviewColor, setAiPreviewColor] = useState('#FF5F1F');

  const cpuCharacter = isSinglePlayer
    ? (TEXASNOMAD_CHARACTERS.find(c => c.id === (cpuId || gs.cpu_opponent_id)) || null)
    : null;

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Watch last_action for notifications
  const lastActionRef = useRef(null);
  useEffect(() => {
    const action = gs.last_action;
    if (!action) return;
    if (JSON.stringify(action) === JSON.stringify(lastActionRef.current)) return;
    lastActionRef.current = action;
    setNotification({ seatNumber: action.seatNumber, letter: action.word, result: action.result });
    clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 2800);
  }, [gs.last_action]);

  // ── Timer effect ──────────────────────────────────────────────────────────
  const timerRef = useRef(null);
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!gs.running || gs.paused || !gs.time_end) return;
    timerRef.current = setInterval(() => {
      setTick(t => t + 1); // force re-render every second
      const remaining = Math.max(0, Math.floor((gs.time_end - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        if (isSeated && seatNumber === gs.players?.[gs.active]?.seatNumber) {
          handleTimeExpired();
        }
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gs.running, gs.paused, gs.time_end, gs.active]);

  // ── AI turn (fair play — board search only, no answer-list access) ────────
  const aiTimerRef = useRef(null);
  const aiTurnIdRef = useRef(0); // prevent stale callbacks
  useEffect(() => {
    clearTimeout(aiTimerRef.current);
    if (!gs.running || gs.paused || !isSinglePlayer) return;
    const players = gs.players || [];
    const activePlayer = players[gs.active || 0];
    if (!activePlayer?.isAI) return;
    const grid = gs.grid || [];
    if (!grid.length) return;

    const turnId = ++aiTurnIdRef.current;
    const charId = activePlayer.characterId || cpuId || gs.cpu_opponent_id || 'carlos';

    runAITurn(grid, charId, gs.words || []).then(async (result) => {
      if (turnId !== aiTurnIdRef.current) return; // stale turn
      if (!gs.running || gs.paused) return;

      const currentPlayers = gs.players || [];
      const activeIdx = gs.active || 0;
      const active = currentPlayers[activeIdx];
      if (!active?.isAI) return;

      // Show the AI's selection on the board for 900ms before submitting
      if (result.type === 'submit' && result.cells?.length) {
        setAiPreviewCells(result.cells);
        setAiPreviewColor(active.color || '#FF5F1F');
        await new Promise(r => setTimeout(r, 900));
        setAiPreviewCells([]);
        if (turnId !== aiTurnIdRef.current) return; // stale after delay
      }

      if (result.type === 'timeout') {
        // Time expired penalty
        const newScore = (active.score || 0) - 10;
        const updatedPlayers = currentPlayers.map((p, i) => i === activeIdx ? { ...p, score: newScore } : p);
        const nextActive = (activeIdx + 1) % Math.max(currentPlayers.length, 1);
        await updateState({ players: updatedPlayers, active: nextActive, time_end: Date.now() + 60000 });
        return;
      }

      // Validate against answer list (same as human validation)
      const currentWords = gs.words || [];
      const matched = validateAISubmission(result.word, result.cells, currentWords);

      if (matched) {
        // Correct — word found
        const newScore = (active.score || 0) + matched.points;
        const updatedWords = currentWords.map(w => w.word === matched.word ? { ...w, found: true, foundBy: active.seatNumber } : w);
        const updatedPlayers = currentPlayers.map((p, i) => i === activeIdx ? { ...p, score: newScore } : p);
        const allFound = updatedWords.every(w => w.found);
        if (allFound) {
          const winner = [...updatedPlayers].sort((a, b) => b.score - a.score)[0];
          await updateState({ words: updatedWords, players: updatedPlayers, running: false, message: `All words found! Winner: ${winner?.name} with ${winner?.score} pts.`, last_action: { word: matched.word, result: 'correct', seatNumber: active.seatNumber, timestamp: Date.now() } });
          return;
        }
        const mode = gs.mode || 'single';
        const nextActive = mode === 'single' ? activeIdx : (activeIdx + 1) % Math.max(currentPlayers.length, 1);
        await updateState({ words: updatedWords, players: updatedPlayers, active: nextActive, time_end: Date.now() + (mode === 'single' ? 300000 : 60000), last_action: { word: matched.word, result: 'correct', seatNumber: active.seatNumber, timestamp: Date.now() } });
      } else {
        // Wrong guess penalty
        const newScore = (active.score || 0) - 20;
        const updatedPlayers = currentPlayers.map((p, i) => i === activeIdx ? { ...p, score: newScore } : p);
        const nextActive = (activeIdx + 1) % Math.max(currentPlayers.length, 1);
        await updateState({ players: updatedPlayers, active: nextActive, time_end: Date.now() + 60000, last_action: { word: result.word, result: 'wrong', seatNumber: active.seatNumber, timestamp: Date.now() } });
      }
    });

    return () => { aiTurnIdRef.current++; setAiPreviewCells([]); }; // invalidate on cleanup
  }, [gs.running, gs.paused, gs.active, gs.grid, isSinglePlayer]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTimeExpired = useCallback(async () => {
    if (!gs.running || gs.paused) return;
    const mode = gs.mode || 'single';
    const players = gs.players || [];
    const activeIdx = gs.active || 0;
    const activePlayer = players[activeIdx];
    if (!activePlayer) return;

    const newScore = (activePlayer.score || 0) - 10;
    const updatedPlayers = players.map((p, i) => i === activeIdx ? { ...p, score: newScore } : p);

    if (mode === 'single') {
      const winner = [...updatedPlayers].sort((a, b) => b.score - a.score)[0];
      await updateState({ running: false, players: updatedPlayers, message: `Time up! Winner: ${winner?.name} with ${winner?.score} pts.` });
    } else {
      // Turn-based (multi or ai): rotate to next player with 60s turn
      const nextActive = (activeIdx + 1) % Math.max(players.length, 1);
      await updateState({ active: nextActive, players: updatedPlayers, time_end: Date.now() + 60000 });
    }
  }, [gs, updateState]);



  // Record stat when game ends
  useEffect(() => {
    if (gs.running || !gs.message || statRecordedRef.current) return;
    const players = gs.players || [];
    const myPlayer = players.find(p => p.seatNumber === seatNumber);
    if (!myPlayer) return;
    statRecordedRef.current = true;
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const won = sorted[0]?.seatNumber === seatNumber;
    recordStat({ score: Math.max(0, myPlayer.score || 0), won });
  }, [gs.running, gs.message]);

  const handleEnd = async (msg) => {
    const players = gs.players || [];
    const winner = [...players].sort((a, b) => b.score - a.score)[0];
    await updateState({ running: false, message: msg + (winner ? ` Winner: ${winner.name} with ${winner.score} pts.` : '') });
  };

  // Sync this player's current drag to game_state so others can see it
  const syncCursor = (cells) => {
    clearTimeout(cursorSyncRef.current);
    cursorSyncRef.current = setTimeout(() => {
      const cursors = { ...(gs.player_cursors || {}), [seatNumber]: cells.length ? cells : null };
      updateState({ player_cursors: cursors });
    }, 80); // 80ms throttle
  };

  const clearCursor = () => {
    clearTimeout(cursorSyncRef.current);
    const cursors = { ...(gs.player_cursors || {}), [seatNumber]: null };
    updateState({ player_cursors: cursors });
  };

  const handleCellDown = (y, x) => {
    if (!gs.running || gs.paused) return;
    const players = gs.players || [];
    const activePlayer = players[gs.active || 0];
    if (!activePlayer || activePlayer.isAI) return;
    if (activePlayer.seatNumber !== seatNumber) return;
    setIsSelecting(true);
    setSelectStart({ x, y });
    setPreviewCells([`${y}-${x}`]);
    syncCursor([`${y}-${x}`]);
  };

  const handleCellMove = (y, x) => {
    if (!isSelecting || !selectStart) return;
    const cells = selectedCells(selectStart, { x, y });
    setPreviewCells(cells);
    syncCursor(cells);
  };

  const handleCellUp = async (y, x) => {
    if (!isSelecting || !selectStart) return;
    setIsSelecting(false);
    const cells = selectedCells(selectStart, { x, y });
    setPreviewCells([]);
    setSelectStart(null);
    clearCursor();
    if (!gs.running || gs.paused || !cells.length) return;

    const players = gs.players || [];
    const activeIdx = gs.active || 0;
    const activePlayer = players[activeIdx];
    if (!activePlayer || activePlayer.isAI || activePlayer.seatNumber !== seatNumber) return;

    const grid = gs.grid || [];
    const text = cells.map(id => { const [ry, rx] = id.split('-').map(Number); return grid[ry]?.[rx] || ''; }).join('');
    const rev = text.split('').reverse().join('');
    const found = (gs.words || []).find(w => !w.found && (w.word === text || w.word === rev) && sameCells(w.cells, cells));

    if (found) {
      const newScore = (activePlayer.score || 0) + found.points;
      const updatedWords = (gs.words || []).map(w => w.word === found.word ? { ...w, found: true, foundBy: seatNumber } : w);
      const updatedPlayers = players.map((p, i) => i === activeIdx ? { ...p, score: newScore } : p);
      const allFound = updatedWords.every(w => w.found);
      if (allFound) {
        const winner = [...updatedPlayers].sort((a, b) => b.score - a.score)[0];
        await updateState({ words: updatedWords, players: updatedPlayers, running: false, message: `All words found! Winner: ${winner?.name} with ${winner?.score} pts.`, last_action: { word: found.word, result: 'correct', seatNumber, timestamp: Date.now() } });
        return;
      }
      const mode = gs.mode || 'single';
      const isTurnBased = mode !== 'single';
      const nextActive = isTurnBased ? (activeIdx + 1) % Math.max(players.length, 1) : activeIdx;
      const timeEnd = Date.now() + (isTurnBased ? 60000 : 300000);
      await updateState({ words: updatedWords, players: updatedPlayers, active: nextActive, time_end: timeEnd, last_action: { word: found.word, result: 'correct', seatNumber, timestamp: Date.now() } });
    } else {
      // Wrong selection penalty
      const newScore = (activePlayer.score || 0) - 20;
      const updatedPlayers = players.map((p, i) => i === activeIdx ? { ...p, score: newScore } : p);
      const mode = gs.mode || 'single';
      const isTurnBased = mode !== 'single';
      const nextActive = isTurnBased ? (activeIdx + 1) % Math.max(players.length, 1) : activeIdx;
      const timeEnd = Date.now() + (isTurnBased ? 60000 : 300000);
      await updateState({ players: updatedPlayers, active: nextActive, time_end: timeEnd, last_action: { word: text, result: 'wrong', seatNumber, timestamp: Date.now() } });
    }
  };

  const handleStartGame = async (config) => {
    const { mode, difficulty, category } = config;
    const cfg = DIFFICULTIES[difficulty];
    const { grid, words } = buildPuzzle(difficulty, category);

    const players = [];
    if (isSinglePlayer) {
      players.push({ seatNumber, name: 'You', isAI: false, score: 0, color: PLAYER_COLORS[0] });
      if (cpuCharacter) {
        players.push({ seatNumber: 'AI', name: cpuCharacter.name, isAI: true, characterId: cpuCharacter.id, score: 0, color: PLAYER_COLORS[1] });
      }
    } else if (mode === 'single') {
      players.push({ seatNumber, name: `Seat ${seatNumber}`, isAI: false, score: 0, color: PLAYER_COLORS[0] });
    } else {
      // Multiplayer: use existing players or just this player
      const existingPlayers = gs.players || [];
      if (existingPlayers.length > 0) {
        existingPlayers.forEach((p, i) => players.push({ ...p, score: 0, color: PLAYER_COLORS[i % 4] }));
      } else {
        players.push({ seatNumber, name: `Seat ${seatNumber}`, isAI: false, score: 0, color: PLAYER_COLORS[0] });
      }
    }

    const isTurnBased = mode !== 'single';
    const timeEnd = Date.now() + (isTurnBased ? 60000 : 300000);
    await updateState({
      mode, difficulty, category,
      grid, words,
      players,
      active: 0,
      running: true,
      paused: false,
      time_end: timeEnd,
      message: isTurnBased ? `${players[0]?.name || 'Player'} has 1 minute to find a word!` : 'Find all words before time runs out!',
      last_action: null,
    });
  };

  const handleReset = () => { statRecordedRef.current = false; resetStat(); handleStartGame({ mode: gs.mode || 'single', difficulty: gs.difficulty || 'simpleton', category: gs.category || 'random' }); };

  const grid = gs.grid || [];
  const words = gs.words || [];
  const players = gs.players || [];
  const activeIdx = gs.active || 0;
  const activePlayer = players[activeIdx];
  const isMyTurn = activePlayer?.seatNumber === seatNumber;
  const timeRemaining = gs.time_end ? Math.max(0, Math.floor((gs.time_end - Date.now()) / 1000)) : 0;
  const mins = Math.floor(timeRemaining / 60);
  const secs = String(timeRemaining % 60).padStart(2, '0');

  if (showInstructions) return <GameInstructions gameId="word-search" onDismiss={dismissInstructions} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070311] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const showSetup = !gs.running && !gs.message;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#070311]/90 backdrop-blur-xl">
        <div className="px-4 h-12 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="shrink-0">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FFD700] uppercase text-[9px] tracking-widest hidden sm:block" style={PS2}>Word Search</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse shrink-0" />
              <span className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
            </div>
            {isSinglePlayer && (
              <span className="px-2 py-0.5 bg-[#FFD700]/10 border border-[#FFD700]/40 rounded text-[#FFD700] text-[7px] tracking-widest uppercase" style={PS2}>
                🤖 1P vs CPU
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} alreadyChosen={false} />
            <button onClick={() => navigate('/games')}
              className="px-3 py-1.5 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-xs font-body tracking-wide">
              ← LOBBY
            </button>
            <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[7px] tracking-widest uppercase" style={PS2}>
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">

        {/* ── Left: Setup / Stats ───────────────────────────────────────────── */}
        <aside className="lg:w-72 shrink-0 space-y-3 order-2 lg:order-1">
          {showSetup ? (
            <SetupPanel isSinglePlayer={isSinglePlayer} cpuCharacter={cpuCharacter} onStart={handleStartGame} seatNumber={seatNumber} />
          ) : (
            <StatsPanel
              players={players}
              activeIdx={activeIdx}
              mins={mins}
              secs={secs}
              running={gs.running}
              paused={gs.paused}
              words={words}
              mode={gs.mode}
              isMyTurn={isMyTurn}
              isSinglePlayer={isSinglePlayer}
              onReset={handleReset}
              updateState={updateState}
              gs={gs}
            />
          )}
        </aside>

        {/* ── Center: Board ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center gap-4 order-1 lg:order-2">
          {gs.message && !gs.running && (
            <div className="w-full px-6 py-5 rounded-xl text-center"
              style={{ background: 'linear-gradient(135deg,#07040d,#1a0730)', border: '2px solid rgba(255,215,0,0.5)', boxShadow: '0 0 30px rgba(255,215,0,0.15)' }}>
              <div className="text-3xl mb-2">🏆</div>
              <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase text-glow-gold">{gs.message}</div>
              <button onClick={handleReset}
                className="mt-4 px-8 py-2.5 rounded-lg font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(188,19,254,0.15)', border: '2px solid #BC13FE', color: '#BC13FE', boxShadow: '0 0 16px rgba(188,19,254,0.3)' }}>
                ↺ Play Again
              </button>
            </div>
          )}

          {gs.running && (
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: 'rgba(188,19,254,0.06)', border: '1px solid rgba(188,19,254,0.2)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: isMyTurn ? '#4ade80' : '#FF5F1F' }} />
                <span className="text-[8px] tracking-widest uppercase" style={{ ...PS2, color: isMyTurn ? '#4ade80' : '#FF5F1F' }}>
                  {isMyTurn ? 'YOUR TURN' : `${activePlayer?.name || '?'}'S TURN`}
                </span>
              </div>
              <div className="font-heading text-2xl tracking-widest"
                style={{ color: timeRemaining <= 10 ? '#ef4444' : '#FFD700', textShadow: `0 0 12px ${timeRemaining <= 10 ? '#ef4444' : '#FFD700'}` }}>
                {mins}:{secs}
              </div>
              {gs.paused && (
                <div className="px-2 py-0.5 rounded border border-[#FF5F1F]/50 text-[#FF5F1F] text-[7px] uppercase tracking-widest" style={PS2}>PAUSED</div>
              )}
            </div>
          )}

          {grid.length > 0 && (
            <WordGrid
              grid={grid}
              words={words}
              players={players}
              previewCells={previewCells}
              aiPreviewCells={aiPreviewCells}
              aiPreviewColor={aiPreviewColor}
              playerCursors={gs.player_cursors || {}}
              mySeatNumber={seatNumber}
              onCellDown={handleCellDown}
              onCellMove={handleCellMove}
              onCellUp={handleCellUp}
              canInteract={gs.running && !gs.paused && isMyTurn && !activePlayer?.isAI}
            />
          )}

          {!gs.running && !gs.message && grid.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center px-8 py-12">
              <div className="space-y-5">
                <div className="text-7xl">🔍</div>
                <div className="font-heading text-4xl tracking-widest text-[#BC13FE] uppercase text-glow-purple">Nomadic</div>
                <div className="font-heading text-3xl tracking-widest text-[#FFD700] uppercase text-glow-gold">Word Search</div>
                <div className="w-24 h-0.5 mx-auto" style={{ background: 'linear-gradient(90deg,transparent,#BC13FE,transparent)' }} />
                <div className="text-[7px] tracking-[0.25em] text-white/30 uppercase" style={PS2}>Configure & start on the left</div>
              </div>
            </div>
          )}
        </main>

        {/* ── Right: Word List + Log ────────────────────────────────────────── */}
        {grid.length > 0 && (
          <aside className="lg:w-64 shrink-0 space-y-3">
            <WordList words={words} players={players} />
          </aside>
        )}
      </div>
    </div>
  );
}

// ── Setup Panel ───────────────────────────────────────────────────────────────
function SetupPanel({ isSinglePlayer, cpuCharacter, onStart, seatNumber }) {
  const [mode, setMode] = useState(isSinglePlayer ? 'ai' : 'single');
  const [difficulty, setDifficulty] = useState('simpleton');
  const [category, setCategory] = useState('random');

  const modeOptions = isSinglePlayer
    ? [{ value: 'ai', label: 'Player vs AI' }]
    : [
        { value: 'single', label: 'Single Player' },
        { value: 'multi', label: 'Multiplayer' },
        { value: 'ai', label: 'Player vs AI' },
      ];

  const diffOptions = [
    { value: 'simpleton', label: 'Simpleton — 10 words' },
    { value: 'reader',    label: 'Reader — 15 words' },
    { value: 'scholar',   label: 'Scholar — 25 words' },
  ];

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
    <div className="p-4 rounded-xl space-y-4"
      style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(188,19,254,0.4)', boxShadow: '0 0 20px rgba(188,19,254,0.1)' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-5 rounded-full" style={{ background: '#BC13FE', boxShadow: '0 0 8px #BC13FE' }} />
        <h2 className="text-[9px] tracking-[0.2em] text-[#BC13FE] uppercase" style={PS2}>Game Setup</h2>
      </div>

      {cpuCharacter && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5">
          <img src={cpuCharacter.avatar} alt={cpuCharacter.name} className="w-8 h-8 rounded-lg object-cover border border-[#FF5F1F]/30" />
          <div>
            <div className="text-[6px] text-[#FF5F1F]/60 uppercase tracking-widest" style={PS2}>vs</div>
            <div className="font-heading text-sm text-white tracking-widest uppercase">{cpuCharacter.name}</div>
          </div>
        </div>
      )}

      {!isSinglePlayer && <Select label="Game Mode" value={mode} onChange={setMode} options={modeOptions} />}
      <Select label="Difficulty" value={difficulty} onChange={setDifficulty} options={diffOptions} />
      <Select label="Category" value={category} onChange={setCategory} options={catOptions} />

      <button
        onClick={() => onStart({ mode, difficulty, category })}
        className="w-full py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #BC13FE40, #BC13FE20)', border: '2px solid #BC13FE', color: '#BC13FE', boxShadow: '0 0 20px rgba(188,19,254,0.3)' }}>
        ▶ START GAME
      </button>
    </div>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────
function StatsPanel({ players, activeIdx, mins, secs, running, paused, words, mode, isMyTurn, isSinglePlayer, onReset, updateState, gs }) {
  const wordsFound = words.filter(w => w.found).length;
  const wordsLeft = words.length - wordsFound;

  return (
    <div className="space-y-3">
      {/* Status grid */}
      <div className="flex gap-2">
        {[
          { label: 'Time', value: running ? `${mins}:${secs}` : '--', color: '#FFD700' },
          { label: 'Words Left', value: words.length ? wordsLeft : '--', color: '#BC13FE' },
          { label: 'Status', value: paused ? 'PAUSED' : running ? 'LIVE' : 'OVER', color: running && !paused ? '#4ade80' : '#FF5F1F' },
        ].map(s => (
          <div key={s.label} className="flex-1 px-2 py-1.5 rounded-lg text-center"
            style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: `0 0 8px ${s.color}15` }}>
            <div className="text-[5px] tracking-widest text-white/30 uppercase mb-0.5" style={PS2}>{s.label}</div>
            <div className="font-heading text-base leading-none" style={{ color: s.color, textShadow: `0 0 8px ${s.color}80` }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Players */}
      <div className="p-4 rounded-xl space-y-2"
        style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(255,215,0,0.2)' }}>
        <h3 className="text-[8px] tracking-[0.2em] text-[#FFD700]/70 uppercase" style={PS2}>Players</h3>
        {players.length === 0 && <div className="text-[7px] text-white/20 uppercase" style={PS2}>No players yet</div>}
        {players.map((p, i) => (
          <div key={p.seatNumber} className="flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
            style={{
              borderColor: i === activeIdx && running ? p.color : 'rgba(255,255,255,0.1)',
              background: i === activeIdx && running ? `${p.color}15` : 'transparent',
              boxShadow: i === activeIdx && running ? `0 0 12px ${p.color}30` : 'none',
            }}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[8px] tracking-widest text-white uppercase" style={PS2}>
                {p.isAI ? `🤖 ${p.name}` : p.name}
              </span>
            </div>
            <div className="font-heading text-base" style={{ color: p.color }}>{p.score || 0}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      {running && (
        <div className="space-y-2">
          <button
            onClick={() => updateState({ paused: !paused })}
            className="w-full py-2 rounded-lg border font-heading text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{ borderColor: paused ? '#4ade80' : '#FF5F1F', color: paused ? '#4ade80' : '#FF5F1F', background: 'transparent' }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={onReset}
            className="w-full py-2 rounded-lg border font-heading text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{ borderColor: '#FFD700', color: '#FFD700', background: 'transparent' }}>
            ↺ Reset Board
          </button>
        </div>
      )}
    </div>
  );
}

// ── Word Grid ─────────────────────────────────────────────────────────────────
function WordGrid({ grid, words, players, previewCells, aiPreviewCells = [], aiPreviewColor = '#FF5F1F', playerCursors = {}, mySeatNumber, onCellDown, onCellMove, onCellUp, canInteract }) {
  const boardRef = useRef(null);

  // Build found map: cellId → color
  const foundMap = {};
  words.filter(w => w.found).forEach(w => {
    const player = players.find(p => p.seatNumber === w.foundBy);
    w.cells.forEach(id => { foundMap[id] = player?.color || '#555'; });
  });

  // Build other-players cursor map: cellId → { color, seatNumber }
  const otherCursorMap = {};
  Object.entries(playerCursors).forEach(([seat, cells]) => {
    if (seat === String(mySeatNumber) || !cells?.length) return;
    const player = players.find(p => String(p.seatNumber) === seat);
    const color = player?.color || '#22d3ee';
    cells.forEach(id => { otherCursorMap[id] = color; });
  });

  const getCellFromTouch = (touch) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    const y = el.dataset?.y, x = el.dataset?.x;
    if (y === undefined || x === undefined) return null;
    return { y: Number(y), x: Number(x) };
  };

  const cellSize = Math.min(34, Math.floor((Math.min(window.innerWidth - 48, 600)) / (grid.length || 1)));

  return (
    <div
      ref={boardRef}
      className="overflow-auto rounded-xl p-3 scanline-overlay relative"
      style={{
        background: 'linear-gradient(135deg, #07040d 0%, #0d0620 100%)',
        border: '2px solid rgba(188,19,254,0.5)',
        boxShadow: '0 0 30px rgba(188,19,254,0.2), inset 0 0 40px rgba(188,19,254,0.05)',
        touchAction: 'none',
        userSelect: 'none',
      }}
      onMouseLeave={() => { if (boardRef.current) onCellUp && null; }}
    >
      <div
        style={{ display: 'grid', gridTemplateColumns: `repeat(${grid.length}, ${cellSize}px)`, gap: 2 }}
        onMouseUp={e => {
          const el = e.target.closest('[data-y]');
          if (el) onCellUp(Number(el.dataset.y), Number(el.dataset.x));
        }}
        onTouchEnd={e => {
          e.preventDefault();
          const pt = getCellFromTouch(e.changedTouches[0]);
          if (pt) onCellUp(pt.y, pt.x);
        }}
      >
        {grid.map((row, y) =>
          row.map((ch, x) => {
            const id = `${y}-${x}`;
            const isFound = !!foundMap[id];
            const isPreview = previewCells.includes(id);
            const isAIPreview = aiPreviewCells.includes(id);
            const otherColor = otherCursorMap[id];
            const isOtherCursor = !!otherColor;
            // Priority: my preview > other cursor > AI preview > found > default
            const activeColor = isPreview ? '#FFD700' : isOtherCursor ? otherColor : isAIPreview ? aiPreviewColor : null;
            return (
              <div
                key={id}
                data-y={y}
                data-x={x}
                style={{
                  width: cellSize,
                  height: cellSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  fontSize: Math.max(9, cellSize * 0.48),
                  fontWeight: 700,
                  fontFamily: "'Press Start 2P', monospace",
                  cursor: canInteract ? 'pointer' : 'default',
                  background: isFound
                    ? `${foundMap[id]}25`
                    : activeColor
                    ? `${activeColor}25`
                    : 'rgba(188,19,254,0.06)',
                  color: isFound
                    ? foundMap[id]
                    : activeColor
                    ? activeColor
                    : 'rgba(255,255,255,0.75)',
                  border: isFound
                    ? `1px solid ${foundMap[id]}80`
                    : activeColor
                    ? `2px solid ${activeColor}`
                    : '1px solid rgba(188,19,254,0.2)',
                  boxShadow: isFound
                    ? `0 0 8px ${foundMap[id]}60, inset 0 0 6px ${foundMap[id]}20`
                    : activeColor
                    ? `0 0 12px ${activeColor}80`
                    : 'none',
                  transition: 'background 0.08s, color 0.08s, box-shadow 0.08s',
                  textShadow: isFound
                    ? `0 0 8px ${foundMap[id]}`
                    : activeColor
                    ? `0 0 8px ${activeColor}`
                    : 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onMouseDown={() => onCellDown(y, x)}
                onMouseEnter={() => onCellMove(y, x)}
                onTouchStart={e => { e.preventDefault(); onCellDown(y, x); }}
                onTouchMove={e => {
                  e.preventDefault();
                  const pt = getCellFromTouch(e.touches[0]);
                  if (pt) onCellMove(pt.y, pt.x);
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

// ── Word List ─────────────────────────────────────────────────────────────────
function WordList({ words, players }) {
  const found = words.filter(w => w.found);
  const unfound = words.filter(w => !w.found);

  return (
    <div className="p-4 rounded-xl space-y-3"
      style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(188,19,254,0.3)', boxShadow: '0 0 20px rgba(188,19,254,0.1)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-[8px] tracking-[0.2em] text-[#BC13FE] uppercase" style={PS2}>Words</h3>
        <span className="text-[7px] tracking-widest" style={{ ...PS2, color: '#FFD700' }}>{found.length}<span className="text-white/30">/{words.length}</span></span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: words.length ? `${(found.length / words.length) * 100}%` : '0%', background: 'linear-gradient(90deg,#BC13FE,#FFD700)' }} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {words.map(w => {
          const finder = players.find(p => p.seatNumber === w.foundBy);
          return (
            <div
              key={w.word}
              className="px-2 py-1.5 rounded text-center transition-all"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 6,
                letterSpacing: '0.05em',
                background: w.found ? `${finder?.color || '#BC13FE'}18` : 'rgba(255,255,255,0.03)',
                border: w.found ? `1px solid ${finder?.color || '#BC13FE'}60` : '1px solid rgba(255,255,255,0.08)',
                color: w.found ? (finder?.color || '#BC13FE') : 'rgba(255,255,255,0.35)',
                textDecoration: w.found ? 'line-through' : 'none',
                textShadow: w.found ? `0 0 8px ${finder?.color || '#BC13FE'}` : 'none',
              }}>
              {w.word}
            </div>
          );
        })}
      </div>
    </div>
  );
}