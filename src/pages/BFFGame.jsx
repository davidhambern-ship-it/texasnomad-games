import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat';
import SeatBadge from '@/components/game/SeatBadge.jsx';

export default function BFFGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <BFFViewer roomCode={roomCode} />;
}

function BFFViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'bff', 'viewer');
  const gs = room?.game_state || {};

  // Universal seat + player ID assignment
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'bff', updateState);

  // Family team selection — persisted per room/player in localStorage
  const [selectedFamily, setSelectedFamily] = useState(() => {
    return localStorage.getItem(`tn_bff_family_${roomCode}_${playerId || 'anon'}`) || null;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Sync family choice into player record when both seat and family are ready
  const familySyncedRef = useRef(false);
  useEffect(() => {
    if (!isSeated || !selectedFamily || !playerId || familySyncedRef.current) return;
    const players = gs.players || [];
    const existing = players.find(p => p.playerId === playerId);
    if (!existing || existing.familyTeam === selectedFamily) {
      familySyncedRef.current = true;
      return;
    }
    familySyncedRef.current = true;
    const updated = players.map(p =>
      p.playerId === playerId ? { ...p, familyTeam: selectedFamily } : p
    );
    updateState({ players: updated });
  }, [isSeated, selectedFamily, playerId, gs.players, updateState]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleChooseFamily = (familyNum) => {
    const key = `tn_bff_family_${roomCode}_${playerId}`;
    localStorage.setItem(key, String(familyNum));
    setSelectedFamily(familyNum);
    familySyncedRef.current = false; // allow re-sync
  };

  const answers = gs.answers || [];
  const phase = gs.phase;

  // Determine family name for chosen team
  const myFamilyName = selectedFamily === 1 ? (gs.family1 || 'Family 1') : selectedFamily === 2 ? (gs.family2 || 'Family 2') : null;
  const myFamilyColor = selectedFamily === 1 ? '#BC13FE' : '#FF5F1F';

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#050505]/95 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FFD700] uppercase text-[10px] tracking-widest hidden sm:block" style={{ fontFamily: "'Press Start 2P', monospace" }}>BFF — BIGO FAMILY FEUD</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span className="text-[9px] tracking-widest text-[#BC13FE] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>ROOM {roomCode}</span>
            </div>
            {room?.host_connected ? (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[8px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                🔴 HOST LIVE
              </span>
            ) : selectedFamily ? (
              <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-yellow-400 text-[8px] tracking-widest uppercase animate-pulse" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                ⏳ WAITING FOR HOST
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Seat badge */}
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} />
            {/* Family badge */}
            {selectedFamily && myFamilyName && (
              <div className="px-2 py-1 rounded border text-[7px] tracking-widest uppercase hidden sm:block"
                style={{ borderColor: myFamilyColor, color: myFamilyColor, background: `${myFamilyColor}15`, fontFamily: "'Press Start 2P', monospace" }}>
                {myFamilyName}
              </div>
            )}
            <Link to="/" className="hidden sm:flex px-3 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[8px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>← LOBBY</Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-3 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[8px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedFamily ? (
        /* Family selection — shown before anything else */
        <FamilySelect
          family1={gs.family1}
          family2={gs.family2}
          seatNumber={seatNumber}
          onChoose={handleChooseFamily}
        />
      ) : (
        <GameBoard
          gs={gs}
          answers={answers}
          selectedFamily={selectedFamily}
          seatNumber={seatNumber}
          locked={!phase || phase === 'setup'}
          onChangeFamily={() => { localStorage.removeItem(`tn_bff_family_${roomCode}_${playerId}`); setSelectedFamily(null); }}
        />
      )}
    </div>
  );
}

/* ── FAMILY SELECTION SCREEN ── */
function FamilySelect({ family1, family2, seatNumber, onChoose }) {
  const name1 = family1 || 'Family 1';
  const name2 = family2 || 'Family 2';

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <div className="font-heading text-3xl tracking-widest text-[#FFD700] uppercase mb-2"
          style={{ textShadow: '0 0 20px rgba(255,215,0,0.4)' }}>
          Choose Your Family
        </div>
        {seatNumber && (
          <div className="text-[9px] tracking-[0.25em] text-white/40 uppercase mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            You are Seat {seatNumber}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-lg">
        {/* Family 1 */}
        <button
          onClick={() => onChoose(1)}
          className="group p-8 rounded-2xl border-2 border-[#BC13FE]/50 bg-[#BC13FE]/5 hover:bg-[#BC13FE]/15 hover:border-[#BC13FE] hover:scale-105 transition-all duration-200 active:scale-95"
          style={{ boxShadow: '0 0 0 rgba(188,19,254,0)' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(188,19,254,0.3)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 rgba(188,19,254,0)'}
        >
          <div className="text-5xl mb-3">🟣</div>
          <div className="font-heading text-2xl tracking-widest uppercase text-[#BC13FE] mb-1"
            style={{ textShadow: '0 0 15px rgba(188,19,254,0.6)' }}>
            {name1}
          </div>
          <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            Tap to join
          </div>
        </button>

        {/* Family 2 */}
        <button
          onClick={() => onChoose(2)}
          className="group p-8 rounded-2xl border-2 border-[#FF5F1F]/50 bg-[#FF5F1F]/5 hover:bg-[#FF5F1F]/15 hover:border-[#FF5F1F] hover:scale-105 transition-all duration-200 active:scale-95"
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(255,95,31,0.3)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 rgba(255,95,31,0)'}
        >
          <div className="text-5xl mb-3">🟠</div>
          <div className="font-heading text-2xl tracking-widest uppercase text-[#FF5F1F] mb-1"
            style={{ textShadow: '0 0 15px rgba(255,95,31,0.6)' }}>
            {name2}
          </div>
          <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            Tap to join
          </div>
        </button>
      </div>
    </div>
  );
}

/* ── GAME BOARD ── */
function GameBoard({ gs, answers, selectedFamily, seatNumber, locked, onChangeFamily }) {
  const [revealAnim, setRevealAnim] = useState({});
  const prevAnswersRef = useRef([]);

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

  const myColor = selectedFamily === 1 ? '#BC13FE' : '#FF5F1F';
  const myName = selectedFamily === 1 ? (gs.family1 || 'Family 1') : (gs.family2 || 'Family 2');

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-4xl mx-auto w-full relative">

      {/* Locked overlay — shown while waiting for host */}
      {locked && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-xl pointer-events-none">
          <div className="w-12 h-12 border-4 border-[#FFD700]/40 border-t-[#FFD700] rounded-full animate-spin" />
          <div className="text-[#FFD700] text-[10px] tracking-[0.3em] uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            Waiting for Host…
          </div>
          <button
            className="text-[7px] tracking-widest text-white/20 uppercase hover:text-white/50 transition-colors pointer-events-auto mt-2"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
            onClick={onChangeFamily}
          >
            ← Change Family
          </button>
        </div>
      )}

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-4 items-center">
        <FamilyScore name={gs.family1 || 'Family 1'} score={gs.score1 || 0} isActive={gs.active_turn === 1} color="#BC13FE" isMyTeam={selectedFamily === 1} />
        <div className="text-center">
          <div className="font-heading text-xs tracking-[0.25em] text-white/30 uppercase mb-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>Bank</div>
          <div className="font-heading text-3xl text-[#FF5F1F]" style={{ textShadow: '0 0 15px rgba(255,95,31,0.5)' }}>{gs.round_bank || 0}</div>
        </div>
        <FamilyScore name={gs.family2 || 'Family 2'} score={gs.score2 || 0} isActive={gs.active_turn === 2} color="#FF5F1F" isMyTeam={selectedFamily === 2} />
      </div>

      {/* Question */}
      {gs.current_question && (
        <div className="px-6 py-4 rounded-2xl border-2 border-[#FFD700]/40 bg-[#FFD700]/5 text-center"
          style={{ boxShadow: '0 0 20px rgba(255,215,0,0.1)' }}>
          <div className="font-heading text-xs tracking-[0.25em] text-[#FFD700]/60 uppercase mb-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>Survey Says…</div>
          <div className="font-heading text-xl md:text-2xl text-white tracking-wide leading-snug">{gs.current_question}</div>
        </div>
      )}

      {/* Answer Board */}
      {answers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {answers.map((ans, i) => (
            <AnswerSlot key={i} rank={i + 1} answer={ans} isAnimating={!!revealAnim[i]} />
          ))}
        </div>
      )}

      {!gs.current_question && (
        <div className="flex-1 flex items-center justify-center">
          <div className="font-heading text-sm tracking-widest text-white/20 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            Host is loading a survey…
          </div>
        </div>
      )}
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
      {isMyTeam && !isActive && <div className="text-[8px] tracking-widest mt-1 uppercase font-heading text-white/30" style={{ fontFamily: "'Press Start 2P', monospace" }}>YOUR TEAM</div>}
      {isActive && <div className="text-[9px] tracking-widest mt-1 uppercase font-heading" style={{ color, fontFamily: "'Press Start 2P', monospace" }}>▶ ACTIVE</div>}
    </div>
  );
}

function AnswerSlot({ rank, answer, isAnimating }) {
  const revealed = answer.revealed;
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all duration-500"
      style={{
        borderColor: revealed ? '#FFD700' : '#ffffff15',
        background: isAnimating ? 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,95,31,0.15))' : revealed ? 'rgba(255,215,0,0.07)' : 'rgba(0,0,0,0.5)',
        boxShadow: isAnimating ? '0 0 30px rgba(255,215,0,0.5), 0 0 60px rgba(255,95,31,0.2)' : revealed ? '0 0 12px rgba(255,215,0,0.15)' : 'none',
        transform: isAnimating ? 'scale(1.02)' : 'scale(1)',
      }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border-2"
        style={{ borderColor: revealed ? '#FFD700' : '#ffffff20', color: revealed ? '#FFD700' : '#ffffff30', fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}>
        {rank}
      </div>
      <div className="flex-1 font-heading text-lg tracking-wide uppercase">
        {revealed
          ? <span style={{ color: '#ffffff', textShadow: isAnimating ? '0 0 10px rgba(255,215,0,0.6)' : 'none' }}>{answer.text || answer.answer}</span>
          : <span className="text-white/10">{'— — — — —'}</span>
        }
      </div>
      <div className="font-heading text-lg shrink-0" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}>
        {revealed
          ? <span style={{ color: '#FF5F1F', textShadow: isAnimating ? '0 0 10px rgba(255,95,31,0.8)' : 'none' }}>{answer.points}</span>
          : <span className="text-white/10">??</span>
        }
      </div>
    </div>
  );
}