import React from 'react';
import { RoomGameIcon } from '@/components/rooms/RoomGameCatalog';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SharedRoomLobby({
  room,
  game,
  people = [],
  isHost = false,
  busy = false,
  onStart,
  rosterError = '',
  error = '',
}) {
  const roomCode = room?.roomCode || room?.room_code || '';
  const hasOtherPlayer = people.some((person) =>
    !['host', 'host_player'].includes(String(person.role || '').toLowerCase()) &&
    Number(person.seatNumber) !== 1
  );
  const isHostPerson = (person) =>
    ['host', 'host_player'].includes(String(person.role || '').toLowerCase()) ||
    Number(person.seatNumber) === 1;
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); }
    catch { window.prompt('Copy this text:', value); }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-4 rounded-2xl border border-[#BC13FE]/35 bg-[#09060d] p-4 shadow-[0_0_35px_rgba(188,19,254,.08)] sm:p-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
        <RoomGameIcon game={game} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[8px] uppercase tracking-[0.2em] text-[#BC13FE]" style={PS2}>GAME ROOM LOBBY</div>
          <h1 className="mt-2 truncate text-2xl font-black uppercase sm:text-3xl">{game?.title || room?.gameId || 'GAME ROOM'}</h1>
          <p className="mt-1 text-sm text-white/45">{game?.subtitle || 'Multiplayer game'}</p>
        </div>
        <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs text-green-300">WAITING FOR PLAYERS</span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/[0.06] p-4">
            <div className="text-[8px] uppercase tracking-[0.18em] text-[#FFD700]" style={PS2}>SHARE ROOM CODE</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="font-mono text-3xl font-bold tracking-[0.2em] text-[#FFD700]">{roomCode}</div>
              <button type="button" onClick={() => copy(roomCode)} className="rounded-lg border border-[#FFD700]/35 px-3 py-2 text-xs text-[#FFD700] hover:bg-[#FFD700]/10">COPY CODE</button>
              <button type="button" onClick={() => copy(`${window.location.origin}/join/${roomCode}`)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:bg-white/5">COPY INVITE LINK</button>
            </div>
            <p className="mt-2 text-xs text-white/45">Share this code with everyone joining this game.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="text-[8px] uppercase tracking-[0.18em] text-[#BC13FE]" style={PS2}>GAME INFORMATION</div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">{game?.lobbyRules || game?.subtitle || 'Game instructions will appear in the game.'}</p>
            <p className="mt-3 text-xs leading-relaxed text-white/40">When the host starts, everyone opens the original {game?.title || 'game'} screen.</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[8px] uppercase tracking-[0.18em] text-green-300" style={PS2}>PLAYERS IN ROOM</div>
            <span className="rounded-full border border-green-400/25 px-2 py-1 text-xs text-green-300">{people.length}</span>
          </div>
          {rosterError ? <p className="mt-4 text-sm text-red-400">{rosterError}</p> : people.length ? (
            <div className="mt-4 space-y-2">
              {people.map((person, index) => {
                const host = isHostPerson(person);
                return (
                  <div key={person.accountId || person.handle || `${person.role}-${index}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                    <span className={host ? 'text-[#FFD700]' : 'text-[#BC13FE]'}>{host ? '★' : '●'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{person.displayName || person.name || person.handle || (host ? 'Host' : 'Player')}</div>
                      <div className={host ? 'mt-1 text-[9px] tracking-widest text-[#FFD700]' : 'mt-1 text-[9px] tracking-widest text-[#BC13FE]'}>{host ? 'HOST · PLAYER 1' : `PLAYER${person.seatNumber ? ` · SEAT ${person.seatNumber}` : ''}`}</div>
                    </div>
                    <span className="text-[10px] text-green-300">JOINED</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-4 text-sm text-white/40">Waiting for players to appear…</p>}
        </div>
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
        <p className="text-center text-xs text-white/45 sm:text-left">
          {isHost
            ? hasOtherPlayer ? 'Players are in. You can start the game.' : 'Waiting for at least one other player to join.'
            : 'You are in the player roster. The game will open here automatically when the host starts.'}
        </p>
        {isHost ? (
          <button type="button" onClick={onStart} disabled={busy || !hasOtherPlayer} className="w-full rounded-xl border border-[#BC13FE]/60 bg-[#BC13FE]/15 px-6 py-3 text-sm font-bold tracking-widest text-white transition hover:bg-[#BC13FE]/25 disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto">
            {busy ? 'STARTING…' : 'START GAME'}
          </button>
        ) : (
          <span className="rounded-xl border border-[#BC13FE]/45 bg-[#BC13FE]/10 px-6 py-3 text-sm font-bold tracking-widest text-[#BC13FE]">WAITING FOR HOST</span>
        )}
      </div>
    </section>
  );
}
