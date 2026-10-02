import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Gamepad2,
  Users,
  Eye,
  Monitor,
  Smartphone,
  UserCircle2,
  Crown,
  Tv2,
  ArrowRight,
} from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const ROLE_CARDS = [
  {
    icon: <Crown className="w-7 h-7" />,
    eyebrow: 'HOST',
    title: 'Host A Game',
    text: 'The Host Panel is your control center. Create the room, choose the game, manage players, control rounds, and run the action.',
    note: 'The live game board can appear directly inside the Host Panel.',
    color: '#BC13FE',
  },
  {
    icon: <Gamepad2 className="w-7 h-7" />,
    eyebrow: 'PLAYER',
    title: 'Play A Game',
    text: 'Join a live room with a room code or invite. Your phone, tablet, or computer becomes your player view while the game runs live.',
    note: 'Players take an active seat in the room.',
    color: '#FF5F1F',
  },
  {
    icon: <Eye className="w-7 h-7" />,
    eyebrow: 'SPECTATOR',
    title: 'Watch A Game',
    text: 'Want to watch without joining the competition? Choose Spectate when entering a room and follow the live board.',
    note: 'Spectators do not take a player seat.',
    color: '#3B82F6',
  },
  {
    icon: <Tv2 className="w-7 h-7" />,
    eyebrow: 'OPTIONAL DISPLAY',
    title: 'Use A Big Screen',
    text: 'A TV, projector, tablet, or second computer can still be used as a separate Game Display for the room.',
    note: 'A second display is optional — Hosts can run TNG from one device.',
    color: '#FFD700',
  },
];

const FLOW = [
  { number: '01', title: 'Host Creates Room', text: 'Choose a game and open a live room.' },
  { number: '02', title: 'Share Room Code', text: 'Give the room code to everyone joining.' },
  { number: '03', title: 'Join Or Spectate', text: 'Players take seats. Spectators watch.' },
  { number: '04', title: 'Play', text: 'The Host runs the game and the room goes live.' },
];

const KNOW_CARDS = [
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Multiplayer Only',
    text: 'TNG is built around playing live games with real people.',
    color: '#BC13FE',
  },
  {
    icon: <UserCircle2 className="w-5 h-5" />,
    title: 'One TNG Profile',
    text: 'Your TNG profile follows your games and keeps your play history and stats together.',
    color: '#FFD700',
  },
  {
    icon: <Crown className="w-5 h-5" />,
    title: 'Host Controls The Room',
    text: 'The Host runs the game while player devices handle each player’s actions.',
    color: '#FF5F1F',
  },
  {
    icon: <Eye className="w-5 h-5" />,
    title: 'Spectators Don’t Take Seats',
    text: 'Watching a game does not use one of the available player positions.',
    color: '#3B82F6',
  },
  {
    icon: <Smartphone className="w-5 h-5" />,
    title: 'Play On Your Device',
    text: 'TNG is designed for phones, tablets, laptops, and desktop computers.',
    color: '#4ade80',
  },
  {
    icon: <Monitor className="w-5 h-5" />,
    title: 'One Screen Or Two',
    text: 'Keep the board inside the Host Panel or send it to a separate display.',
    color: '#f472b6',
  },
];

const GAMES = [
  { name: 'BFF', sub: 'Survey Showdown', emoji: '🟣', color: '#BC13FE' },
  { name: 'Square Biz!', sub: 'Trivia Tic-Tac-Toe', emoji: '🟠', color: '#FF5F1F' },
  { name: 'Hangman', sub: 'Word Guessing', emoji: '🟡', color: '#FFD700' },
  { name: 'Spades', sub: 'Card Game', emoji: '♠️', color: '#3B82F6' },
  { name: 'Word Search', sub: 'Word Hunt', emoji: '🔎', color: '#4ade80' },
];

export default function Welcome() {
  const navigate = useNavigate();

  const enterTng = () => {
    try {
      sessionStorage.setItem('tng_welcome_complete', '1');
      sessionStorage.setItem('tng_last_activity_at', String(Date.now()));
    } catch {}
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png"
              alt="TexasNomad Games"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <div className="font-heading text-lg sm:text-xl tracking-widest uppercase truncate">
                TEXAS<span className="text-[#FFD700]">NOMAD</span> GAMES
              </div>
              <div className="hidden sm:block text-[7px] tracking-[0.25em] uppercase text-white/35" style={PS2}>
                Welcome To The Arena
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={enterTng}
            className="hidden sm:flex items-center gap-2 rounded-xl bg-[#FFD700] px-4 py-3 text-black transition-all hover:bg-[#ffe44d] active:scale-95"
            style={{ ...PS2, fontSize: 8 }}
          >
            <Home className="h-4 w-4" />
            TNG HOME
          </button>
        </div>

        <div className="px-4 pb-3 sm:hidden">
          <button
            type="button"
            onClick={enterTng}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 py-3 text-black active:scale-[.99]"
            style={{ ...PS2, fontSize: 8 }}
          >
            <Home className="h-4 w-4" />
            GO TO TNG HOME
          </button>
        </div>
      </header>

      {/* Welcome */}
      <section className="relative overflow-hidden px-4 py-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 0%, rgba(188,19,254,0.18), transparent 68%)' }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 50% 45% at 90% 70%, rgba(255,95,31,0.08), transparent)' }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-3 text-[8px] tracking-[0.4em] uppercase text-[#FFD700]/70" style={PS2}>
            First Time Here?
          </div>
          <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl tracking-widest uppercase leading-none">
            Welcome To <span className="text-[#FFD700]">TNG</span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-sm sm:text-base leading-7 text-white/60">
            TexasNomad Games is a live multiplayer game platform built for people playing together.
            Host a room, join as a player, watch as a spectator, and use one screen or a full TV setup.
          </p>
          <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/[.04] px-4 py-3">
            <p className="text-xs sm:text-sm text-white/55">
              <span className="font-semibold text-[#FFD700]">Need to skip the tour?</span>{' '}
              Use the TNG Home button above at any time.
            </p>
          </div>
        </div>
      </section>

      {/* Role grid */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-7 text-center">
          <div className="mb-2 text-[8px] tracking-[0.4em] uppercase text-white/30" style={PS2}>Choose Your Role</div>
          <h2 className="font-heading text-3xl sm:text-4xl tracking-widest uppercase">HOW YOU USE TNG</h2>
          <p className="mt-3 text-sm text-white/40">These cards explain the system — they are not buttons.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ROLE_CARDS.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border p-5 sm:p-6"
              style={{ borderColor: `${card.color}45`, background: `${card.color}08` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
                  style={{ color: card.color, borderColor: `${card.color}45`, background: `${card.color}10` }}
                >
                  {card.icon}
                </div>
                <div>
                  <div className="mb-1 text-[7px] tracking-[0.3em] uppercase" style={{ ...PS2, color: card.color }}>
                    {card.eyebrow}
                  </div>
                  <h3 className="font-heading text-2xl tracking-widest uppercase" style={{ color: card.color }}>
                    {card.title}
                  </h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/60">{card.text}</p>
              <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-white/40">
                {card.note}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="w-full px-4 py-12" style={{ background: 'linear-gradient(180deg, transparent, rgba(188,19,254,0.05), transparent)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 text-center">
            <div className="mb-2 text-[8px] tracking-[0.4em] uppercase text-[#BC13FE]/60" style={PS2}>From Room To Game</div>
            <h2 className="font-heading text-3xl sm:text-4xl tracking-widest uppercase">HOW A GAME STARTS</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((step, index) => (
              <div key={step.number} className="relative rounded-2xl border border-white/10 bg-white/[.025] p-5">
                <div className="mb-4 text-2xl text-[#FFD700]" style={PS2}>{step.number}</div>
                <h3 className="font-heading text-xl tracking-wider uppercase">{step.title}</h3>
                <p className="mt-2 text-xs leading-5 text-white/45">{step.text}</p>
                {index < FLOW.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-white/20 lg:block" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#3B82F6]/25 bg-[#3B82F6]/[.05] p-5 text-center">
            <div className="font-heading text-2xl tracking-widest uppercase text-[#3B82F6]">ONE SCREEN OR TWO — YOUR CHOICE</div>
            <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-white/50">
              Keep the live game board inside the Host Panel, or move it to a separate Game Display on a TV,
              projector, tablet, or another computer.
            </p>
          </div>
        </div>
      </section>

      {/* Useful info */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="mb-7 text-center">
          <div className="mb-2 text-[8px] tracking-[0.4em] uppercase text-white/30" style={PS2}>Before You Jump In</div>
          <h2 className="font-heading text-3xl sm:text-4xl tracking-widest uppercase">GOOD TO KNOW</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KNOW_CARDS.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/[.025] p-4">
              <div className="mb-3 flex items-center gap-2" style={{ color: item.color }}>
                {item.icon}
                <div className="font-heading text-lg tracking-wider uppercase">{item.title}</div>
              </div>
              <p className="text-xs leading-5 text-white/45">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Game lineup */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-12">
        <div className="mb-7 text-center">
          <div className="mb-2 text-[8px] tracking-[0.4em] uppercase text-white/30" style={PS2}>Game Info</div>
          <h2 className="font-heading text-3xl sm:text-4xl tracking-widest uppercase">CURRENT LIVE GAMES</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {GAMES.map((game) => (
            <div
              key={game.name}
              className="rounded-xl border p-4 text-center"
              style={{ borderColor: `${game.color}35`, background: `${game.color}07` }}
            >
              <div className="text-3xl">{game.emoji}</div>
              <div className="mt-3 font-heading text-lg tracking-wider uppercase" style={{ color: game.color }}>
                {game.name}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{game.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Home CTA */}
      <section className="px-4 pb-16 pt-4">
        <div className="mx-auto max-w-4xl rounded-2xl border-2 border-[#FFD700]/45 bg-[#FFD700]/[.04] p-7 text-center sm:p-10">
          <div className="mb-3 text-[8px] tracking-[0.4em] uppercase text-[#FFD700]/65" style={PS2}>Ready?</div>
          <h2 className="font-heading text-4xl sm:text-5xl tracking-widest uppercase">ENTER THE ARENA</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/50">
            Everything starts from the TNG Home page. From there you can host, join, check your profile, and get into a game.
          </p>

          <button
            type="button"
            onClick={enterTng}
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-[#FFD700] px-7 py-4 text-black transition-all hover:bg-[#ffe44d] active:scale-[.99] sm:mx-auto sm:w-auto"
            style={{ ...PS2, fontSize: 9 }}
          >
            <Home className="h-4 w-4" />
            GO TO TNG HOME
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5 px-4 py-6 text-center">
        <div className="text-[6px] tracking-[0.3em] uppercase text-white/20" style={PS2}>
          TexasNomad Games · Live Multiplayer Games
        </div>
      </footer>
    </div>
  );
}
