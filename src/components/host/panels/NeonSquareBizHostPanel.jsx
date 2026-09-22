import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import {
  SquareBizBoard,
  SquareBizCueCard,
  SquareBizShowStyles,
} from '@/components/square-biz/SquareBizShow';

const MONO = { fontFamily: "'Press Start 2P', monospace" };
const X_COLOR = '#ff1593';
const O_COLOR = '#25b9ff';

function Control({ children, onClick, disabled, tone = '#ffd633' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[46px] rounded-xl border px-3 py-2 text-[7px] uppercase tracking-[.12em] transition-all enabled:hover:scale-[1.018] enabled:active:scale-[.985] disabled:opacity-30"
      style={{
        ...MONO,
        borderColor: `${tone}77`,
        color: tone,
        background: `${tone}0c`,
      }}
    >
      {children}
    </button>
  );
}

function PlayerCard({ player, mark, current }) {
  const color = mark === 'X' ? X_COLOR : O_COLOR;
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: current ? color : `${color}44`,
        background: current ? `${color}0e` : 'rgba(255,255,255,.02)',
        boxShadow: current ? `0 0 18px ${color}28` : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[7px] uppercase tracking-[.18em]" style={{ ...MONO, color }}>PLAYER {mark}</div>
          <div className="mt-1 truncate text-base font-black text-white">{player?.name || 'WAITING…'}</div>
          <div className="mt-1 text-[10px] text-white/35">
            {player?.handle ? `@${player.handle}` : player ? 'CONNECTED' : 'OPEN'}
          </div>
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-3xl font-black"
          style={{ borderColor: color, color, textShadow: `0 0 14px ${color}` }}
        >
          {mark}
        </div>
      </div>
      {current && (
        <div className="mt-2 rounded-lg border px-2 py-1.5 text-center text-[6px] uppercase tracking-widest" style={{ ...MONO, borderColor: color, color }}>
          TURN LIVE
        </div>
      )}
    </div>
  );
}

export default function NeonSquareBizHostPanel({ controllerId }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const jingleRef = useRef(null);

  const gameState = room?.gameState || {};
  const phase = gameState.phase || 'lobby';
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const xPlayer = players.find((player) => player.mark === 'X');
  const oPlayer = players.find((player) => player.mark === 'O');
  const queued = players.filter((player) => !player.mark);
  const currentQuestion = gameState.currentQuestion;

  const refresh = useCallback(async () => {
    if (!controllerId) return;

    try {
      const payload = await tngApi.squareBiz.getHostState(controllerId);
      setRoom(payload.room || null);
      setError('');
    } catch (refreshError) {
      setError(refreshError?.message || 'Could not load Square Biz Host state.');
    }
  }, [controllerId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 550);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phase !== 'intro') {
      const audio = jingleRef.current;
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [phase]);

  const stopJingle = useCallback(() => {
    const audio = jingleRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const startJingle = useCallback(async () => {
    const audio = jingleRef.current;
    if (!audio) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }, []);

  const act = useCallback(async (action, payload = {}) => {
    if (!controllerId || busy) return false;

    setBusy(true);
    setError('');

    const shouldStartJingle = action === 'start_round' || action === 'replay_intro';
    const shouldStopJingle = action === 'skip_intro' || action === 'reset_board';

    if (shouldStartJingle) {
      // Start from the Host's click gesture before any network await, so browsers
      // treat this as intentional media playback rather than blocked autoplay.
      startJingle();
    } else if (shouldStopJingle) {
      stopJingle();
    }

    try {
      const response = await tngApi.squareBiz.hostAction(controllerId, action, payload);
      setRoom(response.room || null);
      return true;
    } catch (actionError) {
      if (shouldStartJingle) stopJingle();
      setError(actionError?.message || 'That Square Biz Host action could not be completed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, controllerId, startJingle, stopJingle]);

  const status = useMemo(() => {
    if (phase === 'lobby') return players.length >= 2 ? 'READY TO START' : 'WAITING FOR PLAYERS';
    if (phase === 'intro') return 'SHOW OPEN';
    if (phase === 'board') return `PLAYER ${gameState.currentMark} PICKS`;
    if (phase === 'question_read') return 'QUESTION ON SCREEN';
    if (phase === 'answering') return `PLAYER ${gameState.currentMark} ANSWERING`;
    if (phase === 'result') return gameState.answerResult ? 'CORRECT' : 'WRONG';
    if (phase === 'finished') return `PLAYER ${gameState.winner} WINS`;
    return 'SQUARE BIZ';
  }, [gameState.answerResult, gameState.currentMark, gameState.winner, phase, players.length]);

  if (!room && !error) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#ff781f]" />
        <span className="text-sm text-white/40">Loading Square Biz controls…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-2">
      <SquareBizShowStyles />
      <audio
        ref={jingleRef}
        src="/assets/square-biz/Square%20Biz!.mp3"
        preload="auto"
        playsInline
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
          {error}
        </div>
      )}

      <header className="flex items-center justify-between gap-3 rounded-xl border border-[#ff781f]/25 bg-black/55 px-3 py-2.5">
        <div>
          <div className="text-[7px] uppercase tracking-[.22em] text-[#ff781f]" style={MONO}>SQUARE BIZ! · HOST CONTROL</div>
          <div className="mt-1 text-xs text-white/35">You run the show. Player X and Player O play the board.</div>
        </div>
        <div className="rounded-lg border border-[#ffd633]/45 px-3 py-2 text-[7px] uppercase tracking-widest text-[#ffd633]" style={MONO}>
          {status}
        </div>
      </header>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.65fr)]">
        <section className="relative flex min-h-[390px] items-center justify-center overflow-hidden rounded-xl border border-[#ff781f]/15 bg-[#08030e]/70 p-2">
          <SquareBizBoard
            compact
            gameState={{ ...gameState, canSelectSquare: false }}
            interactive={false}
            hostLabel="HOST PANEL"
          />

          {['question_read', 'answering', 'result'].includes(phase) && (
            <div className="absolute inset-0 z-30 bg-[#05020a]/25 backdrop-blur-[1.5px]">
              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-[#ffd633]/25 bg-[#10091a]/94 p-3">
                <div className="text-[6px] uppercase tracking-widest text-[#ffd633]" style={MONO}>
                  CURRENT CUE · {phase === 'question_read' ? 'READING' : phase === 'answering' ? 'CHOICES LIVE' : 'RESULT'}
                </div>
                <div className="mt-2 text-sm font-black text-white/85">{currentQuestion?.question}</div>
                {phase !== 'question_read' && Array.isArray(currentQuestion?.choices) && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {currentQuestion.choices.map((choice, index) => {
                      const letter = ['A','B','C','D'][index];
                      const correct = phase === 'result' && gameState.correctAnswer === letter;
                      const selected = gameState.selectedAnswer === letter;
                      return (
                        <div
                          key={letter}
                          className="rounded-lg border px-2 py-1.5 text-[10px]"
                          style={{
                            borderColor: correct ? '#4ade80' : selected ? '#ffd633' : 'rgba(255,255,255,.10)',
                            color: correct ? '#4ade80' : selected ? '#ffd633' : 'rgba(255,255,255,.55)',
                          }}
                        >
                          <b>{letter}.</b> {choice}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-2">
          <section className="rounded-xl border border-white/10 bg-black/50 p-3">
            <div className="mb-2 text-[6px] uppercase tracking-[.18em] text-white/30" style={MONO}>CONTESTANTS</div>
            <div className="space-y-2">
              <PlayerCard player={xPlayer} mark="X" current={gameState.currentMark === 'X' && !['lobby','intro','finished'].includes(phase)} />
              <PlayerCard player={oPlayer} mark="O" current={gameState.currentMark === 'O' && !['lobby','intro','finished'].includes(phase)} />
            </div>
          </section>

          <section className="rounded-xl border border-[#ffd633]/20 bg-[#ffd633]/[.03] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[6px] uppercase tracking-widest text-[#ffd633]/70" style={MONO}>QUEUE / VIEWERS</div>
              <div className="text-sm font-black text-[#ffd633]">{queued.length}</div>
            </div>
            <div className="mt-2 max-h-[125px] space-y-1 overflow-y-auto pr-1">
              {queued.length ? queued.map((player) => (
                <div key={player.accountId} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[.02] px-2 py-1.5 text-[10px]">
                  <span className="truncate text-white/55">{player.name}</span>
                  <span className="ml-2 text-[8px] text-[#ffd633]/60">#{player.queuePosition || '—'}</span>
                </div>
              )) : (
                <div className="text-[10px] text-white/25">Nobody waiting.</div>
              )}
            </div>
          </section>

          <section className="flex-1 rounded-xl border border-white/10 bg-black/45 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/8 bg-white/[.02] p-2 text-center">
                <div className="text-[5px] uppercase text-white/25" style={MONO}>ROUND</div>
                <div className="mt-1 text-xl text-[#ffd633]" style={MONO}>{gameState.roundNumber || 0}</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[.02] p-2 text-center">
                <div className="text-[5px] uppercase text-white/25" style={MONO}>TURN</div>
                <div className="mt-1 text-xl" style={{ ...MONO, color: gameState.currentMark === 'X' ? X_COLOR : O_COLOR }}>{gameState.currentMark || 'X'}</div>
              </div>
            </div>

            {phase === 'answering' && gameState.answerDeadlineAt && (
              <div className="mt-2 rounded-lg border border-[#ffd633]/20 bg-[#ffd633]/5 p-2 text-center">
                <div className="text-[5px] uppercase tracking-widest text-[#ffd633]/60" style={MONO}>ANSWER TIME</div>
                <div className="mt-1 text-2xl text-[#ffd633]" style={MONO}>
                  {Math.max(0, Math.ceil((Number(gameState.answerDeadlineAt) - clock) / 1000))}
                </div>
              </div>
            )}

            {phase === 'finished' && (
              <div className="mt-2 rounded-lg border p-3 text-center" style={{
                borderColor: gameState.winner === 'X' ? X_COLOR : O_COLOR,
                background: gameState.winner === 'X' ? `${X_COLOR}0c` : `${O_COLOR}0c`,
              }}>
                <div className="text-[6px] uppercase tracking-widest text-white/40" style={MONO}>WINNER</div>
                <div className="mt-1 text-2xl font-black" style={{ color: gameState.winner === 'X' ? X_COLOR : O_COLOR }}>PLAYER {gameState.winner}</div>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="rounded-xl border border-[#9f45ff]/20 bg-black/55 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[6px] uppercase tracking-[.18em] text-[#9f45ff]" style={MONO}>GAME CONTROLS</div>
          {busy && <div className="text-[7px] text-[#ffd633]" style={MONO}>SYNCING…</div>}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Control
            tone="#4ade80"
            disabled={busy || players.length < 2 || !['lobby','finished'].includes(phase)}
            onClick={() => act('start_round', { introDurationMs: 30_800 })}
          >
            ▶ START ROUND
          </Control>
          <Control
            tone="#ff781f"
            disabled={busy || phase !== 'intro'}
            onClick={() => act('skip_intro')}
          >
            ⏭ SKIP INTRO
          </Control>
          <Control
            tone="#9f45ff"
            disabled={busy || !gameState.roundNumber}
            onClick={() => act('replay_intro', { introDurationMs: 30_800 })}
          >
            ↻ REPLAY INTRO
          </Control>
          <Control
            tone="#ffd633"
            disabled={busy || !gameState.currentQuestion}
            onClick={() => act('replay_question')}
          >
            ↻ REPLAY QUESTION
          </Control>
          <Control
            tone="#25b9ff"
            disabled={busy || !['board','question_read','answering','result'].includes(phase)}
            onClick={() => act('next_turn')}
          >
            ⇥ NEXT TURN
          </Control>
          <Control
            tone="#ef4444"
            disabled={busy || !gameState.roundNumber}
            onClick={() => act('reset_board')}
          >
            ↺ RESET BOARD
          </Control>
        </div>
      </section>
    </div>
  );
}
