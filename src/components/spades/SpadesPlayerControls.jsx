import React, { useState } from 'react';

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

export default function SpadesPlayerControls({ seatNumber, player, gs, updateState, isMySeat }) {
  const [bidInput, setBidInput] = useState('');
  const [blindAmount, setBlindAmount] = useState(0);
  
  if (!isMySeat || !player) return null;
  
  const isBidding = gs.phase === 'bidding';
  const isSetup = !gs.phase || gs.phase === 'setup';
  const hasCards = player.hand?.length > 0;
  const isMyTurn = gs.current_turn_seat === seatNumber && gs.phase === 'playing';
  const hasBid = player.bid != null;

  const handleShuffle = async () => {
    const deck = generateFullDeck();
    await updateState({ deck: shuffleDeck(deck), deck_shuffled: true });
  };

  const handleDeal = async () => {
    const seated = (gs.players || []).filter(p => p.role === 'player' || p.role === 'hostPlayer');
    if (seated.length < 2) return;
    const workingDeck = (gs.deck_shuffled && gs.deck?.length === 52) ? gs.deck : shuffleDeck(generateFullDeck());
    const cardsPerPlayer = Math.floor(workingDeck.length / seated.length);
    const updatedPlayers = (gs.players || []).map(p => {
      if (p.role !== 'player' && p.role !== 'hostPlayer') return p;
      const idx = seated.findIndex(s => s.playerId === p.playerId);
      return { ...p, hand: workingDeck.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer), bid: null, tricksWon: 0 };
    });
    const dealerSeat = seated[0]?.seatNumber || 1;
    const firstBidder = seated[1]?.seatNumber || seated[0]?.seatNumber;
    await updateState({
      players: updatedPlayers, phase: 'bidding', status: 'active',
      deck: [], current_trick: [], current_bidder_seat: firstBidder, dealer_seat: dealerSeat,
      tricks_played: 0, bid1: null, bid2: null, books1: 0, books2: 0,
    });
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
      phase: 'setup', current_trick: [], books1: 0, books2: 0, tricks_played: 0, bid1: null, bid2: null,
      players: (gs.players || []).map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })),
    });
  };

  return (
    <div className="mt-3 p-3 border-2 rounded-xl bg-black/60"
      style={{ borderColor: '#4ade80', boxShadow: '0 0 15px rgba(74,222,128,0.2)' }}>
      <div className="text-[7px] tracking-widest text-[#4ade80]/60 uppercase mb-2 text-center" style={PS2}>
        Seat {seatNumber} Controls
      </div>
      
      <div className="flex flex-wrap gap-2 justify-center">
        <Btn onClick={handleShuffle} color="#FFD700" size="sm" disabled={!isSetup}>
          🔀 Shuffle
        </Btn>
        <Btn onClick={handleDeal} color="#4ade80" size="sm" disabled={!isSetup || !hasCards}>
          🃏 Deal
        </Btn>
        <Btn onClick={handleReset} color="#ef4444" size="sm" disabled={!hasCards && !hasBid}>
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