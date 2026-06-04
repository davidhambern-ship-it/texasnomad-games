import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const Btn = ({ children, onClick, color = '#BC13FE', size = 'md', className = '', disabled = false }) => {
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

const sty = { fontFamily: "'Press Start 2P', monospace" };

export default function BFFHostPanel({ gs, updateState, sendCommand }) {
  const [surveys, setSurveys] = useState([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [family1Input, setFamily1Input] = useState(gs.family1 || '');
  const [family2Input, setFamily2Input] = useState(gs.family2 || '');
  const [answerInput, setAnswerInput] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const isSetup = !gs.phase || gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing';
  const answers = gs.answers || [];
  const currentSurveyIdx = gs.current_survey_idx ?? 0;
  const players = gs.players || [];
  const faceoffMode = gs.faceoff_mode || false;
  const buzzWinner = gs.buzz_winner || null;

  // Split players by family
  const family1Players = players.filter(p => p.familyTeam === 1 || p.familyTeam === '1');
  const family2Players = players.filter(p => p.familyTeam === 2 || p.familyTeam === '2');

  useEffect(() => {
    setLoadingSurveys(true);
    base44.entities.BFFSurvey.list().then(setSurveys).finally(() => setLoadingSurveys(false));
  }, []);

  const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const checkAnswer = async (guess) => {
    if (!guess.trim() || answers.length === 0) return;
    const cleanGuess = normalize(guess);
    const matchIdx = answers.findIndex((a) => {
      const cleanAns = normalize(a.answer || a.text);
      return cleanAns === cleanGuess ||
        (cleanAns.length >= 4 && cleanGuess.includes(cleanAns)) ||
        (cleanGuess.length >= 4 && cleanAns.includes(cleanGuess));
    });
    if (matchIdx === -1) {
      setCheckResult({ type: 'miss', message: `"${guess}" — NOT on the board` });
    } else if (answers[matchIdx].revealed) {
      setCheckResult({ type: 'warn', message: `Already revealed: "${answers[matchIdx].text || answers[matchIdx].answer}"` });
    } else {
      setCheckResult({ type: 'hit', message: `✓ Match: "${answers[matchIdx].text || answers[matchIdx].answer}" — ${answers[matchIdx].points} pts. Click it to reveal.` });
    }
    setAnswerInput('');
    setTimeout(() => setCheckResult(null), 5000);
  };

  const revealAnswer = async (idx) => {
    if (answers[idx].revealed) return;
    const ans = answers[idx];
    const newAnswers = answers.map((a, i) => i === idx ? { ...a, revealed: true } : a);
    const newBank = (gs.round_bank || 0) + (ans.points || 0);
    await updateState({ answers: newAnswers, round_bank: newBank });
  };

  const hideAnswer = async (idx) => {
    if (!answers[idx].revealed) return;
    const newAnswers = answers.map((a, i) => i === idx ? { ...a, revealed: false } : a);
    const newBank = Math.max(0, (gs.round_bank || 0) - (answers[idx].points || 0));
    await updateState({ answers: newAnswers, round_bank: newBank });
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setCheckResult({ type: 'warn', message: 'Voice needs Chrome/Edge' }); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => { setIsListening(false); };
    r.onresult = (e) => { const t = e.results[0][0].transcript.trim(); setAnswerInput(t); checkAnswer(t); };
    recognitionRef.current = r; r.start();
  };

  // Auto-select faceoff players: next unselected player per family (rotate)
  const getNextFaceoffPlayer = (familyPlayers, currentFaceoffId) => {
    if (!familyPlayers.length) return null;
    const idx = familyPlayers.findIndex(p => p.playerId === currentFaceoffId);
    return familyPlayers[(idx + 1) % familyPlayers.length];
  };

  const startGame = async () => {
    if (!family1Input.trim() || !family2Input.trim()) return;
    const firstSurvey = surveys[0];
    // Auto-pick faceoff players
    const f1 = family1Players[0] || null;
    const f2 = family2Players[0] || null;
    await updateState({
      phase: 'playing',
      status: 'active',
      family1: family1Input.trim(),
      family2: family2Input.trim(),
      score1: 0, score2: 0,
      active_turn: 1,
      round_bank: 0,
      round: 1,
      current_survey_idx: 0,
      current_question: firstSurvey?.question || '',
      answers: firstSurvey ? firstSurvey.answers.map(a => ({ text: a.answer || a.text, points: a.points, revealed: false })) : [],
      last_submission: null,
      faceoff_mode: true,
      faceoff_player1_id: f1?.playerId || null,
      faceoff_player2_id: f2?.playerId || null,
      buzz_winner: null,
      byes: 0,
    });
  };

  const startFaceoff = async () => {
    // Rotate faceoff players
    const f1 = getNextFaceoffPlayer(family1Players, gs.faceoff_player1_id);
    const f2 = getNextFaceoffPlayer(family2Players, gs.faceoff_player2_id);
    await updateState({
      faceoff_mode: true,
      buzz_winner: null,
      last_submission: null,
      faceoff_player1_id: f1?.playerId || gs.faceoff_player1_id || null,
      faceoff_player2_id: f2?.playerId || gs.faceoff_player2_id || null,
    });
  };

  const endFaceoff = async () => {
    await updateState({ faceoff_mode: false });
  };

  const clearBuzz = async () => {
    await updateState({ buzz_winner: null });
  };

  const loadSurvey = async (idx) => {
    const survey = surveys[idx];
    if (!survey) return;
    await updateState({
      current_survey_idx: idx,
      current_question: survey.question,
      answers: survey.answers.map(a => ({ text: a.answer || a.text, points: a.points, revealed: false })),
      round_bank: 0,
      faceoff_mode: true,
      buzz_winner: null,
      last_submission: null,
    });
  };

  const revealAll = async () => {
    const totalPoints = answers.reduce((sum, a) => sum + (a.revealed ? 0 : (a.points || 0)), 0);
    await updateState({ answers: answers.map(a => ({ ...a, revealed: true })), round_bank: (gs.round_bank || 0) + totalPoints });
  };

  const nextSurvey = async () => { await loadSurvey((currentSurveyIdx + 1) % surveys.length); };
  const prevSurvey = async () => { await loadSurvey((currentSurveyIdx - 1 + surveys.length) % surveys.length); };

  const awardBank = async (family) => {
    const bank = gs.round_bank || 0;
    if (bank === 0) return;
    const key = family === 1 ? 'score1' : 'score2';
    await updateState({ [key]: (gs[key] || 0) + bank, round_bank: 0 });
  };

  const newGame = async () => {
    await updateState({
      phase: 'setup', score1: 0, score2: 0,
      active_turn: 1, round_bank: 0,
      current_question: '', answers: [], round: 1, current_survey_idx: 0,
      last_submission: null, faceoff_mode: false, buzz_winner: null, byes: 0,
    });
  };

  const addBye = async () => {
    await updateState({ byes: (gs.byes || 0) + 1 });
  };
  const clearByes = async () => { await updateState({ byes: 0 }); };

  const setFaceoffPlayer = async (family, playerId) => {
    const key = family === 1 ? 'faceoff_player1_id' : 'faceoff_player2_id';
    await updateState({ [key]: playerId });
  };

  // Helper to find player by id
  const getPlayer = (id) => players.find(p => p.playerId === id);
  const getFaceoff1 = () => getPlayer(gs.faceoff_player1_id);
  const getFaceoff2 = () => getPlayer(gs.faceoff_player2_id);

  // ── SETUP SCREEN ──
  if (isSetup) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="p-6 border border-[#BC13FE]/30 rounded-xl bg-black/60" style={{ boxShadow: '0 0 20px rgba(188,19,254,0.1)' }}>
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase mb-6 text-center">⚙ Enter Family Names</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family 1 Name</label>
              <input className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none"
                value={family1Input} onChange={(e) => setFamily1Input(e.target.value)} placeholder="e.g. The Smiths" onKeyDown={(e) => e.key === 'Enter' && startGame()} />
            </div>
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family 2 Name</label>
              <input className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none"
                value={family2Input} onChange={(e) => setFamily2Input(e.target.value)} placeholder="e.g. The Johnsons" onKeyDown={(e) => e.key === 'Enter' && startGame()} />
            </div>
          </div>
          {/* Player roster preview */}
          {players.length > 0 && (
            <div className="mb-5 p-3 border border-white/10 rounded-lg bg-black/40 space-y-2">
              <div className="text-[9px] tracking-widest text-white/40 uppercase mb-2" style={sty}>{players.length} Player{players.length !== 1 ? 's' : ''} in lobby</div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <div key={p.playerId} className="px-2 py-1 rounded border text-[8px]" style={{ ...sty, borderColor: '#BC13FE40', color: '#BC13FEaa' }}>
                    SEAT {p.seatNumber}
                  </div>
                ))}
              </div>
            </div>
          )}
          {loadingSurveys
            ? <div className="text-center font-heading text-xs tracking-widest text-white/40 uppercase py-3">Loading surveys…</div>
            : <div className="mb-4 text-center font-heading text-xs tracking-widest text-white/40 uppercase">{surveys.length} surveys ready</div>
          }
          <Btn onClick={startGame} color="#4ade80" size="lg" className="w-full"
            disabled={!family1Input.trim() || !family2Input.trim() || surveys.length === 0}>
            ▶ START GAME
          </Btn>
        </div>
      </div>
    );
  }

  // ── PLAYING ──
  if (isPlaying) {
    const fo1 = getFaceoff1();
    const fo2 = getFaceoff2();
    const lastSub = gs.last_submission;
    const buzzWinnerPlayer = buzzWinner ? getPlayer(buzzWinner.playerId) : null;

    return (
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Round + Faceoff Status Bar */}
        <div className="p-4 border rounded-xl bg-black/60 flex flex-wrap items-center gap-4 justify-between"
          style={{ borderColor: faceoffMode ? '#FF5F1F' : '#BC13FE30', boxShadow: faceoffMode ? '0 0 15px rgba(255,95,31,0.2)' : 'none' }}>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-[8px] tracking-widest text-white/40 uppercase" style={sty}>Round</div>
              <div className="font-heading text-2xl text-[#FFD700]">{gs.round || 1}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className={`px-3 py-1 rounded border text-[9px] tracking-widest uppercase ${faceoffMode ? 'border-[#FF5F1F] text-[#FF5F1F] bg-[#FF5F1F]/10' : 'border-white/20 text-white/30'}`} style={sty}>
              {faceoffMode ? '⚡ FACEOFF MODE' : 'PLAYING'}
            </div>
            {gs.byes > 0 && (
              <div className="px-3 py-1 rounded border border-red-500/40 text-red-400 text-[9px] tracking-widest uppercase" style={sty}>
                BYE x{gs.byes}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!faceoffMode
              ? <Btn onClick={startFaceoff} color="#FF5F1F" size="sm">⚡ Start Faceoff</Btn>
              : <Btn onClick={endFaceoff} color="#ffffff" size="sm">End Faceoff</Btn>
            }
            <Btn onClick={addBye} color="#ef4444" size="sm">+ BYE</Btn>
            {gs.byes > 0 && <Btn onClick={clearByes} color="#ef444450" size="sm">Clear Byes</Btn>}
          </div>
        </div>

        {/* Faceoff Players */}
        {faceoffMode && (
          <div className="p-4 border border-[#FF5F1F]/40 rounded-xl bg-black/60 space-y-3">
            <h3 className="font-heading text-xs tracking-[0.2em] text-[#FF5F1F]/70 uppercase">⚡ Faceoff Players</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Family 1 faceoff */}
              <div>
                <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-2" style={sty}>{gs.family1 || 'Family 1'}</div>
                {family1Players.length === 0
                  ? <div className="text-[8px] text-white/20 py-2" style={sty}>No players yet</div>
                  : <div className="flex flex-wrap gap-2">
                      {family1Players.map(p => {
                        const selected = gs.faceoff_player1_id === p.playerId;
                        return (
                          <button key={p.playerId} onClick={() => setFaceoffPlayer(1, selected ? '' : p.playerId)}
                            className="px-3 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all"
                            style={{
                              borderColor: selected ? '#BC13FE' : '#BC13FE30',
                              color: selected ? '#BC13FE' : '#ffffff50',
                              background: selected ? '#BC13FE20' : 'transparent',
                              boxShadow: selected ? '0 0 10px rgba(188,19,254,0.3)' : 'none',
                            }}>
                            SEAT {p.seatNumber}
                            <span className="ml-1.5" style={{ color: p.connected !== false ? '#4ade80' : '#ef4444' }}>●</span>
                          </button>
                        );
                      })}
                    </div>
                }
                {fo1 && (
                  <div className="mt-2 px-2 py-1 rounded border border-[#BC13FE]/30 bg-[#BC13FE]/10 text-[8px] text-[#BC13FE] text-center" style={sty}>
                    ⚡ SEAT {fo1.seatNumber} in faceoff
                  </div>
                )}
              </div>
              {/* Family 2 faceoff */}
              <div>
                <div className="text-[8px] tracking-widest text-[#FF5F1F]/70 uppercase mb-2" style={sty}>{gs.family2 || 'Family 2'}</div>
                {family2Players.length === 0
                  ? <div className="text-[8px] text-white/20 py-2" style={sty}>No players yet</div>
                  : <div className="flex flex-wrap gap-2">
                      {family2Players.map(p => {
                        const selected = gs.faceoff_player2_id === p.playerId;
                        return (
                          <button key={p.playerId} onClick={() => setFaceoffPlayer(2, selected ? '' : p.playerId)}
                            className="px-3 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all"
                            style={{
                              borderColor: selected ? '#FF5F1F' : '#FF5F1F30',
                              color: selected ? '#FF5F1F' : '#ffffff50',
                              background: selected ? '#FF5F1F20' : 'transparent',
                              boxShadow: selected ? '0 0 10px rgba(255,95,31,0.3)' : 'none',
                            }}>
                            SEAT {p.seatNumber}
                            <span className="ml-1.5" style={{ color: p.connected !== false ? '#4ade80' : '#ef4444' }}>●</span>
                          </button>
                        );
                      })}
                    </div>
                }
                {fo2 && (
                  <div className="mt-2 px-2 py-1 rounded border border-[#FF5F1F]/30 bg-[#FF5F1F]/10 text-[8px] text-[#FF5F1F] text-center" style={sty}>
                    ⚡ SEAT {fo2.seatNumber} in faceoff
                  </div>
                )}
              </div>
            </div>

            {/* Buzz Winner */}
            {buzzWinner ? (
              <div className="p-3 border-2 border-[#BC13FE] rounded-xl bg-[#BC13FE]/10 flex items-center justify-between"
                style={{ boxShadow: '0 0 20px rgba(188,19,254,0.3)' }}>
                <div>
                  <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={sty}>⚡ Buzz Winner</div>
                  <div className="font-heading text-xl text-white">
                    Seat {buzzWinner.seatNumber} — {buzzWinner.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')}
                  </div>
                  <div className="text-[8px] text-white/40 mt-0.5" style={sty}>{new Date(buzzWinner.timestamp).toLocaleTimeString()}</div>
                </div>
                <Btn onClick={clearBuzz} color="#ffffff" size="sm">Clear</Btn>
              </div>
            ) : (
              <div className="text-center text-[9px] tracking-widest text-white/20 uppercase py-2" style={sty}>
                No buzz yet — buzzer is open
              </div>
            )}
          </div>
        )}

        {/* Player Submission */}
        {lastSub && (
          <div className="p-4 border-2 border-[#22d3ee] rounded-xl bg-[#22d3ee]/10 flex items-center gap-3"
            style={{ boxShadow: '0 0 20px rgba(34,211,238,0.2)' }}>
            <div className="text-2xl">💬</div>
            <div className="flex-1">
              <div className="font-heading text-xs tracking-[0.2em] text-[#22d3ee]/70 uppercase mb-0.5">
                Seat {lastSub.seatNumber} ({lastSub.familyTeam === 1 ? gs.family1 : gs.family2}) answered:
              </div>
              <div className="font-heading text-xl text-white tracking-widest uppercase">"{lastSub.submittedAnswer}"</div>
              <div className="text-[8px] text-white/30 mt-0.5" style={sty}>{lastSub.inputMethod} · {new Date(lastSub.timestamp).toLocaleTimeString()}</div>
            </div>
            <Btn onClick={() => updateState({ last_submission: null })} color="#ffffff" size="sm">✕</Btn>
          </div>
        )}

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: gs.family1 || 'Family 1', score: gs.score1 || 0, key: 'score1', turn: 1, color: '#BC13FE' },
            { name: gs.family2 || 'Family 2', score: gs.score2 || 0, key: 'score2', turn: 2, color: '#FF5F1F' },
          ].map((f) => (
            <div key={f.key} className="p-4 border-2 rounded-xl text-center transition-all"
              style={{ borderColor: gs.active_turn === f.turn ? '#FFD700' : `${f.color}30`, background: gs.active_turn === f.turn ? '#FFD70010' : 'black' }}>
              <div className="font-heading text-lg tracking-widest text-white uppercase truncate">{f.name}</div>
              <div className="font-heading text-4xl text-[#FFD700] mt-1">{f.score}</div>
              {gs.active_turn === f.turn && <div className="mt-1 text-[10px] tracking-widest text-[#FFD700] font-heading uppercase" style={sty}>▶ Active Turn</div>}
              <div className="flex gap-2 mt-3 justify-center">
                <button onClick={() => updateState({ [f.key]: Math.max(0, f.score - 100) })} className="px-3 py-1.5 rounded border border-red-500/40 text-red-400 font-heading text-sm hover:bg-red-500/20 transition-all">-100</button>
                <button onClick={() => updateState({ [f.key]: f.score + 100 })} className="px-3 py-1.5 rounded border border-green-500/40 text-green-400 font-heading text-sm hover:bg-green-500/20 transition-all">+100</button>
              </div>
            </div>
          ))}
        </div>

        {/* Active Turn */}
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-2">
          <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Active Turn</h3>
          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={() => updateState({ active_turn: 1 })} color={gs.active_turn === 1 ? '#FFD700' : '#BC13FE'}>{gs.family1 || 'Family 1'}</Btn>
            <Btn onClick={() => updateState({ active_turn: 2 })} color={gs.active_turn === 2 ? '#FFD700' : '#FF5F1F'}>{gs.family2 || 'Family 2'}</Btn>
          </div>
        </div>

        {/* Round Bank */}
        <div className="p-4 border border-[#FF5F1F]/30 rounded-xl bg-black/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-heading text-sm tracking-widest text-white/60 uppercase">Round Bank</span>
            <div className="flex items-center gap-3">
              <button onClick={() => updateState({ round_bank: Math.max(0, (gs.round_bank || 0) - 50) })} className="w-8 h-8 rounded border border-white/20 text-white/60 hover:border-white/50 hover:text-white transition-all font-heading text-lg">-</button>
              <span className="font-heading text-2xl text-[#FF5F1F] w-16 text-center">{gs.round_bank || 0}</span>
              <button onClick={() => updateState({ round_bank: (gs.round_bank || 0) + 50 })} className="w-8 h-8 rounded border border-white/20 text-white/60 hover:border-white/50 hover:text-white transition-all font-heading text-lg">+</button>
            </div>
          </div>
          {(gs.round_bank || 0) > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => awardBank(1)} className="py-2 rounded-lg border-2 border-[#BC13FE] text-[#BC13FE] font-heading text-xs tracking-widest uppercase hover:bg-[#BC13FE]/20 transition-all">
                Award → {gs.family1 || 'Family 1'}
              </button>
              <button onClick={() => awardBank(2)} className="py-2 rounded-lg border-2 border-[#FF5F1F] text-[#FF5F1F] font-heading text-xs tracking-widest uppercase hover:bg-[#FF5F1F]/20 transition-all">
                Award → {gs.family2 || 'Family 2'}
              </button>
            </div>
          )}
        </div>

        {/* Answer Checker */}
        <div className="p-4 border border-[#22d3ee]/30 rounded-xl bg-black/60 space-y-3">
          <h3 className="font-heading text-xs tracking-[0.2em] text-[#22d3ee]/70 uppercase">Check Player Answer</h3>
          <div className="flex gap-2">
            <input className="flex-1 px-4 py-3 rounded-lg bg-black/80 border-2 border-[#22d3ee]/30 text-white font-body text-base focus:border-[#22d3ee] focus:outline-none"
              value={answerInput} onChange={(e) => setAnswerInput(e.target.value)}
              placeholder="Type player's answer..." onKeyDown={(e) => e.key === 'Enter' && checkAnswer(answerInput)} autoComplete="off" />
            <button onClick={toggleVoice}
              className={`px-4 py-3 rounded-lg border-2 font-heading text-lg transition-all ${isListening ? 'border-red-500 text-red-400 bg-red-500/20' : 'border-[#22d3ee]/40 text-[#22d3ee]/70 hover:bg-[#22d3ee]/10'}`}>
              {isListening ? '🔴' : '🎙'}
            </button>
            <button onClick={() => checkAnswer(answerInput)} className="px-4 py-3 rounded-lg border-2 border-[#22d3ee] text-[#22d3ee] font-heading text-sm tracking-widest uppercase hover:bg-[#22d3ee]/20 transition-all">CHECK</button>
          </div>
          {checkResult && (
            <div className={`px-4 py-2 rounded-lg font-heading text-sm tracking-wide ${checkResult.type === 'hit' ? 'bg-green-500/20 text-green-400 border border-green-500/40' : checkResult.type === 'miss' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'}`}>
              {checkResult.message}
            </div>
          )}
        </div>

        {/* Survey Selector */}
        <div className="p-4 border border-[#FFD700]/30 rounded-xl bg-black/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Survey {currentSurveyIdx + 1} / {surveys.length}</h3>
            <div className="flex gap-2">
              <Btn onClick={prevSurvey} color="#BC13FE" size="sm" disabled={surveys.length <= 1}>◀ Prev</Btn>
              <Btn onClick={nextSurvey} color="#BC13FE" size="sm" disabled={surveys.length <= 1}>Next ▶</Btn>
            </div>
          </div>
          {gs.current_question && (
            <div className="px-4 py-3 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 font-heading text-base text-[#FFD700] tracking-wide">★ {gs.current_question}</div>
          )}
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {surveys.map((s, i) => (
              <button key={s.id} onClick={() => loadSurvey(i)}
                className="w-full text-left px-3 py-2 rounded-lg font-heading text-xs tracking-wide transition-all border"
                style={{ borderColor: i === currentSurveyIdx ? '#FFD700' : '#ffffff15', background: i === currentSurveyIdx ? '#FFD70015' : 'transparent', color: i === currentSurveyIdx ? '#FFD700' : '#ffffff60' }}>
                {i + 1}. {s.question}
              </button>
            ))}
          </div>
        </div>

        {/* Host Answer Board */}
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Answer Board — click to reveal</h3>
            {answers.some(a => !a.revealed) && <Btn onClick={revealAll} color="#4ade80" size="sm">Reveal All</Btn>}
          </div>
          {answers.length > 0 ? (
            <div className="space-y-2">
              {answers.map((ans, i) => (
                <HostAnswerRow key={i} rank={i + 1} answer={ans} onReveal={() => revealAnswer(i)} onHide={() => hideAnswer(i)} />
              ))}
            </div>
          ) : (
            <div className="text-center font-heading text-xs tracking-widest text-white/20 uppercase py-4">Load a survey to see answers</div>
          )}
        </div>

        {/* Player Roster */}
        <PlayerRoster players={players} gs={gs} />

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={nextSurvey} color="#FF5F1F" size="lg" disabled={surveys.length <= 1}>▶ Next Survey</Btn>
          <Btn onClick={newGame} color="#ffffff" size="lg">↺ New Game</Btn>
        </div>

      </div>
    );
  }

  return null;
}

function PlayerRoster({ players, gs }) {
  const family1Players = players.filter(p => p.familyTeam === 1 || p.familyTeam === '1');
  const family2Players = players.filter(p => p.familyTeam === 2 || p.familyTeam === '2');
  const unassigned = players.filter(p => !p.familyTeam);

  return (
    <div className="p-4 border border-white/10 rounded-xl bg-black/40 space-y-4">
      <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Player Roster ({players.length})</h3>
      <div className="grid grid-cols-2 gap-4">
        <RosterColumn title={gs.family1 || 'Family 1'} color="#BC13FE" players={family1Players}
          faceoffId={gs.faceoff_player1_id} buzzWinnerId={gs.buzz_winner?.playerId} />
        <RosterColumn title={gs.family2 || 'Family 2'} color="#FF5F1F" players={family2Players}
          faceoffId={gs.faceoff_player2_id} buzzWinnerId={gs.buzz_winner?.playerId} />
      </div>
      {unassigned.length > 0 && (
        <div>
          <div className="text-[8px] tracking-widest text-white/30 uppercase mb-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>Unassigned ({unassigned.length})</div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(p => (
              <div key={p.playerId} className="px-2 py-1 rounded border border-white/20 text-white/40 text-[8px]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                SEAT {p.seatNumber}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RosterColumn({ title, color, players, faceoffId, buzzWinnerId }) {
  return (
    <div>
      <div className="text-[8px] tracking-widest uppercase mb-2" style={{ color, fontFamily: "'Press Start 2P', monospace" }}>{title} ({players.length})</div>
      {players.length === 0
        ? <div className="text-[8px] text-white/20" style={{ fontFamily: "'Press Start 2P', monospace" }}>No players yet</div>
        : players.map(p => {
          const isFaceoff = p.playerId === faceoffId;
          const isBuzz = p.playerId === buzzWinnerId;
          return (
            <div key={p.playerId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 border"
              style={{ borderColor: isBuzz ? '#BC13FE' : isFaceoff ? color : '#ffffff10', background: isBuzz ? '#BC13FE10' : isFaceoff ? `${color}10` : 'transparent' }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.connected !== false ? '#4ade80' : '#ef4444' }} />
              <span className="text-[8px] text-white/80" style={{ fontFamily: "'Press Start 2P', monospace" }}>SEAT {p.seatNumber}</span>
              {isFaceoff && <span className="text-[7px] text-[#FF5F1F]" style={{ fontFamily: "'Press Start 2P', monospace" }}>⚡</span>}
              {isBuzz && <span className="text-[7px] text-[#BC13FE]" style={{ fontFamily: "'Press Start 2P', monospace" }}>BUZZ</span>}
            </div>
          );
        })
      }
    </div>
  );
}

function HostAnswerRow({ rank, answer, onReveal, onHide }) {
  const revealed = answer.revealed;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 cursor-pointer"
      style={{ borderColor: revealed ? '#FFD700' : '#BC13FE40', background: revealed ? 'rgba(255,215,0,0.1)' : 'rgba(188,19,254,0.05)', boxShadow: revealed ? '0 0 15px rgba(255,215,0,0.2)' : 'none' }}
      onClick={revealed ? onHide : onReveal} title={revealed ? 'Click to hide' : 'Click to reveal'}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-heading text-sm"
        style={{ background: revealed ? '#FFD700' : '#BC13FE30', color: revealed ? '#000' : '#BC13FE' }}>{rank}</div>
      <div className="flex-1 font-heading text-base tracking-wide uppercase" style={{ color: revealed ? '#FFD700' : '#ffffffcc' }}>
        {answer.text || answer.answer}
      </div>
      <div className="font-heading text-sm shrink-0" style={{ color: revealed ? '#FF5F1F' : '#FF5F1F80' }}>{answer.points} pts</div>
      <div className="px-2 py-1 rounded border font-heading text-[9px] tracking-widest uppercase shrink-0"
        style={{ borderColor: revealed ? '#FFD700' : '#BC13FE50', color: revealed ? '#FFD700' : '#BC13FE80', background: revealed ? '#FFD70015' : 'transparent' }}>
        {revealed ? '✓ REVEALED' : 'CLICK TO REVEAL'}
      </div>
    </div>
  );
}