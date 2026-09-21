import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import {
  SquareBizBoard,
  SquareBizCueCard,
  SquareBizIntro,
  SquareBizShowStyles,
} from '@/components/square-biz/SquareBizShow';

const MONO = { fontFamily: "'Press Start 2P', monospace" };
const X_COLOR = '#ff1593';
const O_COLOR = '#25b9ff';

function statusFor(gameState) {
  const phase = gameState.phase || 'lobby';
  if (phase === 'lobby') return 'WAITING FOR HOST';
  if (phase === 'intro') return 'SHOW OPEN';
  if (phase === 'board') return gameState.canSelectSquare ? 'PICK A SQUARE' : `PLAYER ${gameState.currentMark} TURN`;
  if (phase === 'question_read') return gameState.canAnswer ? 'READ THE QUESTION' : 'QUESTION LIVE';
  if (phase === 'answering') return gameState.canAnswer ? 'CHOOSE YOUR ANSWER' : 'ANSWERING';
  if (phase === 'result') return gameState.answerResult ? 'CORRECT!' : 'WRONG!';
  if (phase === 'finished') return `PLAYER ${gameState.winner} WINS!`;
  return 'SQUARE BIZ!';
}

export default function NeonSquareBizPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const myPlayer = players.find((player) => player.mark === gameState.myMark)
    || players.find((player) => player.accountId === gameState.currentPlayerAccountId && gameState.myMark)
    || null;
  const mark = gameState.myMark || null;
  const markColor = mark === 'X' ? X_COLOR : mark === 'O' ? O_COLOR : '#ffd633';
  const phase = gameState.phase || 'lobby';

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode) return;

    try {
      const payload = await tngApi.squareBiz.getPlayerState(deviceId, roomCode);
      setRoom(payload.room || null);
      setParticipant(payload.participant || null);
      setError('');
    } catch (stateError) {
      setError(stateError?.message || 'Square Biz could not be loaded.');
    }
  }, [deviceId, roomCode]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 550);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  const act = useCallback(async (action, payload = {}) => {
    if (!deviceId || !roomCode || busy) return;

    setBusy(true);
    setError('');

    try {
      const response = await tngApi.squareBiz.playerAction(
        deviceId,
        roomCode,
        action,
        payload,
      );
      setRoom(response.room || null);
      setParticipant(response.participant || null);
    } catch (actionError) {
      setError(actionError?.message || 'That Square Biz move could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [busy, deviceId, roomCode]);

  const currentPlayer = players.find((player) => player.isCurrent);
  const queuePosition = gameState.myQueuePosition || null;

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-[#05020a] text-white flex items-center justify-center px-4 text-center">
        <div>
          <div className="mb-4 text-red-400">Player device not registered.</div>
          <Link to={`/join/${roomCode}`} className="text-[#ffd633] underline">Rejoin room {roomCode}</Link>
        </div>
      </div>
    );
  }

  if (!room && !error) {
    return (
      <div className="min-h-screen bg-[#05020a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#ff781f]" />
          <div className="text-sm text-white/40">Opening Square Biz room {roomCode}…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen lg:h-[100dvh] lg:overflow-hidden bg-[#05020a] text-white">
      <SquareBizShowStyles />

      <div className="pointer-events-none absolute inset-0 opacity-60" style={{
        background:
          'radial-gradient(circle at 12% 16%, rgba(159,69,255,.18), transparent 24%), radial-gradient(circle at 86% 72%, rgba(255,21,147,.15), transparent 26%), radial-gradient(circle at 58% 46%, rgba(255,120,31,.08), transparent 42%)',
      }} />

      <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-2 p-2 lg:h-full lg:min-h-0">
        <header className="z-20 shrink-0 rounded-xl border border-white/10 bg-[#0c0714]/86 px-3 py-2.5 backdrop-blur flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[7px] uppercase tracking-[.25em] text-[#ff781f]" style={MONO}>SQUARE BIZ!</div>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="font-mono text-base tracking-[.16em] text-[#ffd633]">{roomCode}</span>
              {mark ? (
                <span className="rounded-full border px-2 py-1 text-[7px] uppercase tracking-widest" style={{ ...MONO, borderColor: markColor, color: markColor }}>
                  PLAYER {mark}
                </span>
              ) : (
                <span className="rounded-full border border-[#ffd633]/35 px-2 py-1 text-[7px] uppercase tracking-widest text-[#ffd633]/75" style={MONO}>
                  VIEWER / QUEUE
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-lg border px-2.5 py-2 text-[6px] uppercase tracking-widest" style={{ ...MONO, borderColor: `${markColor}66`, color: markColor }}>
              {statusFor(gameState)}
            </div>
            <Link to="/" replace className="rounded-lg border border-white/15 px-2.5 py-2 text-[6px] uppercase tracking-widest text-white/40" style={MONO}>
              EXIT
            </Link>
          </div>
        </header>

        {error && (
          <div className="z-20 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
            {error}
          </div>
        )}

        <main className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#ff781f]/15 bg-[#090411]/72">
          {phase === 'lobby' ? (
            <div className="flex h-full min-h-[520px] items-center justify-center px-5 text-center">
              <div className="max-w-xl">
                <div className="text-[9px] uppercase tracking-[.34em] text-[#ffd633]/65" style={MONO}>SHOW STARTS WHEN THE HOST SAYS SO</div>
                <div className="mt-5 text-[clamp(3rem,9vw,7rem)] font-black uppercase leading-[.83] text-[#ff781f]" style={{ fontFamily: "Impact, sans-serif", textShadow: '4px 4px 0 #7c2de0, -3px 2px 0 #ff1593' }}>
                  SQUARE<br />BIZ!
                </div>
                <div className="mt-6 text-white/55">
                  {mark
                    ? `You’re locked in as Player ${mark}. Get ready.`
                    : queuePosition
                      ? `You’re #${queuePosition} in the queue. Watch the round and stay ready.`
                      : 'The first two active contestants become Player X and Player O when the Host starts the round.'}
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {players.slice(0, 6).map((player) => (
                    <div key={player.accountId} className="rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-left">
                      <div className="truncate text-sm font-bold text-white/80">{player.name}</div>
                      <div className="mt-1 text-[8px] uppercase tracking-widest" style={{ ...MONO, color: player.mark === 'X' ? X_COLOR : player.mark === 'O' ? O_COLOR : '#ffd63399' }}>
                        {player.mark ? `PLAYER ${player.mark}` : player.queuePosition ? `QUEUE #${player.queuePosition}` : 'VIEWER'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex h-full min-h-[520px] items-center justify-center p-2 sm:p-3">
              <div className={`flex h-full w-full items-center justify-center transition-all duration-300 ${['question_read','answering','result'].includes(phase) ? 'scale-[.985] blur-[2px] brightness-50' : ''}`}>
                <SquareBizBoard
                  gameState={gameState}
                  interactive={!busy}
                  onSquareClick={(squareIndex) => act('select_square', { squareIndex })}
                />
              </div>

              <SquareBizCueCard
                gameState={gameState}
                now={clock}
                busy={busy}
                onAnswer={(answer) => act('answer', { answer })}
              />

              {phase === 'finished' && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#05020a]/38">
                  <div className="sb-result-pop rounded-[30px] border-2 px-8 py-6 text-center backdrop-blur-md" style={{
                    borderColor: gameState.winner === 'X' ? X_COLOR : O_COLOR,
                    background: 'rgba(11,4,20,.90)',
                    boxShadow: `0 0 60px ${gameState.winner === 'X' ? 'rgba(255,21,147,.28)' : 'rgba(37,185,255,.28)'}`,
                  }}>
                    <div className="text-[8px] uppercase tracking-[.3em] text-[#ffd633]" style={MONO}>ROUND {gameState.roundNumber}</div>
                    <div className="mt-3 text-[clamp(2.8rem,8vw,6rem)] font-black uppercase leading-none" style={{
                      fontFamily: 'Impact, sans-serif',
                      color: gameState.winner === 'X' ? X_COLOR : O_COLOR,
                      textShadow: '0 0 24px currentColor',
                    }}>
                      PLAYER {gameState.winner}<br />TAKES THE BIZ!
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'intro' && (
            <SquareBizIntro gameState={gameState} now={clock} />
          )}
        </main>

        <footer className="z-20 shrink-0 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0c0714]/76 px-3 py-2 text-[10px] text-white/35">
          <span>
            {mark
              ? gameState.currentMark === mark
                ? phase === 'board' ? 'Your turn — choose an open square.' : phase === 'answering' ? 'Your question — choose wisely.' : 'You’re live.'
                : `Waiting for ${currentPlayer?.name || `Player ${gameState.currentMark || 'X'}`}.`
              : 'Watching this round.'}
          </span>
          {busy && <span className="text-[#ffd633]">SYNCING…</span>}
        </footer>
      </div>
    </div>
  );
}
