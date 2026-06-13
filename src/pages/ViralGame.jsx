import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import { usePlayerSeat } from '@/hooks/usePlayerSeat.js';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import { base44 } from '@/api/base44Client';
import { VIRAL_AI_CHARACTERS, getAICharacter, makeAIDecision } from '@/data/viralAI';
import { generateBoard, getProgressReviewRequirements, getProgressReviewOutcomes, getEndgameRollOutcome } from '@/data/viralBoardData';
import { drawCard } from '@/data/viralCards';
import ViralBoard from '@/components/viral/ViralBoard';
import ViralPlayerPanel from '@/components/viral/ViralPlayerPanel';
import ViralDiceRoll from '@/components/viral/ViralDiceRoll';
import ViralCardModal from '@/components/viral/ViralCardModal';
import ViralSetupPanel from '@/components/viral/ViralSetupPanel';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function ViralGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const cpuId = params.get('cpu');
  if (!roomCode) { window.location.href = '/'; return null; }
  return <ViralGameViewer roomCode={roomCode} cpuId={cpuId} />;
}

function ViralGameViewer({ roomCode, cpuId }) {
  const navigate = useNavigate();
  const { room, loading, updateState, registerPlayer } = useGameRoom(roomCode, 'viral', 'viewer');
  const { playerId, seatNumber, isSeated } = usePlayerSeat(room, roomCode, 'viral', updateState);
  
  useEffect(() => { if (isSeated && playerId) registerPlayer(playerId); }, [isSeated, playerId]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [cardModal, setCardModal] = useState(null); // { card, type, playerId }
  const [diceRoll, setDiceRoll] = useState(null);
  const [aiOpponent, setAiOpponent] = useState(cpuId || 'dexter');
  const containerRef = useRef(null);

  const gs = room?.game_state || {};
  const players = gs.players || [];
  const currentPlayer = players[gs.currentTurnIndex || 0];
  const isMyTurn = currentPlayer?.seatNumber === seatNumber;
  const isSinglePlayer = !!(cpuId || gs.single_player);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleStartGame = async (config) => {
    const board = generateBoard();
    const players = [];
    
    if (isSinglePlayer) {
      players.push({
        seatNumber: 1,
        playerCode: generatePlayerCode(),
        name: 'You',
        controller: 'human',
        status: 'active',
        position: 0,
        level: 1,
        followers: 0,
        money: 1000,
        ssp: 0,
        equipment: [],
        sponsors: [],
        activeEffects: [],
      });
      
      const selectedAI = aiOpponent || cpuId;
      if (isSinglePlayer && selectedAI) {
        const aiChar = getAICharacter(selectedAI);
        players.push({
          seatNumber: 2,
          playerCode: `AI-${aiChar.id}`,
          name: aiChar.name,
          controller: 'ai',
          aiCharacterId: aiChar.id,
          status: 'active',
          position: 0,
          level: 1,
          followers: 0,
          money: 1000,
          ssp: 0,
          equipment: [],
          sponsors: [],
          activeEffects: [],
        });
      }
    } else {
      // Multiplayer - just add current player for now
      players.push({
        seatNumber: seatNumber || 1,
        playerCode: generatePlayerCode(),
        name: `Player ${seatNumber || 1}`,
        controller: 'human',
        status: 'active',
        position: 0,
        level: 1,
        followers: 0,
        money: 1000,
        ssp: 0,
        equipment: [],
        sponsors: [],
        activeEffects: [],
      });
    }

    await updateState({
      ...config,
      board,
      players,
      currentTurnIndex: 0,
      round: 1,
      status: 'active',
      decks: {
        equipment: [...Array(24)].map((_, i) => ({ id: `eq_${i}` })),
        challenge: [...Array(8)].map((_, i) => ({ id: `ch_${i}` })),
        viral: [...Array(8)].map((_, i) => ({ id: `vir_${i}` })),
        event: [...Array(6)].map((_, i) => ({ id: `evt_${i}` })),
        sponsor: [...Array(6)].map((_, i) => ({ id: `spo_${i}` })),
        pay: [...Array(7)].map((_, i) => ({ id: `pay_${i}` })),
        play: [...Array(6)].map((_, i) => ({ id: `play_${i}` })),
      },
      turnLog: [],
    });
  };

  const handleRollDice = async () => {
    if (!isMyTurn || !gs.running) return;
    
    const roll = Math.floor(Math.random() * 6) + 1;
    setDiceRoll(roll);
    
    // Wait for dice animation
    await new Promise(r => setTimeout(r, 1500));
    
    const player = players[gs.currentTurnIndex];
    const newPosition = Math.min(120, player.position + roll);
    
    // Move player
    const updatedPlayers = players.map((p, i) => 
      i === gs.currentTurnIndex ? { ...p, position: newPosition } : p
    );
    
    await updateState({ players: updatedPlayers });
    
    // Resolve space
    await handleResolveSpace(player, newPosition, roll);
    setDiceRoll(null);
  };

  const handleResolveSpace = async (player, newPosition, roll) => {
    const space = gs.board?.find(s => s.number === newPosition);
    if (!space) return;

    const logEntry = {
      turnNumber: gs.turnNumber || 1,
      playerId: player.playerCode,
      playerName: player.name,
      seat: player.seatNumber,
      controller: player.controller,
      roll,
      fromSpace: player.position,
      toSpace: newPosition,
      spaceType: space.type,
      timestamp: Date.now(),
    };

    // Check for progress review zones
    if (space.isReviewZone && !space.effect.type.includes('SAFE')) {
      const requirements = getProgressReviewRequirements(player.level);
      const meetsRequirements = player.followers >= requirements.followers && 
                                player.equipment?.length >= requirements.equipment;
      
      if (!meetsRequirements) {
        // Progress review penalty
        const reviewRoll = Math.floor(Math.random() * 6) + 1;
        const outcome = getProgressReviewOutcomes(player.level, reviewRoll);
        
        let updatedPlayer = { ...player };
        if (outcome.movement) {
          updatedPlayer.position = Math.max(0, player.position + outcome.movement);
        }
        if (outcome.followerLoss) {
          updatedPlayer.followers = Math.max(0, player.followers - outcome.followerLoss);
        }
        
        const updatedPlayers = players.map((p, i) => 
          i === gs.currentTurnIndex ? updatedPlayer : p
        );
        
        setNotification({ 
          seatNumber: player.seatNumber, 
          letter: `Review: ${outcome.outcome}`, 
          result: 'warning' 
        });
        
        await updateState({ 
          players: updatedPlayers, 
          turnLog: [...(gs.turnLog || []), { ...logEntry, progressReview: outcome }] 
        });
        setTimeout(() => setNotification(null), 3000);
        nextTurn();
        return;
      }
    }

    // Handle space effect
    if (space.type === 'CREATOR_MANSION') {
      // Win condition check
      const hasWinCondition = player.followers >= 1000000 && 
                              player.equipment?.length >= 8 && 
                              player.sponsors?.length >= 1;
      
      if (hasWinCondition) {
        await updateState({ 
          status: 'finished', 
          winner: player,
          turnLog: [...(gs.turnLog || []), { ...logEntry, win: true }] 
        });
        return;
      } else {
        // Endgame mode
        setNotification({ seatNumber: player.seatNumber, letter: 'Endgame Mode!', result: 'info' });
        setTimeout(() => setNotification(null), 3000);
      }
    }

    // Draw card or trigger effect
    if (space.effect.cardDraw) {
      const card = drawCard(space.effect.cardDraw, player.level);
      setCardModal({ card, type: space.effect.cardDraw, playerId: player.seatNumber });
      await updateState({ turnLog: [...(gs.turnLog || []), { ...logEntry, cardDrawn: card }] });
    } else if (space.effect.followerGain || space.effect.money || space.effect.ssp) {
      let updatedPlayer = { ...player };
      if (space.effect.followerGain) updatedPlayer.followers += space.effect.followerGain;
      if (space.effect.money) updatedPlayer.money += space.effect.money;
      if (space.effect.ssp) updatedPlayer.ssp += space.effect.ssp;
      
      const updatedPlayers = players.map((p, i) => 
        i === gs.currentTurnIndex ? updatedPlayer : p
      );
      
      setNotification({ 
        seatNumber: player.seatNumber, 
        letter: `+${space.effect.followerGain || 0} followers`, 
        result: 'correct' 
      });
      
      await updateState({ 
        players: updatedPlayers, 
        turnLog: [...(gs.turnLog || []), logEntry] 
      });
      setTimeout(() => setNotification(null), 3000);
    }

    nextTurn();
  };

  const nextTurn = () => {
    const nextIndex = (gs.currentTurnIndex + 1) % Math.max(players.length, 1);
    updateState({ currentTurnIndex: nextIndex });
    
    // AI turn
    const nextPlayer = players[nextIndex];
    if (nextPlayer?.controller === 'ai') {
      setTimeout(() => handleAITurn(nextPlayer), 2000);
    }
  };

  const handleAITurn = async (aiPlayer) => {
    const aiCharacter = getAICharacter(aiPlayer.aiCharacterId);
    const decision = makeAIDecision(aiCharacter, gs, aiPlayer);
    
    // AI rolls dice
    const roll = Math.floor(Math.random() * 6) + 1;
    setDiceRoll(roll);
    await new Promise(r => setTimeout(r, 1500));
    
    const newPosition = Math.min(120, aiPlayer.position + roll);
    const updatedPlayers = players.map((p, i) => 
      i === gs.currentTurnIndex ? { ...p, position: newPosition } : p
    );
    
    await updateState({ players: updatedPlayers });
    await handleResolveSpace(aiPlayer, newPosition, roll);
    setDiceRoll(null);
  };

  const handleCardActionComplete = async (cardResult) => {
    // Apply card effects
    const player = players.find(p => p.seatNumber === cardModal.playerId);
    if (!player || !cardResult) {
      setCardModal(null);
      return;
    }

    let updatedPlayer = { ...player };
    if (cardResult.followers) updatedPlayer.followers += cardResult.followers;
    if (cardResult.money) updatedPlayer.money += cardResult.money;
    if (cardResult.ssp) updatedPlayer.ssp += cardResult.ssp;
    if (cardResult.equipment) {
      updatedPlayer.equipment = [...(player.equipment || []), cardResult.equipment];
    }
    if (cardResult.sponsor) {
      updatedPlayer.sponsors = [...(player.sponsors || []), cardResult.sponsor];
    }

    const updatedPlayers = players.map((p, i) => 
      p.seatNumber === cardModal.playerId ? updatedPlayer : p
    );

    await updateState({ players: updatedPlayers });
    setCardModal(null);
    nextTurn();
  };

  const handleReset = () => {
    updateState({
      status: 'waiting',
      players: [],
      board: null,
      currentTurnIndex: 0,
      round: 1,
      turnLog: [],
      winner: null,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070311] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const showSetup = !gs.running && gs.status !== 'active' && !gs.winner;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#070311]/90 backdrop-blur-xl">
        <div className="px-4 h-12 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="shrink-0">
              <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
            </Link>
            <span className="text-[#FFD700] uppercase text-[9px] tracking-widest hidden sm:block" style={PS2}>VIRAL!</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse shrink-0" />
              <span className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
            </div>
            {isSinglePlayer && (
              <span className="px-2 py-0.5 bg-[#FFD700]/10 border border-[#FFD700]/40 rounded text-[#FFD700] text-[7px] tracking-widest uppercase" style={PS2}>
                🤖 VS CPU
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeatBadge seatNumber={seatNumber} isSeated={isSeated} alreadyChosen={false} />
            <button onClick={() => navigate('/games')}
              className="px-3 py-1.5 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-xs font-body tracking-wide">
              ← LOBBY
            </button>
            <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[7px] tracking-widest uppercase" style={PS2}>
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1600px] mx-auto w-full">
        {/* Left: Player Panels */}
        <aside className="lg:w-80 shrink-0 space-y-3">
          {showSetup ? (
            <ViralSetupPanel isSinglePlayer={isSinglePlayer} cpuId={cpuId} onStart={handleStartGame} seatNumber={seatNumber} aiOpponent={aiOpponent} setAiOpponent={setAiOpponent} />
          ) : gs.winner ? (
            <div className="p-6 rounded-xl text-center" style={{ background: 'linear-gradient(135deg,#0d2b0d,#0a1a1a)', border: '2px solid #4ade80', boxShadow: '0 0 30px rgba(74,222,128,0.3)' }}>
              <div className="text-5xl mb-3">🏆</div>
              <div className="font-heading text-2xl tracking-widest text-[#4ade80] uppercase">VIRAL!</div>
              <div className="text-white/80 mt-2">{gs.winner.name} Wins!</div>
              <div className="text-[10px] text-white/50 mt-1">{gs.winner.followers.toLocaleString()} followers</div>
              <button onClick={handleReset} className="mt-4 px-6 py-2 rounded-lg font-heading text-xs tracking-widest uppercase" style={{ background: '#BC13FE20', border: '2px solid #BC13FE', color: '#BC13FE' }}>
                ↺ Play Again
              </button>
            </div>
          ) : (
            players.map((p, i) => (
              <ViralPlayerPanel 
                key={p.seatNumber} 
                player={p} 
                isCurrentTurn={i === gs.currentTurnIndex}
                isMyTurn={i === gs.currentTurnIndex && p.seatNumber === seatNumber}
              />
            ))
          )}
        </aside>

        {/* Center: Board */}
        <main className="flex-1 flex flex-col items-center gap-4">
          {gs.board && (
            <ViralBoard 
              board={gs.board} 
              players={players} 
              currentTurnIndex={gs.currentTurnIndex}
              diceRoll={diceRoll}
            />
          )}
          
          {gs.running && !gs.winner && isMyTurn && (
            <ViralDiceRoll onRoll={handleRollDice} disabled={!!diceRoll} />
          )}
        </main>

        {/* Right: Game Info */}
        <aside className="lg:w-72 shrink-0 space-y-3">
          <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg,#07040d,#0d0620)', border: '1px solid rgba(188,19,254,0.3)' }}>
            <h3 className="text-[8px] tracking-[0.2em] text-[#BC13FE] uppercase mb-3" style={PS2}>Game Info</h3>
            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-white/50">Round:</span>
                <span className="text-white">{gs.round || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Turn:</span>
                <span className="text-white">{(gs.currentTurnIndex || 0) + 1} / {players.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Status:</span>
                <span className={gs.status === 'active' ? 'text-[#4ade80]' : 'text-[#FF5F1F]'}>{gs.status?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Card Modal */}
      {cardModal && (
        <ViralCardModal 
          card={cardModal.card} 
          type={cardModal.type} 
          onComplete={handleCardActionComplete} 
        />
      )}
    </div>
  );
}

function generatePlayerCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'VIRAL-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}