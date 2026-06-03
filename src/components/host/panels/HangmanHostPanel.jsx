import React from 'react';

const Btn = ({ children, onClick, color = '#FFD700', size = 'md', className = '', disabled = false }) => {
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

export default function HangmanHostPanel({ gs, updateState, sendCommand }) {
  const isSetup = !gs.phase || gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing';
  const wrongCount = (gs.wrong_letters || []).length;
  const maxWrong = gs.max_wrong || 6;

  const startGame = async () => {
    if (!gs.secret_word?.trim()) return;
    await updateState({
      phase: 'playing',
      hint_revealed: false,
      word_revealed: false,
      guessed_letters: [],
      wrong_letters: [],
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
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── WORD SETUP (always visible) ── */}
      <div className="p-5 border border-[#FFD700]/30 rounded-xl bg-black/60"
        style={{ boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}>
        <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase mb-5">
          {isSetup ? '⚙ Word Setup' : '🔤 Active Word'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Secret Word</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#FFD700]/40 text-[#FFD700] font-mono text-2xl tracking-[0.3em] uppercase focus:border-[#FFD700] focus:outline-none transition-colors"
              value={gs.secret_word || ''}
              onChange={(e) => updateState({ secret_word: e.target.value.toUpperCase() })}
              placeholder="ENTER WORD"
            />
          </div>
          <div>
            <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Category</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/30 text-white font-body text-base focus:border-[#BC13FE] focus:outline-none transition-colors"
              value={gs.category || ''}
              onChange={(e) => updateState({ category: e.target.value })}
              placeholder="e.g. Movies, Animals, Places…"
            />
          </div>
          <div>
            <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Hint</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#FF5F1F]/30 text-white font-body text-base focus:border-[#FF5F1F] focus:outline-none transition-colors"
              value={gs.hint || ''}
              onChange={(e) => updateState({ hint: e.target.value })}
              placeholder="Hint for players…"
            />
          </div>
        </div>
      </div>

      {/* ── GAME STATUS (while playing) ── */}
      {isPlaying && (
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="font-heading text-[10px] tracking-widest text-white/40 uppercase mb-1">Guessed</div>
            <div className="font-heading text-2xl text-[#BC13FE]">{(gs.guessed_letters || []).length}</div>
          </div>
          <div>
            <div className="font-heading text-[10px] tracking-widest text-white/40 uppercase mb-1">Wrong</div>
            <div className={`font-heading text-2xl ${wrongCount >= maxWrong ? 'text-red-500' : 'text-[#FF5F1F]'}`}>
              {wrongCount}/{maxWrong}
            </div>
          </div>
          <div>
            <div className="font-heading text-[10px] tracking-widest text-white/40 uppercase mb-1">Hint</div>
            <div className={`font-heading text-2xl ${gs.hint_revealed ? 'text-green-400' : 'text-white/30'}`}>
              {gs.hint_revealed ? 'SHOWN' : 'HIDDEN'}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTROLS ── */}
      <div className="space-y-3">
        {isSetup && (
          <Btn
            onClick={startGame}
            color="#4ade80"
            size="lg"
            className="w-full"
            disabled={!gs.secret_word?.trim()}
          >
            ▶ START GAME
          </Btn>
        )}

        {(isPlaying) && (
          <>
            <Btn
              onClick={revealHint}
              color="#BC13FE"
              size="lg"
              className="w-full"
              disabled={gs.hint_revealed || !gs.hint?.trim()}
            >
              💡 {gs.hint_revealed ? 'Hint Revealed' : 'Reveal Hint'}
            </Btn>
            <Btn
              onClick={revealWord}
              color="#FF5F1F"
              size="lg"
              className="w-full"
            >
              👁 Reveal Word
            </Btn>
            <Btn
              onClick={resetRound}
              color="#FFD700"
              size="lg"
              className="w-full"
            >
              ↺ Reset Round
            </Btn>
          </>
        )}

        {gs.phase === 'finished' && (
          <div className="p-4 border border-green-400/30 rounded-xl bg-green-400/5 text-center">
            <p className="font-heading text-lg tracking-widest text-green-400 uppercase">Round Complete</p>
            <p className="font-mono text-2xl text-[#FFD700] mt-1 tracking-widest">{gs.secret_word}</p>
          </div>
        )}

        <Btn onClick={newGame} color="#ffffff" size="lg" className="w-full">
          ✦ New Game
        </Btn>
      </div>
    </div>
  );
}