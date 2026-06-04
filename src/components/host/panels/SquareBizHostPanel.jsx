import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const Btn = ({ children, onClick, color = '#FF5F1F', size = 'md', className = '', disabled = false }) => {
  const pad = size === 'lg' ? 'px-6 py-4 text-xl' : size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-heading tracking-widest uppercase rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 ${pad} ${className}`}
      style={{ borderColor: color, color, background: 'transparent' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
};

// Decode HTML entities from Open Trivia DB responses
function decodeHTML(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

// Shuffle an array in place (Fisher-Yates)
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function SquareBizHostPanel({ gs, updateState, sendCommand }) {
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [loadingTrivia, setLoadingTrivia] = useState(false);

  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const displayMode = gs.display_mode || null;

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F' };
    return { char: '·', color: '#ffffff20' };
  };

  const forceCell = (idx, mark) => {
    const next = [...board];
    next[idx] = next[idx] === mark ? '' : mark;
    updateState({ board: next });
  };

  const resetBoard = () => {
    updateState({ board: Array(9).fill(''), current_turn: 'X', winner: null, show_question: false, show_choices: false, popup: null });
  };

  const selectMode = (mode) => {
    updateState({ display_mode: mode, board: Array(9).fill(''), current_turn: 'X', winner: null, show_question: false, show_choices: false, popup: null });
  };

  const fetchOTDBQuestion = async (autoShow = false) => {
    setLoadingTrivia(true);
    try {
      const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
      const data = await res.json();
      const q = data.results[0];

      const correct = decodeHTML(q.correct_answer);
      const allAnswers = shuffleArray([
        correct,
        ...q.incorrect_answers.map(decodeHTML),
      ]);
      const letters = ['A', 'B', 'C', 'D'];
      const choices = {};
      allAnswers.forEach((ans, i) => { choices[letters[i]] = ans; });
      const correctLetter = letters[allAnswers.indexOf(correct)];

      const trivia = {
        question: decodeHTML(q.question),
        choices,
        correctLetter,
        category: decodeHTML(q.category),
      };
      setCurrentTrivia(trivia);
      updateState({
        show_question: autoShow,
        show_choices: false,
        current_question: trivia.question,
        current_choices: trivia.choices,
        correct_answer: trivia.correctLetter,
      });
    } catch {
      // silently fail — host can retry
    } finally {
      setLoadingTrivia(false);
    }
  };

  const showQuestion = () => {
    if (!currentTrivia) return;
    updateState({ show_question: true, show_choices: false });
  };

  const showChoices = () => {
    updateState({ show_choices: true });
  };

  const shuffleQuestion = () => {
    fetchOTDBQuestion();
  };

  // Watch for auto-next-question signal (set by board mode after cell placement or wrong answer)
  useEffect(() => {
    if (gs.auto_next_question) {
      updateState({ auto_next_question: null });
      fetchOTDBQuestion(true); // autoShow=true so question appears immediately
    }
  }, [gs.auto_next_question]);

  const handleAnswerSelect = async (letter) => {
    const isCorrect = letter === currentTrivia?.correctLetter;
    if (isCorrect) {
      updateState({ popup: 'correct', show_question: false, show_choices: false, selected_square: null });
      setTimeout(() => updateState({ popup: null, board_enabled: true }), 2500);
    } else {
      updateState({ popup: 'wrong', show_question: false, show_choices: false, selected_square: null, board_enabled: false });
      // Auto-advance to next question after wrong answer
      setTimeout(() => updateState({ popup: null }), 2500);
      setTimeout(() => fetchOTDBQuestion(), 2600);
    }
  };

  // ── MODE SELECT SCREEN ──
  if (!displayMode) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-4">
        <div className="p-6 border border-[#FF5F1F]/30 rounded-xl bg-black/60 text-center"
          style={{ boxShadow: '0 0 20px rgba(255,95,31,0.1)' }}>
          <h2 className="font-heading text-2xl tracking-[0.15em] text-[#ff8a00] uppercase mb-2">Square Biz!</h2>
          <p className="font-body text-white/50 text-sm mb-8">Select how you want to play on the main game screen</p>

          {/* Music Toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-black/40 border border-white/10 mb-8">
            <span className="font-heading text-sm tracking-widest text-white/60 uppercase">Music</span>
            <button
              onClick={() => updateState({ music_on: !(gs.music_on !== false) })}
              className={`px-4 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all ${gs.music_on !== false ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-white/20 text-white/30'}`}
            >
              {gs.music_on !== false ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => selectMode('panel')}
              className="p-6 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/5 hover:bg-[#BC13FE]/15 transition-all text-left group"
            >
              <div className="font-heading text-xl tracking-widest text-[#BC13FE] uppercase mb-1">Panel Mode</div>
              <div className="font-body text-white/50 text-sm">Host controls everything. Question & answers shown on screen, host decides correct/wrong.</div>
            </button>
            <button
              onClick={() => selectMode('board')}
              className="p-6 rounded-xl border-2 border-[#FF5F1F]/50 bg-[#FF5F1F]/5 hover:bg-[#FF5F1F]/15 transition-all text-left group"
            >
              <div className="font-heading text-xl tracking-widest text-[#FF5F1F] uppercase mb-1">Board Mode</div>
              <div className="font-body text-white/50 text-sm">Players interact directly with the board. Questions auto-reveal on screen.</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE GAME PANEL ──
  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Mode indicator + change */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg border border-white/10 bg-black/40">
        <span className="font-heading text-sm tracking-widest uppercase"
          style={{ color: displayMode === 'panel' ? '#BC13FE' : '#FF5F1F' }}>
          {displayMode === 'panel' ? '📺 Panel Mode' : '🎮 Board Mode'}
        </span>
        <button
          onClick={() => updateState({ display_mode: null })}
          className="font-heading text-xs tracking-widest text-white/30 uppercase border border-white/10 px-3 py-1 rounded hover:text-white/60 hover:border-white/30 transition-all"
        >
          Change Mode
        </button>
      </div>

      {/* ── BOARD (TOP) ── */}
      <div className="p-5 border border-[#FF5F1F]/30 rounded-xl bg-black/60"
        style={{ boxShadow: '0 0 20px rgba(255,95,31,0.1)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FF5F1F] uppercase">Board State</h2>
          <div className="flex items-center gap-3">
            <span className="font-heading text-xs tracking-widest text-white/40 uppercase">Turn:</span>
            <span className="font-heading text-2xl font-bold"
              style={{ color: currentTurn === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 15px ${currentTurn === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
              {currentTurn}
            </span>
          </div>
        </div>

        {/* 3x3 Grid */}
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
          {board.map((cell, idx) => {
            const { char, color } = cellDisplay(cell);
            const isSelected = gs.selected_square === idx;
            return (
              <div key={idx} className="relative group">
                <div
                  className="aspect-square flex items-center justify-center rounded-lg border-2 text-3xl font-heading cursor-pointer transition-all hover:scale-105"
                  style={{
                    borderColor: isSelected ? '#FFD700' : cell ? color : '#ffffff15',
                    color,
                    background: isSelected ? '#FFD70020' : cell ? `${color}15` : 'black',
                    boxShadow: isSelected ? '0 0 12px rgba(255,215,0,0.4)' : 'none',
                  }}
                  onClick={() => !cell && updateState({ selected_square: isSelected ? null : idx })}
                >
                  {char}
                </div>
                {!cell && (
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-black/70 rounded-lg">
                    <button onClick={(e) => { e.stopPropagation(); forceCell(idx, 'X'); }} className="w-8 h-8 rounded border border-[#BC13FE] text-[#BC13FE] text-sm font-heading hover:bg-[#BC13FE]/30">X</button>
                    <button onClick={(e) => { e.stopPropagation(); forceCell(idx, 'O'); }} className="w-8 h-8 rounded border border-[#FF5F1F] text-[#FF5F1F] text-sm font-heading hover:bg-[#FF5F1F]/30">O</button>
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

        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={() => updateState({ current_turn: 'X' })} color="#BC13FE">Force X Turn</Btn>
          <Btn onClick={() => updateState({ current_turn: 'O' })} color="#FF5F1F">Force O Turn</Btn>
        </div>
      </div>

      {/* ── QUESTION CONTROLS ── */}
      <div className="p-5 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase">Question</h2>
          {loadingTrivia && <span className="font-heading text-xs text-white/30 uppercase tracking-widest">Loading…</span>}
        </div>

        {/* Current question display */}
        {currentTrivia && (
          <div className="p-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20 space-y-3">
            {currentTrivia.category && (
              <div className="font-heading text-[10px] tracking-widest text-white/30 uppercase">{currentTrivia.category}</div>
            )}
            <div className="font-heading text-sm tracking-wide text-[#FFD700] leading-snug">★ {currentTrivia.question}</div>
            <div className="grid grid-cols-2 gap-2">
              {['A', 'B', 'C', 'D'].map((letter) => {
                const answerText = currentTrivia.choices?.[letter];
                if (!answerText) return null;
                const isCorrect = currentTrivia.correctLetter === letter;
                return (
                  <button key={letter}
                    onClick={() => handleAnswerSelect(letter)}
                    disabled={!gs.show_choices}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-heading text-left transition-all active:scale-95 disabled:opacity-40 disabled:cursor-default hover:enabled:scale-105"
                    style={{
                      borderColor: isCorrect ? '#4ade80' : '#ffffff15',
                      background: isCorrect ? '#4ade8015' : 'transparent',
                      color: isCorrect ? '#4ade80' : '#ffffff80',
                    }}>
                    <span className="font-bold">{letter}.</span>
                    <span className="truncate">{answerText}</span>
                    {isCorrect && <span className="ml-auto">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!currentTrivia && !loadingTrivia && (
          <div className="px-4 py-6 rounded-lg border border-white/10 text-center font-body text-white/30 text-sm">
            Press <span className="text-[#BC13FE]">Shuffle Question</span> to fetch a question from Open Trivia DB.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={showQuestion} color="#4ade80" disabled={!currentTrivia || loadingTrivia}>Show Question</Btn>
          <Btn onClick={shuffleQuestion} color="#BC13FE" disabled={loadingTrivia}>{loadingTrivia ? 'Loading…' : 'Shuffle Question'}</Btn>
        </div>
        <Btn onClick={showChoices} color="#8a22ff" disabled={!gs.show_question} className="w-full">Show Choices</Btn>
      </div>

      {/* ── AUDIO ── */}
      <div className="p-5 border border-[#FFD700]/20 rounded-xl bg-black/60">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm tracking-[0.15em] text-[#FFD700] uppercase">Music</h2>
          <button
            onClick={() => updateState({ music_on: !(gs.music_on !== false) })}
            className={`px-4 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all ${gs.music_on !== false ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-white/20 text-white/30'}`}
          >
            {gs.music_on !== false ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ── GAME CONTROLS ── */}
      <div className="grid grid-cols-2 gap-3">
        <Btn onClick={resetBoard} color="#FF5F1F" size="lg">↺ Reset Board</Btn>
        <Btn onClick={() => { resetBoard(); updateState({ display_mode: null }); }} color="#ffffff" size="lg">New Game</Btn>
      </div>
    </div>
  );
}