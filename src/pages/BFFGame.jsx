import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat';
import SeatBadge from '@/components/game/SeatBadge.jsx';

const sty = { fontFamily: "'Press Start 2P', monospace" };

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

  // Family selection — persisted per room/player
  const familyKey = `tn_bff_family_${roomCode}_${playerId || 'anon'}`;
  const [selectedFamily, setSelectedFamily] = useState(() => {
    const v = localStorage.getItem(familyKey);
    return v ? Number(v) : null;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Auto-assign to family with fewer players on mid-game join
  useEffect(() => {
    if (!isSeated || selectedFamily || !gs.phase || gs.phase === 'setup') return;
    const players = gs.players || [];
    const f1 = players.filter(p => p.familyTeam === 1 || p.familyTeam === '1').length;
    const f2 = players.filter(p => p.familyTeam === 2 || p.familyTeam === '2').length;
    if (f1 < f2) {
      handleChooseFamily(1, true);
    } else if (f2 < f1) {
      handleChooseFamily(2, true);
    }
    // If equal — let player choose (don't auto-assign)
  }, [isSeated, selectedFamily, gs.phase, gs.players]);

  // Sync family choice into player record
  const familySyncedRef = useRef(false);
  useEffect(() => {
    if (!isSeated || !selectedFamily || !playerId || familySyncedRef.current) return;
    const players = gs.players || [];
    const existing = players.find(p => p.playerId === playerId);
    if (!existing || existing.familyTeam === selectedFamily) { familySyncedRef.current = true; return; }
    familySyncedRef.current = true;
    const updated = players.map(p => p.playerId === playerId ? { ...p, familyTeam: selectedFamily } : p);
    updateState({ players: updated });
  }, [isSeated, selectedFamily, playerId, gs.players, updateState]);

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
      const fname = familyNum === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');
      setAutoAssignedMsg(`You have been assigned to ${fname} to balance teams.`);
      setTimeout(() => setAutoAssignedMsg(''), 5000);
    }
  };

  const answers = gs.answers || [];
  const phase = gs.phase;
  const hostConnected = room?.host_connected;
  const myFamilyColor = selectedFamily === 1 ? '#BC13FE' : '#FF5F1F';
  const myFamilyName = selectedFamily === 1 ? (gs.family1 || 'Family 1') : selectedFamily === 2 ? (gs.family2 || 'Family 2') : null;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#050505]/95 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/"><img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" /></Link>
            <span className="text-[#FFD700] uppercase text-[10px] tracking-widest hidden sm:block" style={sty}>BFF — BIGO FAMILY FEUD</span>
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
            {selectedFamily && myFamilyName && (
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

      {/* Auto-assign toast */}
      {autoAssignedMsg && (
        <div className="fixed top-14 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-xl border border-[#FFD700]/50 bg-[#FFD700]/10 text-[#FFD700] text-[9px] tracking-widest uppercase text-center" style={sty}>
          {autoAssignedMsg}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedFamily ? (
        <FamilySelect
          family1={gs.family1}
          family2={gs.family2}
          seatNumber={seatNumber}
          isSeated={isSeated}
          onChoose={handleChooseFamily}
        />
      ) : (
        <GameBoard
          gs={gs}
          answers={answers}
          selectedFamily={selectedFamily}
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
        <div className="font-heading text-3xl tracking-widest text-[#FFD700] uppercase mb-2" style={{ textShadow: '0 0 20px rgba(255,215,0,0.4)' }}>
          Choose Your Family
        </div>
        {seatNumber && <div className="text-[9px] tracking-[0.25em] text-white/40 uppercase mt-1" style={sty}>You are Seat {seatNumber}</div>}
        {!isSeated && <div className="text-[8px] tracking-widest text-white/20 uppercase mt-1" style={sty}>Assigning seat…</div>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-lg">
        <button onClick={() => onChoose(1)}
          className="p-8 rounded-2xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/5 hover:bg-[#BC13FE]/15 hover:border-[#BC13FE] hover:scale-105 transition-all duration-200 active:scale-95">
          <div className="text-5xl mb-3">🟣</div>
          <div className="font-heading text-2xl tracking-widest uppercase text-[#BC13FE] mb-1" style={{ textShadow: '0 0 15px rgba(188,19,254,0.6)' }}>{name1}</div>
          <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase mt-1" style={sty}>Tap to join</div>
        </button>
        <button onClick={() => onChoose(2)}
          className="p-8 rounded-2xl border-2 border-[#FF5F1F]/50 bg-[#FF5F1F]/5 hover:bg-[#FF5F1F]/15 hover:border-[#FF5F1F] hover:scale-105 transition-all duration-200 active:scale-95">
          <div className="text-5xl mb-3">🟠</div>
          <div className="font-heading text-2xl tracking-widest uppercase text-[#FF5F1F] mb-1" style={{ textShadow: '0 0 15px rgba(255,95,31,0.6)' }}>{name2}</div>
          <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase mt-1" style={sty}>Tap to join</div>
        </button>
      </div>
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
  const recognitionRef = useRef(null);

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

  const myFamilyColor = selectedFamily === 1 ? '#BC13FE' : '#FF5F1F';
  const myFamilyName = selectedFamily === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');

  const faceoffMode = gs.faceoff_mode || false;
  const buzzWinner = gs.buzz_winner || null;
  const myFaceoffId = selectedFamily === 1 ? gs.faceoff_player1_id : gs.faceoff_player2_id;
  const iAmFaceoffPlayer = isSeated && playerId && myFaceoffId === playerId;
  const buzzAlreadyWon = !!buzzWinner;
  const iAmBuzzWinner = buzzWinner?.playerId === playerId;

  // Buzzer handler
  const handleBuzz = async () => {
    if (!isSeated || !playerId || !faceoffMode || buzzAlreadyWon || !iAmFaceoffPlayer) return;
    setBuzzAnim(true);
    setTimeout(() => setBuzzAnim(false), 600);
    await updateState({
      buzz_winner: {
        playerId,
        seatNumber,
        familyTeam: selectedFamily,
        timestamp: Date.now(),
      },
      faceoff_mode: false,
    });
  };

  // Answer submit
  const handleSubmitAnswer = async (method = 'typed') => {
    const answer = answerInput.trim();
    if (!answer) return;
    if (!iAmBuzzWinner) { setSubmitMsg('Only the buzz-in winner can answer.'); setTimeout(() => setSubmitMsg(''), 3000); return; }
    await updateState({
      last_submission: {
        playerId,
        seatNumber,
        familyTeam: selectedFamily,
        submittedAnswer: answer,
        inputMethod: method,
        timestamp: Date.now(),
      },
    });
    setAnswerInput('');
    setSubmitMsg('Answer submitted!');
    setTimeout(() => setSubmitMsg(''), 3000);
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSubmitMsg('Voice not supported in this browser.'); setTimeout(() => setSubmitMsg(''), 3000); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = () => { setIsListening(false); };
    r.onresult = (e) => {
      const t = e.results[0][0].transcript.trim();
      setAnswerInput(t);
      handleSubmitAnswer('spoken');
    };
    recognitionRef.current = r; r.start();
  };

  // Determine buzzer state
  let buzzerLabel = 'BUZZ IN';
  let buzzerColor = '#FF5F1F';
  let buzzerDisabled = true;
  let buzzerSubtext = '';

  if (!faceoffMode && !buzzWinner) {
    buzzerSubtext = 'Stand by…';
  } else if (buzzAlreadyWon) {
    buzzerColor = '#BC13FE';
    buzzerLabel = buzzWinner.seatNumber === seatNumber ? 'YOU BUZZED!' : `SEAT ${buzzWinner.seatNumber} BUZZED`;
    buzzerSubtext = `${buzzWinner.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')}`;
    buzzerDisabled = true;
  } else if (faceoffMode && iAmFaceoffPlayer && !buzzAlreadyWon) {
    buzzerDisabled = false;
    buzzerSubtext = 'You are in the faceoff!';
  } else if (faceoffMode && !iAmFaceoffPlayer) {
    buzzerSubtext = "Waiting for your team's faceoff player.";
  }

  // Answer input visibility: only show when buzz winner is set and this player won the buzz
  const showAnswerInput = !!buzzWinner && gs.phase === 'playing';

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-5 max-w-5xl mx-auto w-full relative">

      {/* Locked overlay */}
      {locked && (
        <div className="absolute inset-0 z-20 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center gap-4 pointer-events-none rounded-xl">
          <div className="w-12 h-12 border-4 border-[#FFD700]/40 border-t-[#FFD700] rounded-full animate-spin" />
          <div className="text-[#FFD700] text-[10px] tracking-[0.3em] uppercase" style={sty}>
            {!gs.phase || gs.phase === 'setup' ? 'Waiting for Host to Start…' : 'Connecting…'}
          </div>
          <button className="text-[7px] tracking-widest text-white/20 uppercase hover:text-white/50 transition-colors pointer-events-auto mt-2" style={sty} onClick={onChangeFamily}>
            ← Change Family
          </button>
        </div>
      )}

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-4 items-center">
        <FamilyScore name={gs.family1 || 'Family 1'} score={gs.score1 || 0} isActive={gs.active_turn === 1} color="#BC13FE" isMyTeam={selectedFamily === 1} />
        <div className="text-center">
          <div className="font-heading text-xs tracking-[0.25em] text-white/30 uppercase mb-1" style={sty}>Bank</div>
          <div className="font-heading text-3xl text-[#FF5F1F]" style={{ textShadow: '0 0 15px rgba(255,95,31,0.5)' }}>{gs.round_bank || 0}</div>
          {gs.byes > 0 && (
            <div className="mt-1 text-[9px] text-red-400 tracking-widest uppercase" style={sty}>BYE x{gs.byes}</div>
          )}
        </div>
        <FamilyScore name={gs.family2 || 'Family 2'} score={gs.score2 || 0} isActive={gs.active_turn === 2} color="#FF5F1F" isMyTeam={selectedFamily === 2} />
      </div>

      {/* Question */}
      {gs.current_question && (
        <div className="px-6 py-4 rounded-2xl border-2 border-[#FFD700]/40 bg-[#FFD700]/5 text-center" style={{ boxShadow: '0 0 20px rgba(255,215,0,0.1)' }}>
          <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/60 uppercase mb-2" style={sty}>Survey Says…</div>
          <div className="font-heading text-xl md:text-2xl text-white tracking-wide leading-snug">{gs.current_question}</div>
        </div>
      )}

      {/* Main layout: answers LEFT + buzzer/actions RIGHT */}
      <div className="flex gap-5 items-start">

        {/* LEFT: Answer Board */}
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
              disabled={buzzerDisabled || locked}
              className="relative w-36 h-36 md:w-44 md:h-44 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-200 select-none"
              style={{
                borderColor: buzzAlreadyWon ? '#BC13FE' : buzzerDisabled ? '#ffffff15' : '#FF5F1F',
                background: buzzAlreadyWon
                  ? 'radial-gradient(circle, #BC13FE20, #BC13FE08)'
                  : buzzerDisabled
                    ? 'radial-gradient(circle, #ffffff05, transparent)'
                    : 'radial-gradient(circle, #FF5F1F25, #FF5F1F08)',
                boxShadow: buzzAlreadyWon
                  ? '0 0 30px rgba(188,19,254,0.6), 0 0 60px rgba(188,19,254,0.3), inset 0 0 20px rgba(188,19,254,0.1)'
                  : buzzerDisabled
                    ? 'none'
                    : `0 0 ${buzzAnim ? '50px' : '20px'} rgba(255,95,31,0.5), 0 0 ${buzzAnim ? '80px' : '40px'} rgba(255,95,31,0.2)`,
                transform: buzzAnim ? 'scale(0.93)' : 'scale(1)',
                cursor: buzzerDisabled || locked ? 'not-allowed' : 'pointer',
                opacity: buzzerDisabled && !buzzAlreadyWon && !faceoffMode ? 0.3 : 1,
              }}
            >
              <div className="font-heading text-center leading-tight"
                style={{
                  ...sty,
                  fontSize: buzzAlreadyWon ? '9px' : '13px',
                  color: buzzAlreadyWon ? '#BC13FE' : buzzerDisabled ? '#ffffff20' : '#FF5F1F',
                  textShadow: buzzAlreadyWon ? '0 0 15px rgba(188,19,254,0.8)' : !buzzerDisabled ? '0 0 10px rgba(255,95,31,0.6)' : 'none',
                }}>
                {buzzerLabel}
              </div>
              {/* Ring pulse when active */}
              {!buzzerDisabled && !buzzAlreadyWon && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#FF5F1F', animationDuration: '1.5s' }} />
              )}
            </button>
            <div className="text-[7px] text-center tracking-widest uppercase px-2" style={{ ...sty, color: buzzAlreadyWon ? '#BC13FE' : '#ffffff30', maxWidth: '160px' }}>
              {buzzerSubtext}
            </div>
          </div>

          {/* Buzz winner banner */}
          {buzzWinner && (
            <div className="w-full px-3 py-3 rounded-xl border-2 text-center"
              style={{ borderColor: '#BC13FE', background: '#BC13FE10', boxShadow: '0 0 15px rgba(188,19,254,0.3)' }}>
              <div className="text-[7px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={sty}>Buzzed In</div>
              <div className="font-heading text-base text-white">Seat {buzzWinner.seatNumber}</div>
              <div className="text-[7px] text-[#BC13FE]/70 uppercase mt-0.5" style={sty}>
                {buzzWinner.familyTeam === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2')}
              </div>
            </div>
          )}

          {/* Answer input — only for buzz winner */}
          {showAnswerInput && (
            <div className="w-full space-y-2">
              <div className="text-[7px] tracking-widest text-center uppercase mb-1"
                style={{ ...sty, color: iAmBuzzWinner ? '#4ade80' : '#ffffff30' }}>
                {iAmBuzzWinner ? '✓ Your turn to answer' : 'Only buzz winner answers'}
              </div>
              <input
                className="w-full px-3 py-2 rounded-lg bg-black/80 border-2 text-white font-body text-sm focus:outline-none transition-colors"
                style={{ borderColor: iAmBuzzWinner ? '#4ade80' : '#ffffff15', color: iAmBuzzWinner ? 'white' : '#ffffff30' }}
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder={iAmBuzzWinner ? 'Your answer…' : '—'}
                disabled={!iAmBuzzWinner || locked}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer('typed')}
              />
              <div className="flex gap-2">
                <button
                  onClick={toggleVoice}
                  disabled={!iAmBuzzWinner || locked}
                  className="flex-1 py-2 rounded-lg border-2 font-heading text-xs transition-all disabled:opacity-30"
                  style={{ borderColor: isListening ? '#ef4444' : '#22d3ee40', color: isListening ? '#ef4444' : '#22d3ee70' }}>
                  {isListening ? '🔴' : '🎙'}
                </button>
                <button
                  onClick={() => handleSubmitAnswer('typed')}
                  disabled={!iAmBuzzWinner || !answerInput.trim() || locked}
                  className="flex-1 py-2 rounded-lg border-2 font-heading text-xs tracking-widest uppercase transition-all disabled:opacity-30"
                  style={{ borderColor: '#4ade80', color: '#4ade80' }}>
                  SUBMIT
                </button>
              </div>
              {submitMsg && (
                <div className="text-[8px] text-center tracking-widest uppercase"
                  style={{ ...sty, color: submitMsg.includes('Only') ? '#ef4444' : '#4ade80' }}>
                  {submitMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FamilyScore({ name, score, isActive, color, isMyTeam }) {
  return (
    <div className="p-4 border-2 rounded-xl text-center transition-all duration-500"
      style={{
        borderColor: isActive ? color : isMyTeam ? `${color}60` : `${color}30`,
        background: isActive ? `${color}12` : isMyTeam ? `${color}08` : 'black',
        boxShadow: isActive ? `0 0 25px ${color}40` : isMyTeam ? `0 0 12px ${color}20` : 'none',
      }}>
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
      style={{
        borderColor: revealed ? '#FFD700' : '#ffffff15',
        background: isAnimating ? 'linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,95,31,0.15))' : revealed ? 'rgba(255,215,0,0.07)' : 'rgba(0,0,0,0.5)',
        boxShadow: isAnimating ? '0 0 30px rgba(255,215,0,0.5),0 0 60px rgba(255,95,31,0.2)' : revealed ? '0 0 12px rgba(255,215,0,0.15)' : 'none',
        transform: isAnimating ? 'scale(1.02)' : 'scale(1)',
      }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2"
        style={{ borderColor: revealed ? '#FFD700' : '#ffffff20', color: revealed ? '#FFD700' : '#ffffff30', ...sty, fontSize: '10px' }}>
        {rank}
      </div>
      <div className="flex-1 font-heading text-lg tracking-wide uppercase">
        {revealed
          ? <span style={{ color: '#ffffff', textShadow: isAnimating ? '0 0 10px rgba(255,215,0,0.6)' : 'none' }}>{answer.text || answer.answer}</span>
          : <span className="text-white/10">{'— — — — —'}</span>
        }
      </div>
      <div className="font-heading text-lg shrink-0" style={{ ...sty, fontSize: '11px' }}>
        {revealed
          ? <span style={{ color: '#FF5F1F', textShadow: isAnimating ? '0 0 10px rgba(255,95,31,0.8)' : 'none' }}>{answer.points}</span>
          : <span className="text-white/10">??</span>
        }
      </div>
    </div>
  );
}