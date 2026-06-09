import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import SpadesTable from '@/components/spades/SpadesTable';
import { fillEmptySeatsWithCPU, selectCPUCard, CPU_ACTION_DELAY, replaceCPUWithHuman } from '@/lib/spadesCPU';
import { generateFullDeck, shuffleDeck, dealFromShuffledDeck, getSeatedPlayers, isValidPlay, determineTrickWinner, getActiveSuit, getTeamFromSeat } from '@/lib/spadesRules';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SPADES_SEATS = [1, 2, 3, 4];

export default function SpadesGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const isCreator = params.get('creator') === '1';
  if (!roomCode) {
    window.location.href = '/games';
    return null;
  }
  return <SpadesViewer roomCode={roomCode} isCreator={isCreator} />;
}

// ─── Seating helpers ─────────────────────────────────────────────────────────

/** True if this seat is occupied by a HUMAN (not CPU) */
function isHumanSeat(players, seatNumber) {
  const p = players.find(p => p.seatNumber === seatNumber && (p.role === 'player' || p.role === 'hostPlayer'));
  return p && p.playerType !== 'cpu';
}

/** Count human-occupied seats */
function humanSeatCount(players) {
  return SPADES_SEATS.filter(s => isHumanSeat(players, s)).length;
}

/** Seats a human can sit in: empty or CPU-occupied */
function joinableSeatsFor(players) {
  return SPADES_SEATS.filter(s => !isHumanSeat(players, s));
}

/** Empty seats (no player at all) */
function emptySeatsIn(players) {
  return SPADES_SEATS.filter(s => !players.some(p => p.seatNumber === s && (p.role === 'player' || p.role === 'hostPlayer')));
}

// ─── Main viewer component ────────────────────────────────────────────────────

function SpadesViewer({ roomCode, isCreator }) {
  const { room, loading, updateState } = useGameRoom(roomCode, 'spades', 'viewer');

  // Stable per-browser player ID
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
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);

  // Join-flow state
  // 'unknown' → waiting for room load
  // 'choose'  → show Play/Spectate dialog (joining existing room)
  // 'cpu'     → show CPU-or-wait dialog (room creator who just sat)
  // 'seated'  → in a seat
  // 'spectating' → spectator
  const [joinFlow, setJoinFlow] = useState('unknown');
  const [mySeatNumber, setMySeatNumber] = useState(null);
  const [myRole, setMyRole] = useState(null); // 'player' | 'spectator' | null

  const containerRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const audioRef = useRef(null);
  const didInitJoin = useRef(false);

  const gs = room?.game_state || {};
  const players = gs.players || [];

  // ── Fullscreen listener ──
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── On room load: detect if I'm already seated/spectating ──
  useEffect(() => {
    if (!room || didInitJoin.current) return;
    didInitJoin.current = true;

    const me = players.find(p => p.playerId === playerId);
    if (me) {
      // Already in this room from a previous visit
      if (me.seatNumber != null && (me.role === 'player' || me.role === 'hostPlayer')) {
        setMySeatNumber(me.seatNumber);
        setMyRole('player');
        setJoinFlow('seated');
      } else {
        setMyRole('spectator');
        setJoinFlow('spectating');
      }
    } else if (isCreator) {
      // Room creator — auto-sit in first available seat, then show CPU choice
      const firstEmpty = emptySeatsIn(players);
      const seatTarget = firstEmpty.length > 0 ? firstEmpty[0] : null;
      if (seatTarget) {
        sitInSeat(seatTarget).then(() => setJoinFlow('cpu'));
      } else {
        setJoinFlow('cpu');
      }
    } else {
      // Joiner — show Play/Spectate
      setJoinFlow('choose');
    }
  }, [room]);

  // ── Keep mySeatNumber in sync if the game state updates my seat ──
  useEffect(() => {
    if (!room) return;
    const me = players.find(p => p.playerId === playerId);
    if (me && me.seatNumber != null && (me.role === 'player' || me.role === 'hostPlayer')) {
      setMySeatNumber(me.seatNumber);
      setMyRole('player');
    }
  }, [room]);

  // ── CPU auto-shuffle/deal (only when dealer seat is CPU) ──
  useEffect(() => {
    if (!room || !gs.dealer_seat || !gs.cpu_enabled) return;
    if (gs.phase !== 'setup' && gs.phase) return;
    if (gs.deck && gs.deck.length > 0) return;

    const seated = getSeatedPlayers(gs.players || []);
    const dealer = seated.find(p => p.seatNumber === gs.dealer_seat);
    if (!dealer || dealer.playerType !== 'cpu') return;

    const timer = setTimeout(async () => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;
      try {
        const previewDeck = shuffleDeck(generateFullDeck());
        await updateState({ deck: previewDeck, deck_shuffled: true, shuffle_ts: Date.now(), shuffle_count: 1 });
        await new Promise(resolve => setTimeout(resolve, 1200));
        await handleAutoDeal(previewDeck);
      } finally {
        isUpdatingRef.current = false;
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [gs.dealer_seat, gs.phase, gs.cpu_enabled, gs.deck]);

  // ── CPU turn handler ──
  useEffect(() => {
    if (!room || !gs.cpu_enabled || gs.phase !== 'playing') return;
    const currentTurnSeat = gs.current_turn_seat;
    if (!currentTurnSeat) return;
    const currentPlayer = players.find(p => p.seatNumber === currentTurnSeat);
    if (!currentPlayer || currentPlayer.playerType !== 'cpu') return;
    const hasPlayed = (gs.current_trick || []).some(p => p.seatNumber === currentTurnSeat);
    if (hasPlayed) return;
    const hand = currentPlayer.hand || [];
    if (hand.length === 0) return;

    const isLead = (gs.current_trick || []).length === 0;
    const activeSuit = getActiveSuit(gs.current_trick || []);

    const timer = setTimeout(async () => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;
      try {
        let cardToPlay = selectCPUCard(hand, gs.current_trick || [], 0, currentPlayer.bid || 0, currentPlayer.tricksWon || 0, gs.spades_broken || false, gs, currentTurnSeat);
        if (!cardToPlay || !isValidPlay(cardToPlay, hand, gs.current_trick || [], activeSuit, gs.spades_broken || false, isLead).valid) {
          cardToPlay = hand.find(c => isValidPlay(c, hand, gs.current_trick || [], activeSuit, gs.spades_broken || false, isLead).valid);
          if (!cardToPlay) return;
        }
        const updatedPlayers = players.map(p =>
          p.playerId === currentPlayer.playerId
            ? { ...p, hand: p.hand.filter(c => c.id !== cardToPlay.id), lastActionAt: Date.now() }
            : p
        );
        const seatedPlayers = players.filter(p => p.seatNumber != null).sort((a, b) => a.seatNumber - b.seatNumber);
        const currentIndex = seatedPlayers.findIndex(p => p.seatNumber === currentTurnSeat);
        const nextPlayer = seatedPlayers[(currentIndex + 1) % seatedPlayers.length];
        const spadesBroken = gs.spades_broken || cardToPlay.suit === '♠';
        await updateState({
          players: updatedPlayers,
          current_trick: [...(gs.current_trick || []), { playerId: currentPlayer.playerId, seatNumber: currentTurnSeat, card: cardToPlay }],
          current_turn_seat: nextPlayer?.seatNumber || currentTurnSeat,
          spades_broken: spadesBroken,
        });
      } finally {
        setTimeout(() => { isUpdatingRef.current = false; }, 800);
      }
    }, CPU_ACTION_DELAY + 500);
    return () => clearTimeout(timer);
  }, [gs.current_turn_seat, gs.current_trick, gs.phase, gs.cpu_enabled, gs.spades_broken, players]);

  // ── Trick completion handler ──
  useEffect(() => {
    if (!room || !gs.cpu_enabled || gs.phase !== 'playing') return;
    const trick = gs.current_trick || [];
    const seatedPlayers = (gs.players || []).filter(p => p.seatNumber != null);
    if (trick.length !== seatedPlayers.length) return;
    const activeSuit = getActiveSuit(trick);
    const winner = determineTrickWinner(trick, activeSuit);
    if (!winner) return;

    const timer = setTimeout(async () => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;
      try {
        const winningSeat = winner.seatNumber;
        const winningTeam = getTeamFromSeat(winningSeat);
        const updatedPlayers = players.map(p => p.seatNumber === winningSeat ? { ...p, tricksWon: (p.tricksWon || 0) + 1 } : p);
        await updateState({
          players: updatedPlayers,
          current_trick: [],
          current_turn_seat: winningSeat,
          tricks_played: (gs.tricks_played || 0) + 1,
          books1: winningTeam === 1 ? (gs.books1 || 0) + 1 : gs.books1 || 0,
          books2: winningTeam === 2 ? (gs.books2 || 0) + 1 : gs.books2 || 0,
          spades_broken: gs.spades_broken || trick.some(t => t.card.suit === '♠'),
        });
      } finally {
        setTimeout(() => { isUpdatingRef.current = false; }, 1000);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [gs.current_trick, gs.phase, gs.cpu_enabled, gs.players]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAutoDeal = async (shuffledDeck) => {
    const seated = getSeatedPlayers(gs.players || []);
    if (seated.length < 2) return;
    const dealerSeat = gs.dealer_seat || seated[0]?.seatNumber || 1;
    const deckToDeal = shuffledDeck ?? ((gs.deck_shuffled && gs.deck?.length) ? gs.deck : shuffleDeck(generateFullDeck()));
    const { dealSequence, handsBySeatNumber, dealStartSeat } = dealFromShuffledDeck(deckToDeal, seated, dealerSeat);
    const dealerIdx = seated.findIndex(s => s.seatNumber === dealerSeat);
    const firstBidder = seated[(dealerIdx + 1) % seated.length]?.seatNumber;
    const currentPlayers = gs.players || [];

    const clearedPlayers = currentPlayers.map(p =>
      p.seatNumber != null ? { ...p, hand: [], bid: 0, tricksWon: 0 } : p
    );
    await updateState({
      players: clearedPlayers, phase: 'setup', status: 'active',
      deck: dealSequence, deck_shuffled: true, deal_start_seat: dealStartSeat,
      deal_ts: Date.now(),
      current_trick: [], tricks_played: 0,
      bid1: 0, bid2: 0, books1: 0, books2: 0,
      shuffle_count: 0, spades_broken: false, completed_books: [],
    });

    const DEAL_INTERVAL_MS = 130;
    await new Promise(resolve => setTimeout(resolve, dealSequence.length * DEAL_INTERVAL_MS + 600));

    const finalPlayers = currentPlayers.map(p => {
      const hand = handsBySeatNumber.get(p.seatNumber);
      if (hand) return { ...p, hand, bid: 0, tricksWon: 0 };
      return p;
    });
    await updateState({
      players: finalPlayers, phase: 'playing',
      deck: [], deck_shuffled: false,
      current_turn_seat: firstBidder,
      first_hand_no_bid: true,
    });
  };

  // Sit in a specific seat
  const sitInSeat = async (seatNum) => {
    if (!room) return;
    const currentPlayers = gs.players || [];

    // Check if a CPU is at this seat — replace it
    const cpuAtSeat = currentPlayers.find(p => p.seatNumber === seatNum && p.playerType === 'cpu');
    if (cpuAtSeat) {
      let updatedPlayers = replaceCPUWithHuman(currentPlayers, seatNum, playerId, 'player');
      // Remove self from any other seat
      updatedPlayers = updatedPlayers.filter(p => !(p.playerId === playerId && p.seatNumber !== seatNum));
      await updateState({ players: updatedPlayers });
      setMyRole('player');
      setMySeatNumber(seatNum);
      setJoinFlow('seated');
      return;
    }

    // Seat must be empty
    const existing = currentPlayers.find(p => p.playerId === playerId);
    const newPlayer = { playerId, seatNumber: seatNum, role: 'player', playerType: 'human', connected: true, joinedAt: Date.now(), lastActionAt: Date.now(), hand: [], bid: null, tricksWon: 0 };
    const updatedPlayers = existing
      ? currentPlayers.map(p => p.playerId === playerId ? { ...p, seatNumber: seatNum, role: 'player', playerType: 'human', connected: true } : p)
      : [...currentPlayers, newPlayer];

    await updateState({ players: updatedPlayers });
    setMyRole('player');
    setMySeatNumber(seatNum);
    setJoinFlow('seated');
  };

  // Join flow: user clicks "Play" (joiners only — no CPU prompt)
  const handleChooseSit = async () => {
    if (!room) return;
    // Empty seats first, then CPU seats — never replace a human
    const emptySeats = emptySeatsIn(players);
    const cpuSeats = SPADES_SEATS.filter(s => {
      const p = players.find(p => p.seatNumber === s && (p.role === 'player' || p.role === 'hostPlayer'));
      return p && p.playerType === 'cpu';
    });
    const available = [...emptySeats, ...cpuSeats];
    if (available.length === 0) {
      // All 4 seats taken by humans — spectate only
      await handleChooseSpectate();
      return;
    }
    await sitInSeat(available[0]);
  };

  // Join flow: user clicks "Spectate"
  const handleChooseSpectate = async () => {
    if (!room) return;
    const currentPlayers = gs.players || [];
    const existing = currentPlayers.find(p => p.playerId === playerId);
    const updatedPlayers = existing
      ? currentPlayers.map(p => p.playerId === playerId ? { ...p, role: 'spectator', seatNumber: null, hand: [], connected: true } : p)
      : [...currentPlayers, { playerId, seatNumber: null, role: 'spectator', playerType: 'human', connected: true, joinedAt: Date.now() }];
    await updateState({ players: updatedPlayers });
    setMyRole('spectator');
    setJoinFlow('spectating');
  };

  // After sitting, if there are empty seats → show CPU choice
  const handleAfterSit = () => {
    const emptySeats = emptySeatsIn(players);
    if (emptySeats.length > 0 && !gs.cpu_enabled) {
      setJoinFlow('cpu');
    } else {
      setJoinFlow('seated');
    }
  };

  // CPU choice handlers
  const handlePlayAgainstCPU = async () => {
    if (!room) return;
    const currentPlayers = gs.players || [];
    const filledPlayers = fillEmptySeatsWithCPU(currentPlayers, gs);
    await updateState({
      players: filledPlayers,
      cpu_enabled: true,
      dealer_seat: gs.dealer_seat || mySeatNumber || 1,
      phase: 'setup',
    });
    setJoinFlow('seated');
  };

  const handleWaitForRealPlayers = async () => {
    setJoinFlow('seated');
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    }
  };

  // Play a card
  const handlePlayCard = async (card) => {
    if (!room || myRole !== 'player' || gs.phase !== 'playing') return;
    if (gs.current_turn_seat !== mySeatNumber) {
      alert('Not your turn!');
      return;
    }
    const myPlayer = players.find(p => p.playerId === playerId);
    if (!myPlayer || !myPlayer.hand) return;
    const isLead = (gs.current_trick || []).length === 0;
    const activeSuit = getActiveSuit(gs.current_trick || []);
    const validation = isValidPlay(card, myPlayer.hand, gs.current_trick || [], activeSuit, gs.spades_broken || false, isLead);
    if (!validation.valid) {
      alert(validation.errors[0] || 'Invalid play');
      return;
    }
    const updatedPlayers = players.map(p =>
      p.playerId === playerId ? { ...p, hand: p.hand.filter(c => c.id !== card.id), lastActionAt: Date.now() } : p
    );
    const newTrick = [...(gs.current_trick || []), { playerId, seatNumber: mySeatNumber, card }];
    const seatedPlayers = players.filter(p => p.seatNumber != null).sort((a, b) => a.seatNumber - b.seatNumber);
    const currentIndex = seatedPlayers.findIndex(p => p.seatNumber === mySeatNumber);
    const nextPlayer = seatedPlayers[(currentIndex + 1) % seatedPlayers.length];
    const spadesBroken = gs.spades_broken || card.suit === '♠';
    await updateState({
      players: updatedPlayers,
      current_trick: newTrick,
      current_turn_seat: nextPlayer?.seatNumber || mySeatNumber,
      spades_broken: spadesBroken,
    });
  };

  // Stand up
  const handleStandUp = async () => {
    if (!room || myRole !== 'player') return;
    if (gs.phase === 'playing' || gs.phase === 'bidding') {
      const confirmed = window.confirm('Standing during an active hand may affect gameplay. Are you sure?');
      if (!confirmed) return;
    }
    const updatedPlayers = players.map(p =>
      p.playerId === playerId ? { ...p, role: 'spectator', seatNumber: null, hand: [], tricksWon: 0, bid: null } : p
    );
    await updateState({ players: updatedPlayers });
    setMyRole('spectator');
    setMySeatNumber(null);
    setJoinFlow('spectating');
  };

  // Take over a CPU seat (from seat button)
  const handleTakeOverCPU = async (seatNum) => {
    await sitInSeat(seatNum);
  };

  // Music
  const jazzPlaylist = [
    'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/24/audio_31f62e0f6e.mp3?filename=smooth-jazz-11510.mp3',
    'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d1718ab42b.mp3?filename=lofi-chill-11042.mp3',
  ];
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  useEffect(() => {
    if (audioRef.current && !audioRef.current.src) audioRef.current.src = jazzPlaylist[0];
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      const nextIndex = (currentTrackIndex + 1) % jazzPlaylist.length;
      setCurrentTrackIndex(nextIndex);
      audio.src = jazzPlaylist[nextIndex];
      audio.play().catch(() => {});
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentTrackIndex]);

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (musicEnabled) { audioRef.current.pause(); } else { audioRef.current.play().catch(() => {}); }
    setMusicEnabled(!musicEnabled);
  };
  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  // ─── Derived state ────────────────────────────────────────────────────────
  const isPlayer = myRole === 'player';
  const isSpectator = myRole === 'spectator';
  const myPlayer = players.find(p => p.playerId === playerId);
  const joinable = joinableSeatsFor(players);
  const emptySeats = emptySeatsIn(players);

  // CPU choice dialog: only shown to the room creator after sitting (not to joiners)
  const showCPUChoice = joinFlow === 'cpu';
  // Play/Spectate dialog: shown to new visitors
  const showJoinChoice = joinFlow === 'choose' && !loading && room;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <audio ref={audioRef} loop preload="auto" />

      {/* ── Join dialog: Play or Spectate ─────────────────────────────────── */}
      {showJoinChoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0a1a0a] to-[#050a05] border-4 border-[#BC13FE]/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(188,19,254,0.3)' }}>
            <div className="text-center mb-6">
              <div className="text-xl font-heading text-[#BC13FE] uppercase tracking-widest mb-2" style={PS2}>🎮 Join Room</div>
              <div className="text-white/60 text-sm">ROOM {roomCode}</div>
            </div>
            <div className="space-y-3">
              {(() => {
                const cpuSeats = SPADES_SEATS.filter(s => {
                  const p = players.find(p => p.seatNumber === s && (p.role === 'player' || p.role === 'hostPlayer'));
                  return p && p.playerType === 'cpu';
                });
                const canPlay = emptySeats.length > 0 || cpuSeats.length > 0;
                return canPlay ? (
                  <button onClick={handleChooseSit}
                    className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-base uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>
                    🎯 Play (Take a Seat)
                    {cpuSeats.length > 0 && emptySeats.length === 0 && (
                      <div className="text-[7px] mt-1 opacity-70 normal-case tracking-normal">Replace a CPU player</div>
                    )}
                  </button>
                ) : (
                  <div className="w-full py-3 px-6 border border-white/10 rounded-xl text-center text-white/30 text-[8px] tracking-widest uppercase" style={PS2}>
                    🚫 All seats taken by players
                  </div>
                );
              })()}
              <button onClick={handleChooseSpectate}
                className="w-full py-4 px-6 bg-gradient-to-r from-[#6b7280] to-[#4b5563] hover:from-[#4b5563] hover:to-[#6b7280] text-white font-heading text-base uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>
                👁 Spectate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CPU choice dialog: only for room creator ──────────────────────── */}
      {showCPUChoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0a1a0a] to-[#050a05] border-4 border-[#FFD700]/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
            <div className="text-center mb-6">
              <div className="text-xl font-heading text-[#FFD700] uppercase tracking-widest mb-2" style={PS2}>🃏 Set Up Room</div>
              <div className="text-white/60 text-sm">How do you want to fill the empty seats?</div>
            </div>
            <div className="space-y-3">
              <button onClick={handlePlayAgainstCPU}
                className="w-full py-4 px-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFA500] hover:to-[#FFD700] text-black font-heading text-base uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>
                🤖 Play with CPU
                <div className="text-[7px] mt-1 opacity-70 normal-case tracking-normal">Fill empty seats with AI players</div>
              </button>
              <button onClick={handleWaitForRealPlayers}
                className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-base uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>
                👥 Wait for Players
                <div className="text-[7px] mt-1 opacity-70 normal-case tracking-normal">Share room code and play with humans</div>
              </button>
            </div>
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
        musicEnabled={musicEnabled}
        onToggleMusic={toggleMusic}
        volume={volume}
        onVolumeChange={handleVolumeChange}
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
            joinableSeats={joinable}
            emptySeats={emptySeats}
            onSitInSeat={sitInSeat}
            roomCode={roomCode}
            // CPU choice is handled locally — never pass it down to SpadesTable
            cpuChoiceShown={false}
            onPlayAgainstCPU={handlePlayAgainstCPU}
            onWaitForRealPlayers={handleWaitForRealPlayers}
            onChooseSpectate={handleChooseSpectate}
            onChooseSit={handleChooseSit}
            onPlayCard={handlePlayCard}
            onStandUp={handleStandUp}
            onTakeOverCPU={handleTakeOverCPU}
          />
        </div>
      )}
    </div>
  );
}

function SpadesHeader({ roomCode, room, isFullscreen, containerRef, seatNumber, isSeated, myRole, musicEnabled, onToggleMusic, volume, onVolumeChange }) {
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
            <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-[7px] tracking-widest uppercase hidden sm:inline" style={PS2}>🔴 HOST LIVE</span>
          )}
          {myRole === 'spectator' && (
            <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-white/40 text-[7px] tracking-widest uppercase" style={PS2}>👁 SPECTATING</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSeated && seatNumber && (
            <div className="px-2 py-1 rounded border border-[#BC13FE] bg-[#BC13FE]/10 text-[7px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>SEAT {seatNumber}</div>
          )}
          <div className="flex items-center gap-2 px-2 py-1 rounded border border-[#FFD700]/30 bg-[#FFD700]/5">
            <button onClick={onToggleMusic} className="text-[#FFD700] hover:text-[#FFD700]/80 transition-all" style={PS2}>
              {musicEnabled ? '🔊' : '🔇'}
            </button>
            {musicEnabled && (
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={onVolumeChange} className="w-20 h-1 bg-[#FFD700]/30 rounded-lg appearance-none cursor-pointer" style={{ accentColor: '#FFD700' }} />
            )}
          </div>
          <Link to="/games" className="px-2 py-1 border border-[#FFD700]/40 text-[#FFD700]/80 rounded hover:bg-[#FFD700]/10 transition-all text-[7px] tracking-widest uppercase hidden sm:block" style={PS2}>← LOBBY</Link>
          <button onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
            className="px-2 py-1 bg-[#FF5F1F] text-white rounded hover:bg-[#FF5F1F]/80 transition-all text-[7px] tracking-widest uppercase" style={PS2}>
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>
      </div>
    </header>
  );
}