import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { VIRAL_AI_CHARACTERS } from '@/data/viralAI';
import { generateBoard } from '@/data/viralBoardData';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function ViralHostPanel({ room, updateState }) {
  const [players, setPlayers] = useState(room?.game_state?.players || []);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [manualAdjustment, setManualAdjustment] = useState({ field: 'followers', value: 0 });

  useEffect(() => {
    if (room?.game_state?.players) {
      setPlayers(room.game_state.players);
    }
  }, [room?.game_state?.players]);

  const handleStartGame = async () => {
    const board = generateBoard();
    await updateState({
      board,
      status: 'active',
      running: true,
      currentTurnIndex: 0,
      round: 1,
      turnLog: [],
    });
  };

  const handleRollDice = async () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    const currentPlayer = players[room.game_state.currentTurnIndex];
    
    if (!currentPlayer) return;
    
    const newPosition = Math.min(120, currentPlayer.position + roll);
    const updatedPlayers = players.map((p, i) => 
      i === room.game_state.currentTurnIndex ? { ...p, position: newPosition } : p
    );
    
    await updateState({ 
      players: updatedPlayers,
      lastRoll: roll,
      turnLog: [...(room.game_state.turnLog || []), {
        turnNumber: (room.game_state.turnLog?.length || 0) + 1,
        playerId: currentPlayer.playerCode,
        playerName: currentPlayer.name,
        seat: currentPlayer.seatNumber,
        roll,
        fromSpace: currentPlayer.position,
        toSpace: newPosition,
        timestamp: Date.now(),
      }],
    });
    
    // Auto-advance turn
    const nextIndex = (room.game_state.currentTurnIndex + 1) % Math.max(players.length, 1);
    await updateState({ currentTurnIndex: nextIndex });
  };

  const handleManualAdjustment = async () => {
    if (!selectedPlayer) return;
    
    const updatedPlayers = players.map(p => 
      p.seatNumber === selectedPlayer.seatNumber 
        ? { ...p, [manualAdjustment.field]: parseInt(manualAdjustment.value) || 0 }
        : p
    );
    
    await updateState({ players: updatedPlayers });
    setManualAdjustment({ field: 'followers', value: 0 });
  };

  const handleResetGame = async () => {
    await updateState({
      status: 'waiting',
      players: [],
      board: null,
      currentTurnIndex: 0,
      round: 1,
      turnLog: [],
      winner: null,
    });
  };

  const gs = room?.game_state || {};

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 rounded-full" style={{ background: '#BC13FE', boxShadow: '0 0 8px #BC13FE' }} />
        <h2 className="text-lg font-heading tracking-widest text-[#BC13FE] uppercase">VIRAL! Host Panel</h2>
      </div>

      {/* Game Status */}
      <div className="p-4 rounded-lg border" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(188,19,254,0.3)' }}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-[6px] text-white/40 uppercase mb-1" style={PS2}>Status</div>
            <div className={`text-sm font-bold ${gs.status === 'active' ? 'text-[#4ade80]' : 'text-[#FF5F1F]'}`}>
              {gs.status?.toUpperCase() || 'WAITING'}
            </div>
          </div>
          <div>
            <div className="text-[6px] text-white/40 uppercase mb-1" style={PS2}>Round</div>
            <div className="text-sm font-bold text-white">{gs.round || 1}</div>
          </div>
          <div>
            <div className="text-[6px] text-white/40 uppercase mb-1" style={PS2}>Turn</div>
            <div className="text-sm font-bold text-white">{(gs.currentTurnIndex || 0) + 1} / {players.length}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!gs.running ? (
          <button
            onClick={handleStartGame}
            className="flex-1 py-3 rounded-lg font-heading text-sm tracking-widest uppercase transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #BC13FE40, #BC13FE20)',
              border: '2px solid #BC13FE',
              color: '#BC13FE',
              boxShadow: '0 0 20px rgba(188,19,254,0.3)',
            }}
          >
            ▶ START GAME
          </button>
        ) : (
          <button
            onClick={handleRollDice}
            className="flex-1 py-3 rounded-lg font-heading text-sm tracking-widest uppercase transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #FFD70040, #FFD70020)',
              border: '2px solid #FFD700',
              color: '#FFD700',
              boxShadow: '0 0 20px rgba(255,215,0,0.3)',
            }}
          >
            🎲 ROLL DICE
          </button>
        )}
        
        <button
          onClick={handleResetGame}
          className="px-4 py-3 rounded-lg font-heading text-xs tracking-widest uppercase transition-all"
          style={{
            background: 'transparent',
            border: '1px solid #FF5F1F',
            color: '#FF5F1F',
          }}
        >
          ↺ RESET
        </button>
      </div>

      {/* Players List */}
      <div className="space-y-2">
        <h3 className="text-[8px] tracking-widest text-white/60 uppercase" style={PS2}>Players ({players.length})</h3>
        {players.length === 0 && (
          <div className="text-xs text-white/30 italic">No players yet</div>
        )}
        {players.map((p, i) => (
          <div
            key={p.seatNumber}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedPlayer?.seatNumber === p.seatNumber ? 'border-[#BC13FE] bg-[#BC13FE]10' : 'border-white/10 bg-white/5'}`}
            onClick={() => setSelectedPlayer(p)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ background: p.color || '#BC13FE' }}>
                  {p.seatNumber}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{p.name}</div>
                  <div className="text-[6px] text-white/40 uppercase" style={PS2}>
                    {p.controller === 'ai' ? '🤖 AI' : '👤 Human'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#FFD700]">{(p.followers || 0).toLocaleString()}</div>
                <div className="text-[6px] text-white/40 uppercase" style={PS2}>Followers</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manual Adjustment */}
      {selectedPlayer && (
        <div className="p-4 rounded-lg border" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.1)' }}>
          <h3 className="text-[8px] tracking-widest text-white/60 uppercase mb-3" style={PS2}>
            Manual Adjustment - {selectedPlayer.name}
          </h3>
          <div className="space-y-2">
            <select
              value={manualAdjustment.field}
              onChange={e => setManualAdjustment({ ...manualAdjustment, field: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white text-xs font-body"
              style={{ background: '#07040d', border: '1px solid rgba(188,19,254,0.3)' }}
            >
              <option value="followers">Followers</option>
              <option value="money">Money</option>
              <option value="ssp">SSP</option>
              <option value="position">Position</option>
            </select>
            <input
              type="number"
              value={manualAdjustment.value}
              onChange={e => setManualAdjustment({ ...manualAdjustment, value: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-white text-xs font-body"
              style={{ background: '#07040d', border: '1px solid rgba(188,19,254,0.3)' }}
              placeholder="Value"
            />
            <button
              onClick={handleManualAdjustment}
              className="w-full py-2 rounded-lg font-heading text-xs tracking-widest uppercase"
              style={{
                background: '#BC13FE20',
                border: '1px solid #BC13FE',
                color: '#BC13FE',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Turn Log */}
      {gs.turnLog?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[8px] tracking-widest text-white/60 uppercase" style={PS2}>Recent Turns</h3>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {gs.turnLog.slice(-10).reverse().map((log, i) => (
              <div key={i} className="text-[6px] text-white/40 p-2 rounded bg-white/5">
                <span className="text-white/80">{log.playerName}</span> rolled {log.roll} → Space {log.toSpace}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}