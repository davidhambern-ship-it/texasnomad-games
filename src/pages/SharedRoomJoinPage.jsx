import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ALL_GAMES, RoomGameIcon } from '@/components/rooms/RoomGameCatalog';
import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function SharedRoomJoinPage() {
  const { roomCode: rawRoomCode = '' } = useParams();
  const roomCode = String(rawRoomCode).trim().toUpperCase();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nextPath = searchParams.get('next') || '';
  const deviceId = typeof window === 'undefined'
    ? ''
    : localStorage.getItem('tng_player_device_id') || '';

  const [room, setRoom] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const roomGame = useMemo(
    () => ALL_GAMES.find((game) => game.id === room?.gameId) || null,
    [room?.gameId],
  );

  useEffect(() => {
    if (!deviceId) {
      setError('Your player device could not be found. Please rejoin this room.');
      setLoading(false);
      return undefined;
    }

    let active = true;

    const refreshRoom = async () => {
      try {
        const payload = await tngApi.player.getRoom(deviceId, roomCode);
        if (!active) return;

        setRoom(payload.room || null);
        setPeople(Array.isArray(payload.people) ? payload.people : []);
        setError('');
        setLoading(false);

        if (payload.room?.status && payload.room.status !== 'lobby') {
          const cabinetPath = nextPath.startsWith('/games/') && !nextPath.startsWith('//')
            ? nextPath
            : `/games/${payload.room.gameId}?room=${roomCode}`;
          window.location.replace(
            cabinetPath.includes('?') ? cabinetPath : `${cabinetPath}?room=${roomCode}`,
          );
        }
      } catch (roomError) {
        if (!active) return;
        setError(roomError?.message || 'The shared room could not be refreshed.');
        setLoading(false);
      }
    };

    refreshRoom();
    const timer = window.setInterval(refreshRoom, 1500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [deviceId, roomCode, nextPath]);

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError('This browser could not copy the text. You can select the room code manually.');
    }
  };

  const isHost = (person) =>
    ['host', 'host_player'].includes(String(person.role || '').toLowerCase()) ||
    Number(person.seatNumber) === 1;

  return (
    <main className="min-h-screen bg-[#050208] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-[#FFD700]" style={PS2}>TEXASNOMAD GAMES</div>
            <div className="mt-2 text-xs text-white/45">SHARED MULTIPLAYER ROOM</div>
          </div>
          <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs text-green-300">WAITING FOR HOST</span>
        </div>

        {loading && !room && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/55">
            Loading the shared room…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-400/25 bg-red-400/5 p-5 text-sm text-red-300">
            {error}
            <div className="mt-4">
              <Link to="/games" className="text-[#FFD700] underline">Back to the game cabinets</Link>
            </div>
          </div>
        )}

        {room && (
          <section className="space-y-4 rounded-2xl border border-[#BC13FE]/35 bg-[#09060d] p-4 shadow-[0_0_35px_rgba(188,19,254,.08)] sm:p-6">
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
              <RoomGameIcon game={roomGame} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="text-[8px] uppercase tracking-[0.2em] text-[#BC13FE]" style={PS2}>GAME ROOM LOBBY</div>
                <h1 className="mt-2 truncate text-2xl font-black uppercase sm:text-3xl">{roomGame?.title || room.gameId}</h1>
                <p className="mt-1 text-sm text-white/45">{roomGame?.subtitle || 'Multiplayer game'}</p>
              </div>
              <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs text-green-300">WAITING FOR PLAYERS</span>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.05fr_.95fr]">
              <div className="space-y-4">
                <div className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/[0.06] p-4">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#FFD700]" style={PS2}>ROOM CODE</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="font-mono text-3xl font-bold tracking-[0.2em] text-[#FFD700]">{room.roomCode || roomCode}</div>
                    <button type="button" onClick={() => copyText(room.roomCode || roomCode)} className="rounded-lg border border-[#FFD700]/35 px-3 py-2 text-xs text-[#FFD700] hover:bg-[#FFD700]/10">COPY CODE</button>
                    <button type="button" onClick={() => copyText(`${window.location.origin}/join/${room.roomCode || roomCode}`)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:bg-white/5">COPY INVITE LINK</button>
                  </div>
                  <p className="mt-2 text-xs text-white/45">You are in this room as a player. Share the code with anyone else who wants to join.</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-[#BC13FE]" style={PS2}>GAME INFORMATION</div>
                  <p className="mt-3 text-sm leading-relaxed text-white/75">{roomGame?.lobbyRules || roomGame?.subtitle || 'Game instructions are provided in the game cabinet.'}</p>
                  <p className="mt-3 text-xs leading-relaxed text-white/40">The original {roomGame?.title || 'game'} cabinet and its full controls open automatically when the host starts.</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-green-300" style={PS2}>PLAYERS IN ROOM</div>
                  <span className="rounded-full border border-green-400/25 px-2 py-1 text-xs text-green-300">{people.length}</span>
                </div>
                {people.length ? (
                  <div className="mt-4 space-y-2">
                    {people.map((person, index) => {
                      const host = isHost(person);
                      return (
                        <div key={person.accountId || person.handle || `${person.role}-${index}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                          <span className={host ? 'text-[#FFD700]' : 'text-[#BC13FE]'}>{host ? '★' : '●'}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">{person.name || person.displayName || person.handle || (host ? 'Host' : 'Player')}</div>
                            <div className={host ? 'mt-1 text-[9px] tracking-widest text-[#FFD700]' : 'mt-1 text-[9px] tracking-widest text-[#BC13FE]'}>{host ? 'HOST · PLAYER 1' : `PLAYER${person.seatNumber ? ` · SEAT ${person.seatNumber}` : ''}`}</div>
                          </div>
                          <span className="text-[10px] text-green-300">JOINED</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/40">Waiting for the host and players to appear…</p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
              <p className="text-center text-xs text-white/45 sm:text-left">You are in the player roster. The game will open here automatically when the host starts it.</p>
              <span className="rounded-xl border border-[#BC13FE]/45 bg-[#BC13FE]/10 px-6 py-3 text-sm font-bold tracking-widest text-[#BC13FE]">WAITING FOR HOST</span>
            </div>
          </section>
        )}

        <div className="text-center">
          <button type="button" onClick={() => navigate('/games')} className="text-xs text-white/40 underline hover:text-white/70">Return to the game cabinets</button>
        </div>
      </div>
    </main>
  );
}
