import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import NeonWordSearchBoard from '@/components/word-search/NeonWordSearchBoard';
import WordSearchTurnEffects from '@/components/word-search/WordSearchTurnEffects';
import { TngNotificationToaster } from '@/components/social/TngNotificationToaster';
import { getPublicTngName } from '@/lib/publicTngName';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function NeonWordSearchPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const seatNumber = Number(participant?.seatNumber || 0);
  const phase = gameState.phase || 'setup';
  const mode = gameState.mode || 'race';
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const words = Array.isArray(gameState.words) ? gameState.words : [];
  const grid = Array.isArray(gameState.grid) ? gameState.grid : [];
  const scores = gameState.scores || {};
  const activeSeat = Number(gameState.activeSeat || 0);
  const myColor = gameState.myColor || '#FFD700';
  const paused = gameState.paused === true;

  const canInteract =
    phase === 'playing' &&
    !paused &&
    (mode === 'race' || activeSeat === seatNumber);

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode) return;

    try {
      const payload = await tngApi.wordSearch.getPlayerState(deviceId, roomCode);
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
      setError('');
    } catch (stateError) {
      setError(stateError?.message || 'The Word Search room could not be loaded.');
    }
  }, [deviceId, roomCode]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 800);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const submitSelection = useCallback(async (cells) => {
    if (!deviceId || !roomCode || busy || !canInteract) return;

    setBusy(true);
    setError('');

    try {
      const payload = await tngApi.wordSearch.playerAction(
        deviceId,
        roomCode,
        'submit_selection',
        { cells },
      );
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
    } catch (actionError) {
      setError(actionError?.message || 'That selection could not be submitted.');
    } finally {
      setBusy(false);
    }
  }, [busy, canInteract, deviceId, roomCode]);

  const foundCount = words.filter((word) => word.found).length;
  const timeRemaining = gameState.timeEnd
    ? Math.max(0, Number(gameState.timeEnd) - clock)
    : 0;
  const activePlayer = players.find((player) => Number(player.seatNumber) === activeSeat);
  const myScore = Number(scores[String(seatNumber)] || 0);

  const status = useMemo(() => {
    if (phase === 'setup') return 'WAITING FOR HOST';
    if (phase === 'finished') return 'GAME OVER';
    if (paused) return 'PAUSED';
    if (mode === 'race') return 'EVERYBODY SEARCH!';
    if (activeSeat === seatNumber) return 'YOUR TURN';
    return `SEAT ${activeSeat} TURN`;
  }, [activeSeat, mode, paused, phase, seatNumber]);

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center text-center px-4">
        <div>
          <div className="text-red-400 mb-4">Player device not registered.</div>
          <Link to={`/join/${roomCode}`} className="text-[#FFD700] underline">
            Rejoin room {roomCode}
          </Link>
        </div>
      </div>
    );
  }

  if (!room && !error) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#BC13FE]" />
          <div className="text-sm text-white/40">Connecting to Word Search room {roomCode}…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-[100dvh] lg:overflow-hidden bg-[#070311] text-white">
      <TngNotificationToaster />
      <div className="mx-auto flex min-h-screen lg:h-full max-w-[1500px] flex-col gap-2 p-2 lg:min-h-0">

        <header className="shrink-0 rounded-xl border bg-black/60 px-3 py-2.5 flex items-center justify-between gap-3"
          style={{ borderColor: `${myColor}55` }}>
          <div className="min-w-0">
            <div className="text-[6px] sm:text-[7px] tracking-widest uppercase" style={{ ...PS2, color: myColor }}>
              TEXASNOMAD WORD SEARCH
            </div>
            <div className="mt-1 flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-base sm:text-lg tracking-[0.15em] text-[#FFD700]">{roomCode}</span>
              <span className="text-[11px] text-white/40">Seat {seatNumber || '—'}</span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: myColor, boxShadow: `0 0 8px ${myColor}` }} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              className="rounded-lg border px-2.5 py-2 text-[6px] sm:text-[7px] tracking-widest uppercase"
              style={{ ...PS2, borderColor: myColor, color: myColor }}
            >
              {status}
            </div>
            <Link
              to="/"
              replace
              className="rounded-lg border border-white/15 px-2.5 py-2 text-[6px] tracking-widest uppercase text-white/40"
              style={PS2}
            >
              EXIT
            </Link>
          </div>
        </header>

        {error && (
          <div className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        <section className="grid grid-cols-3 gap-1.5 lg:hidden">
          <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
            <div className="text-[5px] text-white/25 uppercase" style={PS2}>TIME</div>
            <div className="mt-1 text-base text-[#FFD700]" style={PS2}>
              {phase === 'playing' && !paused ? formatTime(timeRemaining) : paused ? 'PAUSE' : '--'}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
            <div className="text-[5px] text-white/25 uppercase" style={PS2}>FOUND</div>
            <div className="mt-1 text-base text-[#4ade80]" style={PS2}>{foundCount}/{words.length || 0}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
            <div className="text-[5px] text-white/25 uppercase" style={PS2}>YOU</div>
            <div className="mt-1 text-base" style={{ ...PS2, color: myColor }}>{myScore}</div>
          </div>
        </section>

        {phase === 'playing' && canInteract && (
          <div className="lg:hidden shrink-0 rounded-lg border px-3 py-2 text-center text-[7px] tracking-widest uppercase"
            style={{ ...PS2, color: myColor, borderColor: `${myColor}55`, background: `${myColor}0b` }}>
            DRAG ACROSS LETTERS · LIFT TO SUBMIT
          </div>
        )}

        <main className="min-h-0 flex-1 grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(310px,.7fr)]">

          <section className="relative min-h-0 rounded-xl border border-[#BC13FE]/20 bg-black/45 p-1 sm:p-2 flex items-center justify-center overflow-hidden lg:overflow-auto">
            <WordSearchTurnEffects
              mode={mode}
              phase={phase}
              paused={paused}
              activeSeat={activeSeat}
              players={players}
              viewerSeat={seatNumber}
              timeRemaining={timeRemaining}
              roundNumber={gameState.roundNumber || 1}
            />

            {grid.length ? (
              <NeonWordSearchBoard
                grid={grid}
                words={words}
                players={players}
                mySeat={seatNumber}
                myColor={myColor}
                canInteract={canInteract && !busy}
                onSubmit={submitSelection}
                maxBoardPx={720}
              />
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">🔍</div>
                <div className="text-lg text-[#BC13FE]">Waiting for the Host to start Word Search…</div>
              </div>
            )}
          </section>

          <aside className="min-h-0 flex flex-col gap-2">

            <section className="hidden lg:grid shrink-0 grid-cols-3 gap-1.5">
              <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
                <div className="text-[5px] text-white/25 uppercase" style={PS2}>TIME</div>
                <div className="mt-1 text-xl text-[#FFD700]" style={PS2}>
                  {phase === 'playing' && !paused ? formatTime(timeRemaining) : paused ? 'PAUSE' : '--'}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
                <div className="text-[5px] text-white/25 uppercase" style={PS2}>FOUND</div>
                <div className="mt-1 text-xl text-[#4ade80]" style={PS2}>{foundCount}/{words.length || 0}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
                <div className="text-[5px] text-white/25 uppercase" style={PS2}>YOU</div>
                <div className="mt-1 text-xl" style={{ ...PS2, color: myColor }}>{myScore}</div>
              </div>
            </section>

            <section className="shrink-0 rounded-xl border border-white/10 bg-black/50 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[6px] text-white/25 uppercase tracking-widest" style={PS2}>PLAYERS</span>
                <span className="text-[6px] text-white/20 uppercase" style={PS2}>
                  {mode === 'race' ? 'RACE MODE' : 'TURN MODE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {players.map((player) => {
                  const seat = Number(player.seatNumber);
                  const playerActive = mode === 'race' ? phase === 'playing' : activeSeat === seat;
                  const isMe = seat === seatNumber;

                  return (
                    <div
                      key={player.playerId}
                      className={`rounded-lg border px-2 py-2 ${mode === 'turn' && playerActive ? 'ws-active-turn-card' : ''}`}
                      style={{
                        '--ws-active-color': player.color,
                        borderColor: isMe
                          ? player.color
                          : playerActive
                            ? `${player.color}99`
                            : 'rgba(255,255,255,.10)',
                        background: playerActive ? `${player.color}0b` : 'rgba(255,255,255,.015)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: player.color }} />
                            <span className="truncate text-[10px] text-white/70">{getPublicTngName(player)}</span>
                          </div>
                          <div className="mt-1 text-[5px] text-white/25 uppercase" style={PS2}>SEAT {seat}</div>
                        </div>
                        <div className="text-lg" style={{ ...PS2, color: player.color }}>{player.score || 0}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="min-h-0 flex-1 rounded-xl border border-[#BC13FE]/20 bg-black/55 p-2.5 flex flex-col">
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <span className="text-[6px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>WORDS</span>
                <span className="text-[6px] text-[#FFD700]" style={PS2}>{foundCount}/{words.length}</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-1.5">
                  {words.map((word) => {
                    const finder = players.find((player) => String(player.seatNumber) === String(word.foundBy));
                    const color = word.revealed ? '#777777' : finder?.color || '#BC13FE';

                    return (
                      <div
                        key={word.word}
                        className="rounded-md border px-2 py-1.5 text-center"
                        style={{
                          borderColor: word.found ? `${color}70` : 'rgba(255,255,255,.08)',
                          background: word.found ? `${color}10` : 'rgba(255,255,255,.02)',
                          color: word.found ? color : 'rgba(255,255,255,.45)',
                          textDecoration: word.found ? 'line-through' : 'none',
                        }}
                      >
                        <div className="text-[7px] tracking-wide" style={PS2}>{word.word}</div>
                        {word.found && word.points != null && (
                          <div className="mt-1 text-[5px] opacity-70" style={PS2}>
                            {word.revealed ? 'REVEALED' : `+${word.points}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="shrink-0 rounded-xl border border-white/10 bg-black/45 p-2.5">
              <div className="text-[5px] text-[#FFD700]/60 uppercase tracking-widest" style={PS2}>SCORING</div>
              <div className="mt-1 text-[10px] leading-relaxed text-white/40">
                10 pts per letter + placement bonus + difficulty bonus. Wrong selection −20. Turn timeout −10.
              </div>

              {gameState.lastAction && !['game_started', 'pause', 'resume'].includes(gameState.lastAction.type) && (
                <div className="mt-2 border-t border-white/8 pt-2 text-[10px] text-white/45">
                  {gameState.lastAction.type === 'timeout'
                    ? `Seat ${gameState.lastAction.seatNumber} timed out · −10`
                    : gameState.lastAction.type === 'reveal'
                      ? `${gameState.lastAction.word} was revealed`
                      : (
                        <>
                          Seat {gameState.lastAction.seatNumber}{' '}
                          <span style={{ color: players.find((player) => Number(player.seatNumber) === Number(gameState.lastAction.seatNumber))?.color || '#FFD700' }}>
                            {gameState.lastAction.word}
                          </span>
                          {' '}· {gameState.lastAction.result}
                          {gameState.lastAction.points ? ` · ${gameState.lastAction.points > 0 ? '+' : ''}${gameState.lastAction.points}` : ''}
                        </>
                      )}
                </div>
              )}
            </section>

            {phase === 'finished' && (
              <section className="shrink-0 rounded-xl border border-green-400/30 bg-green-400/5 p-3 text-center">
                <div className="text-[7px] text-green-400 uppercase tracking-widest" style={PS2}>GAME OVER</div>
                <div className="mt-2 text-xs text-white/50">
                  {gameState.winnerSeat
                    ? `Seat ${gameState.winnerSeat} wins with ${scores[String(gameState.winnerSeat)] || 0} points.`
                    : gameState.message || 'Word Search complete.'}
                </div>
              </section>
            )}

            {mode === 'turn' && phase === 'playing' && (
              <div className="shrink-0 text-center text-[10px] text-white/35">
                {canInteract
                  ? 'Drag across a word. Your selection ends the turn.'
                  : `Waiting for ${getPublicTngName(activePlayer, `Seat ${activeSeat}`)}.`}
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
