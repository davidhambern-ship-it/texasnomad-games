import React, { useState, useEffect, useRef } from 'react';
import SpadesHandSeat from './SpadesHandSeat.jsx';
import SpadesCardArea from '@/components/spades/SpadesCardArea';
import SpadesPlayerControls from './SpadesPlayerControls';
import SpadesShuffleAnimation from './SpadesShuffleAnimation';
import SpadesDealAnimation from './SpadesDealAnimation';
import SpadesBidTimer from './SpadesBidTimer';
import HandSetup from './HandSetup';
import { useSuitOrder } from '@/hooks/useSuitOrder';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * Seat rotation — viewer always at bottom, partner always at top.
 * Clockwise: 1→2→3→4. Teams: 1&3, 2&4.
 */
const ROTATION = {
  1: { 1: 'bottom', 2: 'left',   3: 'top',    4: 'right'  },
  2: { 2: 'bottom', 3: 'left',   4: 'top',    1: 'right'  },
  3: { 3: 'bottom', 4: 'left',   1: 'top',    2: 'right'  },
  4: { 4: 'bottom', 1: 'left',   2: 'top',    3: 'right'  },
};

function getRelativePosition(seatNumber, viewerSeat) {
  if (!viewerSeat) return { 1: 'bottom', 2: 'left', 3: 'top', 4: 'right' }[seatNumber] || 'bottom';
  return ROTATION[viewerSeat]?.[seatNumber] || 'bottom';
}

const FALLBACK_BY_POS = { top: 3, bottom: 1, left: 4, right: 2 };

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
  const [showHandSetup, setShowHandSetup] = useState(false);
  const prevShuffleTs = useRef(gs.shuffle_ts);
  const prevDealTs = useRef(gs.deal_ts);
  const { suitOrder, setSuitOrder, sortHand } = useSuitOrder();

  useEffect(() => {
    if (!gs.deal_ts && dealPhase !== 'idle') {
      setDealPhase('idle');
      setLocalHands({});
    } else if (gs.deal_ts && gs.deal_ts !== prevDealTs.current && dealPhase === 'idle') {
      setLocalHands({});
      setDealPhase('dealing');
    }
    prevDealTs.current = gs.deal_ts;
  }, [gs.deal_ts]);

  useEffect(() => {
    if (!gs.shuffle_ts && shufflePhase !== 'idle') {
      setShufflePhase('idle');
    } else if (gs.shuffle_ts && gs.shuffle_ts !== prevShuffleTs.current && shufflePhase === 'idle') {
      setShufflePhase('shuffling');
    }
    prevShuffleTs.current = gs.shuffle_ts;
  }, [gs.shuffle_ts]);

  const canJoinSeat = !isPlayer && (isSpectator || myRole === null) && joinableSeats.length > 0;
  const getPlayerAtSeat = (n) => players.find(p => p.seatNumber === n && (p.role === 'player' || p.role === 'hostPlayer'));
  const myPlayer = players.find(p => p.playerId === playerId);
  const myHand = (isPlayer && myPlayer?.hand) ? sortHand(myPlayer.hand) : [];
  const isDealing = dealPhase !== 'idle';

  // Which seat number sits at each visual position?
  const viewerSeat = isPlayer ? mySeatNumber : null;
  const seatAtPos = (pos) =>
    [1, 2, 3, 4].find(n => getRelativePosition(n, viewerSeat) === pos) ?? FALLBACK_BY_POS[pos];

  const renderHandSeat = (seatNumber) => {
    const position = getRelativePosition(seatNumber, viewerSeat);
    const player = getPlayerAtSeat(seatNumber);
    const isMe = mySeatNumber === seatNumber && isPlayer;
    const isMyTurn = gs.current_turn_seat === seatNumber && (isPlaying || isBidding);
    // During deal animation: use local count; otherwise hand length
    const cardCount = isDealing
      ? (localHands[seatNumber] || []).length
      : (player?.hand?.length ?? 0);
    const hand = isMe ? myHand : null;

    return (
      <SpadesHandSeat
        key={seatNumber}
        position={position}
        player={player}
        seatNumber={seatNumber}
        isMe={isMe}
        isMyTurn={isMyTurn}
        isBidding={isBidding}
        cardCount={cardCount}
        hand={hand}
        onPlayCard={onPlayCard}
        isJoinable={canJoinSeat && joinableSeats.includes(seatNumber)}
        onSit={() => onSitInSeat(seatNumber)}
        onTakeOver={() => onTakeOverCPU?.(seatNumber)}
        gs={gs}
      />
    );
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-3 gap-2">
      {showHandSetup && (
        <HandSetup suitOrder={suitOrder} onSuitOrderChange={setSuitOrder} onClose={() => setShowHandSetup(false)} />
      )}

      {/* ── Phase banner ─────────────────────────────────────────── */}
      {!isPlaying && !isBidding && (
        <div className="w-full px-3 py-2 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
          <div className="text-[7px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>
            {gs.phase === 'setup' || !gs.phase
              ? (gs.dealer_seat ? `⏳ Seat ${gs.dealer_seat} to Shuffle & Deal...` : '⏳ Waiting for Dealer...')
              : gs.phase.toUpperCase()}
          </div>
          {gs.first_hand_no_bid && (
            <div className="text-[6px] text-[#FFD700]/50 uppercase mt-0.5" style={PS2}>First Hand — No Bidding</div>
          )}
        </div>
      )}

      {/* ── Bidding banner ───────────────────────────────────────── */}
      {isBidding && !gs.first_hand_no_bid && (() => {
        const bidder = players.find(p => p.seatNumber === gs.current_bidder_seat);
        const bidderName = bidder?.playerName || bidder?.name || `Seat ${gs.current_bidder_seat || '?'}`;
        const isMyBidTurn = gs.current_bidder_seat === mySeatNumber;
        return (
          <div className="w-full px-3 py-2 rounded-xl border-2 border-[#FF5F1F]/60 bg-[#FF5F1F]/10 text-center"
            style={{ boxShadow: '0 0 16px rgba(255,95,31,0.2)' }}>
            <div className="font-heading text-base tracking-widest text-[#FF5F1F] uppercase">📋 Bidding</div>
            <div className="text-[6px] text-white/40 uppercase mt-0.5" style={PS2}>
              {isMyBidTurn ? '▶ YOUR TURN TO BID' : `${bidderName} is bidding…`}
            </div>
            <SpadesBidTimer
              isActive={!!(gs.current_bidder_seat)}
              playerName={bidderName}
              onBidPlaced={bidder?.bid != null}
              onTimeout={() => onBidTimeout?.(gs.current_bidder_seat)}
            />
          </div>
        );
      })()}

      {/* ── Score row ────────────────────────────────────────────── */}
      <div className="w-full grid grid-cols-2 gap-2">
        {[
          { name: gs.team1Name || 'Team 1', score: gs.score1 || 0, bid: gs.bid1, books: gs.books1, color: '#BC13FE' },
          { name: gs.team2Name || 'Team 2', score: gs.score2 || 0, bid: gs.bid2, books: gs.books2, color: '#FF5F1F' },
        ].map((t, idx) => (
          <div key={idx} className="p-2 border-2 rounded-xl text-center"
            style={{ borderColor: `${t.color}30`, background: `${t.color}08` }}>
            <div className="font-heading text-xs tracking-widest text-white uppercase truncate">{t.name}</div>
            <div className="font-heading text-xl" style={{ color: t.color }}>{t.score}</div>
            <div className="text-[6px] text-white/30" style={PS2}>
              Bid: {t.bid ?? '-'} | Books: {t.books ?? '-'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Trick info ───────────────────────────────────────────── */}
      {(isPlaying || isBidding) && (
        <div className="w-full px-3 py-1.5 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 grid grid-cols-3 gap-2 text-[6px]" style={PS2}>
          <div className="text-center">
            <div className="text-white/40 uppercase">Book</div>
            <div className="text-[#FFD700]">{(gs.tricks_played || 0) + 1}/13</div>
          </div>
          <div className="text-center">
            <div className="text-white/40 uppercase">Led Suit</div>
            <div className="text-[#FFD700] text-base">{gs.current_trick?.[0]?.card?.suit || '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-white/40 uppercase">Spades</div>
            <div className={gs.spades_broken ? 'text-[#4ade80]' : 'text-[#ef4444]'}>
              {gs.spades_broken ? 'BROKEN' : 'INTACT'}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          THE TABLE — green felt, hands embedded at each edge
          ═══════════════════════════════════════════════════════════ */}
      <div className="relative w-full rounded-3xl overflow-visible"
        style={{
          background: 'radial-gradient(ellipse at center, #1a5c2a 0%, #0d3d1a 60%, #071a0c 100%)',
          border: '5px solid #2d7a40',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,100,30,0.2), 0 12px 40px rgba(0,0,0,0.6)',
          minHeight: 520,
          isolation: 'isolate',
        }}>

        {/* Felt texture */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 4px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 4px)',
          }} />

        {/* Center logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-8">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png"
            alt="TN" className="w-14 h-14 object-contain" style={{ opacity: 0.08 }} />
        </div>

        {/* ── TOP seat ─────────────────────────────────────────────── */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30" style={{ maxWidth: '72%' }}>
          {renderHandSeat(seatAtPos('top'))}
        </div>

        {/* ── LEFT seat ────────────────────────────────────────────── */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30">
          {renderHandSeat(seatAtPos('left'))}
        </div>

        {/* ── RIGHT seat ───────────────────────────────────────────── */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30">
          {renderHandSeat(seatAtPos('right'))}
        </div>

        {/* ── CENTER: trick area + animations ──────────────────────── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 z-20 pointer-events-none">
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

        {/* ── BOTTOM seat (human — inside the table at bottom edge) ── */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30" style={{ width: '88%' }}>
          {renderHandSeat(seatAtPos('bottom'))}
        </div>
      </div>

      {/* ── Player controls (bid/shuffle/deal) ───────────────────── */}
      {isPlayer && myPlayer && mySeatNumber && (
        <div className="relative" style={{ zIndex: 40 }}>
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
        </div>
      )}

      {/* ── Stand Up button ─────────────────────────────────────── */}
      {isPlayer && myPlayer && mySeatNumber && (
        <button
          onClick={onStandUp}
          className="w-full py-1.5 px-4 rounded-lg border border-white/20 text-white/30 text-[6px] tracking-widest uppercase hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
          style={{ ...PS2, position: 'relative', zIndex: 40 }}>
          🚶 Stand Up (Spectate)
        </button>
      )}
    </div>
  );
}