import React, { useState, useEffect } from 'react';

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
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkWinner(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,c,d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

export default function SquareBizHostPanel({ gs, updateState, sendCommand, room }) {
  const sbPlayers = gs.sb_players || [];
  const sbQueue = gs.sb_queue || [];
  const roomPlayers = room?.game_state?.players || [];
  const [loadingTrivia, setLoadingTrivia] = useState(false);

  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const boardLocked = gs.board_locked !== false;
  const displayMode = gs.display_mode || null;
  const xPlayer = sbPlayers.find(p => p.role === 'X');
  const oPlayer = sbPlayers.find(p => p.role === 'O');

  const activePlayers = sbPlayers.filter(p => p.role === 'X' || p.role === 'O').length;
  const viewerPlayers = sbPlayers.filter(p => p.role === 'viewer').length;

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE', border: '#BC13FE', bg: '#BC13FE18', glow: '0 0 12px rgba(188,19,254,0.7), inset 0 0 8px rgba(188,19,254,0.2)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', border: '#FF5F1F', bg: '#FF5F1F18', glow: '0 0 12px rgba(255,95,31,0.7), inset 0 0 8px rgba(255,95,31,0.2)' };
    return { char: '', color: '#ffffff60', border: '#FF5F1F', bg: '#1a0a2e', glow: '0 0 8px rgba(188,19,254,0.4), inset 0 0 6px rgba(255,95,31,0.15)' };
  };

  const forceCell = (idx, mark) => {
    const next = [...board];
    next[idx] = next[idx] === mark ? '' : mark;
    const winner = checkWinner(next);
    updateState({ board: next, winner: winner || null });
  };

  const resetBoard = () => {
    updateState({
      board: Array(9).fill(''), current_turn: 'X', winner: null,
      board_locked: true, show_question: false, show_choices: false,
      popup: null, answer_result: null, selected_answer: null,
      current_question: null, current_choices: null, correct_answer: null, current_category: null,
    });
  };

  const selectMode = (mode) => {
    updateState({
      display_mode: mode, board: Array(9).fill(''), current_turn: 'X', winner: null,
      board_locked: true, show_question: false, show_choices: false,
      popup: null, answer_result: null, selected_answer: null,
    });
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
      await updateState({
        show_question: autoShow,
        show_choices: false,
        current_question: decodeHTML(q.question),
        current_choices: choices,
        correct_answer: correctLetter,
        current_category: decodeHTML(q.category),
        answer_result: null,
        selected_answer: null,
        popup: null,
      });
    } catch { /* silently fail */ }
    finally { setLoadingTrivia(false); }
  };

  // Auto-fetch question when O taps the board and show_question is triggered but no question loaded
  useEffect(() => {
    if (gs.show_question && !gs.current_question && !loadingTrivia) {
      fetchOTDBQuestion(true);
    }
  }, [gs.show_question]);

  // HOST clicks CORRECT
  const handleCorrect = async () => {
    // Highlight correct answer, show popup, then unlock board for active player to place marker
    await updateState({ popup: 'correct', answer_result: true, show_question: false, show_choices: false });
    setTimeout(() => updateState({ popup: null, board_locked: false }), 2000);
  };

  // HOST clicks WRONG
  const handleWrong = async () => {
    // Show wrong popup, switch turn, keep board locked
    const nextTurn = currentTurn === 'X' ? 'O' : 'X';
    await updateState({
      popup: 'wrong', answer_result: false,
      show_question: false, show_choices: false,
      current_turn: nextTurn, board_locked: true,
    });
    setTimeout(() => updateState({ popup: null }), 2000);
  };

  // ── MODE SELECT ──
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
              <div className="font-body text-white/50 text-sm">Host controls everything from this panel.</div>
            </button>
            <button onClick={() => selectMode('board')}
              className="p-6 rounded-xl border-2 border-[#FF5F1F]/50 bg-[#FF5F1F]/5 hover:bg-[#FF5F1F]/15 transition-all text-left">
              <div className="font-heading text-xl tracking-widest text-[#FF5F1F] uppercase mb-1">Board Mode</div>
              <div className="font-body text-white/50 text-sm">Host vs Contestant. Host = X, Contestant = O.</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasPendingAnswer = !!gs.selected_answer && gs.answer_result === null || gs.answer_result === undefined && !!gs.selected_answer;
  const waitingForAnswer = gs.show_choices && !gs.selected_answer;

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
          <span className="font-heading tracking-widest uppercase"
            style={{ color: boardLocked ? '#ef4444' : '#4ade80', fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>
            {boardLocked ? '🔒 LOCKED' : '🟢 OPEN'}
          </span>
          <button onClick={() => updateState({ display_mode: null })}
            className="font-heading text-xs tracking-widest text-white/30 uppercase border border-white/10 px-3 py-1 rounded hover:text-white/60 hover:border-white/30 transition-all">
            Change Mode
          </button>
        </div>
      </div>

      {/* Board Mode: Turn + Players */}
      {displayMode === 'board' && (
        <div className="p-4 border border-[#FF5F1F]/30 rounded-xl bg-black/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg tracking-[0.15em] text-[#FF5F1F] uppercase">Current Turn</h2>
            <div className="px-4 py-2 rounded-lg border-2 font-heading text-xl tracking-widest"
              style={{
                borderColor: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F',
                color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F',
                background: currentTurn === 'X' ? 'rgba(188,19,254,0.1)' : 'rgba(255,95,31,0.1)',
                textShadow: `0 0 15px ${currentTurn === 'X' ? '#BC13FE' : '#FF5F1F'}`,
              }}>
              {currentTurn === 'X' ? 'PLAYER X — HOST' : 'PLAYER O — CONTESTANT'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[#BC13FE]/30 bg-[#BC13FE]/5 text-center">
              <div className="font-heading text-[8px] tracking-widest text-[#BC13FE]/60 uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>X — HOST</div>
              <div className="font-heading text-lg" style={{ color: xPlayer ? '#BC13FE' : '#ffffff30' }}>
                {xPlayer ? `Seat ${xPlayer.seatNumber}` : 'Not Connected'}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 text-center">
              <div className="font-heading text-[8px] tracking-widest text-[#FF5F1F]/60 uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>O — CONTESTANT</div>
              <div className="font-heading text-lg" style={{ color: oPlayer ? '#FF5F1F' : '#ffffff30' }}>
                {oPlayer ? `Seat ${oPlayer.seatNumber}` : 'Waiting…'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Status */}
      <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg tracking-[0.15em] text-[#BC13FE] uppercase">Room</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
            <span className="font-heading text-[9px] tracking-widest text-[#4ade80]/70 uppercase">LIVE</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
            <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Code</div>
            <div className="font-heading text-lg text-[#FFD700]" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}>{room?.room_code}</div>
          </div>
          <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-center">
            <div className="font-heading text-[8px] tracking-widest text-white/30 uppercase mb-1">Players</div>
            <div className="font-heading text-2xl text-white">{roomPlayers.length}</div>
          </div>
          <div className="p-3 rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
            <div className="font-heading text-[8px] tracking-widest text-[#FFD700]/60 uppercase mb-1">Queue</div>
            <div className="font-heading text-2xl text-[#FFD700]">{sbQueue.length}</div>
          </div>
          <div className="p-3 rounded-lg border border-[#4ade80]/30 bg-[#4ade80]/5 text-center">
            <div className="font-heading text-[8px] tracking-widest text-[#4ade80]/60 uppercase mb-1">Active</div>
            <div className="font-heading text-2xl text-[#4ade80]">{activePlayers}</div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="p-5 border border-[#FF5F1F]/30 rounded-xl bg-black/60">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FF5F1F] uppercase">Board</h2>
          <span className="font-heading text-2xl font-bold"
            style={{ color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 15px ${currentTurn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
            Turn: {currentTurn}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
          {board.map((cell, idx) => {
            const { char, color, border, bg, glow } = cellDisplay(cell);
            return (
              <div key={idx} className="relative group">
                <div className="aspect-square flex items-center justify-center rounded-lg border-2 text-3xl font-heading transition-all"
                  style={{ borderColor: border, color, background: bg, boxShadow: glow }}>
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
          <Btn onClick={() => updateState({ current_turn: 'X' })} color="#BC13FE" size="sm">Force X Turn</Btn>
          <Btn onClick={() => updateState({ current_turn: 'O' })} color="#FF5F1F" size="sm">Force O Turn</Btn>
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
          {loadingTrivia && <span className="font-heading text-xs text-white/30 uppercase tracking-widest animate-pulse">Loading…</span>}
        </div>

        {/* Question preview */}
        {gs.current_question ? (
          <div className="p-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20 space-y-3">
            {gs.current_category && (
              <div className="font-heading text-[10px] tracking-widest text-white/30 uppercase">{gs.current_category}</div>
            )}
            <div className="font-heading text-sm tracking-wide text-[#FFD700] leading-snug">★ {gs.current_question}</div>

            {/* Choices — clickable by host to set selected_answer, no correct highlight until after resolution */}
            {gs.current_choices && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['A','B','C','D'].map((letter) => {
                  const answerText = gs.current_choices[letter];
                  if (!answerText) return null;
                  const isSelected = gs.selected_answer === letter;
                  const hostJudged = gs.answer_result === true || gs.answer_result === false;
                  const isCorrect = letter === gs.correct_answer;

                  // Only show result highlights AFTER host has judged
                  let cls = 'border-[#ffffff20] bg-[#ffffff08] text-[#ffffffcc] hover:border-[#FF5F1F] hover:bg-[#FF5F1F]/10 cursor-pointer';
                  if (isSelected && !hostJudged) cls = 'border-[#FFD700]/70 bg-[#FFD700]/15 text-[#FFD700] cursor-pointer';
                  if (hostJudged && isSelected && gs.answer_result) cls = 'border-[#4ade80]/70 bg-[#4ade80]/15 text-[#4ade80] cursor-default';
                  if (hostJudged && isSelected && !gs.answer_result) cls = 'border-[#ef4444]/70 bg-[#ef4444]/10 text-[#ef4444] cursor-default';
                  if (hostJudged && isCorrect && gs.answer_result) cls = 'border-[#4ade80]/70 bg-[#4ade80]/15 text-[#4ade80] cursor-default';

                  return (
                    <button key={letter}
                      onClick={() => !hostJudged && updateState({ selected_answer: letter })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-heading text-left transition-all active:scale-95 ${cls}`}>
                      <span className="font-bold">{letter}.</span>
                      <span className="truncate">{answerText}</span>
                      {isSelected && !hostJudged && <span className="ml-auto text-[#FFD700]">●</span>}
                      {hostJudged && isSelected && gs.answer_result && <span className="ml-auto text-[#4ade80]">✓</span>}
                      {hostJudged && isSelected && !gs.answer_result && <span className="ml-auto text-[#ef4444]">✗</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status indicator */}
            {gs.selected_answer && gs.answer_result === null && (
              <div className="px-3 py-2 rounded-lg border border-[#FFD700]/40 bg-[#FFD700]/10 text-center">
                <div className="font-heading text-xs tracking-widest text-[#FFD700] uppercase">
                  Selected: {gs.selected_answer} — Click CORRECT or WRONG
                </div>
              </div>
            )}
            {!gs.selected_answer && gs.show_choices && (
              <div className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-center">
                <div className="font-heading text-[9px] tracking-widest text-white/40 uppercase">
                  Click a choice above to select player's answer
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-6 rounded-lg border border-white/10 text-center font-body text-white/30 text-sm">
            Press <span className="text-[#BC13FE]">Fetch Question</span> to load a trivia question.
          </div>
        )}

        {/* Question flow buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Btn onClick={() => fetchOTDBQuestion(false)} color="#BC13FE" disabled={loadingTrivia}>
            {loadingTrivia ? 'Loading…' : 'Fetch Q'}
          </Btn>
          <Btn onClick={() => updateState({ show_question: true, show_choices: false })} color="#4ade80" disabled={!gs.current_question || loadingTrivia}>
            Show Q
          </Btn>
          <Btn onClick={() => updateState({ show_question: true, show_choices: true })} color="#8a22ff" disabled={!gs.current_question || loadingTrivia}>
            Show Choices
          </Btn>
        </div>

        {/* CORRECT / WRONG — always clickable when choices are showing */}
        {gs.show_choices && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <button
              onClick={handleCorrect}
              disabled={gs.answer_result === true}
              className="py-5 rounded-xl border-2 border-[#4ade80] font-heading text-xl tracking-widest text-[#4ade80] uppercase hover:bg-[#4ade80]/20 transition-all active:scale-95 disabled:opacity-40"
              style={{ boxShadow: '0 0 20px rgba(74,222,128,0.3)' }}>
              ✓ CORRECT
            </button>
            <button
              onClick={handleWrong}
              disabled={gs.answer_result === false}
              className="py-5 rounded-xl border-2 border-[#ef4444] font-heading text-xl tracking-widest text-[#ef4444] uppercase hover:bg-[#ef4444]/20 transition-all active:scale-95 disabled:opacity-40"
              style={{ boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}>
              ✗ WRONG
            </button>
          </div>
        )}
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
    let newQueue = sbQueue;
    if (newRole === 'X' || newRole === 'O') {
      const displaced = sbPlayers.find(p => p.role === newRole);
      newQueue = sbQueue.filter(p => p.playerId !== playerId);
      const newPlayers = sbPlayers.map(p => {
        if (p.playerId === playerId) return { ...p, role: newRole };
        if (displaced && p.playerId === displaced.playerId) return { ...p, role: 'viewer' };
        return p;
      });
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
    const xFree = !xPlayer;
    const oFree = !oPlayer;
    if (!xFree && !oFree) return;
    const slotRole = oFree ? 'O' : 'X'; // prefer O slot for promoted contestants
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
        <h2 className="font-heading text-xl tracking-[0.15em] text-[#BC13FE] uppercase">Players</h2>
        {queued.length > 0 && (
          <button onClick={promoteFromQueue}
            className="px-3 py-2 rounded-lg border-2 border-[#FFD700] text-[#FFD700] font-heading text-xs tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95">
            ↑ Promote Next
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { role: 'X', label: 'HOST', color: '#BC13FE', player: xPlayer },
          { role: 'O', label: 'CONTESTANT', color: '#FF5F1F', player: oPlayer }
        ].map(({ role, label, color, player }) => (
          <div key={role} className="p-4 rounded-xl border-2 text-center"
            style={{ borderColor: `${color}40`, background: `${color}08` }}>
            <div className="font-heading text-2xl mb-0.5" style={{ color }}>{role}</div>
            <div className="text-[7px] tracking-widest text-white/30 uppercase mb-2" style={sty}>{label}</div>
            {player ? (
              <>
                <div className="text-[8px] text-white/70 mb-2" style={sty}>Seat {player.seatNumber}</div>
                <div className="flex gap-1 justify-center flex-wrap">
                  <button onClick={() => setRole(player.playerId, 'viewer')}
                    className="px-2 py-1 rounded border border-white/20 text-white/40 font-heading text-[7px] uppercase hover:border-white/40 transition-all" style={sty}>
                    → Viewer
                  </button>
                  {role === 'X' && (
                    <button onClick={() => setRole(player.playerId, 'O')}
                      className="px-2 py-1 rounded border border-[#FF5F1F]/40 text-[#FF5F1F]/70 font-heading text-[7px] uppercase hover:border-[#FF5F1F] transition-all" style={sty}>
                      → O
                    </button>
                  )}
                  {role === 'O' && (
                    <button onClick={() => setRole(player.playerId, 'X')}
                      className="px-2 py-1 rounded border border-[#BC13FE]/40 text-[#BC13FE]/70 font-heading text-[7px] uppercase hover:border-[#BC13FE] transition-all" style={sty}>
                      → X
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[7px] text-white/20 uppercase" style={sty}>Open Slot</div>
            )}
          </div>
        ))}
      </div>

      {queued.length > 0 && (
        <div>
          <div className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase mb-2" style={sty}>Queue ({queued.length})</div>
          <div className="space-y-2">
            {queued.map((q) => (
              <div key={q.playerId} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/5">
                <div className="w-6 h-6 rounded flex items-center justify-center text-[#FFD700]"
                  style={{ background: '#FFD70020', ...sty, fontSize: '9px' }}>{q.queuePosition}</div>
                <div className="flex-1 text-[8px] text-white/70 uppercase" style={sty}>Seat {q.seatNumber}</div>
                <div className="flex gap-1">
                  <button onClick={() => setRole(q.playerId, 'O')}
                    className="px-2 py-1 rounded border border-[#FF5F1F]/40 text-[#FF5F1F]/70 font-heading text-[7px] uppercase hover:border-[#FF5F1F] transition-all" style={sty}>→O</button>
                  <button onClick={() => removeFromQueue(q.playerId)}
                    className="px-2 py-1 rounded border border-white/10 text-white/30 font-heading text-[7px] uppercase hover:border-red-500/50 hover:text-red-400 transition-all" style={sty}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewers.length > 0 && (
        <div>
          <div className="text-[8px] tracking-widest text-white/30 uppercase mb-2" style={sty}>Viewers ({viewers.length})</div>
          <div className="flex flex-wrap gap-2">
            {viewers.map(p => (
              <div key={p.playerId} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5">
                <span className="text-[7px] text-white/50 uppercase" style={sty}>Seat {p.seatNumber}</span>
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