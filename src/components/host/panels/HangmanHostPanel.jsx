import React, { useState } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const Btn = ({ children, onClick, color = '#FFD700', size = 'md', className = '', disabled = false }) => {
  const pad = size === 'lg' ? 'px-6 py-4 text-[10px]' : size === 'sm' ? 'px-3 py-2 text-[8px]' : 'px-4 py-3 text-[9px]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`tracking-widest uppercase rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 ${pad} ${className}`}
      style={{ ...PS2, borderColor: color, color, background: 'transparent' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const PARTS = [
  <circle key="head" cx="120" cy="75" r="15" stroke="#FFD700" strokeWidth="3" fill="none" />,
  <line key="body" x1="120" y1="90" x2="120" y2="140" stroke="#FFD700" strokeWidth="3" />,
  <line key="arm-l" x1="120" y1="100" x2="90" y2="125" stroke="#FFD700" strokeWidth="3" />,
  <line key="arm-r" x1="120" y1="100" x2="150" y2="125" stroke="#FFD700" strokeWidth="3" />,
  <line key="leg-l" x1="120" y1="140" x2="90" y2="175" stroke="#FFD700" strokeWidth="3" />,
  <line key="leg-r" x1="120" y1="140" x2="150" y2="175" stroke="#FFD700" strokeWidth="3" />,
  <line key="foot-l" x1="90" y1="175" x2="75" y2="170" stroke="#FFD700" strokeWidth="3" />,
];

function HangmanSVG({ wrongCount }) {
  return (
    <svg width="160" height="190">
      {/* Static gallows */}
      <line x1="20" y1="180" x2="140" y2="180" stroke="#ffffff15" strokeWidth="3" />
      <line x1="55" y1="180" x2="55" y2="10" stroke="#ffffff15" strokeWidth="3" />
      <line x1="55" y1="10" x2="120" y2="10" stroke="#ffffff15" strokeWidth="3" />
      <line x1="120" y1="10" x2="120" y2="20" stroke="#ffffff15" strokeWidth="3" />
      {/* Rope — always visible once game starts */}
      <line x1="120" y1="20" x2="120" y2="60" stroke="#BC13FE" strokeWidth="3" />
      {PARTS.slice(0, wrongCount)}
    </svg>
  );
}

export default function HangmanHostPanel({ gs, updateState, sendCommand }) {
  const isSetup = !gs.phase || gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing';
  const wrongCount = (gs.wrong_letters || []).length;
  const maxWrong = gs.max_wrong || 7;
  const guessed = gs.guessed_letters || [];
  const wrong = gs.wrong_letters || [];
  const secretWord = (gs.secret_word || '').toUpperCase();
  const players = gs.players || [];
  const currentGoRound = gs.current_go_round || 1;
  const seatsThatChose = gs.seats_that_chose || [];
  const lastAction = gs.last_action;

  // Host can guess on behalf of players
  const guessLetter = async (letter) => {
    if (guessed.includes(letter) || wrong.includes(letter)) return;
    const isCorrect = secretWord.includes(letter);
    const newGuessed = isCorrect ? [...guessed, letter] : guessed;
    const newWrong = !isCorrect ? [...wrong, letter] : wrong;

    const allRevealed = secretWord.split('').every(ch => ch === ' ' || newGuessed.includes(ch));
    const newPhase = allRevealed ? 'finished' : (newWrong.length >= maxWrong ? 'finished' : 'playing');

    const connectedSeats = players.map(p => p.seatNumber);
    const newSeatsThatChose = seatsThatChose; // host guesses don't count toward go-round
    const allChosen = connectedSeats.length > 0 && connectedSeats.every(s => newSeatsThatChose.includes(s));

    await updateState({
      guessed_letters: newGuessed,
      wrong_letters: newWrong,
      phase: newPhase,
      word_revealed: newPhase === 'finished',
      last_action: {
        playerId: 'HOST',
        seatNumber: 'HOST',
        letter,
        result: isCorrect ? 'correct' : 'wrong',
        goRound: currentGoRound,
        timestamp: Date.now(),
      },
    });
  };

  const startGame = async () => {
    if (!gs.secret_word?.trim()) return;
    await updateState({
      phase: 'playing',
      hint_revealed: false,
      word_revealed: false,
      guessed_letters: [],
      wrong_letters: [],
      current_go_round: 1,
      seats_that_chose: [],
      last_action: null,
    });
    await sendCommand({ type: 'START_GAME' });
  };

  const revealHint = async () => {
    await updateState({ hint_revealed: true });
    await sendCommand({ type: 'REVEAL_HINT' });
  };

  const revealWord = async () => {
    await updateState({ word_revealed: true, phase: 'finished' });
    await sendCommand({ type: 'REVEAL_WORD' });
  };

  const resetRound = async () => {
    await updateState({
      phase: 'playing',
      hint_revealed: false,
      word_revealed: false,
      guessed_letters: [],
      wrong_letters: [],
      current_go_round: 1,
      seats_that_chose: [],
      last_action: null,
    });
    await sendCommand({ type: 'RESET_ROUND' });
  };

  const newGame = async () => {
    await updateState({
      phase: 'setup',
      secret_word: '',
      category: '',
      hint: '',
      hint_revealed: false,
      word_revealed: false,
      guessed_letters: [],
      wrong_letters: [],
      current_go_round: 1,
      seats_that_chose: [],
      last_action: null,
    });
  };

  const connectedSeats = players.map(p => p.seatNumber);
  const seatsWaiting = connectedSeats.filter(s => !seatsThatChose.includes(s));

  // Small room logic: host counts as 1 person
  const totalPeople = players.length + 1;
  const isGoRoundMode = totalPeople >= 4;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── SEAT STATUS PANEL ── */}
      {players.length > 0 && (
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[9px] tracking-[0.15em] text-[#BC13FE] uppercase" style={PS2}>Player Seats</h2>
            <div className="flex items-center gap-3">
              <span className="text-[8px] text-white/30" style={PS2}>{players.length} connected</span>
              {/* Mode badge */}
              <span className="px-2 py-1 rounded border text-[7px] tracking-widest uppercase"
                style={{
                  ...PS2,
                  borderColor: isGoRoundMode ? '#FFD700' : '#4ade80',
                  color: isGoRoundMode ? '#FFD700' : '#4ade80',
                  background: isGoRoundMode ? 'rgba(255,215,0,0.08)' : 'rgba(74,222,128,0.08)',
                }}>
                {isGoRoundMode ? 'Go-Round' : 'Free Play'}
              </span>
            </div>
          </div>

          {/* Go-Round stats — only in go-round mode */}
          {isPlaying && isGoRoundMode && (
            <div className="grid grid-cols-3 gap-3 text-center py-2 border-t border-white/10">
              <div>
                <div className="text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Go-Round</div>
                <div className="text-xl text-[#FFD700]" style={PS2}>{currentGoRound}</div>
              </div>
              <div>
                <div className="text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Chosen</div>
                <div className="text-xl text-green-400" style={PS2}>{seatsThatChose.length}</div>
              </div>
              <div>
                <div className="text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Waiting</div>
                <div className="text-xl text-[#FF5F1F]" style={PS2}>{seatsWaiting.length}</div>
              </div>
            </div>
          )}
          {isPlaying && !isGoRoundMode && (
            <div className="py-2 border-t border-white/10 text-center">
              <span className="text-[7px] tracking-widest text-[#4ade80]/60 uppercase" style={PS2}>Players may freely choose letters</span>
            </div>
          )}

          {/* Seat Grid */}
          <div className="flex gap-2 flex-wrap">
            {players.map(p => {
              const haschosen = seatsThatChose.includes(p.seatNumber);
              return (
                <div key={p.playerId}
                  className="px-3 py-2 rounded-lg border text-center min-w-[60px]"
                  style={{
                    borderColor: haschosen ? '#4ade80' : '#ffffff20',
                    background: haschosen ? '#4ade8010' : 'transparent',
                  }}>
                  <div className="text-[7px] text-white/30" style={PS2}>SEAT</div>
                  <div className="text-sm mt-0.5" style={{ ...PS2, color: haschosen ? '#4ade80' : '#ffffff60' }}>{p.seatNumber}</div>
                  {haschosen && <div className="text-[6px] text-green-400 mt-0.5" style={PS2}>✓ chose</div>}
                  {!haschosen && isPlaying && <div className="text-[6px] text-[#FF5F1F]/70 mt-0.5" style={PS2}>waiting</div>}
                </div>
              );
            })}
          </div>

          {/* Last action */}
          {lastAction && (
            <div className="px-3 py-2 rounded-lg border border-white/10 bg-black/40">
              <div className="text-[7px] tracking-widest text-white/30 uppercase mb-1" style={PS2}>Last Action</div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/60" style={PS2}>
                  Seat {lastAction.seatNumber} chose
                </span>
                <span className="text-sm font-bold text-[#FFD700]" style={PS2}>{lastAction.letter}</span>
                <span className="text-[8px]" style={{ ...PS2, color: lastAction.result === 'correct' ? '#4ade80' : '#ef4444' }}>
                  {lastAction.result === 'correct' ? '✓ CORRECT' : '✗ WRONG'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WORD SETUP ── */}
      <div className="p-5 border border-[#FFD700]/30 rounded-xl bg-black/60">
        <h2 className="text-[10px] tracking-[0.15em] text-[#FFD700] uppercase mb-4" style={PS2}>
          {isSetup ? '⚙ Word Setup' : '🔤 Active Word'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[8px] tracking-widest text-white/50 uppercase mb-2" style={PS2}>Secret Word</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#FFD700]/40 text-[#FFD700] font-mono text-xl tracking-[0.3em] uppercase focus:border-[#FFD700] focus:outline-none transition-colors"
              value={gs.secret_word || ''}
              onChange={(e) => updateState({ secret_word: e.target.value.toUpperCase() })}
              placeholder="ENTER WORD"
            />
          </div>
          <div>
            <label className="block text-[8px] tracking-widest text-white/50 uppercase mb-2" style={PS2}>Category</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/30 text-white text-sm focus:border-[#BC13FE] focus:outline-none transition-colors"
              value={gs.category || ''}
              onChange={(e) => updateState({ category: e.target.value })}
              placeholder="e.g. Movies, Animals, Places…"
            />
          </div>
          <div>
            <label className="block text-[8px] tracking-widest text-white/50 uppercase mb-2" style={PS2}>Hint</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#FF5F1F]/30 text-white text-sm focus:border-[#FF5F1F] focus:outline-none transition-colors"
              value={gs.hint || ''}
              onChange={(e) => updateState({ hint: e.target.value })}
              placeholder="Hint for players…"
            />
          </div>
        </div>
      </div>

      {/* ── GAME BOARD (while playing or finished) ── */}
      {(isPlaying || gs.phase === 'finished') && secretWord && (
        <div className="p-5 border border-[#FFD700]/30 rounded-xl bg-black/60 flex flex-col items-center gap-4">
          {/* Hangman SVG + wrong count */}
          <div className="flex items-center gap-8">
            <HangmanSVG wrongCount={wrongCount} />
            <div className="text-center">
              <div className="text-4xl" style={{ ...PS2, color: wrongCount >= maxWrong ? '#ef4444' : '#FF5F1F' }}>{wrongCount}</div>
              <div className="text-[7px] tracking-widest text-white/40 uppercase mt-1" style={PS2}>Wrong</div>
              <div className="text-[9px] text-white/20 mt-1" style={PS2}>/ {maxWrong}</div>
            </div>
          </div>
          {/* Masked Word */}
          <div className="flex gap-2 flex-wrap justify-center">
            {secretWord.split('').map((ch, i) => {
              const revealed = ch === ' ' || guessed.includes(ch) || gs.word_revealed;
              return ch === ' ' ? (
                <div key={i} className="w-3" />
              ) : (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold min-w-[1.5ch] text-center"
                    style={{ ...PS2, color: revealed ? '#FFD700' : '#ffffff30', textShadow: revealed ? '0 0 12px rgba(255,215,0,0.5)' : 'none' }}>
                    {revealed ? ch : '_'}
                  </span>
                  <div className="w-full h-0.5 bg-[#FFD700]/30 rounded" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GAME STATUS (while playing) ── */}
      {isPlaying && (
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Guessed</div>
            <div className="text-2xl text-[#BC13FE]" style={PS2}>{(gs.guessed_letters || []).length}</div>
          </div>
          <div>
            <div className="text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Wrong</div>
            <div className="text-2xl" style={{ ...PS2, color: wrongCount >= maxWrong ? '#ef4444' : '#FF5F1F' }}>
              {wrongCount}/{maxWrong}
            </div>
          </div>
          <div>
            <div className="text-[7px] tracking-widest text-white/40 uppercase mb-1" style={PS2}>Hint</div>
            <div className="text-2xl" style={{ ...PS2, color: gs.hint_revealed ? '#4ade80' : '#ffffff30' }}>
              {gs.hint_revealed ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>
      )}

      {/* ── ALPHABET KEYBOARD (host override) ── */}
      {isPlaying && (
        <div className="p-4 border border-[#FFD700]/20 rounded-xl bg-black/60">
          <h3 className="text-[8px] tracking-[0.2em] text-white/30 uppercase mb-3" style={PS2}>Host Override — Guess a Letter</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {ALPHABET.map((letter) => {
              const isWrong = wrong.includes(letter);
              const isCorrect = guessed.includes(letter);
              const used = isWrong || isCorrect;
              return (
                <button
                  key={letter}
                  onClick={() => guessLetter(letter)}
                  disabled={used}
                  className="w-9 h-9 rounded-lg border-2 text-sm tracking-widest transition-all active:scale-90 disabled:cursor-not-allowed"
                  style={{
                    ...PS2,
                    borderColor: isWrong ? '#ef4444' : isCorrect ? '#4ade80' : '#FFD700',
                    color: isWrong ? '#ef4444' : isCorrect ? '#4ade80' : '#FFD700',
                    background: isWrong ? '#ef444415' : isCorrect ? '#4ade8015' : 'transparent',
                    opacity: used ? 0.4 : 1,
                    textDecoration: isWrong ? 'line-through' : 'none',
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CONTROLS ── */}
      <div className="space-y-3">
        {isSetup && (
          <Btn onClick={startGame} color="#4ade80" size="lg" className="w-full" disabled={!gs.secret_word?.trim()}>
            ▶ START GAME
          </Btn>
        )}
        {isPlaying && (
          <>
            <Btn onClick={revealHint} color="#BC13FE" size="lg" className="w-full" disabled={gs.hint_revealed || !gs.hint?.trim()}>
              💡 {gs.hint_revealed ? 'Hint Revealed' : 'Reveal Hint'}
            </Btn>
            <Btn onClick={revealWord} color="#FF5F1F" size="lg" className="w-full">
              👁 Reveal Word
            </Btn>
            <Btn onClick={resetRound} color="#FFD700" size="lg" className="w-full">
              ↺ Reset Round
            </Btn>
          </>
        )}
        {gs.phase === 'finished' && (
          <div className="p-4 border border-green-400/30 rounded-xl bg-green-400/5 text-center">
            <p className="text-[10px] tracking-widest text-green-400 uppercase" style={PS2}>Round Complete</p>
            <p className="font-mono text-xl text-[#FFD700] mt-2 tracking-widest">{gs.secret_word}</p>
          </div>
        )}
        <Btn onClick={newGame} color="#ffffff" size="lg" className="w-full">✦ New Game</Btn>
      </div>
    </div>
  );
}