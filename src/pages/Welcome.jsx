import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const sty = { fontFamily: "'Press Start 2P', monospace" };
const hdg = { fontFamily: "'Teko', sans-serif" };

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="font-heading text-2xl md:text-3xl tracking-widest text-[#FFD700] uppercase border-b border-[#FFD700]/20 pb-2">{title}</h2>
      <div className="text-white/70 font-body text-sm md:text-base leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function InfoBox({ children, color = '#BC13FE' }) {
  return (
    <div className="rounded-xl border px-5 py-4 text-sm"
      style={{ borderColor: `${color}40`, background: `${color}08`, color: 'rgba(255,255,255,0.75)' }}>
      {children}
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-white/70">
          <span className="text-[#FF5F1F] mt-0.5 shrink-0">▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Step({ num, text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center font-heading text-base"
        style={{ background: '#BC13FE20', color: '#BC13FE', border: '1px solid #BC13FE40' }}>{num}</div>
      <div className="text-white/70 font-body text-sm pt-0.5">{text}</div>
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const handleUnderstood = () => {
    localStorage.setItem('tn_welcome_seen', '1');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-[#BC13FE]/20 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TN" className="w-7 h-7 object-contain" />
          <span className="text-[#FFD700] text-[10px] tracking-widest uppercase hidden sm:block" style={sty}>TEXASNOMAD GAMES</span>
        </div>
        <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="text-[8px] tracking-widest text-[#BC13FE]/70 uppercase hover:text-[#BC13FE] transition-colors" style={sty}>
          Skip to bottom ↓
        </button>
      </div>

      {/* Hero */}
      <div className="relative py-16 md:py-24 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(188,19,254,0.15), transparent)',
        }} />
        <div className="relative max-w-3xl mx-auto space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full border border-[#FFD700]/40 bg-[#FFD700]/5 text-[8px] tracking-[0.3em] text-[#FFD700] uppercase mb-2" style={sty}>
            Welcome
          </div>
          <h1 className="font-heading text-5xl md:text-7xl tracking-widest uppercase leading-none"
            style={{ textShadow: '0 0 40px rgba(188,19,254,0.4)' }}>
            TexasNomad<br />
            <span style={{ color: '#FFD700', textShadow: '0 0 40px rgba(255,215,0,0.4)' }}>GAMES</span>
          </h1>
          <p className="font-heading text-xl md:text-2xl text-white/60 tracking-widest uppercase">
            The Home of Interactive Livestream Game Nights
          </p>
          <p className="font-body text-white/50 text-sm md:text-base max-w-xl mx-auto leading-relaxed pt-2">
            TexasNomad Games was created for livestream hosts, content creators, communities, and viewers who want to play games together in real time.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pb-8 space-y-10">

        {/* What is it */}
        <Section title="What Is TexasNomad Games?">
          <p>
            The goal of TexasNomad Games is to bring people together through interactive multiplayer games that can be played during livestreams.
            Whether you're a streamer, host, family leader, or viewer — you can create your own game room and invite others to join.
          </p>
          <InfoBox color="#BC13FE">
            <p className="font-heading text-sm tracking-wide text-[#FFD700] mb-2">💡 For the best experience:</p>
            <p className="mb-3">Use a second device while watching the livestream. Hosts may also want additional devices to manage the Host Panel without interrupting their broadcast.</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="px-3 py-3 rounded-lg border border-[#BC13FE]/30 bg-[#BC13FE]/5">
                <div className="text-[7px] tracking-widest text-[#BC13FE]/70 uppercase mb-1" style={sty}>Device 1</div>
                <div className="font-body text-white/80 text-sm">Watch the livestream</div>
              </div>
              <div className="px-3 py-3 rounded-lg border border-[#FF5F1F]/30 bg-[#FF5F1F]/5">
                <div className="text-[7px] tracking-widest text-[#FF5F1F]/70 uppercase mb-1" style={sty}>Device 2</div>
                <div className="font-body text-white/80 text-sm">Play the game</div>
              </div>
            </div>
            <p className="mt-3 text-white/50 text-xs">TexasNomad Games works on phones, tablets, laptops, and desktops.</p>
          </InfoBox>
        </Section>

        {/* Room Codes */}
        <Section title="How Game Rooms Work">
          <p>Every game room is unique. When a player creates a game room, a unique room code is generated. That room becomes its own independent game session — no other players are automatically placed into it.</p>
          <InfoBox color="#FFD700">
            <p className="text-[8px] tracking-widest text-[#FFD700] uppercase mb-2" style={sty}>Example</p>
            <p className="mb-2">You create a Hangman room. Your room code is:</p>
            <div className="text-center my-3">
              <span className="font-heading text-4xl tracking-[0.4em]" style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>TN817</span>
            </div>
            <p>Only players who enter <strong className="text-[#FFD700]">TN817</strong> can join your game.</p>
          </InfoBox>
          <div>
            <p className="mb-3 font-heading text-white/80 uppercase tracking-wide">To join another player's game:</p>
            <div className="space-y-2">
              {['Go to the TexasNomad Games homepage', 'Enter the room code', 'Click Join', 'Join the live game room'].map((s, i) => (
                <Step key={i} num={i + 1} text={s} />
              ))}
            </div>
          </div>
          <p className="text-white/50 text-xs">Every room is separate. Actions in one room do not affect any other room.</p>
        </Section>

        {/* Anyone can create */}
        <Section title="Anyone Can Create a Room">
          <p>Every player can create their own room. You do not need to be a streamer.</p>
          <BulletList items={['Create a room', 'Share your room code', 'Invite friends', 'Play with viewers', 'Run community game nights']} />
        </Section>

        {/* Hosts */}
        <Section title="Multiplayer Games Require a Host">
          <p>A Host is responsible for controlling the game in multiplayer sessions.</p>
          <BulletList items={['Revealing answers', 'Starting rounds', 'Managing game flow', 'Running the scoreboard', 'Operating game controls']} />
          <InfoBox color="#22d3ee">
            <p className="font-heading text-sm tracking-wide text-[#22d3ee] mb-2">🤖 Single Player / 1P Mode</p>
            <p>All games support <strong className="text-white">1P vs CPU mode</strong>. In 1P mode, no Host is required — the AI opponent controls the game automatically. Select "VS CPU" from the game lobby to play solo against the TexasNomad Team characters.</p>
          </InfoBox>
          <p className="text-white/50">In multiplayer mode, a Host must be connected to start and manage the game.</p>
        </Section>

        {/* Host Panel */}
        <Section title="The Host Panel">
          <p>TexasNomad Games uses a separate Host Panel. The Host Panel is <strong className="text-white">NOT</strong> the main game screen — it controls the game behind the scenes.</p>
          <InfoBox color="#FF5F1F">
            <p className="text-[8px] tracking-widest text-[#FF5F1F]/80 uppercase mb-2" style={sty}>How it works</p>
            <div className="space-y-2">
              {['The host selects a game', 'The host creates a room', 'A unique 5-digit room code is generated', 'Players join using that room code', 'The Host Panel controls the game while players participate'].map((s, i) => (
                <div key={i} className="flex gap-2 items-start text-sm">
                  <span className="text-[#FF5F1F] shrink-0">{i + 1}.</span>
                  <span className="text-white/70">{s}</span>
                </div>
              ))}
            </div>
          </InfoBox>
          <p>Hosts are encouraged to use a second device (tablet, phone, or laptop) while the game board is displayed on another screen. The Host Panel is password protected.</p>
        </Section>

        {/* Seat System */}
        <Section title="Seat Numbers & Player Tracking">
          <p>When players join a room, they are automatically assigned a seat number. Seat assignments help the game track turns, answers, buzzers, player actions, and team assignments across all TexasNomad Games.</p>
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="px-4 py-3 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 text-center">
                <div className="text-[7px] text-[#BC13FE]/60 uppercase tracking-widest mb-1" style={sty}>Player</div>
                <div className="font-heading text-2xl text-white">Seat {n}</div>
              </div>
            ))}
          </div>
       </Section>

{/* Games */}
<Section title="Current Games">
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {[
      { name: 'BFF', sub: 'BIGO Family Feud', color: '#BC13FE', emoji: '🟣' },
      { name: 'Square Biz!', sub: 'Trivia Tic-Tac-Toe', color: '#FF5F1F', emoji: '🟠' },
      { name: 'Hangman', sub: 'Word Guessing', color: '#FFD700', emoji: '🟡' },
      { name: 'Spades', sub: 'Multiplayer Card Game', color: '#3B82F6', emoji: '♠️' },
    ].map(g => (
      <div
        key={g.name}
        className="px-4 py-4 rounded-xl border text-center"
        style={{
          borderColor: `${g.color}40`,
          background: `${g.color}08`
        }}
      >
        <div className="text-2xl mb-2">{g.emoji}</div>

        <div
          className="font-heading text-lg tracking-widest uppercase"
          style={{ color: g.color }}
        >
          {g.name}
        </div>

        <div
          className="text-[8px] text-white/40 tracking-widest mt-1"
          style={sty}
        >
          {g.sub}
        </div>
      </div>
    ))}
  </div>
</Section>
        {/* Coming Soon */}
        <Section title="Coming Soon">
          <BulletList items={['Additional party games', 'Tournament systems', 'Community leaderboards', 'More livestream integrations']} />
          <p className="text-white/40 text-xs">More games are being added regularly.</p>
        </Section>

        {/* Closing */}
        <div className="py-8 text-center space-y-3 border-t border-white/5">
          <p className="font-heading text-2xl md:text-3xl tracking-widest text-white uppercase">TexasNomad Games is designed to bring people together through fun, interactive gameplay.</p>
          <div className="flex justify-center gap-6 pt-2">
            {['Create a room', 'Invite your community', 'Play together'].map((t, i) => (
              <div key={i} className="text-center">
                <div className="w-2 h-2 rounded-full bg-[#BC13FE] mx-auto mb-2 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                <div className="text-white/50 text-sm font-body">{t}</div>
              </div>
            ))}
          </div>
        </div>

        {/* UNDERSTOOD button */}
        <div ref={bottomRef} className="py-8 flex flex-col items-center gap-4">
          <div className="text-[8px] tracking-[0.3em] text-white/30 uppercase text-center" style={sty}>
            By clicking understood, you confirm you have read this page
          </div>
          <button
            onClick={handleUnderstood}
            className="relative px-12 py-6 rounded-2xl border-2 font-heading text-2xl md:text-3xl tracking-[0.3em] uppercase transition-all duration-300 active:scale-95 hover:scale-105 overflow-hidden group"
            style={{ borderColor: '#FFD700', color: '#FFD700', background: 'transparent', boxShadow: '0 0 30px rgba(255,215,0,0.2), 0 0 60px rgba(255,215,0,0.05)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,215,0,0.1)'; e.currentTarget.style.boxShadow = '0 0 50px rgba(255,215,0,0.4), 0 0 100px rgba(255,215,0,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = '0 0 30px rgba(255,215,0,0.2), 0 0 60px rgba(255,215,0,0.05)'; }}>
            UNDERSTOOD
          </button>
          <p className="text-[7px] tracking-widest text-white/20 uppercase" style={sty}>
            Your preference will be saved for future visits
          </p>
        </div>
      </div>
    </div>
  );
}