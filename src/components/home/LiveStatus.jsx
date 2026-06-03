import React from 'react';
import { Link } from 'react-router-dom';

const LIVE_GAMES = [
  { name: 'BFF', subtitle: 'BIGO FAMILY FEUD', players: 12 },
  { name: 'SQUARE BIZ!', subtitle: 'TRIVIA + TACTICS', players: 8 },
  { name: 'SPADES', subtitle: 'TEXASNOMAD DECK', players: 16 },
];

export default function LiveStatus() {
  return (
    <section className="px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="border border-cyber-purple/40 rounded-lg p-6 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden">
          {/* Title */}
          <h3 className="font-heading text-2xl md:text-3xl tracking-[0.15em] text-outlaw-gold text-center mb-5 uppercase">
            ★ LIVE STATUS ★
          </h3>

          {/* Game Rows */}
          <div className="space-y-3">
            {LIVE_GAMES.map((game) => (
              <div
                key={game.name}
                className="flex items-center justify-between px-4 py-3 border border-cyber-purple/20 rounded bg-black/50"
              >
                <div className="flex items-center gap-3">
                  {/* Pulse dot */}
                  <div className="w-3 h-3 rounded-full bg-kinetic-orange animate-pulse-glow shrink-0" />
                  <div>
                    <span className="font-heading text-lg tracking-wider text-white uppercase">{game.name}</span>
                    <span className="block text-[10px] tracking-widest text-white/50 uppercase">{game.subtitle}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-heading text-2xl text-outlaw-gold">{game.players}</span>
                    <span className="block text-[10px] tracking-widest text-white/50 uppercase">PLAYERS</span>
                  </div>
                  <span className="px-2 py-0.5 bg-cyber-purple/20 border border-cyber-purple/50 rounded text-cyber-purple font-heading text-xs tracking-wider animate-pulse-glow">
                    LIVE
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* View All Button */}
          <div className="mt-5 text-center">
            <Link
              to="/live-status"
              className="inline-block px-6 py-2 border-2 border-outlaw-gold/60 text-outlaw-gold font-heading text-sm tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black hover:shadow-[0_0_20px_rgba(255,215,0,0.5)] transition-all duration-300"
            >
              VIEW ALL LIVE GAMES
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}