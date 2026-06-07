import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';
import SpadesTable from '@/components/spades/SpadesTable';
import { fillEmptySeatsWithCPU, selectCPUCard, CPU_ACTION_DELAY } from '@/lib/spadesCPU';
import { generateFullDeck, shuffleDeck, shuffleAndDealToPlayers, getSeatedPlayers, isValidPlay, determineTrickWinner, getActiveSuit, getTeamFromSeat } from '@/lib/spadesRules';

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
  const [isWaitingForPlayers, setIsWaitingForPlayers] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);

  const containerRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const audioRef = useRef(null);
  const gs = room?.game_state || {};
  const players = gs.players || [];

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!room || !playerId) return;
    const me = players.find(p => p.playerId === playerId);
    if (me) {
      setMySeatNumber(me.seatNumber);
      setMyRole(me.role);
      localStorage.setItem(`spades_role_${roomCode}`, me.role);
    }
  }, [room, playerId]);

  const handleAutoDeal = async () => {
    const seated = getSeatedPlayers(gs.players || []);
    if (seated.length < 2) return;
    const dealerSeat = gs.dealer_seat || seated[0]?.seatNumber || 1;
    const { handsBySeatNumber, dealStartSeat } = shuffleAndDealToPlayers(seated, dealerSeat);
    const updatedPlayers = (gs.players || []).map(p => {
      const hand = handsBySeatNumber.get(p.seatNumber);
      if (hand) return { ...p, hand, bid: 0, tricksWon: 0 };
      return p;
    });
    const dealerIdx = seated.findIndex(s => s.seatNumber === dealerSeat);
    const firstBidder = seated[(dealerIdx + 1) % seated.length]?.seatNumber;
    await updateState({
      players: updatedPlayers, phase: 'playing', status: 'active',
      deck: [], deck_shuffled: true, deal_start_seat: dealStartSeat,
      current_trick: [], current_turn_seat: firstBidder,
      tricks_played: 0, bid1: 0, bid2: 0, books1: 0, books2: 0, shuffle_count: 0,
      first_hand_no_bid: true, spades_broken: false, completed_books: [],
    });
  };

  useEffect(() => {
    if (!room || !gs.dealer_seat || !gs.cpu_enabled) return;
    if (gs.phase !== 'setup' && gs.phase) return;
    if (!gs.deck || gs.deck.length === 0) {
      const timer = setTimeout(async () => {
        const previewDeck = shuffleDeck(generateFullDeck());
        await updateState({ deck: previewDeck, deck_shuffled: true, shuffle_ts: Date.now(), shuffle_count: 1 });
        await new Promise(resolve => setTimeout(resolve, 1200));
        await handleAutoDeal();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gs.dealer_seat, gs.phase, gs.cpu_enabled, room]);

  // CPU turn handler
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
  }, [gs.current_turn_seat, gs.current_trick, gs.phase, gs.cpu_enabled, gs.spades_broken, players, room]);

  // Trick completion handler
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
        const newTricksPlayed = (gs.tricks_played || 0) + 1;
        const newBooks1 = winningTeam === 1 ? (gs.books1 || 0) + 1 : gs.books1 || 0;
        const newBooks2 = winningTeam === 2 ? (gs.books2 || 0) + 1 : gs.books2 || 0;
        await updateState({
          players: updatedPlayers, current_trick: [], current_turn_seat: winningSeat,
          tricks_played: newTricksPlayed, books1: newBooks1, books2: newBooks2,
          spades_broken: gs.spades_broken || trick.some(t => t.card.suit === '♠'),
        });
      } finally {
        setTimeout(() => { isUpdatingRef.current = false; }, 1000);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [gs.current_trick, gs.phase, gs.cpu_enabled, gs.players, room]);

  const occupiedSeats = players.filter(p => p.role === 'player' || p.role === 'hostPlayer').map(p => p.seatNumber);
  const availableSeats = SPADES_SEATS.filter(s => !occupiedSeats.includes(s));

  const sitInSeat = async (seatNum) => {
    if (!room) return;
    const newPlayer = { playerId, seatNumber: seatNum, role: 'player', playerType: 'human', connected: true, joinedAt: Date.now(), lastActionAt: Date.now() };
    const existing = players.find(p => p.playerId === playerId);
    const updatedPlayers = existing
      ? players.map(p => p.playerId === playerId ? { ...p, seatNumber: seatNum, role: 'player', playerType: 'human', connected: true } : p)
      : [...players, newPlayer];
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'player');
    setMyRole('player');
    setMySeatNumber(seatNum);
  };

  const handleChooseSit = async () => {
    if (!room) return;
    if (availableSeats.length === 0) {
      const newPlayer = { playerId, seatNumber: null, role: 'spectator', connected: true, joinedAt: Date.now(), lastActionAt: Date.now() };
      const existing = players.find(p => p.playerId === playerId);
      const updatedPlayers = existing ? players.map(p => p.playerId === playerId ? { ...p, role: 'spectator', connected: true } : p) : [...players, newPlayer];
      await updateState({ players: updatedPlayers });
      localStorage.setItem(`spades_role_${roomCode}`, 'spectator');
      setMyRole('spectator');
      return;
    }
    await sitInSeat(availableSeats[0]);
  };

  const handleChooseSpectate = async () => {
    if (!room) return;
    const newPlayer = { playerId, seatNumber: null, role: 'spectator', connected: true, joinedAt: Date.now(), lastActionAt: Date.now() };
    const existing = players.find(p => p.playerId === playerId);
    const updatedPlayers = existing ? players.map(p => p.playerId === playerId ? { ...p, role: 'spectator', connected: true } : p) : [...players, newPlayer];
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'spectator');
    setMyRole('spectator');
  };

  const handlePlayAgainstCPU = async () => {
    if (!room) return;
    const currentPlayers = gs.players || [];
    const filledPlayers = fillEmptySeatsWithCPU(currentPlayers, gs);
    await updateState({ players: filledPlayers, cpu_enabled: true, dealer_seat: gs.dealer_seat || 1, phase: 'setup' });
    setCpuChoiceShown(false);
    const previewDeck = shuffleDeck(generateFullDeck());
    await updateState({ deck: previewDeck, deck_shuffled: true, shuffle_ts: Date.now(), shuffle_count: 1 });
    await new Promise(resolve => setTimeout(resolve, 1200));
    await handleAutoDeal();
  };

  const handleWaitForRealPlayers = async () => {
    if (!room) return;
    setCpuChoiceShown(false);
    setIsWaitingForPlayers(true);
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    }
  };

  const handlePlayCard = async (card) => {
    if (!room || !isPlayer || gs.phase !== 'playing') return;
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
    const updatedPlayers = players.map(p => p.playerId === playerId ? { ...p, hand: p.hand.filter(c => c.id !== card.id), lastActionAt: Date.now() } : p);
    const newTrick = [...(gs.current_trick || []), { playerId, seatNumber: mySeatNumber, card }];
    const seatedPlayers = players.filter(p => p.seatNumber != null).sort((a, b) => a.seatNumber - b.seatNumber);
    const currentIndex = seatedPlayers.findIndex(p => p.seatNumber === mySeatNumber);
    const nextPlayer = seatedPlayers[(currentIndex + 1) % seatedPlayers.length];
    const spadesBroken = gs.spades_broken || card.suit === '♠';
    await updateState({ players: updatedPlayers, current_trick: newTrick, current_turn_seat: nextPlayer?.seatNumber || mySeatNumber, spades_broken: spadesBroken });
  };

  const handleStandUp = async () => {
    if (!room || !isPlayer) return;
    if (gs.phase === 'playing' || gs.phase === 'bidding') {
      const confirmed = window.confirm('Standing during an active hand may affect gameplay. Are you sure?');
      if (!confirmed) return;
    }
    const updatedPlayers = players.map(p => p.playerId === playerId ? { ...p, role: 'spectator', seatNumber: null, hand: [], tricksWon: 0, bid: null } : p);
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'spectator');
    setMyRole('spectator');
    setMySeatNumber(null);
    setIsWaitingForPlayers(false);
  };

  const handleTakeOverCPU = async (seatNum) => {
    if (!room || !isSpectator) return;
    const cpuPlayer = players.find(p => p.seatNumber === seatNum && p.playerType === 'cpu');
    if (!cpuPlayer) return;
    const updatedPlayers = players.map(p => p.playerId === cpuPlayer.playerId ? { ...p, playerId, playerType: 'human', role: 'player' } : p);
    await updateState({ players: updatedPlayers });
    localStorage.setItem(`spades_role_${roomCode}`, 'player');
    setMyRole('player');
    setMySeatNumber(seatNum);
  };

  const isPlayer = myRole === 'player' || myRole === 'hostPlayer';
  const isSpectator = myRole === 'spectator';

  useEffect(() => {
    if (isPlayer && availableSeats.length > 0 && !gs.cpu_enabled && !cpuChoiceShown) {
      setCpuChoiceShown(true);
    }
  }, [isPlayer, availableSeats.length, gs.cpu_enabled, cpuChoiceShown, myRole]);

  useEffect(() => {
    if (!isPlayer) setCpuChoiceShown(false);
  }, [isPlayer]);

  const jazzPlaylist = [
    'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/24/audio_31f62e0f6e.mp3?filename=smooth-jazz-11510.mp3',
    'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d1718ab42b.mp3?filename=lofi-chill-11042.mp3',
  ];
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  useEffect(() => {
    if (audioRef.current && !audioRef.current.src) {
      audioRef.current.src = jazzPlaylist[0];
    }
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
    if (musicEnabled) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setMusicEnabled(!musicEnabled);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const showRoleSelection = myRole === null && !loading && room;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <audio ref={audioRef} loop preload="auto" />

      {showRoleSelection && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0a1a0a] to-[#050a05] border-4 border-[#BC13FE]/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(188,19,254,0.3), inset 0 0 60px rgba(0,0,0,0.8)' }}>
            <div className="text-center mb-6">
              <div className="text-2xl font-heading text-[#BC13FE] uppercase tracking-widest mb-2" style={PS2}>🎮 Join Game</div>
              <div className="text-white/60 text-sm">Choose how you want to join</div>
            </div>
            <div className="space-y-3">
              {availableSeats.length > 0 ? (
                <button onClick={handleChooseSit} className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>🎯 Play (Join Seat)</button>
              ) : (
                <button onClick={handleChooseSpectate} className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>👁 Start Spectating</button>
              )}
              {availableSeats.length > 0 && (
                <button onClick={handleChooseSpectate} className="w-full py-4 px-6 bg-gradient-to-r from-[#6b7280] to-[#4b5563] hover:from-[#4b5563] hover:to-[#6b7280] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>👁 Spectate Only</button>
              )}
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
            availableSeats={availableSeats}
            onSitInSeat={sitInSeat}
            roomCode={roomCode}
            cpuChoiceShown={cpuChoiceShown && !isWaitingForPlayers}
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