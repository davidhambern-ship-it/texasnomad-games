import React, { useState } from 'react';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const TN_TEAM = TEXASNOMAD_CHARACTERS; // all 6

export default function BFFVsAISetup({ onStart, isJoining, onJoin }) {
  const [playerName, setPlayerName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('create'); // 'create' | 'join'

  const handleStart = () => {
    if (!playerName.trim()) { setError('Please enter your player name.'); return; }
    if (!familyName.trim()) { setError('Please enter your family name.'); return; }
    setError('');
    onStart({ playerName: playerName.trim(), familyName: familyName.trim() });
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('Please enter your player name.'); return; }
    if (!joinCode.trim()) { setError('Please enter a room code.'); return; }
    setError('');
    onJoin({ playerName: playerName.trim(), joinCode: joinCode.trim().toUpperCase() });
  };

  return (
    <div className="min-h-screen bg-[#070311] text-white flex flex-col items-center justify-center p-6">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="font-heading text-4xl text-[#FF5F1F] tracking-widest uppercase mb-2"
          style={{ textShadow: '0 0 20px rgba(255,95,31,0.6)' }}>BFF</div>
        <div className="text-[8px] tracking-[0.4em] text-[#FFD700] uppercase" style={PS2}>vs TexasNomad Team</div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl border border-white/10 bg-black/40">
        {['create', 'join'].map(m => (
          <button key={m} onClick={() => { setMode(m); setError(''); }}
            className="px-6 py-2 rounded-lg text-[8px] tracking-widest uppercase transition-all"
            style={{
              ...PS2,
              background: mode === m ? '#FF5F1F' : 'transparent',
              color: mode === m ? '#000' : '#ffffff50',
            }}>
            {m === 'create' ? '🎮 New Game' : '🔗 Join Room'}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Player name — always required */}
        <div>
          <label className="block text-[7px] text-white/40 uppercase tracking-widest mb-1" style={PS2}>Your Name *</label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name…"
            className="w-full px-4 py-3 rounded-xl bg-black/60 border-2 border-[#FF5F1F]/40 text-white font-body text-base focus:outline-none focus:border-[#FF5F1F] transition-colors"
            maxLength={20}
          />
        </div>

        {mode === 'create' && (
          <div>
            <label className="block text-[7px] text-white/40 uppercase tracking-widest mb-1" style={PS2}>Family Name *</label>
            <input
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="Name your family…"
              className="w-full px-4 py-3 rounded-xl bg-black/60 border-2 border-[#BC13FE]/40 text-white font-body text-base focus:outline-none focus:border-[#BC13FE] transition-colors"
              maxLength={20}
            />
          </div>
        )}

        {mode === 'join' && (
          <div>
            <label className="block text-[7px] text-white/40 uppercase tracking-widest mb-1" style={PS2}>Room Code *</label>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE…"
              className="w-full px-4 py-3 rounded-xl bg-black/60 border-2 border-[#22d3ee]/40 text-white font-body text-base focus:outline-none focus:border-[#22d3ee] transition-colors tracking-widest"
              maxLength={8}
            />
          </div>
        )}

        {error && (
          <div className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-[8px] tracking-widest uppercase text-center" style={PS2}>
            {error}
          </div>
        )}

        <button
          onClick={mode === 'create' ? handleStart : handleJoin}
          className="w-full py-4 rounded-xl font-heading text-base tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
          style={{ background: '#FF5F1F', color: '#fff', boxShadow: '0 0 20px rgba(255,95,31,0.4)' }}>
          {mode === 'create' ? '▶ START GAME' : '🔗 JOIN GAME'}
        </button>

        {/* Preview of TexasNomad Team */}
        {mode === 'create' && (
          <div className="mt-6 p-4 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/5">
            <div className="text-[7px] text-[#FFD700]/60 uppercase tracking-widest mb-3 text-center" style={PS2}>
              🤖 You'll face the TexasNomad Team
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {TN_TEAM.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5">
                  <img src={c.avatar} alt={c.name} className="w-5 h-5 rounded" />
                  <span className="text-[7px] text-white/60 uppercase" style={PS2}>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}