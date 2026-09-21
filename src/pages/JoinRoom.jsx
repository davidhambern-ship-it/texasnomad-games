import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { base44 } from '@/api/base44Client';
import { TngApiError, tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';
import { isBase44Preview } from '@/lib/previewTngProfile';
import { isNeonStaging } from '@/lib/neonAuth';

const GAME_PATHS = {
  bff: '/games/bff',
  'square-biz': '/games/square-biz',
  hangman: '/games/hangman',
  spades: '/games/spades',
  'word-search': '/games/word-search',
  sudoku: '/games/sudoku',
  'see-that': '/games/see-that',
  viral: '/games/viral',
  'name-that-track': '/games/name-that-track',
};

async function ensurePlayerDevice() {
  let deviceId = localStorage.getItem('tng_player_device_id');
  if (deviceId) return deviceId;

  const { device } = await tngApi.devices.create({
    role: 'player',
    deviceLabel: 'Player Device',
  });

  localStorage.setItem('tng_player_device_id', device.id);
  return device.id;
}

export default function JoinRoom() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const path = window.location.pathname;
  const roomCode = path.split('/join/')[1]?.toUpperCase() || 'UNKNOWN';
  const [error, setError] = useState(null);

  useEffect(() => {
    if (roomCode === 'UNKNOWN') {
      setError('No room code provided.');
      return;
    }

    if (isLoadingAuth) return;

    async function findAndJoin() {
      setError(null);

      try {
        if (isBase44Preview || isNeonStaging) {
          if (!isAuthenticated) {
            const next = encodeURIComponent(`/join/${roomCode}`);
            window.location.href = `/login?next=${next}`;
            return;
          }

          let deviceId = await ensurePlayerDevice();

          try {
            const payload = await tngApi.player.joinRoom(deviceId, roomCode);
            const gamePath = GAME_PATHS[payload.room?.gameId];

            if (!gamePath) {
              setError(`Unknown game type for room "${roomCode}".`);
              return;
            }

            window.location.href = `${gamePath}?room=${roomCode}&neon=1`;
            return;
          } catch (joinError) {
            if (
              joinError instanceof TngApiError &&
              ['INVALID_PLAYER_DEVICE', 'PLAYER_DEVICE_REQUIRED'].includes(joinError.code)
            ) {
              localStorage.removeItem('tng_player_device_id');
              deviceId = await ensurePlayerDevice();
              const payload = await tngApi.player.joinRoom(deviceId, roomCode);
              const gamePath = GAME_PATHS[payload.room?.gameId];

              if (!gamePath) {
                setError(`Unknown game type for room "${roomCode}".`);
                return;
              }

              window.location.href = `${gamePath}?room=${roomCode}&neon=1`;
              return;
            }

            throw joinError;
          }
        }

        const rooms = await base44.entities.GameRoom.filter({ room_code: roomCode });
        if (!rooms || rooms.length === 0) {
          setError(`Room "${roomCode}" not found. Check the code and try again.`);
          return;
        }

        const room = rooms[0];
        const gamePath = GAME_PATHS[room.game_id];
        if (!gamePath) {
          setError(`Unknown game type for room "${roomCode}".`);
          return;
        }

        window.location.href = `${gamePath}?room=${roomCode}`;
      } catch (joinError) {
        setError(
          joinError?.message ||
          `Room "${roomCode}" could not be joined. Check the code and try again.`,
        );
      }
    }

    findAndJoin();
  }, [roomCode, isAuthenticated, isLoadingAuth]);

  return (
    <div className="min-h-screen bg-midnight-void flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-cyber-purple/20 border-2 border-cyber-purple flex items-center justify-center mb-6 animate-pulse-glow">
        <span className="font-heading text-3xl text-cyber-purple">⚡</span>
      </div>
      <h1 className="font-heading text-4xl md:text-6xl tracking-wider text-outlaw-gold uppercase text-glow-gold">
        JOINING ROOM
      </h1>
      <p className="mt-4 font-mono text-2xl text-cyber-purple tracking-[0.3em]">{roomCode}</p>

      {error ? (
        <p className="mt-4 text-red-400 font-body">{error}</p>
      ) : (
        <p className="mt-4 text-white/60 font-body animate-pulse">
          {isBase44Preview || isNeonStaging ? 'Connecting to live Neon room…' : 'Looking up game session…'}
        </p>
      )}

      <Link
        to="/"
        className="mt-8 px-6 py-3 border-2 border-outlaw-gold/60 text-outlaw-gold font-heading text-sm tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black transition-all"
      >
        ← Back to Home
      </Link>
    </div>
  );
}
