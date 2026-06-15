import React from 'react';
import { Link } from 'react-router-dom';

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
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
          <div>
            <h2 className="font-heading text-2xl tracking-widest text-white uppercase">Sudoku TN</h2>
            <p className="text-[7px] tracking-[0.2em] text-white/30 uppercase" style={PS2}>Host Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg text-[7px] uppercase tracking-widest"
            style={{ ...PS2, background: phase === 'playing' ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${phase === 'playing' ? '#22d3ee' : 'rgba(255,255,255,0.15)'}`, color: phase === 'playing' ? '#22d3ee' : 'rgba(255,255,255,0.4)' }}>
            {phase.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Play in-game link */}
      <div className="p-4 rounded-xl flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg,#070d15,#0d1a20)', border: '2px solid rgba(34,211,238,0.4)', boxShadow: '0 0 20px rgba(34,211,238,0.1)' }}>
        <div>
          <div className="font-heading text-lg tracking-widest text-[#22d3ee] uppercase">Play Full Game</div>
          <p className="text-[7px] tracking-widest text-white/40 uppercase mt-0.5" style={PS2}>
            Open the full Sudoku TN game board in a new tab
          </p>
        </div>
        <a
          href={`/games/sudoku?room=${roomCode}&creator=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg,#22d3ee30,#22d3ee15)', border: '2px solid #22d3ee', color: '#22d3ee', boxShadow: '0 0 15px rgba(34,211,238,0.3)' }}>
          ▶ OPEN GAME ↗
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Game Setup */}
        <div className="p-5 rounded-xl space-y-4"
          style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(34,211,238,0.3)' }}>
          <h3 className="text-[8px] tracking-[0.2em] text-[#22d3ee] uppercase" style={PS2}>Game Settings</h3>

          <div className="space-y-2">
            <label className="block text-[7px] tracking-widest text-white/40 uppercase" style={PS2}>Difficulty</label>
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

          <div className="flex flex-col gap-2 pt-2">
            {phase === 'waiting' || phase === 'finished' ? (
              <button onClick={handleStartGame}
                className="w-full py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#22d3ee40,#22d3ee20)', border: '2px solid #22d3ee', color: '#22d3ee', boxShadow: '0 0 20px rgba(34,211,238,0.3)' }}>
                ▶ START GAME
              </button>
            ) : (
              <button onClick={handleReset}
                className="w-full py-3 rounded-xl font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ border: '2px solid #ef4444', color: '#ef4444', background: 'transparent' }}>
                ↺ RESET GAME
              </button>
            )}
          </div>
        </div>

        {/* Players */}
        <div className="p-5 rounded-xl space-y-3"
          style={{ background: 'linear-gradient(135deg,#07040d,#0d0a20)', border: '1px solid rgba(255,215,0,0.2)' }}>
          <h3 className="text-[8px] tracking-[0.2em] text-[#FFD700] uppercase" style={PS2}>
            Players {players.length > 0 && `(${players.length})`}
          </h3>
          {players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <span className="text-3xl">🔢</span>
              <span className="text-[7px] text-white/30 uppercase tracking-widest" style={PS2}>Waiting for players to join…</span>
              <span className="text-[6px] text-white/20 uppercase tracking-widest mt-1" style={PS2}>Share room code: {roomCode}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {[...players]
                .sort((a, b) => (b.completed ? 1 : 0) - (a.completed ? 1 : 0))
                .map((p, i) => (
                <div key={p.playerId || i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: '#22d3ee30', border: '1px solid #22d3ee60', color: '#22d3ee' }}>
                      {p.seatNumber || i + 1}
                    </div>
                    <span className="font-heading text-sm text-white uppercase">{p.playerName || `Player ${i + 1}`}</span>
                  </div>
                  <div className="text-right">
                    {p.completed ? (
                      <span className="text-[7px] text-[#4ade80] uppercase tracking-widest" style={PS2}>✓ DONE</span>
                    ) : p.eliminated ? (
                      <span className="text-[7px] text-red-400 uppercase tracking-widest" style={PS2}>✗ OUT</span>
                    ) : (
                      <span className="text-[7px] text-[#22d3ee] uppercase tracking-widest" style={PS2}>playing…</span>
                    )}
                    {p.mistakes > 0 && (
                      <div className="text-[6px] text-red-400/70 uppercase" style={PS2}>{p.mistakes} mistake{p.mistakes !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Winner display */}
      {gs.winner && (
        <div className="p-5 rounded-xl text-center"
          style={{ background: 'linear-gradient(135deg,#07040d,#1a0730)', border: '2px solid rgba(255,215,0,0.6)', boxShadow: '0 0 30px rgba(255,215,0,0.15)' }}>
          <div className="text-4xl mb-2">🏆</div>
          <div className="font-heading text-2xl tracking-widest text-[#FFD700] uppercase">{gs.winner.playerName || 'Winner!'}</div>
          <div className="text-[7px] text-white/40 uppercase tracking-widest mt-1" style={PS2}>Seat {gs.winner.seatNumber} wins the round!</div>
        </div>
      )}
    </div>
  );
}