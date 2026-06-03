import React from 'react';
import { Link } from 'react-router-dom';

const GAMES = [
  {
    id: 'bff',
    title: 'BFF',
    subtitle: 'BIGO FAMILY FEUD',
    path: '/games/bff',
  },
  {
    id: 'square-biz',
    title: 'SQUARE BIZ!',
    subtitle: 'TRIVIA + TACTICS',
    path: '/games/square-biz',
  },
  {
    id: 'spades',
    title: 'SPADES',
    subtitle: 'TEXASNOMAD DECK',
    path: '/games/spades',
  },
];

export default function FeaturedGames({ gameImages }) {
  return (
    <section className="relative px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="border border-cyber-purple/40 rounded-lg p-6 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden">
          {/* Section Title */}
          <h3 className="font-heading text-2xl md:text-3xl tracking-[0.15em] text-outlaw-gold text-center mb-6 uppercase">
            ★ FEATURED GAMES ★
          </h3>

          {/* Game Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {GAMES.map((game, i) => (
              <div
                key={game.id}
                className="group flex flex-col items-center p-4 border border-cyber-purple/30 rounded-lg bg-black/60 hover:border-outlaw-gold hover:box-glow-gold transition-all duration-300"
              >
                {/* Game Image */}
                <div className="w-28 h-28 md:w-32 md:h-32 mb-3 rounded overflow-hidden">
                  <img
                    src={gameImages[i]}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Title & Subtitle */}
                <h4 className="font-heading text-xl md:text-2xl tracking-wider text-white uppercase">
                  {game.title}
                </h4>
                <p className="font-body text-xs tracking-widest text-outlaw-gold/80 uppercase mb-3">
                  {game.subtitle}
                </p>

                {/* Play Button */}
                <Link
                  to={game.path}
                  className="px-5 py-1.5 border-2 border-outlaw-gold text-outlaw-gold font-heading text-sm tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black hover:shadow-[0_0_20px_rgba(255,215,0,0.5)] transition-all duration-300 focus-visible:outline-2 focus-visible:outline-kinetic-orange"
                >
                  Play Now
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}