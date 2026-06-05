import React, { useState, useEffect } from 'react';
import SpadesSeat from './SpadesSeat';
import SpadesCardArea from './SpadesCardArea';
import SpadesPlayerControls from './SpadesPlayerControls';
import SpadesShuffleAnimation from './SpadesShuffleAnimation';
import SpadesDealAnimation from './SpadesDealAnimation';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Calculate rotated positions so player's seat is always at bottom
function getRotatedPositions(mySeatNumber) {
  if (!mySeatNumber) return { 1: { position: 'bottom' }, 2: { position: 'left' }, 3: { position: 'top' }, 4: { position: 'right' } };
  
  // Rotate positions: if I'm seat 2, seat 2 becomes bottom, seat 3 becomes left, etc.
  const positions = {};
  for (let i = 1; i <= 4; i++) {
    const offset = (i - mySeatNumber + 4) % 4;
    const posNames = ['bottom', 'left', 'top', 'right'];
    positions[i] = { position: posNames[offset], label: i === mySeatNumber ? 'YOU' : `Seat ${i}` };
  }
  return positions;
}

// Render opponent hand (card backs only)
function OpponentHand({ player, position }) {
  if (!player?.hand?.length) return null;
  
  const isHorizontal = position === 'top' || position === 'bottom';
  const isVertical = position === 'left' || position === 'right';
  const cardCount = player.hand.length;

  if (isHorizontal) {
    return (
      <div 
        className={`absolute z-5 flex justify-center ${position === 'top' ? 'top-16' : 'bottom-16'}`}
        style={{ left: '50%', transform: 'translateX(-50%)', width: Math.min(420, 40 + cardCount * 32), height: 90 }}
      >
        <div className="flex" style={{ transform: 'scale(1.05)' }}>
          {player.hand.map((card, i, arr) => (
            <div
              key={card.id || i}
              className="relative rounded-lg overflow-hidden shadow-lg"
              style={{
                width: 48, height: 67,
                marginLeft: i > 0 ? '-40px' : '0',
                transform: `rotate(${(i - (arr.length - 1) / 2) * 2.5}deg) translateY(${Math.abs(i - (arr.length - 1) / 2) * -1}px)`,
              }}
            >
              <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isVertical) {
    return (
      <div 
        className={`absolute z-5 flex items-center ${position === 'left' ? 'left-16' : 'right-16'}`}
        style={{ top: '50%', transform: 'translateY(-50%)', width: 90, height: Math.min(380, 40 + cardCount * 28) }}
      >
        <div className="flex flex-col" style={{ transform: `scale(1.05) rotate(${position === 'left' ? '90deg' : '-90deg'})` }}>
          {player.hand.map((card, i, arr) => (
            <div
              key={card.id || i}
              className="relative rounded-lg overflow-hidden shadow-lg"
              style={{
                width: 48, height: 67,
                marginTop: i > 0 ? '-45px' : '0',
                transform: `rotate(${(i - (arr.length - 1) / 2) * 2}deg)`,
              }}
            >
              <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function SpadesTable({ gs, playerId, mySeatNumber, myRole, isPlayer, isSpectator, updateState, availableSeats, onSitInSeat, roomCode, onPlayAgainstCPU, onWaitForRealPlayers, cpuChoiceShown, onChooseSpectate, onChooseSit }) {
  const players = gs.players || [];
  const isPlaying = gs.phase === 'playing' || gs.phase === 'playing_trick';
  const isBidding = gs.phase === 'bidding';
  const isSetup = !gs.phase || gs.phase === 'setup';

  const [shufflePhase, setShufflePhase] = useState('idle');
  const [dealPhase, setDealPhase] = useState('idle');

  const showCPUChoice = isPlayer && availableSeats.length > 0 && isSetup && cpuChoiceShown;

  const getPlayerAtSeat = (seatNum) => players.find(p => p.seatNumber === seatNum && (p.role === 'player' || p.role === 'hostPlayer'));
  const myPlayer = players.find(p => p.playerId === playerId);
  const myHand = (isPlayer && myPlayer?.hand) ? myPlayer.hand : [];

  // Sort hand by suit then value
  const sortedHand = myHand.length > 0 ? [...myHand].sort((a, b) => {
    const suitOrder = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, 'Joker': 4 };
    const valueOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };
    const suitDiff = (suitOrder[a.suit] || 5) - (suitOrder[b.suit] || 5);
    if (suitDiff !== 0) return suitDiff;
    return (valueOrder[a.value] || 0) - (valueOrder[b.value] || 0);
  }) : [];

  const isMyTurn = gs.current_turn_seat === mySeatNumber && isPlaying;
  const rotatedPositions = getRotatedPositions(mySeatNumber);

  const playCard = async (card) => {
    if (!isPlayer || gs.current_turn_seat !== mySeatNumber) return;
    const trick = gs.current_trick || [];
    const updatedPlayers = players.map(p =>
      p.playerId === playerId
        ? { ...p, hand: (p.hand || []).filter(c => c.id !== card.id), lastActionAt: Date.now() }
        : p
    );
    await updateState({
      players: updatedPlayers,
      current_trick: [...trick, { playerId, seatNumber: mySeatNumber, card }],
    });
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4 max-w-6xl mx-auto w-full">

      {/* CPU Choice Modal */}
      {showCPUChoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0a1a0a] to-[#050a05] border-4 border-[#FFD700]/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3), inset 0 0 60px rgba(0,0,0,0.8)' }}>
            <div className="text-center mb-6">
              <div className="text-2xl font-heading text-[#FFD700] uppercase tracking-widest mb-2" style={PS2}>🃏 Ready to Play?</div>
              <div className="text-white/60 text-sm">{availableSeats.length} seat{availableSeats.length > 1 ? 's' : ''} available</div>
            </div>
            <div className="space-y-3">
              <button onClick={onPlayAgainstCPU} className="w-full py-4 px-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFA500] hover:to-[#FFD700] text-black font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>🤖 Play vs CPU</button>
              <button onClick={onWaitForRealPlayers} className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>👥 Wait for Players</button>
            </div>
          </div>
        </div>
      )}

      {/* Team Display */}
      <div className="w-full grid grid-cols-2 gap-3 mb-2">
        <div className="p-3 border-2 rounded-xl" style={{ borderColor: '#BC13FE40', background: 'linear-gradient(135deg, rgba(188,19,254,0.08), rgba(147,51,234,0.08))' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-[#BC13FE]" style={{ boxShadow: '0 0 8px rgba(188,19,254,0.6)' }} />
            <div className="font-heading text-sm tracking-widest text-white uppercase">TEAM PURPLE</div>
          </div>
          <div className="text-[7px] text-white/40 uppercase" style={PS2}>Seat 1 + Seat 3 (Partners)</div>
        </div>
        <div className="p-3 border-2 rounded-xl" style={{ borderColor: '#FF5F1F40', background: 'linear-gradient(135deg, rgba(255,95,31,0.08), rgba(255,165,0,0.08))' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-[#FF5F1F]" style={{ boxShadow: '0 0 8px rgba(255,95,31,0.6)' }} />
            <div className="font-heading text-sm tracking-widest text-white uppercase">TEAM ORANGE</div>
          </div>
          <div className="text-[7px] text-white/40 uppercase" style={PS2}>Seat 2 + Seat 4 (Partners)</div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="w-full grid grid-cols-2 gap-3">
        <div className="p-3 border-2 rounded-xl text-center" style={{ borderColor: '#BC13FE30', background: '#BC13FE08' }}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#BC13FE]" />
            <div className="font-heading text-sm tracking-widest text-white uppercase">TEAM PURPLE</div>
          </div>
          <div className="font-heading text-3xl text-[#BC13FE]" style={{ textShadow: '0 0 15px rgba(188,19,254,0.5)' }}>{(gs.bid1 || 0) + (gs.books1 || 0)}</div>
          <div className="flex justify-center gap-3 text-[7px] text-white/30 uppercase" style={PS2}>Bid: {gs.bid1 ?? '-'} | Books: {gs.books1 ?? '-'}</div>
        </div>
        <div className="p-3 border-2 rounded-xl text-center" style={{ borderColor: '#FF5F1F30', background: '#FF5F1F08' }}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#FF5F1F]" />
            <div className="font-heading text-sm tracking-widest text-white uppercase">TEAM ORANGE</div>
          </div>
          <div className="font-heading text-3xl text-[#FF5F1F]" style={{ textShadow: '0 0 15px rgba(255,95,31,0.5)' }}>{(gs.bid2 || 0) + (gs.books2 || 0)}</div>
          <div className="flex justify-center gap-3 text-[7px] text-white/30 uppercase" style={PS2}>Bid: {gs.bid2 ?? '-'} | Books: {gs.books2 ?? '-'}</div>
        </div>
      </div>

      {/* Game Status */}
      {!isPlaying && !isBidding && (
        <div className="w-full px-4 py-3 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
          <div className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>
            {gs.phase === 'setup' || !gs.phase ? '⏳ Waiting for Host to Deal...' : gs.phase.toUpperCase()}
          </div>
          {gs.first_hand_no_bid && <div className="text-[6px] tracking-widest text-[#FFD700]/50 uppercase mt-1" style={PS2}>First Hand - No Bidding</div>}
          {gs.dealer_seat && <div className="text-[6px] tracking-widest text-[#FFD700]/40 uppercase mt-0.5" style={PS2}>Dealer: Seat {gs.dealer_seat}</div>}
        </div>
      )}

      {/* Bidding Banner */}
      {isBidding && (
        <div className="w-full px-4 py-3 rounded-xl border-2 border-[#FF5F1F]/60 bg-[#FF5F1F]/10 text-center" style={{ boxShadow: '0 0 20px rgba(255,95,31,0.2)' }}>
          <div className="font-heading text-lg tracking-widest text-[#FF5F1F] uppercase">📋 Bidding Round</div>
          <div className="text-[7px] text-white/40 uppercase mt-1" style={PS2}>Seat {gs.current_bidder_seat || '?'} is bidding</div>
        </div>
      )}

      {/* Game Table */}
      <div className="relative w-full aspect-[4/3] bg-[#0a1a0a] rounded-3xl border-4 border-[#3d2817] overflow-visible"
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 20px 60px rgba(0,0,0,0.5)', minHeight: 450 }}>

        {/* Table logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-20">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TexasNomad Games" className="w-24 h-24 object-contain" />
        </div>

        {/* Opponent hands (card backs) */}
        {Object.entries(rotatedPositions).map(([seatNum, { position }]) => {
          const player = getPlayerAtSeat(parseInt(seatNum));
          if (!player || parseInt(seatNum) === mySeatNumber) return null;
          return <OpponentHand key={seatNum} player={player} position={position} />;
        })}

        {/* Seats */}
        {Object.entries(rotatedPositions).map(([seatNum, { position, label }]) => {
          const player = getPlayerAtSeat(parseInt(seatNum));
          const positionClasses = {
            bottom: 'bottom-3 left-1/2 -translate-x-1/2',
            top: 'top-3 left-1/2 -translate-x-1/2',
            left: 'left-3 top-1/2 -translate-y-1/2',
            right: 'right-3 top-1/2 -translate-y-1/2',
          };
          return (
            <div key={seatNum} className={`absolute z-10 ${positionClasses[position]}`}>
              <SpadesSeat
                seatNumber={parseInt(seatNum)}
                player={player}
                isMe={parseInt(seatNum) === mySeatNumber}
                isAvailable={availableSeats.includes(parseInt(seatNum))}
                isSpectator={isSpectator}
                onSit={() => onSitInSeat(parseInt(seatNum))}
                currentTurnSeat={gs.current_turn_seat}
                isPlaying={isPlaying}
              />
            </div>
          );
        })}

        {/* Center area */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 z-20">
          {shufflePhase !== 'idle' && <SpadesShuffleAnimation phase={shufflePhase} onComplete={() => setShufflePhase('idle')} />}
          {dealPhase !== 'idle' && gs.deck && <SpadesDealAnimation deck={gs.deck} players={players} onComplete={() => setDealPhase('idle')} />}
          {shufflePhase === 'idle' && dealPhase === 'idle' && <SpadesCardArea trick={gs.current_trick || []} players={players} />}
        </div>
      </div>

      {/* Player Hand (face-up at bottom) */}
      {isPlayer && sortedHand.length > 0 && (
        <div className="w-full fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 to-transparent pt-16 pb-4 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-3">
              <div className="text-[8px] tracking-widest text-[#FFD700]/60 uppercase" style={PS2}>Your Hand - Seat {mySeatNumber}</div>
            </div>
            <div className="flex justify-center items-end gap-1">
              {sortedHand.map((card, i, arr) => (
                <button
                  key={card.id}
                  onClick={() => isMyTurn && playCard(card)}
                  disabled={!isMyTurn}
                  className={`relative rounded-lg overflow-hidden shadow-2xl transition-all duration-200 ${
                    isMyTurn ? 'hover:-translate-y-4 hover:scale-110 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] cursor-pointer' : 'opacity-70 cursor-not-allowed'
                  }`}
                  style={{
                    width: 72, height: 101,
                    marginLeft: i > 0 ? '-52px' : '0',
                    transform: `rotate(${(i - (arr.length - 1) / 2) * 3}deg) translateY(${Math.abs(i - (arr.length - 1) / 2) * -2}px)`,
                    zIndex: i,
                  }}
                >
                  <img src={getCardImage(card.suit, card.value)} alt={`${card.suit} ${card.value}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            {isMyTurn && (
              <div className="text-center mt-4">
                <div className="inline-block px-4 py-2 bg-[#FFD700]/20 border border-[#FFD700]/40 rounded-full text-[#FFD700] text-[8px] tracking-widest uppercase animate-pulse" style={PS2}>
                  ▶ Your Turn to Play
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player Controls */}
      {isPlayer && myPlayer && (
        <div className="w-full max-w-md mx-auto mt-4 mb-32">
          <SpadesPlayerControls
            seatNumber={mySeatNumber}
            player={myPlayer}
            gs={gs}
            updateState={updateState}
            isMySeat={true}
            onShuffleStart={() => setShufflePhase('shuffling')}
            onDealStart={() => setDealPhase('dealing')}
          />
        </div>
      )}
    </div>
  );
}