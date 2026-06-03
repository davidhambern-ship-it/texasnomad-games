import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const Btn = ({ children, onClick, color = '#BC13FE', size = 'md', className = '', disabled = false }) => {
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

export default function BFFHostPanel({ gs, updateState, sendCommand }) {
  const [surveys, setSurveys] = useState([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [family1Input, setFamily1Input] = useState(gs.family1 || '');
  const [family2Input, setFamily2Input] = useState(gs.family2 || '');

  const isSetup = gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing';
  const answers = gs.answers || [];
  const currentSurveyIdx = gs.current_survey_idx ?? 0;

  // Load surveys once
  useEffect(() => {
    setLoadingSurveys(true);
    base44.entities.BFFSurvey.filter({ active: true })
      .then(setSurveys)
      .finally(() => setLoadingSurveys(false));
  }, []);

  const startGame = async () => {
    if (!family1Input.trim() || !family2Input.trim()) return;
    // Pick first survey
    const firstSurvey = surveys[0];
    await updateState({
      phase: 'playing',
      status: 'active',
      family1: family1Input.trim(),
      family2: family2Input.trim(),
      score1: 0,
      score2: 0,
      active_turn: 1,
      round_bank: 0,
      round: 1,
      current_survey_idx: 0,
      current_question: firstSurvey?.question || '',
      answers: firstSurvey ? firstSurvey.answers.map(a => ({ text: a.answer || a.text, points: a.points, revealed: false })) : [],
    });
  };

  const loadSurvey = async (idx) => {
    const survey = surveys[idx];
    if (!survey) return;
    await updateState({
      current_survey_idx: idx,
      current_question: survey.question,
      answers: survey.answers.map(a => ({ text: a.answer || a.text, points: a.points, revealed: false })),
      round_bank: 0,
    });
  };

  const toggleReveal = async (idx) => {
    const newAnswers = answers.map((a, i) => i === idx ? { ...a, revealed: !a.revealed } : a);
    await updateState({ answers: newAnswers });
  };

  const revealAll = async () => {
    await updateState({ answers: answers.map(a => ({ ...a, revealed: true })) });
  };

  const nextSurvey = async () => {
    const nextIdx = (currentSurveyIdx + 1) % surveys.length;
    await loadSurvey(nextIdx);
  };

  const prevSurvey = async () => {
    const prevIdx = (currentSurveyIdx - 1 + surveys.length) % surveys.length;
    await loadSurvey(prevIdx);
  };

  const newGame = async () => {
    await updateState({
      phase: 'setup',
      score1: 0, score2: 0,
      active_turn: 1, round_bank: 0,
      current_question: '', answers: [], round: 1, current_survey_idx: 0,
    });
  };

  // ── SETUP ──
  if (isSetup) {
    return (
      <div className="max-w-md mx-auto space-y-5">
        <div className="p-6 border border-[#BC13FE]/30 rounded-xl bg-black/60"
          style={{ boxShadow: '0 0 20px rgba(188,19,254,0.1)' }}>
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase mb-6 text-center">⚙ Enter Family Names</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family 1 Name</label>
              <input
                className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none transition-colors"
                value={family1Input}
                onChange={(e) => setFamily1Input(e.target.value)}
                placeholder="e.g. The Smiths"
                onKeyDown={(e) => e.key === 'Enter' && startGame()}
              />
            </div>
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family 2 Name</label>
              <input
                className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none transition-colors"
                value={family2Input}
                onChange={(e) => setFamily2Input(e.target.value)}
                placeholder="e.g. The Johnsons"
                onKeyDown={(e) => e.key === 'Enter' && startGame()}
              />
            </div>
          </div>
          {loadingSurveys ? (
            <div className="text-center font-heading text-xs tracking-widest text-white/40 uppercase py-3">Loading surveys…</div>
          ) : (
            <div className="mb-4 text-center font-heading text-xs tracking-widest text-white/40 uppercase">
              {surveys.length} surveys ready
            </div>
          )}
          <Btn
            onClick={startGame}
            color="#4ade80"
            size="lg"
            className="w-full"
            disabled={!family1Input.trim() || !family2Input.trim() || surveys.length === 0}
          >
            ▶ START GAME
          </Btn>
        </div>
      </div>
    );
  }

  // ── PLAYING ──
  if (isPlaying) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: gs.family1 || 'Family 1', score: gs.score1 || 0, key: 'score1', turn: 1 },
            { name: gs.family2 || 'Family 2', score: gs.score2 || 0, key: 'score2', turn: 2 },
          ].map((f) => (
            <div key={f.key} className="p-4 border-2 rounded-xl text-center transition-all"
              style={{
                borderColor: gs.active_turn === f.turn ? '#FFD700' : '#BC13FE30',
                background: gs.active_turn === f.turn ? '#FFD70010' : 'black',
                boxShadow: gs.active_turn === f.turn ? '0 0 20px rgba(255,215,0,0.2)' : 'none',
              }}>
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
          <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase mb-3">Active Turn</h3>
          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={() => updateState({ active_turn: 1 })} color={gs.active_turn === 1 ? '#FFD700' : '#BC13FE'}>
              {gs.family1 || 'Family 1'}
            </Btn>
            <Btn onClick={() => updateState({ active_turn: 2 })} color={gs.active_turn === 2 ? '#FFD700' : '#BC13FE'}>
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

        {/* Current Survey */}
        <div className="p-4 border border-[#FFD700]/30 rounded-xl bg-black/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">
              Survey {currentSurveyIdx + 1} / {surveys.length}
            </h3>
            <div className="flex gap-2">
              <Btn onClick={prevSurvey} color="#BC13FE" size="sm" disabled={surveys.length <= 1}>◀ Prev</Btn>
              <Btn onClick={nextSurvey} color="#BC13FE" size="sm" disabled={surveys.length <= 1}>Next ▶</Btn>
            </div>
          </div>
          {gs.current_question && (
            <div className="px-4 py-3 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 font-heading text-base text-[#FFD700] tracking-wide">
              ★ {gs.current_question}
            </div>
          )}
          {/* Survey picker */}
          {surveys.length > 0 && (
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {surveys.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => loadSurvey(i)}
                  className="w-full text-left px-3 py-2 rounded-lg font-heading text-xs tracking-wide transition-all border"
                  style={{
                    borderColor: i === currentSurveyIdx ? '#FFD700' : '#ffffff15',
                    background: i === currentSurveyIdx ? '#FFD70015' : 'transparent',
                    color: i === currentSurveyIdx ? '#FFD700' : '#ffffff60',
                  }}
                >
                  {i + 1}. {s.question}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Answers */}
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Answers ({answers.length})</h3>
            {answers.length > 0 && <Btn onClick={revealAll} color="#4ade80" size="sm">Reveal All</Btn>}
          </div>
          {answers.length > 0 && (
            <div className="space-y-2">
              {answers.map((ans, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
                  style={{ borderColor: ans.revealed ? '#FFD700' : '#ffffff15', background: ans.revealed ? '#FFD70010' : '#00000060' }}>
                  <span className="font-heading text-sm text-[#FFD700] w-5 shrink-0">{i + 1}</span>
                  <span className="font-heading text-sm text-white flex-1 truncate">{ans.text}</span>
                  {ans.points > 0 && <span className="font-heading text-xs text-[#FF5F1F]">{ans.points}pts</span>}
                  <button onClick={() => toggleReveal(i)}
                    className="px-2 py-1 rounded border font-heading text-[10px] tracking-widest uppercase transition-all"
                    style={{ borderColor: ans.revealed ? '#FFD700' : '#ffffff30', color: ans.revealed ? '#FFD700' : '#ffffff60' }}>
                    {ans.revealed ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              ))}
            </div>
          )}
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

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={nextSurvey} color="#FF5F1F" size="lg" disabled={surveys.length <= 1}>
            ▶ Next Survey
          </Btn>
          <Btn onClick={newGame} color="#ffffff" size="lg">
            ↺ New Game
          </Btn>
        </div>
      </div>
    );
  }

  return null;
}