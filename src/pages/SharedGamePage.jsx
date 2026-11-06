import React from 'react';
import { Link } from 'react-router-dom';
import { ALL_GAMES, RoomGameIcon } from '@/components/host/HostGameSelect';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';
import { createGuestIdentity, getStoredGuestIdentity } from '@/lib/guestIdentity';
import { useState } from 'react';
import SharedGameBoard from '@/components/host/SharedGameBoard';

export default function SharedGamePage({ gameId }) {
  const identity = useTngGameIdentity();
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [creatingGuest, setCreatingGuest] = useState(false);
  const game = ALL_GAMES.find((entry) => entry.id === gameId);
  if (!game) {
    return <div className="min-h-screen bg-[#050505] p-8 text-center text-white">Game not found. <Link to="/games" className="text-[#FFD700] underline">Return to games</Link></div>;
  }

  const needsGuestName = !identity.loading && !identity.publicName && !getStoredGuestIdentity();
  const continueAsGuest = async (event) => {
    event.preventDefault();
    if (creatingGuest) return;
    setCreatingGuest(true);
    setGuestError('');
    try {
      await createGuestIdentity(guestName);
      window.location.reload();
    } catch (error) {
      setGuestError(error?.message || 'Could not create your guest player name.');
      setCreatingGuest(false);
    }
  };

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
        {identity.loading ? <div className="p-8 text-center text-white/50">Preparing your guest room…</div> : needsGuestName ? (
          <form onSubmit={continueAsGuest} className="mx-auto mt-10 max-w-md rounded-2xl border border-[#BC13FE]/40 bg-black/60 p-6">
            <h1 className="text-xl font-bold">Choose your player name</h1>
            <p className="mt-2 text-sm text-white/50">No account or sign-in needed. This name is used for your live game room.</p>
            <input value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={32} autoComplete="nickname" placeholder="Your player name" className="mt-5 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-white" />
            {guestError && <p className="mt-3 text-sm text-red-400">{guestError}</p>}
            <button disabled={creatingGuest || !guestName.trim()} className="mt-4 w-full rounded-xl bg-[#BC13FE] px-4 py-3 font-bold text-white disabled:opacity-40">{creatingGuest ? 'SETTING UP…' : 'CONTINUE AS GUEST'}</button>
          </form>
        ) : <SharedGameBoard gameId={gameId} roomCode="" />}
      </main>
    </div>
  );
}
