import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import BYEDisplay from '@/components/game/BYEDisplay.jsx';

const sty = { fontFamily: "'Press Start 2P', monospace" };

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function matchAnswer(guess, answers) {
  const g = normalize(guess);
  return answers.findIndex((a) => {
    const t = normalize(a.text || a.answer || '');
    return t === g || (t.length >= 4 && g.includes(t)) || (g.length >= 4 && t.includes(g));
  });
}

export default function BFFGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <BFFViewer roomCode={roomCode} />;
}

function BFFViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'bff', 'viewer');
  const gs = room?.game_state || {};
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'bff', updateState);

  const familyKey = `tn_bff_family_${roomCode}_${playerId || 'anon'}`;
  const [selectedFamily, setSelectedFamily] = useState(() => {
    const v = localStorage.getItem(familyKey);
    return v ? Number(v) : null;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  const onPlayerMode = gs.one_player_mode || false;
  const players = gs.players || [];

  // Sync family from player record when game starts
  useEffect(() => {
    if (!playerId || !gs.phase || gs.phase === 'setup') return;
    const me = players.find(p => p.playerId === playerId);
    if (me?.familyTeam && me.familyTeam !== selectedFamily) {
      const fam = Number(me.familyTeam);
      localStorage.setItem(familyKey, String(fam));
      setSelectedFamily(fam);
    }
  }, [playerId, gs.phase, gs.players]);

  // Auto-assign family on mid-game join (by team balance)
  const familySyncedRef = useRef(false);
  useEffect(() => {
    if (!isSeated || selectedFamily || !gs.phase || gs.phase === 'setup') return;
    if (onPlayerMode) { handleChooseFamily(1, true); return; }
    const f1 = players.filter(p => p.familyTeam === 1 || p.familyTeam === '1').length;
    const f2 = players.filter(p => p.familyTeam === 2 || p.familyTeam === '2').length;
    if (f1 < f2) handleChooseFamily(1, true);
    else if (f2 < f1) handleChooseFamily(2, true);
  }, [isSeated, selectedFamily, gs.phase, gs.players]);

  // Sync family choice into player record
  useEffect(() => {
    if (!isSeated || !selectedFamily || !playerId || familySyncedRef.current) return;
    const existing = players.find(p => p.playerId === playerId);
    if (!existing || existing.familyTeam === selectedFamily) { familySyncedRef.current = true; return; }
    familySyncedRef.current = true;
    updateState({ players: players.map(p => p.playerId === playerId ? { ...p, familyTeam: selectedFamily } : p) });
  }, [isSeated, selectedFamily, playerId, gs.players]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const [autoAssignedMsg, setAutoAssignedMsg] = useState('');
  const handleChooseFamily = (familyNum, isAuto = false) => {
    localStorage.setItem(familyKey, String(familyNum));
    setSelectedFamily(familyNum);
    familySyncedRef.current = false;
    if (isAuto) {
      setAutoAssignedMsg(`Assigned to ${familyNum === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')}`);
      setTimeout(() => setAutoAssignedMsg(''), 4000);
    }
  };

  const answers = gs.answers || [];
  const phase = gs.phase;
  const hostConnected = room?.host_connected;
  const myFamilyColor = selectedFamily === 1 ? '#BC13FE' : '#FF5F1F';
  const myFamilyName = selectedFamily === 1 ? (gs.family1 || 'Family 1') : selectedFamily === 2 ? (gs.family2 || 'Family 2') : null;

  // Skip family select in 1-player mode or if game hasn't started
  const skipFamilySelect = onPlayerMode || !phase || phase === 'setup';

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#050505]/95 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/"><img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" /></Link>
            <span className="text-[#FFD700] uppercase text-[10px] tracking-widest hidden sm:block" style={sty}>BFF — BIGO FAMILY FEUD</span>
            {onPlayerMode && <span className="px-2 py-0.5 bg-[#FFD700]/20 border border-[#FFD700]/50 rounded text-[#FFD700] text-[7px] tracking-widest uppercase" style={sty}>1 PLAYER</span>}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span className="text-[9px] tracking-widest text-[#BC13FE] uppercase" style={sty}>ROOM {roomCode}</span>
            </div>
            {hostConnected ? (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[8px] tracking-widest uppercase" style={sty}>🔴 HOST LIVE</span>
            ) : selectedFamily ? (
              <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-yellow-400 text-[8px] tracking-widest uppercase animate-pulse" style={sty}>⏳ WAITING FOR HOST</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
            {selectedFamily && myFamilyName && !onPlayerMode && (
              <div className="px-2 py-1 rounded border text-[7px] tracking-widest uppercase hidden sm:block"
                style={{ borderColor: myFamilyColor, color: myFamilyColor, background: `${myFamilyColor}15`, ...sty }}>{myFamilyName}</div>
            )}
            <Link to="/" className="hidden sm:flex px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[8px] tracking-widest uppercase" style={sty}>← LOBBY</Link>
            <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-3 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[8px] tracking-widest uppercase" style={sty}>
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {autoAssignedMsg && (
        <div className="fixed top-14 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-xl border border-[#FFD700]/50 bg-[#FFD700]/10 text-[#FFD700] text-[9px] tracking-widest uppercase text-center" style={sty}>
          {autoAssignedMsg}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (!selectedFamily && !skipFamilySelect) ? (
        <FamilySelect family1={gs.family1} family2={gs.family2} seatNumber={seatNumber} isSeated={isSeated} onChoose={handleChooseFamily} />
      ) : (
        <GameBoard
          gs={gs}
          answers={answers}
          selectedFamily={onPlayerMode ? 1 : selectedFamily}
          seatNumber={seatNumber}
          playerId={playerId}
          isSeated={isSeated}
          locked={!phase || phase === 'setup' || !hostConnected}
          updateState={updateState}
          onChangeFamily={() => {
            localStorage.removeItem(familyKey);
            setSelectedFamily(null);
            familySyncedRef.current = false;
          }}
        />
      )}
    </div>
  );
}

/* ── FAMILY SELECTION ── */
function FamilySelect({ family1, family2, seatNumber, isSeated, onChoose }) {
  const name1 = family1 || 'Family 1';
  const name2 = family2 || 'Family 2';
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <div className="font-heading text-3xl tracking-widest text-[#FFD700] uppercase mb-2" style={{ textShadow: '0 0 20px rgba(255,215,0,0.4)' }}>Choose Your Family</div>
        {seatNumber && <div className="text-[9px] tracking-[0.25em] text-white/40 uppercase mt-1" style={sty}>You are Seat {seatNumber}</div>}
        {!isSeated && <div className="text-[8px] tracking-widest text-white/20 uppercase mt-1" style={sty}>Assigning seat…</div>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-lg">
        <button onClick={() => onChoose(1)}
          className="p-8 rounded-2xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/5 hover:bg-[#BC13FE]/15 hover:border-[#BC13FE] hover:scale-105 transition-all duration-200 active:scale-95">
          <div className="text-5xl mb-3">🟣</div>
          <div className="font-heading text-2xl tracking-widest uppercase text-[#BC13FE] mb-1">{name1}</div>
          <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase mt-1" style={sty}>Tap to join</div>
        </button>
        <button onClick={() => onChoose(2)}
          className="p-8 rounded-2xl border-2 border-[#FF5F1F]/50 bg-[#FF5F1F]/5 hover:bg-[#FF5F1F]/15 hover:border-[#FF5F1F] hover:scale-105 transition-all duration-200 active:scale-95">
          <div className="text-5xl mb-3">🟠</div>
          <div className="font-heading text-2xl tracking-widest uppercase text-[#FF5F1F] mb-1">{name2}</div>
          <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase mt-1" style={sty}>Tap to join</div>
        </button>
      </div>
    </div>
  );
}

/* ── WRONG X POPUP ── */
function WrongXPopup({ show }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center pointer-events-none">
      <div style={{ ...sty, fontSize: '35vw', color: '#ef4444', textShadow: '0 0 60px #ef4444, 0 0 120px rgba(239,68,68,0.5)', animation: 'wrongXAnim 1.2s ease-out forwards' }}>✗</div>
      <style>{`@keyframes wrongXAnim { 0%{opacity:0;transform:scale(2)} 25%{opacity:1;transform:scale(1)} 70%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.8)} }`}</style>
    </div>
  );
}

/* ── GAME BOARD ── */
function GameBoard({ gs, answers, selectedFamily, seatNumber, playerId, isSeated, locked, updateState, onChangeFamily }) {
  const [revealAnim, setRevealAnim] = useState({});
  const prevAnswersRef = useRef([]);
  const [answerInput, setAnswerInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [buzzAnim, setBuzzAnim] = useState(false);
  const [showWrongX, setShowWrongX] = useState(false);
  const prevByeCount = useRef(gs.bye_count || 0);
  const recognitionRef = useRef(null);

  // Reveal animation
  useEffect(() => {
    const prev = prevAnswersRef.current;
    answers.forEach((ans, i) => {
      if (ans.revealed && !prev[i]?.revealed) {
        setRevealAnim(r => ({ ...r, [i]: true }));
        setTimeout(() => setRevealAnim(r => { const n = { ...r }; delete n[i]; return n; }), 1200);
      }
    });
    prevAnswersRef.current = answers;
  }, [answers]);

  // Watch bye_count increase → show ✗
  useEffect(() => {
    const curr = gs.bye_count || 0;
    if (curr > prevByeCount.current) { setShowWrongX(true); setTimeout(() => setShowWrongX(false), 1200); }
    prevByeCount.current = curr;
  }, [gs.bye_count]);

  const players = gs.players || [];
  const faceoffMode = gs.faceoff_mode || false;
  const buzzWinner = gs.buzz_winner || null;
  const buzzAlreadyWon = !!buzzWinner;
  const onPlayerMode = gs.one_player_mode || false;
  const stealMode = gs.steal_mode || false;
  const stealPlayerId = gs.steal_player_id || null;

  const activeTurn = gs.active_turn || 1;
  const activeFamilyName = activeTurn === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');
  const activeFamilyColor = activeTurn === 1 ? '#BC13FE' : '#FF5F1F';

  const myFaceoffId = selectedFamily === 1 ? gs.faceoff_player1_id : gs.faceoff_player2_id;
  const faceoffPlayersAssigned = !!(gs.faceoff_player1_id || gs.faceoff_player2_id);
  const iAmFaceoffPlayer = isSeated && playerId && (!faceoffPlayersAssigned || myFaceoffId === playerId);
  const iAmBuzzWinner = buzzWinner?.playerId === playerId;
  const iAmAnsweringPlayer = isSeated && playerId && gs.answering_player_id === playerId;
  const iAmStealPlayer = stealMode && stealPlayerId === playerId;

  // 1-player mode: single player can always answer
  const canAnswer = onPlayerMode
    ? (isSeated && gs.answering_player_id === playerId)
    : (iAmAnsweringPlayer || iAmStealPlayer);

  const pendingDecision = gs.pending_decision || null;
  const iAmDecisionPlayer = pendingDecision && pendingDecision.playerId === playerId;

  const byeCount = gs.bye_count || 0;
  const byeFlash = gs.bye_flash || 0;
  const byeComplete = byeCount >= 3;

  // ── Buzzer (faceoff only, disabled in 1P and steal mode) ──
  const handleBuzz = async () => {
    if (!isSeated || !playerId || !faceoffMode || buzzAlreadyWon || !iAmFaceoffPlayer || onPlayerMode) return;
    setBuzzAnim(true);
    setTimeout(() => setBuzzAnim(false), 600);
    await updateState({
      buzz_winner: { playerId, seatNumber, familyTeam: selectedFamily, timestamp: Date.now() },
      faceoff_mode: false,
      answering_player_id: playerId,
    });
  };

  const handleTyping = async (value) => {
    setAnswerInput(value);
    await updateState({ current_typing: value });
  };

  const handleSubmitAnswer = async (method = 'typed') => {
    const answer = answerInput.trim();
    if (!answer || !canAnswer) return;

    const matchIdx = matchAnswer(answer, answers);
    const alreadyRevealed = matchIdx !== -1 && answers[matchIdx].revealed;

    if (matchIdx !== -1 && !alreadyRevealed) {
      const ans = answers[matchIdx];
      const newAnswers = answers.map((a, i) => i === matchIdx ? { ...a, revealed: true } : a);
      const newBank = (gs.round_bank || 0) + (ans.points || 0);

      const myFam = onPlayerMode ? 1 : (stealMode ? gs.active_turn : selectedFamily);
      const myFamilyPlayers = players.filter(p => Number(p.familyTeam) === Number(myFam));
      const myIdx = myFamilyPlayers.findIndex(p => p.playerId === playerId);
      const nextInFamily = myFamilyPlayers[(myIdx + 1) % myFamilyPlayers.length] || null;

      await updateState({
        answers: newAnswers,
        round_bank: newBank,
        current_typing: '',
        last_submission: { playerId, seatNumber, familyTeam: myFam, submittedAnswer: answer, inputMethod: method, timestamp: Date.now(), result: 'correct' },
        pending_decision: {
          playerId, seatNumber, familyTeam: myFam,
          answeredText: ans.text || ans.answer,
          points: ans.points || 0,
          nextInFamilyId: nextInFamily?.playerId || null,
          nextInFamilySeat: nextInFamily?.seatNumber || null,
          oppositeFamilyTeam: myFam === 1 ? 2 : 1,
        },
        answering_player_id: null,
        buzz_winner: null,
        steal_mode: false,
        steal_player_id: null,
      });
      setAnswerInput('');
    } else if (alreadyRevealed) {
      setSubmitMsg('Already on the board!');
      setTimeout(() => setSubmitMsg(''), 2500);
    } else {
      // Wrong — show X, host will add BYE
      setShowWrongX(true);
      setTimeout(() => setShowWrongX(false), 1200);
      await updateState({
        last_submission: { playerId, seatNumber, familyTeam: selectedFamily, submittedAnswer: answer, inputMethod: method, timestamp: Date.now(), result: 'wrong' },
        current_typing: '',
        answering_player_id: null,
        buzz_winner: null,
        steal_mode: false,
        steal_player_id: null,
      });
      setAnswerInput('');
      setSubmitMsg('Not on the board!');
      setTimeout(() => setSubmitMsg(''), 3000);
    }
  };

  const handleAccept = async () => {
    if (!pendingDecision) return;
    const { nextInFamilyId, familyTeam } = pendingDecision;
    await updateState({
      pending_decision: null, active_turn: Number(familyTeam),
      answering_player_id: nextInFamilyId || null,
      buzz_winner: null, faceoff_mode: false,
      steal_mode: false, steal_player_id: null,
    });
  };

  const handleDecline = async () => {
    if (!pendingDecision) return;
    const { oppositeFamilyTeam } = pendingDecision;
    const oppPlayers = players.filter(p => Number(p.familyTeam) === Number(oppositeFamilyTeam));
    const nextOpp = oppPlayers[0] || null;
    await updateState({
      pending_decision: null, active_turn: Number(oppositeFamilyTeam),
      answering_player_id: nextOpp?.playerId || null,
      buzz_winner: null, faceoff_mode: false,
      steal_mode: false, steal_player_id: null,
    });
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSubmitMsg('Voice not supported.'); setTimeout(() => setSubmitMsg(''), 3000); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.onresult = (e) => { const t = e.results[0][0].transcript.trim(); setAnswerInput(t); };
    recognitionRef.current = r; r.start();
  };

  // Buzzer state
  const buzzerActive = !onPlayerMode && faceoffMode && iAmFaceoffPlayer && !buzzAlreadyWon;
  let buzzerLabel = onPlayerMode ? '1P MODE' : 'BUZZ IN';
  let buzzerColor = '#FF5F1F';
  let buzzerSubtext = '';

  if (onPlayerMode) {
    buzzerColor = '#FFD700';
    buzzerSubtext = 'Answer when ready';
  } else if (stealMode) {
    buzzerColor = '#FF5F1F';
    const stealFamilyNum = gs.steal_family || (activeTurn === 1 ? 2 : 1);
    const stealFamilyName = stealFamilyNum === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');
    buzzerLabel = 'STEAL';
    buzzerSubtext = iAmStealPlayer ? 'Your steal attempt!' : `${stealFamilyName} steals`;
  } else if (faceoffMode && !buzzAlreadyWon) {
    buzzerSubtext = iAmFaceoffPlayer ? 'BUZZ FIRST!' : 'Waiting for faceoff…';
    buzzerColor = iAmFaceoffPlayer ? '#FF5F1F' : '#ffffff20';
  } else if (!faceoffMode && !buzzAlreadyWon) {
    buzzerColor = '#ffffff15';
    if (gs.answering_player_id) {
      const ap = players.find(p => p.playerId === gs.answering_player_id);
      buzzerSubtext = ap ? `Seat ${ap.seatNumber} answering` : 'Answering…';
    } else {
      buzzerSubtext = `${activeFamilyName}'s turn`;
    }
  } else if (buzzAlreadyWon) {
    buzzerColor = '#BC13FE';
    buzzerLabel = iAmBuzzWinner ? 'YOU BUZZED!' : `SEAT ${buzzWinner.seatNumber} BUZZED`;
    buzzerSubtext = buzzWinner.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');
  }

  const showAnswerInput = gs.phase === 'playing' && !pendingDecision && !byeComplete && canAnswer;
  const myFamilyColor = selectedFamily === 1 ? '#BC13FE' : '#FF5F1F';

  // Next answering player info
  const nextAnsweringPlayer = gs.next_answering_player_id
    ? players.find(p => p.playerId === gs.next_answering_player_id)
    : null;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-5 max-w-5xl mx-auto w-full relative">
      <WrongXPopup show={showWrongX} />

      {/* Locked overlay */}
      {locked && (
        <div className="absolute inset-0 z-20 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center gap-4 pointer-events-none rounded-xl">
          <div className="w-12 h-12 border-4 border-[#FFD700]/40 border-t-[#FFD700] rounded-full animate-spin" />
          <div className="text-[#FFD700] text-[10px] tracking-[0.3em] uppercase" style={sty}>
            {!gs.phase || gs.phase === 'setup' ? 'Waiting for Host to Start…' : 'Connecting…'}
          </div>
          {!onPlayerMode && (
            <button className="text-[7px] tracking-widest text-white/20 uppercase hover:text-white/50 transition-colors pointer-events-auto mt-2" style={sty} onClick={onChangeFamily}>
              ← Change Family
            </button>
          )}
        </div>
      )}

      {/* 1-Player Mode banner */}
      {onPlayerMode && gs.phase === 'playing' && (
        <div className="px-5 py-3 rounded-xl border-2 border-[#FFD700] bg-[#FFD700]/10 text-center"
          style={{ boxShadow: '0 0 20px rgba(255,215,0,0.2)' }}>
          <div className="font-heading text-sm tracking-widest text-[#FFD700] uppercase" style={sty}>
            ⭐ 1 PLAYER MODE
          </div>
          {players[0] && (
            <div className="text-[8px] tracking-widest text-white/50 uppercase mt-1" style={sty}>
              Seat {players[0].seatNumber} is playing
            </div>
          )}
        </div>
      )}

      {/* Steal Mode banner */}
      {stealMode && !onPlayerMode && (
        <div className="px-5 py-3 rounded-xl border-2 border-[#FF5F1F] bg-[#FF5F1F]/10 text-center animate-pulse"
          style={{ boxShadow: '0 0 20px rgba(255,95,31,0.3)' }}>
          <div className="font-heading text-sm tracking-widest text-[#FF5F1F] uppercase" style={sty}>
            🎯 STEAL ATTEMPT
          </div>
          {stealPlayerId && (
            <div className="text-[8px] tracking-widest text-white/50 uppercase mt-1" style={sty}>
              Seat {players.find(p => p.playerId === stealPlayerId)?.seatNumber || '?'} answering
            </div>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-4 items-center">
        <FamilyScore name={gs.family1 || 'Family 1'} score={gs.score1 || 0} isActive={gs.active_turn === 1} color="#BC13FE" isMyTeam={selectedFamily === 1} />
        <div className="text-center space-y-1">
          <div className="font-heading text-xs tracking-[0.25em] text-white/30 uppercase" style={sty}>Bank</div>
          <div className="font-heading text-3xl text-[#FF5F1F]" style={{ textShadow: '0 0 15px rgba(255,95,31,0.5)' }}>{gs.round_bank || 0}</div>
          <div className="pt-2">
            <BYEDisplay byeCount={byeCount} byeFlash={byeFlash} />
          </div>
        </div>
        <FamilyScore name={gs.family2 || 'Family 2'} score={gs.score2 || 0} isActive={gs.active_turn === 2} color="#FF5F1F" isMyTeam={selectedFamily === 2} />
      </div>

      {/* BYE complete notice */}
      {byeComplete && (
        <div className="px-5 py-3 rounded-xl border-2 border-[#FF5F1F] bg-[#FF5F1F]/10 text-center" style={{ boxShadow: '0 0 30px rgba(255,95,31,0.3)' }}>
          <div className="font-heading text-lg tracking-widest text-[#FF5F1F] uppercase animate-pulse" style={sty}>
            ✗ BYE — Host deciding next action
          </div>
        </div>
      )}

      {/* Question */}
      {gs.current_question && (
        <div className="px-6 py-4 rounded-2xl border-2 border-[#FFD700]/40 bg-[#FFD700]/5 text-center" style={{ boxShadow: '0 0 20px rgba(255,215,0,0.1)' }}>
          <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/60 uppercase mb-2" style={sty}>Survey Says…</div>
          <div className="font-heading text-xl md:text-2xl text-white tracking-wide leading-snug">{gs.current_question}</div>
        </div>
      )}

      {/* PENDING DECISION BANNER */}
      {pendingDecision && (
        <DecisionBanner pendingDecision={pendingDecision} iAmDecisionPlayer={iAmDecisionPlayer} gs={gs} onAccept={handleAccept} onDecline={handleDecline} />
      )}

      {/* Live typing */}
      {!pendingDecision && gs.answering_player_id && gs.phase === 'playing' && (
        <div className="px-5 py-3 rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/5 flex items-center gap-3 min-h-[3rem]">
          <span className="text-[7px] tracking-widest text-[#22d3ee]/50 uppercase shrink-0" style={sty}>Typing:</span>
          <span className="font-heading text-xl tracking-widest text-white flex-1">{gs.current_typing || <span className="text-white/15">…</span>}</span>
          <span className="w-2 h-5 bg-[#22d3ee]/60 animate-pulse rounded-sm shrink-0" />
        </div>
      )}

      {/* Main layout */}
      <div className="flex gap-5 items-start">
        {/* Answer Board */}
        <div className="flex-1 min-w-0">
          {answers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {answers.map((ans, i) => (
                <AnswerSlot key={i} rank={i + 1} answer={ans} isAnimating={!!revealAnim[i]} />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="font-heading text-sm tracking-widest text-white/20 uppercase" style={sty}>Host is loading a survey…</div>
            </div>
          )}
        </div>

        {/* RIGHT: Buzzer + Answer Input */}
        <div className="shrink-0 flex flex-col items-center gap-4 w-48 md:w-56">

          {/* Buzzer */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleBuzz}
              disabled={!buzzerActive || locked || onPlayerMode}
              className="relative w-36 h-36 md:w-44 md:h-44 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-200 select-none"
              style={{
                borderColor: onPlayerMode ? '#FFD700' : buzzerActive ? '#FF5F1F' : buzzAlreadyWon ? '#BC13FE' : stealMode && iAmStealPlayer ? '#FF5F1F' : '#ffffff10',
                background: onPlayerMode ? 'radial-gradient(circle,#FFD70015,transparent)'
                  : buzzerActive ? 'radial-gradient(circle,#FF5F1F25,#FF5F1F08)'
                  : buzzAlreadyWon ? 'radial-gradient(circle,#BC13FE20,#BC13FE08)'
                  : 'radial-gradient(circle,#ffffff05,transparent)',
                boxShadow: buzzerActive ? `0 0 ${buzzAnim ? '50px' : '20px'} rgba(255,95,31,0.5)` : buzzAlreadyWon ? '0 0 30px rgba(188,19,254,0.6)' : onPlayerMode ? '0 0 20px rgba(255,215,0,0.2)' : 'none',
                transform: buzzAnim ? 'scale(0.93)' : 'scale(1)',
                cursor: (!buzzerActive || locked || onPlayerMode) ? 'not-allowed' : 'pointer',
                opacity: !onPlayerMode && !buzzerActive && !buzzAlreadyWon && !faceoffMode && !stealMode ? 0.3 : 1,
              }}
            >
              <div className="font-heading text-center leading-tight px-2"
                style={{
                  ...sty,
                  fontSize: buzzerActive ? '13px' : buzzAlreadyWon ? '9px' : '10px',
                  color: onPlayerMode ? '#FFD700' : buzzerActive ? '#FF5F1F' : buzzAlreadyWon ? '#BC13FE' : '#ffffff20',
                  textShadow: buzzerActive ? '0 0 10px rgba(255,95,31,0.6)' : buzzAlreadyWon ? '0 0 15px rgba(188,19,254,0.8)' : 'none',
                }}>
                {buzzerLabel}
              </div>
              {buzzerActive && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#FF5F1F', animationDuration: '1.5s' }} />
              )}
            </button>

            {/* Subtext */}
            <div className="text-center px-2 space-y-1">
              <div className="text-[7px] tracking-widest uppercase" style={{ ...sty, color: buzzerActive ? '#FF5F1F' : buzzAlreadyWon ? '#BC13FE' : onPlayerMode ? '#FFD700' : '#ffffff30', maxWidth: '160px' }}>
                {buzzerSubtext}
              </div>
              {!faceoffMode && !pendingDecision && !onPlayerMode && (
                <div className="px-2 py-1 rounded border text-[7px] tracking-widest uppercase text-center"
                  style={{ borderColor: `${activeFamilyColor}40`, color: activeFamilyColor, background: `${activeFamilyColor}10`, ...sty }}>
                  {activeFamilyName}'s TURN
                </div>
              )}
              {/* Next player hint */}
              {nextAnsweringPlayer && !canAnswer && gs.answering_player_id && gs.answering_player_id !== playerId && (
                <div className="text-[6px] tracking-widest text-white/20 uppercase mt-1" style={sty}>
                  Next: Seat {nextAnsweringPlayer.seatNumber}
                </div>
              )}
            </div>
          </div>

          {/* Buzz winner badge */}
          {buzzWinner && !pendingDecision && (
            <div className="w-full px-3 py-3 rounded-xl border-2 text-center"
              style={{ borderColor: '#BC13FE', background: '#BC13FE10', boxShadow: '0 0 15px rgba(188,19,254,0.3)' }}>
              <div className="text-[7px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={sty}>Buzzed In</div>
              <div className="font-heading text-base text-white">Seat {buzzWinner.seatNumber}</div>
              <div className="text-[7px] text-[#BC13FE]/70 uppercase mt-0.5" style={sty}>
                {buzzWinner.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')}
              </div>
            </div>
          )}

          {/* Answer input */}
          {showAnswerInput && (
            <div className="w-full space-y-2">
              <div className="text-[7px] tracking-widest text-center uppercase mb-1"
                style={{ ...sty, color: canAnswer ? '#4ade80' : '#ffffff30' }}>
                {canAnswer ? (iAmStealPlayer ? '🎯 Your steal!' : '✓ Your turn to answer') : 'Waiting for your turn…'}
              </div>
              <input
                autoFocus={canAnswer}
                className="w-full px-3 py-2 rounded-lg bg-black/80 border-2 text-white font-body text-sm focus:outline-none transition-colors"
                style={{ borderColor: canAnswer ? (iAmStealPlayer ? '#FF5F1F' : '#4ade80') : '#ffffff15' }}
                value={answerInput}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder={canAnswer ? 'Type answer…' : '—'}
                disabled={!canAnswer || locked}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer('typed')}
              />
              <div className="flex gap-2">
                <button onClick={toggleVoice} disabled={!canAnswer || locked}
                  className="flex-1 py-2 rounded-lg border-2 font-heading text-xs transition-all disabled:opacity-30"
                  style={{ borderColor: isListening ? '#ef4444' : '#22d3ee40', color: isListening ? '#ef4444' : '#22d3ee70' }}>
                  {isListening ? '🔴' : '🎙'}
                </button>
                <button onClick={() => handleSubmitAnswer('typed')}
                  disabled={!canAnswer || !answerInput.trim() || locked}
                  className="flex-1 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all disabled:opacity-30"
                  style={{ borderColor: iAmStealPlayer ? '#FF5F1F' : '#4ade80', color: iAmStealPlayer ? '#FF5F1F' : '#4ade80' }}>
                  SUBMIT
                </button>
              </div>
              {submitMsg && (
                <div className="text-[8px] text-center tracking-widest uppercase"
                  style={{ ...sty, color: submitMsg.includes('Not') ? '#ef4444' : submitMsg.includes('Already') ? '#FFD700' : '#4ade80' }}>
                  {submitMsg}
                </div>
              )}
            </div>
          )}

          {/* Waiting message for non-active players */}
          {gs.phase === 'playing' && !pendingDecision && !byeComplete && !canAnswer && !faceoffMode && gs.answering_player_id && gs.answering_player_id !== playerId && (
            <div className="w-full px-3 py-3 rounded-xl border border-white/10 bg-white/5 text-center">
              <div className="text-[7px] tracking-widest text-white/30 uppercase" style={sty}>Waiting for your turn</div>
              {nextAnsweringPlayer && <div className="text-[6px] text-white/20 uppercase mt-1" style={sty}>You're next: Seat {nextAnsweringPlayer.seatNumber}</div>}
            </div>
          )}

          {/* Wrong answer feedback */}
          {gs.last_submission?.result === 'wrong' && !pendingDecision && (
            <div className="w-full px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-center">
              <div className="text-[7px] tracking-widest text-red-400 uppercase" style={sty}>Not on the board</div>
              <div className="font-heading text-sm text-red-300 mt-1">"{gs.last_submission.submittedAnswer}"</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── DECISION BANNER ── */
function DecisionBanner({ pendingDecision, iAmDecisionPlayer, gs, onAccept, onDecline }) {
  const { answeredText, points, familyTeam, seatNumber: buzzSeat, oppositeFamilyTeam } = pendingDecision;
  const myTeamName = familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');
  const oppTeamName = oppositeFamilyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');

  return (
    <div className="rounded-2xl border-2 border-[#4ade80] bg-[#4ade80]/5 overflow-hidden"
      style={{ boxShadow: '0 0 30px rgba(74,222,128,0.25)' }}>
      <div className="px-6 py-4 text-center border-b border-[#4ade80]/20">
        <div className="text-[8px] tracking-[0.3em] text-[#4ade80]/70 uppercase mb-1" style={sty}>✓ On The Board!</div>
        <div className="font-heading text-3xl md:text-4xl text-white tracking-widest uppercase" style={{ textShadow: '0 0 20px rgba(74,222,128,0.4)' }}>{answeredText}</div>
        <div className="font-heading text-xl text-[#FF5F1F] mt-1">{points} pts</div>
        <div className="text-[7px] tracking-widest text-white/40 uppercase mt-1" style={sty}>Seat {buzzSeat} — {myTeamName}</div>
      </div>
      <div className="px-6 py-4">
        {iAmDecisionPlayer ? (
          <div className="space-y-3">
            <div className="text-[8px] tracking-[0.25em] text-white/60 uppercase text-center" style={sty}>Your call — play the board or pass?</div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onAccept} className="py-4 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all active:scale-95 hover:scale-105"
                style={{ borderColor: '#4ade80', color: '#4ade80', background: '#4ade8015' }}>
                ✓ PLAY<br /><span className="text-[7px] opacity-60" style={sty}>My team plays</span>
              </button>
              <button onClick={onDecline} className="py-4 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all active:scale-95 hover:scale-105"
                style={{ borderColor: '#ef4444', color: '#ef4444', background: '#ef444415' }}>
                ✗ PASS<br /><span className="text-[7px] opacity-60" style={sty}>{oppTeamName} plays</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="text-[8px] tracking-[0.25em] text-white/50 uppercase animate-pulse" style={sty}>Waiting for Seat {buzzSeat} to decide…</div>
          </div>
        )}
      </div>
    </div>
  );
}

function FamilyScore({ name, score, isActive, color, isMyTeam }) {
  return (
    <div className="p-4 border-2 rounded-xl text-center transition-all duration-500"
      style={{ borderColor: isActive ? color : isMyTeam ? `${color}60` : `${color}30`, background: isActive ? `${color}12` : isMyTeam ? `${color}08` : 'black', boxShadow: isActive ? `0 0 25px ${color}40` : isMyTeam ? `0 0 12px ${color}20` : 'none' }}>
      <div className="font-heading text-sm tracking-widest text-white uppercase truncate">{name}</div>
      <div className="font-heading text-4xl mt-1" style={{ color, textShadow: isActive ? `0 0 20px ${color}` : 'none' }}>{score}</div>
      {isMyTeam && !isActive && <div className="text-[8px] tracking-widest mt-1 uppercase font-heading text-white/30" style={sty}>YOUR TEAM</div>}
      {isActive && <div className="text-[9px] tracking-widest mt-1 uppercase font-heading" style={{ color, ...sty }}>▶ ACTIVE</div>}
    </div>
  );
}

function AnswerSlot({ rank, answer, isAnimating }) {
  const revealed = answer.revealed;
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all duration-500"
      style={{ borderColor: revealed ? '#FFD700' : '#ffffff15', background: isAnimating ? 'linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,95,31,0.15))' : revealed ? 'rgba(255,215,0,0.07)' : 'rgba(0,0,0,0.5)', boxShadow: isAnimating ? '0 0 30px rgba(255,215,0,0.5)' : revealed ? '0 0 12px rgba(255,215,0,0.15)' : 'none', transform: isAnimating ? 'scale(1.02)' : 'scale(1)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2"
        style={{ borderColor: revealed ? '#FFD700' : '#ffffff20', color: revealed ? '#FFD700' : '#ffffff30', ...sty, fontSize: '10px' }}>{rank}</div>
      <div className="flex-1 font-heading text-lg tracking-wide uppercase">
        {revealed ? <span style={{ color: '#ffffff', textShadow: isAnimating ? '0 0 10px rgba(255,215,0,0.6)' : 'none' }}>{answer.text || answer.answer}</span>
          : <span className="text-white/10">{'— — — — —'}</span>}
      </div>
      <div className="font-heading text-lg shrink-0" style={{ ...sty, fontSize: '11px' }}>
        {revealed ? <span style={{ color: '#FF5F1F', textShadow: isAnimating ? '0 0 10px rgba(255,95,31,0.8)' : 'none' }}>{answer.points}</span>
          : <span className="text-white/10">??</span>}
      </div>
    </div>
  );
}