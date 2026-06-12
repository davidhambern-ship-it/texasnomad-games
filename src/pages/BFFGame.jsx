import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import BYEDisplay from '@/components/game/BYEDisplay.jsx';
import { findMatchingAnswer } from '@/lib/bffAnswerMatch';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import { base44 } from '@/api/base44Client';
import BFFVsAISetup from '@/components/bff/BFFVsAISetup.jsx';
import BFFTeamRoster from '@/components/bff/BFFTeamRoster.jsx';
import BFFBuzzer from '@/components/bff/BFFBuzzer.jsx';
import { useBFFVsAI } from '@/hooks/useBFFVsAI.js';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const TN_TEAM = TEXASNOMAD_CHARACTERS;

export default function BFFGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const isVsAI = params.get('vsai') === '1';
  if (!roomCode) { window.location.href = '/'; return null; }
  return <BFFViewer roomCode={roomCode} isVsAI={isVsAI} />;
}

// ─── Main BFF Viewer ──────────────────────────────────────────────────────────
function BFFViewer({ roomCode, isVsAI }) {
  const { room, loading, updateState, ensureRoom } = useGameRoom(roomCode, 'bff', 'viewer');
  const gs = room?.game_state || {};

  // Stable playerId
  const [playerId] = useState(() => {
    const key = `tn_pid_${roomCode}`;
    let id = localStorage.getItem(key);
    if (!id) { id = 'p_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); localStorage.setItem(key, id); }
    return id;
  });

  const { seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'bff', updateState);

  // Player name/family (persisted locally)
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(`bff_name_${roomCode}`) || '');
  const [myFamily, setMyFamily] = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const containerRef = useRef(null);
  const notifTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const spInitRef = useRef(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Detect my family/name from players list
  useEffect(() => {
    if (!playerId || !gs.players) return;
    const me = (gs.players || []).find(p => p.playerId === playerId);
    if (me?.familyTeam && !myFamily) setMyFamily(Number(me.familyTeam));
    if (me?.playerName && !playerName) {
      setPlayerName(me.playerName);
      localStorage.setItem(`bff_name_${roomCode}`, me.playerName);
    }
  }, [gs.players, playerId]);

  // If vsAI and not set up yet — show setup screen
  useEffect(() => {
    if (!isVsAI || !room || spInitRef.current) return;
    if (gs.phase) {
      // Room already initialized — try to join
      if (!playerName) { setShowSetup(true); }
      return;
    }
    if (!playerName) { setShowSetup(true); }
  }, [room, isVsAI]);

  // Human players on team 1
  const humanPlayers = (gs.players || []).filter(p => (Number(p.familyTeam) === 1) && p.role === 'participant');

  // ── AI Engine ─────────────────────────────────────────────────────────────
  useBFFVsAI({
    gs,
    updateState,
    playerId,
    humanPlayers,
    enabled: isVsAI && !!gs.phase && !showSetup,
  });

  // ── Watch last_submission for notifications ───────────────────────────────
  const lastSubRef = useRef(null);
  useEffect(() => {
    const sub = gs.last_submission;
    if (!sub || JSON.stringify(sub) === JSON.stringify(lastSubRef.current)) return;
    lastSubRef.current = sub;
    if (sub.playerId === playerId) {
      setNotification({ seatNumber: sub.seatNumber, letter: sub.submittedAnswer, result: sub.result });
      clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => setNotification(null), 2800);
    }
  }, [gs.last_submission]);

  // ── Setup screen handler ──────────────────────────────────────────────────
  const handleSetupStart = async ({ playerName: pn, familyName }) => {
    localStorage.setItem(`bff_name_${roomCode}`, pn);
    setPlayerName(pn);
    setMyFamily(1);
    setShowSetup(false);

    if (!gs.phase || gs.phase === 'waiting') {
      spInitRef.current = true;
      // Ensure room exists before writing state
      await ensureRoom('bff', roomCode);
      // Initialize the game
      const surveys = await base44.entities.BFFSurvey.list('-created_date', 50);
      const survey = surveys && surveys.length > 0 ? surveys[Math.floor(Math.random() * surveys.length)] : null;

      const meAsPlayer = {
        playerId, seatNumber, role: 'participant', familyTeam: 1,
        playerName: pn, joinedAt: Date.now(), lastActionAt: Date.now(),
      };
      const currentPlayers = gs.players || [];
      const updatedPlayers = currentPlayers.find(p => p.playerId === playerId)
        ? currentPlayers.map(p => p.playerId === playerId ? { ...p, ...meAsPlayer } : p)
        : [...currentPlayers, meAsPlayer];

      await updateState({
        vs_ai: true,
        family1: familyName,
        family2: 'TexasNomad Team',
        score1: 0, score2: 0,
        active_turn: 1,
        phase: 'playing',
        buzzer_phase: 'board_shown',
        current_question: survey?.question || null,
        answers: survey ? (survey.answers || []).map(a => ({ ...a, revealed: false })) : [],
        pending_question: null,
        pending_answers: null,
        round_bank: 0,
        bye_count: 0,
        wrong_guesses: [],
        steal_mode: false,
        answering_ai: false,
        answering_player_id: null,
        buzz_winner: null,
        ai_member_idx: 0,
        players: updatedPlayers,
        round_number: 1,
      });
    }
  };

  const handleSetupJoin = async ({ playerName: pn, joinCode }) => {
    localStorage.setItem(`bff_name_${roomCode}`, pn);
    setPlayerName(pn);
    setMyFamily(1);
    setShowSetup(false);
    // Add this player to team 1
    const currentPlayers = gs.players || [];
    const team1Count = currentPlayers.filter(p => Number(p.familyTeam) === 1).length;
    if (team1Count >= 6) return; // team full
    const meAsPlayer = {
      playerId, seatNumber, role: 'participant', familyTeam: 1,
      playerName: pn, joinedAt: Date.now(), lastActionAt: Date.now(),
    };
    const updated = currentPlayers.find(p => p.playerId === playerId)
      ? currentPlayers.map(p => p.playerId === playerId ? { ...p, ...meAsPlayer } : p)
      : [...currentPlayers, meAsPlayer];
    await updateState({ players: updated });
  };

  // ── Buzzer handler (human buzzes) ─────────────────────────────────────────
  const handleBuzz = async () => {
    if (gs.buzzer_phase !== 'buzzer_active' || gs.buzz_winner) return;
    await updateState({
      buzz_winner: { playerId, playerName: playerName || `Seat ${seatNumber}`, teamName: gs.family1 || 'Human Family', isAI: false },
      buzzer_phase: 'buzzed',
      // Let the hook's "after buzz" effect assign faceoff_phase and answering_player_id
    });
  };

  // ── Answer submission ─────────────────────────────────────────────────────
  const amAnswering = gs.answering_player_id === playerId && !gs.answering_ai;
  const amInSteal = amAnswering && gs.steal_mode;
  const canAnswer = amAnswering && gs.phase === 'playing';

  const submitAnswer = async (guess) => {
    if (!guess.trim() || !canAnswer || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    const answers = gs.answers || [];
    const { idx: matchIdx } = findMatchingAnswer(guess, answers, true);
    const submission = { playerId, seatNumber, familyTeam: 1, submittedAnswer: guess, timestamp: Date.now(), result: matchIdx !== -1 ? 'correct' : 'wrong' };

    // ── FACEOFF: first_answer (human buzzed first) ──────────────────────────
    if (gs.faceoff_phase === 'first_answer') {
      if (matchIdx !== -1) {
        const ans = answers[matchIdx];
        const newAnswers = answers.map((a, i) => i === matchIdx ? { ...a, revealed: true } : a);
        if (matchIdx === 0) {
          // #1 answer — instant win, start playing for team 1
          await updateState({
            answers: newAnswers, last_submission: submission,
            faceoff_phase: null, faceoff_first_answer: null, buzz_winner: null,
            phase: 'playing', buzzer_phase: 'playing',
            control_team: 1, active_turn: 1,
            answering_player_id: playerId, answering_ai: false,
            round_bank: 0, bye_count: 0, wrong_guesses: [], steal_mode: false, current_typing: '',
          });
        } else {
          // Correct but not #1 — AI gets one shot
          await updateState({
            answers: newAnswers, last_submission: submission,
            faceoff_phase: 'second_answer',
            faceoff_first_answer: { rank: matchIdx, points: ans.points, text: ans.text || ans.answer, team: 1 },
            answering_player_id: null, answering_ai: true, ai_thinking: true,
            active_turn: 2, current_typing: '',
          });
        }
        setSubmitResult('hit');
      } else {
        // Human wrong on first answer — AI gets one shot
        await updateState({
          last_submission: submission,
          faceoff_phase: 'second_answer',
          faceoff_first_answer: { rank: -1, points: 0, text: guess, team: 1, wrong: true },
          answering_player_id: null, answering_ai: true, ai_thinking: true,
          active_turn: 2, current_typing: '',
        });
        setSubmitResult('miss');
      }
      setAnswerInput('');
      setIsSubmitting(false);
      setTimeout(() => setSubmitResult(null), 3000);
      return;
    }

    // ── FACEOFF: second_answer (human is counter-answering) ─────────────────
    if (gs.faceoff_phase === 'second_answer') {
      const firstAnswer = gs.faceoff_first_answer || {};
      if (matchIdx !== -1) {
        const ans = answers[matchIdx];
        const newAnswers = answers.map((a, i) => i === matchIdx ? { ...a, revealed: true } : a);
        const firstRank = firstAnswer.wrong ? 999 : (firstAnswer.rank ?? 999);
        const humanWins = matchIdx < firstRank;
        await updateState({
          answers: newAnswers, last_submission: submission,
          faceoff_phase: null, faceoff_first_answer: null, buzz_winner: null,
          phase: 'playing', buzzer_phase: 'playing',
          control_team: humanWins ? 1 : 2,
          active_turn: humanWins ? 1 : 2,
          answering_player_id: humanWins ? playerId : null,
          answering_ai: !humanWins,
          round_bank: 0, bye_count: 0, wrong_guesses: [], steal_mode: false, current_typing: '',
        });
        setSubmitResult('hit');
      } else {
        // Human wrong on second answer
        const firstRank = firstAnswer.wrong ? 999 : (firstAnswer.rank ?? 999);
        if (firstRank < 999) {
          // AI had a correct first answer → AI wins
          await updateState({
            last_submission: submission,
            faceoff_phase: null, faceoff_first_answer: null, buzz_winner: null,
            phase: 'playing', buzzer_phase: 'playing',
            control_team: 2, active_turn: 2,
            answering_player_id: null, answering_ai: true,
            round_bank: 0, bye_count: 0, wrong_guesses: [], steal_mode: false, current_typing: '',
          });
        } else {
          // Both wrong → new faceoff
          await updateState({
            last_submission: submission,
            faceoff_phase: null, faceoff_first_answer: null, buzz_winner: null,
            buzzer_phase: 'board_shown',
            answering_player_id: null, answering_ai: false,
            bye_count: 0, wrong_guesses: [], active_turn: 1, current_typing: '',
          });
        }
        setSubmitResult('miss');
      }
      setAnswerInput('');
      setIsSubmitting(false);
      setTimeout(() => setSubmitResult(null), 3000);
      return;
    }

    // ── Normal survey play ───────────────────────────────────────────────────
    if (matchIdx !== -1) {
      const ans = answers[matchIdx];
      const newAnswers = answers.map((a, i) => i === matchIdx ? { ...a, revealed: true } : a);
      const newBank = (gs.round_bank || 0) + (ans.points || 0);
      const allRevealed = newAnswers.every(a => a.revealed);
      const wasSteal = gs.steal_mode;

      if (wasSteal) {
        // Correct steal — human team gets the bank
        await updateState({
          answers: newAnswers, round_bank: 0,
          score1: (gs.score1 || 0) + newBank,
          last_submission: submission,
          steal_mode: false, steal_player_id: null,
          answering_player_id: null, current_typing: '',
          phase: 'round_over',
        });
      } else if (allRevealed) {
        const scoreKey = gs.active_turn === 1 ? 'score1' : 'score2';
        await updateState({
          answers: newAnswers, round_bank: 0,
          [scoreKey]: (gs[scoreKey] || 0) + newBank,
          last_submission: submission,
          answering_player_id: null, current_typing: '',
          phase: 'round_over',
        });
      } else {
        const nextHuman = getNextHumanPlayer(humanPlayers, playerId);
        await updateState({
          answers: newAnswers, round_bank: newBank,
          last_submission: submission,
          answering_player_id: nextHuman?.playerId || playerId,
          current_typing: '',
        });
      }
      setSubmitResult('hit');
    } else {
      // Wrong
      const newByeCount = Math.min(3, (gs.bye_count || 0) + 1);
      const newWrong = [...(gs.wrong_guesses || []), guess];

      if (gs.steal_mode) {
        // Wrong steal — no points, next round
        await updateState({
          last_submission: submission, steal_mode: false, steal_player_id: null,
          round_bank: 0, answering_player_id: null, current_typing: '',
          wrong_guesses: newWrong, phase: 'round_over',
        });
      } else if (newByeCount >= 3) {
        await updateState({
          bye_count: newByeCount, last_submission: submission,
          wrong_guesses: newWrong,
          answering_player_id: null, current_typing: '',
          answering_ai: true, ai_thinking: true,
          active_turn: 2, buzz_winner: null,
        });
      } else {
        const nextHuman = getNextHumanPlayer(humanPlayers, playerId);
        await updateState({
          bye_count: newByeCount, last_submission: submission,
          wrong_guesses: newWrong,
          answering_player_id: nextHuman?.playerId || playerId,
          current_typing: '',
        });
      }
      setSubmitResult('miss');
    }

    setAnswerInput('');
    setIsSubmitting(false);
    setTimeout(() => setSubmitResult(null), 3000);
  };

  const handleTyping = async (val) => {
    setAnswerInput(val);
    if (canAnswer) await updateState({ current_typing: val });
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => { const t = e.results[0][0].transcript.trim(); setAnswerInput(t); submitAnswer(t); };
    recognitionRef.current = r; r.start();
  };

  // Non-vsAI: legacy multiplayer role/family logic
  const [myRole, setMyRole] = useState(() => localStorage.getItem(`bff_role_${roomCode}`) || null);
  const [roleLoading, setRoleLoading] = useState(false);

  const handleChooseRole = async (role) => {
    setRoleLoading(true);
    try {
      const updatedPlayers = (gs.players || []).map(p => p.playerId === playerId ? { ...p, role } : p);
      await updateState({ players: updatedPlayers });
      localStorage.setItem(`bff_role_${roomCode}`, role);
      setMyRole(role);
    } finally { setRoleLoading(false); }
  };

  const handleChooseFamily = async (familyTeam) => {
    const updatedPlayers = (gs.players || []).map(p => p.playerId === playerId ? { ...p, familyTeam, role: 'participant' } : p);
    await updateState({ players: updatedPlayers });
    setMyFamily(familyTeam);
  };

  // Legacy buzzer for non-vsAI
  const handleLegacyBuzz = async () => {
    if (!myRole || gs.phase !== 'playing' || !gs.faceoff_mode) return;
    const me = (gs.players || []).find(p => p.playerId === playerId);
    if (!me) return;
    if (playerId !== gs.faceoff_player1_id && playerId !== gs.faceoff_player2_id) return;
    if (gs.buzz_winner) return;
    await updateState({ buzz_winner: { playerId, seatNumber, familyTeam: me.familyTeam }, answering_player_id: playerId });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // vsAI — show setup if needed
  if (isVsAI && showSetup) {
    return <BFFVsAISetup onStart={handleSetupStart} onJoin={handleSetupJoin} />;
  }

  // vsAI — show setup if room loaded but no player name yet
  if (isVsAI && !loading && room && !playerName && !gs.phase) {
    return <BFFVsAISetup onStart={handleSetupStart} onJoin={handleSetupJoin} />;
  }

  // Legacy non-vsAI role gate
  if (!isVsAI && isSeated && !myRole) {
    return (
      <div ref={containerRef} className="min-h-screen bg-[#070311] text-white">
        <BFFHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} isVsAI={isVsAI} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="font-heading text-2xl text-[#FFD700] uppercase tracking-widest">Join Game</div>
            <button onClick={() => handleChooseRole('participant')} disabled={roleLoading}
              className="w-full py-4 rounded-xl border-2 border-[#BC13FE] text-[#BC13FE] font-heading tracking-widest uppercase hover:bg-[#BC13FE]/20 transition-all">
              🎮 Play
            </button>
            <button onClick={() => handleChooseRole('watcher')} disabled={roleLoading}
              className="w-full py-4 rounded-xl border-2 border-white/20 text-white/40 font-heading tracking-widest uppercase hover:bg-white/5 transition-all">
              👁 Watch
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Legacy family selector
  if (!isVsAI && myRole === 'participant' && !myFamily) {
    return (
      <div ref={containerRef} className="min-h-screen bg-[#070311] text-white">
        <BFFHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} isVsAI={isVsAI} />
        <FamilySelector gs={gs} onChoose={handleChooseFamily} />
      </div>
    );
  }

  const isPlaying = gs.phase === 'playing' || gs.phase === 'get_ready';
  const buzzerPhase = gs.buzzer_phase;
  const stealMode = gs.steal_mode || false;
  const byeCount = gs.bye_count || 0;
  const answers = gs.answers || [];
  const aiCharacter = TN_TEAM[gs.ai_member_idx || 0];
  const isAIThinking = gs.answering_ai && !stealMode;
  const buzzWinner = gs.buzz_winner || null;
  const canBuzz = isVsAI && (buzzerPhase === 'buzzer_active') && !buzzWinner;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />
      <BFFHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} isVsAI={isVsAI} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !gs.phase || gs.phase === 'waiting' ? (
        <WaitingScreen isSeated={isSeated} seatNumber={seatNumber} gs={gs} isVsAI={isVsAI} />
      ) : gs.phase === 'round_over' ? (
        <RoundOverScreen gs={gs} isVsAI={isVsAI} />
      ) : (
        <div className="flex-1 flex flex-col p-4 gap-3 max-w-2xl mx-auto w-full">

          {/* Team Roster (vsAI) */}
          {isVsAI && (
            <BFFTeamRoster gs={gs} playerId={playerId} humanPlayers={humanPlayers} />
          )}

          {/* Scores — non-vsAI */}
          {!isVsAI && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: gs.family1 || 'Family 1', score: gs.score1 || 0, turn: 1, color: '#BC13FE' },
                { name: gs.family2 || 'Family 2', score: gs.score2 || 0, turn: 2, color: '#FF5F1F' },
              ].map(f => (
                <div key={f.turn} className="p-3 border-2 rounded-xl text-center"
                  style={{ borderColor: gs.active_turn === f.turn ? '#FFD700' : `${f.color}30` }}>
                  <div className="font-heading text-sm text-white uppercase truncate">{f.name}</div>
                  <div className="font-heading text-3xl text-[#FFD700]">{f.score}</div>
                  {gs.active_turn === f.turn && <div className="text-[8px] text-[#FFD700]/70 uppercase" style={PS2}>▶ Active</div>}
                </div>
              ))}
            </div>
          )}

          {/* Round info strip */}
          <div className="flex items-center justify-between gap-2">
            <div className="px-3 py-1.5 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 text-center flex-1">
              <span className="text-[7px] text-[#FF5F1F]/60 uppercase tracking-widest mr-2" style={PS2}>Bank</span>
              <span className="font-heading text-xl text-[#FF5F1F]">{gs.round_bank || 0}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-center">
              <span className="text-[6px] text-white/30 uppercase tracking-widest mr-1" style={PS2}>Round</span>
              <span className="text-[8px] text-white/60" style={PS2}>{gs.round_number || 1}</span>
            </div>
          </div>

          {/* Buzzer phase */}
          {isVsAI && (buzzerPhase === 'get_ready' || buzzerPhase === 'board_shown' || buzzerPhase === 'buzzer_active' || buzzerPhase === 'buzzed') && (
            <BFFBuzzer
              phase={buzzerPhase}
              buzzWinner={buzzWinner}
              canBuzz={canBuzz}
              onBuzz={handleBuzz}
            />
          )}

          {/* Board shown — buzzer arming soon */}
          {isVsAI && buzzerPhase === 'board_shown' && (
            <div className="text-center px-4 py-2 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/5 animate-pulse">
              <span className="text-[7px] text-[#FFD700]/60 uppercase tracking-widest" style={PS2}>⚡ Get ready to buzz in…</span>
            </div>
          )}

          {/* Question */}
          {gs.current_question && (
            <div className="px-5 py-4 border border-[#FFD700]/30 rounded-xl bg-[#FFD700]/5 text-center">
              <div className="text-[7px] tracking-widest text-[#FFD700]/50 uppercase mb-2" style={PS2}>★ Survey Says</div>
              <div className="font-heading text-xl tracking-wide text-[#FFD700] leading-snug">{gs.current_question}</div>
            </div>
          )}

          {/* Answer Board */}
          {answers.length > 0 && (
            <div className="border border-[#BC13FE]/30 rounded-xl overflow-hidden">
              {answers.map((ans, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0"
                  style={{ background: ans.revealed ? 'rgba(255,215,0,0.07)' : 'rgba(188,19,254,0.03)' }}>
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 font-heading text-xs"
                    style={{ background: ans.revealed ? '#FFD700' : '#BC13FE20', color: ans.revealed ? '#000' : '#BC13FE60' }}>{i + 1}</div>
                  <div className="flex-1 font-heading text-base tracking-wide uppercase"
                    style={{ color: ans.revealed ? '#FFD700' : '#ffffff20' }}>
                    {ans.revealed ? (ans.text || ans.answer) : '? ? ? ? ?'}
                  </div>
                  {ans.revealed && <div className="font-heading text-sm shrink-0 text-[#FF5F1F]">{ans.points} pts</div>}
                </div>
              ))}
            </div>
          )}

          {/* BYE Display */}
          <div className="text-center">
            <BYEDisplay byeCount={byeCount} byeFlash={gs.bye_flash || 0} />
          </div>

          {/* Steal Banner */}
          {stealMode && (
            <div className="px-4 py-3 rounded-xl border-2 border-[#FF5F1F] bg-[#FF5F1F]/10 text-center"
              style={{ boxShadow: '0 0 20px rgba(255,95,31,0.3)' }}>
              <div className="font-heading text-xl text-[#FF5F1F] uppercase tracking-widest">🎯 Steal Opportunity!</div>
              {amInSteal && <div className="text-[8px] text-[#FF5F1F]/80 tracking-widest uppercase mt-1" style={PS2}>Your chance — give your best answer!</div>}
            </div>
          )}

          {/* AI Thinking */}
          {isAIThinking && aiCharacter && (
            <div className="px-4 py-3 rounded-xl border border-[#FF5F1F]/30 bg-[#FF5F1F]/5">
              <div className="flex items-center gap-3">
                <img src={aiCharacter.avatar} alt={aiCharacter.name} className="w-8 h-8 rounded-lg border border-[#FF5F1F]/30" />
                <div>
                  <div className="text-[7px] text-[#FF5F1F]/50 uppercase tracking-widest mb-0.5" style={PS2}>TexasNomad Team</div>
                  <div className="text-[8px] text-[#FF5F1F] uppercase animate-pulse" style={PS2}>{aiCharacter.name} is thinking…</div>
                </div>
                <div className="ml-auto flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#FF5F1F] animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
              </div>
            </div>
          )}

          {/* Last AI answer result */}
          {gs.last_ai_answer && !isAIThinking && (
            <div className={`px-4 py-2 rounded-xl border text-center ${gs.last_ai_answer.correct ? 'border-[#4ade80]/40 bg-[#4ade80]/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <span className="text-[7px] uppercase tracking-widest" style={{ ...PS2, color: gs.last_ai_answer.correct ? '#4ade80' : '#ef4444' }}>
                {gs.last_ai_answer.character}: "{gs.last_ai_answer.answer}" — {gs.last_ai_answer.correct ? '✓ Correct!' : '✗ Wrong'}
              </span>
            </div>
          )}

          {/* Current answering indicator */}
          {amAnswering && !stealMode && buzzerPhase !== 'get_ready' && buzzerPhase !== 'buzzer_active' && (
            <div className="px-4 py-2 rounded-xl border border-[#4ade80]/50 bg-[#4ade80]/5 text-center">
              <div className="text-[8px] tracking-widest text-[#4ade80] uppercase" style={PS2}>▶ Your turn to answer!</div>
            </div>
          )}

          {/* Whose turn is it (human not answering) */}
          {!amAnswering && !isAIThinking && gs.active_turn === 1 && gs.answering_player_id && gs.answering_player_id !== playerId && buzzerPhase !== 'get_ready' && buzzerPhase !== 'buzzer_active' && (
            <div className="px-4 py-2 rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/5 text-center">
              <div className="text-[8px] text-[#22d3ee]/60 uppercase tracking-widest" style={PS2}>
                Waiting for {humanPlayers.find(p => p.playerId === gs.answering_player_id)?.playerName || 'teammate'}…
              </div>
            </div>
          )}

          {/* Answer Input */}
          {(canAnswer || amInSteal) && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  className="flex-1 px-4 py-3 rounded-lg bg-black/80 border-2 border-[#4ade80]/60 text-white font-body text-base focus:outline-none focus:border-[#4ade80] transition-colors"
                  value={answerInput}
                  onChange={e => handleTyping(e.target.value)}
                  placeholder="Type your answer…"
                  disabled={isSubmitting}
                  onKeyDown={e => e.key === 'Enter' && submitAnswer(answerInput)}
                  autoComplete="off"
                  autoFocus
                />
                <button onClick={toggleVoice}
                  className={`px-4 py-3 rounded-lg border-2 font-heading text-lg transition-all ${isListening ? 'border-red-500 text-red-400 bg-red-500/20' : 'border-[#4ade80]/40 text-[#4ade80]/70'}`}>
                  {isListening ? '🔴' : '🎙'}
                </button>
                <button
                  onClick={() => submitAnswer(answerInput)}
                  disabled={!answerInput.trim() || isSubmitting}
                  className="px-5 py-3 rounded-lg border-2 border-[#4ade80] text-[#4ade80] font-heading text-sm tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  GO
                </button>
              </div>
              {submitResult && (
                <div className={`px-4 py-2 rounded-lg font-heading text-sm text-center ${submitResult === 'hit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {submitResult === 'hit' ? '✓ Answer submitted!' : '✗ Not on the board'}
                </div>
              )}
            </div>
          )}

          {/* Legacy (non-vsAI) faceoff buzzer */}
          {!isVsAI && gs.faceoff_mode && !gs.buzz_winner && (playerId === gs.faceoff_player1_id || playerId === gs.faceoff_player2_id) && (
            <div className="px-4 py-4 rounded-xl border-2 border-[#FF5F1F]/60 bg-[#FF5F1F]/5 text-center">
              <div className="font-heading text-xl text-[#FF5F1F] uppercase mb-3">⚡ Faceoff!</div>
              <button onClick={handleLegacyBuzz}
                className="px-8 py-4 rounded-xl border-2 border-[#FFD700] text-[#FFD700] font-heading text-xl tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
                style={{ boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}>
                🔔 BUZZ IN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getNextHumanPlayer(humanPlayers, currentPlayerId) {
  if (!humanPlayers || humanPlayers.length === 0) return null;
  if (humanPlayers.length === 1) return humanPlayers[0];
  const idx = humanPlayers.findIndex(p => p.playerId === currentPlayerId);
  return humanPlayers[(idx + 1) % humanPlayers.length];
}

// ── Sub-components ────────────────────────────────────────────────────────────
function BFFHeader({ roomCode, room, isFullscreen, containerRef, seatNumber, isSeated, isVsAI }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#070311]/90 backdrop-blur-xl">
      <div className="px-4 h-12 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="shrink-0">
            <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
          </Link>
          <span className="text-[#FFD700] uppercase text-[9px] tracking-widest hidden sm:block" style={PS2}>BFF</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse shrink-0" />
            <span className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
          </div>
          {isVsAI && (
            <span className="px-2 py-0.5 bg-[#FFD700]/10 border border-[#FFD700]/40 rounded text-[#FFD700] text-[7px] tracking-widest uppercase" style={PS2}>
              🤖 vs TexasNomad
            </span>
          )}
          {!isVsAI && room?.host_connected && (
            <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[7px] tracking-widest uppercase hidden sm:inline" style={PS2}>
              🔴 HOST LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSeated && seatNumber && (
            <div className="px-2 py-1 rounded border border-[#BC13FE] bg-[#BC13FE]/10 text-[7px] tracking-widest text-[#BC13FE] uppercase hidden sm:block" style={PS2}>SEAT {seatNumber}</div>
          )}
          <Link to="/games" className="px-2 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[7px] tracking-widest uppercase" style={PS2}>← LOBBY</Link>
          <button
            onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
            className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[7px] tracking-widest uppercase" style={PS2}>
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>
      </div>
    </header>
  );
}

function FamilySelector({ gs, onChoose }) {
  const f1Count = (gs.players || []).filter(p => Number(p.familyTeam) === 1).length;
  const f2Count = (gs.players || []).filter(p => Number(p.familyTeam) === 2).length;
  const suggested = f1Count <= f2Count ? 1 : 2;
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="font-heading text-2xl text-[#FFD700] uppercase tracking-widest">Choose Your Family</div>
        <div className="grid grid-cols-2 gap-4">
          {[{ fam: 1, name: gs.family1 || 'Family 1', color: '#BC13FE', count: f1Count }, { fam: 2, name: gs.family2 || 'Family 2', color: '#FF5F1F', count: f2Count }].map(({ fam, name, color, count }) => (
            <button key={fam} onClick={() => onChoose(fam)}
              className="p-6 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 text-center relative"
              style={{ borderColor: `${color}60`, background: `${color}08` }}>
              {fam === suggested && <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#4ade80] text-black text-[6px] tracking-widest uppercase" style={PS2}>suggested</div>}
              <div className="font-heading text-lg tracking-widest uppercase mb-2" style={{ color }}>{name}</div>
              <div className="text-[8px] text-white/40 uppercase" style={PS2}>{count} player{count !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoundOverScreen({ gs, isVsAI }) {
  const lastScore1 = gs.score1 || 0;
  const lastScore2 = gs.score2 || 0;
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4">
      <div className="space-y-4">
        <div className="text-5xl">🎉</div>
        <div className="font-heading text-2xl text-[#FFD700] uppercase tracking-widest">Round Over!</div>
        <div className="flex gap-6 justify-center">
          <div className="text-center">
            <div className="text-[8px] text-[#BC13FE]/60 uppercase" style={PS2}>{gs.family1 || 'Team 1'}</div>
            <div className="font-heading text-3xl text-[#BC13FE]">{lastScore1}</div>
          </div>
          <div className="text-white/20 self-center font-heading text-xl">vs</div>
          <div className="text-center">
            <div className="text-[8px] text-[#FF5F1F]/60 uppercase" style={PS2}>{gs.family2 || 'Team 2'}</div>
            <div className="font-heading text-3xl text-[#FF5F1F]">{lastScore2}</div>
          </div>
        </div>
        <div className="text-[8px] text-white/30 uppercase animate-pulse" style={PS2}>Next round loading…</div>
      </div>
    </div>
  );
}

function WaitingScreen({ isSeated, seatNumber, gs, isVsAI }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4">
      <div className="space-y-5">
        <div className="text-6xl">🎯</div>
        <div className="text-lg tracking-widest text-white/40 uppercase" style={PS2}>
          {isVsAI ? '⏳ Setting up…' : 'Waiting for Host…'}
        </div>
        {isSeated && seatNumber && (
          <div className="px-6 py-4 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/10">
            <div className="text-[8px] text-[#BC13FE]/70 uppercase mb-1" style={PS2}>You are</div>
            <div className="text-3xl text-white" style={PS2}>SEAT {seatNumber}</div>
          </div>
        )}
        {gs.family1 && gs.family2 && (
          <div className="flex gap-4 justify-center">
            <div className="px-3 py-2 rounded-lg border border-[#BC13FE]/30 text-[8px] text-[#BC13FE]" style={PS2}>{gs.family1}</div>
            <div className="text-white/20 self-center">vs</div>
            <div className="px-3 py-2 rounded-lg border border-[#FF5F1F]/30 text-[8px] text-[#FF5F1F]" style={PS2}>{gs.family2}</div>
          </div>
        )}
      </div>
    </div>
  );
}