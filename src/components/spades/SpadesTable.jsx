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
  // Optimistic hand: immediately remove a played card before server round-trip
  const [optimisticRemovedId, setOptimisticRemovedId] = useState(null);
  const prevShuffleTs = useRef(gs.shuffle_ts);
  const prevDealTs = useRef(gs.deal_ts);
  const { suitOrder, setSuitOrder, sortHand } = useSuitOrder();

  // Measure the table container so we can pass exact pixel budgets to SpadesHandSeat
  const tableRef = useRef(null);
  const [tableW, setTableW] = useState(0);
  const [tableH, setTableH] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (tableRef.current) {
        setTableW(tableRef.current.clientWidth);
        setTableH(tableRef.current.clientHeight);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tableRef.current) ro.observe(tableRef.current);
    return () => ro.disconnect();
  }, []);

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
  // Apply optimistic removal so the card disappears immediately on play
  const rawHand = (isPlayer && myPlayer?.hand) ? myPlayer.hand : [];
  const optimisticHand = optimisticRemovedId
    ? rawHand.filter(c => c.id !== optimisticRemovedId)
    : rawHand;
  const myHand = sortHand(optimisticHand);

  // Clear optimistic removal once the server state has caught up
  useEffect(() => {
    if (optimisticRemovedId && myPlayer?.hand && !myPlayer.hand.find(c => c.id === optimisticRemovedId)) {
      setOptimisticRemovedId(null);
    }
  }, [myPlayer?.hand, optimisticRemovedId]);

  // Wrap onPlayCard to immediately remove the card optimistically
  const handlePlayCardOptimistic = (card) => {
    setOptimisticRemovedId(card.id);
    onPlayCard?.(card);
  };
  const isDealing = dealPhase !== 'idle';

  const viewerSeat = isPlayer ? mySeatNumber : null;
  const seatAtPos = (pos) =>
    [1, 2, 3, 4].find(n => getRelativePosition(n, viewerSeat) === pos) ?? FALLBACK_BY_POS[pos];

  // Space budgets for each position
  // Side seats get a vertical budget = tableH * ~0.4
  // Top/bottom seats get horizontal budget = tableW * ~0.65
  // Side seats occupy top:20% to bottom:28% of the table = 52% of tableH
  const sideBudgetH = tableH > 0 ? Math.floor(tableH * 0.52) : 140;
  const topBotBudgetW = tableW > 0 ? Math.floor(tableW * 0.62) : 200;
  // Human hand at bottom gets almost full table width minus padding
  const myHandBudgetW = tableW > 0 ? Math.floor(tableW - 24) : 300;

  const renderHandSeat = (seatNumber) => {
    const position = getRelativePosition(seatNumber, viewerSeat);
    const player = getPlayerAtSeat(seatNumber);
    const isMe = mySeatNumber === seatNumber && isPlayer;
    const isMyTurn = gs.current_turn_seat === seatNumber && (isPlaying || isBidding);
    const cardCount = isDealing
      ? (localHands[seatNumber] || []).length
      : isMe
        ? myHand.length  // use optimistic hand length for the human player
        : (player?.hand?.length ?? 0);
    const hand = isMe ? myHand : null;

    // Pass layout budgets so the hand can fit itself
    const maxWidth = (position === 'bottom' && isMe) ? myHandBudgetW
      : (position === 'top' || position === 'bottom') ? topBotBudgetW
      : undefined;
    const maxHeight = (position === 'left' || position === 'right') ? sideBudgetH : undefined;

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
        onPlayCard={isMe ? handlePlayCardOptimistic : onPlayCard}
        isJoinable={canJoinSeat && joinableSeats.includes(seatNumber)}
        onSit={() => onSitInSeat(seatNumber)}
        onTakeOver={() => onTakeOverCPU?.(seatNumber)}
        gs={gs}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
      />
    );
  };

  return (
    // overflow-hidden on outermost wrapper prevents any horizontal bleed
    <div className="flex flex-col w-full max-w-2xl mx-auto px-2 gap-2" style={{ overflowX: 'hidden' }}>
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
              B:{t.bid ?? '-'} 📚{t.books ?? '-'}
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
            <div className="text-white/40 uppercase">Suit</div>
            <div className="text-[#FFD700] text-sm">{gs.current_trick?.[0]?.card?.suit || '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-white/40 uppercase">♠</div>
            <div className={gs.spades_broken ? 'text-[#4ade80]' : 'text-[#ef4444]'}>
              {gs.spades_broken ? 'BROKEN' : 'INTACT'}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          THE TABLE — green felt
          overflow:hidden so seats never bleed outside
          ═══════════════════════════════════════════════════════════ */}
      <div
        ref={tableRef}
        className="relative w-full rounded-3xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,140,30,0.55) 0%, rgba(200,80,10,0.45) 50%, rgba(120,40,0,0.6) 100%)',
          backdropFilter: 'blur(12px)',
          border: '4px solid rgba(255,160,50,0.6)',
          boxShadow: 'inset 0 0 60px rgba(255,120,20,0.15), inset 0 0 30px rgba(255,180,60,0.1), 0 10px 40px rgba(255,100,0,0.3), 0 0 80px rgba(255,120,0,0.15)',
          aspectRatio: '4/3',
          overflow: 'hidden',
          isolation: 'isolate',
        }}>

        {/* Glass sheen overlay */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,220,100,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)',
          }} />

        {/* Center logo watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/6d606b336_logoimage-3.png"
            alt="TN" className="object-contain" style={{ opacity: 0.18, width: '30%', minWidth: 80, maxWidth: 160 }} />
        </div>

        {/* ── TOP seat ─────────────────────────────────────────────── */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30" style={{ maxWidth: '65%' }}>
          {renderHandSeat(seatAtPos('top'))}
        </div>

        {/* ── LEFT seat ────────────────────────────────────────────── */}
        {/* Clamped to center band — never touches top or bottom hands */}
        <div className="absolute left-2 z-30" style={{ top: '20%', bottom: '28%', maxWidth: '22%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderHandSeat(seatAtPos('left'))}
        </div>

        {/* ── RIGHT seat ───────────────────────────────────────────── */}
        <div className="absolute right-2 z-30" style={{ top: '20%', bottom: '28%', maxWidth: '22%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderHandSeat(seatAtPos('right'))}
        </div>

        {/* ── CENTER: trick + animations ────────────────────────────── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
          style={{ width: '38%', height: '38%', minWidth: 120, minHeight: 120 }}>
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

        {/* ── BOTTOM seat ───────────────────────────────────────────── */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30" style={{ width: '92%', maxWidth: '92%' }}>
          {renderHandSeat(seatAtPos('bottom'))}
        </div>
      </div>

      {/* ── Player controls ───────────────────────────────────────── */}
      {isPlayer && myPlayer && mySeatNumber && (
        <div style={{ position: 'relative', zIndex: 40 }}>
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

      {/* ── Stand Up button ───────────────────────────────────────── */}
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