import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ALL_GAMES } from '@/components/rooms/RoomGameCatalog';
import SharedRoomLobby from '@/components/rooms/SharedRoomLobby';
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
          <SharedRoomLobby
            room={room}
            game={roomGame}
            people={people}
          />
        )}

        <div className="text-center">
          <button type="button" onClick={() => navigate('/games')} className="text-xs text-white/40 underline hover:text-white/70">Return to the game cabinets</button>
        </div>
      </div>
    </main>
  );
}
