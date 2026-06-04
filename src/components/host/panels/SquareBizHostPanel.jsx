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

export default function SquareBizHostPanel({ gs, updateState, sendCommand }) {
  const [trivia, setTrivia] = useState([]);
  const [loadingTrivia, setLoadingTrivia] = useState(false);
  const [currentTriviaIdx, setCurrentTriviaIdx] = useState(0);

  const board = gs.board || Array(9).fill('');
  const currentTurn = gs.current_turn || 'X';
  const displayMode = gs.display_mode || null; // null = mode select screen

  // Load trivia bank — uses BFFSurvey as the question source
  useEffect(() => {
    setLoadingTrivia(true);
    base44.entities.BFFSurvey.list()
      .then(data => {
        // Convert BFFSurvey format to trivia format with A/B/C/D choices
        const converted = data.map((s) => {
          const answers = s.answers || [];
          const choices = {};
          const letters = ['A', 'B', 'C', 'D'];
          // Pick up to 4 answers, shuffle which one is correct
          const shuffled = [...answers].sort(() => Math.random() - 0.5).slice(0, 4);
          const correctIdx = Math.floor(Math.random() * Math.min(shuffled.length, 4));
          shuffled.forEach((a, i) => {
            if (i < 4) choices[letters[i]] = a.answer || a.text || '';
          });
          return {
            id: s.id,
            question: s.question,
            answer_a: choices['A'] || '',
            answer_b: choices['B'] || '',
            answer_c: choices['C'] || '',
            answer_d: choices['D'] || '',
            correct_answer: letters[correctIdx],
            _raw: s,
          };
        });
        setTrivia(converted);
      })
      .finally(() => setLoadingTrivia(false));
  }, []);

  // Sync currentTriviaIdx when gs.trivia_idx changes
  useEffect(() => {
    if (gs.trivia_idx != null) setCurrentTriviaIdx(gs.trivia_idx);
  }, [gs.trivia_idx]);

  const currentTrivia = trivia[currentTriviaIdx] || null;

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

  const showQuestion = () => {
    if (!currentTrivia) return;
    updateState({
      show_question: true,
      show_choices: false,
      current_question: currentTrivia.question,
      current_choices: {
        A: currentTrivia.answer_a,
        B: currentTrivia.answer_b,
        C: currentTrivia.answer_c,
        D: currentTrivia.answer_d,
      },
      correct_answer: currentTrivia.correct_answer,
      trivia_idx: currentTriviaIdx,
    });
  };

  const showChoices = () => {
    updateState({ show_choices: true });
  };

  const shuffleQuestion = () => {
    if (trivia.length === 0) return;
    const newIdx = Math.floor(Math.random() * trivia.length);
    setCurrentTriviaIdx(newIdx);
    const t = trivia[newIdx];
    updateState({
      show_question: false,
      show_choices: false,
      current_question: t.question,
      current_choices: {
        A: t.answer_a,
        B: t.answer_b,
        C: t.answer_c,
        D: t.answer_d,
      },
      correct_answer: t.correct_answer,
      trivia_idx: newIdx,
    });
  };

  const handleCorrect = () => {
    updateState({
      popup: 'correct',
      show_question: false,
      show_choices: false,
      selected_square: null,
    });
    // After popup clears, enable the board for the player to place their mark
    setTimeout(() => updateState({ popup: null, board_enabled: true }), 2500);
  };

  const handleWrong = () => {
    updateState({
      popup: 'wrong',
      show_question: false,
      show_choices: false,
      selected_square: null,
      board_enabled: false,
    });
    setTimeout(() => updateState({ popup: null }), 2500);
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
          {!loadingTrivia && trivia.length > 0 && (
            <span className="font-heading text-xs text-white/30 uppercase tracking-widest">{trivia.length} questions</span>
          )}
        </div>

        {/* Current question display */}
        {currentTrivia && (
          <div className="p-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20 space-y-3">
            <div className="font-heading text-sm tracking-wide text-[#FFD700]">★ {currentTrivia.question}</div>
            <div className="grid grid-cols-2 gap-2">
              {['A', 'B', 'C', 'D'].map((letter) => {
                const answerText = currentTrivia[`answer_${letter.toLowerCase()}`];
                if (!answerText) return null;
                const isCorrect = currentTrivia.correct_answer === letter;
                return (
                  <div key={letter}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-heading"
                    style={{
                      borderColor: isCorrect ? '#4ade80' : '#ffffff15',
                      background: isCorrect ? '#4ade8015' : 'transparent',
                      color: isCorrect ? '#4ade80' : '#ffffff80',
                    }}>
                    <span className="font-bold">{letter}.</span>
                    <span className="truncate">{answerText}</span>
                    {isCorrect && <span className="ml-auto">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!currentTrivia && !loadingTrivia && (
          <div className="px-4 py-6 rounded-lg border border-white/10 text-center font-body text-white/30 text-sm">
            No trivia loaded yet. Add questions to the SquareBizTrivia entity.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={showQuestion} color="#4ade80" disabled={!currentTrivia}>Show Question</Btn>
          <Btn onClick={shuffleQuestion} color="#BC13FE" disabled={trivia.length === 0}>Shuffle Question</Btn>
        </div>
        <Btn onClick={showChoices} color="#8a22ff" disabled={!gs.show_question} className="w-full">Show Choices</Btn>
      </div>

      {/* ── CORRECT / WRONG ── */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={handleCorrect}
          className="py-5 rounded-xl border-2 border-green-500 font-heading text-2xl tracking-widest uppercase text-green-400 hover:bg-green-500/20 transition-all active:scale-95"
        >
          ✓ Correct
        </button>
        <button
          onClick={handleWrong}
          className="py-5 rounded-xl border-2 border-red-500 font-heading text-2xl tracking-widest uppercase text-red-400 hover:bg-red-500/20 transition-all active:scale-95"
        >
          ✗ Wrong
        </button>
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