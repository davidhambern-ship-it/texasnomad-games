import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import NeonWordSearchBoard from '@/components/word-search/NeonWordSearchBoard';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const MODES = [
  { value: 'race', label: 'Race Mode · everybody searches · 5 min' },
  { value: 'turn', label: 'Turn Mode · 60 sec each' },
];

const DIFFICULTIES = [
  { value: 'simpleton', label: 'Simpleton · 10 words · 12×12' },
  { value: 'reader', label: 'Reader · 15 words · 16×16' },
  { value: 'scholar', label: 'Scholar · 25 words · 22×22' },
];

const CATEGORIES = [
  { value: 'random', label: 'Random' },
  { value: 'popculture', label: 'Pop Culture' },
  { value: 'online', label: 'Online Culture' },
  { value: 'food', label: 'Food' },
  { value: 'spiritual', label: 'Bible / Spiritual' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'music', label: 'Music' },
  { value: 'travel', label: 'Travel' },
  { value: 'general', label: 'General' },
];

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[6px] text-white/25 uppercase tracking-widest" style={PS2}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[#00c875]/30 bg-[#07040d] px-3 py-2 text-xs text-white outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function NeonWordSearchHostPanel({ controllerId }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('race');
  const [difficulty, setDifficulty] = useState('simpleton');
  const [category, setCategory] = useState('random');
  const [clock, setClock] = useState(Date.now());

  const gameState = room?.gameState || {};
  const phase = gameState.phase || 'setup';
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const words = Array.isArray(gameState.words) ? gameState.words : [];
  const grid = Array.isArray(gameState.grid) ? gameState.grid : [];
  const scores = gameState.scores || {};
  const activeSeat = Number(gameState.activeSeat || 0);
  const myColor = gameState.myColor || '#BC13FE';
  const paused = gameState.paused === true;
  const currentMode = gameState.mode || mode;

  const canInteract =
    phase === 'playing' &&
    !paused &&
    (currentMode === 'race' || activeSeat === 1);

  const refresh = useCallback(async () => {
    if (!controllerId) return;

    try {
      const payload = await tngApi.wordSearch.getHostState(controllerId);
      setRoom(payload.room || null);
      setError('');
    } catch (refreshError) {
      setError(refreshError?.message || 'Could not load Word Search Host state.');
    }
  }, [controllerId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 800);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const act = useCallback(async (action, payload = {}) => {
    if (!controllerId || busy) return false;

    setBusy(true);
    setError('');

    try {
      const result = await tngApi.wordSearch.hostAction(controllerId, action, payload);
      setRoom(result.room || null);
      return true;
    } catch (actionError) {
      setError(actionError?.message || 'That Word Search action could not be completed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, controllerId]);

  const submitSelection = useCallback(async (cells) => {
    if (!canInteract || busy) return;
    await act('submit_selection', { cells });
  }, [act, busy, canInteract]);

  const foundCount = words.filter((word) => word.found).length;
  const timeRemaining = gameState.timeEnd
    ? Math.max(0, Number(gameState.timeEnd) - clock)
    : 0;
  const activePlayer = players.find((player) => Number(player.seatNumber) === activeSeat);

  const status = useMemo(() => {
    if (phase === 'setup') return 'READY TO START';
    if (phase === 'finished') return 'GAME OVER';
    if (paused) return 'PAUSED';
    if (currentMode === 'race') return 'RACE LIVE';
    if (activeSeat === 1) return 'YOUR TURN';
    return `SEAT ${activeSeat} TURN`;
  }, [activeSeat, currentMode, paused, phase]);

  if (!room && !error) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#00c875]" />
        <span className="text-sm text-white/40">Loading Word Search controls…</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto space-y-2">

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 text-center">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[#00c875]/25 bg-black/55 px-3 py-2.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[7px] tracking-widest text-[#00c875] uppercase" style={PS2}>WORD SEARCH HOST · SEAT 1</div>
          <div className="mt-1 text-xs text-white/35">
            Purple is your permanent board color. Every valid word you claim stays Purple.
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2 text-[7px] uppercase tracking-widest"
          style={{ ...PS2, borderColor: myColor, color: myColor }}>
          {status}
        </div>
      </div>

      {phase === 'setup' && (
        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_1fr_auto] rounded-xl border border-[#00c875]/25 bg-black/55 p-3">
          <Select label="MODE" value={mode} onChange={setMode} options={MODES} />
          <Select label="DIFFICULTY" value={difficulty} onChange={setDifficulty} options={DIFFICULTIES} />
          <Select label="CATEGORY" value={category} onChange={setCategory} options={CATEGORIES} />
          <button
            type="button"
            disabled={busy || players.length < 1}
            onClick={() => act('start_game', { mode, difficulty, category })}
            className="self-end rounded-lg border-2 border-[#00c875] bg-[#00c875]/10 px-5 py-2.5 text-[#00c875] disabled:opacity-40"
            style={{ ...PS2, fontSize: 7 }}
          >
            {busy ? 'STARTING…' : 'START GAME'}
          </button>
        </div>
      )}

      {phase !== 'setup' && (
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(310px,.7fr)]">

          <section className="rounded-xl border border-[#BC13FE]/20 bg-black/45 p-2 flex items-center justify-center overflow-auto">
            <NeonWordSearchBoard
              grid={grid}
              words={words}
              players={players}
              mySeat={1}
              myColor={myColor}
              canInteract={canInteract && !busy}
              onSubmit={submitSelection}
              maxBoardPx={720}
            />
          </section>

          <aside className="flex min-h-0 flex-col gap-2">

            <section className="grid grid-cols-3 gap-1.5">
              <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
                <div className="text-[5px] text-white/25 uppercase" style={PS2}>TIME</div>
                <div className="mt-1 text-xl text-[#FFD700]" style={PS2}>
                  {phase === 'playing' && !paused ? formatTime(timeRemaining) : paused ? 'PAUSE' : '--'}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
                <div className="text-[5px] text-white/25 uppercase" style={PS2}>FOUND</div>
                <div className="mt-1 text-xl text-[#4ade80]" style={PS2}>{foundCount}/{words.length}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/55 p-2 text-center">
                <div className="text-[5px] text-white/25 uppercase" style={PS2}>MODE</div>
                <div className="mt-1 text-[8px] text-[#00c875]" style={PS2}>
                  {currentMode === 'race' ? 'RACE' : 'TURN'}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-black/50 p-2.5">
              <div className="mb-2 text-[6px] text-white/25 uppercase tracking-widest" style={PS2}>PLAYERS / COLORS / SCORES</div>
              <div className="grid grid-cols-2 gap-1.5">
                {players.map((player) => {
                  const seat = Number(player.seatNumber);
                  const active = currentMode === 'race' ? phase === 'playing' : activeSeat === seat;

                  return (
                    <div
                      key={player.playerId}
                      className="rounded-lg border px-2 py-2"
                      style={{
                        borderColor: active ? player.color : 'rgba(255,255,255,.1)',
                        background: active ? `${player.color}0b` : 'rgba(255,255,255,.015)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: player.color }} />
                            <span className="truncate text-[10px] text-white/70">{player.name}</span>
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

            <section className="rounded-xl border border-[#BC13FE]/20 bg-black/55 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[6px] text-[#BC13FE] uppercase tracking-widest" style={PS2}>WORDS</span>
                <span className="text-[6px] text-[#FFD700]" style={PS2}>{foundCount}/{words.length}</span>
              </div>

              <div className="grid max-h-[270px] grid-cols-2 gap-1.5 overflow-y-auto pr-1">
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
                      <div className="text-[7px]" style={PS2}>{word.word}</div>
                      {word.found && word.points != null && (
                        <div className="mt-1 text-[5px] opacity-70" style={PS2}>
                          {word.revealed ? 'REVEAL' : `+${word.points}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-black/45 p-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={busy || phase !== 'playing'}
                  onClick={() => act(paused ? 'resume' : 'pause')}
                  className="rounded-lg border border-[#FF5F1F]/50 px-2 py-2 text-[10px] text-[#FF5F1F] disabled:opacity-30"
                >
                  {paused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button
                  type="button"
                  disabled={busy || phase !== 'playing' || foundCount >= words.length}
                  onClick={() => act('reveal_word')}
                  className="rounded-lg border border-[#FFD700]/50 px-2 py-2 text-[10px] text-[#FFD700] disabled:opacity-30"
                >
                  💡 Reveal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act('reset_match')}
                  className="rounded-lg border border-red-500/50 px-2 py-2 text-[10px] text-red-400 disabled:opacity-30"
                >
                  ↺ Reset
                </button>
              </div>

              <div className="mt-2 text-[10px] leading-relaxed text-white/35">
                Scoring: 10 pts per letter + placement bonus + difficulty bonus. Wrong selection −20. Turn timeout −10.
              </div>
            </section>

            {currentMode === 'turn' && phase === 'playing' && (
              <div className="text-center text-[10px] text-white/35">
                {canInteract
                  ? 'Seat 1 is live — drag across one word.'
                  : `Waiting for ${activePlayer?.name || `Seat ${activeSeat}`}.`}
              </div>
            )}

            {phase === 'finished' && (
              <section className="rounded-xl border border-green-400/30 bg-green-400/5 p-3 text-center">
                <div className="text-[7px] text-green-400 uppercase tracking-widest" style={PS2}>GAME OVER</div>
                <div className="mt-2 text-xs text-white/50">
                  {gameState.winnerSeat
                    ? `Seat ${gameState.winnerSeat} wins with ${scores[String(gameState.winnerSeat)] || 0} points.`
                    : gameState.message || 'Word Search complete.'}
                </div>
                <button
                  type="button"
                  onClick={() => act('reset_match')}
                  className="mt-3 rounded-lg border border-[#00c875]/50 px-4 py-2 text-[#00c875]"
                >
                  NEW BOARD
                </button>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
