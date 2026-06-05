import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { pickFaceoffPlayers, getNextPlayer, getActivePlayers, getStealPlayer } from '@/lib/bffRotation';

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
const BYE_LETTERS = ['B', 'Y', 'E'];
const BYE_COLORS = ['#FF5F1F', '#BC13FE', '#FFD700'];

function HostBYEIndicator({ byeCount = 0 }) {
  return (
    <div className="flex items-center gap-3">
      {BYE_LETTERS.map((l, i) => (
        <div key={l} className="font-heading transition-all duration-300"
          style={{ ...sty, fontSize: '2rem', color: i < byeCount ? BYE_COLORS[i] : '#ffffff10', textShadow: i < byeCount ? `0 0 15px ${BYE_COLORS[i]}` : 'none' }}>
          {l}
        </div>
      ))}
      <span className="text-[9px] tracking-widest text-white/30 uppercase ml-2" style={sty}>{byeCount}/3</span>
    </div>
  );
}

// Generate a unique host-player ID
function genHostPlayerId(roomCode) {
  return `host_player_${roomCode}`;
}

export default function BFFHostPanel({ gs, updateState, sendCommand, roomCode }) {
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
  const byeCount = gs.bye_count || 0;
  const onPlayerMode = gs.one_player_mode || false;
  const stealMode = gs.steal_mode || false;
  const hostPlayerMode = gs.host_player_id ? true : false;

  // 2P mode: auto-detect 2 active participants
  const participantPlayers = players.filter(p => p.role === 'participant' || p.role === 'hostPlayer');
  const is2PMode = participantPlayers.length === 2;
  const byeCounts2P = gs.bye_counts_2p || {};

  const family1Players = getActivePlayers(players, 1);
  const family2Players = getActivePlayers(players, 2);
  const unassignedPlayers = players.filter(p => !p.familyTeam);

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
      return cleanAns === cleanGuess || (cleanAns.length >= 4 && cleanGuess.includes(cleanAns)) || (cleanGuess.length >= 4 && cleanAns.includes(cleanGuess));
    });
    if (matchIdx === -1) setCheckResult({ type: 'miss', message: `"${guess}" — NOT on the board` });
    else if (answers[matchIdx].revealed) setCheckResult({ type: 'warn', message: `Already revealed: "${answers[matchIdx].text || answers[matchIdx].answer}"` });
    else setCheckResult({ type: 'hit', message: `✓ Match: "${answers[matchIdx].text || answers[matchIdx].answer}" — ${answers[matchIdx].points} pts. Click it to reveal.` });
    setAnswerInput('');
    setTimeout(() => setCheckResult(null), 5000);
  };

  const revealAnswer = async (idx) => {
    if (answers[idx].revealed) return;
    const ans = answers[idx];
    const newAnswers = answers.map((a, i) => i === idx ? { ...a, revealed: true } : a);
    await updateState({ answers: newAnswers, round_bank: (gs.round_bank || 0) + (ans.points || 0) });
  };

  const hideAnswer = async (idx) => {
    if (!answers[idx].revealed) return;
    const newAnswers = answers.map((a, i) => i === idx ? { ...a, revealed: false } : a);
    await updateState({ answers: newAnswers, round_bank: Math.max(0, (gs.round_bank || 0) - (answers[idx].points || 0)) });
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setCheckResult({ type: 'warn', message: 'Voice needs Chrome/Edge' }); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => { const t = e.results[0][0].transcript.trim(); setAnswerInput(t); checkAnswer(t); };
    recognitionRef.current = r; r.start();
  };

  // Auto-select faceoff using rotation
  const autoPickFaceoff = () => {
    const { player1, player2, nextIdx1, nextIdx2 } = pickFaceoffPlayers(players, gs);
    return { player1, player2, nextIdx1, nextIdx2 };
  };

  const startGame = async (forceOnPlayerMode = false) => {
    if (!family1Input.trim() || !family2Input.trim()) return;
    const firstSurvey = surveys[0];
    const { player1, player2, nextIdx1, nextIdx2 } = autoPickFaceoff();
    const totalActive = players.filter(p => p.active !== false).length;
    const use1P = forceOnPlayerMode || totalActive <= 1;

    const use2P = !use1P && participantPlayers.length === 2;
    const initBye2P = {};
    if (use2P) participantPlayers.forEach(p => { initBye2P[p.playerId] = 0; });

    await updateState({
      phase: 'playing', status: 'active',
      family1: family1Input.trim(), family2: family2Input.trim(),
      score1: 0, score2: 0,
      active_turn: 1, round_bank: 0, round: 1,
      current_survey_idx: 0,
      current_question: firstSurvey?.question || '',
      answers: firstSurvey ? firstSurvey.answers.map(a => ({ text: a.answer || a.text, points: a.points, revealed: false })) : [],
      last_submission: null,
      faceoff_mode: !use1P && !use2P,
      faceoff_player1_id: player1?.playerId || null,
      faceoff_player2_id: player2?.playerId || null,
      faceoff_round_idx1: nextIdx1,
      faceoff_round_idx2: nextIdx2,
      buzz_winner: null,
      bye_count: 0, bye_flash: 0,
      one_player_mode: use1P,
      two_player_mode: use2P,
      bye_counts_2p: use2P ? initBye2P : {},
      answering_player_id: use1P ? (players[0]?.playerId || null) : (use2P ? (participantPlayers[0]?.playerId || null) : null),
      steal_mode: false, steal_player_id: null, steal_result: null,
    });
  };

  const startFaceoff = async () => {
    const { player1, player2, nextIdx1, nextIdx2 } = autoPickFaceoff();
    await updateState({
      faceoff_mode: true, buzz_winner: null, last_submission: null, answering_player_id: null,
      faceoff_player1_id: player1?.playerId || gs.faceoff_player1_id || null,
      faceoff_player2_id: player2?.playerId || gs.faceoff_player2_id || null,
      faceoff_round_idx1: nextIdx1 ?? gs.faceoff_round_idx1,
      faceoff_round_idx2: nextIdx2 ?? gs.faceoff_round_idx2,
      steal_mode: false, steal_player_id: null,
    });
  };

  const endFaceoff = async () => { await updateState({ faceoff_mode: false }); };
  const clearBuzz = async () => { await updateState({ buzz_winner: null, answering_player_id: null, current_typing: '' }); };

  const assignAnsweringPlayer = async (pid) => {
    const current = gs.answering_player_id;
    await updateState({ answering_player_id: current === pid ? null : pid, current_typing: '' });
  };

  // Advance rotation to next player in same family
  const advanceToNextPlayer = async (currentPlayerId, familyTeam) => {
    const next = getNextPlayer(players, familyTeam, currentPlayerId);
    const nextNext = next ? getNextPlayer(players, familyTeam, next.playerId) : null;
    await updateState({
      answering_player_id: next?.playerId || null,
      next_answering_player_id: nextNext?.playerId || null,
    });
  };

  // ── BYE controls ──
  const addByeStrike = async () => {
    const newCount = Math.min(3, byeCount + 1);
    await updateState({ bye_count: newCount, answering_player_id: null });
  };

  const removeByeStrike = async () => {
    await updateState({ bye_count: Math.max(0, byeCount - 1) });
  };

  const clearBye = async () => { await updateState({ bye_count: 0 }); };
  const triggerByeAnimation = async () => { await updateState({ bye_flash: Date.now() }); };

  // Mark wrong — auto BYE + auto advance rotation (supports 2P per-player BYE)
  const markWrong = async () => {
    const currentAnsweringId = gs.answering_player_id || gs.buzz_winner?.playerId;
    const currentFamilyTeam = gs.active_turn || 1;

    if (is2PMode && currentAnsweringId) {
      // 2P mode: increment this specific player's BYE count
      const playerByes = byeCounts2P[currentAnsweringId] || 0;
      const newPlayerByes = Math.min(3, playerByes + 1);
      const newBye2P = { ...byeCounts2P, [currentAnsweringId]: newPlayerByes };

      if (newPlayerByes >= 3) {
        // BYE complete for this player — auto-trigger steal by opponent
        const oppFam = currentFamilyTeam === 1 ? 2 : 1;
        const { player: stealPlayer, nextIdx, stealFamily } = getStealPlayer(players, currentFamilyTeam, gs) || {};
        await updateState({
          bye_counts_2p: newBye2P,
          bye_count: newPlayerByes,
          answering_player_id: stealPlayer?.playerId || null,
          buzz_winner: null,
          last_submission: gs.last_submission ? { ...gs.last_submission, result: 'wrong' } : null,
          steal_mode: !!stealPlayer,
          steal_player_id: stealPlayer?.playerId || null,
          steal_family: stealFamily || oppFam,
          steal_round_idx: nextIdx,
          steal_result: null,
          active_turn: stealFamily || oppFam,
        });
      } else {
        await updateState({
          bye_counts_2p: newBye2P,
          bye_count: newPlayerByes,
          buzz_winner: null,
          last_submission: gs.last_submission ? { ...gs.last_submission, result: 'wrong' } : null,
        });
      }
      return;
    }

    // Standard mode
    const newCount = Math.min(3, byeCount + 1);
    let nextPlayer = null;
    let nextNextPlayer = null;
    if (newCount < 3 && currentAnsweringId) {
      nextPlayer = getNextPlayer(players, currentFamilyTeam, currentAnsweringId);
      nextNextPlayer = nextPlayer ? getNextPlayer(players, currentFamilyTeam, nextPlayer.playerId) : null;
    }

    await updateState({
      bye_count: newCount,
      answering_player_id: nextPlayer?.playerId || null,
      next_answering_player_id: nextNextPlayer?.playerId || null,
      buzz_winner: null,
      last_submission: gs.last_submission ? { ...gs.last_submission, result: 'wrong' } : null,
      steal_mode: newCount >= 3 ? false : gs.steal_mode,
    });
  };

  // Trigger steal mode for opposing family
  const triggerSteal = async () => {
    const byeFamilyTeam = gs.active_turn || 1;
    const { player: stealPlayer, nextIdx, stealFamily } = getStealPlayer(players, byeFamilyTeam, gs) || {};
    if (!stealPlayer) return;
    await updateState({
      steal_mode: true,
      steal_player_id: stealPlayer.playerId,
      steal_family: stealFamily,
      steal_round_idx: nextIdx,
      answering_player_id: stealPlayer.playerId,
      active_turn: stealFamily,
      faceoff_mode: false,
    });
  };

  const endSteal = async () => {
    await updateState({ steal_mode: false, steal_player_id: null, answering_player_id: null });
  };

  const loadSurvey = async (idx) => {
    const survey = surveys[idx];
    if (!survey) return;
    const { player1, player2, nextIdx1, nextIdx2 } = autoPickFaceoff();
    const use1P = onPlayerMode;
    const use2P = is2PMode;
    const resetBye2P = {};
    if (use2P) participantPlayers.forEach(p => { resetBye2P[p.playerId] = 0; });

    await updateState({
      current_survey_idx: idx,
      current_question: survey.question,
      answers: survey.answers.map(a => ({ text: a.answer || a.text, points: a.points, revealed: false })),
      round_bank: 0,
      faceoff_mode: !use1P && !use2P,
      faceoff_player1_id: player1?.playerId || null,
      faceoff_player2_id: player2?.playerId || null,
      faceoff_round_idx1: nextIdx1 ?? gs.faceoff_round_idx1,
      faceoff_round_idx2: nextIdx2 ?? gs.faceoff_round_idx2,
      buzz_winner: null, last_submission: null,
      bye_count: 0, bye_flash: 0,
      bye_counts_2p: use2P ? resetBye2P : {},
      answering_player_id: use1P ? (players[0]?.playerId || null) : (use2P ? (participantPlayers[0]?.playerId || null) : null),
      pending_decision: null,
      steal_mode: false, steal_player_id: null, steal_result: null,
      next_answering_player_id: null,
    });
  };

  const revealAll = async () => {
    const extra = answers.reduce((sum, a) => sum + (a.revealed ? 0 : (a.points || 0)), 0);
    await updateState({ answers: answers.map(a => ({ ...a, revealed: true })), round_bank: (gs.round_bank || 0) + extra });
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
      phase: 'setup', score1: 0, score2: 0, active_turn: 1, round_bank: 0,
      current_question: '', answers: [], round: 1, current_survey_idx: 0,
      last_submission: null, faceoff_mode: false, buzz_winner: null,
      bye_count: 0, bye_flash: 0, one_player_mode: false, two_player_mode: false,
      bye_counts_2p: {},
      steal_mode: false, steal_player_id: null, steal_result: null, host_player_id: null,
      faceoff_round_idx1: -1, faceoff_round_idx2: -1, next_answering_player_id: null,
    });
  };

  const setFaceoffPlayer = async (family, pid) => {
    const key = family === 1 ? 'faceoff_player1_id' : 'faceoff_player2_id';
    await updateState({ [key]: pid });
  };

  // ── HOST SIT-IN ──
  const hostSitIn = async (familyTeam) => {
    const hostPid = genHostPlayerId(roomCode || 'room');
    const existingSeats = players.map(p => p.seatNumber || 0);
    const nextSeat = Math.max(0, ...existingSeats) + 1;
    const hostPlayer = {
      playerId: hostPid, seatNumber: nextSeat,
      familyTeam, role: 'hostPlayer', connected: true, active: true,
      lastActionAt: Date.now(),
    };
    const existing = players.find(p => p.playerId === hostPid);
    const updatedPlayers = existing
      ? players.map(p => p.playerId === hostPid ? { ...p, familyTeam, active: true } : p)
      : [...players, hostPlayer];
    await updateState({ players: updatedPlayers, host_player_id: hostPid });
  };

  const hostSitOut = async () => {
    const hostPid = genHostPlayerId(roomCode || 'room');
    await updateState({
      players: players.filter(p => p.playerId !== hostPid),
      host_player_id: null,
      answering_player_id: gs.answering_player_id === hostPid ? null : gs.answering_player_id,
    });
  };

  const getPlayer = (id) => players.find(p => p.playerId === id);
  const getFaceoff1 = () => getPlayer(gs.faceoff_player1_id);
  const getFaceoff2 = () => getPlayer(gs.faceoff_player2_id);

  // Setup screen
  if (isSetup) {
    const totalPlayers = players.length;
    const canStart1P = totalPlayers >= 1;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="p-6 border border-[#BC13FE]/30 rounded-xl bg-black/60" style={{ boxShadow: '0 0 20px rgba(188,19,254,0.1)' }}>
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase mb-6 text-center">⚙ Enter Family Names</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family 1 Name</label>
              <input className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none"
                value={family1Input} onChange={(e) => setFamily1Input(e.target.value)} placeholder="e.g. The Smiths" />
            </div>
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Family 2 Name</label>
              <input className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none"
                value={family2Input} onChange={(e) => setFamily2Input(e.target.value)} placeholder="e.g. The Johnsons" />
            </div>
          </div>

          {players.length > 0 && (
            <div className="mb-5 p-3 border border-white/10 rounded-lg bg-black/40 space-y-2">
              <div className="text-[9px] tracking-widest text-white/40 uppercase mb-2" style={sty}>{players.length} Player{players.length !== 1 ? 's' : ''} in lobby</div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <div key={p.playerId} className="px-2 py-1 rounded border text-[8px]" style={{ ...sty, borderColor: '#BC13FE40', color: '#BC13FEaa' }}>SEAT {p.seatNumber}</div>
                ))}
              </div>
            </div>
          )}

          {loadingSurveys
            ? <div className="text-center font-heading text-xs tracking-widest text-white/40 uppercase py-3">Loading surveys…</div>
            : <div className="mb-4 text-center font-heading text-xs tracking-widest text-white/40 uppercase">{surveys.length} surveys ready</div>
          }

          <div className="space-y-3">
            <Btn onClick={() => startGame(false)} color="#4ade80" size="lg" className="w-full"
              disabled={!family1Input.trim() || !family2Input.trim() || surveys.length === 0}>
              ▶ START GAME (FULL)
            </Btn>
            <Btn onClick={() => startGame(true)} color="#FFD700" size="lg" className="w-full"
              disabled={!family1Input.trim() || !family2Input.trim() || surveys.length === 0 || !canStart1P}>
              ⭐ START 1 PLAYER MODE
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // Playing screen
  if (isPlaying) {
    const fo1 = getFaceoff1();
    const fo2 = getFaceoff2();
    const lastSub = gs.last_submission;
    const nextAnsweringPlayer = gs.next_answering_player_id ? getPlayer(gs.next_answering_player_id) : null;
    const stealPlayer = gs.steal_player_id ? getPlayer(gs.steal_player_id) : null;
    const hostPid = genHostPlayerId(roomCode || 'room');
    const isHostSittingIn = !!gs.host_player_id;
    const hostPlayerRecord = players.find(p => p.playerId === hostPid);

    // Auto-calc 1P availability
    const activePlayers = players.filter(p => p.active !== false);
    const f1count = family1Players.length;
    const f2count = family2Players.length;
    const hostSitInFamily = f1count <= f2count ? 1 : 2;

    return (
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Status Bar */}
        <div className="p-4 border rounded-xl bg-black/60 flex flex-wrap items-center gap-3 justify-between"
          style={{ borderColor: faceoffMode ? '#FF5F1F' : onPlayerMode ? '#FFD700' : '#BC13FE30' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-center">
              <div className="text-[8px] tracking-widest text-white/40 uppercase" style={sty}>Round</div>
              <div className="font-heading text-2xl text-[#FFD700]">{gs.round || 1}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className={`px-3 py-1 rounded border text-[9px] tracking-widest uppercase`} style={{
              ...sty,
              borderColor: faceoffMode ? '#FF5F1F' : onPlayerMode ? '#FFD700' : is2PMode ? '#4ade80' : '#ffffff30',
              color: faceoffMode ? '#FF5F1F' : onPlayerMode ? '#FFD700' : is2PMode ? '#4ade80' : '#ffffff40',
            }}>
              {faceoffMode ? '⚡ FACEOFF' : onPlayerMode ? '⭐ 1P MODE' : stealMode ? '🎯 STEAL' : is2PMode ? '⚔ 2P MODE' : 'PLAYING'}
            </div>
            {is2PMode && gs.answering_player_id && (
              <div className="px-2 py-1 rounded border border-[#4ade80]/40 bg-[#4ade80]/5 text-[8px] text-[#4ade80] tracking-widest uppercase" style={sty}>
                SEAT {players.find(p => p.playerId === gs.answering_player_id)?.seatNumber || '?'} answering
              </div>
            )}
            {isHostSittingIn && (
              <div className="px-2 py-1 rounded border border-[#BC13FE]/50 bg-[#BC13FE]/10 text-[8px] text-[#BC13FE] tracking-widest uppercase" style={sty}>
                HOST IN GAME
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {!faceoffMode && !onPlayerMode && !stealMode && <Btn onClick={startFaceoff} color="#FF5F1F" size="sm">⚡ Faceoff</Btn>}
            {faceoffMode && <Btn onClick={endFaceoff} color="#ffffff" size="sm">End Faceoff</Btn>}
            {!onPlayerMode && <Btn onClick={() => updateState({ one_player_mode: true, faceoff_mode: false })} color="#FFD700" size="sm">⭐ 1P</Btn>}
            {onPlayerMode && <Btn onClick={() => updateState({ one_player_mode: false })} color="#ffffff40" size="sm">End 1P</Btn>}
          </div>
        </div>

        {/* ── HOST SIT-IN ── */}
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
          <h3 className="font-heading text-xs tracking-[0.2em] text-[#BC13FE]/80 uppercase">🎮 Host Sit-In</h3>
          {!isHostSittingIn ? (
            <div className="space-y-2">
              <div className="text-[8px] tracking-widest text-white/30 uppercase" style={sty}>
                Join as a player while keeping host controls
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn onClick={() => hostSitIn(1)} color="#BC13FE" size="sm">
                  Join {gs.family1 || 'Family 1'}
                </Btn>
                <Btn onClick={() => hostSitIn(2)} color="#FF5F1F" size="sm">
                  Join {gs.family2 || 'Family 2'}
                </Btn>
              </div>
              <Btn onClick={() => hostSitIn(hostSitInFamily)} color="#FFD700" size="sm" className="w-full">
                Auto-assign (smaller team)
              </Btn>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase mb-1" style={sty}>
                  You are playing as Seat {hostPlayerRecord?.seatNumber}
                </div>
                <div className="text-[7px] text-white/30 uppercase" style={sty}>
                  {hostPlayerRecord?.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')} — Host Player
                </div>
              </div>
              <Btn onClick={hostSitOut} color="#ef4444" size="sm">Sit Out</Btn>
            </div>
          )}
        </div>

        {/* ── BYE CONTROLS ── */}
        <div className="p-4 border-2 rounded-xl bg-black/60 space-y-3"
          style={{ borderColor: byeCount >= 3 ? '#FF5F1F' : byeCount > 0 ? '#FF5F1F60' : '#BC13FE30', boxShadow: byeCount >= 3 ? '0 0 20px rgba(255,95,31,0.3)' : 'none' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xs tracking-[0.2em] text-[#FF5F1F]/80 uppercase">
              BYE Strikes {is2PMode && <span className="text-[#4ade80]">— 2P Mode</span>}
            </h3>
            {byeCount >= 3 && (
              <div className="px-2 py-1 rounded border border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#FF5F1F] text-[8px] tracking-widest uppercase animate-pulse" style={sty}>BYE COMPLETE</div>
            )}
          </div>

          {/* 2P per-player BYE display */}
          {is2PMode ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { fam: 1, name: gs.family1 || 'Family 1', color: '#BC13FE' },
                { fam: 2, name: gs.family2 || 'Family 2', color: '#FF5F1F' },
              ].map(({ fam, name, color }) => {
                const fp = participantPlayers.find(p => Number(p.familyTeam) === fam);
                const pid = fp?.playerId;
                const byes = pid ? (byeCounts2P[pid] || 0) : 0;
                const isActive = gs.answering_player_id === pid;
                return (
                  <div key={fam} className="px-3 py-2 rounded-lg border text-center"
                    style={{ borderColor: byes >= 3 ? color : `${color}30`, background: isActive ? `${color}10` : 'transparent' }}>
                    <div className="text-[7px] tracking-widest uppercase mb-1" style={{ ...sty, color }}>{name}</div>
                    <div className="flex gap-1 justify-center mb-1">
                      {['B','Y','E'].map((l, i) => (
                        <span key={l} className="font-heading text-lg" style={{ ...sty, color: i < byes ? color : '#ffffff15' }}>{l}</span>
                      ))}
                    </div>
                    {isActive && <div className="text-[6px] text-[#4ade80] tracking-widest uppercase" style={sty}>▶ Answering</div>}
                    {byes >= 3 && <div className="text-[6px] animate-pulse tracking-widest uppercase" style={{ ...sty, color }}>BYE!</div>}
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="flex justify-center py-2">
            <HostBYEIndicator byeCount={byeCount} />
          </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={markWrong} color="#ef4444" size="sm" disabled={byeCount >= 3}>✗ Mark Wrong + BYE</Btn>
            <Btn onClick={addByeStrike} color="#ef4444" size="sm" disabled={byeCount >= 3}>+ BYE Strike</Btn>
            <Btn onClick={removeByeStrike} color="#FFD700" size="sm" disabled={byeCount === 0}>− Remove Strike</Btn>
            <Btn onClick={clearBye} color="#ffffff40" size="sm" disabled={byeCount === 0}>Clear BYE</Btn>
          </div>
          <Btn onClick={triggerByeAnimation} color="#FF5F1F" size="sm" className="w-full">🎬 Trigger BYE Animation</Btn>
          {byeCount >= 3 && !is2PMode && (
            <div className="space-y-2">
              <div className="px-3 py-2 rounded-lg border border-[#FF5F1F]/40 bg-[#FF5F1F]/10 text-center">
                <div className="text-[8px] tracking-widest text-[#FF5F1F] uppercase" style={sty}>BYE complete — prepare steal or award round</div>
              </div>
              <Btn onClick={triggerSteal} color="#FF5F1F" size="sm" className="w-full">🎯 Trigger Steal</Btn>
            </div>
          )}

          {/* 2P steal result */}
          {is2PMode && gs.steal_result && (
            <div className={`p-3 rounded-xl border text-center ${gs.steal_result === 'correct' ? 'border-green-400/50 bg-green-400/10' : 'border-red-500/50 bg-red-500/10'}`}>
              <div className="text-[8px] tracking-widest uppercase" style={{ ...sty, color: gs.steal_result === 'correct' ? '#4ade80' : '#ef4444' }}>
                {gs.steal_result === 'correct' ? '✓ Steal Correct — Award Bank!' : '✗ Steal Missed — Bank Lost'}
              </div>
            </div>
          )}

          {stealMode && stealPlayer && (
            <div className="p-3 border border-[#FF5F1F] rounded-xl bg-[#FF5F1F]/10 flex items-center justify-between">
              <div>
                <div className="text-[8px] text-[#FF5F1F] tracking-widest uppercase" style={sty}>🎯 Steal: Seat {stealPlayer.seatNumber}</div>
                <div className="text-[7px] text-white/30 uppercase mt-0.5" style={sty}>
                  {stealPlayer.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')}
                </div>
              </div>
              <Btn onClick={endSteal} color="#ffffff" size="sm">End Steal</Btn>
            </div>
          )}
        </div>

        {/* Faceoff Players */}
        {faceoffMode && (
          <div className="p-4 border border-[#FF5F1F]/40 rounded-xl bg-black/60 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xs tracking-[0.2em] text-[#FF5F1F]/70 uppercase">⚡ Faceoff Players</h3>
              <Btn onClick={startFaceoff} color="#FF5F1F" size="sm">↺ Rotate</Btn>
            </div>
            {fo1 && fo2 && (
              <div className="px-4 py-3 rounded-xl border border-[#FF5F1F]/40 bg-[#FF5F1F]/5 text-center">
                <div className="text-[8px] text-[#FF5F1F] tracking-widest uppercase" style={sty}>
                  SEAT {fo1.seatNumber} ({gs.family1 || 'F1'}) vs SEAT {fo2.seatNumber} ({gs.family2 || 'F2'})
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {[{ fam: 1, name: gs.family1 || 'Family 1', color: '#BC13FE', famPlayers: family1Players, fo: fo1 },
                { fam: 2, name: gs.family2 || 'Family 2', color: '#FF5F1F', famPlayers: family2Players, fo: fo2 }].map(({ fam, name, color, famPlayers, fo }) => (
                <div key={fam}>
                  <div className="text-[8px] tracking-widest uppercase mb-2" style={{ ...sty, color: `${color}aa` }}>{name}</div>
                  <div className="flex flex-wrap gap-2">
                    {[...famPlayers, ...unassignedPlayers].map(p => {
                      const key = fam === 1 ? 'faceoff_player1_id' : 'faceoff_player2_id';
                      const selected = gs[key] === p.playerId;
                      return (
                        <button key={p.playerId} onClick={() => setFaceoffPlayer(fam, selected ? '' : p.playerId)}
                          className="px-3 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all"
                          style={{ borderColor: selected ? color : '#ffffff20', color: selected ? color : '#ffffff40', background: selected ? `${color}20` : 'transparent' }}>
                          SEAT {p.seatNumber}
                          {p.role === 'hostPlayer' && <span className="ml-1 text-[6px] text-[#BC13FE]">H</span>}
                          <span className="ml-1" style={{ color: p.connected !== false ? '#4ade80' : '#ef4444' }}>●</span>
                        </button>
                      );
                    })}
                  </div>
                  {fo && <div className="mt-2 px-2 py-1 rounded border text-[8px] text-center" style={{ ...sty, borderColor: `${color}40`, color, background: `${color}10` }}>⚡ SEAT {fo.seatNumber} in faceoff</div>}
                </div>
              ))}
            </div>

            {/* Buzz Winner */}
            {buzzWinner && (
              <div className="space-y-3">
                <div className="p-3 border-2 border-[#BC13FE] rounded-xl bg-[#BC13FE]/10 flex items-center justify-between">
                  <div>
                    <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={sty}>⚡ Buzz Winner</div>
                    <div className="font-heading text-xl text-white">Seat {buzzWinner.seatNumber} — {buzzWinner.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')}</div>
                  </div>
                  <Btn onClick={clearBuzz} color="#ffffff" size="sm">Clear</Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Player Submission */}
        {lastSub && (
          <div className="p-4 border-2 rounded-xl flex items-center gap-3"
            style={{ borderColor: lastSub.result === 'wrong' ? '#ef4444' : '#22d3ee', background: lastSub.result === 'wrong' ? '#ef444410' : '#22d3ee10' }}>
            <div className="text-2xl">{lastSub.result === 'wrong' ? '❌' : '💬'}</div>
            <div className="flex-1">
              <div className="font-heading text-xs tracking-[0.2em] uppercase mb-0.5" style={{ color: lastSub.result === 'wrong' ? '#ef4444' : '#22d3ee' }}>
                Seat {lastSub.seatNumber} ({lastSub.familyTeam === 1 ? gs.family1 : gs.family2}) — {lastSub.result || 'answered'}:
              </div>
              <div className="font-heading text-xl text-white tracking-widest uppercase">"{lastSub.submittedAnswer}"</div>
              <div className="text-[8px] text-white/30 mt-0.5" style={sty}>{lastSub.inputMethod} · {new Date(lastSub.timestamp).toLocaleTimeString()}</div>
            </div>
            <div className="flex flex-col gap-2">
              {lastSub.result !== 'wrong' && <Btn onClick={markWrong} color="#ef4444" size="sm" disabled={byeCount >= 3}>✗ Mark Wrong</Btn>}
              <Btn onClick={() => updateState({ last_submission: null })} color="#ffffff" size="sm">✕</Btn>
            </div>
          </div>
        )}

        {/* Who Answers Now */}
        <div className="p-4 border border-[#4ade80]/30 rounded-xl bg-black/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xs tracking-[0.2em] text-[#4ade80]/70 uppercase">
              Who Answers Now?
              {gs.answering_player_id && <span className="ml-2 text-[#4ade80]">✓</span>}
            </h3>
            <div className="flex gap-2">
              {gs.answering_player_id && (
                <Btn onClick={() => advanceToNextPlayer(gs.answering_player_id, gs.active_turn || 1)} color="#FFD700" size="sm">
                  Next Player →
                </Btn>
              )}
              {gs.answering_player_id && <Btn onClick={() => updateState({ answering_player_id: null })} color="#ffffff40" size="sm">Clear</Btn>}
            </div>
          </div>

          {/* Current + next indicators */}
          {gs.answering_player_id && (
            <div className="flex gap-3">
              <div className="flex-1 px-3 py-2 rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/5 text-center">
                <div className="text-[7px] text-[#4ade80]/70 uppercase mb-1" style={sty}>Answering</div>
                <div className="font-heading text-sm text-[#4ade80]">
                  SEAT {getPlayer(gs.answering_player_id)?.seatNumber || '?'}
                </div>
              </div>
              {nextAnsweringPlayer && (
                <div className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-center">
                  <div className="text-[7px] text-white/30 uppercase mb-1" style={sty}>Up Next</div>
                  <div className="font-heading text-sm text-white/40">SEAT {nextAnsweringPlayer.seatNumber}</div>
                </div>
              )}
            </div>
          )}

          {/* Answering player picker */}
          <div className="flex flex-wrap gap-2">
            {players.map(p => {
              const selected = gs.answering_player_id === p.playerId;
              const teamColor = (p.familyTeam === 1 || p.familyTeam === '1') ? '#BC13FE' : (p.familyTeam === 2 || p.familyTeam === '2') ? '#FF5F1F' : '#ffffff';
              return (
                <button key={p.playerId} onClick={() => assignAnsweringPlayer(p.playerId)}
                  className="px-3 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all"
                  style={{ borderColor: selected ? '#4ade80' : `${teamColor}40`, color: selected ? '#4ade80' : `${teamColor}aa`, background: selected ? '#4ade8020' : 'transparent' }}>
                  SEAT {p.seatNumber}
                  {p.role === 'hostPlayer' && <span className="ml-1 text-[5px] text-[#BC13FE]">H</span>}
                </button>
              );
            })}
          </div>

          {gs.answering_player_id && (
            <div className="px-3 py-2 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 min-h-[2.5rem] flex items-center gap-2">
              <span className="text-[8px] text-[#22d3ee]/60 uppercase shrink-0" style={sty}>Typing:</span>
              <span className="font-heading text-base text-white tracking-widest">{gs.current_typing || <span className="text-white/20 text-sm">…</span>}</span>
            </div>
          )}
        </div>

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
              <div className="text-[7px] text-white/30 mt-1" style={sty}>
                {getActivePlayers(players, f.turn).length}P / {f.turn === 1 ? family1Players.length : family2Players.length} total
              </div>
              <div className="flex gap-2 mt-2 justify-center">
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
              <button onClick={() => awardBank(1)} className="py-2 rounded-lg border-2 border-[#BC13FE] text-[#BC13FE] font-heading text-xs tracking-widest uppercase hover:bg-[#BC13FE]/20 transition-all">Award → {gs.family1 || 'F1'}</button>
              <button onClick={() => awardBank(2)} className="py-2 rounded-lg border-2 border-[#FF5F1F] text-[#FF5F1F] font-heading text-xs tracking-widest uppercase hover:bg-[#FF5F1F]/20 transition-all">Award → {gs.family2 || 'F2'}</button>
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
            <button onClick={toggleVoice} className={`px-4 py-3 rounded-lg border-2 font-heading text-lg transition-all ${isListening ? 'border-red-500 text-red-400 bg-red-500/20' : 'border-[#22d3ee]/40 text-[#22d3ee]/70'}`}>
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
          faceoffId={gs.faceoff_player1_id} buzzWinnerId={gs.buzz_winner?.playerId} answeringId={gs.answering_player_id} nextId={gs.next_answering_player_id} stealId={gs.steal_player_id} />
        <RosterColumn title={gs.family2 || 'Family 2'} color="#FF5F1F" players={family2Players}
          faceoffId={gs.faceoff_player2_id} buzzWinnerId={gs.buzz_winner?.playerId} answeringId={gs.answering_player_id} nextId={gs.next_answering_player_id} stealId={gs.steal_player_id} />
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

function RosterColumn({ title, color, players, faceoffId, buzzWinnerId, answeringId, nextId, stealId }) {
  return (
    <div>
      <div className="text-[8px] tracking-widest uppercase mb-2" style={{ color, fontFamily: "'Press Start 2P', monospace" }}>{title} ({players.length})</div>
      {players.length === 0
        ? <div className="text-[8px] text-white/20" style={{ fontFamily: "'Press Start 2P', monospace" }}>No players yet</div>
        : players.map(p => {
          const isFaceoff = p.playerId === faceoffId;
          const isBuzz = p.playerId === buzzWinnerId;
          const isAnswering = p.playerId === answeringId;
          const isNext = p.playerId === nextId && !isAnswering;
          const isSteal = p.playerId === stealId;
          const isHost = p.role === 'hostPlayer';
          return (
            <div key={p.playerId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 border"
              style={{ borderColor: isAnswering ? '#4ade80' : isSteal ? '#FF5F1F' : isBuzz ? '#BC13FE' : isNext ? '#FFD70050' : isFaceoff ? color : '#ffffff10', background: isAnswering ? '#4ade8015' : isSteal ? '#FF5F1F15' : isBuzz ? '#BC13FE10' : 'transparent' }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.connected !== false ? '#4ade80' : '#ef4444' }} />
              <span className="text-[8px] text-white/80" style={{ fontFamily: "'Press Start 2P', monospace" }}>SEAT {p.seatNumber}</span>
              {isHost && <span className="text-[6px] text-[#BC13FE]" style={{ fontFamily: "'Press Start 2P', monospace" }}>HOST</span>}
              {isAnswering && <span className="text-[7px] text-[#4ade80]" style={{ fontFamily: "'Press Start 2P', monospace" }}>ANS</span>}
              {isSteal && <span className="text-[7px] text-[#FF5F1F]" style={{ fontFamily: "'Press Start 2P', monospace" }}>STEAL</span>}
              {isNext && <span className="text-[6px] text-[#FFD700]/60]" style={{ fontFamily: "'Press Start 2P', monospace" }}>NEXT</span>}
              {isFaceoff && !isAnswering && !isSteal && <span className="text-[7px] text-[#FF5F1F]" style={{ fontFamily: "'Press Start 2P', monospace" }}>⚡</span>}
              {isBuzz && !isAnswering && <span className="text-[7px] text-[#BC13FE]" style={{ fontFamily: "'Press Start 2P', monospace" }}>BUZZ</span>}
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
      style={{ borderColor: revealed ? '#FFD700' : '#BC13FE40', background: revealed ? 'rgba(255,215,0,0.1)' : 'rgba(188,19,254,0.05)' }}
      onClick={revealed ? onHide : onReveal}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-heading text-sm"
        style={{ background: revealed ? '#FFD700' : '#BC13FE30', color: revealed ? '#000' : '#BC13FE' }}>{rank}</div>
      <div className="flex-1 font-heading text-base tracking-wide uppercase" style={{ color: revealed ? '#FFD700' : '#ffffffcc' }}>{answer.text || answer.answer}</div>
      <div className="font-heading text-sm shrink-0" style={{ color: revealed ? '#FF5F1F' : '#FF5F1F80' }}>{answer.points} pts</div>
      <div className="px-2 py-1 rounded border font-heading text-[9px] tracking-widest uppercase shrink-0"
        style={{ borderColor: revealed ? '#FFD700' : '#BC13FE50', color: revealed ? '#FFD700' : '#BC13FE80' }}>
        {revealed ? '✓ REVEALED' : 'REVEAL'}
      </div>
    </div>
  );
}