import React from 'react';
import { Link } from 'react-router-dom';
import { ALL_GAMES, RoomGameIcon } from '@/components/host/HostGameSelect';
import SharedGameBoard from '@/components/host/SharedGameBoard';

export default function SharedGamePage({ gameId }) {
  const game = ALL_GAMES.find((entry) => entry.id === gameId);
  if (!game) {
    return <div className="min-h-screen bg-[#050505] p-8 text-center text-white">Game not found. <Link to="/games" className="text-[#FFD700] underline">Return to games</Link></div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b border-[#BC13FE]/40 bg-[#050505]/95 px-4 py-2 backdrop-blur-xl">
        <Link to="/" className="font-heading tracking-widest">TEXASNOMAD <span className="text-[#FF5F1F]">ROOM</span></Link>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: game.color }}>
          <RoomGameIcon game={game} size="sm" />
          {game.title}
        </div>
        <Link to="/games" className="text-xs text-white/50 hover:text-white">LEAVE</Link>
      </header>
      <main className="mx-auto w-full max-w-[1650px] p-2 sm:p-4">
        <SharedGameBoard gameId={gameId} roomCode="" />
      </main>
    </div>
  );
}
