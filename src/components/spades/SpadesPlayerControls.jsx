import React, { useState, useRef } from 'react';
import { generateFullDeck, shuffleDeck as shuffleDeckSecure, dealFromShuffledDeck, getSeatedPlayers } from '@/lib/spadesRules';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

// Preload all card images so they're in browser cache before the deal animation
function preloadCardImages(cards) {
  const urls = new Set([getCardBack()]);
  for (const card of cards) urls.add(getCardImage(card));
  return Promise.all(
    [...urls].map(url => new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = url;
    }))
  );
}

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const DEAL_INTERVAL_MS = 130; // must match SpadesDealAnimation's DEAL_INTERVAL_MS

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

export default function SpadesPlayerControls({ seatNumber, player, gs, updateState, isMySeat, onShuffleStart, onStandUp, isDealing: isExternalDealing }) {
  const [bidInput, setBidInput] = useState('');
  const [blindAmount, setBlindAmount] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const dealingActive = isDealing || isExternalDealing;
  
  if (!isMySeat || !player) return null;
  
  const isBidding = gs.phase === 'bidding';
  const isSetup = !gs.phase || gs.phase === 'setup';
  const hasCards = player.hand?.length > 0;
  const isMyTurn = gs.current_turn_seat === seatNumber && gs.phase === 'playing';
  const hasBid = player.bid != null;
  const isMyBidTurn = isBidding && gs.current_bidder_seat === seatNumber && !hasBid;
  const seatedPlayers = (gs.players || []).filter(p => p.role === 'player' || p.role === 'hostPlayer');
  const hasDeck = gs.deck?.length > 0;
  const canStandUp = gs.phase === 'setup' || !hasCards;
  const dealerSeat = gs.dealer_seat || seatNumber; // fallback: you are the dealer if no dealer set
  const isDealer = seatNumber === dealerSeat;

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
    await updateState({ deck, deck_shuffled: true, shuffle_ts: Date.now(), dealer_seat: seatNumber });
    setIsShuffling(false);
  };

  // STAND UP: Leave seat and become spectator
  const handleStandUp = () => {
    if (!canStandUp) return;
    onStandUp?.();
  };

  // DEAL: Distribute the already-shuffled deck round-robin starting left of dealer
  const handleDeal = async () => {
    if (isDealing) return;
    const currentPlayers = gs.players || [];
    const allSeated = getSeatedPlayers(currentPlayers);
    if (allSeated.length < 2) {
      alert('Need at least 2 players to deal');
      return;
    }
    if (!gs.deck_shuffled || !gs.deck?.length) {
      alert('Shuffle the deck before dealing');
      return;
    }

    const dealerSeat = gs.dealer_seat || allSeated[0]?.seatNumber || 1;
    const { dealSequence, handsBySeatNumber, dealStartSeat } = dealFromShuffledDeck(gs.deck, allSeated, dealerSeat);

    setIsDealing(true);

    // Preload all card images before the deal animation starts
    await preloadCardImages(dealSequence);

    const clearedPlayers = currentPlayers.map(p =>
      p.seatNumber != null ? { ...p, hand: [], bid: null, tricksWon: 0 } : p
    );
    const hasCpu = allSeated.some(p => p.playerType === 'cpu');
    const sortedSeated = [...allSeated].sort((a, b) => a.seatNumber - b.seatNumber);
    const dealerIdx = sortedSeated.findIndex(p => p.seatNumber === dealerSeat);
    const firstBidder = sortedSeated[(dealerIdx + 1) % sortedSeated.length]?.seatNumber;

    await updateState({
      players: clearedPlayers,
      deck: dealSequence,
      deck_shuffled: true,
      deal_start_seat: dealStartSeat,
      deal_ts: Date.now(),
      phase: 'setup',
      status: 'active',
      current_trick: [],
      dealer_seat: dealerSeat,
      tricks_played: 0,
      bid1: null, bid2: null,
      books1: 0, books2: 0,
    });

    // Wait for the local deal animation to finish (52 cards × 130ms ≈ 7s), then push final state
    const ANIM_DURATION = dealSequence.length * DEAL_INTERVAL_MS + 600;
    await new Promise(resolve => setTimeout(resolve, ANIM_DURATION));

    const handNumber = gs.hand_number || 0;
    const isFirstHand = handNumber === 0;
    const finalPlayers = currentPlayers.map(p => {
      const hand = handsBySeatNumber.get(p.seatNumber);
      if (hand) return { ...p, hand: [...hand], bid: isFirstHand ? 0 : null, tricksWon: 0 };
      return p;
    });

    if (isFirstHand) {
      await updateState({
        players: finalPlayers,
        phase: 'playing',
        deck: [], deck_shuffled: false,
        current_turn_seat: firstBidder,
        current_bidder_seat: null,
        bid1: 0, bid2: 0,
        first_hand_no_bid: true,
        deal_start_seat: dealStartSeat,
        round_scored: false,
      });
    } else {
      await updateState({
        players: finalPlayers,
        phase: 'bidding',
        deck: [], deck_shuffled: false,
        current_bidder_seat: firstBidder,
        current_turn_seat: null,
        bid1: null, bid2: null,
        first_hand_no_bid: false,
        deal_start_seat: dealStartSeat,
        round_scored: false,
      });
    }

    setIsDealing(false);
  };

  const handleSetBid = async () => {
    const bid = Number(bidInput);
    if (isNaN(bid) || bid < 0 || bid > 13) return;
    
    const updated = (gs.players || []).map(p => p.playerId === player.playerId ? { ...p, bid } : p);
    const seated = updated.filter(p => p.role === 'player' || p.role === 'hostPlayer').sort((a, b) => a.seatNumber - b.seatNumber);
    const bidderIdx = seated.findIndex(p => p.playerId === player.playerId);
    const nextBidder = seated[(bidderIdx + 1) % seated.length];
    const allBid = seated.every(p => p.bid != null);

    if (allBid) {
      const t1 = updated.filter(p => p.seatNumber === 1 || p.seatNumber === 3).reduce((s, p) => s + (p.bid || 0), 0);
      const t2 = updated.filter(p => p.seatNumber === 2 || p.seatNumber === 4).reduce((s, p) => s + (p.bid || 0), 0);
      const dealerIdx = seated.findIndex(p => p.seatNumber === gs.dealer_seat);
      const firstSeat = seated[(dealerIdx + 1) % seated.length]?.seatNumber;
      await updateState({
        players: updated, phase: 'playing', bid1: t1, bid2: t2,
        current_turn_seat: firstSeat || seated[0]?.seatNumber, current_bidder_seat: null,
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
    const allBid = seated.every(p => p.bid != null);

    if (allBid) {
      const t1 = updated.filter(p => p.seatNumber === 1 || p.seatNumber === 3).reduce((s, p) => s + (p.bid || 0), 0);
      const t2 = updated.filter(p => p.seatNumber === 2 || p.seatNumber === 4).reduce((s, p) => s + (p.bid || 0), 0);
      const dealerIdx = seated.findIndex(p => p.seatNumber === gs.dealer_seat);
      const firstSeat = seated[(dealerIdx + 1) % seated.length]?.seatNumber;
      await updateState({
        players: updated, phase: 'playing', bid1: t1, bid2: t2,
        current_turn_seat: firstSeat || seated[0]?.seatNumber, current_bidder_seat: null,
      });
    } else {
      await updateState({ players: updated, current_bidder_seat: nextBidder?.seatNumber });
    }
    setBlindAmount(0);
  };

  const handleReset = async () => {
    const confirmed = window.confirm('Reset the game? This will clear all hands, bids, and scores.');
    if (!confirmed) return;
    await updateState({
      phase: 'setup',
      deck: [],
      deck_shuffled: false,
      current_trick: [],
      current_turn_seat: null,
      current_bidder_seat: null,
      dealer_seat: null,
      tricks_played: 0,
      bid1: null, bid2: null,
      books1: 0, books2: 0,
      score1: 0, score2: 0,
      hand_number: 0,
      round_scored: false,
      spades_broken: false,
      first_hand_no_bid: false,
      shuffle_count: 0,
      shuffle_ts: null,
      deal_ts: null,
      reset_ts: Date.now(),
      players: (gs.players || []).map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })),
    });
  };

  return (
    <div className="flex flex-col gap-2">

      {/* ── Bid UI: shown prominently when it's the human's turn to bid ── */}
      {isBidding && isMyBidTurn && !dealingActive && (
        <div className="p-4 border-2 rounded-xl bg-black/80 text-center"
          style={{ borderColor: '#FF5F1F', boxShadow: '0 0 20px rgba(255,95,31,0.4)' }}>
          <div className="text-[8px] tracking-widest text-[#FF5F1F] uppercase mb-3 animate-pulse" style={PS2}>
            📋 YOUR TURN TO BID
          </div>
          {/* Quick bid buttons 1–7 */}
          <div className="flex flex-wrap gap-1.5 justify-center mb-3">
            {[1,2,3,4,5,6,7].map(n => (
              <button key={n} onClick={() => setBidInput(String(n))}
                className={`w-9 h-9 rounded-lg border-2 font-heading text-base transition-all active:scale-95 ${
                  bidInput === String(n)
                    ? 'border-[#FF5F1F] bg-[#FF5F1F]/30 text-white'
                    : 'border-white/20 bg-white/5 text-white/70 hover:border-[#FF5F1F]/60'
                }`}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-center items-center mb-2">
            <input type="number" min="0" max="13"
              className="w-16 px-2 py-2 rounded-lg bg-black/80 border-2 border-[#FF5F1F]/50 text-white text-sm text-center focus:outline-none focus:border-[#FF5F1F]"
              value={bidInput} onChange={e => setBidInput(e.target.value)} placeholder="0–13"
              onKeyDown={e => e.key === 'Enter' && bidInput && handleSetBid()} />
            <Btn onClick={handleSetBid} color="#FF5F1F" size="sm" disabled={!bidInput}>
              ✓ Confirm Bid
            </Btn>
          </div>
          <div className="flex gap-2 justify-center items-center">
            <select
              className="px-2 py-1.5 rounded-lg bg-black/80 border border-[#FFD700]/40 text-white text-sm focus:outline-none"
              value={blindAmount} onChange={e => setBlindAmount(Number(e.target.value))}>
              <option value="0">Blind Bid…</option>
              <option value="6">Blind 6</option>
              <option value="7">Blind 7</option>
              <option value="8">Blind 8</option>
              <option value="9">Blind 9</option>
              <option value="10">Blind 10</option>
            </select>
            <Btn onClick={handleBlind} color="#FFD700" size="sm" disabled={blindAmount === 0}>
              Go Blind
            </Btn>
          </div>
        </div>
      )}

      {/* ── Waiting for bid ── */}
      {isBidding && !isMyBidTurn && !hasBid && (
        <div className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-center">
          <div className="text-[6px] tracking-widest text-white/40 uppercase" style={PS2}>
            ⏳ Waiting for Seat {gs.current_bidder_seat || '?'} to bid…
          </div>
        </div>
      )}

      {/* ── Bid confirmed ── */}
      {isBidding && hasBid && (
        <div className="px-3 py-2 rounded-xl border border-[#4ade80]/30 bg-[#4ade80]/5 text-center">
          <div className="text-[6px] tracking-widest text-[#4ade80] uppercase" style={PS2}>
            ✓ Bid Placed: <span className="text-white">{player.bid}</span>
            {player.blind && <span className="ml-2 text-[#FF5F1F]">(BLIND)</span>}
          </div>
        </div>
      )}

      {/* ── Main controls panel ── */}
      <div className="p-3 border-2 rounded-xl bg-black/60"
        style={{ borderColor: '#4ade80', boxShadow: '0 0 15px rgba(74,222,128,0.2)' }}>
        <div className="text-[7px] tracking-widest text-[#4ade80]/60 uppercase mb-2 text-center" style={PS2}>
          Seat {seatNumber} Controls
        </div>

        {isSetup && isDealer && (
          <div className="text-[7px] tracking-widest text-[#FFD700]/80 uppercase mb-2 text-center" style={PS2}>
            🎴 You are the dealer
          </div>
        )}
        {isSetup && !isDealer && dealerSeat && (
          <div className="text-[7px] tracking-widest text-white/40 uppercase mb-2 text-center" style={PS2}>
            Waiting for Seat {dealerSeat} to deal
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-center">
          {isDealer && (
            <>
              <Btn onClick={handleShuffle} color="#FFD700" size="sm" disabled={!isSetup || isShuffling || dealingActive}>
                {isShuffling ? '🔀 Shuffling...' : '🔀 Shuffle'}
              </Btn>
              <Btn onClick={handleDeal} color="#4ade80" size="sm" disabled={!isSetup || isShuffling || dealingActive || seatedPlayers.length < 2 || !gs.deck_shuffled || !hasDeck}>
                {dealingActive ? '🃏 Dealing...' : '🃏 Deal'}
              </Btn>
            </>
          )}
          <Btn onClick={handleReset} color="#ef4444" size="sm">
            ↺ Reset
          </Btn>
          <Btn onClick={handleStandUp} color="#9ca3af" size="sm" disabled={!canStandUp}>
            🚶 Stand Up
          </Btn>
        </div>

        {isMyTurn && (
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <div className="text-[7px] tracking-widest text-[#FFD700] uppercase animate-pulse" style={PS2}>
              ▶ YOUR TURN TO PLAY
            </div>
          </div>
        )}
      </div>
    </div>
  );
}