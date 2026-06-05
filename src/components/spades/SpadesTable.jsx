import React from 'react';
import SpadesSeat from './SpadesSeat';
import SpadesCardArea from './SpadesCardArea';

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

  const getPlayerAtSeat = (seatNum) => players.find(p => p.seatNumber === seatNum && (p.role === 'player' || p.role === 'hostPlayer'));

  const playCard = async (card) => {
    if (!isPlayer || gs.current_turn_seat !== mySeatNumber) return;
    const me = players.find(p => p.playerId === playerId);
    if (!me) return;
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

  const myPlayer = players.find(p => p.playerId === playerId);
  const myHand = (isPlayer && myPlayer?.hand) ? myPlayer.hand : [];

  return (
    <div className="flex flex-col items-center p-4 gap-4 max-w-4xl mx-auto w-full">

      {/* Waiting / Status Banner */}
      {!isPlaying && !isBidding && (
        <div className="w-full px-4 py-3 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 text-center">
          <div className="text-[8px] tracking-widest text-[#FFD700]/70 uppercase" style={PS2}>
            {gs.phase === 'setup' || !gs.phase ? '⏳ Waiting for Host to Deal...' : gs.phase.toUpperCase()}
          </div>
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

        {/* Center trick area */}
        <SpadesCardArea trick={gs.current_trick || []} players={players} />

        {/* Bottom (Seat 1) */}
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
        </div>
      </div>

      {/* My Hand */}
      {isPlayer && myHand.length > 0 && (
        <div className="w-full p-4 border border-[#4ade80]/30 rounded-xl bg-black/40">
          <div className="text-[8px] tracking-widest text-[#4ade80]/60 uppercase mb-3" style={PS2}>
            Your Hand — {myHand.length} cards
            {gs.current_turn_seat === mySeatNumber && <span className="ml-3 text-[#FFD700]">▶ YOUR TURN</span>}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {myHand.map((card, i) => (
              <button
                key={card.id || i}
                onClick={() => playCard(card)}
                disabled={gs.current_turn_seat !== mySeatNumber || !isPlaying}
                className={`w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-center font-heading text-sm transition-all hover:scale-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg ${
                  card.suit === '♠' || card.suit === '♣' ? 'text-gray-900' : 'text-red-600'
                }`}
                style={{
                  background: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
                  borderColor: gs.current_turn_seat === mySeatNumber && isPlaying ? '#4ade80' : '#d1d5db',
                  boxShadow: gs.current_turn_seat === mySeatNumber && isPlaying ? '0 0 10px rgba(74,222,128,0.4)' : 'none',
                }}
              >
                <span className="text-lg leading-none">{card.suit}</span>
                <span className="text-xs leading-none mt-0.5">{card.value}</span>
              </button>
            ))}
          </div>
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