import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import SeatNotification from '@/components/game/SeatNotification.jsx';
import SeatBadge from '@/components/game/SeatBadge.jsx';
import SpadesTable from '@/components/spades/SpadesTable';
import { fillEmptySeatsWithCPU } from '@/lib/spadesCPU';

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
  const [notification, setNotification] = useState(null);

  const [myRole, setMyRole] = useState(() => localStorage.getItem(`spades_role_${roomCode}`) || null);
  const [mySeatNumber, setMySeatNumber] = useState(null);

  // CPU choice state
  const [showCPUChoice, setShowCPUChoice] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);

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



  // Auto-deal when it's setup phase (CPU or human dealer)
  useEffect(() => {
    if (!room || !gs.dealer_seat) return;
    
    // Only auto-deal if in setup phase
    if (gs.phase === 'setup' || !gs.phase) {
      const timer = setTimeout(async () => {
        // Shuffle 3 times then deal
        for (let i = 0; i < 3; i++) {
          const deck = generateFullDeck();
          await updateState({ deck: shuffleDeck(deck), deck_shuffled: true, shuffle_count: i + 1 });
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        // After shuffling, deal the cards
        await handleAutoDeal();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gs.dealer_seat, gs.phase, room]);

  const handleAutoDeal = async () => {
    const seated = (gs.players || []).filter(p => p.role === 'player' || p.role === 'hostPlayer');
    if (seated.length < 2) return;
    const workingDeck = shuffleDeck(generateFullDeck());
    const cardsPerPlayer = Math.floor(workingDeck.length / seated.length);
    const updatedPlayers = (gs.players || []).map(p => {
      if (p.role !== 'player' && p.role !== 'hostPlayer') return p;
      const idx = seated.findIndex(s => s.playerId === p.playerId);
      return { ...p, hand: workingDeck.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer), bid: null, tricksWon: 0 };
    });
    const dealerSeat = gs.dealer_seat || seated[0]?.seatNumber || 1;
    const firstBidder = seated[(seated.findIndex(s => s.seatNumber === dealerSeat) + 1) % seated.length]?.seatNumber;
    
    // "First hand bids itself" - auto-bid for all players
    const autoBidPlayers = updatedPlayers.map(p => {
      if (p.role !== 'player' && p.role !== 'hostPlayer') return p;
      // Simple auto-bid logic: count spades and high cards
      const spadesCount = (p.hand || []).filter(c => c.suit === '♠').length;
      const aces = (p.hand || []).filter(c => c.value === 'A').length;
      const kings = (p.hand || []).filter(c => c.value === 'K').length;
      const autoBid = Math.min(13, spadesCount + Math.floor((aces + kings) / 2));
      return { ...p, bid: autoBid };
    });
    
    // Calculate team bids (players without team are team 2)
    const team1Bid = autoBidPlayers.filter(p => p.team === 1).reduce((sum, p) => sum + (p.bid || 0), 0);
    const team2Bid = autoBidPlayers.filter(p => p.team === 2 || !p.team).reduce((sum, p) => sum + (p.bid || 0), 0);
    
    await updateState({
      players: autoBidPlayers, phase: 'playing', status: 'active',
      deck: [], current_trick: [], current_turn_seat: firstBidder,
      tricks_played: 0, bid1: team1Bid, bid2: team2Bid, books1: 0, books2: 0, shuffle_count: 0,
    });
  };

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
      setNotification({ message: 'All seats full — you are spectating', type: 'info' });
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
    await updateState({ players: filledPlayers, cpu_enabled: true });
    setShowCPUChoice(false);
    setNotification({ message: 'CPU players joined the table', type: 'success' });
  };

  const handleWaitForRealPlayers = async () => {
    if (!room) return;
    setShowCPUChoice(false);
    setNotification({ message: 'Waiting for more players...', type: 'info' });
  };

  const isPlayer = myRole === 'player' || myRole === 'hostPlayer';
  const isSpectator = myRole === 'spectator';

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <SeatNotification notification={notification} />
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

function generateFullDeck() {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      if ((suit === '♥' || suit === '♦') && value === '2') continue;
      deck.push({ suit, value, id: `${suit}${value}` });
    }
  }
  deck.push({ suit: 'Joker', value: 'BJ', id: 'BigJoker' });
  deck.push({ suit: 'Joker', value: 'LJ', id: 'LittleJoker' });
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}