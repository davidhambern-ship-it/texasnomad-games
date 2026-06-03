import React from 'react';

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

export default function HostGameSelect({ onSelect }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <h2 className="font-heading text-2xl md:text-3xl tracking-[0.2em] text-[#FFD700] uppercase mb-2">
        Select Game
      </h2>
      <p className="font-heading text-xs tracking-[0.2em] text-white/40 uppercase mb-10">
        Choose a game to host
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-2xl">
        {ALL_GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => onSelect(game)}
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
              className="font-heading text-2xl tracking-widest uppercase"
              style={{ color: game.color, textShadow: `0 0 15px ${game.color}60` }}
            >
              {game.title}
            </span>
            <span className="font-heading text-[10px] tracking-[0.25em] text-white/50 uppercase mt-1">
              {game.subtitle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}