import React, { useState } from 'react';
import { createRoomAndJoin } from '@/lib/roomUtils';
import { base44 } from '@/api/base44Client';
import Header from '../components/home/Header';
import Hero from '../components/home/Hero';
import FeaturedGames from '../components/home/FeaturedGames';
import JoinGame from '../components/home/JoinGame';
import LiveStatus from '../components/home/LiveStatus';
import AboutSection from '../components/home/AboutSection';
import Footer from '../components/home/Footer';

const HERO_BG = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/b3513c9bc_generated_6e198e91.png';
const CROWN_LOGO = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png';
const ABOUT_BG = 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/301dda749_generated_b80b5902.png';

const GAME_IMAGES = [
  'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/c270ce064_generated_c7b46bf7.png',
  'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/f6b3e81c0_generated_32748b6c.png',
  'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/b32b97429_generated_image.png',
];

export default function Home() {
  return (
    <div className="min-h-screen bg-midnight-void text-white">
      <Header />
      <Hero heroBg={HERO_BG} crownLogo={CROWN_LOGO} />

      {/* Three-column panel: Featured | Join | Live Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Featured Games - takes full width on mobile, 1 col on desktop */}
          <div className="lg:col-span-1">
            <FeaturedGamesInline gameImages={GAME_IMAGES} />
          </div>
          <div className="lg:col-span-1">
            <JoinGameInline />
          </div>
          <div className="lg:col-span-1">
            <LiveStatusInline />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <AboutSection aboutBg={ABOUT_BG} />
      </div>

      <Footer />
    </div>
  );
}

/* Inline versions without the max-w wrapper for grid layout */
function FeaturedGamesInline({ gameImages }) {
  return (
    <div className="border border-cyber-purple/40 rounded-lg p-4 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden h-full">
      <h3 className="text-sm md:text-base tracking-[0.1em] text-outlaw-gold text-center mb-4 uppercase" style={{ fontFamily: "'Monoton', cursive" }}>
        FEATURED GAMES
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'bff', title: 'BFF', subtitle: 'BIGO FAMILY FEUD' },
          { id: 'square-biz', title: 'SQUARE BIZ!', subtitle: 'TRIVIA + TACTICS' },
          { id: 'hangman', title: 'HANGMAN', subtitle: 'GUESS THE WORD' },
        ].map((game, i) => (
          <button
            key={game.id}
            onClick={() => createRoomAndJoin(game.id)}
            className="group flex flex-col items-center p-2 border border-cyber-purple/20 rounded bg-black/60 hover:border-outlaw-gold hover:box-glow-gold transition-all duration-300"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 mb-2 rounded overflow-hidden">
              <img src={gameImages[i]} alt={game.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-[8px] md:text-[9px] tracking-wider text-white uppercase text-center leading-tight" style={{ fontFamily: "'Press Start 2P', monospace" }}>{game.title}</span>
            <span className="text-[6px] tracking-widest text-outlaw-gold/70 uppercase text-center mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>{game.subtitle}</span>
            <span className="mt-2 px-2 py-1 border border-outlaw-gold text-outlaw-gold text-[6px] tracking-widest uppercase rounded group-hover:bg-outlaw-gold group-hover:text-black transition-all" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              Create Room
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function JoinGameInline() {
  const [roomCode, setRoomCode] = React.useState('');
  const [error, setError] = React.useState(false);
  const [shaking, setShaking] = React.useState(false);

  const handleJoin = () => {
    if (!roomCode.trim()) {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }
    setError(false);
    window.location.href = `/join/${roomCode.trim().toUpperCase()}`;
  };

  return (
    <div className="border border-cyber-purple/40 rounded-lg p-4 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden h-full flex flex-col items-center justify-center">
      <h3 className="text-sm md:text-base tracking-[0.1em] text-outlaw-gold text-center mb-3 uppercase" style={{ fontFamily: "'Monoton', cursive" }}>
        JOIN LIVE
      </h3>
      <p className="text-[8px] tracking-widest text-white/60 uppercase mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>ENTER ROOM CODE</p>
      <input
        type="text"
        value={roomCode}
        onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); if (error) setError(false); }}
        placeholder="EX: TN817"
        className={`w-full max-w-[200px] px-3 py-2.5 rounded bg-black/80 border-2 text-center font-mono text-base tracking-widest text-white placeholder:text-white/30 focus:outline-none focus:border-outlaw-gold transition-colors ${
          error ? 'border-kinetic-orange' : 'border-cyber-purple/50'
        } ${shaking ? 'animate-shake' : ''}`}
      />
      {error && <p className="text-kinetic-orange text-xs mt-1.5">Enter a room code to join!</p>}
      <button
        onClick={handleJoin}
        className="mt-4 px-6 py-2.5 border-2 border-kinetic-orange text-kinetic-orange text-xs tracking-widest uppercase rounded hover:bg-kinetic-orange hover:text-black hover:shadow-[0_0_20px_rgba(255,95,31,0.5)] transition-all duration-300"
        style={{ fontFamily: "'Press Start 2P', monospace" }}
      >
        JOIN GAME
      </button>
      <p className="mt-3 text-[7px] text-outlaw-gold/50 tracking-widest" style={{ fontFamily: "'Press Start 2P', monospace" }}>★ BE PART OF THE ACTION ★</p>
    </div>
  );
}

const GAME_DEFS_INLINE = [
  { id: 'bff',         name: 'BFF',         subtitle: 'BIGO FAMILY FEUD'  },
  { id: 'square-biz',  name: 'SQUARE BIZ!', subtitle: 'TRIVIA + TACTICS'  },
  { id: 'spades',      name: 'SPADES',      subtitle: 'TEXASNOMAD DECK'   },
];

function LiveStatusInline() {
  const [playerCounts, setPlayerCounts] = React.useState({});

  React.useEffect(() => {
    async function fetchLive() {
      const rooms = await base44.entities.GameRoom.filter({ status: 'active' });
      const counts = {};
      GAME_DEFS_INLINE.forEach(g => { counts[g.id] = 0; });
      rooms.forEach(r => {
        if (counts[r.game_id] !== undefined) counts[r.game_id] += r.players_connected || 0;
      });
      setPlayerCounts(counts);
    }
    fetchLive();
    const interval = setInterval(fetchLive, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-cyber-purple/40 rounded-lg p-4 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden h-full">
      <h3 className="text-sm md:text-base tracking-[0.1em] text-outlaw-gold text-center mb-4 uppercase" style={{ fontFamily: "'Monoton', cursive" }}>
        LIVE STATUS
      </h3>
      <div className="space-y-2">
        {GAME_DEFS_INLINE.map((game) => {
          const players = playerCounts[game.id] ?? 0;
          const isLive = players > 0;
          return (
            <div key={game.id} className="flex items-center justify-between px-3 py-2 border border-cyber-purple/20 rounded bg-black/50">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLive ? 'bg-kinetic-orange animate-pulse-glow' : 'bg-white/20'}`} />
                <div>
                  <span className="text-[9px] tracking-wider text-white uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>{game.name}</span>
                  <span className="block text-[7px] tracking-widest text-white/40 uppercase mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>{game.subtitle}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-lg text-outlaw-gold" style={{ fontFamily: "'Monoton', cursive" }}>{players}</span>
                  <span className="block text-[6px] tracking-widest text-white/40 uppercase mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>PLAYERS</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[7px] tracking-wider ${isLive ? 'bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple animate-pulse-glow' : 'bg-white/5 border border-white/10 text-white/20'}`} style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  {isLive ? 'LIVE' : 'IDLE'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <a href="/live-status" className="inline-block px-4 py-1.5 border border-outlaw-gold/60 text-outlaw-gold text-[7px] tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black transition-all" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          VIEW ALL LIVE GAMES
        </a>
      </div>
    </div>
  );
}