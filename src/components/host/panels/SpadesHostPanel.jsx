import React, { useState, useEffect } from 'react';
import SpadesCardArea from '@/components/spades/SpadesCardArea';
import { calculateCPUBid, selectCPUCard, CPU_ACTION_DELAY, fillEmptySeatsWithCPU, createCPUPlayer } from '@/lib/spadesCPU';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function generateFullDeck() {
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

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const HOST_PLAYER_ID = 'host_player_spades';

function HostSeatSlot({ seatNumber, player, onKick, onForceTurn, currentTurnSeat, isBidding, onSetBid }) {
  const [bidInput, setBidInput] = useState('');
  const isMyTurn = currentTurnSeat === seatNumber;
  const occupied = !!player;
  const isCPU = player?.playerType === 'cpu';

  return (
    <div className={`px-3 py-2 rounded-xl border-2 text-center min-w-[90px] transition-all ${
      isMyTurn ? 'border-[#FFD700] bg-[#FFD700]/15' : occupied ? 'border-[#BC13FE]/40 bg-[#BC13FE]/05' : 'border-white/10 bg-white/5'
    }`}
      style={{ boxShadow: isMyTurn ? '0 0 15px rgba(255,215,0,0.3)' : 'none' }}>
      <div className="text-[7px] text-white/40 uppercase mb-1" style={PS2}>Seat {seatNumber}</div>
      {occupied ? (
        <>
          <div className="font-heading text-xs text-white flex items-center justify-center gap-1">
            {player.role === 'hostPlayer' ? '🎛 HOST' : isCPU ? '🤖 CPU' : `👤 SEAT ${seatNumber}`}
          </div>
          {player.bid != null && (
            <div className="text-[6px] text-[#FFD700]/60 mt-0.5" style={PS2}>Bid: {player.bid} | Books: {player.tricksWon || 0}</div>
          )}
          {isBidding && player.bid == null && (
            <div className="mt-1 flex gap-1">
              <input type="number" min="0" max="13"
                className="w-10 px-1 py-0.5 rounded bg-black/80 border border-white/20 text-white text-xs text-center focus:outline-none"
                value={bidInput} onChange={e => setBidInput(e.target.value)} placeholder="0" />
              <button onClick={() => { onSetBid(player.playerId, Number(bidInput)); setBidInput(''); }}
                className="px-1.5 py-0.5 rounded border border-[#4ade80]/60 text-[#4ade80] text-[7px] hover:bg-[#4ade80]/20 font-heading"
                style={PS2}>SET</button>
            </div>
          )}
          <div className="flex gap-1 mt-1 justify-center flex-wrap">
            <button onClick={() => onForceTurn(seatNumber)}
              className="px-1.5 py-0.5 rounded border border-[#FFD700]/40 text-[#FFD700]/70 text-[6px] hover:bg-[#FFD700]/10 font-heading uppercase"
              style={PS2}>▶</button>
            {player.role !== 'hostPlayer' && (
              <button onClick={() => onKick(player.playerId)}
                className="px-1.5 py-0.5 rounded border border-red-500/40 text-red-400 text-[6px] hover:bg-red-500/20 font-heading uppercase"
                style={PS2}>Kick</button>
            )}
          </div>
        </>
      ) : (
        <div className="font-heading text-xs text-white/20">Empty</div>
      )}
    </div>
  );
}

export default function SpadesHostPanel({ gs, updateState }) {
  const [team1Name, setTeam1Name] = useState(gs.team1Name || 'Team 1');
  const [team2Name, setTeam2Name] = useState(gs.team2Name || 'Team 2');
  const [targetScore, setTargetScore] = useState(gs.targetScore || 500);
  const [cpuProcessing, setCpuProcessing] = useState(false);

  const players = gs.players || [];
  const isSetup = !gs.phase || gs.phase === 'setup';
  const isPlaying = gs.phase === 'playing' || gs.phase === 'playing_trick';
  const isBidding = gs.phase === 'bidding';

  const seatedPlayers = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
  const hostInSeat = players.find(p => p.playerId === HOST_PLAYER_ID);
  const occupiedSeats = seatedPlayers.map(p => p.seatNumber);
  const availableSeats = [1, 2, 3, 4].filter(s => !occupiedSeats.includes(s));

  const getPlayerAtSeat = (seatNum) => players.find(p => p.seatNumber === seatNum && (p.role === 'player' || p.role === 'hostPlayer'));

  // CPU AI Execution
  useEffect(() => {
    const cpuPlayers = players.filter(p => p.playerType === 'cpu');
    if (cpuPlayers.length === 0 || cpuProcessing) return;

    const executeCPUAction = async () => {
      if (isBidding && gs.current_bidder_seat) {
        const cpuPlayer = cpuPlayers.find(p => p.seatNumber === gs.current_bidder_seat && p.bid == null);
        if (cpuPlayer && cpuPlayer.hand?.length > 0) {
          setCpuProcessing(true);
          setTimeout(async () => {
            const teamBid = cpuPlayer.team === 1 ? (gs.bid1 || 0) : (gs.bid2 || 0);
            const bid = calculateCPUBid(cpuPlayer.hand, teamBid);
            await setPlayerBid(cpuPlayer.playerId, bid);
            setCpuProcessing(false);
          }, CPU_ACTION_DELAY);
        }
      }
      
      if (isPlaying && gs.current_turn_seat) {
        const cpuPlayer = cpuPlayers.find(p => p.seatNumber === gs.current_turn_seat);
        if (cpuPlayer && cpuPlayer.hand?.length > 0) {
          setCpuProcessing(true);
          setTimeout(async () => {
            const card = selectCPUCard(
              cpuPlayer.hand,
              gs.current_trick || [],
              cpuPlayer.team === 1 ? (gs.bid1 || 0) : (gs.bid2 || 0),
              cpuPlayer.bid || 0,
              cpuPlayer.tricksWon || 0
            );
            if (card) {
              const trick = gs.current_trick || [];
              const updatedPlayers = players.map(p =>
                p.playerId === cpuPlayer.playerId
                  ? { ...p, hand: p.hand.filter(c => c.id !== card.id), lastActionAt: Date.now() }
                  : p
              );
              await updateState({
                players: updatedPlayers,
                current_trick: [...trick, { playerId: cpuPlayer.playerId, seatNumber: cpuPlayer.seatNumber, card }],
              });
            }
            setCpuProcessing(false);
          }, CPU_ACTION_DELAY);
        }
      }
    };

    executeCPUAction();
  }, [gs.current_bidder_seat, gs.current_turn_seat, gs.phase, players, cpuProcessing]);

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
    await updateState({ deck: shuffleDeck(generateFullDeck()), deck_shuffled: true });
  };

  const handleNewDeck = async () => {
    await updateState({
      deck: generateFullDeck(), deck_shuffled: false, current_trick: [],
      players: players.map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })),
    });
  };

  const handleDeal = async () => {
    const seated = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
    if (seated.length < 2) return;
    const workingDeck = (gs.deck_shuffled && gs.deck?.length === 52) ? gs.deck : shuffleDeck(generateFullDeck());
    const cardsPerPlayer = Math.floor(workingDeck.length / seated.length);
    const updatedPlayers = players.map(p => {
      if (p.role !== 'player' && p.role !== 'hostPlayer') return p;
      const idx = seated.findIndex(s => s.playerId === p.playerId);
      return { ...p, hand: workingDeck.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer), bid: null, tricksWon: 0 };
    });
    const dealerSeat = seated[0]?.seatNumber || 1;
    const firstSeat = seated[1]?.seatNumber || seated[0]?.seatNumber;
    await updateState({
      players: updatedPlayers, phase: 'bidding', status: 'active', team1Name, team2Name, targetScore,
      deck: [], current_trick: [], current_bidder_seat: firstSeat, dealer_seat: dealerSeat,
      tricks_played: 0, bid1: null, bid2: null, books1: 0, books2: 0,
    });
  };

  const setPlayerBid = async (playerId, bid) => {
    const updated = players.map(p => p.playerId === playerId ? { ...p, bid } : p);
    const seated = players.filter(p => p.role === 'player' || p.role === 'hostPlayer').sort((a, b) => a.seatNumber - b.seatNumber);
    const bidderIdx = seated.findIndex(p => p.playerId === playerId);
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
  };

  const evaluateTrick = async () => {
    const trick = gs.current_trick || [];
    if (trick.length < seatedPlayers.length) return;
    const spades = trick.filter(t => t.card?.suit === '♠');
    const relevant = spades.length > 0 ? spades : trick;
    const cardOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14, BJ: 15, LJ: 14.5 };
    const winner = relevant.reduce((a, b) => (cardOrder[a.card?.value] || 0) > (cardOrder[b.card?.value] || 0) ? a : b);
    const winnerPlayer = players.find(p => p.seatNumber === winner.seatNumber);
    const winnerTeam = winnerPlayer?.team;
    const booksKey = winnerTeam === 1 ? 'books1' : 'books2';
    const updatedPlayers = players.map(p =>
      p.seatNumber === winner.seatNumber ? { ...p, tricksWon: (p.tricksWon || 0) + 1 } : p
    );
    await updateState({
      players: updatedPlayers, [booksKey]: (gs[booksKey] || 0) + 1, current_trick: [],
      tricks_played: (gs.tricks_played || 0) + 1, current_turn_seat: winner.seatNumber,
    });
  };

  const scoreRound = async () => {
    const seated = players.filter(p => p.role === 'player' || p.role === 'hostPlayer');
    const team1Books = gs.books1 || 0;
    const team2Books = gs.books2 || 0;
    const bid1 = gs.bid1 || 0;
    const bid2 = gs.bid2 || 0;
    const s1 = team1Books >= bid1 ? bid1 * 10 + (team1Books - bid1) : -bid1 * 10;
    const s2 = team2Books >= bid2 ? bid2 * 10 + (team2Books - bid2) : -bid2 * 10;
    await updateState({
      score1: (gs.score1 || 0) + s1, score2: (gs.score2 || 0) + s2, phase: 'setup',
      current_trick: [], players: seated.map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })),
    });
  };

  const resetScore = async () => { await updateState({ score1: 0, score2: 0 }); };
  const resetRound = async () => {
    await updateState({
      phase: 'setup', current_trick: [], books1: 0, books2: 0, tricks_played: 0, bid1: null, bid2: null,
      players: players.map(p => ({ ...p, hand: [], bid: null, tricksWon: 0 })),
    });
  };
  const newGame = async () => {
    await updateState({
      phase: 'setup', score1: 0, score2: 0, current_trick: [], tricks_played: 0,
      bid1: null, bid2: null, books1: 0, books2: 0,
      players: players.map(p => (p.role === 'player' || p.role === 'hostPlayer') ? { ...p, hand: [], bid: null, tricksWon: 0 } : p),
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
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
                <Btn key={s} onClick={() => hostSitIn(s)} color="#BC13FE" size="sm" disabled={!availableSeats.includes(s)}>
                  Seat {s}
                </Btn>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-[8px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>
              You are in Seat {hostInSeat.seatNumber}
            </div>
            <Btn onClick={hostSitOut} color="#ef4444" size="sm">Sit Out</Btn>
          </div>
        )}
      </div>

      <div className="relative bg-[#0a1a0a] rounded-3xl border-4 border-[#3d2817]"
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)', minHeight: 380 }}>
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <HostSeatSlot seatNumber={3} player={getPlayerAtSeat(3)} onKick={kickPlayer} onForceTurn={forceTurn} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} onSetBid={setPlayerBid} />
        </div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <HostSeatSlot seatNumber={2} player={getPlayerAtSeat(2)} onKick={kickPlayer} onForceTurn={forceTurn} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} onSetBid={setPlayerBid} />
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <HostSeatSlot seatNumber={4} player={getPlayerAtSeat(4)} onKick={kickPlayer} onForceTurn={forceTurn} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} onSetBid={setPlayerBid} />
        </div>
        <SpadesCardArea trick={gs.current_trick || []} players={players} />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <HostSeatSlot seatNumber={1} player={getPlayerAtSeat(1)} onKick={kickPlayer} onForceTurn={forceTurn} currentTurnSeat={gs.current_turn_seat} isBidding={isBidding} onSetBid={setPlayerBid} />
        </div>
      </div>

      {hostInSeat?.hand?.length > 0 && (
        <div className="p-4 border border-[#BC13FE]/30 rounded-xl bg-black/60 space-y-3">
          <div className="text-[8px] tracking-widest text-[#BC13FE]/60 uppercase" style={PS2}>
            Your Hand (Seat {hostInSeat.seatNumber}) — {hostInSeat.hand.length} cards
          </div>
          <div className="flex flex-wrap gap-2">
            {hostInSeat.hand.map((card, i) => {
              const isRed = card.suit === '♥' || card.suit === '♦';
              const isMyTurn = gs.current_turn_seat === hostInSeat.seatNumber && isPlaying;
              return (
                <button key={card.id || i} disabled={!isMyTurn}
                  onClick={async () => {
                    const trick = gs.current_trick || [];
                    const updatedPlayers = players.map(p =>
                      p.playerId === HOST_PLAYER_ID ? { ...p, hand: p.hand.filter(c => c.id !== card.id) } : p
                    );
                    await updateState({
                      players: updatedPlayers,
                      current_trick: [...trick, { playerId: HOST_PLAYER_ID, seatNumber: hostInSeat.seatNumber, card }],
                    });
                  }}
                  className={`w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center font-heading text-sm transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-default shadow-md ${isRed ? 'text-red-600' : 'text-gray-900'}`}
                  style={{ background: 'linear-gradient(180deg,#fff 0%,#f0f0f0 100%)', borderColor: isMyTurn ? '#4ade80' : '#d1d5db' }}
                >
                  <span className="text-base leading-none">{card.suit}</span>
                  <span className="text-[10px] leading-none mt-0.5">{card.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      <div className="p-4 border border-[#FF5F1F]/30 rounded-xl bg-black/60 space-y-3">
        <h3 className="font-heading text-xs tracking-[0.2em] text-[#FF5F1F]/80 uppercase">🤖 CPU Players</h3>
        <div className="text-[7px] tracking-widest text-white/30 uppercase mb-2" style={PS2}>
          {cpuProcessing ? '⚙ CPU thinking...' : 'CPU opponents will auto-play'}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            onClick={async () => {
              const filled = fillEmptySeatsWithCPU(players, gs);
              await updateState({ players: filled, cpu_enabled: true });
            }}
            color="#4ade80"
            size="sm"
            disabled={cpuProcessing || availableSeats.length === 0}
          >
            🤖 Fill Empty Seats w/ CPU
          </Btn>
          {availableSeats.map(s => (
            <Btn
              key={s}
              onClick={async () => {
                const team = [1, 3].includes(s) ? 1 : 2;
                const cpu = createCPUPlayer(s, team);
                await updateState({ players: [...players, cpu], cpu_enabled: true });
              }}
              color="#4ade80"
              size="sm"
              disabled={cpuProcessing}
            >
              + CPU Seat {s}
            </Btn>
          ))}
          <Btn 
            onClick={async () => {
              const newPlayers = players.filter(p => p.playerType !== 'cpu');
              await updateState({ players: newPlayers, cpu_enabled: newPlayers.some(p => p.playerType === 'cpu') });
            }} 
            color="#FF5F1F" 
            size="sm"
            disabled={cpuProcessing || !players.some(p => p.playerType === 'cpu')}
          >
            Remove All CPUs
          </Btn>
        </div>
      </div>

      <div className="p-4 border border-white/10 rounded-xl bg-black/60 space-y-3">
        <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Controls</h3>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={handleShuffle} color="#FFD700" size="sm">🔀 Shuffle</Btn>
          <Btn onClick={handleDeal} color="#4ade80" size="sm" disabled={seatedPlayers.length < 2}>🃏 Deal</Btn>
          <Btn onClick={handleNewDeck} color="#22d3ee" size="sm">🂠 New Deck</Btn>
          <Btn onClick={evaluateTrick} color="#BC13FE" size="sm" disabled={(gs.current_trick || []).length < seatedPlayers.length}>✓ Eval Trick</Btn>
          <Btn onClick={scoreRound} color="#FF5F1F" size="sm">📊 Score Round</Btn>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <Btn onClick={resetRound} color="#ffffff" size="sm">↺ Reset Round</Btn>
          <Btn onClick={resetScore} color="#ef4444" size="sm">Reset Score</Btn>
          <Btn onClick={newGame} color="#ffffff" size="sm">New Game</Btn>
        </div>
      </div>

      {players.filter(p => p.role === 'spectator').length > 0 && (
        <div className="p-4 border border-white/10 rounded-xl bg-black/40 space-y-2">
          <h3 className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase">Spectators ({players.filter(p => p.role === 'spectator').length})</h3>
          <div className="flex flex-wrap gap-2">
            {players.filter(p => p.role === 'spectator').map(p => (
              <div key={p.playerId} className="flex items-center gap-2 px-2 py-1 rounded border border-white/10 text-[7px] text-white/40" style={PS2}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                {p.playerId.slice(0, 8)}…
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}