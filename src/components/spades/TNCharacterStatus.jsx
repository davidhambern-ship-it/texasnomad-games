import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * Derives the AI status label from game state context.
 * status: 'ready' | 'thinking' | 'confident' | 'pressured' | 'frustrated' | 'locked_in' | 'celebrating'
 */
export function getAIStatus(player, gs) {
  if (!player || player.playerType !== 'cpu') return null;
  const seatNumber = player.seatNumber;

  // Currently thinking (their turn)
  if (gs.current_turn_seat === seatNumber && gs.phase === 'playing') return 'thinking';

  const myTeam = [1, 3].includes(seatNumber) ? 1 : 2;
  const oppTeam = myTeam === 1 ? 2 : 1;
  const myScore = gs[`score${myTeam}`] || 0;
  const oppScore = gs[`score${oppTeam}`] || 0;
  const myBooks = gs[`books${myTeam}`] || 0;
  const myBid = gs[`bid${myTeam}`] || 0;
  const diff = myScore - oppScore;

  if (gs.phase !== 'playing') return 'ready';

  // Winning by 100+
  if (diff >= 100) return 'confident';
  // Losing by 100+
  if (diff <= -100) return 'pressured';
  // Close game (within 50)
  if (Math.abs(diff) <= 50 && gs.tricks_played > 6) return 'locked_in';
  // Missed bid severely (3+ books short)
  if (myBid > 0 && myBooks < myBid - 2 && gs.tricks_played > 8) return 'frustrated';
  // Just won a trick (last trick winner was this seat)
  if (gs.current_turn_seat === seatNumber && gs.tricks_played > 0) return 'celebrating';

  return 'ready';
}

const STATUS_CONFIG = {
  ready:       { label: 'Ready',      color: '#4ade80', bg: '#4ade8015', dot: '#4ade80' },
  thinking:    { label: 'Thinking…',  color: '#FFD700', bg: '#FFD70015', dot: '#FFD700', pulse: true },
  confident:   { label: 'Confident',  color: '#BC13FE', bg: '#BC13FE15', dot: '#BC13FE' },
  pressured:   { label: 'Pressured',  color: '#FF5F1F', bg: '#FF5F1F15', dot: '#FF5F1F' },
  frustrated:  { label: 'Frustrated', color: '#ef4444', bg: '#ef444415', dot: '#ef4444' },
  locked_in:   { label: 'Locked In',  color: '#22d3ee', bg: '#22d3ee15', dot: '#22d3ee', pulse: true },
  celebrating: { label: '🎉 Nice!',   color: '#FFD700', bg: '#FFD70015', dot: '#FFD700' },
};

export default function TNCharacterStatus({ status }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ready;
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border"
      style={{ borderColor: `${cfg.color}40`, background: cfg.bg }}>
      <div className={`w-1.5 h-1.5 rounded-full ${cfg.pulse ? 'animate-pulse' : ''}`}
        style={{ background: cfg.dot }} />
      <span className="text-[6px] tracking-widest uppercase" style={{ ...PS2, color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}