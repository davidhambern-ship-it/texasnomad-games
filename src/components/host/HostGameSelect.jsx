import React, { useState } from 'react';
import { generateRoomCode } from '@/lib/roomUtils';

// This list is the single source of truth for ALL games on the platform.
// When a new game is added, add it here and it automatically appears in the Host Panel.
export const ALL_GAMES = [
  {
    id: 'bff',
    title: 'BFF',
    subtitle: 'BIGO FAMILY FEUD',
    color: '#BC13FE',
    emoji: '🎤',
    path: '/games/bff',
  },
  {
    id: 'square-biz',
    title: 'SQUARE BIZ!',
    subtitle: 'TRIVIA + TACTICS',
    color: '#FF5F1F',
    emoji: '🎯',
    path: '/games/square-biz',
  },
  {
    id: 'hangman',
    title: 'HANGMAN',
    subtitle: 'GUESS THE WORD',
    color: '#FFD700',
    emoji: '🔤',
    path: '/games/hangman',
  },
];

export default function HostGameSelect({ onSelect, currentGame }) {
  const [pendingGame, setPendingGame] = useState(currentGame || null);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  const handleGameClick = (game) => {
    setPendingGame(game);
    setRoomCode('');
    setError('');
  };

  const handleConnect = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Enter a room code');
      return;
    }
    onSelect(pendingGame, code);
  };

  const handleGenerateCode = () => {
    setRoomCode(generateRoomCode());
    setError('');
  };

  if (pendingGame) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-2">{pendingGame.emoji}</div>
            <h2 className="text-xl tracking-[0.15em] uppercase mb-1" style={{ color: pendingGame.color, fontFamily: "'Press Start 2P', monospace", textShadow: `0 0 15px ${pendingGame.color}` }}>
              {pendingGame.title}
            </h2>
            <p className="text-[8px] tracking-[0.2em] text-white/40 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>{pendingGame.subtitle}</p>
          </div>

          <div className="p-6 border border-white/10 rounded-xl bg-black/60 space-y-4">
            <label className="block text-[9px] tracking-widest text-white/50 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>Room Code</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-black/80 border-2 border-white/20 text-white font-mono text-2xl tracking-[0.3em] uppercase text-center focus:outline-none transition-colors"
              style={{ borderColor: error ? '#ef4444' : roomCode ? pendingGame.color : undefined }}
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="TN···"
              maxLength={8}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              autoFocus
            />
            {error && <p className="font-heading text-xs text-red-400 tracking-widest uppercase">{error}</p>}

            <button
              onClick={handleGenerateCode}
              className="w-full py-2 border border-white/20 rounded-lg text-[8px] tracking-[0.2em] text-white/50 uppercase hover:border-white/40 hover:text-white/70 transition-all" style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              ↻ Generate New Code
            </button>

            <button
              onClick={handleConnect}
              className="w-full py-3 rounded-lg text-[9px] tracking-[0.2em] uppercase transition-all hover:opacity-90 active:scale-95" style={{ fontFamily: "'Press Start 2P', monospace" }}
              style={{ background: pendingGame.color, color: '#000' }}
            >
              Connect to Room
            </button>
          </div>

          <button
            onClick={() => setPendingGame(null)}
            className="w-full text-center text-[8px] tracking-widest text-white/30 uppercase hover:text-white/60 transition-all" style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            ← Back to Game Select
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <h2 className="text-2xl md:text-3xl tracking-[0.15em] text-[#FFD700] uppercase mb-2" style={{ fontFamily: "'Monoton', cursive", textShadow: '0 0 15px #FFD700' }}>
        Select Game
      </h2>
      <p className="text-[9px] tracking-[0.2em] text-white/40 uppercase mb-10" style={{ fontFamily: "'Press Start 2P', monospace" }}>
        Choose a game to host
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-2xl">
        {ALL_GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => handleGameClick(game)}
            className="group flex flex-col items-center p-6 border-2 rounded-xl bg-black/60 hover:scale-105 transition-all duration-200 focus:outline-none"
            style={{
              borderColor: `${game.color}40`,
              boxShadow: `0 0 0 0 ${game.color}00`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = game.color;
              e.currentTarget.style.boxShadow = `0 0 25px ${game.color}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${game.color}40`;
              e.currentTarget.style.boxShadow = `0 0 0 0 ${game.color}00`;
            }}
          >
            <span className="text-5xl mb-3">{game.emoji}</span>
            <span
              className="text-xl tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}
              style={{ color: game.color, textShadow: `0 0 15px ${game.color}60` }}
            >
              {game.title}
            </span>
            <span className="text-[8px] tracking-[0.2em] text-white/50 uppercase mt-1" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {game.subtitle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}