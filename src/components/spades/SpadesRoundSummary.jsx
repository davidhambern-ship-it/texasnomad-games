import React, { useEffect, useState } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * SpadesRoundSummary — shown after each round completes
 * Props:
 *   roundResult: { team1: { bid, books, roundScore, totalScore }, team2: { ... }, handNumber }
 *   onDismiss: () => void — called after auto-dismiss (4s)
 */
export default function SpadesRoundSummary({ roundResult, onDismiss }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!roundResult) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [roundResult]);

  if (!roundResult) return null;

  const { team1, team2, handNumber, team1Name, team2Name } = roundResult;

  const TeamRow = ({ team, name, color }) => (
    <div className="border-2 rounded-xl p-4 space-y-2"
      style={{ borderColor: color + '60', background: color + '08' }}>
      <div className="font-heading text-lg uppercase tracking-widest text-center" style={{ color }}>{name}</div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <div style={{ ...PS2, fontSize: 6, color: '#ffffff40' }} className="uppercase mb-1">Bid</div>
          <div className="font-heading text-xl" style={{ color }}>{team.bid ?? '-'}</div>
        </div>
        <div>
          <div style={{ ...PS2, fontSize: 6, color: '#ffffff40' }} className="uppercase mb-1">Books</div>
          <div className="font-heading text-xl" style={{ color }}>{team.books ?? 0}</div>
        </div>
        <div>
          <div style={{ ...PS2, fontSize: 6, color: '#ffffff40' }} className="uppercase mb-1">Round</div>
          <div className={`font-heading text-xl ${team.roundScore >= 0 ? 'text-[#4ade80]' : 'text-red-400'}`}>
            {team.roundScore >= 0 ? '+' : ''}{team.roundScore}
          </div>
        </div>
        <div>
          <div style={{ ...PS2, fontSize: 6, color: '#ffffff40' }} className="uppercase mb-1">Total</div>
          <div className="font-heading text-2xl text-white">{team.totalScore}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#0a0a1a] to-[#050510] border-4 border-[#FFD700]/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(255,215,0,0.3)' }}>
        <div className="text-center mb-4">
          <div style={{ ...PS2, fontSize: 10, color: '#FFD700' }} className="uppercase tracking-widest">Round Results</div>
          <div style={{ ...PS2, fontSize: 7, color: '#ffffff40' }} className="uppercase mt-1">Hand {handNumber}</div>
        </div>
        <div className="space-y-3">
          <TeamRow team={team1} name={team1Name || 'Team A'} color="#BC13FE" />
          <TeamRow team={team2} name={team2Name || 'Team B'} color="#FF5F1F" />
        </div>
        <div className="mt-4 text-center">
          <div style={{ ...PS2, fontSize: 6, color: '#ffffff30' }} className="uppercase animate-pulse">
            Next hand in {countdown}s…
          </div>
        </div>
      </div>
    </div>
  );
}