import React, { useState } from 'react';

const Btn = ({ children, onClick, color = '#BC13FE', size = 'md', className = '', disabled = false }) => {
  const pad = size === 'lg' ? 'px-6 py-4 text-xl' : size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-heading tracking-widest uppercase rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 ${pad} ${className}`}
      style={{
        borderColor: color,
        color,
        background: 'transparent',
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = `${color}25`; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
};

const Toggle = ({ label, value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all w-full"
    style={{
      borderColor: value ? '#4ade80' : '#ffffff20',
      background: value ? '#4ade8015' : 'transparent',
    }}
  >
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${value ? 'border-green-400 bg-green-400/30' : 'border-white/30'}`}>
      {value && <span className="text-green-400 text-xs">✓</span>}
    </div>
    <span className="font-heading text-sm tracking-widest uppercase text-white/80">{label}</span>
    <span className={`ml-auto font-heading text-xs tracking-widest uppercase ${value ? 'text-green-400' : 'text-white/30'}`}>
      {value ? 'ON' : 'OFF'}
    </span>
  </button>
);

export default function BFFHostPanel({ gs, updateState, sendCommand }) {
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSetup = gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing';

  const startGame = async () => {
    await updateState({ phase: 'playing', status: 'active' });
  };

  const submitAnswer = async () => {
    if (!answerInput.trim()) return;
    setIsSubmitting(true);
    await sendCommand({ type: 'SUBMIT_ANSWER', answer: answerInput.trim() });
    setAnswerInput('');
    setIsSubmitting(false);
  };

  const revealAnswer = async () => {
    await sendCommand({ type: 'SPEAK_ANSWER' });
  };

  const clearNext = async () => {
    await sendCommand({ type: 'CLEAR_NEXT' });
    await updateState({ round_bank: 0 });
  };

  const newGame = async () => {
    await updateState({
      phase: 'setup',
      score1: 0, score2: 0,
      active_turn: 1, round_bank: 0,
      current_question: '', answers: [], round: 1,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── SETUP PHASE ── */}
      {isSetup && (
        <div className="p-5 border border-[#BC13FE]/30 rounded-xl bg-black/60"
          style={{ boxShadow: '0 0 20px rgba(188,19,254,0.1)' }}>
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase mb-5">⚙ Game Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family Name 1</label>
              <input
                className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none transition-colors"
                value={gs.family1 || ''}
                onChange={(e) => updateState({ family1: e.target.value })}
                placeholder="Family 1"
              />
            </div>
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family Name 2</label>
              <input
                className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none transition-colors"
                value={gs.family2 || ''}
                onChange={(e) => updateState({ family2: e.target.value })}
                placeholder="Family 2"
              />
            </div>
          </div>
          <Btn onClick={startGame} color="#4ade80" size="lg" className="w-full">
            ▶ START GAME
          </Btn>
        </div>
      )}

      {/* ── PLAYING PHASE ── */}
      {isPlaying && (
        <>
          {/* Family Names + Scores */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: gs.family1 || 'Family 1', score: gs.score1 || 0, key: 'score1', turn: 1 },
              { name: gs.family2 || 'Family 2', score: gs.score2 || 0, key: 'score2', turn: 2 },
            ].map((f) => (
              <div
                key={f.key}
                className="p-4 border-2 rounded-xl text-center transition-all"
                style={{
                  borderColor: gs.active_turn === f.turn ? '#FFD700' : '#BC13FE30',
                  background: gs.active_turn === f.turn ? '#FFD70010' : 'black',
                  boxShadow: gs.active_turn === f.turn ? '0 0 20px rgba(255,215,0,0.2)' : 'none',
                }}
              >
                <div className="font-heading text-lg tracking-widest text-white uppercase truncate">{f.name}</div>
                <div className="font-heading text-4xl text-[#FFD700] mt-1">{f.score}</div>
                {gs.active_turn === f.turn && (
                  <div className="mt-1 text-[10px] tracking-widest text-[#FFD700] font-heading uppercase">▶ Active Turn</div>
                )}
              </div>
            ))}
          </div>

          {/* Turn Controls */}
          <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60">
            <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase mb-3">Round Turn</h3>
            <div className="grid grid-cols-2 gap-3">
              <Btn
                onClick={() => updateState({ active_turn: 1 })}
                color={gs.active_turn === 1 ? '#FFD700' : '#BC13FE'}
                size="md"
              >
                {gs.family1 || 'Family 1'}
              </Btn>
              <Btn
                onClick={() => updateState({ active_turn: 2 })}
                color={gs.active_turn === 2 ? '#FFD700' : '#BC13FE'}
                size="md"
              >
                {gs.family2 || 'Family 2'}
              </Btn>
            </div>
          </div>

          {/* Round Bank */}
          <div className="p-4 border border-[#FF5F1F]/30 rounded-xl bg-black/60 flex items-center justify-between">
            <span className="font-heading text-sm tracking-widest text-white/60 uppercase">Round Bank</span>
            <div className="flex items-center gap-3">
              <button onClick={() => updateState({ round_bank: Math.max(0, (gs.round_bank || 0) - 50) })}
                className="w-8 h-8 rounded border border-white/20 text-white/60 hover:border-white/50 hover:text-white transition-all font-heading text-lg">-</button>
              <span className="font-heading text-2xl text-[#FF5F1F] w-16 text-center">{gs.round_bank || 0}</span>
              <button onClick={() => updateState({ round_bank: (gs.round_bank || 0) + 50 })}
                className="w-8 h-8 rounded border border-white/20 text-white/60 hover:border-white/50 hover:text-white transition-all font-heading text-lg">+</button>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle label="Sound" value={gs.sound_on !== false} onChange={(v) => updateState({ sound_on: v })} />
            <Toggle label="Dead Reveal" value={!!gs.dead_reveal} onChange={(v) => updateState({ dead_reveal: v })} />
          </div>

          {/* Answer Controls */}
          <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
            <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Answer Input</h3>
            <div className="flex gap-3">
              <input
                className="flex-1 px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none transition-colors"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="Type answer…"
                onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
              />
              <Btn onClick={revealAnswer} color="#BC13FE" size="md">Speak</Btn>
            </div>
            <Btn onClick={submitAnswer} color="#4ade80" size="md" className="w-full" disabled={isSubmitting || !answerInput.trim()}>
              SUBMIT ANSWER
            </Btn>
          </div>

          {/* Score Adjustments */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: gs.family1 || 'Family 1', key: 'score1', val: gs.score1 || 0 },
              { label: gs.family2 || 'Family 2', key: 'score2', val: gs.score2 || 0 },
            ].map((f) => (
              <div key={f.key} className="p-4 border border-white/10 rounded-xl bg-black/40">
                <p className="font-heading text-xs tracking-widest text-white/50 uppercase mb-3 truncate">{f.label} Score</p>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => updateState({ [f.key]: Math.max(0, f.val - 100) })}
                    className="flex-1 py-3 rounded-lg border-2 border-red-500/40 text-red-400 font-heading text-xl hover:bg-red-500/20 transition-all">
                    -100
                  </button>
                  <span className="font-heading text-2xl text-[#FFD700] w-14 text-center">{f.val}</span>
                  <button onClick={() => updateState({ [f.key]: f.val + 100 })}
                    className="flex-1 py-3 rounded-lg border-2 border-green-500/40 text-green-400 font-heading text-xl hover:bg-green-500/20 transition-all">
                    +100
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={clearNext} color="#FF5F1F" size="lg">
              ✕ Clear + Next
            </Btn>
            <Btn onClick={newGame} color="#ffffff" size="lg">
              ↺ New Game
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}