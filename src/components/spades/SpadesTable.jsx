import React, { useState } from 'react';
import SpadesSeat from './SpadesSeat';
import SpadesCardArea from './SpadesCardArea';
import SpadesPlayerControls from './SpadesPlayerControls';
import SpadesShuffleAnimation from './SpadesShuffleAnimation';
import SpadesDealAnimation from './SpadesDealAnimation';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const SEAT_POSITIONS = {
  1: 'bottom',
  2: 'left',
  3: 'top',
  4: 'right',
};

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



  // Calculate card overlap for horizontal spread (seats 1 & 3)
  const getHorizontalOverlap = (cardCount) => {
    if (cardCount <= 1) return 0;
    const availableWidth = 460; // Available width for card spread
    const cardWidth = 52;
    const totalWidth = cardWidth + (cardCount - 1) * (cardWidth - 12); // Default overlap of 12px
    const overlap = cardCount > 1 ? (cardWidth * cardCount - availableWidth) / (cardCount - 1) : 0;
    return Math.max(12, Math.min(overlap, 40)); // Clamp between 12-40px overlap
  };

  // Calculate card overlap for vertical spread (seats 2 & 4)
  const getVerticalOverlap = (cardCount) => {
    if (cardCount <= 1) return 0;
    const availableHeight = 420; // Available height for card spread
    const cardHeight = 73;
    const totalHeight = cardHeight + (cardCount - 1) * (cardHeight - 16); // Default overlap of 16px
    const overlap = cardCount > 1 ? (cardHeight * cardCount - availableHeight) / (cardCount - 1) : 0;
    return Math.max(16, Math.min(overlap, 58)); // Clamp between 16-58px overlap
  };

  return (
    <div className="flex flex-col items-center p-6 gap-6 max-w-6xl mx-auto w-full">

      {/* CPU Choice Modal */}
      {showCPUChoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0a1a0a] to-[#050a05] border-4 border-[#FFD700]/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3), inset 0 0 60px rgba(0,0,0,0.8)' }}>
            <div className="text-center mb-6">
              <div className="text-2xl font-heading text-[#FFD700] uppercase tracking-widest mb-2" style={PS2}>
                🃏 Ready to Play?
              </div>
              <div className="text-white/60 text-sm">
                {availableSeats.length} seat{availableSeats.length > 1 ? 's' : ''} available
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={onPlayAgainstCPU}
                className="w-full py-4 px-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFA500] hover:to-[#FFD700] text-black font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105"
                style={PS2}
              >
                🤖 Play vs CPU
              </button>
              <button
                onClick={onWaitForRealPlayers}
                className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105"
                style={PS2}
              >
                👥 Wait for Players
              </button>
            </div>
          </div>
        </div>
      )}

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
      {isBidding && !gs.first_hand_no_bid && (
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
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)', minHeight: 520 }}>

        {/* Table center logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-20">
          <img 
            src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" 
            alt="TexasNomad Games" 
            className="w-32 h-32 object-contain"
          />
        </div>

        {/* Top (Seat 3) - Hand on table (card backs only) - horizontal fan (mirrors seat 1) */}
        {getPlayerAtSeat(3)?.hand?.length > 0 && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-5 flex justify-center" style={{ width: 600, height: 120 }}>
            <div className="flex" style={{ transform: 'scale(1) rotate(180deg)' }}>
              {getPlayerAtSeat(3).hand.map((card, i, arr) => {
                const overlap = getHorizontalOverlap(arr.length);
                return (
                  <div
                    key={card.id || i}
                    className="relative rounded-lg overflow-hidden shadow-lg"
                    style={{
                      width: 52, height: 73,
                      marginLeft: i > 0 ? `-${overlap}px` : '0',
                      transform: `rotate(${(i - (arr.length - 1) / 2) * 2.5}deg) translateY(${Math.abs(i - (arr.length - 1) / 2) * -1.5}px)`,
                    }}
                  >
                    <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

        {/* Left (Seat 2) - Hand on table (card backs only) - vertical fan */}
        {getPlayerAtSeat(2)?.hand?.length > 0 && (
          <div className="absolute left-20 top-1/2 -translate-y-1/2 z-5 flex flex-col items-center" style={{ width: 100, height: 520 }}>
            {getPlayerAtSeat(2).hand.map((card, i, arr) => {
              const overlap = getVerticalOverlap(arr.length);
              return (
                <div
                  key={card.id || i}
                  className="relative rounded-lg overflow-hidden shadow-lg"
                  style={{
                    width: 52, height: 73,
                    marginTop: i > 0 ? `-${overlap}px` : '0',
                    transform: `rotate(-90deg)`,
                  }}
                >
                  <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
                </div>
              );
            })}
          </div>
        )}
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

        {/* Right (Seat 4) - Hand on table (card backs only) - vertical fan */}
        {getPlayerAtSeat(4)?.hand?.length > 0 && (
          <div className="absolute right-20 top-1/2 -translate-y-1/2 z-5 flex flex-col items-center" style={{ width: 100, height: 520 }}>
            {getPlayerAtSeat(4).hand.map((card, i, arr) => {
              const overlap = getVerticalOverlap(arr.length);
              return (
                <div
                  key={card.id || i}
                  className="relative rounded-lg overflow-hidden shadow-lg"
                  style={{
                    width: 52, height: 73,
                    marginTop: i > 0 ? `-${overlap}px` : '0',
                    transform: `rotate(90deg)`,
                  }}
                >
                  <img src={getCardBack()} alt="Card" className="w-full h-full object-cover" />
                </div>
              );
            })}
          </div>
        )}
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

        {/* Bottom (Seat 1) - Player's hand (face-up cards) - wider spread */}
        {mySeatNumber === 1 && sortedHand.length > 0 && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 flex justify-center" style={{ width: 700, height: 140 }}>
            <div className="flex" style={{ transform: 'scale(1)' }}>
              {sortedHand.map((card, i, arr) => {
                const overlap = getHorizontalOverlap(arr.length) * 0.5;
                return (
                  <div
                    key={card.id || i}
                    className="relative rounded-lg overflow-hidden shadow-lg transition-all duration-200 hover:-translate-y-4 hover:z-30 hover:shadow-[0_0_20px_rgba(255,215,0,0.6)] cursor-pointer"
                    style={{
                      width: 64, height: 90,
                      marginLeft: i > 0 ? `-${overlap}px` : '0',
                      transform: `rotate(${(i - (arr.length - 1) / 2) * 2}deg) translateY(${Math.abs(i - (arr.length - 1) / 2) * -1}px)`,
                    }}
                  >
                    <img src={getCardImage(card)} alt={`${card.suit} ${card.value}`} className="w-full h-full object-cover" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
          
          {/* Trick cards */}
          {shufflePhase === 'idle' && dealPhase === 'idle' && (
            <SpadesCardArea trick={gs.current_trick || []} players={players} />
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
    </div>
  );
}