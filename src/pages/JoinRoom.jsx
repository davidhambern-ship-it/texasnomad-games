import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { TngApiError, tngApi } from '@/api/tngApi';
import { resolveTngRoom } from '@/api/roomRegistry';
import { useAuth } from '@/lib/AuthContext';
import { createGuestIdentity, getStoredGuestIdentity } from '@/lib/guestIdentity';

const ENGINE_ROOM_GAME_IDS = new Set(['out', 'dominoes', 'see-that', 'word-wrangler', 'sudoku', 'rodeo-rumble', 'viral']);

const GAME_PATHS = {
  bff: '/games/bff',
  'square-biz': '/games/square-biz',
  hangman: '/games/hangman',
  spades: '/games/spades',
  'word-search': '/games/word-search',
  viral: '/games/viral',
  dominoes: '/games/dominoes',
  'see-that': '/games/see-that',
  'word-wrangler': '/games/word-wrangler',
  sudoku: '/games/sudoku',
  'rodeo-rumble': '/games/rodeo-rumble',
  out: '/games/out',
};

async function ensurePlayerDevice(accountId) {
  let deviceId = localStorage.getItem('tng_player_device_id');
  const deviceOwner = localStorage.getItem('tng_player_device_owner');

  if (deviceId && deviceOwner === String(accountId || '')) {
    return deviceId;
  }

  if (deviceId && deviceOwner !== String(accountId || '')) {
    localStorage.removeItem('tng_player_device_id');
    deviceId = null;
  }

  const { device } = await tngApi.devices.create({
    role: 'player',
    deviceLabel: 'Player Device',
  });

  localStorage.setItem('tng_player_device_id', device.id);
  localStorage.setItem('tng_player_device_owner', String(accountId || ''));
  return device.id;
}

function validatePlayerJoin(payload, roomCode) {
  const participant = payload?.participant || null;
  const role = String(participant?.role || '').toLowerCase();
  const seatNumber = Number(participant?.seatNumber || 0);

  if (role === 'host_player' || role === 'host' || seatNumber === 1) {
    throw new TngApiError(
      `This guest name is already hosting room ${roomCode}. Choose a different player name to join.`,
      {
        code: 'HOST_ACCOUNT_CANNOT_JOIN_AS_PLAYER',
        status: 409,
      },
    );
  }

  return payload;
}

function gameTitle(gameId) {
  return String(gameId || 'game')
    .split('-')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

export default function JoinRoom() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const path = window.location.pathname;
  const roomCode = path.split('/join/')[1]?.toUpperCase() || 'UNKNOWN';

  const [error, setError] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [joining, setJoining] = useState(false);
  const [guestName, setGuestName] = useState(() => getStoredGuestIdentity()?.name || '');

  useEffect(() => {
    if (roomCode === 'UNKNOWN') {
      setError('No room code provided.');
      setLoadingRoom(false);
      return;
    }

    if (isLoadingAuth) return;

    let cancelled = false;

    async function prepareRoom() {
      setError(null);

      try {
        const registeredRoom = await resolveTngRoom(roomCode);
        if (cancelled) return;

        if (!registeredRoom) {
          setError(`Room "${roomCode}" not found. Check the code and try again.`);
          setLoadingRoom(false);
          return;
        }

        // Every game uses the same explicit join step. This registers the
        // guest in the shared room roster before the player enters that game's
        // own cabinet and game-specific seat flow.
        setRoomInfo(registeredRoom);
        setLoadingRoom(false);
      } catch (roomError) {
        if (cancelled) return;
        setError(
          roomError?.message ||
          `Room "${roomCode}" could not be loaded. Check the code and try again.`,
        );
        setLoadingRoom(false);
      }
    }

    prepareRoom();

    return () => {
      cancelled = true;
    };
  }, [roomCode, isAuthenticated, isLoadingAuth]);

  async function joinGame() {
    if (!roomInfo || joining) return;

    setJoining(true);
    setError(null);

    try {
      const guestIdentity = getStoredGuestIdentity() || await createGuestIdentity(guestName);

      let deviceId = await ensurePlayerDevice(guestIdentity.id || user?.id || 'guest');
      let payload;

      try {
        payload = validatePlayerJoin(
          await tngApi.player.joinRoom(deviceId, roomCode, guestName.trim()),
          roomCode,
        );

      } catch (joinError) {
        if (
          joinError instanceof TngApiError &&
          ['INVALID_PLAYER_DEVICE', 'PLAYER_DEVICE_REQUIRED'].includes(joinError.code)
        ) {
          localStorage.removeItem('tng_player_device_id');
          deviceId = await ensurePlayerDevice(user?.id);
          payload = validatePlayerJoin(
            await tngApi.player.joinRoom(deviceId, roomCode, guestName.trim()),
            roomCode,
          );

        } else {
          throw joinError;
        }
      }

      const gameId = payload?.room?.gameId || roomInfo.gameId;
      const gamePath = roomInfo.joinPath || GAME_PATHS[gameId];
      if (!gamePath) {
        throw new Error(`Unknown game type for room "${roomCode}".`);
      }

      const cabinetPath = gamePath.includes('?')
        ? gamePath
        : `${gamePath}?room=${roomCode}`;
      window.location.replace(
        `/room/join/${roomCode}?game=${encodeURIComponent(gameId)}&next=${encodeURIComponent(cabinetPath)}`,
      );
    } catch (joinError) {
      setError(
        joinError?.message ||
        `Room "${roomCode}" could not be joined.`,
      );
      setJoining(false);
    }
  }

  async function spectate() {
    if (!roomInfo) return;
    try {
      if (!getStoredGuestIdentity()) await createGuestIdentity(guestName);
      window.location.replace(
        (roomInfo.kind === 'standalone' || ENGINE_ROOM_GAME_IDS.has(roomInfo.gameId))
          ? (roomInfo.spectatePath || roomInfo.joinPath)
          : (roomInfo.spectatePath || `/spectate/${roomCode}`),
      );
    } catch (spectateError) {
      setError(spectateError?.message || 'Choose a player name to spectate.');
    }
  }

  return (
    <div className="min-h-screen bg-midnight-void flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-cyber-purple/20 border-2 border-cyber-purple flex items-center justify-center mb-6 animate-pulse-glow">
        <span className="font-heading text-3xl text-cyber-purple">⚡</span>
      </div>

      <h1 className="font-heading text-4xl md:text-6xl tracking-wider text-outlaw-gold uppercase text-glow-gold">
        {roomInfo ? 'LIVE ROOM' : 'FINDING ROOM'}
      </h1>

      <p className="mt-4 font-mono text-2xl text-cyber-purple tracking-[0.3em]">
        {roomCode}
      </p>

      {loadingRoom && !error && (
        <p className="mt-4 text-white/60 font-body animate-pulse">
          Checking the live game…
        </p>
      )}

      {roomInfo && !error && (
        <div className="mt-7 w-full max-w-lg rounded-2xl border border-white/10 bg-black/35 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-white/35">
            NOW PLAYING
          </div>
          <div className="mt-2 font-heading text-4xl text-white">
            {gameTitle(roomInfo.gameId)}
          </div>
          <div className="mt-2 text-sm text-green-400">
            {String(roomInfo.status || 'live').toUpperCase()}
          </div>

          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/50">
            Join takes a player seat. Spectate opens a read-only live view and does not take a seat or let you make game moves.
          </p>

          {(
            <label className="mt-6 block text-left text-xs font-semibold uppercase tracking-widest text-white/60">
              Your player name
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                maxLength={32}
                autoComplete="nickname"
                placeholder="Enter a name"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-base text-white outline-none focus:border-[#BC13FE]"
              />
              <span className="mt-2 block text-[11px] font-normal normal-case tracking-normal text-white/40">
                Guest sessions expire automatically. No account is created.
              </span>
            </label>
          )}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={joinGame}
              disabled={joining || guestName.trim().length < 2}
              className="rounded-xl border-2 border-[#BC13FE] bg-[#BC13FE]/15 px-5 py-4 font-heading text-lg tracking-wider text-[#BC13FE] transition hover:bg-[#BC13FE]/25 disabled:opacity-40"
            >
              {joining ? 'JOINING…' : 'JOIN GAME'}
            </button>

            <button
              type="button"
              onClick={spectate}
              disabled={joining || guestName.trim().length < 2}
              className="rounded-xl border-2 border-[#FFD700] bg-[#FFD700]/10 px-5 py-4 font-heading text-lg tracking-wider text-[#FFD700] transition hover:bg-[#FFD700]/20 disabled:opacity-40"
            >
              SPECTATE
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-5 max-w-lg text-red-400 font-body">{error}</p>
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
