import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const Btn = ({ children, onClick, color = '#FF5F1F', size = 'md', className = '', disabled = false }) => {
  const pad = size === 'lg' ? 'px-6 py-4 text-xl' : size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`font-heading tracking-widest uppercase rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 ${pad} ${className}`}
      style={{ borderColor: color, color, background: 'transparent' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
};

function decodeHTML(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function checkWinner(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,c,d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

export default function SquareBizHostPanel({ gs, updateState, sendCommand, room }) {
  const roomPlayers = room?.game_state?.players || [];
  const sbPlayers = gs.sb_players || [];
  const activePlayers = sbPlayers.filter(p => p.role === 'X' || p.role === 'O').length;
  const queuedPlayers = (gs.sb_queue || []).length;
  const viewerPlayers = sbPlayers.filter(p => p.role === 'viewer').length;
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [loadingTrivia, setLoadingTrivia] = useState(false);

  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const boardLocked = gs.board_locked !== false;
  const displayMode = gs.display_mode || null;
  const xPlayer = sbPlayers.find(p => p.role === 'X');
  const oPlayer = sbPlayers.find(p => p.role === 'O');

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F' };
    return { char: '·', color: '#ffffff20' };
  };

  const forceCell = (idx, mark) => {
    const next = [...board];
    next[idx] = next[idx] === mark ? '' : mark;
    const winner = checkWinner(next);
    updateState({ board: next, winner: winner || null });
  };

  const resetBoard = () => {
    updateState({ board: Array(9).fill(''), current_turn: 'X', winner: null, board_locked: true, show_question: false, show_choices: false, popup: null, answer_result: null });
  };

  const selectMode = (mode) => {
    updateState({ display_mode: mode, board: Array(9).fill(''), current_turn: 'X', winner: null, board_locked: true, show_question: false, show_choices: false, popup: null, answer_result: null });
  };

  const fetchOTDBQuestion = async (autoShow = false) => {
    setLoadingTrivia(true);
    try {
      const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
      const data = await res.json();
      const q = data.results[0];
      const correct = decodeHTML(q.correct_answer);
      const allAnswers = shuffleArray([correct, ...q.incorrect_answers.map(decodeHTML)]);
      const letters = ['A','B','C','D'];
      const choices = {};
      allAnswers.forEach((ans, i) => { choices[letters[i]] = ans; });
      const correctLetter = letters[allAnswers.indexOf(correct)];
      const trivia = { question: decodeHTML(q.question), choices, correctLetter, category: decodeHTML(q.category) };
      setCurrentTrivia(trivia);
      updateState({
        show_question: autoShow,
        show_choices: false,
        current_question: trivia.question,
        current_choices: trivia.choices,
        correct_answer: trivia.correctLetter,
        current_category: trivia.category,
        answer_result: null,
        selected_answer: null,
        popup: null,
      });
    } catch {
      // silently fail
    } finally {
      setLoadingTrivia(false);
    }
  };

  // Watch for auto_next_question signal from the board (player placed marker or wrong answer)
  useEffect(() => {
    if (gs.auto_next_question) {
      updateState({ auto_next_question: null });
      fetchOTDBQuestion(true); // fetch and auto-show question
    }
  }, [gs.auto_next_question]);

  const handleAnswerSelect = async (letter) => {
    const isCorrect = letter === gs.correct_answer;
    if (isCorrect) {
      // Correct: show popup, then unlock board for marker placement
      await updateState({ popup: 'correct', show_question: false, show_choices: false, answer_result: true, selected_answer: letter });
      setTimeout(() => updateState({ popup: null, board_locked: false }), 2000);
    } else {
      // Wrong: show popup, switch turn, stay locked, auto-fetch next question
      const nextTurn = currentTurn === 'X' ? 'O' : 'X';
      await updateState({ popup: 'wrong', show_question: false, show_choices: false, answer_result: false, current_turn: nextTurn, board_locked: true, selected_answer: letter });
      setTimeout(() => updateState({ popup: null }), 2000);
      setTimeout(() => fetchOTDBQuestion(true), 2200);
    }
  };

  {/* ── MODE SELECT ── */}
  if (!displayMode) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-4">
        <div className="p-6 border border-[#FF5F1F]/30 rounded-xl bg-black/60 text-center"
          style={{ boxShadow: '0 0 20px rgba(255,95,31,0.1)' }}>
          <h2 className="font-heading text-2xl tracking-[0.15em] text-[#ff8a00] uppercase mb-2">Square Biz!</h2>
          <p className="font-body text-white/50 text-sm mb-8">Select how you want to play</p>
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-black/40 border border-white/10 mb-8">
            <span className="font-heading text-sm tracking-widest text-white/60 uppercase">Music</span>
            <button onClick={() => updateState({ music_on: !(gs.music_on !== false) })}
              className={`px-4 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all ${gs.music_on !== false ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-white/20 text-white/30'}`}>
              {gs.music_on !== false ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => selectMode('panel')}
              className="p-6 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/5 hover:bg-[#BC13FE]/15 transition-all text-left">
              <div className="font-heading text-xl tracking-widest text-[#BC13FE] uppercase mb-1">Panel Mode</div>
              <div className="font-body text-white/50 text-sm">Host controls everything. Question & answers shown on screen.</div>
            </button>
            <button onClick={() => selectMode('board')}
              className="p-6 rounded-xl border-2 border-[#FF5F1F]/50 bg-[#FF5F1F]/5 hover:bg-[#FF5F1F]/15 transition-all text-left">
              <div className="font-heading text-xl tracking-widest text-[#FF5F1F] uppercase mb-1">Board Mode</div>
              <div className="font-body text-white/50 text-sm">Players interact directly. Questions auto-reveal on screen.</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE GAME ──
  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Mode + Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg border border-white/10 bg-black/40">
        <span className="font-heading text-sm tracking-widest uppercase"
          style={{ color: displayMode === 'panel' ? '#BC13FE' : '#FF5F1F' }}>
          {displayMode === 'panel' ? '📺 Panel Mode' : '🎮 Board Mode'}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-heading text-xs tracking-widest uppercase"
            style={{ color: boardLocked ? '#ef4444' : '#4ade80', fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>
            {boardLocked ? '🔒 LOCKED' : '🟢 OPEN'}
          </span>
          <button onClick={() => updateState({ display_mode: null })}
            className="font-heading text-xs tracking-widest text-white/30 uppercase border border-white/10 px-3 py-1 rounded hover:text-white/60 hover:border-white/30 transition-all">
            Change Mode
          </button>
        </div>
      </div>

      {/* Live Player Status — Board Mode only */}
      {displayMode === 'board' && (
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg tracking-[0.15em] text-[#BC13FE] uppercase">Live Players</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
              <span className="font-heading text-[9px] tracking-widest text-[#4ade80]/70 uppercase">Live</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
              <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Total</div>
              <div className="font-heading text-2xl text-white">{roomPlayers.length}</div>
            </div>
            <div className="p-3 rounded-lg border border-[#4ade80]/30 bg-[#4ade80]/5 text-center">
              <div className="font-heading text-[8px] tracking-widest text-[#4ade80]/60 uppercase mb-1">Active</div>
              <div className="font-heading text-2xl text-[#4ade80]">{activePlayers}</div>
            </div>
            <div className="p-3 rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
              <div className="font-heading text-[8px] tracking-widest text-[#FFD700]/60 uppercase mb-1">Queue</div>
              <div className="font-heading text-2xl text-[#FFD700]">{queuedPlayers}</div>
            </div>
            <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
              <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Viewers</div>
              <div className="font-heading text-2xl text-white/50">{viewerPlayers}</div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Room Status */}
      <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg tracking-[0.15em] text-[#BC13FE] uppercase">Room Status</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
            <span className="font-heading text-[9px] tracking-widest text-[#4ade80]/70 uppercase">LIVE</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
            <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Room Code</div>
            <div className="font-heading text-xl text-[#FFD700]" style={{ fontFamily: "'Press Start 2P', monospace" }}>{room?.room_code}</div>
          </div>
          <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
            <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Status</div>
            <div className="font-heading text-sm tracking-widest text-[#4ade80]">{room?.status || 'active'}</div>
          </div>
          <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
            <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Mode</div>
            <div className="font-heading text-sm tracking-widest" style={{ color: displayMode === 'panel' ? '#BC13FE' : '#FF5F1F' }}>{displayMode === 'panel' ? 'PANEL' : 'BOARD'}</div>
          </div>
          <div className="p-3 rounded-lg border border-[#4ade80]/30 bg-[#4ade80]/5 text-center">
            <div className="font-heading text-[8px] tracking-widest text-[#4ade80]/60 uppercase mb-1">Host</div>
            <div className="font-heading text-sm tracking-widest text-[#4ade80]">CONNECTED</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-3">
          <div className="p-3 rounded-lg border border-[#BC13FE]/30 bg-[#BC13FE]/5 text-center">
            <div className="font-heading text-[8px] tracking-widest text-[#BC13FE]/60 uppercase mb-1">X Player</div>
            <div className="font-heading text-lg" style={{ color: xPlayer ? '#BC13FE' : '#ffffff40' }}>{xPlayer ? `Seat ${xPlayer.seatNumber}` : 'Waiting'}</div>
          </div>
          <div className="p-3 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 text-center">
            <div className="font-heading text-[8px] tracking-widest text-[#FF5F1F]/60 uppercase mb-1">O Player</div>
            <div className="font-heading text-lg" style={{ color: oPlayer ? '#FF5F1F' : '#ffffff40' }}>{oPlayer ? `Seat ${oPlayer.seatNumber}` : 'Waiting'}</div>
          </div>
          <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
            <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Players</div>
            <div className="font-heading text-xl text-white">{roomPlayers.length}</div>
          </div>
          <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
            <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Watchers</div>
            <div className="font-heading text-xl text-white/50">{viewerPlayers}</div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="p-5 border border-[#FF5F1F]/30 rounded-xl bg-black/60">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FF5F1F] uppercase">Board</h2>
          <div className="flex items-center gap-3">
            <span className="font-heading text-xs tracking-widest text-white/40 uppercase">Turn:</span>
            <span className="font-heading text-2xl font-bold"
              style={{ color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 15px ${currentTurn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
              {currentTurn}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
          {board.map((cell, idx) => {
            const { char, color } = cellDisplay(cell);
            return (
              <div key={idx} className="relative group">
                <div className="aspect-square flex items-center justify-center rounded-lg border-2 text-3xl font-heading transition-all"
                  style={{ borderColor: cell ? color : '#ffffff15', color, background: cell ? `${color}15` : 'black' }}>
                  {char}
                </div>
                {!cell && (
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-black/70 rounded-lg">
                    <button onClick={() => forceCell(idx, 'X')} className="w-8 h-8 rounded border border-[#BC13FE] text-[#BC13FE] text-sm font-heading hover:bg-[#BC13FE]/30">X</button>
                    <button onClick={() => forceCell(idx, 'O')} className="w-8 h-8 rounded border border-[#FF5F1F] text-[#FF5F1F] text-sm font-heading hover:bg-[#FF5F1F]/30">O</button>
                  </div>
                )}
                {cell && (
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/70 rounded-lg">
                    <button onClick={() => forceCell(idx, '')} className="w-8 h-8 rounded border border-white/20 text-white/40 text-sm font-heading hover:bg-white/10">✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Btn onClick={() => updateState({ current_turn: 'X' })} color="#BC13FE">Force X Turn</Btn>
          <Btn onClick={() => updateState({ current_turn: 'O' })} color="#FF5F1F">Force O Turn</Btn>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={() => updateState({ board_locked: true })} color="#ef4444" size="sm">🔒 Lock Board</Btn>
          <Btn onClick={() => updateState({ board_locked: false })} color="#4ade80" size="sm">🟢 Unlock Board</Btn>
        </div>
      </div>

      {/* Question Controls */}
      <div className="p-5 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase">Question</h2>
          {loadingTrivia && <span className="font-heading text-xs text-white/30 uppercase tracking-widest">Loading…</span>}
        </div>

        {gs.current_question && (
          <div className="p-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20 space-y-3">
            {gs.current_category && (
              <div className="font-heading text-[10px] tracking-widest text-white/30 uppercase">{gs.current_category}</div>
            )}
            <div className="font-heading text-sm tracking-wide text-[#FFD700] leading-snug">★ {gs.current_question}</div>
            {gs.show_choices && gs.current_choices && (
              <div className="grid grid-cols-2 gap-2">
                {['A','B','C','D'].map((letter) => {
                  const answerText = gs.current_choices[letter];
                  if (!answerText) return null;
                  const isSelected = gs.selected_answer === letter;
                  const isCorrect = letter === gs.correct_answer;
                  return (
                    <button key={letter}
                      onClick={() => handleAnswerSelect(letter)}
                      disabled={isSelected}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-heading text-left transition-all active:scale-95 disabled:cursor-default ${
                        isSelected
                          ? isCorrect
                            ? 'border-[#4ade80] bg-[#4ade80]/20 text-[#4ade80]'
                            : 'border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]'
                          : 'border-[#ffffff15] bg-transparent text-[#ffffff80] hover:enabled:scale-105'
                      }`}>
                      <span className="font-bold">{letter}.</span>
                      <span className="truncate">{answerText}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!currentTrivia && !loadingTrivia && (
          <div className="px-4 py-6 rounded-lg border border-white/10 text-center font-body text-white/30 text-sm">
            Press <span className="text-[#BC13FE]">Fetch Question</span> to load a trivia question.
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Btn onClick={() => fetchOTDBQuestion()} color="#BC13FE" disabled={loadingTrivia} className="col-span-1">{loadingTrivia ? 'Loading…' : 'Fetch Question'}</Btn>
          <Btn onClick={() => updateState({ show_question: true, show_choices: false })} color="#4ade80" disabled={!gs.current_question || loadingTrivia} className="col-span-1">Show Question</Btn>
          <Btn onClick={() => updateState({ show_question: true, show_choices: true })} color="#8a22ff" disabled={!gs.current_question || loadingTrivia} className="col-span-1">Show Choices</Btn>
        </div>
      </div>

      {/* Music */}
      <div className="p-5 border border-[#FFD700]/20 rounded-xl bg-black/60">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm tracking-[0.15em] text-[#FFD700] uppercase">Music</h2>
          <button onClick={() => updateState({ music_on: !(gs.music_on !== false) })}
            className={`px-4 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all ${gs.music_on !== false ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-white/20 text-white/30'}`}>
            {gs.music_on !== false ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Board Mode: Player Roster */}
      {displayMode === 'board' && <BoardModeRoster gs={gs} updateState={updateState} />}

      {/* Game Controls */}
      <div className="grid grid-cols-2 gap-3">
        <Btn onClick={resetBoard} color="#FF5F1F" size="lg">↺ Reset Board</Btn>
        <Btn onClick={() => { resetBoard(); updateState({ display_mode: null, sb_players: [], sb_queue: [] }); }} color="#ffffff" size="lg">New Game</Btn>
      </div>
    </div>
  );
}

function BoardModeRoster({ gs, updateState }) {
  const sbPlayers = gs.sb_players || [];
  const sbQueue = gs.sb_queue || [];
  const sty = { fontFamily: "'Press Start 2P', monospace" };

  const xPlayer = sbPlayers.find(p => p.role === 'X');
  const oPlayer = sbPlayers.find(p => p.role === 'O');
  const viewers = sbPlayers.filter(p => p.role === 'viewer');
  const queued = [...sbQueue].sort((a, b) => a.queuePosition - b.queuePosition);

  const setRole = async (playerId, newRole) => {
    // Remove from queue if promoting
    let newQueue = sbQueue;
    if (newRole === 'X' || newRole === 'O') {
      // Clear the slot they're taking
      const displaced = sbPlayers.find(p => p.role === newRole);
      newQueue = sbQueue.filter(p => p.playerId !== playerId);
      let newPlayers = sbPlayers.map(p => {
        if (p.playerId === playerId) return { ...p, role: newRole };
        if (displaced && p.playerId === displaced.playerId) return { ...p, role: 'viewer' };
        return p;
      });
      // Reindex queue
      newQueue = newQueue.map((q, i) => ({ ...q, queuePosition: i + 1 }));
      await updateState({ sb_players: newPlayers, sb_queue: newQueue });
    } else {
      const newPlayers = sbPlayers.map(p => p.playerId === playerId ? { ...p, role: newRole } : p);
      if (newRole !== 'queued') {
        newQueue = sbQueue.filter(q => q.playerId !== playerId).map((q, i) => ({ ...q, queuePosition: i + 1 }));
      }
      await updateState({ sb_players: newPlayers, sb_queue: newQueue });
    }
  };

  const promoteFromQueue = async () => {
    if (queued.length === 0) return;
    const next = queued[0];
    // Find open slot
    const xFree = !xPlayer;
    const oFree = !oPlayer;
    if (!xFree && !oFree) return; // no slots
    const slotRole = xFree ? 'X' : 'O';
    const newQueue = sbQueue.filter(q => q.playerId !== next.playerId).map((q, i) => ({ ...q, queuePosition: i + 1 }));
    const newPlayers = sbPlayers.map(p => p.playerId === next.playerId ? { ...p, role: slotRole } : p);
    await updateState({ sb_players: newPlayers, sb_queue: newQueue });
  };

  const removeFromQueue = async (playerId) => {
    const newQueue = sbQueue.filter(q => q.playerId !== playerId).map((q, i) => ({ ...q, queuePosition: i + 1 }));
    const newPlayers = sbPlayers.map(p => p.playerId === playerId ? { ...p, role: 'viewer' } : p);
    await updateState({ sb_players: newPlayers, sb_queue: newQueue });
  };

  return (
    <div className="p-5 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl tracking-[0.15em] text-[#BC13FE] uppercase">Board Mode Players</h2>
        {queued.length > 0 && (
          <button onClick={promoteFromQueue}
            className="px-3 py-2 rounded-lg border-2 border-[#FFD700] text-[#FFD700] font-heading text-xs tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95">
            ↑ Promote Next
          </button>
        )}
      </div>

      {/* Active X / O */}
      <div className="grid grid-cols-2 gap-3">
        {[{ role: 'X', label: 'X Player', color: '#BC13FE', player: xPlayer }, { role: 'O', label: 'O Player', color: '#FF5F1F', player: oPlayer }].map(({ role, label, color, player }) => (
          <div key={role} className="p-4 rounded-xl border-2 text-center"
            style={{ borderColor: `${color}40`, background: `${color}08` }}>
            <div className="font-heading text-2xl mb-1" style={{ color }}>{role}</div>
            {player ? (
              <>
                <div className="text-[8px] text-white/70 mb-2" style={sty}>Seat {player.seatNumber}</div>
                <div className="flex gap-1 justify-center flex-wrap">
                  <button onClick={() => setRole(player.playerId, 'viewer')}
                    className="px-2 py-1 rounded border border-white/20 text-white/40 font-heading text-[8px] uppercase hover:border-white/40 transition-all" style={sty}>
                    → Viewer
                  </button>
                  {role === 'X' && oPlayer?.playerId !== player.playerId && (
                    <button onClick={() => setRole(player.playerId, 'O')}
                      className="px-2 py-1 rounded border border-[#FF5F1F]/40 text-[#FF5F1F]/70 font-heading text-[8px] uppercase hover:border-[#FF5F1F] transition-all" style={sty}>
                      → O
                    </button>
                  )}
                  {role === 'O' && xPlayer?.playerId !== player.playerId && (
                    <button onClick={() => setRole(player.playerId, 'X')}
                      className="px-2 py-1 rounded border border-[#BC13FE]/40 text-[#BC13FE]/70 font-heading text-[8px] uppercase hover:border-[#BC13FE] transition-all" style={sty}>
                      → X
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[8px] text-white/20 uppercase" style={sty}>Open Slot</div>
            )}
          </div>
        ))}
      </div>

      {/* Queue */}
      {queued.length > 0 && (
        <div>
          <div className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase mb-2" style={sty}>Queue ({queued.length})</div>
          <div className="space-y-2">
            {queued.map((q) => {
              const p = sbPlayers.find(pl => pl.playerId === q.playerId);
              return (
                <div key={q.playerId} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/5">
                  <div className="w-6 h-6 rounded flex items-center justify-center font-heading text-sm text-[#FFD700]"
                    style={{ background: '#FFD70020', ...sty, fontSize: '9px' }}>
                    {q.queuePosition}
                  </div>
                  <div className="flex-1 text-[8px] text-white/70 uppercase" style={sty}>Seat {q.seatNumber}</div>
                  <div className="flex gap-1">
                    <button onClick={() => setRole(q.playerId, 'X')}
                      className="px-2 py-1 rounded border border-[#BC13FE]/40 text-[#BC13FE]/70 font-heading text-[8px] uppercase hover:border-[#BC13FE] transition-all" style={sty}>X</button>
                    <button onClick={() => setRole(q.playerId, 'O')}
                      className="px-2 py-1 rounded border border-[#FF5F1F]/40 text-[#FF5F1F]/70 font-heading text-[8px] uppercase hover:border-[#FF5F1F] transition-all" style={sty}>O</button>
                    <button onClick={() => removeFromQueue(q.playerId)}
                      className="px-2 py-1 rounded border border-white/10 text-white/30 font-heading text-[8px] uppercase hover:border-red-500/50 hover:text-red-400 transition-all" style={sty}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Viewers */}
      {viewers.length > 0 && (
        <div>
          <div className="text-[8px] tracking-widest text-white/30 uppercase mb-2" style={sty}>Viewers ({viewers.length})</div>
          <div className="flex flex-wrap gap-2">
            {viewers.map(p => (
              <div key={p.playerId} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5">
                <span className="text-[8px] text-white/50 uppercase" style={sty}>Seat {p.seatNumber}</span>
                <button onClick={() => setRole(p.playerId, 'X')} className="text-[7px] text-[#BC13FE]/60 hover:text-[#BC13FE] transition-colors" style={sty}>→X</button>
                <button onClick={() => setRole(p.playerId, 'O')} className="text-[7px] text-[#FF5F1F]/60 hover:text-[#FF5F1F] transition-colors" style={sty}>→O</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sbPlayers.length === 0 && sbQueue.length === 0 && (
        <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase py-4">No players yet</div>
      )}
    </div>
  );
}