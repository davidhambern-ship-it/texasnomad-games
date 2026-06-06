import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import SpadesTable from '@/components/spades/SpadesTable';
import { fillEmptySeatsWithCPU, selectCPUCard, CPU_ACTION_DELAY } from '@/lib/spadesCPU';
import { 
  generateFullDeck, 
  shuffleDeck, 
  isValidPlay, 
  determineTrickWinner, 
  getActiveSuit,
  getTeamFromSeat,
} from '@/lib/spadesRules';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SPADES_SEATS = [1, 2, 3, 4];

export default function SpadesGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) {
    window.location.href = '/games';
    return null;
  }
  return <SpadesViewer roomCode={roomCode} />;
}

function SpadesViewer({ roomCode }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'spades', 'viewer');

  // Stable playerId per room
  const [playerId] = useState(() => {
    const key = `tn_pid_${roomCode}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [myRole, setMyRole] = useState(() => localStorage.getItem(`spades_role_${roomCode}`) || null);
  const [mySeatNumber, setMySeatNumber] = useState(null);

  const [cpuChoiceShown, setCpuChoiceShown] = useState(false);

  const containerRef = useRef(null);
  const gs = room?.game_state || {};
  const players = gs.players || [];

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Sync my seat from room state on load / updates
  useEffect(() => {
    if (!room || !playerId) return;
    const me = players.find(p => p.playerId === playerId);
    if (me) {
      setMySeatNumber(me.seatNumber);
      setMyRole(me.role);
      localStorage.setItem(`spades_role_${roomCode}`, me.role);
    }
  }, [room, playerId]);



  // Auto-deal when it's setup phase (CPU or human dealer) - ONLY for CPU games
  useEffect(() => {
    if (!room || !gs.dealer_seat || !gs.cpu_enabled) return;
    if (gs.phase !== 'setup' && gs.phase) return;
    
    // Only auto-deal if in setup phase AND no deck exists yet (human hasn't started dealing)
    if (!gs.deck || gs.deck.length === 0) {
      const timer = setTimeout(async () => {
        // Shuffle 3 times then deal (with longer delays to avoid rate limit)
        for (let i = 0; i < 3; i++) {
          const deck = generateFullDeck();
          await updateState({ deck: shuffleDeck(deck), deck_shuffled: true, shuffle_count: i + 1 });
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        // Wait a bit before dealing to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
        // After shuffling, deal the cards
        await handleAutoDeal();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gs.dealer_seat, gs.phase, gs.cpu_enabled, room]);

  const handleAutoDeal = async () => {
    const seated = (gs.players || []).filter(p => p.seatNumber != null);
    if (seated.length < 2) return;
    const workingDeck = shuffleDeck(generateFullDeck());
    const cardsPerPlayer = Math.floor(workingDeck.length / seated.length);
    
    // Build complete hands for all players in memory first
    const playerHands = [];
    for (let i = 0; i < seated.length; i++) {
      const startIdx = i * cardsPerPlayer;
      playerHands.push(workingDeck.slice(startIdx, startIdx + cardsPerPlayer));
    }
    
    // Update all players with full hands in a single state update
    const updatedPlayers = (gs.players || []).map(p => {
      const seatedIdx = seated.findIndex(s => s.playerId === p.playerId);
      if (seatedIdx >= 0) {
        return { ...p, hand: playerHands[seatedIdx], bid: 0, tricksWon: 0 };
      }
      return p;
    });
    
    const dealerSeat = gs.dealer_seat || seated[0]?.seatNumber || 1;
    const firstBidder = seated[(seated.findIndex(s => s.seatNumber === dealerSeat) + 1) % seated.length]?.seatNumber;
    
    // Single state update with all changes - no rate limit issue
    await updateState({
      players: updatedPlayers,
      phase: 'playing', status: 'active',
      deck: [], current_trick: [], current_turn_seat: firstBidder,
      tricks_played: 0, bid1: 0, bid2: 0, books1: 0, books2: 0, shuffle_count: 0,
      first_hand_no_bid: true,
      spades_broken: false,
      completed_books: [],
    });
  };

  // CPU turn handler - play card when it's CPU's turn
  useEffect(() => {
    if (!room || !gs.cpu_enabled || gs.phase !== 'playing') {
      console.log('CPU turn: skipping - room:', !!room, 'cpu_enabled:', gs.cpu_enabled, 'phase:', gs.phase);
      return;
    }
    
    const currentTurnSeat = gs.current_turn_seat;
    if (!currentTurnSeat) {
      console.log('CPU turn: no current_turn_seat');
      return;
    }
    
    // Find player whose turn it is from gs.players
    const currentPlayer = (gs.players || []).find(p => p.seatNumber === currentTurnSeat);
    if (!currentPlayer) {
      console.log('CPU turn: no player found for seat', currentTurnSeat);
      return;
    }
    if (currentPlayer.playerType !== 'cpu') {
      console.log('CPU turn: player is not CPU -', currentPlayer.playerType);
      return;
    }
    
    // Don't act if already played this trick
    const hasPlayed = (gs.current_trick || []).some(p => p.seatNumber === currentTurnSeat);
    if (hasPlayed) {
      console.log('CPU turn: already played this trick');
      return;
    }
    
    console.log('CPU turn: Seat', currentTurnSeat, 'is thinking... hand size:', currentPlayer.hand?.length || 0);
    
    const timer = setTimeout(async () => {
      const hand = currentPlayer.hand || [];
      if (hand.length === 0) {
        console.log('CPU turn: empty hand');
        return;
      }
      
      // Validate play using rule engine
      const isLead = (gs.current_trick || []).length === 0;
      const activeSuit = getActiveSuit(gs.current_trick || []);
      
      // Select card using CPU logic (already validates rules)
      let cardToPlay = selectCPUCard(hand, gs.current_trick || [], 0, currentPlayer.bid || 0, currentPlayer.tricksWon || 0, gs.spades_broken || false, gs, currentTurnSeat);
      
      // Double-check with rule engine; fallback to any valid card
      if (!cardToPlay || !isValidPlay(cardToPlay, hand, gs.current_trick || [], activeSuit, gs.spades_broken || false, isLead).valid) {
        cardToPlay = hand.find(c => isValidPlay(c, hand, gs.current_trick || [], activeSuit, gs.spades_broken || false, isLead).valid);
        if (!cardToPlay) return;
      }
      
      console.log('CPU turn: Playing card', cardToPlay);
      
      // Play the card
      const updatedPlayers = (gs.players || []).map(p =>
        p.playerId === currentPlayer.playerId
          ? { ...p, hand: (p.hand || []).filter(c => c.id !== cardToPlay.id), lastActionAt: Date.now() }
          : p
      );
      
      // Find next player for turn rotation
      const seatedPlayers = (gs.players || []).filter(p => p.seatNumber != null).sort((a, b) => a.seatNumber - b.seatNumber);
      const currentIndex = seatedPlayers.findIndex(p => p.seatNumber === currentTurnSeat);
      const nextPlayer = seatedPlayers[(currentIndex + 1) % seatedPlayers.length];
      
      // Check if spades are broken
      const spadesBroken = gs.spades_broken || cardToPlay.suit === '♠';
      
      // Update state with card played and rotate turn in one call to avoid rate limit
      await updateState({
        players: updatedPlayers,
        current_trick: [...(gs.current_trick || []), { playerId: currentPlayer.playerId, seatNumber: currentTurnSeat, card: cardToPlay }],
        current_turn_seat: nextPlayer?.seatNumber || currentTurnSeat,
        spades_broken: spadesBroken,
      });
    }, CPU_ACTION_DELAY);
    
    return () => clearTimeout(timer);
  }, [gs.current_turn_seat, gs.current_trick, gs.phase, gs.cpu_enabled, gs.players, room]);

  // Handle turn rotation after each card is played (only for human players)
  useEffect(() => {
    if (!room || !gs.cpu_enabled || gs.phase !== 'playing') return;
    
    const trick = gs.current_trick || [];
    if (trick.length === 0) return;
    
    const seatedPlayers = (gs.players || []).filter(p => p.seatNumber != null).sort((a, b) => a.seatNumber - b.seatNumber);
    if (trick.length >= seatedPlayers.length) return; // Wait for trick completion handler
    
    // Get the last player who played
    const lastPlayed = trick[trick.length - 1];
    if (!lastPlayed) return;
    
    // Find next player in seat order
    const currentIndex = seatedPlayers.findIndex(p => p.seatNumber === lastPlayed.seatNumber);
    const nextPlayer = seatedPlayers[(currentIndex + 1) % seatedPlayers.length];
    
    if (!nextPlayer) return;
    if (nextPlayer.playerType === 'cpu') return; // CPU turn handler will set this
    
    // Rotate turn to next human player with delay to avoid rate limit
    const timer = setTimeout(async () => {
      await updateState({
        current_turn_seat: nextPlayer.seatNumber,
      });
    }, 600);
    
    return () => clearTimeout(timer);
  }, [gs.current_trick, gs.phase, gs.cpu_enabled, gs.players, room]);

  // Handle trick completion and turn rotation
  useEffect(() => {
    if (!room || !gs.cpu_enabled || gs.phase !== 'playing') return;
    
    const trick = gs.current_trick || [];
    const seatedPlayers = (gs.players || []).filter(p => p.seatNumber != null);
    if (trick.length !== seatedPlayers.length) return;
    
    // Determine winner using rule engine
    const activeSuit = getActiveSuit(trick);
    const winner = determineTrickWinner(trick, activeSuit);
    
    if (!winner) return;
    
    const timer = setTimeout(async () => {
      const winningSeat = winner.seatNumber;
      const winningTeam = getTeamFromSeat(winningSeat);
      
      // Update books and tricks
      const updatedPlayers = (gs.players || []).map(p => 
        p.seatNumber === winningSeat 
          ? { ...p, tricksWon: (p.tricksWon || 0) + 1 }
          : p
      );
      
      const newTricksPlayed = (gs.tricks_played || 0) + 1;
      const newBooks1 = winningTeam === 1 ? (gs.books1 || 0) + 1 : gs.books1 || 0;
      const newBooks2 = winningTeam === 2 ? (gs.books2 || 0) + 1 : gs.books2 || 0;
      
      // Track completed book
      const completedBook = {
        bookNumber: newTricksPlayed,
        leadSeat: trick[0]?.seatNumber,
        activeSuit,
        cardsPlayed: trick,
        winningSeat,
        winningTeam,
        winningCard: winner.card,
        timestamp: Date.now(),
      };
      
      const previousBooks = gs.completed_books || [];
      
      await updateState({
        players: updatedPlayers,
        current_trick: [],
        current_turn_seat: winningSeat, // Winner leads next trick
        tricks_played: newTricksPlayed,
        books1: newBooks1,
        books2: newBooks2,
        completed_books: [...previousBooks, completedBook],
        spades_broken: gs.spades_broken || trick.some(t => t.card.suit === '♠'),
      });
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [gs.current_trick, gs.phase, gs.cpu_enabled, gs.players, room]);

  // Detect when round ends and rotate dealer
  useEffect(() => {
    if (!room || !gs.cpu_enabled) return;
    
    // Check if all tricks are played (13 tricks per round)
    if (gs.tricks_played >= 13 && gs.phase === 'playing') {
      const timer = setTimeout(async () => {
        // Rotate dealer to the left (next seat number)
        const currentDealer = gs.dealer_seat || 1;
        const nextDealer = currentDealer >= 4 ? 1 : currentDealer + 1;
        
        // Check if next dealer is CPU
        const nextDealerPlayer = players.find(p => p.seatNumber === nextDealer);
        if (nextDealerPlayer?.playerType === 'cpu') {
          // Update dealer and trigger auto-shuffle/deal
          await updateState({ dealer_seat: nextDealer, phase: 'setup', tricks_played: 0 });
        } else {
          // Human dealer - just update dealer seat and wait for manual shuffle
          await updateState({ dealer_seat: nextDealer, phase: 'setup', tricks_played: 0 });
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gs.tricks_played, gs.phase, gs.dealer_seat, gs.cpu_enabled, room]);

  const occupiedSeats = players.filter(p => p.role === 'player' || p.role === 'hostPlayer').map(p => p.seatNumber);
  const availableSeats = SPADES_SEATS.filter(s => !occupiedSeats.includes(s));

  const handleChooseSpectate = async () => {
    if (!room) return;
    const newPlayer = {
      playerId,
      seatNumber: null,
      role: 'spectator',
      connected: true,
      joinedAt: Date.now(),
      lastActionAt: Date.now(),
    };
    const existing = players.find(p => p.playerId === playerId);
    const updatedPlayers = existing
      ? players.map(p => p.playerId === playerId ? { ...p, role: 'spectator', connected: true } : p)
      : [...players, newPlayer];
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'spectator');
    setMyRole('spectator');
  };

  const handleChooseSit = async () => {
    if (!room) return;
    if (availableSeats.length === 0) {
      await handleChooseSpectate();
      return;
    }
    const seat = availableSeats[0];
    await sitInSeat(seat);
  };

  const sitInSeat = async (seatNum) => {
    if (!room) return;
    const newPlayer = {
      playerId,
      seatNumber: seatNum,
      role: 'player',
      playerType: 'human',
      connected: true,
      joinedAt: Date.now(),
      lastActionAt: Date.now(),
    };
    const existing = players.find(p => p.playerId === playerId);
    const updatedPlayers = existing
      ? players.map(p => p.playerId === playerId ? { ...p, seatNumber: seatNum, role: 'player', playerType: 'human', connected: true } : p)
      : [...players, newPlayer];
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'player');
    setMyRole('player');
    setMySeatNumber(seatNum);
  };

  const handlePlayAgainstCPU = async () => {
    if (!room) return;
    // Fill empty seats with CPU players
    const currentPlayers = gs.players || [];
    const filledPlayers = fillEmptySeatsWithCPU(currentPlayers, gs);
    // Set dealer to seat 1 (host) if not set
    await updateState({ 
      players: filledPlayers, 
      cpu_enabled: true,
      dealer_seat: gs.dealer_seat || 1,
      phase: 'setup'
    });
    setCpuChoiceShown(false);
    // Trigger shuffle and deal immediately
    for (let i = 0; i < 3; i++) {
      const deck = generateFullDeck();
      await updateState({ deck: shuffleDeck(deck), deck_shuffled: true, shuffle_count: i + 1 });
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    await handleAutoDeal();
  };

  const handleWaitForRealPlayers = async () => {
    if (!room) return;
    setCpuChoiceShown(false);
  };

  const handlePlayCard = async (card) => {
    if (!room || !isPlayer || gs.phase !== 'playing') return;
    if (gs.current_turn_seat !== mySeatNumber) {
      alert('Not your turn!');
      return;
    }
    
    const myPlayer = players.find(p => p.playerId === playerId);
    if (!myPlayer || !myPlayer.hand) return;
    
    // Validate play using rule engine
    const isLead = (gs.current_trick || []).length === 0;
    const activeSuit = getActiveSuit(gs.current_trick || []);
    const validation = isValidPlay(
      card, 
      myPlayer.hand, 
      gs.current_trick || [], 
      activeSuit, 
      gs.spades_broken || false, 
      isLead
    );
    
    if (!validation.valid) {
      alert(validation.errors[0] || 'Invalid play');
      return;
    }
    
    // Remove card from hand
    const updatedPlayers = players.map(p =>
      p.playerId === playerId
        ? { ...p, hand: p.hand.filter(c => c.id !== card.id), lastActionAt: Date.now() }
        : p
    );
    
    // Add card to trick
    const newTrick = [...(gs.current_trick || []), { playerId, seatNumber: mySeatNumber, card }];
    
    // Find next player
    const seatedPlayers = players.filter(p => p.seatNumber != null).sort((a, b) => a.seatNumber - b.seatNumber);
    const currentIndex = seatedPlayers.findIndex(p => p.seatNumber === mySeatNumber);
    const nextPlayer = seatedPlayers[(currentIndex + 1) % seatedPlayers.length];
    
    // Check if spades are broken
    const spadesBroken = gs.spades_broken || card.suit === '♠';
    
    await updateState({
      players: updatedPlayers,
      current_trick: newTrick,
      current_turn_seat: nextPlayer?.seatNumber || mySeatNumber,
      spades_broken: spadesBroken,
    });
  };

  const isPlayer = myRole === 'player' || myRole === 'hostPlayer';
  const isSpectator = myRole === 'spectator';

  // Show CPU choice when player sits and there are empty seats
  useEffect(() => {
    if (isPlayer && availableSeats.length > 0 && !gs.cpu_enabled && !cpuChoiceShown) {
      setCpuChoiceShown(true);
    }
  }, [isPlayer, availableSeats.length, gs.cpu_enabled, cpuChoiceShown, myRole]);

  // Reset cpuChoiceShown when leaving the game
  useEffect(() => {
    if (!isPlayer) {
      setCpuChoiceShown(false);
    }
  }, [isPlayer]);

  // Show role selection when user hasn't chosen yet
  const showRoleSelection = myRole === null && !loading && room;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      {/* Role Selection Modal */}
      {showRoleSelection && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0a1a0a] to-[#050a05] border-4 border-[#BC13FE]/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(188,19,254,0.3), inset 0 0 60px rgba(0,0,0,0.8)' }}>
            <div className="text-center mb-6">
              <div className="text-2xl font-heading text-[#BC13FE] uppercase tracking-widest mb-2" style={PS2}>
                🎮 Join Game
              </div>
              <div className="text-white/60 text-sm">
                Choose how you want to join
              </div>
            </div>
            
            <div className="space-y-3">
              {availableSeats.length > 0 ? (
                <button
                  onClick={handleChooseSit}
                  className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105"
                  style={PS2}
                >
                  🎯 Play (Join Seat)
                </button>
              ) : (
                <button
                  onClick={handleChooseSpectate}
                  className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105"
                  style={PS2}
                >
                  👁 Start Spectating
                </button>
              )}
              {availableSeats.length > 0 && (
                <button
                  onClick={handleChooseSpectate}
                  className="w-full py-4 px-6 bg-gradient-to-r from-[#6b7280] to-[#4b5563] hover:from-[#4b5563] hover:to-[#6b7280] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105"
                  style={PS2}
                >
                  👁 Spectate Only
                </button>
              )}
            </div>
            
            {availableSeats.length === 0 && (
              <div className="mt-4 text-[#FFD700]/60 text-xs text-center" style={PS2}>
                All seats full - you will spectate
              </div>
            )}
          </div>
        </div>
      )}

      <SpadesHeader
        roomCode={roomCode}
        room={room}
        isFullscreen={isFullscreen}
        containerRef={containerRef}
        seatNumber={mySeatNumber}
        isSeated={isPlayer}
        myRole={myRole}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 relative">
          <SpadesTable
            gs={gs}
            playerId={playerId}
            mySeatNumber={mySeatNumber}
            myRole={myRole}
            isPlayer={isPlayer}
            isSpectator={isSpectator}
            updateState={updateState}
            availableSeats={availableSeats}
            onSitInSeat={sitInSeat}
            roomCode={roomCode}
            cpuChoiceShown={cpuChoiceShown}
            onPlayAgainstCPU={handlePlayAgainstCPU}
            onWaitForRealPlayers={handleWaitForRealPlayers}
            onChooseSpectate={handleChooseSpectate}
            onChooseSit={handleChooseSit}
            onPlayCard={handlePlayCard}
          />

        </div>
      )}
    </div>
  );
}

function SpadesHeader({ roomCode, room, isFullscreen, containerRef, seatNumber, isSeated, myRole }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#070311]/90 backdrop-blur-xl">
      <div className="px-4 h-12 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="shrink-0">
            <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
          </Link>
          <span className="text-[#FFD700] uppercase text-[9px] tracking-widest hidden sm:block" style={PS2}>SPADES</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse shrink-0" />
            <span className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>ROOM {roomCode}</span>
          </div>
          {room?.host_connected && (
            <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[7px] tracking-widest uppercase hidden sm:inline" style={PS2}>
              🔴 HOST LIVE
            </span>
          )}
          {myRole === 'spectator' && (
            <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-white/40 text-[7px] tracking-widest uppercase" style={PS2}>
              👁 SPECTATING
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSeated && seatNumber && (
            <div className="px-2 py-1 rounded border border-[#BC13FE] bg-[#BC13FE]/10 text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>
              SEAT {seatNumber}
            </div>
          )}
          <Link to="/games" className="px-2 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[7px] tracking-widest uppercase hidden sm:block" style={PS2}>← LOBBY</Link>
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