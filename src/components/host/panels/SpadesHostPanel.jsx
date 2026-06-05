import React, { useState, useEffect } from 'react';

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

const sty = { fontFamily: "'Press Start 2P', monospace" };

export default function SpadesHostPanel({ gs, updateState, sendCommand }) {
  const [team1Name, setTeam1Name] = useState(gs.team1Name || 'Team 1');
  const [team2Name, setTeam2Name] = useState(gs.team2Name || 'Team 2');
  const [targetScore, setTargetScore] = useState(gs.targetScore || 500);

  const players = gs.players || [];
  const isSetup = !gs.phase || gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing';
  const isBidding = gs.phase === 'bidding';
  const isPlayingTrick = gs.phase === 'playing_trick';

  const participantPlayers = players.filter(p => p.role === 'participant' || p.role === 'hostPlayer');

  // Start the game
  const startGame = async () => {
    const shuffledPlayers = [...participantPlayers].sort(() => Math.random() - 0.5);
    const team1Players = shuffledPlayers.slice(0, 2);
    const team2Players = shuffledPlayers.slice(2, 4);

    const updatedPlayers = players.map(p => {
      const isTeam1 = team1Players.find(tp => tp.playerId === p.playerId);
      return {
        ...p,
        team: isTeam1 ? 1 : 2,
        hand: generateHand(),
        bid: null,
        tricksWon: 0,
      };
    });

    await updateState({
      phase: 'bidding',
      status: 'active',
      team1Name,
      team2Name,
      targetScore,
      score1: 0,
      score2: 0,
      players: updatedPlayers,
      current_bidder_idx: 0,
      highest_bid: 0,
      highest_bidder: null,
      trump_suit: null,
      current_trick: [],
      tricks_played: 0,
      dealer_idx: 0,
    });
  };

  // Generate a random hand of 13 cards
  const generateHand = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const hand = [];
    for (let i = 0; i < 13; i++) {
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const value = values[Math.floor(Math.random() * values.length)];
      hand.push({ suit, value, id: `${suit}${value}` });
    }
    return hand;
  };

  // Start bidding round
  const startBidding = async () => {
    await updateState({
      phase: 'bidding',
      current_bidder_idx: 0,
      highest_bid: 0,
      highest_bidder: null,
    });
  };

  // Set player bid
  const setPlayerBid = async (playerId, bid) => {
    const updatedPlayers = players.map(p =>
      p.playerId === playerId ? { ...p, bid } : p
    );
    await updateState({ players: updatedPlayers });
  };

  // Play a card
  const playCard = async (playerId, card) => {
    const trick = gs.current_trick || [];
    const updatedPlayers = players.map(p =>
      p.playerId === playerId
        ? { ...p, hand: p.hand.filter(c => c.id !== card.id) }
        : p
    );
    await updateState({
      players: updatedPlayers,
      current_trick: [...trick, { playerId, card }],
    });
  };

  // Evaluate trick winner
  const evaluateTrick = async () => {
    const trick = gs.current_trick || [];
    if (trick.length < 4) return;

    // Simple evaluation - highest spade wins (for demo)
    const spades = trick.filter(t => t.card.suit === '♠');
    const winner = spades.length > 0
      ? spades.reduce((a, b) => cardValue(a.card) > cardValue(b.card) ? a : b)
      : trick[0];

    const winnerTeam = players.find(p => p.playerId === winner.playerId)?.team;
    const scoreKey = winnerTeam === 1 ? 'score1' : 'score2';

    await updateState({
      [scoreKey]: (gs[scoreKey] || 0) + 1,
      current_trick: [],
      tricks_played: (gs.tricks_played || 0) + 1,
    });
  };

  const cardValue = (card) => {
    const order = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return order[card.value] || 0;
  };

  // Reset game
  const newGame = async () => {
    await updateState({
      phase: 'setup',
      score1: 0,
      score2: 0,
      current_trick: [],
      tricks_played: 0,
      dealer_idx: 0,
    });
  };

  // Setup screen
  if (isSetup) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="p-6 border border-[#BC13FE]/30 rounded-xl bg-black/60" style={{ boxShadow: '0 0 20px rgba(188,19,254,0.1)' }}>
          <h2 className="font-heading text-xl tracking-[0.15em] text-[#FFD700] uppercase mb-6 text-center">⚙ Spades Setup</h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Team 1 Name</label>
              <input className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none"
                value={team1Name} onChange={(e) => setTeam1Name(e.target.value)} placeholder="Team 1" />
            </div>
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Team 2 Name</label>
              <input className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none"
                value={team2Name} onChange={(e) => setTeam2Name(e.target.value)} placeholder="Team 2" />
            </div>
            <div>
              <label className="block font-heading text-xs tracking-widest text-white/50 uppercase mb-2">Target Score</label>
              <input type="number" className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-[#BC13FE]/40 text-white font-body text-lg focus:border-[#BC13FE] focus:outline-none"
                value={targetScore} onChange={(e) => setTargetScore(Number(e.target.value))} />
            </div>
          </div>

          {players.length > 0 && (
            <div className="mb-5 p-3 border border-white/10 rounded-lg bg-black/40 space-y-2">
              <div className="text-[9px] tracking-widest text-white/40 uppercase mb-2" style={sty}>{players.length} Players in lobby</div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <div key={p.playerId} className="px-2 py-1 rounded border text-[8px]" style={{ ...sty, borderColor: '#BC13FE40', color: '#BC13FEaa' }}>
                    SEAT {p.seatNumber}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-center mb-4">
            <div className="text-[8px] tracking-widest text-white/40 uppercase mb-1" style={sty}>Players Needed</div>
            <div className="font-heading text-sm text-white/60">
              {participantPlayers.length}/4 players — {participantPlayers.length >= 4 ? '✅ Ready' : 'Need more players'}
            </div>
          </div>

          <Btn onClick={startGame} color="#4ade80" size="lg" className="w-full"
            disabled={participantPlayers.length < 4}>
            ▶ DEAL CARDS
          </Btn>
        </div>
      </div>
    );
  }

  // Playing screen
  if (isPlaying || isBidding || isPlayingTrick) {
    const team1Players = players.filter(p => p.team === 1);
    const team2Players = players.filter(p => p.team === 2);

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Status Bar */}
        <div className="p-4 border rounded-xl bg-black/60 flex items-center justify-between"
          style={{ borderColor: '#BC13FE30' }}>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[8px] tracking-widest text-white/40 uppercase" style={sty}>Trick</div>
              <div className="font-heading text-2xl text-[#FFD700]">{(gs.tricks_played || 0) + 1}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="px-3 py-1 rounded border text-[9px] tracking-widest uppercase" style={{
              ...sty, borderColor: '#BC13FE40', color: '#BC13FEaa'
            }}>
              {isBidding ? '📋 BIDDING' : '🃏 PLAYING'}
            </div>
          </div>
          <Btn onClick={newGame} color="#ffffff" size="sm">↺ New Game</Btn>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border-2 rounded-xl text-center" style={{ borderColor: '#BC13FE30', background: '#BC13FE08' }}>
            <div className="font-heading text-sm tracking-widest text-white uppercase">{team1Name}</div>
            <div className="font-heading text-3xl text-[#BC13FE] mt-1">{gs.score1 || 0}</div>
            <div className="text-[7px] text-white/30 mt-1" style={sty}>Target: {targetScore}</div>
            <div className="flex gap-2 mt-2 justify-center">
              <button onClick={() => updateState({ score1: Math.max(0, (gs.score1 || 0) - 10) })} className="px-2 py-1 rounded border border-red-500/40 text-red-400 font-heading text-xs hover:bg-red-500/20">-10</button>
              <button onClick={() => updateState({ score1: (gs.score1 || 0) + 10 })} className="px-2 py-1 rounded border border-green-500/40 text-green-400 font-heading text-xs hover:bg-green-500/20">+10</button>
            </div>
          </div>
          <div className="p-4 border-2 rounded-xl text-center" style={{ borderColor: '#FF5F1F30', background: '#FF5F1F08' }}>
            <div className="font-heading text-sm tracking-widest text-white uppercase">{team2Name}</div>
            <div className="font-heading text-3xl text-[#FF5F1F] mt-1">{gs.score2 || 0}</div>
            <div className="text-[7px] text-white/30 mt-1" style={sty}>Target: {targetScore}</div>
            <div className="flex gap-2 mt-2 justify-center">
              <button onClick={() => updateState({ score2: Math.max(0, (gs.score2 || 0) - 10) })} className="px-2 py-1 rounded border border-red-500/40 text-red-400 font-heading text-xs hover:bg-red-500/20">-10</button>
              <button onClick={() => updateState({ score2: (gs.score2 || 0) + 10 })} className="px-2 py-1 rounded border border-green-500/40 text-green-400 font-heading text-xs hover:bg-green-500/20">+10</button>
            </div>
          </div>
        </div>

        {/* Card Table */}
        <div className="relative bg-[#0a1a0a] rounded-3xl border-4 border-[#3d2817] p-8" style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)', minHeight: '400px' }}>
          {/* Center - Played Cards */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-2 border-white/10 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[8px] tracking-widest text-white/30 uppercase" style={sty}>Center</div>
              <div className="flex gap-2 justify-center mt-2 flex-wrap">
                {(gs.current_trick || []).map((play, i) => (
                  <div key={i} className="w-12 h-16 rounded bg-white border border-gray-300 flex items-center justify-center text-lg shadow-lg">
                    {play.card.suit}{play.card.value}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Player Positions */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
            <div className="px-4 py-2 rounded-lg border border-[#BC13FE]/40 bg-[#BC13FE]/10">
              <div className="text-[7px] tracking-widest text-[#BC13FE] uppercase" style={sty}>Partner</div>
              <div className="text-[8px] text-white/60" style={sty}>Seat {team1Players[0]?.seatNumber || '?'}</div>
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
            <div className="px-4 py-2 rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/10">
              <div className="text-[7px] tracking-widest text-[#4ade80] uppercase" style={sty}>Dealer</div>
              <div className="text-[8px] text-white" style={sty}>Seat {players[gs.dealer_idx]?.seatNumber || '?'}</div>
            </div>
          </div>

          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-center">
            <div className="px-4 py-2 rounded-lg border border-[#FF5F1F]/40 bg-[#FF5F1F]/10">
              <div className="text-[7px] tracking-widest text-[#FF5F1F] uppercase" style={sty}>Opponent</div>
              <div className="text-[8px] text-white/60" style={sty}>Seat ?</div>
            </div>
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-center">
            <div className="px-4 py-2 rounded-lg border border-[#FF5F1F]/40 bg-[#FF5F1F]/10">
              <div className="text-[7px] tracking-widest text-[#FF5F1F] uppercase" style={sty}>Opponent</div>
              <div className="text-[8px] text-white/60" style={sty}>Seat ?</div>
            </div>
          </div>
        </div>

        {/* Player Hands Preview */}
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
          <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Player Hands</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase mb-2" style={sty}>{team1Name}</div>
              {team1Players.map(p => (
                <div key={p.playerId} className="mb-2 px-3 py-2 rounded border border-[#BC13FE]/30 bg-[#BC13FE]/5">
                  <div className="text-[7px] text-white/60 mb-1" style={sty}>Seat {p.seatNumber} — {p.hand?.length || 0} cards</div>
                  <div className="flex flex-wrap gap-1">
                    {(p.hand || []).slice(0, 5).map((c, i) => (
                      <span key={i} className="text-xs">{c.suit}{c.value}</span>
                    ))}
                    {(p.hand || []).length > 5 && <span className="text-xs text-white/40">+{(p.hand || []).length - 5}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[8px] tracking-widest text-[#FF5F1F] uppercase mb-2" style={sty}>{team2Name}</div>
              {team2Players.map(p => (
                <div key={p.playerId} className="mb-2 px-3 py-2 rounded border border-[#FF5F1F]/30 bg-[#FF5F1F]/5">
                  <div className="text-[7px] text-white/60 mb-1" style={sty}>Seat {p.seatNumber} — {p.hand?.length || 0} cards</div>
                  <div className="flex flex-wrap gap-1">
                    {(p.hand || []).slice(0, 5).map((c, i) => (
                      <span key={i} className="text-xs">{c.suit}{c.value}</span>
                    ))}
                    {(p.hand || []).length > 5 && <span className="text-xs text-white/40">+{(p.hand || []).length - 5}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={startBidding} color="#FFD700" size="lg" disabled={isBidding}>📋 Start Bidding</Btn>
          <Btn onClick={evaluateTrick} color="#4ade80" size="lg" disabled={(gs.current_trick || []).length < 4}>✓ Evaluate Trick</Btn>
        </div>
      </div>
    );
  }

  return null;
}