import React from 'react';
import { Link } from 'react-router-dom';

const GAME_INFO = {
  bff: { title: 'BFF — BIGO Family Feud', color: 'text-kinetic-orange' },
  'square-biz': { title: 'Square Biz! — Trivia + Tactics', color: 'text-cyber-purple' },
  spades: { title: 'Spades — TexasNomad Deck', color: 'text-outlaw-gold' },
};

export default function GamePlaceholder() {
  const urlParams = new URLSearchParams(window.location.search);
  const path = window.location.pathname;
  const gameSlug = path.split('/games/')[1];
  const game = GAME_INFO[gameSlug] || { title: 'Game', color: 'text-white' };

  return (
    <div className="min-h-screen bg-midnight-void flex flex-col items-center justify-center px-4 text-center">
      <h1 className={`font-heading text-5xl md:text-7xl tracking-wider uppercase ${game.color} text-glow-purple`}>
        {game.title}
      </h1>
      <p className="mt-4 text-white/60 font-body text-lg">Coming Soon — Stay Tuned!</p>
      <Link
        to="/"
        className="mt-8 px-6 py-3 border-2 border-outlaw-gold text-outlaw-gold font-heading text-lg tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black transition-all"
      >
        ← Back to Home
      </Link>
    </div>
  );
}