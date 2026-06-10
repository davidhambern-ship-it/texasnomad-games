import React, { useState, useEffect, useRef } from 'react';
import SpadesCardArea from '@/components/spades/SpadesCardArea.jsx';
import SpadesShuffleAnimation from '@/components/spades/SpadesShuffleAnimation';
import HostSeatSlot from './spades/HostSeatSlot';
import HostHandBox from './spades/HostHandBox';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';
import { calculateCPUBid, selectCPUCard, CPU_ACTION_DELAY, fillEmptySeatsWithCPU, createCPUPlayer, fillEmptySeatsWithTNCharacters, assignTNCharacterToSeat, removeCPUPlayers } from '@/lib/spadesCPU';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';
import { generateFullDeck, shuffleDeck as shuffleDeckRules, dealFromShuffledDeck, getSeatedPlayers, isValidPlay, determineTrickWinner, getActiveSuit, getTeamFromSeat } from '@/lib/spadesRules';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HOST_PLAYER_ID = 'host_player_spades';

const Btn = ({ children, onClick, color = '#BC13FE', size = 'md', className = '', disabled = false }) => {
  const pad = size === 'lg' ? 'px-6 py-4 text-xl' : size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`font-heading tracking-widest uppercase rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 ${pad} ${className}`}
      style={{ borderColor: color, color, background: 'transparent' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
};

export default function SpadesHostPanel({ gs, updateState }) {
  const [team1Name, setTeam1Name] = useState(gs.team1Name || 'Team 1');
  const [team2Name, setTeam2Name] = useState(gs.team2Name || 'Team 2');
  const [targetScore, setTargetScore] = useState(gs.targetScore || 500);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shufflePhase, setShufflePhase] = useState('idle');
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef(null);

  const players = gs.players || [];
  const isSetup = !gs.phase || gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing' || gs.phase === 'playing_trick';
  const isBidding = gs.phase === 'bidding';

  const seatedPlayers = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
  const hostInSeat = players.find(p => p.playerId === HOST_PLAYER_ID);
  const occupiedSeats = seatedPlayers.map(p => p.seatNumber);
  const availableSeats = [1, 2, 3, 4].filter(s => !occupiedSeats.includes(s));

  const getPlayerAtSeat = (seatNum) => players.find(p => p.seatNumber === seatNum && (p.role === 'player' || p.role === 'hostPlayer'));

  // Music controls
  const jazzPlaylist = [
    'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/24/audio_31f62e0f6e.mp3?filename=smooth-jazz-11510.mp3',
  ];

  useEffect(() => {
    if (audioRef.current && !audioRef.current.src) {
      audioRef.current.src = jazzPlaylist[0];
    }
  }, []);

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

  // Auto game loops (simplified for brevity)
  useEffect(() => {
    if (!gs.cpu_enabled || gs.phase !== 'playing') return;
    const trick = gs.current_trick || [];
    const seated = players.filter(p => p.seatNumber != null);
    if (trick.length !== seated.length || seated.length === 0) return;
    const timer = setTimeout(async () => {
      const activeSuit = getActiveSuit(trick);
      const winner = determineTrickWinner(trick, activeSuit);
      if (!winner) return;
      const winningSeat = winner.seatNumber;
      const winningTeam = getTeamFromSeat(winningSeat);
      const updatedPlayers = players.map(p => p.seatNumber === winningSeat ? { ...p, tricksWon: (p.tricksWon || 0) + 1 } : p);
      await updateState({
        players: updatedPlayers, current_trick: [], current_turn_seat: winningSeat,
        tricks_played: (gs.tricks_played || 0) + 1,
        books1: winningTeam === 1 ? (gs.books1 || 0) + 1 : gs.books1 || 0,
        books2: winningTeam === 2 ? (gs.books2 || 0) + 1 : gs.books2 || 0,
        spades_broken: gs.spades_broken || trick.some(t => t.card.suit === '♠'),
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [gs.current_trick, gs.phase, gs.cpu_enabled]);

  const hostSitIn = async (seatNum) => {
    const newPlayer = { playerId: HOST_PLAYER_ID, seatNumber: seatNum, role: 'hostPlayer', connected: true, joinedAt: Date.now(), lastActionAt: Date.now(), hand: [], bid: null, tricksWon: 0 };
    const updated = hostInSeat ? players.map(p => p.playerId === HOST_PLAYER_ID ? { ...p, seatNumber: seatNum } : p) : [...players, newPlayer];
    await updateState({ players: updated });
  };

  const hostSitOut = async () => {
    await updateState({ players: players.filter(p => p.playerId !== HOST_PLAYER_ID) });
  };

  const kickPlayer = async (playerId) => {
    const kicked = players.find(p => p.playerId === playerId);
    if (!kicked) return;
    const updated = players.map(p => p.playerId === playerId ? { ...p, role: 'spectator', seatNumber: null, hand: [], kicked: true } : p);
    await updateState({ players: updated });
  };

  const forceTurn = async (seatNum) => {
    await updateState({ current_turn_seat: seatNum, phase: 'playing' });
  };

  const handleShuffle = async () => {
    if (isShuffling) return;
    setIsShuffling(true);
    setShufflePhase('shuffling');
    let deck = generateFullDeck();
    for (let i = 0; i < 3; i++) {
      deck = shuffleDeckRules(deck);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await updateState({ deck, deck_shuffled: true, shuffle_ts: Date.now(), shuffle_count: (gs.shuffle_count || 0) + 1 });
  };

  const handleNewDeck = async () => {
    await updateState({ deck: generateFullDeck(), deck_shuffled: false, current_trick: [], players: players.map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })) });
  };

  const handleDeal = async () => {
    const seated = getSeatedPlayers(players);
    if (seated.length < 2) return;
    if (!gs.deck_shuffled || !gs.deck?.length) return;
    const dealerSeat = gs.dealer_seat || seated[0]?.seatNumber || 1;
    const { handsBySeatNumber, dealStartSeat } = dealFromShuffledDeck(gs.deck, seated, dealerSeat);
    const updatedPlayers = players.map(p => {
      if (p.role !== 'player' && p.role !== 'hostPlayer') return p;
      return { ...p, hand: handsBySeatNumber.get(p.seatNumber) || [], bid: null, tricksWon: 0 };
    });
    const isFirstRound = !gs.first_hand_books || Object.keys(gs.first_hand_books).length === 0;
    const dealerIdx = seated.findIndex(s => s.seatNumber === dealerSeat);
    const firstSeat = isFirstRound
      ? seated[(dealerIdx + 1) % seated.length]?.seatNumber
      : dealerSeat;
    await updateState({
      players: updatedPlayers, phase: isFirstRound ? 'playing' : 'bidding', status: 'active',
      deck: [], deck_shuffled: false, deal_start_seat: dealStartSeat,
      current_trick: [], current_turn_seat: firstSeat,
      current_bidder_seat: isFirstRound ? null : firstSeat,
      tricks_played: 0, bid1: isFirstRound ? 0 : null, bid2: isFirstRound ? 0 : null,
      books1: 0, books2: 0, first_hand_no_bid: isFirstRound, spades_broken: false,
    });
  };

  const scoreRound = async () => {
    const seated = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
    const bid1 = gs.bid1 || 0, bid2 = gs.bid2 || 0;
    const b1 = gs.books1 || 0, b2 = gs.books2 || 0;
    const s1 = b1 >= bid1 ? bid1 * 10 + (b1 - bid1) : -bid1 * 10;
    const s2 = b2 >= bid2 ? bid2 * 10 + (b2 - bid2) : -bid2 * 10;
    await updateState({
      score1: (gs.score1 || 0) + s1, score2: (gs.score2 || 0) + s2, phase: 'setup',
      current_trick: [], players: seated.map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })),
    });
  };

  const resetScore = async () => { await updateState({ score1: 0, score2: 0 }); };
  const resetRound = async () => {
    await updateState({ phase: 'setup', current_trick: [], books1: 0, books2: 0, tricks_played: 0, bid1: null, bid2: null, players: players.map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })) });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Audio element */}
      <audio ref={audioRef} loop preload="auto" />

      {isSetup && (
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
          <h3 className="font-heading text-xs tracking-[0.2em] text-[#BC13FE]/80 uppercase">Team Names</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="px-3 py-2 rounded-lg bg-black/80 border border-[#BC13FE]/40 text-white font-body focus:border-[#BC13FE] focus:outline-none text-sm"
              value={team1Name} onChange={e => setTeam1Name(e.target.value)} placeholder="Team 1" />
            <input className="px-3 py-2 rounded-lg bg-black/80 border border-[#FF5F1F]/40 text-white font-body focus:border-[#FF5F1F] focus:outline-none text-sm"
              value={team2Name} onChange={e => setTeam2Name(e.target.value)} placeholder="Team 2" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[8px] text-white/40 uppercase" style={PS2}>Target:</label>
            <input type="number" className="w-24 px-3 py-2 rounded-lg bg-black/80 border border-white/20 text-white font-body text-sm focus:outline-none"
              value={targetScore} onChange={e => setTargetScore(Number(e.target.value))} />
          </div>
        </div>
      )}

      <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
        <h3 className="font-heading text-xs tracking-[0.2em] text-[#BC13FE]/80 uppercase">🎮 Host Seat</h3>
        {!hostInSeat ? (
          <div className="space-y-2">
            <div className="text-[7px] tracking-widest text-white/30 uppercase" style={PS2}>Choose a seat to play as host</div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map(s => (
                <Btn key={s} onClick={() => hostSitIn(s)} color="#BC13FE" size="sm" disabled={!availableSeats.includes(s)}>Seat {s}</Btn>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>You are in Seat {hostInSeat.seatNumber}</div>
            <Btn onClick={hostSitOut} color="#ef4444" size="sm">Sit Out</Btn>
          </div>
        )}
      </div>

      {/* Music Controls */}
      <div className="p-4 border border-[#FFD700]/30 rounded-xl bg-black/60 space-y-3">
        <h3 className="font-heading text-xs tracking-[0.2em] text-[#FFD700]/80 uppercase">🎵 Music Controls</h3>
        <div className="flex items-center gap-3">
          <button onClick={toggleMusic} className="px-4 py-2 rounded-lg border-2 border-[#FFD700] text-[#FFD700] font-heading text-sm uppercase hover:bg-[#FFD700]/10 transition-all" style={PS2}>
            {musicEnabled ? '🔊 Music On' : '🔇 Music Off'}
          </button>
          {musicEnabled && (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[7px] text-white/40 uppercase" style={PS2}>Volume:</span>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange}
                className="flex-1 h-2 bg-[#FFD700]/30 rounded-lg appearance-none cursor-pointer" style={{ accentColor: '#FFD700' }} />
              <span className="text-[7px] text-[#FFD700] w-8" style={PS2}>{Math.round(volume * 100)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative bg-[#0a1a0a] rounded-3xl border-4 border-[#3d2817]"
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)', minHeight: 380 }}>
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <HostSeatSlot seatNumber={3} player={getPlayerAtSeat(3)} onKick={kickPlayer} onForceTurn={forceTurn} currentBidderSeat={gs.current_bidder_seat} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} isPlaying={isPlaying} onSetBid={() => {}} isHostSeat={getPlayerAtSeat(3)?.playerId === HOST_PLAYER_ID} />
        </div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <HostSeatSlot seatNumber={2} player={getPlayerAtSeat(2)} onKick={kickPlayer} onForceTurn={forceTurn} currentBidderSeat={gs.current_bidder_seat} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} isPlaying={isPlaying} onSetBid={() => {}} isHostSeat={getPlayerAtSeat(2)?.playerId === HOST_PLAYER_ID} />
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <HostSeatSlot seatNumber={4} player={getPlayerAtSeat(4)} onKick={kickPlayer} onForceTurn={forceTurn} currentBidderSeat={gs.current_bidder_seat} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} isPlaying={isPlaying} onSetBid={() => {}} isHostSeat={getPlayerAtSeat(4)?.playerId === HOST_PLAYER_ID} />
        </div>
        {shufflePhase !== 'idle' ? (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 z-20">
            <SpadesShuffleAnimation phase={shufflePhase} onComplete={() => { setShufflePhase('idle'); setIsShuffling(false); }} />
          </div>
        ) : (
          <SpadesCardArea trick={gs.current_trick || []} players={players} />
        )}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <HostSeatSlot seatNumber={1} player={getPlayerAtSeat(1)} onKick={kickPlayer} onForceTurn={forceTurn} currentBidderSeat={gs.current_bidder_seat} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} isPlaying={isPlaying} onSetBid={() => {}} isHostSeat={getPlayerAtSeat(1)?.playerId === HOST_PLAYER_ID} />
        </div>
      </div>

      <HostHandBox hostPlayerId={HOST_PLAYER_ID} players={players} gs={gs} updateState={updateState} />

      <div className="grid grid-cols-2 gap-4">
        {[
          { key: 'score1', booksKey: 'books1', bidKey: 'bid1', name: gs.team1Name || team1Name, color: '#BC13FE' },
          { key: 'score2', booksKey: 'books2', bidKey: 'bid2', name: gs.team2Name || team2Name, color: '#FF5F1F' },
        ].map(t => (
          <div key={t.key} className="p-4 border-2 rounded-xl text-center" style={{ borderColor: `${t.color}30`, background: `${t.color}08` }}>
            <div className="font-heading text-sm tracking-widest text-white uppercase truncate">{t.name}</div>
            <div className="font-heading text-3xl mt-1" style={{ color: t.color }}>{gs[t.key] || 0}</div>
            <div className="text-[7px] text-white/30 mt-1" style={PS2}>Bid: {gs[t.bidKey] ?? '-'} | Books: {gs[t.booksKey] ?? 0}</div>
            <div className="flex gap-1 justify-center mt-2">
              <button onClick={() => updateState({ [t.key]: Math.max(0, (gs[t.key] || 0) - 10) })} className="px-2 py-1 rounded border border-red-500/40 text-red-400 font-heading text-xs hover:bg-red-500/20">-10</button>
              <button onClick={() => updateState({ [t.key]: (gs[t.key] || 0) + 10 })} className="px-2 py-1 rounded border border-green-500/40 text-green-400 font-heading text-xs hover:bg-green-500/20">+10</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── TexasNomad AI Team Panel ── */}
      <div className="p-4 border border-[#FFD700]/30 rounded-xl bg-black/60 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xs tracking-[0.2em] text-[#FFD700]/80 uppercase">🤖 TexasNomad AI Team</h3>
          <div className="flex gap-2">
            <Btn onClick={async () => {
              const filled = fillEmptySeatsWithTNCharacters(players, gs);
              await updateState({ players: filled, cpu_enabled: true });
            }} color="#FFD700" size="sm" disabled={availableSeats.length === 0}>⚡ Randomize AI Seats</Btn>
            <Btn onClick={async () => {
              const newPlayers = removeCPUPlayers(players);
              await updateState({ players: newPlayers, cpu_enabled: newPlayers.some(p => p.playerType === 'cpu') });
            }} color="#ef4444" size="sm" disabled={!players.some(p => p.playerType === 'cpu')}>✕ Clear All AI</Btn>
          </div>
        </div>

        {/* Per-seat AI assignment */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(seat => {
            const seatPlayer = getPlayerAtSeat(seat);
            const isCPU = seatPlayer?.playerType === 'cpu';
            const isHuman = seatPlayer && !isCPU;
            const charColors = { berna: '#BC13FE', dexter: '#22d3ee', lemonade: '#FFD700', carlos: '#FF5F1F', violet: '#8b5cf6', tank: '#4ade80' };
            const cc = seatPlayer?.characterId ? charColors[seatPlayer.characterId] || '#FFD700' : '#ffffff20';
            const partnerSeat = seat === 1 ? 3 : seat === 3 ? 1 : seat === 2 ? 4 : 2;
            return (
              <div key={seat} className="p-3 rounded-xl border space-y-2" style={{ borderColor: isCPU ? `${cc}40` : isHuman ? '#4ade8030' : '#ffffff10', background: isCPU ? `${cc}08` : '#000000' }}>
                <div className="flex items-center justify-between">
                  <div className="text-[7px] tracking-widest text-white/50 uppercase" style={PS2}>
                    Seat {seat} · T{[1,3].includes(seat) ? 1 : 2} · w/ {partnerSeat}
                  </div>
                  {isCPU && seatPlayer.characterAvatar && (
                    <img src={seatPlayer.characterAvatar} alt={seatPlayer.name} className="w-6 h-6 rounded border object-cover" style={{ borderColor: cc }} />
                  )}
                </div>

                {isHuman ? (
                  <div className="text-[7px] text-[#4ade80]/70 uppercase tracking-widest" style={PS2}>👤 Human Player</div>
                ) : (
                  <select
                    value={seatPlayer?.characterId || ''}
                    onChange={async (e) => {
                      const val = e.target.value;
                      if (!val) {
                        // Remove AI from seat
                        const updated = players.filter(p => p.seatNumber !== seat);
                        const hasCPU = updated.some(p => p.playerType === 'cpu');
                        await updateState({ players: updated, cpu_enabled: hasCPU });
                      } else {
                        const updated = assignTNCharacterToSeat(players, seat, val);
                        await updateState({ players: updated, cpu_enabled: true });
                      }
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-black/80 border text-white font-body text-xs focus:outline-none"
                    style={{ borderColor: isCPU ? `${cc}40` : '#ffffff20' }}
                  >
                    <option value="">— Human Player —</option>
                    <option value="random">🎲 Random AI</option>
                    {TEXASNOMAD_CHARACTERS.map(c => {
                      const inUse = players.some(p => p.characterId === c.id && p.seatNumber !== seat);
                      return (
                        <option key={c.id} value={c.id} disabled={inUse}>
                          {c.name} ({c.role}){inUse ? ' — in use' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}

                {isCPU && seatPlayer.name && (
                  <div className="text-[7px] uppercase tracking-widest" style={{ ...PS2, color: cc }}>
                    {seatPlayer.name} · {seatPlayer.characterRole}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-[6px] text-white/20 uppercase tracking-widest text-center" style={PS2}>
          Seat 1 ↔ Seat 3 · Seat 2 ↔ Seat 4 · No duplicate characters allowed
        </div>
      </div>

      <div className="p-4 border border-white/10 rounded-xl bg-black/60 space-y-3">
        <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Controls</h3>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={handleShuffle} color="#FFD700" size="sm" disabled={isShuffling}>{isShuffling ? '⏳ Shuffling...' : gs.deck_shuffled ? '✓ Shuffled' : '🔀 Shuffle'}</Btn>
          <Btn onClick={handleDeal} color="#4ade80" size="sm" disabled={seatedPlayers.length < 2 || !gs.deck_shuffled || !gs.deck?.length}>🃏 Deal</Btn>
          <Btn onClick={handleNewDeck} color="#22d3ee" size="sm">🂠 New Deck</Btn>
          <Btn onClick={scoreRound} color="#FF5F1F" size="sm">📊 Score Round</Btn>
          <Btn onClick={async () => { if (gs.cpu_enabled && gs.phase === 'playing') { await updateState({ cpu_enabled: false, phase: 'setup', current_trick: [], current_turn_seat: null, current_bidder_seat: null }); } else { const seated = players.filter(p => p.role === 'player' || p.role === 'hostPlayer'); if (seated.length >= 2 && gs.deck && gs.deck.length > 0) { await updateState({ cpu_enabled: true, phase: 'playing' }); } } }} color={gs.cpu_enabled && gs.phase === 'playing' ? "#ef4444" : "#4ade80"} size="sm">{gs.cpu_enabled && gs.phase === 'playing' ? '⏹ Stop' : '▶ Start'}</Btn>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <Btn onClick={resetRound} color="#ffffff" size="sm">↺ Reset Round</Btn>
          <Btn onClick={resetScore} color="#ef4444" size="sm">Reset Score</Btn>
        </div>
      </div>
    </div>
  );
}