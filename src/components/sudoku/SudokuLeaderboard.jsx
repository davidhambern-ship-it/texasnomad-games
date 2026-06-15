import React from 'react';
import { Trophy, Clock, X } from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

function formatTime(ms) {
  if (!ms) return '--:--';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function SudokuLeaderboard({ players, timeStart, phase }) {
  if (!players || players.length === 0) return null;

  const sorted = [...players].sort((a, b) => {
    if (a.completed && b.completed) {
      return (a.completedAt || 0) - (b.completedAt || 0);
    }
    if (a.completed) return -1;
    if (b.completed) return 1;
    if (a.eliminated && !b.eliminated) return 1;
    if (!a.eliminated && b.eliminated) return -1;
    // Sort by progress (filled cells)
    const aFilled = (a.userGrid || []).filter((v, i) => v !== 0 && (a.puzzle || [])[i] === 0).length;
    const bFilled = (b.userGrid || []).filter((v, i) => v !== 0 && (b.puzzle || [])[i] === 0).length;
    return bFilled - aFilled;
  });

  const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(188,19,254,0.3)', background: 'rgba(5,3,11,0.6)' }}
    >
      <div className="px-4 py-2 border-b border-[#BC13FE]/20 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-[#FFD700]" />
        <span style={{ ...PS2, fontSize: 9, color: '#FFD700' }}>LEADERBOARD</span>
      </div>
      <div className="divide-y divide-[#BC13FE]/10">
        {sorted.map((p, rank) => {
          const emptyCells = (p.puzzle || []).filter(v => v === 0).length;
          const filledCells = (p.userGrid || []).filter((v, i) => v !== 0 && (p.puzzle || [])[i] === 0).length;
          const progress = emptyCells > 0 ? Math.round((filledCells / emptyCells) * 100) : 0;
          const timeTaken = p.completed && timeStart
            ? formatTime(p.completedAt - timeStart)
            : null;

          return (
            <div key={p.playerId} className="px-4 py-3 flex items-center gap-3">
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: rank < 3 ? `${RANK_COLORS[rank]}20` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${rank < 3 ? RANK_COLORS[rank] : 'rgba(255,255,255,0.1)'}`,
                  fontSize: 10,
                  color: rank < 3 ? RANK_COLORS[rank] : 'rgba(255,255,255,0.4)',
                  fontFamily: "'Press Start 2P', monospace",
                  flexShrink: 0,
                }}
              >
                {rank + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ ...HEADING, fontSize: 14, color: p.completed ? '#FFD700' : p.eliminated ? '#ef4444' : 'white' }}>
                    {p.playerName || `Seat ${p.seatNumber}`}
                  </span>
                  {p.completed && <span style={{ ...PS2, fontSize: 7, color: '#4ade80' }}>✓ DONE</span>}
                  {p.eliminated && <span style={{ ...PS2, fontSize: 7, color: '#ef4444' }}>✕ OUT</span>}
                </div>
                {!p.completed && !p.eliminated && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          background: 'linear-gradient(90deg,#BC13FE,#FFD700)',
                          transition: 'width 0.5s',
                        }}
                      />
                    </div>
                    <span style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{progress}%</span>
                  </div>
                )}
                {p.mistakes > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {[0,1,2].map(i => (
                      <X key={i} className="w-2.5 h-2.5" style={{ color: i < p.mistakes ? '#ef4444' : 'rgba(255,255,255,0.15)' }} />
                    ))}
                  </div>
                )}
              </div>
              {timeTaken && (
                <div className="flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3 text-[#4ade80]" />
                  <span style={{ ...PS2, fontSize: 8, color: '#4ade80' }}>{timeTaken}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}