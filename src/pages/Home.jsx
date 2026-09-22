import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { tngApi } from '@/api/tngApi';
import { TNG_ORIGIN_STORY } from '@/content/tngOriginStory';
import Header from '../components/home/Header';
import Hero from '../components/home/Hero';
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

const FEATURED = [
  { id: 'bff', title: 'BFF', subtitle: 'BIGO FAMILY FEUD' },
  { id: 'square-biz', title: 'SQUARE BIZ!', subtitle: 'TRIVIA + TACTICS' },
  { id: 'hangman', title: 'HANGMAN', subtitle: 'GUESS THE WORD' },
];

const GAME_NAME_MAP = {
  bff: 'BFF',
  'square-biz': 'SQUARE BIZ!',
  spades: 'SPADES',
  'word-search': 'WORD SEARCH',
  hangman: 'HANGMAN',
  sudoku: 'SUDOKU',
  viral: 'VIRAL!',
  'name-that-track': 'NAME THAT TRACK',
};

const GAME_SUB_MAP = {
  bff: 'FAMILY FEUD',
  'square-biz': 'TRIVIA + TACTICS',
  spades: 'CARD GAME',
  'word-search': 'WORD HUNT',
  hangman: 'WORD GUESS',
  sudoku: 'PUZZLE',
  viral: 'BOARD GAME',
  'name-that-track': 'MUSIC',
};


export default function Home() {
  const [featuredGame, setFeaturedGame] = useState(null);

  return (
    <div className="min-h-screen bg-midnight-void text-white">
      <Header />
      <Hero heroBg={HERO_BG} crownLogo={CROWN_LOGO} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <FeaturedGamesInline
            gameImages={GAME_IMAGES}
            onSelect={setFeaturedGame}
          />
          <JoinGameInline />
          <LiveStatusInline />
        </div>
      </div>

      <div className="mt-8">
        <AboutSection aboutBg={ABOUT_BG} />
      </div>

      <Footer />

      {featuredGame && (
        <FeaturedJoinModal
          game={featuredGame}
          onClose={() => setFeaturedGame(null)}
        />
      )}
    </div>
  );
}

function FeaturedGamesInline({ gameImages, onSelect }) {
  return (
    <div className="border border-cyber-purple/40 rounded-lg p-4 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden lg:h-[340px]">
      <h3 className="text-sm md:text-base tracking-[0.1em] text-outlaw-gold text-center mb-4 uppercase" style={{ fontFamily: "'Monoton', cursive" }}>
        FEATURED GAMES
      </h3>

      <div className="grid grid-cols-3 gap-2">
        {FEATURED.map((game, i) => (
          <button
            key={game.id}
            type="button"
            onClick={() => onSelect(game)}
            className="group flex flex-col items-center p-2 border border-cyber-purple/20 rounded bg-black/60 hover:border-outlaw-gold hover:box-glow-gold transition-all duration-300"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 mb-2 rounded overflow-hidden">
              <img
                src={gameImages[i]}
                alt={game.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <span className="text-[8px] md:text-[9px] tracking-wider text-white uppercase text-center leading-tight" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {game.title}
            </span>
            <span className="text-[6px] tracking-widest text-outlaw-gold/70 uppercase text-center mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {game.subtitle}
            </span>
            <span className="mt-2 px-2 py-1 border border-outlaw-gold text-outlaw-gold text-[6px] tracking-widest uppercase rounded group-hover:bg-outlaw-gold group-hover:text-black transition-all" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              JOIN LIVE
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeaturedJoinModal({ game, onClose }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  const join = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Drop the room code in first.');
      return;
    }
    window.location.href = `/join/${code}`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={onClose}>
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-cyber-purple/60 bg-[#08030f] p-6 text-center shadow-[0_0_55px_rgba(188,19,254,.24)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 h-9 w-9 rounded-full border border-white/15 text-white/45 hover:border-white/40 hover:text-white"
        >
          ×
        </button>

        <div className="text-[8px] tracking-[.28em] text-kinetic-orange uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          FEATURED GAME
        </div>
        <h2 className="mt-3 text-3xl text-outlaw-gold uppercase" style={{ fontFamily: "'Rye', serif" }}>
          {game.title}
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Got a live room code? Jump in. Looking for something else? Hit the arcade.
        </p>

        <input
          value={roomCode}
          onChange={(event) => {
            setRoomCode(event.target.value.toUpperCase());
            setError('');
          }}
          onKeyDown={(event) => event.key === 'Enter' && join()}
          maxLength={8}
          placeholder="ROOM ID"
          className="mt-5 w-full rounded-xl border-2 border-cyber-purple/40 bg-black/65 px-4 py-4 text-center font-mono text-xl tracking-[.25em] text-white outline-none focus:border-outlaw-gold"
          autoFocus
        />

        {error && <div className="mt-2 text-xs text-kinetic-orange">{error}</div>}

        <button
          type="button"
          onClick={join}
          className="mt-4 w-full rounded-xl border-2 border-kinetic-orange bg-kinetic-orange/10 px-4 py-3 text-xs tracking-widest text-kinetic-orange uppercase hover:bg-kinetic-orange hover:text-black"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          JOIN LIVE ROOM
        </button>

        <Link
          to="/games"
          onClick={onClose}
          className="mt-2 block w-full rounded-xl border border-outlaw-gold/45 px-4 py-3 text-[8px] tracking-widest text-outlaw-gold uppercase hover:bg-outlaw-gold/10"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          BROWSE ALL GAMES →
        </Link>
      </div>
    </div>
  );
}

function JoinGameInline() {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

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
    <div className="border border-cyber-purple/40 rounded-lg p-4 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden lg:h-[340px] flex flex-col items-center justify-center">
      <h3 className="text-sm md:text-base tracking-[0.1em] text-outlaw-gold text-center mb-3 uppercase" style={{ fontFamily: "'Monoton', cursive" }}>
        JOIN LIVE
      </h3>
      <p className="text-[8px] tracking-widest text-white/60 uppercase mb-3" style={{ fontFamily: "'Press Start 2P', monospace" }}>
        ENTER ROOM CODE
      </p>
      <input
        type="text"
        value={roomCode}
        onChange={(event) => {
          setRoomCode(event.target.value.toUpperCase());
          if (error) setError(false);
        }}
        onKeyDown={(event) => event.key === 'Enter' && handleJoin()}
        placeholder="EX: TN817"
        maxLength={8}
        className={`w-full max-w-[200px] px-3 py-2.5 rounded bg-black/80 border-2 text-center font-mono text-base tracking-widest text-white placeholder:text-white/30 focus:outline-none focus:border-outlaw-gold transition-colors ${error ? 'border-kinetic-orange' : 'border-cyber-purple/50'} ${shaking ? 'animate-shake' : ''}`}
      />
      {error && <p className="text-kinetic-orange text-xs mt-1.5">Enter a room code to join!</p>}
      <button
        type="button"
        onClick={handleJoin}
        className="mt-4 px-6 py-2.5 border-2 border-kinetic-orange text-kinetic-orange text-xs tracking-widest uppercase rounded hover:bg-kinetic-orange hover:text-black hover:shadow-[0_0_20px_rgba(255,95,31,0.5)] transition-all duration-300"
        style={{ fontFamily: "'Press Start 2P', monospace" }}
      >
        JOIN GAME
      </button>
      <p className="mt-3 text-[7px] text-outlaw-gold/50 tracking-widest" style={{ fontFamily: "'Press Start 2P', monospace" }}>
        ★ BE PART OF THE ACTION ★
      </p>
    </div>
  );
}

function RoomRow({ room }) {
  const isLive = room.status === 'live';
  const statusLabel = room.status === 'lobby' ? 'OPEN' : room.status === 'paused' ? 'PAUSED' : 'LIVE';

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border border-cyber-purple/20 rounded bg-black/50 mb-2 shrink-0 text-left cursor-default">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLive ? 'bg-kinetic-orange animate-pulse-glow' : 'bg-outlaw-gold/60'}`} />
        <div className="min-w-0">
          <span className="block truncate text-[8px] tracking-wider text-white uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            {GAME_NAME_MAP[room.gameId] || room.gameId}
          </span>
          <span className="block text-[6px] tracking-widest text-white/30 uppercase mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            {GAME_SUB_MAP[room.gameId] || 'TNG'} · {room.roomCode}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <span className="text-base text-outlaw-gold" style={{ fontFamily: "'Monoton', cursive" }}>{room.players || 0}</span>
          <span className="block text-[5px] tracking-widest text-white/30 uppercase mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>PLR</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[6px] tracking-wider border ${isLive ? 'bg-cyber-purple/20 border-cyber-purple/50 text-cyber-purple' : 'bg-outlaw-gold/5 border-outlaw-gold/25 text-outlaw-gold/65'}`} style={{ fontFamily: "'Press Start 2P', monospace" }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function LiveStatusInline() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLive() {
      try {
        const payload = await tngApi.public.liveRooms();
        if (!cancelled) setRooms(Array.isArray(payload.rooms) ? payload.rooms : []);
      } catch {
        if (!cancelled) setRooms([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLive();
    const interval = window.setInterval(fetchLive, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const storyText = TNG_ORIGIN_STORY
    .map((block) => block.text?.trim())
    .filter(Boolean)
    .join('\n\n');

  const crawlDuration = Math.max(85, Math.ceil(storyText.length / 24));

  return (
    <div className="border border-cyber-purple/40 rounded-lg p-4 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden lg:h-[340px] flex flex-col cursor-default">
      <style>{`
        @keyframes tng-story-crawl {
          0% {
            transform: rotateX(20deg) translateY(92%);
          }
          100% {
            transform: rotateX(20deg) translateY(-115%);
          }
        }

        .tng-story-crawl-stage {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          perspective: 560px;
        }

        .tng-story-crawl {
          width: 88%;
          max-width: 540px;
          margin: 0 auto;
          padding-top: 72%;
          white-space: pre-line;
          text-align: center;
          color: rgba(255, 204, 0, 0.9);
          font-size: 12px;
          line-height: 1.9;
          letter-spacing: 0.025em;
          transform-origin: 50% 100%;
          animation: tng-story-crawl ${crawlDuration}s linear infinite;
          text-shadow: 0 0 8px rgba(255, 156, 0, 0.14);
          will-change: transform;
        }

        .tng-story-crawl-heading {
          display: block;
          margin-bottom: 20px;
          color: rgba(255, 95, 31, 0.95);
          font-size: 14px;
          line-height: 1.65;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .tng-story-crawl-title {
          display: block;
          margin-bottom: 28px;
          color: rgba(255, 214, 46, 1);
          font-size: 16px;
          line-height: 1.6;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .tng-story-fade-top {
          position: absolute;
          inset: 0 0 auto;
          z-index: 4;
          height: 28%;
          pointer-events: none;
          background: linear-gradient(
            to bottom,
            #07030d 0%,
            rgba(7, 3, 13, 0.92) 30%,
            rgba(7, 3, 13, 0) 100%
          );
        }

        .tng-story-fade-bottom {
          position: absolute;
          inset: auto 0 0;
          z-index: 4;
          height: 16%;
          pointer-events: none;
          background: linear-gradient(
            to top,
            #07030d 0%,
            rgba(7, 3, 13, 0.72) 38%,
            rgba(7, 3, 13, 0) 100%
          );
        }

        @media (prefers-reduced-motion: reduce) {
          .tng-story-crawl {
            animation-duration: ${crawlDuration * 2}s;
          }
        }
      `}</style>

      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <h3
            className="text-sm tracking-[0.1em] text-outlaw-gold uppercase"
            style={{ fontFamily: "'Monoton', cursive" }}
          >
            LIVE ROOMS
          </h3>
          <div
            className="mt-1 text-[5px] tracking-[.2em] text-white/20 uppercase"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            TNG STORY FEED
          </div>
        </div>

        <span
          className="text-[6px] tracking-widest text-white/30 uppercase"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          {loading ? 'SYNCING…' : `${rooms.length} LIVE`}
        </span>
      </div>

      <div className="tng-story-crawl-stage">
        <div className="tng-story-fade-top" />
        <div className="tng-story-fade-bottom" />

        <div
          className="tng-story-crawl"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          <span className="tng-story-crawl-heading">
            A LONG TIME AGO IN A BROWSER TAB NOT SO FAR AWAY...
          </span>
          <span className="tng-story-crawl-title">
            THE TEXASNOMAD GAMES STORY
          </span>
          {storyText}
        </div>
      </div>

      <div
        className="mt-2 shrink-0 text-center text-[5px] tracking-[.18em] text-white/20 uppercase"
        style={{ fontFamily: "'Press Start 2P', monospace" }}
      >
        PASSIVE FEED · FULL STORY · NO CLICKING REQUIRED
      </div>
    </div>
  );
}

