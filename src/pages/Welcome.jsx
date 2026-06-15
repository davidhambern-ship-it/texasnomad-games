import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Laptop, Tablet, Mic2, Trophy, Zap, Users, BarChart2, Bot, Tv2, Gamepad2 } from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const HOW_IT_WORKS = [
  {
    icon: null,
    emoji: null,
    title: 'Join A Game',
    text: 'Join a live game and play with others.',
    color: '#BC13FE',
    devices: true,
  },
  {
    icon: <Mic2 className="w-10 h-10" />,
    emoji: '🎙️',
    title: 'Host A Show',
    text: 'Run game shows and control the action.',
    color: '#FF5F1F',
  },
  {
    icon: <Trophy className="w-10 h-10" />,
    emoji: '🏆',
    title: 'Compete',
    text: 'Play, score points, and win.',
    color: '#FFD700',
  },
];

const HOST_FEATURES = [
  { icon: <Zap className="w-5 h-5" />, title: 'Launch Games', text: 'Start and manage live game sessions.', color: '#BC13FE' },
  { icon: <Users className="w-5 h-5" />, title: 'Manage Players', text: 'Track teams and participants.', color: '#FF5F1F' },
  { icon: <Bot className="w-5 h-5" />, title: 'Control AI', text: 'Choose TexasNomad AI opponents.', color: '#FFD700' },
  { icon: <Tv2 className="w-5 h-5" />, title: 'Run Live Shows', text: 'Host interactive events.', color: '#3B82F6' },
  { icon: <BarChart2 className="w-5 h-5" />, title: 'Monitor Scores', text: 'Live scoring and leaderboards.', color: '#4ade80' },
  { icon: <Gamepad2 className="w-5 h-5" />, title: 'Control Questions', text: 'Reveal answers on your cue.', color: '#f472b6' },
];

const GAMES = [
  { name: 'BFF', sub: 'Family Feud', emoji: '🟣', color: '#BC13FE' },
  { name: 'Square Biz!', sub: 'Trivia Tic-Tac-Toe', emoji: '🟠', color: '#FF5F1F' },
  { name: 'Hangman', sub: 'Word Guessing', emoji: '🟡', color: '#FFD700' },
  { name: 'Spades', sub: 'Card Game', emoji: '♠️', color: '#3B82F6' },
];

export default function Welcome() {
  const navigate = useNavigate();

  const goPlayer = () => {
    localStorage.setItem('tn_welcome_seen', '1');
    navigate('/');
  };

  const goHost = () => {
    localStorage.setItem('tn_welcome_seen', '1');
    navigate('/host');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col overflow-x-hidden">

      {/* ── SECTION 1: Hero Banner ─────────────────────────────────────────── */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(188,19,254,0.2), transparent)', position: 'absolute', inset: 0 }} />
          <div style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(255,95,31,0.1), transparent)', position: 'absolute', inset: 0 }} />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <img
            src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png"
            alt="TexasNomad"
            className="w-20 h-20 object-contain mx-auto mb-2"
            style={{ filter: 'drop-shadow(0 0 20px rgba(188,19,254,0.6))' }}
          />
          <h1
            className="font-heading text-6xl sm:text-7xl md:text-8xl tracking-widest uppercase leading-none"
            style={{ textShadow: '0 0 40px rgba(188,19,254,0.5)' }}
          >
            TEXAS<span style={{ color: '#FFD700', textShadow: '0 0 40px rgba(255,215,0,0.5)' }}>NOMAD</span>
          </h1>
          <h2
            className="font-heading text-4xl sm:text-5xl tracking-widest uppercase leading-none"
            style={{ color: '#FFD700', textShadow: '0 0 30px rgba(255,215,0,0.4)' }}
          >
            GAMES
          </h2>
          <p className="font-heading text-base sm:text-xl text-white/50 tracking-widest uppercase mt-2">
            Interactive Live Game Shows & Multiplayer Games
          </p>

          {/* Game icons strip */}
          <div className="flex justify-center gap-3 pt-4 flex-wrap">
            {GAMES.map(g => (
              <div key={g.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-heading tracking-widest uppercase"
                style={{ borderColor: `${g.color}40`, background: `${g.color}10`, color: g.color }}>
                <span>{g.emoji}</span>
                <span>{g.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: How It Works ───────────────────────────────────────── */}
      <section className="px-4 py-12 max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-[8px] tracking-[0.4em] uppercase text-white/30 mb-2" style={PS2}>How It Works</div>
          <h2 className="font-heading text-4xl sm:text-5xl tracking-widest uppercase text-white">3 SIMPLE STEPS</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map((card, i) => (
            <div key={i}
              className="relative rounded-2xl border-2 p-6 text-center flex flex-col items-center gap-4 transition-transform hover:scale-105"
              style={{ borderColor: `${card.color}50`, background: `${card.color}08`, boxShadow: `0 0 30px ${card.color}10` }}>
              {card.devices ? (
                <div className="flex items-end justify-center gap-2" style={{ color: card.color }}>
                  <Smartphone className="w-8 h-8" />
                  <Laptop className="w-10 h-10" />
                  <Tablet className="w-8 h-8" />
                </div>
              ) : (
                <div className="text-5xl leading-none">{card.emoji}</div>
              )}
              <div className="font-heading text-2xl tracking-widest uppercase" style={{ color: card.color }}>{card.title}</div>
              <p className="text-white/60 font-body text-sm leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: Host Panel ─────────────────────────────────────────── */}
      <section className="px-4 py-12 w-full"
        style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(188,19,254,0.05) 50%, transparent 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-[8px] tracking-[0.4em] uppercase text-[#BC13FE]/60 mb-2" style={PS2}>For Hosts</div>
            <h2 className="font-heading text-4xl sm:text-5xl tracking-widest uppercase"
              style={{ color: '#BC13FE', textShadow: '0 0 30px rgba(188,19,254,0.4)' }}>HOST PANEL</h2>
            <p className="font-heading text-lg text-white/40 uppercase tracking-widest mt-2">
              The command center for TexasNomad Games
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {HOST_FEATURES.map((f, i) => (
              <div key={i} className="rounded-xl border p-4 flex flex-col gap-2"
                style={{ borderColor: `${f.color}30`, background: `${f.color}08` }}>
                <div style={{ color: f.color }}>{f.icon}</div>
                <div className="font-heading text-base tracking-widest uppercase" style={{ color: f.color }}>{f.title}</div>
                <p className="text-white/50 text-xs font-body leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl border border-[#BC13FE]/20 bg-[#BC13FE]/5 text-center">
            <div className="text-[7px] tracking-[0.3em] uppercase text-[#BC13FE]/50 mb-1" style={PS2}>🔒 Password Protected</div>
            <p className="text-white/40 text-xs font-body">The Host Panel is a separate, secure control dashboard.</p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Choose Your Role ──────────────────────────────────── */}
      <section className="px-4 py-16 max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-[8px] tracking-[0.4em] uppercase text-white/30 mb-2" style={PS2}>Get Started</div>
          <h2 className="font-heading text-4xl sm:text-5xl tracking-widest uppercase text-white">WHO ARE YOU?</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* HOST button */}
          <button
            onClick={goHost}
            className="group relative rounded-2xl border-2 p-8 flex flex-col items-center gap-4 text-center transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
            style={{ borderColor: '#BC13FE', background: 'rgba(188,19,254,0.05)', boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 60px rgba(188,19,254,0.4)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(188,19,254,0.15)'}
          >
            <div className="text-6xl">🎙️</div>
            <div className="font-heading text-4xl tracking-[0.3em] uppercase" style={{ color: '#BC13FE', textShadow: '0 0 20px rgba(188,19,254,0.6)' }}>HOST</div>
            <p className="text-white/50 font-body text-sm">Run games and manage players.</p>
            <div className="mt-2 px-6 py-2 rounded-xl border border-[#BC13FE]/60 text-[#BC13FE] text-[8px] tracking-widest uppercase" style={PS2}>
              Go to Host Panel →
            </div>
          </button>

          {/* PLAYER button */}
          <button
            onClick={goPlayer}
            className="group relative rounded-2xl border-2 p-8 flex flex-col items-center gap-4 text-center transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
            style={{ borderColor: '#FFD700', background: 'rgba(255,215,0,0.05)', boxShadow: '0 0 30px rgba(255,215,0,0.15)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 60px rgba(255,215,0,0.4)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(255,215,0,0.15)'}
          >
            <Smartphone className="w-16 h-16" style={{ color: '#FFD700', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.6))' }} />
            <div className="font-heading text-4xl tracking-[0.3em] uppercase" style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>PLAYER</div>
            <p className="text-white/50 font-body text-sm">Join games and compete.</p>
            <div className="mt-2 px-6 py-2 rounded-xl border border-[#FFD700]/60 text-[#FFD700] text-[8px] tracking-widest uppercase" style={PS2}>
              Enter the Arena →
            </div>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-white/5 text-center">
        <div className="text-[6px] tracking-[0.3em] uppercase text-white/20" style={PS2}>
          TexasNomad Games · Interactive Live Game Shows
        </div>
      </footer>
    </div>
  );
}