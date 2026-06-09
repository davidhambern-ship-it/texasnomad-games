import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import BYEDisplay from '@/components/game/BYEDisplay.jsx';
import RoleSelection from '@/components/game/RoleSelection.jsx';
import { findMatchingAnswer } from '@/lib/bffAnswerMatch';
import SinglePlayerPanel from '@/components/game/SinglePlayerPanel.jsx';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function BFFGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const cpuId = params.get('cpu');
  if (!roomCode) {
    window.location.href = '/';
    return null;
  }
  return <BFFViewer roomCode={roomCode} cpuId={cpuId} />;
}

function BFFViewer({ roomCode, cpuId }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'bff', 'viewer');
  const gs = room?.game_state || {};
  const isSinglePlayer = !!(cpuId || gs.single_player);
  const cpuCharacter = isSinglePlayer
    ? TEXASNOMAD_CHARACTERS.find(c => c.id === (cpuId || gs.cpu_opponent_id)) || null
    : null;

  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'bff', updateState);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  // Role gate: null = not chosen yet, 'participant', 'watcher'
  const [myRole, setMyRole] = useState(() => {
    return localStorage.getItem(`bff_role_${roomCode}`) || null;
  });
  const [roleLoading, setRoleLoading] = useState(false);
  // Family selection for participant
  const [myFamily, setMyFamily] = useState(null);

  const containerRef = useRef(null);
  const notifTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Detect my family from players list
  useEffect(() => {
    if (!playerId || !gs.players) return;
    const me = (gs.players || []).find(p => p.playerId === playerId);
    if (me?.familyTeam && !myFamily) setMyFamily(me.familyTeam);
  }, [gs.players, playerId]);

  // Watch last_submission to show notifications
  const lastSubRef = useRef(null);
  useEffect(() => {
    const sub = gs.last_submission;
    if (!sub) return;
    if (JSON.stringify(sub) === JSON.stringify(lastSubRef.current)) return;
    lastSubRef.current = sub;
    if (sub.playerId === playerId) {
      setNotification({ seatNumber: sub.seatNumber, letter: sub.submittedAnswer, result: sub.result });
      clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => setNotification(null), 2800);
    }
  }, [gs.last_submission]);

  const players = gs.players || [];
  const isParticipant = myRole === 'participant';
  const isWatcher = myRole === 'watcher';
  const isPlaying = gs.phase === 'playing';

  // Am I the answering player?
  const amAnswering = isParticipant && gs.answering_player_id === playerId;
  const amInSteal = isParticipant && gs.steal_mode && gs.steal_player_id === playerId;
  const canAnswer = (amAnswering || amInSteal) && isPlaying;

  // Participation role counts
  const participantPlayers = players.filter(p => p.role === 'participant' || p.role === 'hostPlayer');
  const f1Count = players.filter(p => p.familyTeam === 1 || p.familyTeam === '1').length;
  const f2Count = players.filter(p => p.familyTeam === 2 || p.familyTeam === '2').length;

  const handleChooseRole = async (role) => {
    setRoleLoading(true);
    try {
      // Update this player's role in the players array
      const updatedPlayers = (gs.players || []).map(p =>
        p.playerId === playerId ? { ...p, role } : p
      );
      await updateState({ players: updatedPlayers });
      localStorage.setItem(`bff_role_${roomCode}`, role);
      setMyRole(role);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleChooseFamily = async (familyTeam) => {
    const updatedPlayers = (gs.players || []).map(p =>
      p.playerId === playerId ? { ...p, familyTeam, role: 'participant' } : p
    );
    await updateState({ players: updatedPlayers });
    setMyFamily(familyTeam);
  };

  // Helper: get steal player from opposing family
  const getStealPlayerForFamily = (byeFamily, currentPlayers) => {
    const oppFam = byeFamily === 1 ? 2 : 1;
    const oppPlayers = currentPlayers.filter(p => (Number(p.familyTeam) === oppFam) && p.role === 'participant');
    return oppPlayers.length > 0 ? { player: oppPlayers[0], family: oppFam } : null;
  };

  const submitAnswer = async (guess) => {
    if (!guess.trim() || !canAnswer || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    const answers = gs.answers || [];
    const { idx: matchIdx } = findMatchingAnswer(guess, answers, true);

    const me = players.find(p => p.playerId === playerId);

    if (matchIdx !== -1) {
      // ── HIT: auto-reveal answer, add to bank ──
      const ans = answers[matchIdx];
      const newAnswers = answers.map((a, i) => i === matchIdx ? { ...a, revealed: true } : a);
      const newBank = (gs.round_bank || 0) + (ans.points || 0);

      // Check if this was a steal attempt
      const wasSteal = gs.steal_mode;

      const submission = {
        playerId, seatNumber, familyTeam: me?.familyTeam,
        submittedAnswer: guess, timestamp: Date.now(),
        inputMethod: isListening ? 'voice' : 'keyboard', result: 'correct',
      };

      if (wasSteal) {
        // Steal correct: award entire bank to steal family
        const stealFam = gs.steal_family || (me?.familyTeam);
        const scoreKey = stealFam === 1 ? 'score1' : 'score2';
        await updateState({
          answers: newAnswers,
          round_bank: 0,
          [scoreKey]: (gs[scoreKey] || 0) + newBank,
          last_submission: submission,
          steal_mode: false, steal_player_id: null,
          answering_player_id: null, current_typing: '',
          steal_result: 'correct',
        });
      } else {
        await updateState({
          answers: newAnswers, round_bank: newBank,
          last_submission: submission,
          answering_player_id: null, current_typing: '',
        });
      }
      setSubmitResult('hit');
    } else {
      // ── MISS: auto-add BYE strike ──
      const is2P = gs.two_player_mode || false;
      const currentFamilyTeam = me?.familyTeam || gs.active_turn || 1;
      const wasSteal = gs.steal_mode;

      const submission = {
        playerId, seatNumber, familyTeam: me?.familyTeam,
        submittedAnswer: guess, timestamp: Date.now(),
        inputMethod: isListening ? 'voice' : 'keyboard', result: 'wrong',
      };

      if (wasSteal) {
        // Steal wrong: bank is lost, round ends
        await updateState({
          last_submission: submission,
          steal_mode: false, steal_player_id: null,
          round_bank: 0, answering_player_id: null, current_typing: '',
          steal_result: 'wrong',
        });
      } else if (is2P) {
        // 2P mode: per-player BYE tracking
        const byeCounts2P = gs.bye_counts_2p || {};
        const playerByes = (byeCounts2P[playerId] || 0) + 1;
        const newBye2P = { ...byeCounts2P, [playerId]: playerByes };

        if (playerByes >= 3) {
          // BYE complete — trigger steal by opponent
          const stealInfo = getStealPlayerForFamily(currentFamilyTeam, players);
          await updateState({
            bye_counts_2p: newBye2P, bye_count: playerByes,
            last_submission: submission, buzz_winner: null,
            steal_mode: !!stealInfo, steal_player_id: stealInfo?.player?.playerId || null,
            steal_family: stealInfo?.family || (currentFamilyTeam === 1 ? 2 : 1),
            answering_player_id: stealInfo?.player?.playerId || null,
            active_turn: stealInfo?.family || (currentFamilyTeam === 1 ? 2 : 1),
            steal_result: null, current_typing: '',
          });
        } else {
          // Keep answering player the same — in 2P mode they play until full BYE
          await updateState({
            bye_counts_2p: newBye2P, bye_count: playerByes,
            last_submission: submission, buzz_winner: null,
            answering_player_id: playerId, current_typing: '',
          });
        }
      } else {
        // Full family mode: shared BYE count
        const newByeCount = Math.min(3, (gs.bye_count || 0) + 1);

        if (newByeCount >= 3) {
          // BYE complete — trigger steal
          const stealInfo = getStealPlayerForFamily(currentFamilyTeam, players);
          await updateState({
            bye_count: newByeCount, last_submission: submission,
            buzz_winner: null, answering_player_id: stealInfo?.player?.playerId || null,
            steal_mode: !!stealInfo, steal_player_id: stealInfo?.player?.playerId || null,
            steal_family: stealInfo?.family || (currentFamilyTeam === 1 ? 2 : 1),
            active_turn: stealInfo?.family || (currentFamilyTeam === 1 ? 2 : 1),
            steal_result: null, current_typing: '',
          });
        } else {
          // Pass to next player on same family
          const sameFamPlayers = players.filter(p => Number(p.familyTeam) === currentFamilyTeam && p.role === 'participant' && p.playerId !== playerId);
          const nextPlayer = sameFamPlayers.length > 0 ? sameFamPlayers[0] : null;
          await updateState({
            bye_count: newByeCount, last_submission: submission,
            buzz_winner: null, answering_player_id: nextPlayer?.playerId || null,
            current_typing: '',
          });
        }
      }
      setSubmitResult('miss');
    }

    setAnswerInput('');
    setIsSubmitting(false);
    setTimeout(() => setSubmitResult(null), 3000);
  };

  const handleTyping = async (val) => {
    setAnswerInput(val);
    if (canAnswer) {
      await updateState({ current_typing: val });
    }
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

  const handleBuzz = async () => {
    if (!isParticipant || !isPlaying || !gs.faceoff_mode) return;
    const me = players.find(p => p.playerId === playerId);
    if (!me) return;
    const fo1 = gs.faceoff_player1_id;
    const fo2 = gs.faceoff_player2_id;
    if (playerId !== fo1 && playerId !== fo2) return; // not a faceoff player
    if (gs.buzz_winner) return; // already buzzed
    await updateState({
      buzz_winner: { playerId, seatNumber, familyTeam: me.familyTeam },
      answering_player_id: playerId,
    });
  };

  // Show role gate if not yet chosen and seat is assigned
  if (isSeated && !myRole) {
    return (
      <div ref={containerRef} className="min-h-screen bg-[#070311] text-white">
        <BFFHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} isSinglePlayer={isSinglePlayer} />
        <RoleSelection
          roomCode={roomCode}
          seatNumber={seatNumber}
          onChooseRole={handleChooseRole}
          loading={roleLoading}
        />
      </div>
    );
  }

  // Participant: family selection (if no family yet)
  if (isParticipant && !myFamily) {
    return (
      <div ref={containerRef} className="min-h-screen bg-[#070311] text-white">
        <BFFHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} isSinglePlayer={isSinglePlayer} />
        <FamilySelector gs={gs} f1Count={f1Count} f2Count={f2Count} onChoose={handleChooseFamily} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />
      <BFFHeader roomCode={roomCode} room={room} isFullscreen={isFullscreen} containerRef={containerRef} seatNumber={seatNumber} isSeated={isSeated} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !isPlaying ? (
        <WaitingScreen isSeated={isSeated} seatNumber={seatNumber} role={myRole} gs={gs} isSinglePlayer={isSinglePlayer} />
      ) : (
        <GameScreen
          gs={gs}
          playerId={playerId}
          seatNumber={seatNumber}
          players={players}
          isParticipant={isParticipant}
          canAnswer={canAnswer}
          amAnswering={amAnswering}
          amInSteal={amInSteal}
          answerInput={answerInput}
          isSubmitting={isSubmitting}
          submitResult={submitResult}
          isListening={isListening}
          inputRef={inputRef}
          onTyping={handleTyping}
          onSubmit={submitAnswer}
          onBuzz={handleBuzz}
          onVoice={toggleVoice}
          myFamily={myFamily}
          isSinglePlayer={isSinglePlayer}
          cpuCharacter={cpuCharacter}
        />
      )}
    </div>
  );
}

function BFFHeader({ roomCode, room, isFullscreen, containerRef, seatNumber, isSeated, isSinglePlayer }) {
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
          {isSinglePlayer && (
            <span className="px-2 py-0.5 bg-[#FFD700]/10 border border-[#FFD700]/40 rounded text-[#FFD700] text-[7px] tracking-widest uppercase" style={PS2}>
              🤖 1P vs CPU
            </span>
          )}
          {!isSinglePlayer && room?.host_connected && (
            <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[7px] tracking-widest uppercase hidden sm:inline" style={PS2}>
              🔴 HOST LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
          <Link to="/" className="px-2 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[7px] tracking-widest uppercase hidden sm:block" style={PS2}>← LOBBY</Link>
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

function FamilySelector({ gs, f1Count, f2Count, onChoose }) {
  const suggested = f1Count <= f2Count ? 1 : 2;
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div>
          <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase mb-2">Choose Your Family</div>
          <div className="text-[8px] tracking-widest text-white/40 uppercase" style={PS2}>Pick the team you're playing for</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { fam: 1, name: gs.family1 || 'Family 1', color: '#BC13FE', count: f1Count },
            { fam: 2, name: gs.family2 || 'Family 2', color: '#FF5F1F', count: f2Count },
          ].map(({ fam, name, color, count }) => (
            <button key={fam} onClick={() => onChoose(fam)}
              className="p-6 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 text-center relative"
              style={{ borderColor: `${color}60`, background: `${color}08` }}>
              {fam === suggested && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#4ade80] text-black text-[6px] tracking-widest uppercase" style={PS2}>suggested</div>
              )}
              <div className="font-heading text-lg tracking-widest uppercase mb-2" style={{ color }}>{name}</div>
              <div className="text-[8px] text-white/40 uppercase" style={PS2}>{count} player{count !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameScreen({ gs, playerId, seatNumber, players, isParticipant, canAnswer, amAnswering, amInSteal, answerInput, isSubmitting, submitResult, isListening, inputRef, onTyping, onSubmit, onBuzz, onVoice, myFamily, isSinglePlayer, cpuCharacter }) {
  const isPlaying = gs.phase === 'playing';
  const answers = gs.answers || [];
  const faceoffMode = gs.faceoff_mode || false;
  const isFaceoffPlayer = faceoffMode && (playerId === gs.faceoff_player1_id || playerId === gs.faceoff_player2_id);
  const buzzWinner = gs.buzz_winner;
  const stealMode = gs.steal_mode || false;
  const byeCount = gs.bye_count || 0;
  const is2PMode = gs.two_player_mode || false;

  // Auto-focus input when it's my turn
  useEffect(() => {
    if (canAnswer && inputRef.current) {
      inputRef.current.focus();
    }
  }, [canAnswer]);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-xl mx-auto w-full">

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: gs.family1 || 'Family 1', score: gs.score1 || 0, turn: 1, color: '#BC13FE' },
          { name: gs.family2 || 'Family 2', score: gs.score2 || 0, turn: 2, color: '#FF5F1F' },
        ].map((f) => (
          <div key={f.turn} className="p-3 border-2 rounded-xl text-center transition-all"
            style={{ borderColor: gs.active_turn === f.turn ? '#FFD700' : `${f.color}30`, background: gs.active_turn === f.turn ? '#FFD70008' : 'transparent' }}>
            <div className="font-heading text-sm tracking-widest text-white uppercase truncate">{f.name}</div>
            <div className="font-heading text-3xl text-[#FFD700]">{f.score}</div>
            {gs.active_turn === f.turn && <div className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>▶ Active</div>}
          </div>
        ))}
      </div>

      {/* Round Bank — always visible during a round */}
      <div className="px-4 py-2 border border-[#FF5F1F]/40 rounded-xl bg-[#FF5F1F]/5 text-center">
        <div className="text-[8px] tracking-widest text-[#FF5F1F]/70 uppercase mb-1" style={PS2}>Round Bank</div>
        <div className="font-heading text-2xl text-[#FF5F1F]">{gs.round_bank || 0}</div>
      </div>

      {/* Question */}
      {gs.current_question && (
        <div className="px-5 py-4 border border-[#FFD700]/30 rounded-xl bg-[#FFD700]/5 text-center">
          <div className="text-[8px] tracking-widest text-[#FFD700]/50 uppercase mb-2" style={PS2}>★ Question</div>
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

      {/* Steal Mode Banner */}
      {stealMode && (
        <div className="px-4 py-3 rounded-xl border-2 border-[#FF5F1F] bg-[#FF5F1F]/10 text-center"
          style={{ boxShadow: '0 0 20px rgba(255,95,31,0.3)' }}>
          <div className="font-heading text-xl tracking-widest text-[#FF5F1F] uppercase">🎯 Steal Opportunity!</div>
          {amInSteal && <div className="text-[8px] text-[#FF5F1F]/80 tracking-widest uppercase mt-1" style={PS2}>You can steal the bank — give your best answer!</div>}
        </div>
      )}

      {/* Faceoff Banner */}
      {faceoffMode && !buzzWinner && isFaceoffPlayer && (
        <div className="px-4 py-4 rounded-xl border-2 border-[#FF5F1F]/60 bg-[#FF5F1F]/5 text-center">
          <div className="font-heading text-xl tracking-widest text-[#FF5F1F] uppercase mb-3">⚡ Faceoff!</div>
          <button onClick={onBuzz}
            className="px-8 py-4 rounded-xl border-2 border-[#FFD700] text-[#FFD700] font-heading text-xl tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
            style={{ boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}>
            🔔 BUZZ IN
          </button>
        </div>
      )}

      {/* Buzz Winner Banner */}
      {buzzWinner && (
        <div className="px-4 py-3 rounded-xl border-2 border-[#BC13FE] bg-[#BC13FE]/10 text-center"
          style={{ boxShadow: '0 0 20px rgba(188,19,254,0.3)' }}>
          <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={PS2}>⚡ Buzzed In</div>
          <div className="font-heading text-xl text-white">Seat {buzzWinner.seatNumber}</div>
        </div>
      )}

      {/* My turn indicator */}
      {amAnswering && !faceoffMode && (
        <div className="px-4 py-2 rounded-xl border border-[#4ade80]/50 bg-[#4ade80]/5 text-center">
          <div className="text-[8px] tracking-widest text-[#4ade80] uppercase" style={PS2}>▶ Your turn to answer!</div>
        </div>
      )}

      {/* Answer Input */}
      {isParticipant && isPlaying && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className={`flex-1 px-4 py-3 rounded-lg bg-black/80 border-2 text-white font-body text-base focus:outline-none transition-colors ${canAnswer ? 'border-[#4ade80]/60 focus:border-[#4ade80]' : 'border-white/10 text-white/30'}`}
              value={answerInput}
              onChange={(e) => onTyping(e.target.value)}
              placeholder={canAnswer ? 'Type your answer…' : 'Waiting for your turn…'}
              disabled={!canAnswer || isSubmitting}
              onKeyDown={(e) => e.key === 'Enter' && canAnswer && onSubmit(answerInput)}
              autoComplete="off"
            />
            <button onClick={onVoice}
              className={`px-4 py-3 rounded-lg border-2 font-heading text-lg transition-all ${isListening ? 'border-red-500 text-red-400 bg-red-500/20' : canAnswer ? 'border-[#4ade80]/40 text-[#4ade80]/70' : 'border-white/10 text-white/20'}`}
              disabled={!canAnswer}>
              {isListening ? '🔴' : '🎙'}
            </button>
            <button
              onClick={() => onSubmit(answerInput)}
              disabled={!canAnswer || !answerInput.trim() || isSubmitting}
              className="px-5 py-3 rounded-lg border-2 border-[#4ade80] text-[#4ade80] font-heading text-sm tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              GO
            </button>
          </div>
          {submitResult && (
            <div className={`px-4 py-2 rounded-lg font-heading text-sm tracking-wide text-center ${submitResult === 'hit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {submitResult === 'hit' ? '✓ Answer submitted!' : '✗ Not on the board'}
            </div>
          )}
        </div>
      )}

      {/* Watcher mode label */}
      {!isParticipant && (
        <div className="text-center px-4 py-3 border border-white/10 rounded-xl bg-white/5">
          <div className="text-[8px] tracking-widest text-white/30 uppercase" style={PS2}>👁 Watching — no controls</div>
        </div>
      )}

      {/* 1P CPU Panel */}
      {isSinglePlayer && cpuCharacter && (
        <SinglePlayerPanel cpuCharacter={cpuCharacter} gameLabel="BFF">
          <div className="text-[7px] text-white/30 uppercase tracking-widest" style={PS2}>
            Human team vs {cpuCharacter.name} · New players join the human team
          </div>
        </SinglePlayerPanel>
      )}
    </div>
  );
}

function WaitingScreen({ isSeated, seatNumber, role, gs, isSinglePlayer }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4">
      <div className="space-y-5">
        <div className="text-6xl">🎯</div>
        <div className="text-lg tracking-widest text-white/40 uppercase" style={PS2}>
          {isSinglePlayer ? '⏳ Starting 1P Mode…' : 'Waiting for Host…'}
        </div>
        {isSeated ? (
          <div className="px-6 py-4 rounded-xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/10"
            style={{ boxShadow: '0 0 20px rgba(188,19,254,0.2)' }}>
            <div className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={PS2}>You are</div>
            <div className="text-3xl text-white" style={PS2}>SEAT {seatNumber}</div>
            {role && <div className="text-[7px] text-[#4ade80]/60 uppercase mt-2" style={PS2}>{role === 'participant' ? '🎮 Participant' : '👁 Watcher'}</div>}
          </div>
        ) : (
          <div className="text-[8px] tracking-widest text-white/20 uppercase" style={PS2}>Assigning seat…</div>
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