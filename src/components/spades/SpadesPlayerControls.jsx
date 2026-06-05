import React, { useState, useRef } from 'react';
import { generateFullDeck, shuffleDeck as shuffleDeckSecure } from '@/lib/spadesRules';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const Btn = ({ children, onClick, color = '#BC13FE', size = 'sm', disabled = false }) => {
  const pad = size === 'lg' ? 'px-6 py-4 text-xl' : size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`font-heading tracking-widest uppercase rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${pad}`}
      style={{ borderColor: color, color, background: disabled ? 'transparent' : `${color}15` }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = disabled ? 'transparent' : `${color}15`; }}>
      {children}
    </button>
  );
};

export default function SpadesPlayerControls({ seatNumber, player, gs, updateState, isMySeat, onShuffleStart, onDealStart }) {
  const [bidInput, setBidInput] = useState('');
  const [blindAmount, setBlindAmount] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  
  if (!isMySeat || !player) return null;
  
  const isBidding = gs.phase === 'bidding';
  const isSetup = !gs.phase || gs.phase === 'setup';
  const hasCards = player.hand?.length > 0;
  const isMyTurn = gs.current_turn_seat === seatNumber && gs.phase === 'playing';
  const hasBid = player.bid != null;
  const seatedPlayers = (gs.players || []).filter(p => p.role === 'player' || p.role === 'hostPlayer');
  const hasDeck = gs.deck?.length > 0;

  // SHUFFLE: Trigger animation then update deck in state
  const handleShuffle = async () => {
    if (isShuffling) return;
    setIsShuffling(true);

    // Start shuffle animation
    onShuffleStart?.();

    // Generate shuffled deck (crypto-secure)
    const deck = shuffleDeckSecure(generateFullDeck());

    // Wait for animation (~1.8s), then update state
    await new Promise(resolve => setTimeout(resolve, 1800));
    await updateState({ deck, deck_shuffled: true });
    setIsShuffling(false);
  };

  // DEAL: Trigger deal animation and progressively add cards to hands
  const handleDeal = async () => {
    if (isDealing) return;
    const currentPlayers = gs.players || [];
    const allSeated = currentPlayers.filter(p => p.seatNumber != null);
    if (allSeated.length < 2) {
      alert('Need at least 2 players to deal');
      return;
    }

    const workingDeck = (gs.deck_shuffled && gs.deck?.length > 0)
      ? gs.deck
      : shuffleDeckSecure(generateFullDeck());

    setIsDealing(true);

    // Reset hands to empty so animation can build them up
    const clearedPlayers = currentPlayers.map(p =>
      p.seatNumber != null ? { ...p, hand: [], bid: null, tricksWon: 0 } : p
    );
    const dealerSeat = allSeated[0]?.seatNumber || 1;
    const firstBidder = allSeated[1]?.seatNumber || allSeated[0]?.seatNumber;
    const hasCpu = allSeated.some(p => p.playerType === 'cpu');

    await updateState({
      players: clearedPlayers,
      deck: workingDeck,
      phase: 'setup',
      status: 'active',
      current_trick: [],
      dealer_seat: dealerSeat,
      tricks_played: 0,
      bid1: null, bid2: null,
      books1: 0, books2: 0,
    });

    // Start deal animation
    onDealStart?.();

    // Deal cards round-robin, updating state every card
    const DEAL_DELAY = 120; // ms per card
    const cardsPerPlayer = Math.floor(workingDeck.length / allSeated.length);
    const playerHands = allSeated.map(() => []);

    for (let round = 0; round < cardsPerPlayer; round++) {
      for (let j = 0; j < allSeated.length; j++) {
        const cardIdx = round * allSeated.length + j;
        if (cardIdx >= workingDeck.length) break;
        playerHands[j].push(workingDeck[cardIdx]);

        const updatedPlayers = currentPlayers.map(p => {
          const si = allSeated.findIndex(s => s.playerId === p.playerId);
          return si >= 0 ? { ...p, hand: [...playerHands[si]], bid: null, tricksWon: 0 } : p;
        });

        await updateState({ players: updatedPlayers });
        await new Promise(resolve => setTimeout(resolve, DEAL_DELAY));
      }
    }

    // Transition to bidding/playing
    const finalPlayers = currentPlayers.map(p => {
      const si = allSeated.findIndex(s => s.playerId === p.playerId);
      return si >= 0 ? { ...p, hand: [...playerHands[si]], bid: hasCpu ? 0 : null, tricksWon: 0 } : p;
    });

    await updateState({
      players: finalPlayers,
      phase: hasCpu ? 'playing' : 'bidding',
      deck: [],
      current_bidder_seat: firstBidder,
      current_turn_seat: hasCpu ? firstBidder : null,
      bid1: hasCpu ? 0 : null,
      bid2: hasCpu ? 0 : null,
      first_hand_no_bid: hasCpu,
    });

    setIsDealing(false);
  };

  const handleSetBid = async () => {
    const bid = Number(bidInput);
    if (isNaN(bid) || bid < 0 || bid > 13) return;
    
    const updated = (gs.players || []).map(p => p.playerId === player.playerId ? { ...p, bid } : p);
    const seated = updated.filter(p => p.role === 'player' || p.role === 'hostPlayer').sort((a, b) => a.seatNumber - b.seatNumber);
    const bidderIdx = seated.findIndex(p => p.playerId === player.playerId);
    const nextBidder = seated[(bidderIdx + 1) % seated.length];
    const allBid = updated.filter(p => p.role === 'player' || p.role === 'hostPlayer').every(p => p.bid != null);

    if (allBid) {
      const team1Bid = updated.filter(p => p.team === 1).reduce((sum, p) => sum + (p.bid || 0), 0);
      const team2Bid = updated.filter(p => p.team === 2).reduce((sum, p) => sum + (p.bid || 0), 0);
      await updateState({
        players: updated, phase: 'playing', bid1: team1Bid, bid2: team2Bid,
        current_turn_seat: seated[0]?.seatNumber, current_bidder_seat: null,
      });
    } else {
      await updateState({ players: updated, current_bidder_seat: nextBidder?.seatNumber });
    }
    setBidInput('');
  };

  const handleBlind = async () => {
    if (blindAmount === 0) return;
    const updated = (gs.players || []).map(p => p.playerId === player.playerId ? { ...p, bid: blindAmount, blind: true } : p);
    const seated = updated.filter(p => p.role === 'player' || p.role === 'hostPlayer').sort((a, b) => a.seatNumber - b.seatNumber);
    const bidderIdx = seated.findIndex(p => p.playerId === player.playerId);
    const nextBidder = seated[(bidderIdx + 1) % seated.length];
    const allBid = updated.filter(p => p.role === 'player' || p.role === 'hostPlayer').every(p => p.bid != null);

    if (allBid) {
      const team1Bid = updated.filter(p => p.team === 1).reduce((sum, p) => sum + (p.bid || 0), 0);
      const team2Bid = updated.filter(p => p.team === 2).reduce((sum, p) => sum + (p.bid || 0), 0);
      await updateState({
        players: updated, phase: 'playing', bid1: team1Bid, bid2: team2Bid,
        current_turn_seat: seated[0]?.seatNumber, current_bidder_seat: null,
      });
    } else {
      await updateState({ players: updated, current_bidder_seat: nextBidder?.seatNumber });
    }
    setBlindAmount(0);
  };

  const handleReset = async () => {
    await updateState({
      phase: 'setup', current_trick: [], books1: 0, books2: 0, tricks_played: 0, bid1: null, bid2: null, deck: [],
      players: (gs.players || []).map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })),
      dealer_seat: null,
      current_turn_seat: null,
      shuffle_count: 0,
    });
  };

  return (
    <div className="mt-3 p-3 border-2 rounded-xl bg-black/60"
      style={{ borderColor: '#4ade80', boxShadow: '0 0 15px rgba(74,222,128,0.2)' }}>
      <div className="text-[7px] tracking-widest text-[#4ade80]/60 uppercase mb-2 text-center" style={PS2}>
        Seat {seatNumber} Controls
      </div>
      
      <div className="flex flex-wrap gap-2 justify-center">
        <Btn onClick={handleShuffle} color="#FFD700" size="sm" disabled={!isSetup || isShuffling || isDealing}>
          {isShuffling ? '🔀 Shuffling...' : '🔀 Shuffle'}
        </Btn>
        <Btn onClick={handleDeal} color="#4ade80" size="sm" disabled={!isSetup || isShuffling || isDealing || seatedPlayers.length < 2}>
          {isDealing ? '🃏 Dealing...' : '🃏 Deal'}
        </Btn>
        <Btn onClick={handleReset} color="#ef4444" size="sm" disabled={isSetup && !hasCards && !hasBid}>
          ↺ Reset
        </Btn>
      </div>

      {isBidding && !hasBid && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-[7px] tracking-widest text-[#FF5F1F]/60 uppercase mb-2 text-center" style={PS2}>
            Place Your Bid
          </div>
          <div className="flex gap-2 justify-center items-center">
            <input type="number" min="0" max="13"
              className="w-16 px-2 py-1 rounded bg-black/80 border border-[#FF5F1F]/40 text-white text-sm text-center focus:outline-none focus:border-[#FF5F1F]"
              value={bidInput} onChange={e => setBidInput(e.target.value)} placeholder="0" />
            <Btn onClick={handleSetBid} color="#FF5F1F" size="sm" disabled={!bidInput}>
              Set Bid
            </Btn>
          </div>
          <div className="flex gap-2 justify-center items-center mt-2">
            <select
              className="px-2 py-1 rounded bg-black/80 border border-[#FFD700]/40 text-white text-sm focus:outline-none"
              value={blindAmount} onChange={e => setBlindAmount(Number(e.target.value))}>
              <option value="0">Blind Bid</option>
              <option value="6">Blind 6</option>
              <option value="7">Blind 7</option>
              <option value="8">Blind 8</option>
              <option value="9">Blind 9</option>
              <option value="10">Blind 10</option>
            </select>
            <Btn onClick={handleBlind} color="#FFD700" size="sm" disabled={blindAmount === 0}>
              Blind
            </Btn>
          </div>
        </div>
      )}

      {hasBid && (
        <div className="mt-3 pt-3 border-t border-white/10 text-center">
          <div className="text-[7px] tracking-widest text-[#FFD700]/60 uppercase" style={PS2}>
            Your Bid: <span className="text-[#FFD700]">{player.bid}</span>
            {player.blind && <span className="ml-2 text-[#FF5F1F]">(BLIND)</span>}
          </div>
        </div>
      )}

      {isMyTurn && (
        <div className="mt-3 pt-3 border-t border-white/10 text-center">
          <div className="text-[7px] tracking-widest text-[#FFD700] uppercase animate-pulse" style={PS2}>
            ▶ YOUR TURN TO PLAY
          </div>
        </div>
      )}
    </div>
  );
}