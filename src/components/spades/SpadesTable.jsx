import React, { useState, useEffect, useRef } from 'react';
import SpadesSeat from './SpadesSeat';
import SpadesCardArea from '@/components/spades/SpadesCardArea';
import SpadesPlayerControls from './SpadesPlayerControls';
import SpadesShuffleAnimation from './SpadesShuffleAnimation';
import SpadesDealAnimation from './SpadesDealAnimation';
import SpadesBidTimer from './SpadesBidTimer';
import { getCardImage, getCardBack } from '@/lib/spadesCardImages';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * Seat rotation — viewer always at bottom, partner always at top.
 * Clockwise order: 1(S) → 2(W) → 3(N) → 4(E)
 * Teams: 1&3, 2&4
 */
const ROTATION = {
  1: { 1: 'bottom', 2: 'left',   3: 'top',    4: 'right'  },
  2: { 2: 'bottom', 3: 'left',   4: 'top',    1: 'right'  },
  3: { 3: 'bottom', 4: 'left',   1: 'top',    2: 'right'  },
  4: { 4: 'bottom', 1: 'left',   2: 'top',    3: 'right'  },
};

function getRelativePosition(seatNumber, viewerSeat) {
  if (!viewerSeat) {
    return { 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' }[seatNumber] || 'bottom';
  }
  return ROTATION[viewerSeat]?.[seatNumber] || 'bottom';
}

const SEAT_POSITION_STYLES = {
  top:    { top: 8,     left: '50%', transform: 'translateX(-50%)' },
  bottom: { bottom: 8,  left: '50%', transform: 'translateX(-50%)' },
  left:   { left: 8,    top: '50%',  transform: 'translateY(-50%)' },
  right:  { right: 8,   top: '50%',  transform: 'translateY(-50%)' },
};

function sortHand(hand) {
  if (!hand || hand.length === 0) return [];
  const suitOrder = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, 'Joker': 4 };
  const valueOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'LJ': 15, 'BJ': 16 };
  return [...hand].sort((a, b) => {
    const sd = (suitOrder[a.suit] || 5) - (suitOrder[b.suit] || 5);
    return sd !== 0 ? sd : (valueOrder[a.value] || 0) - (valueOrder[b.value] || 0);
  });
}

export default function SpadesTable({
  gs, playerId, mySeatNumber, myRole, isPlayer, isSpectator,
  updateState, joinableSeats, emptySeats, onSitInSeat, roomCode,
  onPlayAgainstCPU, onWaitForRealPlayers, cpuChoiceShown,
  onChooseSpectate, onChooseSit, onPlayCard, onStandUp,
  onTakeOverCPU, onBidTimeout,
}) {
  const players = gs.players || [];
  const isPlaying = gs.phase === 'playing' || gs.phase === 'playing_trick';
  const isBidding = gs.phase === 'bidding';

  const [shufflePhase, setShufflePhase] = useState('idle');
  const [dealPhase, setDealPhase] = useState('idle');
  const [localHands, setLocalHands] = useState({});
  const prevShuffleTs = useRef(gs.shuffle_ts);
  const prevDealTs = useRef(gs.deal_ts);

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

  const canJoinSeat = !isPlayer && (isSpectator || myRole === null) && joinableSeats.length > 0;
  const getPlayerAtSeat = (seatNum) => players.find(p => p.seatNumber === seatNum && (p.role === 'player' || p.role === 'hostPlayer'));
  const myPlayer = players.find(p => p.playerId === playerId);
  const myHand = (isPlayer && myPlayer?.hand) ? myPlayer.hand : [];
  const sortedMyHand = sortHand(myHand);
  const isDealing = dealPhase !== 'idle';

  const renderSeat = (seatNumber) => {
    const position = getRelativePosition(seatNumber, isPlayer ? mySeatNumber : null);
    const isMe = mySeatNumber === seatNumber;
    const seatPlayer = getPlayerAtSeat(seatNumber);
    const localCount = (localHands[seatNumber] || []).length;
    const showOpponentFan = isDealing && !isMe && localCount > 0;

    return (
      <React.Fragment key={seatNumber}>
        <div className="absolute z-30" style={SEAT_POSITION_STYLES[position]}>
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
            gs={gs}
            position={position}
          />
        </div>

        {/* Face-down fan for opponents during deal animation */}
        {showOpponentFan && (
          <div className="absolute z-20 pointer-events-none"
            style={getOpponentHandStyle(position)}>
            {Array.from({ length: Math.min(localCount, 7) }).map((_, i, arr) => {
              const spread = (i - (arr.length - 1) / 2) * 3;
              // Left/right seats: rotate the entire fan 90° so cards face the player
              const baseRotate = (position === 'left' || position === 'right') ? 90 : 0;
              return (
                <div key={i} style={{
                  width: 32, height: 46,
                  marginLeft: i > 0 ? (position === 'top' || position === 'bottom' ? '-16px' : '-24px') : '0',
                  transform: `rotate(${baseRotate + spread}deg)`,
                  position: 'relative', zIndex: i,
                  display: 'inline-block',
                }}>
                  <img src={getCardBack()} alt="Card" className="w-full h-full rounded shadow-lg" style={{ objectFit: 'contain' }} />
                </div>
              );
            })}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-3 gap-2">

      {/* ── Phase / bidding banner ─────────────────────────────────────────────── */}
      {!isPlaying && !isBidding && (
        <div className="w-full px-3 py-2 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
          <div className="text-[7px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>
            {gs.phase === 'setup' || !gs.phase
              ? (gs.dealer_seat ? `⏳ Waiting for Seat ${gs.dealer_seat} to Shuffle & Deal...` : '⏳ Waiting for Dealer...')
              : gs.phase.toUpperCase()}
          </div>
          {gs.first_hand_no_bid && <div className="text-[6px] text-[#FFD700]/50 uppercase mt-0.5" style={PS2}>First Hand - No Bidding</div>}
        </div>
      )}

      {isBidding && !gs.first_hand_no_bid && (
        <div className="w-full px-3 py-2 rounded-xl border-2 border-[#FF5F1F]/60 bg-[#FF5F1F]/10 text-center" style={{ boxShadow: '0 0 16px rgba(255,95,31,0.2)' }}>
          <div className="font-heading text-base tracking-widest text-[#FF5F1F] uppercase">📋 Bidding Round</div>
          {(() => {
            const bidder = players.find(p => p.seatNumber === gs.current_bidder_seat);
            const bidderName = bidder?.playerName || bidder?.name || `Seat ${gs.current_bidder_seat || '?'}`;
            const isMyBidTurn = gs.current_bidder_seat === mySeatNumber;
            return (
              <>
                <div className="text-[6px] text-white/40 uppercase mt-0.5" style={PS2}>
                  {isMyBidTurn ? '▶ YOUR TURN TO BID' : `${bidderName} is bidding…`}
                </div>
                <SpadesBidTimer
                  isActive={!!(gs.current_bidder_seat)}
                  playerName={bidderName}
                  onBidPlaced={bidder?.bid != null}
                  onTimeout={() => onBidTimeout?.(gs.current_bidder_seat)}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* ── Score row ─────────────────────────────────────────────────────────── */}
      <div className="w-full grid grid-cols-2 gap-2">
        {[
          { name: gs.team1Name || 'Team 1', score: gs.score1 || 0, bid: gs.bid1, books: gs.books1, color: '#BC13FE' },
          { name: gs.team2Name || 'Team 2', score: gs.score2 || 0, bid: gs.bid2, books: gs.books2, color: '#FF5F1F' },
        ].map((t, idx) => (
          <div key={idx} className="p-2 border-2 rounded-xl text-center" style={{ borderColor: `${t.color}30`, background: `${t.color}08` }}>
            <div className="font-heading text-xs tracking-widest text-white uppercase truncate">{t.name}</div>
            <div className="font-heading text-xl" style={{ color: t.color }}>{t.score}</div>
            <div className="text-[6px] text-white/30" style={PS2}>Bid: {t.bid ?? '-'} | Books: {t.books ?? '-'}</div>
          </div>
        ))}
      </div>

      {/* ── Trick info strip ──────────────────────────────────────────────────── */}
      {(gs.phase === 'playing' || gs.phase === 'bidding') && (
        <div className="w-full px-3 py-1.5 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 grid grid-cols-3 gap-2 text-[6px]" style={PS2}>
          <div className="text-center"><div className="text-white/40 uppercase">Book</div><div className="text-[#FFD700]">{(gs.tricks_played || 0) + 1}/13</div></div>
          <div className="text-center"><div className="text-white/40 uppercase">Led Suit</div><div className="text-[#FFD700] text-base">{gs.current_trick?.[0]?.card?.suit || '-'}</div></div>
          <div className="text-center"><div className="text-white/40 uppercase">Spades</div><div className={gs.spades_broken ? 'text-[#4ade80]' : 'text-[#ef4444]'}>{gs.spades_broken ? 'BROKEN' : 'INTACT'}</div></div>
        </div>
      )}

      {/* ── Oval card table ───────────────────────────────────────────────────── */}
      <div className="relative w-full rounded-3xl border-4 overflow-visible"
        style={{
          background: 'rgba(180,70,10,0.35)',
          border: '4px solid rgba(255,120,30,0.6)',
          boxShadow: 'inset 0 0 40px rgba(255,80,0,0.25), inset 0 0 80px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
          minHeight: 420,
        }}>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-15">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TexasNomad" className="w-20 h-20 object-contain" />
        </div>

        {[1, 2, 3, 4].map(renderSeat)}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 z-20 pointer-events-none">
          {shufflePhase !== 'idle' && (
            <SpadesShuffleAnimation phase={shufflePhase} onComplete={() => setShufflePhase('idle')} />
          )}
          {dealPhase !== 'idle' && gs.deck?.length > 0 && (
            <SpadesDealAnimation
              dealSequence={gs.deck}
              seatedPlayers={players.filter(p => p.seatNumber != null && (p.role === 'player' || p.role === 'hostPlayer'))}
              dealStartSeat={gs.deal_start_seat}
              mySeatNumber={mySeatNumber}
              onCardDealt={(seatNumber, card) => {
                setLocalHands(prev => ({ ...prev, [seatNumber]: [...(prev[seatNumber] || []), card] }));
              }}
              onComplete={() => { setDealPhase('idle'); setLocalHands({}); }}
            />
          )}
          {shufflePhase === 'idle' && (
            <SpadesCardArea trick={gs.current_trick || []} players={players} mySeatNumber={mySeatNumber} />
          )}
        </div>
      </div>

      {/* ── YOUR HAND — flush below the table, no gap ─────────────────────────── */}
      {isPlayer && sortedMyHand.length > 0 && (
        <div className="w-full rounded-2xl border-2 border-[#4ade80]/40 bg-[#4ade80]/5 p-3"
          style={{ boxShadow: '0 0 16px rgba(74,222,128,0.08)' }}>

          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-[7px] tracking-widest text-[#4ade80]/70 uppercase" style={PS2}>🃏 Your Hand</div>
            {gs.phase === 'playing' && (
              <div className={`text-[6px] tracking-widest uppercase px-2 py-0.5 rounded ${
                gs.current_turn_seat === mySeatNumber
                  ? 'text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/50 animate-pulse'
                  : 'text-white/30 border border-white/10'
              }`} style={PS2}>
                {gs.current_turn_seat === mySeatNumber ? '▶ YOUR TURN' : '⏳ WAITING'}
              </div>
            )}
          </div>

          {/* Scrollable card row */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {sortedMyHand.map((card, i) => {
              const isMyTurn = gs.phase === 'playing' && gs.current_turn_seat === mySeatNumber;
              const isBiddingPhase = gs.phase === 'bidding';
              const hasBid = myPlayer?.bid != null;

              return (
                <div
                  key={card.id || i}
                  onClick={() => isMyTurn && onPlayCard?.(card)}
                  className={`relative rounded-lg overflow-hidden shadow-lg transition-all duration-150 select-none flex-shrink-0 ${
                    isMyTurn
                      ? 'cursor-pointer hover:-translate-y-3 hover:shadow-[0_0_14px_rgba(255,215,0,0.6)]'
                      : isBiddingPhase && !hasBid
                      ? 'hover:-translate-y-1'
                      : 'opacity-75'
                  }`}
                  style={{
                    width: 54, height: 76,
                    filter: isMyTurn ? 'brightness(1.1)' : isBiddingPhase && !hasBid ? 'brightness(1.2) drop-shadow(0 0 5px rgba(255,215,0,0.4))' : 'brightness(0.9)',
                  }}
                >
                  <img
                    src={getCardImage(card)}
                    alt={`${card.suit} ${card.value}`}
                    className="w-full h-full"
                    style={{ objectFit: 'contain' }}
                    onError={(e) => { e.target.src = getCardBack(); }}
                  />
                  {isMyTurn && (
                    <div className="absolute inset-0 bg-[#FFD700]/10 opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                      <div className="text-[6px] text-[#FFD700] uppercase" style={PS2}>Play</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {gs.phase === 'bidding' && myPlayer?.bid == null && gs.current_bidder_seat === mySeatNumber && (
            <div className="mt-1.5 text-center text-[6px] text-[#FF5F1F]/80 uppercase tracking-widest" style={PS2}>
              Use the controls above to place your bid
            </div>
          )}
        </div>
      )}

      {/* ── Player controls (bid/shuffle/deal) ───────────────────────────────── */}
      {isPlayer && myPlayer && mySeatNumber && (
        <SpadesPlayerControls
          seatNumber={mySeatNumber}
          player={myPlayer}
          gs={gs}
          updateState={updateState}
          isMySeat={true}
          onShuffleStart={() => setShufflePhase('shuffling')}
          onStandUp={onStandUp}
          isDealing={isDealing}
        />
      )}

      {/* ── Stand Up button ───────────────────────────────────────────────────── */}
      {isPlayer && myPlayer && mySeatNumber && (
        <button
          onClick={onStandUp}
          className="w-full py-1.5 px-4 rounded-lg border border-white/20 text-white/30 text-[6px] tracking-widest uppercase hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
          style={PS2}>
          🚶 Stand Up (Spectate)
        </button>
      )}
    </div>
  );
}

function getOpponentHandStyle(position) {
  switch (position) {
    case 'top':    return { top: 12,    left: '50%', transform: 'translateX(-50%)', display: 'flex' };
    case 'bottom': return { bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex' };
    case 'left':   return { left: 12,   top: '50%',  transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column' };
    case 'right':  return { right: 12,  top: '50%',  transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column' };
    default:       return {};
  }
}