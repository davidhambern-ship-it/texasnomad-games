import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SudokuHostPanel({ gs, updateState, sendCommand, roomCode }) {
  const players = gs.players || [];
  const phase = gs.phase || 'waiting';
  const difficulty = gs.difficulty || 'medium';

  const handleSetDifficulty = (d) => updateState({ difficulty: d });
  const handleStartGame = () => updateState({ phase: 'countdown' });
  const handleReset = () => updateState({ phase: 'waiting', players: [], difficulty });

  const difficultyOptions = ['easy', 'medium', 'hard', 'expert'];

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
          <div>
            <h2 className="font-heading text-2xl tracking-widest text-white uppercase">Sudoku TN</h2>
            <p className="text-[7px] tracking-[0.2em] text-white/30 uppercase" style={PS2}>Host Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg text-[7px] uppercase tracking-widest"
            style={{ ...PS2, background: phase === 'playing' ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${phase === 'playing' ? '#22d3ee' : 'rgba(255,255,255,0.15)'}`, color: phase === 'playing' ? '#22d3ee' : 'rgba(255,255,255,0.4)' }}>
            {phase.toUpperCase()}
          </div>
          {/* Quick controls */}
          {(phase === 'waiting' || phase === 'finished') ? (
            <button onClick={handleStartGame}
              className="px-4 py-2 rounded-lg font-heading text-sm tracking-widest uppercase transition-all hover:scale-105"
              style={{ background: 'rgba(34,211,238,0.15)', border: '2px solid #22d3ee', color: '#22d3ee' }}>
              ▶ START
            </button>
          ) : (
            <button onClick={handleReset}
              className="px-4 py-2 rounded-lg font-heading text-sm tracking-widest uppercase transition-all hover:scale-105"
              style={{ border: '2px solid #ef4444', color: '#ef4444', background: 'transparent' }}>
              ↺ RESET
            </button>
          )}
        </div>
      </div>

      {/* Main layout: game iframe left, controls right */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Embedded game */}
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden"
          style={{ border: '2px solid rgba(34,211,238,0.4)', minHeight: 500 }}>
          <iframe
            src={`/games/sudoku?room=${roomCode}&creator=1`}
            className="w-full h-full"
            style={{ minHeight: 500, border: 'none', background: '#05030b' }}
            title="Sudoku TN"
          />
        </div>

        {/* Right sidebar: settings + players */}
        <div className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto">

          {/* Difficulty */}
          <div className="p-4 rounded-xl space-y-3"
            style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(34,211,238,0.3)' }}>
            <h3 className="text-[8px] tracking-[0.2em] text-[#22d3ee] uppercase" style={PS2}>Difficulty</h3>
            <div className="grid grid-cols-2 gap-2">
              {difficultyOptions.map(d => (
                <button key={d} onClick={() => handleSetDifficulty(d)}
                  className="py-2 rounded-lg font-heading text-xs tracking-widest uppercase transition-all hover:scale-105"
                  style={{
                    border: `2px solid ${difficulty === d ? '#22d3ee' : 'rgba(34,211,238,0.2)'}`,
                    background: difficulty === d ? 'rgba(34,211,238,0.15)' : 'transparent',
                    color: difficulty === d ? '#22d3ee' : 'rgba(255,255,255,0.4)',
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Players */}
          <div className="p-4 rounded-xl space-y-3 flex-1"
            style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <h3 className="text-[8px] tracking-[0.2em] text-[#FFD700] uppercase" style={PS2}>
              Players {players.length > 0 && `(${players.length})`}
            </h3>
            {players.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <span className="text-3xl">🔢</span>
                <span className="text-[7px] text-white/30 uppercase tracking-widest text-center" style={PS2}>Waiting for players…</span>
                <span className="text-[6px] text-white/20 uppercase tracking-widest mt-1" style={PS2}>{roomCode}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {[...players]
                  .sort((a, b) => (b.completed ? 1 : 0) - (a.completed ? 1 : 0))
                  .map((p, i) => (
                  <div key={p.playerId || i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: '#22d3ee30', border: '1px solid #22d3ee60', color: '#22d3ee', fontSize: 9 }}>
                        {p.seatNumber || i + 1}
                      </div>
                      <span className="font-heading text-sm text-white uppercase">{p.playerName || `P${i + 1}`}</span>
                    </div>
                    <div className="text-right">
                      {p.completed ? (
                        <span className="text-[7px] text-[#4ade80]" style={PS2}>✓ DONE</span>
                      ) : p.eliminated ? (
                        <span className="text-[7px] text-red-400" style={PS2}>✗ OUT</span>
                      ) : (
                        <span className="text-[7px] text-[#22d3ee]" style={PS2}>…</span>
                      )}
                      {p.mistakes > 0 && (
                        <div className="text-[6px] text-red-400/70" style={PS2}>{p.mistakes}✗</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Winner */}
          {gs.winner && (
            <div className="p-4 rounded-xl text-center"
              style={{ background: 'linear-gradient(135deg,#07040d,#1a0730)', border: '2px solid rgba(255,215,0,0.6)', boxShadow: '0 0 20px rgba(255,215,0,0.1)' }}>
              <div className="text-3xl mb-1">🏆</div>
              <div className="font-heading text-lg tracking-widest text-[#FFD700] uppercase">{gs.winner.playerName || 'Winner!'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}