import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Monitor,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { backendMigration } from '@/config/backendMigration';
import { TngApiError, tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function readStoredDisplay() {
  const token = localStorage.getItem('tng_display_token');
  const deviceId = localStorage.getItem('tng_display_device_id');
  const hostSessionId = localStorage.getItem('tng_display_host_session_id');

  return token && deviceId
    ? { token, deviceId, hostSessionId }
    : null;
}

export default function GameDisplay() {
  const [code, setCode] = useState('');
  const [display, setDisplay] = useState(readStoredDisplay);
  const [room, setRoom] = useState(null);
  const [displayStatus, setDisplayStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!display) {
      setRoom(null);
      setDisplayStatus('idle');
      return undefined;
    }

    let cancelled = false;
    let timer;

    async function loadState() {
      setPolling(true);
      try {
        const payload = await tngApi.display.state({
          displayId: display.deviceId,
          displayToken: display.token,
        });

        if (cancelled) return;
        setRoom(payload.room || null);
        setDisplayStatus(payload.status || 'connected');
        setError('');
      } catch (stateError) {
        if (cancelled) return;

        if (
          stateError instanceof TngApiError &&
          ['DISPLAY_AUTH_REQUIRED', 'INVALID_DISPLAY'].includes(stateError.code)
        ) {
          localStorage.removeItem('tng_display_token');
          localStorage.removeItem('tng_display_device_id');
          localStorage.removeItem('tng_display_host_session_id');
          setDisplay(null);
          setRoom(null);
          setDisplayStatus('expired');
          setError('This Game Display session expired. Pair the screen again.');
          return;
        }

        setError(stateError.message || 'The Game Display could not refresh.');
      } finally {
        if (!cancelled) setPolling(false);
      }

      if (!cancelled) {
        timer = window.setTimeout(loadState, 1200);
      }
    }

    loadState();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [display]);

  async function pairDisplay(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = await tngApi.display.pair(code);

      localStorage.setItem('tng_display_token', payload.display.token);
      localStorage.setItem('tng_display_device_id', payload.display.deviceId);
      localStorage.setItem(
        'tng_display_host_session_id',
        payload.display.hostSessionId,
      );

      setDisplay(payload.display);
      setDisplayStatus('waiting_for_room');
      setRoom(null);
      setCode('');
    } catch (pairError) {
      setError(pairError.message || 'The Game Display could not connect.');
    } finally {
      setLoading(false);
    }
  }

  if (!backendMigration.tngBackendEnabled) {
    return (
      <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center px-4 text-center">
        <div className="max-w-lg">
          <Monitor className="w-12 h-12 mx-auto mb-5 text-white/25" />
          <div
            className="uppercase tracking-widest text-white/45"
            style={{ ...PS2, fontSize: 9 }}
          >
            GAME DISPLAY PAIRING IS NOT ENABLED IN THIS ENVIRONMENT
          </div>
        </div>
      </div>
    );
  }

  if (!display) {
    return (
      <PairDisplayScreen
        code={code}
        setCode={setCode}
        loading={loading}
        error={error}
        onSubmit={pairDisplay}
      />
    );
  }

  if (!room) {
    return (
      <WaitingDisplayScreen
        status={displayStatus}
        polling={polling}
        error={error}
      />
    );
  }

  return <LiveRoomDisplay room={room} polling={polling} error={error} />;
}

function PairDisplayScreen({ code, setCode, loading, error, onSubmit }) {
  return (
    <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <Monitor className="w-14 h-14 mx-auto mb-5 text-[#FFD700]" />
        <div
          className="text-[8px] text-[#FFD700] uppercase tracking-[0.3em] mb-3"
          style={PS2}
        >
          TNG GAME DISPLAY
        </div>
        <h1
          className="text-4xl uppercase tracking-wider"
          style={{ fontFamily: "'Rye', serif" }}
        >
          Pair This Screen
        </h1>
        <p className="mt-4 text-sm text-white/45 leading-relaxed">
          Enter the six-digit code shown on the Host Controller.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 rounded-2xl border border-[#FFD700]/35 bg-black/60 p-6"
        >
          <input
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="w-full h-16 rounded-xl border-2 border-[#FFD700]/40 bg-black/70 text-center font-mono text-4xl tracking-[0.28em] text-[#FFD700] pl-[0.28em] outline-none focus:border-[#FFD700]"
          />

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="mt-5 w-full h-12 rounded-lg bg-[#FFD700] text-black disabled:opacity-40 flex items-center justify-center gap-2 uppercase tracking-widest"
            style={{ ...PS2, fontSize: 8 }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'PAIRING…' : 'CONNECT DISPLAY'}
          </button>
        </form>
      </div>
    </div>
  );
}

function WaitingDisplayScreen({ status, polling, error }) {
  const waitingForHost = status === 'waiting_for_host';

  return (
    <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center px-4 text-center">
      <div className="w-full max-w-xl">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-5 text-[#4ade80]" />
        <div
          className="text-[8px] text-[#4ade80] uppercase tracking-[0.3em] mb-3"
          style={PS2}
        >
          DISPLAY CONNECTED
        </div>
        <h1
          className="text-4xl uppercase tracking-wider"
          style={{ fontFamily: "'Rye', serif" }}
        >
          {waitingForHost ? 'Waiting for Host' : 'Waiting for Room'}
        </h1>
        <p className="mt-4 text-sm text-white/45 leading-relaxed">
          {waitingForHost
            ? 'The screen is paired. The Host Controller is reconnecting to its session.'
            : 'The Host Controller and this display are paired. Choose a game from the Host Panel to start a room.'}
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
          {polling ? (
            <RefreshCw className="w-4 h-4 text-[#BC13FE] animate-spin" />
          ) : (
            <Wifi className="w-4 h-4 text-[#4ade80]" />
          )}
          <span
            className="text-[7px] text-white/40 uppercase tracking-widest"
            style={PS2}
          >
            LIVE LINK ACTIVE
          </span>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveRoomDisplay({ room, polling, error }) {
  const gameTitle = useMemo(
    () =>
      ({
        spades: 'SPADES',
        hangman: 'HANGMAN',
        bff: 'BFF',
        'square-biz': 'SQUARE BIZ!',
        'word-search': 'WORD SEARCH',
        sudoku: 'SUDOKU TN',
        'see-that': 'SEE THAT!',
      })[room.gameId] || room.gameId?.toUpperCase() || 'TNG GAME',
    [room.gameId],
  );

  if (room.gameId === 'spades') {
    return <SpadesDisplay room={room} polling={polling} error={error} />;
  }

  if (room.gameId === 'hangman') {
    return <HangmanDisplay room={room} polling={polling} error={error} />;
  }

  return (
    <div className="min-h-screen bg-[#05030b] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl text-center">
        <LiveLinkBadge polling={polling} />
        <div
          className="text-[8px] text-[#BC13FE] uppercase tracking-[0.3em] mt-6 mb-3"
          style={PS2}
        >
          ROOM {room.roomCode}
        </div>
        <h1
          className="text-5xl uppercase tracking-wider"
          style={{ fontFamily: "'Rye', serif" }}
        >
          {gameTitle}
        </h1>
        <p className="mt-4 text-sm text-white/40">
          Live room connected · revision {room.revision}
        </p>
        {error && <DisplayError error={error} />}
      </div>
    </div>
  );
}

function SpadesDisplay({ room, polling, error }) {
  const state = room.state || {};
  const players = Array.isArray(state.players) ? state.players : [];

  return (
    <div className="min-h-screen bg-[#04120b] text-white px-6 py-6 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div
            className="text-[8px] text-[#4ade80] uppercase tracking-[0.3em]"
            style={PS2}
          >
            TNG LIVE · ROOM {room.roomCode}
          </div>
          <h1
            className="text-4xl uppercase tracking-wider mt-2"
            style={{ fontFamily: "'Rye', serif" }}
          >
            SPADES
          </h1>
        </div>
        <LiveLinkBadge polling={polling} />
      </div>

      <div className="grid grid-cols-2 gap-5 mt-6">
        <ScorePanel
          name={state.team1Name || 'Team 1'}
          score={state.score1 || 0}
          bid={state.bid1}
          books={state.books1 || 0}
        />
        <ScorePanel
          name={state.team2Name || 'Team 2'}
          score={state.score2 || 0}
          bid={state.bid2}
          books={state.books2 || 0}
        />
      </div>

      <div className="flex-1 min-h-0 mt-6 rounded-[38px] border-[8px] border-[#6b3518] bg-[#0f5d35] shadow-[inset_0_0_70px_rgba(0,0,0,0.45)] relative">
        <div className="absolute inset-[12px] rounded-[30px] border border-white/[0.07]" />

        {players.map((player) => (
          <PlayerSeat
            key={player.seatNumber}
            player={player}
            active={
              player.seatNumber === state.currentTurnSeat ||
              player.seatNumber === state.currentBidderSeat
            }
          />
        ))}

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div
            className="text-[7px] uppercase tracking-[0.25em] text-white/35"
            style={PS2}
          >
            {String(state.phase || 'setup').replace(/_/g, ' ')}
          </div>
          <div className="mt-3 text-5xl">♠</div>
          <div className="mt-2 text-sm text-white/45">
            Hand {state.handNumber || 0} · Trick {state.tricksPlayed || 0}
          </div>
          <div className="mt-1 text-xs text-white/30">
            Target {state.targetScore || 500}
          </div>
        </div>
      </div>

      {error && <DisplayError error={error} />}
    </div>
  );
}

function PlayerSeat({ player, active }) {
  const seatClass =
    player.seatNumber === 1
      ? 'left-1/2 bottom-5 -translate-x-1/2'
      : player.seatNumber === 2
        ? 'left-5 top-1/2 -translate-y-1/2'
        : player.seatNumber === 3
          ? 'left-1/2 top-5 -translate-x-1/2'
          : 'right-5 top-1/2 -translate-y-1/2';

  return (
    <div
      className={`absolute ${seatClass} min-w-[150px] rounded-xl border px-4 py-3 text-center backdrop-blur-sm ${active ? 'border-[#FFD700] bg-[#FFD700]/15 shadow-[0_0_24px_rgba(255,215,0,0.25)]' : 'border-white/15 bg-black/35'}`}
    >
      <div className="text-sm font-semibold">{player.name || `Seat ${player.seatNumber}`}</div>
      <div className="mt-1 text-xs text-white/45">
        {player.cardCount || 0} cards
        {player.bid != null ? ` · Bid ${player.bid}` : ''}
      </div>
    </div>
  );
}

function ScorePanel({ name, score, bid, books }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-5 py-4">
      <div
        className="text-[7px] text-white/35 uppercase tracking-[0.25em]"
        style={PS2}
      >
        {name}
      </div>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="text-4xl font-bold">{score}</div>
        <div className="text-right text-xs text-white/45">
          <div>Bid: {bid ?? '—'}</div>
          <div>Books: {books}</div>
        </div>
      </div>
    </div>
  );
}

function HangmanDisplay({ room, polling, error }) {
  const state = room.state || {};
  const wrongCount = Array.isArray(state.wrongLetters)
    ? state.wrongLetters.length
    : 0;

  return (
    <div className="min-h-screen bg-[#05030b] text-white flex flex-col px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div
            className="text-[8px] text-[#FFD700] uppercase tracking-[0.3em]"
            style={PS2}
          >
            ROOM {room.roomCode}
          </div>
          <h1
            className="text-4xl uppercase tracking-wider mt-2"
            style={{ fontFamily: "'Rye', serif" }}
          >
            HANGMAN
          </h1>
        </div>
        <LiveLinkBadge polling={polling} />
      </div>

      <div className="flex-1 flex items-center justify-center text-center">
        <div>
          {state.category && (
            <div
              className="text-[8px] uppercase tracking-[0.3em] text-[#BC13FE] mb-6"
              style={PS2}
            >
              {state.category}
            </div>
          )}

          <div className="font-mono text-4xl sm:text-6xl tracking-[0.22em] text-white">
            {state.maskedWord || 'READY'}
          </div>

          <div className="mt-8 text-sm text-white/45">
            Misses {wrongCount} / {state.maxWrong || 6}
          </div>

          {state.hintRevealed && state.hint && (
            <div className="mt-6 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/5 px-5 py-4 text-[#FFD700]">
              Hint: {state.hint}
            </div>
          )}
        </div>
      </div>

      {error && <DisplayError error={error} />}
    </div>
  );
}

function LiveLinkBadge({ polling }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2">
      {polling ? (
        <RefreshCw className="w-4 h-4 text-[#BC13FE] animate-spin" />
      ) : (
        <Wifi className="w-4 h-4 text-[#4ade80]" />
      )}
      <span
        className="text-[7px] uppercase tracking-widest text-white/40"
        style={PS2}
      >
        LIVE
      </span>
    </div>
  );
}

function DisplayError({ error }) {
  if (!error) return null;

  return (
    <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
      <WifiOff className="w-4 h-4" />
      {error}
    </div>
  );
}
