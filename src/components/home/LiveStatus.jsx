import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

const GAME_DEFS = [
  { id: 'bff',         name: 'BFF',         subtitle: 'BIGO FAMILY FEUD'  },
  { id: 'square-biz',  name: 'SQUARE BIZ!', subtitle: 'TRIVIA + TACTICS'  },
  { id: 'spades',      name: 'SPADES',      subtitle: 'TEXASNOMAD DECK'   },
  { id: 'word-search', name: 'WORD SEARCH', subtitle: 'NOMADIC WORD HUNT' },
  { id: 'sudoku',      name: 'SUDOKU',      subtitle: 'COMPETITIVE PUZZLE' },
];

export default function LiveStatus() {
  const [playerCounts, setPlayerCounts] = useState({});

  useEffect(() => {
    async function fetchLive() {
      const rooms = await base44.entities.GameRoom.filter({ status: 'active' });
      const counts = {};
      GAME_DEFS.forEach(g => { counts[g.id] = 0; });
      rooms.forEach(r => {
        if (counts[r.game_id] !== undefined) {
          counts[r.game_id] += r.players_connected || 0;
        }
      });
      setPlayerCounts(counts);
    }
    fetchLive();
    const interval = setInterval(fetchLive, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="border border-cyber-purple/40 rounded-lg p-6 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden">
          <h3 className="font-heading text-2xl md:text-3xl tracking-[0.15em] text-outlaw-gold text-center mb-5 uppercase">
            ★ LIVE STATUS ★
          </h3>

          <div className="space-y-3">
            {GAME_DEFS.map((game) => {
              const players = playerCounts[game.id] ?? 0;
              const isLive = players > 0;
              return (
                <div key={game.id} className="flex items-center justify-between px-4 py-3 border border-cyber-purple/20 rounded bg-black/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${isLive ? 'bg-kinetic-orange animate-pulse-glow' : 'bg-white/20'}`} />
                    <div>
                      <span className="font-heading text-lg tracking-wider text-white uppercase">{game.name}</span>
                      <span className="block text-[10px] tracking-widest text-white/50 uppercase">{game.subtitle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-heading text-2xl text-outlaw-gold">{players}</span>
                      <span className="block text-[10px] tracking-widest text-white/50 uppercase">PLAYERS</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded font-heading text-xs tracking-wider ${isLive ? 'bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple animate-pulse-glow' : 'bg-white/5 border border-white/10 text-white/20'}`}>
                      {isLive ? 'LIVE' : 'IDLE'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 text-center">
            <Link to="/live-status" className="inline-block px-6 py-2 border-2 border-outlaw-gold/60 text-outlaw-gold font-heading text-sm tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black hover:shadow-[0_0_20px_rgba(255,215,0,0.5)] transition-all duration-300">
              VIEW ALL LIVE GAMES
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}