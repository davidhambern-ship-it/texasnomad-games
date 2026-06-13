import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/home/Header';
import { base44 } from '@/api/base44Client';
import SpadesCabinetImage from '@/components/games/SpadesCabinetImage';
import CPUOpponentSelect from '@/components/cpu/CPUOpponentSelect';

// ── Particle System ──────────────────────────────────────────────────────────
function Particles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: -Math.random() * 0.4 - 0.1,
      opacity: Math.random() * 0.6 + 0.2,
      color: Math.random() > 0.5 ? '#BC13FE' : Math.random() > 0.5 ? '#FF5F1F' : '#FFD700',
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Marquee Strip ────────────────────────────────────────────────────────────
function MarqueeStrip({ text, color = '#BC13FE', speed = 20 }) {
  const repeated = Array(8).fill(text).join('  ✦  ');
  return (
    <div className="overflow-hidden w-full py-1" style={{ background: `${color}20`, borderTop: `1px solid ${color}40`, borderBottom: `1px solid ${color}40` }}>
      <div className="flex whitespace-nowrap" style={{ animation: `marquee-scroll ${speed}s linear infinite` }}>
        <span className="text-[7px] tracking-[0.25em] uppercase" style={{ fontFamily: "'Press Start 2P', monospace", color: '#ffffff', textShadow: `0 0 8px ${color}` }}>
          {repeated}&nbsp;&nbsp;&nbsp;{repeated}
        </span>
      </div>
    </div>
  );
}

// ── Neon Sign ────────────────────────────────────────────────────────────────
function NeonSign({ text, color = '#BC13FE', size = 'md' }) {
  const [flicker, setFlicker] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.08) {
        setFlicker(true);
        setTimeout(() => setFlicker(false), 80 + Math.random() * 120);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const fs = size === 'lg' ? '2.5rem' : size === 'sm' ? '0.9rem' : '1.4rem';
  return (
    <div style={{
      fontFamily: "'Rye', serif",
      fontSize: fs,
      color: flicker ? 'transparent' : color,
      textShadow: flicker ? 'none' : `0 0 10px ${color}, 0 0 25px ${color}, 0 0 50px ${color}80`,
      transition: 'all 0.05s',
      letterSpacing: '0.08em',
    }}>
      {text}
    </div>
  );
}

// ── Arcade Cabinet ───────────────────────────────────────────────────────────
function ArcadeCabinet({ game, featured = false, onCreateRoom, onJoinRoom, onSinglePlayer, creating, roomCode, setRoomCode }) {
  const [hovered, setHovered] = useState(false);
  const [joining, setJoining] = useState(false);

  const glowColor = game.color;
  const glowColor2 = game.color2 || game.color;

  const handleJoin = () => {
    if (!roomCode || !String(roomCode).trim()) return;
    setJoining(true);
    onJoinRoom(game.id, roomCode);
    setTimeout(() => setJoining(false), 2000);
  };

  return (
    <div
      className="relative flex flex-col select-none transition-all duration-300"
      style={{
        transform: hovered ? 'scale(1.03) translateY(-6px)' : 'scale(1)',
        filter: hovered ? `drop-shadow(0 0 30px ${glowColor}80)` : `drop-shadow(0 0 8px ${glowColor}30)`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >

      {/* Cabinet Body */}
      <div className="relative rounded-t-3xl rounded-b-xl overflow-hidden border-2 scanline-overlay"
      style={{
        borderColor: hovered ? glowColor : `${glowColor}50`,
        background: `linear-gradient(180deg, #050208 0%, #020106 100%)`,
          boxShadow: hovered
            ? `0 0 40px ${glowColor}60, inset 0 0 30px ${glowColor}10`
            : `0 0 15px ${glowColor}20, inset 0 0 10px ${glowColor}05`,
          minWidth: featured ? 320 : 280,
          maxWidth: featured ? 380 : 320,
        }}
      >
        {/* Cabinet Top Marquee */}
        <div className="py-2 text-center relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${glowColor}30, ${glowColor2}30)`, borderBottom: `2px solid ${glowColor}50` }}>
          <div className="absolute inset-0 opacity-30"
            style={{ background: `repeating-linear-gradient(90deg, transparent, transparent 8px, ${glowColor}20 8px, ${glowColor}20 9px)` }} />
          <div className="relative tracking-[0.1em] uppercase text-outlaw-gold"
            style={{ fontSize: featured ? '1.6rem' : '1.3rem', fontFamily: "'Rye', serif", textShadow: `0 0 15px #FFD700, 0 0 30px #FFD70060` }}>
            {game.title}
          </div>
          <div className="text-[7px] tracking-[0.3em] uppercase mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace", color: `${glowColor}cc` }}>
            {game.tagline}
          </div>
        </div>

        {/* Animated Marquee Lights */}
        <MarqueeStrip text={game.marqueeText} color={glowColor} speed={featured ? 12 : 18} />

        {/* Screen */}
        <div className="mx-3 my-3 rounded-xl overflow-hidden relative"
        style={{ border: `2px solid ${glowColor}40`, minHeight: featured ? 160 : 130, background: '#020106' }}>
          {/* Scanlines */}
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)' }} />
          {/* Screen content */}
          <div className="absolute inset-0 z-0">
            {game.screenComponent ? (
              game.screenComponent
            ) : game.image ? (
              <img src={game.image} alt={game.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="font-heading text-sm tracking-widest uppercase" style={{ color: glowColor, textShadow: `0 0 10px ${glowColor}` }}>
                  {game.screenText}
                </div>
              </div>
            )}
          </div>
          {/* CRT glow overlay */}
          <div className="absolute inset-0 pointer-events-none rounded-xl"
            style={{ boxShadow: `inset 0 0 30px ${glowColor}20` }} />
        </div>

        {/* Description */}
        <div className="px-4 pb-2">
          <p className="text-white/50 text-xs leading-relaxed font-body text-center">{game.description}</p>
          <div className="flex flex-wrap gap-1 justify-center mt-2">
            {game.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded text-[7px] tracking-widest uppercase"
                style={{ fontFamily: "'Press Start 2P', monospace", background: `${glowColor}15`, color: `${glowColor}cc`, border: `1px solid ${glowColor}40` }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="px-3 pb-3 space-y-2">
          <button
            onClick={() => onCreateRoom(game.id)}
            disabled={creating === game.id}
            className="w-full py-2.5 rounded-lg font-heading text-sm tracking-[0.2em] uppercase transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${glowColor}30, ${glowColor2}20)`,
              border: `2px solid ${glowColor}`,
              color: glowColor,
              boxShadow: hovered ? `0 0 15px ${glowColor}50` : 'none',
              textShadow: `0 0 8px ${glowColor}`,
            }}
          >
            {creating === game.id ? '⚙ CREATING…' : '⚡ CREATE ROOM'}
          </button>

          {/* VS CPU — Single Player */}
          <button
            onClick={() => onSinglePlayer?.(game)}
            className="w-full py-2 rounded-lg font-heading text-xs tracking-[0.15em] uppercase transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'transparent',
              border: `1px solid #FFD70040`,
              color: '#FFD700aa',
            }}
          >
            🤖 VS CPU — Single Player
          </button>

          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-lg text-white text-xs font-body focus:outline-none uppercase tracking-widest placeholder:text-white/20"
              style={{ background: '#0a0510', border: `1px solid ${glowColor}30` }}
              placeholder="ROOM CODE"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={8}
            />
            <button
              onClick={handleJoin}
              disabled={!String(roomCode || '').trim() || joining}
              className="px-3 py-2 rounded-lg font-heading text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
              style={{ background: `${glowColor2}20`, border: `1px solid ${glowColor2}60`, color: glowColor2 }}
            >
              {joining ? '…' : 'JOIN'}
            </button>
          </div>
        </div>

        {/* Cabinet base screws */}
        <div className="flex justify-between px-4 pb-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: `${glowColor}40`, border: `1px solid ${glowColor}60` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Coming Soon Cabinet ──────────────────────────────────────────────────────
function ComingSoonCabinet({ title, emoji, color = '#4a4a6a' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative transition-all duration-300 opacity-60 hover:opacity-80"
      style={{ transform: hovered ? 'scale(1.02)' : 'scale(1)' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="rounded-t-2xl rounded-b-xl overflow-hidden border-2 border-white/10"
        style={{ background: '#080808', minWidth: 200, maxWidth: 240, boxShadow: '0 0 10px rgba(255,255,255,0.03)' }}>
        <div className="py-3 text-center" style={{ background: '#111118', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="font-heading text-lg tracking-widest text-white/30 uppercase">{title}</div>
        </div>
        <div className="mx-3 my-3 rounded-xl overflow-hidden relative" style={{ border: '2px solid rgba(255,255,255,0.08)', minHeight: 110, background: '#020204' }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="text-3xl opacity-30">{emoji}</div>
            <div className="text-[8px] tracking-[0.3em] uppercase text-white/20" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              COMING
            </div>
            <div className="text-[8px] tracking-[0.3em] uppercase text-white/20" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              SOON
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 4px)' }} />
        </div>
        <div className="px-3 pb-3">
          <div className="w-full py-2 rounded-lg text-center text-[7px] tracking-widest uppercase text-white/20 border border-white/10"
            style={{ fontFamily: "'Press Start 2P', monospace" }}>LOCKED</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Games Page ──────────────────────────────────────────────────────────
const GAMES = [
  {
    id: 'square-biz',
    title: 'Square Biz!',
    tagline: 'Trivia Powered Strategy',
    image: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1d89f0420_generated_image.png',
    color: '#BC13FE',
    color2: '#7700cc',
    marqueeText: 'ANSWER TRIVIA • CLAIM THE BOARD • 3 IN A ROW WINS',
    screenText: 'TRIVIA × STRATEGY',
    description: 'Answer trivia questions to earn the right to place an X or O. Get three in a row before your opponent and claim victory.',
    tags: ['1v1', 'Livestream', 'Strategy'],
    path: '/games/square-biz',
    featured: false,
  },
  {
    id: 'bff',
    title: 'BFF',
    tagline: 'Survey Says... You Win?',
    image: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/2b111c7de_BFFCover-2.png',
    color: '#FF5F1F',
    color2: '#FF9A00',
    marqueeText: 'BUZZ IN • ANSWER FAST • STEAL THE BANK • WIN IT ALL',
    screenText: 'SURVEY SHOWDOWN',
    description: 'Uncover the most popular survey answers. Buzz in, build your Round Bank, and pray nobody steals it from you.',
    tags: ['Groups', 'Family', 'Community'],
    path: '/games/bff',
    featured: true,
  },
  {
    id: 'hangman',
    title: 'Hangman',
    tagline: 'Every Letter Counts',
    image: 'https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/2c3663fd0_generated_image.png',
    color: '#22d3ee',
    color2: '#0ea5e9',
    marqueeText: 'GUESS THE WORD • AVOID THE BYE • ONE LETTER AT A TIME',
    screenText: 'WORD DETECTIVE',
    description: 'Guess the hidden word before the BYE system completes. Every wrong letter brings you closer to defeat.',
    tags: ['Small Groups', 'Casual', 'Audience'],
    path: '/games/hangman',
    featured: false,
  },
  {
    id: 'spades',
    title: 'Spades',
    tagline: 'Classic Card Trick-Taking',
    screenComponent: <SpadesCabinetImage />,
    color: '#4a4a8a',
    color2: '#6a6aaa',
    marqueeText: 'BID SMART • PLAY TOGETHER • WIN TRICKS • DOMINATE THE TABLE',
    screenText: 'PARTNER CARD GAME',
    description: 'The classic trick-taking card game. Partner up, bid your tricks, and outplay the competition. Teamwork wins championships.',
    tags: ['4 Players', 'Partner', 'Strategy'],
    path: '/games/spades',
    featured: false,
  },
];

const COMING_SOON = [
  { title: 'TN Originals', emoji: '🤠', color: '#5a3a1a' },
  { title: 'Tournament', emoji: '🏆', color: '#5a4a0a' },
];

// Map game ID to gameKey used in character system
const GAME_ID_TO_KEY = { 'square-biz': 'squareBiz', bff: 'bff', hangman: 'hangman', spades: 'spades' };

export default function Games() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(null);
  const [roomCodes, setRoomCodes] = useState({ 'square-biz': '', bff: '', hangman: '', spades: '' });
  const [muted, setMuted] = useState(true);
  const audioRef = useRef(null);
  const [cpuSelectGame, setCpuSelectGame] = useState(null); // { id, title, gameKey }

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleCreateRoom = async (gameId) => {
    setCreating(gameId);
    try {
      const code = generateRoomCode();
      await base44.entities.GameRoom.create({
        room_code: code,
        game_id: gameId,
        status: 'waiting',
        host_connected: false,
        screen_connected: false,
        players_connected: 0,
        created_from_host_panel: false,
        game_state: {},
      });
      const game = GAMES.find(g => g.id === gameId);
      navigate(`${game.path}?room=${code}&creator=1`);
    } catch (e) {
      console.error('Failed to create room', e);
    } finally {
      setCreating(null);
    }
  };

  const handleJoinRoom = (gameId, code) => {
    navigate(`/join/${code}`);
  };

  const setRoomCode = (gameId, val) => {
    setRoomCodes(prev => ({ ...prev, [gameId]: val }));
  };

  const handleSinglePlayer = async (game) => {
    // BFF has a special "vs AI Team" mode — skip character picker and go directly
    if (game.id === 'bff') {
      setCreating('bff');
      try {
        const code = generateRoomCode();
        await base44.entities.GameRoom.create({
          room_code: code,
          game_id: 'bff',
          status: 'waiting',
          host_connected: false,
          screen_connected: false,
          players_connected: 0,
          created_from_host_panel: false,
          game_state: { vs_ai: true },
        });
        navigate(`/games/bff?room=${code}&creator=1&vsai=1`);
      } catch (e) {
        console.error('Failed to create BFF vs AI room', e);
      } finally {
        setCreating(null);
      }
      return;
    }
    const gameKey = GAME_ID_TO_KEY[game.id];
    if (!gameKey) return;
    setCpuSelectGame({ id: game.id, title: game.title, gameKey, path: game.path });
  };

  const handleCpuSelected = async (character) => {
    if (!cpuSelectGame) return;
    // Create a room and navigate with CPU opponent param
    const code = generateRoomCode();
    try {
      await base44.entities.GameRoom.create({
        room_code: code,
        game_id: cpuSelectGame.id,
        status: 'waiting',
        host_connected: false,
        screen_connected: false,
        players_connected: 0,
        created_from_host_panel: false,
        game_state: { cpu_opponent_id: character.id, single_player: true },
      });
      navigate(`${cpuSelectGame.path}?room=${code}&creator=1&cpu=${character.id}`);
      // Don't setCpuSelectGame(null) here — navigation unmounts the page anyway,
      // and calling it before navigation causes the overlay to disappear first.
    } catch (e) {
      console.error('Failed to create CPU room', e);
      setCpuSelectGame(null);
    }
  };

  const toggleMute = () => {
    setMuted(m => !m);
  };

  // Featured game first in display order
  const featuredGame = GAMES.find(g => g.featured);
  const otherGames = GAMES.filter(g => !g.featured);

  return (
    <div className="min-h-screen bg-midnight-void text-white overflow-x-hidden">
      <Header />

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Particles />
        {/* Radial glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #BC13FE, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #FF5F1F, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute top-2/3 left-1/2 w-64 h-64 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #22d3ee, transparent 70%)', filter: 'blur(50px)' }} />
        {/* Floor grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(188,19,254,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(188,19,254,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Scanline overlay */}
        <div className="absolute inset-0 scanline-overlay pointer-events-none" />
      </div>

      <div className="relative z-10">
        {/* Hero Banner */}
        <div className="relative text-center py-16 px-4 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-4 left-8 opacity-40"><NeonSign text="PLAY" color="#BC13FE" size="sm" /></div>
            <div className="absolute top-8 right-12 opacity-40"><NeonSign text="WIN" color="#FF5F1F" size="sm" /></div>


          </div>

          <div className="relative">
            <div className="text-[9px] tracking-[0.5em] uppercase mb-3 text-kinetic-orange"
              style={{ fontFamily: "'Press Start 2P', monospace", textShadow: '0 0 15px #BC13FE' }}>
              ✦ TEXASNOMAD ARCADE ✦
            </div>
            <h1 className="text-6xl sm:text-8xl md:text-9xl tracking-wider uppercase leading-none text-glow-gold"
              style={{ color: '#FFD700', fontFamily: "'Monoton', cursive" }}>
              THE GAMES
            </h1>
            <div className="font-heading text-xl sm:text-3xl tracking-[0.3em] uppercase mt-1 text-cyber-purple">
              Choose Your Battle
            </div>
            <p className="mt-4 font-body text-sm max-w-xl mx-auto text-cyber-purple/70">
              Step into the arcade. Every cabinet is a world. Every game is a showdown.
            </p>
          </div>

          <MarqueeStrip text="INSERT COIN • CHOOSE YOUR GAME • CLAIM YOUR GLORY • STEP INTO THE ARCADE" color="#FFD700" speed={25} />
        </div>

        {/* ── Featured Cabinet ── */}
        {featuredGame && (
          <section className="px-4 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-outlaw-gold/40 bg-outlaw-gold/5 mb-2 box-glow-gold">
                  <span className="text-outlaw-gold text-lg">⭐</span>
                  <span className="font-heading text-2xl tracking-widest text-outlaw-gold uppercase">Featured Game</span>
                  <span className="text-outlaw-gold text-lg">⭐</span>
                </div>
              </div>
              <div className="flex justify-center">
                <ArcadeCabinet
                  game={featuredGame}
                  featured={true}
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                  onSinglePlayer={handleSinglePlayer}
                  creating={creating}
                  roomCode={roomCodes[featuredGame.id]}
                  setRoomCode={(v) => setRoomCode(featuredGame.id, v)}
                />
              </div>
            </div>
          </section>
        )}

        {/* ── All Cabinets ── */}
        <section className="px-4 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <div className="text-xl tracking-[0.2em] uppercase text-outlaw-gold" style={{ fontFamily: "'Monoton', cursive", textShadow: '0 0 12px #FFD700, 0 0 24px #FFD700, 0 0 48px #FFD700, 0 0 60px #FFD700' }}>
                — ALL GAMES —
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
              {otherGames.map(game => (
                <ArcadeCabinet
                  key={game.id}
                  game={game}
                  featured={false}
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                  onSinglePlayer={handleSinglePlayer}
                  creating={creating}
                  roomCode={roomCodes[game.id]}
                  setRoomCode={(v) => setRoomCode(game.id, v)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Western Divider ── */}
        <div className="relative py-6 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, #BC13FE60, #FF5F1F60, transparent)' }} />
          </div>
          <div className="relative inline-flex items-center gap-4 px-6 py-2 bg-midnight-void">
            <span className="text-cyber-purple text-xl">✦</span>
            <span className="text-lg tracking-[0.25em] uppercase text-outlaw-gold text-glow-gold" style={{ fontFamily: "'Monoton', cursive" }}>COMING SOON</span>
            <span className="text-kinetic-orange text-xl">✦</span>
          </div>
        </div>

        {/* ── Coming Soon ── */}
        <section className="px-4 py-8 pb-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-4">
              <p className="text-white/30 text-[8px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                More cabinets arriving soon
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              {COMING_SOON.map(c => (
                <ComingSoonCabinet key={c.title} title={c.title} emoji={c.emoji} color={c.color} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* CPU Opponent Select Overlay */}
      {cpuSelectGame && (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <CPUOpponentSelect
            gameKey={cpuSelectGame.gameKey}
            gameName={cpuSelectGame.title}
            onSelect={handleCpuSelected}
            onBack={() => setCpuSelectGame(null)}
          />
        </div>
      )}

      {/* Mute button */}
      <button
        onClick={toggleMute}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full border border-cyber-purple/60 flex items-center justify-center text-sm transition-all hover:scale-110 box-glow-purple"
        style={{ background: 'rgba(5,2,8,0.9)', color: '#BC13FE' }}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}