import React, { useState, useEffect, useRef } from 'react';
import SpadesSeat from './SpadesSeat';
import SpadesCardArea from './SpadesCardArea';
import SpadesPlayerControls from './SpadesPlayerControls';
import SpadesShuffleAnimation from './SpadesShuffleAnimation';
import SpadesDealAnimation from './SpadesDealAnimation';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

// Get relative position based on viewer's seat - rotates the table
function getRelativePosition(seatNumber, viewerSeat) {
  if (!viewerSeat) {
    // Spectator mode: fixed overhead view
    const positions = { 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' };
    return positions[seatNumber];
  }
  
  // Rotation mapping: viewer always sees themselves at bottom
  const rotation = {
    1: { 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' },
    2: { 1: 'right', 2: 'bottom', 3: 'left', 4: 'top' },
    3: { 1: 'top', 2: 'right', 3: 'bottom', 4: 'left' },
    4: { 1: 'left', 2: 'top', 3: 'right', 4: 'bottom' },
  };
  
  return rotation[viewerSeat]?.[seatNumber] || 'bottom';
}

export default function SpadesTable({ gs, playerId, mySeatNumber, myRole, isPlayer, isSpectator, updateState, joinableSeats, emptySeats, onSitInSeat, roomCode, onPlayAgainstCPU, onWaitForRealPlayers, cpuChoiceShown, onChooseSpectate, onChooseSit, onPlayCard, onStandUp, onTakeOverCPU }) {
  const players = gs.players || [];
  const isPlaying = gs.phase === 'playing' || gs.phase === 'playing_trick';
  const isBidding = gs.phase === 'bidding';
  const isSetup = !gs.phase || gs.phase === 'setup';

  const [shufflePhase, setShufflePhase] = useState('idle');
  const [dealPhase, setDealPhase] = useState('idle');
  // localHands: card accumulator during deal animation, keyed by seatNumber
  const [localHands, setLocalHands] = useState({});
  const prevShuffleTs = useRef(gs.shuffle_ts);
  const prevDealTs = useRef(gs.deal_ts);

  // Trigger deal animation when deal_ts changes (works for both human dealer and CPU auto-deal)
  useEffect(() => {
    if (gs.deal_ts && gs.deal_ts !== prevDealTs.current && dealPhase === 'idle') {
      setLocalHands({});
      setDealPhase('dealing');
    }
    prevDealTs.current = gs.deal_ts;
  }, [gs.deal_ts]);

  useEffect(() => {
    if (gs.shuffle_ts && gs.shuffle_ts !== prevShuffleTs.current && shufflePhase === 'idle') {
      setShufflePhase('shuffling');
    }
    prevShuffleTs.current = gs.shuffle_ts;
  }, [gs.shuffle_ts]);

  const showCPUChoice = isPlayer && emptySeats.length > 0 && isSetup && cpuChoiceShown;
  const canJoinSeat = !isPlayer && (isSpectator || myRole === null);
  const getPlayerAtSeat = (seatNum) => players.find(p => p.seatNumber === seatNum && (p.role === 'player' || p.role === 'hostPlayer'));
  const myPlayer = players.find(p => p.playerId === playerId);
  const myHand = (isPlayer && myPlayer?.hand) ? myPlayer.hand : [];

  const sortedHand = myHand.length > 0 ? [...myHand].sort((a, b) => {
    const suitOrder = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, 'Joker': 4 };
    const valueOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };
    const suitDiff = (suitOrder[a.suit] || 5) - (suitOrder[b.suit] || 5);
    if (suitDiff !== 0) return suitDiff;
    return (valueOrder[a.value] || 0) - (valueOrder[b.value] || 0);
  }) : [];

  const getHorizontalOverlap = (cardCount) => {
    if (cardCount <= 1) return 0;
    const availableWidth = 460;
    const cardWidth = 52;
    const overlap = cardCount > 1 ? (cardWidth * cardCount - availableWidth) / (cardCount - 1) : 0;
    return Math.max(12, Math.min(overlap, 40));
  };

  const getVerticalOverlap = (cardCount) => {
    if (cardCount <= 1) return 0;
    const availableHeight = 420;
    const cardHeight = 73;
    const overlap = cardCount > 1 ? (cardHeight * cardCount - availableHeight) / (cardCount - 1) : 0;
    return Math.max(16, Math.min(overlap, 58));
  };

  const isDealing = dealPhase !== 'idle';

  const renderSeat = (seatNumber) => {
    const position = getRelativePosition(seatNumber, isPlayer ? mySeatNumber : null);
    const isMe = mySeatNumber === seatNumber;
    const seatPlayer = getPlayerAtSeat(seatNumber);

    // During deal animation: show locally accumulated cards (my seat face-up, others face-down)
    // After animation: fall back to gs hand
    let displayHand;
    if (isDealing) {
      displayHand = localHands[seatNumber] || [];
    } else {
      displayHand = (isMe && isPlayer && seatPlayer?.hand) ? seatPlayer.hand : [];
    }
    const showFaceUp = isMe && isPlayer;
    
    const sortedSeatHand = displayHand.length > 0 ? [...displayHand].sort((a, b) => {
      const suitOrder = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, 'Joker': 4 };
      const valueOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };
      const suitDiff = (suitOrder[a.suit] || 5) - (suitOrder[b.suit] || 5);
      if (suitDiff !== 0) return suitDiff;
      return (valueOrder[a.value] || 0) - (valueOrder[b.value] || 0);
    }) : [];

    const positionStyles = {
      top: { top: 3, left: '50%', transform: 'translateX(-50%)' },
      bottom: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
      left: { left: 3, top: '50%', transform: 'translateY(-50%)' },
      right: { right: 3, top: '50%', transform: 'translateY(-50%)' },
    };

    const handContainerStyles = {
      top: { width: 700, height: 140, top: 1, left: '50%', transform: 'translateX(-50%) rotate(180deg)' },
      bottom: { width: 700, height: 140, bottom: 0, left: '50%', transform: 'translateX(-50%)' },
      left: { width: 140, height: 600, left: 1, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' },
      right: { width: 140, height: 600, right: 1, top: '50%', transform: 'translateY(-50%) rotate(90deg)' },
    };

    const isHorizontal = position === 'top' || position === 'bottom';
    const getOverlap = isHorizontal ? getHorizontalOverlap : getVerticalOverlap;

    // Show hand for: my seat (face-up), opponents during deal (face-down backs), skip if empty
    const showHand = (showFaceUp || isDealing) && sortedSeatHand.length > 0;

    return (
      <React.Fragment key={seatNumber}>
        {showHand && (
          <div className={`absolute z-20 flex ${isHorizontal ? 'justify-center' : 'flex-col items-center'}`} style={handContainerStyles[position]}>
            {sortedSeatHand.map((card, i, arr) => {
              const overlap = getOverlap(arr.length) * 0.5;
              const isMyTurn = !isDealing && gs.current_turn_seat === seatNumber && gs.phase === 'playing';
              const isBiddingPhase = !isDealing && gs.phase === 'bidding';
              const hasBid = myPlayer?.bid != null;
              const faceUp = showFaceUp && !isDealing ? true : (isDealing && isMe);
              return (
                <div
                  key={card.id || i}
                  onClick={() => isMyTurn && onPlayCard?.(card)}
                  className={`relative rounded-lg overflow-hidden shadow-lg transition-all duration-200 ${
                    isMyTurn 
                      ? 'cursor-pointer hover:-translate-y-4 hover:z-30 hover:shadow-[0_0_20px_rgba(255,215,0,0.6)]' 
                      : isBiddingPhase && !hasBid
                      ? 'cursor-pointer hover:-translate-y-2'
                      : isDealing ? 'cursor-default' : 'opacity-90 cursor-not-allowed'
                  }`}
                  style={{
                    width: 64, height: 90,
                    [isHorizontal ? 'marginLeft' : 'marginTop']: i > 0 ? `-${overlap}px` : '0',
                    transform: isHorizontal 
                      ? `rotate(${(i - (arr.length - 1) / 2) * 2}deg) translateY(${Math.abs(i - (arr.length - 1) / 2) * -1}px)`
                      : 'none',
                    filter: isBiddingPhase && !hasBid ? 'brightness(1.35) drop-shadow(0 0 10px rgba(255,215,0,0.6))' : 'brightness(1.1)',
                    animation: isDealing ? 'card-arrive 0.15s ease-out' : 'none',
                  }}
                >
                  <img 
                    src={faceUp ? getCardImage(card) : getCardBack()} 
                    alt={faceUp ? `${card.suit} ${card.value}` : 'Card back'} 
                    className="w-full h-full"
                    style={{ objectFit: 'contain', imageRendering: 'auto', transform: 'translateZ(0)' }}
                    onError={(e) => { e.target.src = getCardBack(); }}
                  />
                  {isMyTurn && (
                    <div className="absolute inset-0 bg-[#FFD700]/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-[10px] font-heading text-[#FFD700] uppercase tracking-widest" style={PS2}>Play</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        <div className={`absolute z-10 ${positionStyles[position].left ? 'left-1/2 -translate-x-1/2' : positionStyles[position].top ? 'top-1/2 -translate-y-1/2' : ''}`} style={positionStyles[position]}>
          <SpadesSeat
            seatNumber={seatNumber}
            player={seatPlayer}
            isMe={isMe}
            isJoinable={canJoinSeat && joinableSeats.includes(seatNumber)}
            onSit={() => onSitInSeat(seatNumber)}
            onStand={onStandUp}
            onTakeOver={() => onTakeOverCPU?.(seatNumber)}
            currentTurnSeat={gs.current_turn_seat}
            isPlaying={isPlaying}
          />
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col items-center p-6 gap-6 max-w-6xl mx-auto w-full">
      {showCPUChoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0a1a0a] to-[#050a05] border-4 border-[#FFD700]/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3), inset 0 0 60px rgba(0,0,0,0.8)' }}>
            <div className="text-center mb-6">
              <div className="text-2xl font-heading text-[#FFD700] uppercase tracking-widest mb-2" style={PS2}>🃏 Ready to Play?</div>
              <div className="text-white/60 text-sm">{emptySeats.length} empty seat{emptySeats.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="space-y-3">
              <button onClick={onPlayAgainstCPU} className="w-full py-4 px-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFA500] hover:to-[#FFD700] text-black font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>🤖 Play vs CPU</button>
              <button onClick={onWaitForRealPlayers} className="w-full py-4 px-6 bg-gradient-to-r from-[#BC13FE] to-[#9333ea] hover:from-[#9333ea] hover:to-[#BC13FE] text-white font-heading text-lg uppercase tracking-widest rounded-xl transition-all transform hover:scale-105" style={PS2}>👥 Wait for Players</button>
            </div>
          </div>
        </div>
      )}

      {!isPlaying && !isBidding && (
        <div className="w-full px-4 py-3 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
          <div className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>
            {gs.phase === 'setup' || !gs.phase
              ? (gs.dealer_seat ? `⏳ Waiting for Seat ${gs.dealer_seat} to Shuffle & Deal...` : '⏳ Waiting for Dealer...')
              : gs.phase.toUpperCase()}
          </div>
          {gs.first_hand_no_bid && (<div className="text-[6px] tracking-widest text-[#FFD700]/50 uppercase mt-1" style={PS2}>First Hand - No Bidding</div>)}
        </div>
      )}

      {isBidding && !gs.first_hand_no_bid && (
        <div className="w-full px-4 py-3 rounded-xl border-2 border-[#FF5F1F]/60 bg-[#FF5F1F]/10 text-center" style={{ boxShadow: '0 0 20px rgba(255,95,31,0.2)' }}>
          <div className="font-heading text-lg tracking-widest text-[#FF5F1F] uppercase">📋 Bidding Round</div>
          <div className="text-[7px] text-white/40 uppercase mt-1" style={PS2}>Seat {gs.current_bidder_seat || '?'} is bidding</div>
        </div>
      )}

      <div className="w-full grid grid-cols-2 gap-3">
        <div className="p-3 border-2 rounded-xl text-center relative" style={{ borderColor: '#BC13FE30', background: '#BC13FE08' }}>
          <div className="font-heading text-sm tracking-widest text-white uppercase truncate">{gs.team1Name || 'Team 1'}</div>
          <div className="font-heading text-2xl text-[#BC13FE]">{gs.score1 || 0}</div>
          <div className="text-[7px] text-white/30 mt-0.5" style={PS2}>Bid: {gs.bid1 ?? '-'} | Books: {gs.books1 ?? '-'}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1 min-h-[20px]">
            {Array.from({ length: gs.books1 || 0 }).map((_, i) => (
              <div key={i} className="w-4 h-3 bg-gradient-to-br from-[#BC13FE] to-[#6b21a8] rounded-sm border border-[#BC13FE]/50" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} title={`Book ${i + 1}`} />
            ))}
          </div>
        </div>
        <div className="p-3 border-2 rounded-xl text-center relative" style={{ borderColor: '#FF5F1F30', background: '#FF5F1F08' }}>
          <div className="font-heading text-sm tracking-widest text-white uppercase truncate">{gs.team2Name || 'Team 2'}</div>
          <div className="font-heading text-2xl text-[#FF5F1F]">{gs.score2 || 0}</div>
          <div className="text-[7px] text-white/30 mt-0.5" style={PS2}>Bid: {gs.bid2 ?? '-'} | Books: {gs.books2 ?? '-'}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1 min-h-[20px]">
            {Array.from({ length: gs.books2 || 0 }).map((_, i) => (
              <div key={i} className="w-4 h-3 bg-gradient-to-br from-[#FF5F1F] to-[#c2410c] rounded-sm border border-[#FF5F1F]/50" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} title={`Book ${i + 1}`} />
            ))}
          </div>
        </div>
      </div>

      {(gs.phase === 'playing' || gs.phase === 'bidding') && (
        <div className="w-full px-4 py-2 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 grid grid-cols-3 gap-2 text-[7px]" style={PS2}>
          <div className="text-center"><div className="text-white/40 uppercase">Book</div><div className="text-[#FFD700]">{(gs.tricks_played || 0) + 1}/13</div></div>
          <div className="text-center"><div className="text-white/40 uppercase">Active Suit</div><div className="text-[#FFD700] text-lg">{(gs.current_trick?.[0]?.card?.suit) || '-'}</div></div>
          <div className="text-center"><div className="text-white/40 uppercase">Spades</div><div className={gs.spades_broken ? 'text-[#4ade80]' : 'text-[#ef4444]'}>{gs.spades_broken ? 'BROKEN' : 'INTACT'}</div></div>
        </div>
      )}

      <div className="relative w-full rounded-3xl border-4 overflow-visible"
        style={{ background: 'rgba(180,70,10,0.35)', border: '4px solid rgba(255,120,30,0.6)', boxShadow: 'inset 0 0 40px rgba(255,80,0,0.25), inset 0 0 80px rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', minHeight: 520 }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-20">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TexasNomad Games" className="w-32 h-32 object-contain" />
        </div>
        {[1, 2, 3, 4].map(renderSeat)}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 z-20">
          {shufflePhase !== 'idle' && <SpadesShuffleAnimation phase={shufflePhase} onComplete={() => setShufflePhase('idle')} />}
          {dealPhase !== 'idle' && gs.deck && gs.deck.length > 0 && (
            <SpadesDealAnimation
              dealSequence={gs.deck}
              seatedPlayers={players.filter(p => p.seatNumber != null && (p.role === 'player' || p.role === 'hostPlayer'))}
              dealStartSeat={gs.deal_start_seat}
              mySeatNumber={mySeatNumber}
              onCardDealt={(seatNumber, card) => {
                setLocalHands(prev => ({
                  ...prev,
                  [seatNumber]: [...(prev[seatNumber] || []), card],
                }));
              }}
              onComplete={() => {
                setDealPhase('idle');
                setLocalHands({});
              }}
            />
          )}
          {shufflePhase === 'idle' && dealPhase === 'idle' && <SpadesCardArea trick={gs.current_trick || []} players={players} />}
        </div>
      </div>

      {isPlayer && myPlayer && (
        <div className="w-full max-w-md mx-auto mt-4 space-y-3">
          <SpadesPlayerControls seatNumber={mySeatNumber} player={myPlayer} gs={gs} updateState={updateState} isMySeat={true} onShuffleStart={() => setShufflePhase('shuffling')} onStandUp={onStandUp} isDealing={isDealing} />
          <button onClick={onStandUp} className="w-full py-3 px-4 rounded-lg border-2 border-white/30 text-white/60 font-heading text-sm tracking-widest uppercase hover:border-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all" style={PS2}>🚶 Stand Up (Spectate)</button>
        </div>
      )}
    </div>
  );
}