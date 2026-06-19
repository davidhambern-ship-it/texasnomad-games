import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameInstructions from '@/components/game/GameInstructions.jsx';
import { Link } from 'react-router-dom';
import useGameStats from '@/hooks/useGameStats';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import { generatePuzzle, isPuzzleComplete, hasConflict } from '@/lib/sudokuEngine';
import SudokuBoard from '@/components/sudoku/SudokuBoard';
import SudokuNumpad from '@/components/sudoku/SudokuNumpad';
import SudokuTimer from '@/components/sudoku/SudokuTimer';
import SudokuLeaderboard from '@/components/sudoku/SudokuLeaderboard';
import SeatBadge from '@/components/game/SeatBadge';
import { Trophy, Zap, AlertTriangle, Users, Play, X, Pencil, Eraser } from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

const DIFFICULTIES = [
  { key: 'easy',   label: 'Easy',   color: '#4ade80', desc: '~36 clues' },
  { key: 'medium', label: 'Medium', color: '#FFD700', desc: '~30 clues' },
  { key: 'hard',   label: 'Hard',   color: '#FF5F1F', desc: '~25 clues' },
  { key: 'expert', label: 'Expert', color: '#BC13FE', desc: '~22 clues' },
];

export default function SudokuGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <SudokuViewer roomCode={roomCode} />;
}

// ── Mobile Cell Numpad Popup ─────────────────────────────────────────────────
function CellNumpadPopup({ onNumber, onErase, onToggleNotes, notesMode, onClose, puzzle, userGrid }) {
  const counts = Array(10).fill(0);
  if (puzzle && userGrid) {
    for (let i = 0; i < 81; i++) {
      const v = puzzle[i] || userGrid[i];
      if (v > 0) counts[v]++;
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />
      {/* Popup */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-4 pb-6"
        style={{ background: '#0d0a20', border: '2px solid rgba(188,19,254,0.5)', boxShadow: '0 -10px 40px rgba(188,19,254,0.2)' }}
      >
        {/* Notes + Erase row */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={onToggleNotes}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-all"
            style={{
              borderColor: notesMode ? '#BC13FE' : 'rgba(188,19,254,0.3)',
              background: notesMode ? 'rgba(188,19,254,0.2)' : 'transparent',
              color: notesMode ? '#BC13FE' : 'rgba(255,255,255,0.5)',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
            }}
          >
            <Pencil className="w-3 h-3" />
            NOTES {notesMode ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => { onErase(); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-all"
            style={{
              borderColor: 'rgba(255,95,31,0.4)',
              background: 'rgba(255,95,31,0.08)',
              color: 'rgba(255,95,31,0.8)',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
            }}
          >
            <Eraser className="w-3 h-3" />
            ERASE
          </button>
        </div>

        {/* Number grid 3x3 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => {
            const complete = counts[n] >= 9;
            return (
              <button
                key={n}
                onClick={() => { if (!complete) { onNumber(n); if (!notesMode) onClose(); } }}
                disabled={complete}
                className="flex flex-col items-center justify-center rounded-xl border-2 transition-all active:scale-95"
                style={{
                  height: 64,
                  background: complete ? 'rgba(255,255,255,0.03)' : 'rgba(188,19,254,0.1)',
                  borderColor: complete ? 'rgba(255,255,255,0.1)' : 'rgba(188,19,254,0.5)',
                  color: complete ? 'rgba(255,255,255,0.2)' : 'white',
                  cursor: complete ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 32, lineHeight: 1 }}>{n}</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: complete ? 'rgba(255,255,255,0.15)' : 'rgba(188,19,254,0.7)' }}>
                  {9 - counts[n]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SudokuViewer({ roomCode }) {
  const [showInstructions, setShowInstructions] = useState(() => !sessionStorage.getItem(`tn_instructions_sudoku_${roomCode}`));
  const dismissInstructions = () => { sessionStorage.setItem(`tn_instructions_sudoku_${roomCode}`, '1'); setShowInstructions(false); };
  const { recordStat } = useGameStats('sudoku');
  const statRecordedRef = useRef(false);
  // If opened inside the Host Panel iframe, skip player seat registration
  const isHostView = window.self !== window.top;
  const { room, loading, updateState, registerUser } = useGameRoom(roomCode, 'sudoku', 'viewer');
  const gs = room?.game_state || {};

  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'sudoku', updateState, isHostView, null, isHostView ? null : registerUser);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  const [selectedCell, setSelectedCell] = useState(null);
  const [notesMode, setNotesMode] = useState(false);
  const [userGrid, setUserGrid] = useState(null);
  const [notes, setNotes] = useState({});
  const [mistakes, setMistakes] = useState(0);
  const [localComplete, setLocalComplete] = useState(false);
  const [localEliminated, setLocalEliminated] = useState(false);
  const [shakeCell, setShakeCell] = useState(null);
  const [winEffect, setWinEffect] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState([]);
  const [showMobileNumpad, setShowMobileNumpad] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const syncThrottleRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const myPlayer = (gs.players || []).find(p => p.playerId === playerId);

  useEffect(() => {
    if (!myPlayer) return;
    if (userGrid === null && myPlayer.userGrid) {
      setUserGrid([...myPlayer.userGrid]);
      setNotes(myPlayer.notes || {});
      setMistakes(myPlayer.mistakes || 0);
      setLocalComplete(myPlayer.completed || false);
      setLocalEliminated(myPlayer.eliminated || false);
    } else if (userGrid === null && myPlayer.puzzle) {
      setUserGrid(Array(81).fill(0));
    }
  }, [myPlayer]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (selectedCell === null || localComplete || localEliminated) return;
      if (e.key >= '1' && e.key <= '9') handleNumber(parseInt(e.key));
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') handleErase();
      if (e.key === 'n' || e.key === 'N') setNotesMode(m => !m);
      const arrows = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
      if (arrows[e.key] !== undefined) {
        e.preventDefault();
        setSelectedCell(c => {
          if (c === null) return 0;
          const next = c + arrows[e.key];
          return next >= 0 && next < 81 ? next : c;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCell, localComplete, localEliminated, notesMode, userGrid, notes]);

  const syncProgress = useCallback((grid, currentNotes, currentMistakes, completed, eliminated, completedAt) => {
    clearTimeout(syncThrottleRef.current);
    syncThrottleRef.current = setTimeout(async () => {
      const currentPlayers = gs.players || [];
      const updated = currentPlayers.map(p =>
        p.playerId === playerId
          ? { ...p, userGrid: grid, notes: currentNotes, mistakes: currentMistakes, completed, eliminated, status: completed ? 'completed' : eliminated ? 'eliminated' : 'active', completedAt: completedAt || p.completedAt }
          : p
      );
      const updates = { players: updated };
      if (completed) {
        const alreadyWon = currentPlayers.some(p => p.completed && p.playerId !== playerId);
        if (!alreadyWon) {
          const me = currentPlayers.find(p => p.playerId === playerId);
          updates.winner = { playerId, playerName: me?.playerName || `Seat ${seatNumber}`, seatNumber, completedAt };
          updates.phase = 'finished';
        }
      }
      await updateState(updates);
    }, 800);
  }, [gs.players, playerId, seatNumber, updateState]);

  const handleNumber = useCallback((num) => {
    if (selectedCell === null || !myPlayer?.puzzle || !myPlayer?.solution) return;
    if (localComplete || localEliminated) return;
    const puzzle = myPlayer.puzzle;
    const solution = myPlayer.solution;
    if (puzzle[selectedCell] !== 0) return;

    if (notesMode) {
      const newNotes = { ...notes };
      const cellNotes = newNotes[selectedCell] ? [...newNotes[selectedCell]] : [];
      const idx = cellNotes.indexOf(num);
      if (idx === -1) cellNotes.push(num);
      else cellNotes.splice(idx, 1);
      newNotes[selectedCell] = cellNotes;
      setNotes(newNotes);
      syncProgress(userGrid, newNotes, mistakes, localComplete, localEliminated, null);
      return;
    }

    const newGrid = [...userGrid];
    newGrid[selectedCell] = num;
    const newNotes = { ...notes };
    delete newNotes[selectedCell];

    if (num !== solution[selectedCell]) {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setShakeCell(selectedCell);
      setTimeout(() => setShakeCell(null), 500);
      if (newMistakes >= 3) {
        setLocalEliminated(true);
        setUserGrid(newGrid);
        syncProgress(newGrid, newNotes, newMistakes, false, true, null);
        return;
      }
      setUserGrid(newGrid);
      setNotes(newNotes);
      syncProgress(newGrid, newNotes, newMistakes, false, false, null);
      return;
    }

    setUserGrid(newGrid);
    setNotes(newNotes);
    const done = isPuzzleComplete(newGrid, solution, puzzle);
    if (done) {
      const now = Date.now();
      setLocalComplete(true);
      setWinEffect(true);
      if (!statRecordedRef.current) { statRecordedRef.current = true; recordStat({ score: Math.max(0, 300 - mistakes * 50), won: true }); }
      setConfettiPieces(Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: ['#BC13FE', '#FFD700', '#FF5F1F', '#4ade80', '#22d3ee'][Math.floor(Math.random() * 5)],
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random(),
      })));
      setTimeout(() => setWinEffect(false), 3000);
      syncProgress(newGrid, newNotes, mistakes, true, false, now);
    } else {
      syncProgress(newGrid, newNotes, mistakes, false, false, null);
    }
  }, [selectedCell, myPlayer, notesMode, notes, userGrid, mistakes, localComplete, localEliminated]);

  const handleErase = useCallback(() => {
    if (selectedCell === null || !myPlayer?.puzzle) return;
    if (myPlayer.puzzle[selectedCell] !== 0) return;
    const newGrid = [...userGrid];
    newGrid[selectedCell] = 0;
    const newNotes = { ...notes, [selectedCell]: [] };
    setUserGrid(newGrid);
    setNotes(newNotes);
    syncProgress(newGrid, newNotes, mistakes, false, false, null);
  }, [selectedCell, myPlayer, userGrid, notes, mistakes]);

  // When a cell is selected on mobile, show the popup numpad
  const handleCellSelect = useCallback((idx) => {
    setSelectedCell(idx);
    if (isMobile && !localComplete && !localEliminated) {
      setShowMobileNumpad(true);
    }
  }, [isMobile, localComplete, localEliminated]);

  const handleJoinAndStart = async (difficulty) => {
    if (!playerId) return;
    const currentPlayers = gs.players || [];
    const { puzzle, solution } = generatePuzzle(difficulty);
    const myEffectiveSeat = seatNumber || (currentPlayers.length + 2);
    const meExists = currentPlayers.some(p => p.playerId === playerId);
    const updatedPlayers = meExists
      ? currentPlayers.map(p => p.playerId === playerId ? {
          ...p, puzzle, solution, userGrid: Array(81).fill(0), notes: {}, mistakes: 0,
          completed: false, eliminated: false, completedAt: null, status: 'active',
        } : p)
      : [...currentPlayers, {
          playerId, seatNumber: myEffectiveSeat, playerName: `Seat ${myEffectiveSeat}`,
          puzzle, solution, userGrid: Array(81).fill(0), notes: {},
          mistakes: 0, completed: false, eliminated: false, completedAt: null, status: 'active',
        }];

    setUserGrid(Array(81).fill(0));
    setNotes({});
    setMistakes(0);
    setLocalComplete(false);
    setLocalEliminated(false);
    setSelectedCell(null);

    await updateState({
      phase: 'countdown', difficulty,
      players: updatedPlayers,
      winner: null, time_start: null, time_limit: 180,
    });

    setTimeout(async () => {
      await updateState({ phase: 'playing', time_start: Date.now() });
    }, 3000);
  };

  const handleTimeExpire = useCallback(async () => {
    if (localComplete || localEliminated) return;
    setLocalEliminated(true);
    const currentPlayers = gs.players || [];
    const updated = currentPlayers.map(p =>
      p.playerId === playerId ? { ...p, eliminated: true, status: 'eliminated' } : p
    );
    const allDone = updated.every(p => p.completed || p.eliminated);
    const firstCompleted = updated.find(p => p.completed);
    await updateState({
      players: updated,
      ...(allDone && !gs.winner ? { phase: 'finished', winner: firstCompleted ? { playerId: firstCompleted.playerId, playerName: firstCompleted.playerName, seatNumber: firstCompleted.seatNumber } : null } : {}),
    });
  }, [localComplete, localEliminated, gs.players, gs.winner, playerId, updateState]);

  const puzzle = myPlayer?.puzzle || null;
  const solution = myPlayer?.solution || null;
  const phase = gs.phase || 'waiting';
  const difficulty = gs.difficulty || 'medium';
  const diffConfig = DIFFICULTIES.find(d => d.key === difficulty) || DIFFICULTIES[1];
  const players = gs.players || [];
  const winner = gs.winner;
  const mistakesLeft = 3 - mistakes;

  if (showInstructions) return <GameInstructions gameId="sudoku" onDismiss={dismissInstructions} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05030b] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#05030b] text-white flex flex-col relative overflow-hidden">
      {/* Confetti */}
      {winEffect && confettiPieces.map(p => (
        <div key={p.id} style={{
          position: 'fixed', left: `${p.x}%`, top: '-20px',
          width: 10, height: 10, background: p.color,
          borderRadius: Math.random() > 0.5 ? '50%' : 2,
          zIndex: 1000, animation: `fall ${p.duration}s ${p.delay}s ease-in forwards`,
          boxShadow: `0 0 6px ${p.color}`,
        }} />
      ))}

      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes countdownPop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto px-3 h-12 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span style={{ ...PS2, fontSize: 9, color: '#BC13FE' }} className="hidden sm:inline">SUDOKU TN</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span style={{ ...PS2, fontSize: 8, color: '#BC13FE' }}>{roomCode}</span>
            </div>
            {phase === 'playing' && (
              <span className="px-2 py-0.5 rounded border text-[7px] tracking-widest uppercase hidden sm:inline"
                style={{ ...PS2, borderColor: diffConfig.color, color: diffConfig.color, background: `${diffConfig.color}15` }}>
                {diffConfig.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
            <Link to="/games" style={{ ...PS2, fontSize: 8 }} className="px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all tracking-widest uppercase">
              ← LOBBY
            </Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              style={{ ...PS2, fontSize: 8 }}
              className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all tracking-widest uppercase hidden sm:block"
            >
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div style={{ ...PS2, fontSize: 14, color: '#FFD700', textShadow: '0 0 30px #FFD700' }}>GET READY!</div>
            <CountdownDisplay />
            <div style={{ ...PS2, fontSize: 10, color: '#BC13FE' }}>Each player gets a unique puzzle</div>
          </div>
        </div>
      )}

      {/* Finished overlay */}
      {phase === 'finished' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl p-8 text-center space-y-6"
            style={{ border: '2px solid #FFD700', background: 'rgba(5,3,11,0.95)', boxShadow: '0 0 60px rgba(255,215,0,0.3)' }}>
            <div className="text-5xl">🏆</div>
            <div style={{ ...PS2, fontSize: 16, color: '#FFD700', textShadow: '0 0 30px #FFD700' }}>GAME OVER!</div>
            {winner ? (
              <div>
                <div style={{ ...PS2, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>WINNER</div>
                <div style={{ ...HEADING, fontSize: 36, color: '#FFD700' }}>
                  {winner.playerId === playerId ? '🎉 YOU WIN!' : winner.playerName || `Seat ${winner.seatNumber}`}
                </div>
              </div>
            ) : (
              <div style={{ ...PS2, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>TIME'S UP — NO WINNER</div>
            )}
            <SudokuLeaderboard players={players} timeStart={gs.time_start} phase={phase} />
            <button
              onClick={() => updateState({ phase: 'waiting', players: [], winner: null, time_start: null })}
              className="px-8 py-3 rounded-xl font-heading text-lg tracking-widest uppercase hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg,#BC13FE,#9333ea)', color: 'white', boxShadow: '0 0 20px rgba(188,19,254,0.4)' }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-screen-xl mx-auto w-full p-3 gap-3">

        {/* Waiting / lobby */}
        {(phase === 'waiting' || !phase) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="text-center">
              <div style={{ ...PS2, fontSize: 20, color: '#BC13FE', textShadow: '0 0 30px #BC13FE', lineHeight: 1.4 }}>SUDOKU TN</div>
              <div style={{ ...PS2, fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>COMPETITIVE MULTIPLAYER</div>
            </div>
            {players.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5">
                <Users className="w-4 h-4 text-[#BC13FE]" />
                <span style={{ ...PS2, fontSize: 9, color: '#BC13FE' }}>{players.length} PLAYER{players.length !== 1 ? 'S' : ''} READY</span>
              </div>
            )}
            <div className="space-y-3 w-full max-w-xs">
              <div style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>SELECT DIFFICULTY</div>
              {DIFFICULTIES.map(d => (
                <button key={d.key} onClick={() => handleJoinAndStart(d.key)} disabled={!playerId}
                  className="w-full py-4 rounded-xl border-2 font-heading text-xl tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                  style={{ borderColor: d.color, background: `${d.color}10`, color: d.color, boxShadow: `0 0 15px ${d.color}20`, fontFamily: "'Teko', sans-serif" }}>
                  {d.label}
                  <span style={{ ...PS2, fontSize: 7, color: `${d.color}80`, display: 'block', marginTop: 2 }}>{d.desc}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center max-w-sm">
              {[
                { icon: '⏱', label: '3 Min Timer', sub: 'Race the clock' },
                { icon: '🎯', label: 'Unique Puzzles', sub: 'Each player differs' },
                { icon: '❌', label: '3 Mistakes', sub: 'Then you\'re out' },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl border border-white/10 bg-white/5">
                  <div style={{ fontSize: 24 }}>{f.icon}</div>
                  <div style={{ ...PS2, fontSize: 7, color: '#FFD700', marginTop: 4 }}>{f.label}</div>
                  <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{f.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playing state */}
        {(phase === 'playing' || phase === 'countdown') && puzzle && userGrid && (
          <>
            {/* ── Desktop layout: board LEFT, controls RIGHT ── */}
            <div className="hidden md:flex flex-1 gap-4 min-h-0">

              {/* Board — takes up most space */}
              <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
                {localComplete && (
                  <div className="w-full py-3 rounded-xl text-center"
                    style={{ background: 'rgba(74,222,128,0.1)', border: '2px solid #4ade80', boxShadow: '0 0 20px rgba(74,222,128,0.3)' }}>
                    <span style={{ ...PS2, fontSize: 12, color: '#4ade80', textShadow: '0 0 15px #4ade80' }}>🎉 PUZZLE COMPLETE!</span>
                  </div>
                )}
                {localEliminated && !localComplete && (
                  <div className="w-full py-3 rounded-xl text-center"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444' }}>
                    <span style={{ ...PS2, fontSize: 10, color: '#ef4444' }}>❌ ELIMINATED — WATCHING</span>
                  </div>
                )}
                <div className="w-full max-w-[520px]">
                  <SudokuBoard
                    puzzle={puzzle} solution={solution} userGrid={userGrid} notes={notes}
                    selectedCell={selectedCell} onSelectCell={setSelectedCell}
                    notesMode={notesMode} eliminated={localEliminated} completed={localComplete}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ ...PS2, fontSize: 8, color: diffConfig.color }}>{diffConfig.label.toUpperCase()} MODE</span>
                  <span style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>• 1-9, DEL, N=NOTES, ARROWS</span>
                </div>
              </div>

              {/* Right sidebar: all controls */}
              <div className="w-52 shrink-0 flex flex-col gap-3 overflow-y-auto">
                {/* Timer */}
                <div className="p-3 rounded-xl" style={{ border: '1px solid rgba(188,19,254,0.3)', background: 'rgba(5,3,11,0.6)' }}>
                  <div style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textAlign: 'center' }}>TIME</div>
                  <SudokuTimer timeStart={gs.time_start} timeLimit={gs.time_limit || 180} phase={phase} onExpire={handleTimeExpire} />
                </div>
                {/* Mistakes */}
                <div className="p-3 rounded-xl" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
                  <div style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textAlign: 'center' }}>MISTAKES</div>
                  <div className="flex justify-center gap-2">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center border-2"
                        style={{ borderColor: i < mistakes ? '#ef4444' : 'rgba(255,255,255,0.2)', background: i < mistakes ? 'rgba(239,68,68,0.2)' : 'transparent' }}>
                        {i < mistakes && <X className="w-3 h-3 text-red-400" />}
                      </div>
                    ))}
                  </div>
                  {localEliminated && <div style={{ ...PS2, fontSize: 8, color: '#ef4444', textAlign: 'center', marginTop: 6 }}>ELIMINATED!</div>}
                </div>
                {/* Numpad */}
                <SudokuNumpad onNumber={handleNumber} onErase={handleErase} notesMode={notesMode} onToggleNotes={() => setNotesMode(m => !m)} puzzle={puzzle} userGrid={userGrid} />
                {/* Leaderboard */}
                <SudokuLeaderboard players={players} timeStart={gs.time_start} phase={phase} />
              </div>
            </div>

            {/* ── Mobile layout: board top, compact HUD, tap-to-open numpad ── */}
            <div className="flex md:hidden flex-col gap-3">
              {/* Compact HUD row */}
              <div className="flex gap-2 items-stretch">
                {/* Timer */}
                <div className="flex-1 p-2 rounded-xl flex flex-col items-center justify-center"
                  style={{ border: '1px solid rgba(188,19,254,0.3)', background: 'rgba(5,3,11,0.6)' }}>
                  <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>TIME</div>
                  <SudokuTimer timeStart={gs.time_start} timeLimit={gs.time_limit || 180} phase={phase} onExpire={handleTimeExpire} compact />
                </div>
                {/* Mistakes */}
                <div className="flex-1 p-2 rounded-xl flex flex-col items-center justify-center gap-1"
                  style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
                  <div style={{ ...PS2, fontSize: 6, color: 'rgba(255,255,255,0.4)' }}>MISTAKES</div>
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center border"
                        style={{ borderColor: i < mistakes ? '#ef4444' : 'rgba(255,255,255,0.2)', background: i < mistakes ? 'rgba(239,68,68,0.2)' : 'transparent' }}>
                        {i < mistakes && <X className="w-2.5 h-2.5 text-red-400" />}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Notes toggle */}
                <button onClick={() => setNotesMode(m => !m)}
                  className="flex-1 p-2 rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-all"
                  style={{ borderColor: notesMode ? '#BC13FE' : 'rgba(188,19,254,0.3)', background: notesMode ? 'rgba(188,19,254,0.2)' : 'transparent', color: notesMode ? '#BC13FE' : 'rgba(255,255,255,0.4)' }}>
                  <Pencil className="w-4 h-4" />
                  <span style={{ ...PS2, fontSize: 6 }}>NOTES</span>
                </button>
                {/* Erase */}
                <button onClick={handleErase}
                  className="flex-1 p-2 rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-all"
                  style={{ borderColor: 'rgba(255,95,31,0.4)', background: 'rgba(255,95,31,0.08)', color: 'rgba(255,95,31,0.8)' }}>
                  <Eraser className="w-4 h-4" />
                  <span style={{ ...PS2, fontSize: 6 }}>ERASE</span>
                </button>
              </div>

              {/* Status banners */}
              {localComplete && (
                <div className="py-2 rounded-xl text-center"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '2px solid #4ade80' }}>
                  <span style={{ ...PS2, fontSize: 10, color: '#4ade80' }}>🎉 COMPLETE!</span>
                </div>
              )}
              {localEliminated && !localComplete && (
                <div className="py-2 rounded-xl text-center"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444' }}>
                  <span style={{ ...PS2, fontSize: 9, color: '#ef4444' }}>❌ ELIMINATED</span>
                </div>
              )}

              {/* Board — full width, tap a cell to open numpad */}
              <div className="w-full">
                <SudokuBoard
                  puzzle={puzzle} solution={solution} userGrid={userGrid} notes={notes}
                  selectedCell={selectedCell} onSelectCell={handleCellSelect}
                  notesMode={notesMode} eliminated={localEliminated} completed={localComplete}
                />
              </div>

              {/* Tap hint */}
              {!localComplete && !localEliminated && (
                <p style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                  TAP A CELL TO ENTER A NUMBER
                </p>
              )}

              {/* Leaderboard (collapsed on mobile) */}
              {players.length > 1 && (
                <div className="mt-1">
                  <SudokuLeaderboard players={players} timeStart={gs.time_start} phase={phase} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile numpad popup */}
      {showMobileNumpad && selectedCell !== null && puzzle && userGrid && (
        <CellNumpadPopup
          onNumber={handleNumber}
          onErase={handleErase}
          onToggleNotes={() => setNotesMode(m => !m)}
          notesMode={notesMode}
          onClose={() => setShowMobileNumpad(false)}
          puzzle={puzzle}
          userGrid={userGrid}
        />
      )}
    </div>
  );
}

function CountdownDisplay() {
  const [count, setCount] = useState(3);
  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);
  return (
    <div key={count} style={{
      fontFamily: "'Press Start 2P', monospace", fontSize: 80,
      color: count === 1 ? '#4ade80' : count === 2 ? '#FFD700' : '#BC13FE',
      textShadow: `0 0 40px ${count === 1 ? '#4ade80' : count === 2 ? '#FFD700' : '#BC13FE'}`,
      animation: 'countdownPop 0.5s ease-out forwards',
    }}>
      {count > 0 ? count : 'GO!'}
    </div>
  );
}