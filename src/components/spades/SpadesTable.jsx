import React, { useState, useEffect } from 'react';
import SpadesSeat from './SpadesSeat';
import SpadesCardArea from './SpadesCardArea';
import SpadesPlayerControls from './SpadesPlayerControls';
import SpadesShuffleAnimation from './SpadesShuffleAnimation';
import SpadesDealAnimation from './SpadesDealAnimation';
import { getCardImage } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Seat layout positions (top, right, bottom, left)
const SEAT_POSITIONS = {
  1: 'bottom',
  2: 'left',
  3: 'top',
  4: 'right',
};

export default function SpadesTable({ gs, playerId, mySeatNumber, myRole, isPlayer, isSpectator, updateState, availableSeats, onSitInSeat, roomCode }) {
  const players = gs.players || [];
  const isPlaying = gs.phase === 'playing' || gs.phase === 'playing_trick';
  const isBidding = gs.phase === 'bidding';
  const isSetup = !gs.phase || gs.phase === 'setup';

  const [shufflePhase, setShufflePhase] = useState('idle');
  const [dealPhase, setDealPhase] = useState('idle');
  const [animatingCard, setAnimatingCard] = useState(null);

  const getPlayerAtSeat = (seatNum) => players.find(p => p.seatNumber === seatNum && (p.role === 'player' || p.role === 'hostPlayer'));

  const playCard = async (card) => {
    if (!isPlayer || gs.current_turn_seat !== mySeatNumber) return;
    const me = players.find(p => p.playerId === playerId);
    if (!me) return;
    
    // Start card play animation
    setAnimatingCard({ card, fromSeat: mySeatNumber });
    
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 400));
    
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
    setAnimatingCard(null);
  };

  const myPlayer = players.find(p => p.playerId === playerId);
  const myHand = (isPlayer && myPlayer?.hand) ? myPlayer.hand : [];

  // Sort hand by suit (clubs, diamonds, hearts, spades) then by value
  const sortedHand = myHand.length > 0 ? [...myHand].sort((a, b) => {
    const suitOrder = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, 'Joker': 4 };
    const valueOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };
    const suitDiff = (suitOrder[a.suit] || 5) - (suitOrder[b.suit] || 5);
    if (suitDiff !== 0) return suitDiff;
    return (valueOrder[a.value] || 0) - (valueOrder[b.value] || 0);
  }) : [];

  return (
    <div className="flex flex-col items-center p-4 gap-4 max-w-4xl mx-auto w-full">

      {/* Waiting / Status Banner */}
      {!isPlaying && !isBidding && (
        <div className="w-full px-4 py-3 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
          <div className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>
            {gs.phase === 'setup' || !gs.phase ? '⏳ Waiting for Host to Deal...' : gs.phase.toUpperCase()}
          </div>
          {gs.first_hand_no_bid && (
            <div className="text-[6px] tracking-widest text-[#FFD700]/50 uppercase mt-1" style={PS2}>
              First Hand - No Bidding
            </div>
          )}
        </div>
      )}

      {/* Bidding Banner */}
      {isBidding && (
        <div className="w-full px-4 py-3 rounded-xl border-2 border-[#FF5F1F]/60 bg-[#FF5F1F]/10 text-center"
          style={{ boxShadow: '0 0 20px rgba(255,95,31,0.2)' }}>
          <div className="font-heading text-lg tracking-widest text-[#FF5F1F] uppercase">📋 Bidding Round</div>
          <div className="text-[7px] text-white/40 uppercase mt-1" style={PS2}>
            Seat {gs.current_bidder_seat || '?'} is bidding
          </div>
        </div>
      )}

      {/* Score Row */}
      <div className="w-full grid grid-cols-2 gap-3">
        <div className="p-3 border-2 rounded-xl text-center" style={{ borderColor: '#BC13FE30', background: '#BC13FE08' }}>
          <div className="font-heading text-sm tracking-widest text-white uppercase truncate">{gs.team1Name || 'Team 1'}</div>
          <div className="font-heading text-2xl text-[#BC13FE]">{gs.score1 || 0}</div>
          <div className="text-[7px] text-white/30 mt-0.5" style={PS2}>Bid: {gs.bid1 ?? '-'} | Books: {gs.books1 ?? '-'}</div>
        </div>
        <div className="p-3 border-2 rounded-xl text-center" style={{ borderColor: '#FF5F1F30', background: '#FF5F1F08' }}>
          <div className="font-heading text-sm tracking-widest text-white uppercase truncate">{gs.team2Name || 'Team 2'}</div>
          <div className="font-heading text-2xl text-[#FF5F1F]">{gs.score2 || 0}</div>
          <div className="text-[7px] text-white/30 mt-0.5" style={PS2}>Bid: {gs.bid2 ?? '-'} | Books: {gs.books2 ?? '-'}</div>
        </div>
      </div>

      {/* Table */}
      <div className="relative w-full bg-[#0a1a0a] rounded-3xl border-4 border-[#3d2817] overflow-visible"
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)', minHeight: 400 }}>

        {/* Table center logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-20">
          <img 
            src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" 
            alt="TexasNomad Games" 
            className="w-24 h-24 object-contain"
          />
        </div>

        {/* Top (Seat 3) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <SpadesSeat
            seatNumber={3}
            player={getPlayerAtSeat(3)}
            isMe={mySeatNumber === 3}
            isAvailable={availableSeats.includes(3)}
            isSpectator={isSpectator}
            onSit={() => onSitInSeat(3)}
            currentTurnSeat={gs.current_turn_seat}
            isPlaying={isPlaying}
          />
        </div>

        {/* Left (Seat 2) */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
          <SpadesSeat
            seatNumber={2}
            player={getPlayerAtSeat(2)}
            isMe={mySeatNumber === 2}
            isAvailable={availableSeats.includes(2)}
            isSpectator={isSpectator}
            onSit={() => onSitInSeat(2)}
            currentTurnSeat={gs.current_turn_seat}
            isPlaying={isPlaying}
          />
        </div>

        {/* Right (Seat 4) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <SpadesSeat
            seatNumber={4}
            player={getPlayerAtSeat(4)}
            isMe={mySeatNumber === 4}
            isAvailable={availableSeats.includes(4)}
            isSpectator={isSpectator}
            onSit={() => onSitInSeat(4)}
            currentTurnSeat={gs.current_turn_seat}
            isPlaying={isPlaying}
          />
        </div>

        {/* Center area with animations */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 z-20">
          {/* Shuffle animation */}
          {shufflePhase !== 'idle' && (
            <SpadesShuffleAnimation
              phase={shufflePhase}
              onComplete={() => setShufflePhase('idle')}
            />
          )}
          
          {/* Deal animation */}
          {dealPhase !== 'idle' && gs.deck && (
            <SpadesDealAnimation
              deck={gs.deck}
              players={players}
              onComplete={() => setDealPhase('idle')}
            />
          )}
          
          {/* Card play animation placeholder - to be added */}
          
          {/* Trick cards (when no animation) */}
          {!shufflePhase && !dealPhase && !animatingCard && (
            <SpadesCardArea trick={gs.current_trick || []} players={players} />
          )}
        </div>

        {/* Bottom (Seat 1) - Player's hand area on table */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <SpadesSeat
            seatNumber={1}
            player={getPlayerAtSeat(1)}
            isMe={mySeatNumber === 1}
            isAvailable={availableSeats.includes(1)}
            isSpectator={isSpectator}
            onSit={() => onSitInSeat(1)}
            currentTurnSeat={gs.current_turn_seat}
            isPlaying={isPlaying}
          />
          {/* Hand display on table for Seat 1 */}
          {mySeatNumber === 1 && sortedHand.length > 0 && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2">
              <div className="flex gap-1 justify-center" style={{ transform: 'translateX(-50%)' }}>
                {sortedHand.slice(0, 8).map((card, i) => {
                  const imgSrc = getCardImage(card);
                  const isMyTurn = gs.current_turn_seat === mySeatNumber && isPlaying;
                  return (
                    <button
                      key={card.id || i}
                      onClick={() => playCard(card)}
                      disabled={!isMyTurn}
                      className="relative rounded-lg overflow-hidden transition-all hover:scale-110 hover:-translate-y-2 active:scale-95 disabled:opacity-50"
                      style={{
                        width: 48, height: 68,
                        border: isMyTurn ? '2px solid #4ade80' : '1px solid rgba(255,255,255,0.3)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        marginLeft: i > 0 ? '-20px' : '0',
                      }}
                    >
                      {imgSrc ? (
                        <img src={imgSrc} alt={`${card.value}${card.suit}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white rounded-lg flex items-center justify-center">
                          <span className="text-lg">{card.suit}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
                {sortedHand.length > 8 && (
                  <div className="w-12 h-16 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center text-xs text-white/60">
                    +{sortedHand.length - 8}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Player Controls (below table) */}
      {isPlayer && myPlayer && (
        <div className="w-full max-w-md mx-auto mt-4">
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

      {/* Spectator note */}
      {isSpectator && (
        <div className="w-full text-center px-4 py-3 border border-white/10 rounded-xl bg-white/5">
          <div className="text-[8px] tracking-widest text-white/30 uppercase" style={PS2}>👁 Spectating — no controls</div>
        </div>
      )}

      {/* Player is seated but waiting for host to deal */}
      {isPlayer && myHand.length === 0 && (
        <div className="w-full text-center px-4 py-3 border border-[#BC13FE]/20 rounded-xl bg-[#BC13FE]/5">
          <div className="text-[8px] tracking-widest text-[#BC13FE]/50 uppercase" style={PS2}>🃏 Seated — Waiting for cards...</div>
        </div>
      )}
    </div>
  );
}