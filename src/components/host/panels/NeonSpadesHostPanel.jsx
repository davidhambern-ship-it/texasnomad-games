import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, LockKeyhole, Shuffle, Users } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import { getCardImage } from '@/lib/spadesCardImages';
import { getActiveSuit, isValidPlay } from '@/lib/spadesRules';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SUIT_ORDER = { '♣': 0, '♦': 1, '♥': 2, '♠': 3, Joker: 4 };
const VALUE_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
  LJ: 15, BJ: 16,
};

function sortHand(hand) {
  return [...(hand || [])].sort((a, b) => {
    const suitDiff = (SUIT_ORDER[a.suit] ?? 9) - (SUIT_ORDER[b.suit] ?? 9);
    if (suitDiff !== 0) return suitDiff;
    return (VALUE_ORDER[a.value] ?? 0) - (VALUE_ORDER[b.value] ?? 0);
  });
}

export default function NeonSpadesHostPanel({ controllerId }) {
  const [state, setState] = useState(null);
  const [hand, setHand] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const actionLockRef = useRef(false);

  const gameState = state?.gameState || {};
  const players = gameState.players || [];
  const sortedHand = useMemo(() => sortHand(hand), [hand]);
  const currentTrick = gameState.currentTrick || [];
  const activeSuit = getActiveSuit(currentTrick);
  const phase = gameState.phase || 'setup';
  const currentTurnSeat = Number(gameState.currentTurnSeat || 0);
  const handNumber = Number(gameState.handNumber || 0);
  const isHostTurn = phase === 'playing' && currentTurnSeat === 1;
  const tableReady = players.length === 4;

  const legalCardIds = useMemo(() => {
    if (!isHostTurn) return new Set();

    return new Set(
      sortedHand
        .filter((card) => (
          isValidPlay(
            card,
            sortedHand,
            currentTrick,
            activeSuit,
            gameState.spadesBroken === true,
            currentTrick.length === 0,
          ).valid
        ))
        .map((card) => card.id),
    );
  }, [
    activeSuit,
    currentTrick,
    gameState.spadesBroken,
    isHostTurn,
    sortedHand,
  ]);

  const refresh = useCallback(async () => {
    if (!controllerId) return;

    try {
      const payload = await tngApi.spades.getHostState(controllerId);
      setState(payload.room);
      setHand(payload.hand || []);
      setError('');
    } catch (stateError) {
      setError(stateError.message || 'The Spades table could not be loaded.');
    }
  }, [controllerId]);

  const act = useCallback(async (action, payload = {}) => {
    if (!controllerId || actionLockRef.current) return false;

    actionLockRef.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await tngApi.spades.hostAction(controllerId, action, payload);
      setState(result.room);
      setHand(result.hand || []);
      return true;
    } catch (actionError) {
      setError(actionError.message || 'That Spades action could not be completed.');
      return false;
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }, [controllerId]);

  useEffect(() => {
    if (!controllerId) return undefined;

    refresh();
    const interval = window.setInterval(refresh, 1200);
    return () => window.clearInterval(interval);
  }, [controllerId, refresh]);

  // Give the TV time to finish its shuffle + 52-card deal animation before
  // gameplay begins. This keeps the authoritative server state and presentation
  // layer in sync without giving the Game Display permission to mutate gameplay.
  useEffect(() => {
    if (phase !== 'dealt' || handNumber < 1) return undefined;

    const timer = window.setTimeout(() => {
      act('start_hand');
    }, 10500);

    return () => window.clearTimeout(timer);
  }, [act, handNumber, phase]);

  // CPU turns are requested by the trusted Host Controller, but the card choice
  // and legality checks happen on the server.
  useEffect(() => {
    if (phase !== 'playing' || ![2, 3, 4].includes(currentTurnSeat)) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      act('cpu_turn');
    }, 700);

    return () => window.clearTimeout(timer);
  }, [act, currentTrick.length, currentTurnSeat, phase]);

  // Leave a completed four-card trick visible on the TV briefly before the
  // server awards the book and clears the table.
  useEffect(() => {
    if (phase !== 'resolving' || !gameState.trickWinnerSeat) return undefined;

    const timer = window.setTimeout(() => {
      act('resolve_trick');
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [act, gameState.trickWinnerSeat, phase]);

  if (!state) {
    return (
      <div className="py-14 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#BC13FE]" />
        <div className="text-sm text-white/40">Loading secure Spades table…</div>
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      </div>
    );
  }

  const canDeal = tableReady && !['dealt', 'playing', 'resolving', 'bidding'].includes(phase);
  const lastResult = gameState.lastHandResult || null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#BC13FE]/30 bg-black/60 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#BC13FE]">
              <LockKeyhole className="h-4 w-4" />
              <span className="text-[8px] uppercase tracking-[0.18em]" style={PS2}>
                SERVER-AUTHORITATIVE SPADES
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
              Your hand stays private. The server validates every play, runs CPU turns,
              resolves books, and sends only public table state to the Game Display.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => act('setup_demo')}
              className="rounded-lg border border-[#BC13FE]/50 px-4 py-3 text-[#BC13FE] disabled:opacity-40"
            >
              <Users className="mr-2 inline h-4 w-4" />
              SET TABLE
            </button>

            <button
              type="button"
              disabled={busy || !canDeal}
              onClick={() => act('deal')}
              className="rounded-lg border border-[#FFD700]/50 px-4 py-3 text-[#FFD700] disabled:opacity-40"
            >
              <Shuffle className="mr-2 inline h-4 w-4" />
              SHUFFLE + DEAL
            </button>
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-400">{error}</div>}
      </div>

      {handNumber > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[7px] uppercase tracking-[0.16em] text-white/25" style={PS2}>
                HAND {handNumber}
              </div>
              <div className="mt-2 text-lg text-white">
                {phase === 'dealt' && 'Shuffle + deal animation in progress…'}
                {phase === 'playing' && (
                  currentTurnSeat === 1
                    ? 'Your turn to play.'
                    : `Seat ${currentTurnSeat} is playing…`
                )}
                {phase === 'resolving' && (
                  `Seat ${gameState.trickWinnerSeat} takes the book.`
                )}
                {phase === 'bidding' && 'Bidding begins with this hand.'}
                {phase === 'round_over' && 'Hand complete.'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {handNumber === 1 && (
                <div className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/[0.06] px-3 py-2 text-[#FFD700]">
                  FIRST HAND BIDS ITSELF
                </div>
              )}
              <div className="rounded-full border border-[#BC13FE]/25 px-3 py-2 text-[#BC13FE]">
                TEAM 1 BOOKS: {gameState.books1 || 0}
              </div>
              <div className="rounded-full border border-[#FF5F1F]/25 px-3 py-2 text-[#FF5F1F]">
                TEAM 2 BOOKS: {gameState.books2 || 0}
              </div>
            </div>
          </div>

          {lastResult && phase === 'round_over' && (
            <div className="mt-4 border-t border-white/[0.07] pt-4 text-sm text-white/50">
              Hand {lastResult.handNumber}: Team 1 won {lastResult.books1} books and Team 2 won {lastResult.books2}.
              {' '}Score: {lastResult.score1}–{lastResult.score2}.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((seat) => {
          const player = players.find((item) => item.seatNumber === seat);
          const team = seat === 1 || seat === 3 ? 1 : 2;
          const isHost = seat === 1;
          const isTurn = phase === 'playing' && currentTurnSeat === seat;

          return (
            <div
              key={seat}
              className="rounded-xl border bg-black/50 p-4"
              style={{
                borderColor: isTurn
                  ? '#FFD700'
                  : isHost
                    ? 'rgba(188,19,254,.45)'
                    : 'rgba(255,255,255,.10)',
                boxShadow: isTurn ? '0 0 22px rgba(255,215,0,.12)' : 'none',
              }}
            >
              <div className="text-[7px] uppercase tracking-[0.18em] text-white/30" style={PS2}>
                SEAT {seat} · TEAM {team}
              </div>
              <div className="mt-2 text-lg text-white">
                {player?.name || 'Empty'}
              </div>
              <div className="mt-1 text-xs text-white/35">
                {player?.playerType === 'cpu' ? 'CPU' : isHost ? 'Host Player' : 'Player'}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 font-mono text-sm">
                <span className="text-[#FFD700]">{player?.cardCount || 0} cards</span>
                <span className="text-white/35">{player?.tricksWon || 0} books</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-xl border bg-black/60 p-4"
        style={{
          borderColor: isHostTurn ? 'rgba(255,215,0,.65)' : 'rgba(255,215,0,.25)',
          boxShadow: isHostTurn ? '0 0 28px rgba(255,215,0,.10)' : 'none',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[8px] uppercase tracking-[0.18em] text-[#FFD700]" style={PS2}>
              YOUR HAND
            </div>
            <div className="mt-1 text-xs text-white/35">
              Seat 1 · {sortedHand.length} cards
              {isHostTurn && ' · SELECT A LEGAL CARD'}
            </div>
          </div>

          {isHostTurn && (
            <div className="rounded-full border border-green-400/30 bg-green-400/[0.06] px-3 py-2 text-[7px] uppercase tracking-[0.14em] text-green-400" style={PS2}>
              YOUR TURN
            </div>
          )}
        </div>

        {sortedHand.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/25">
            {phase === 'round_over'
              ? 'Hand complete.'
              : 'Set the table, then shuffle and deal.'}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {sortedHand.map((card) => {
              const legal = legalCardIds.has(card.id);
              const disabled = busy || !legal;

              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => act('play_card', { cardId: card.id })}
                  className="overflow-hidden rounded-md border bg-black shadow-lg transition duration-150 disabled:cursor-default"
                  style={{
                    width: 64,
                    height: 92,
                    borderColor: legal ? 'rgba(74,222,128,.7)' : 'rgba(255,255,255,.15)',
                    opacity: isHostTurn ? (legal ? 1 : 0.28) : 0.72,
                    transform: legal ? 'translateY(-2px)' : 'none',
                    boxShadow: legal
                      ? '0 8px 20px rgba(74,222,128,.12)'
                      : '0 6px 16px rgba(0,0,0,.35)',
                  }}
                  title={
                    isHostTurn
                      ? (legal ? `Play ${card.value}${card.suit}` : 'Not legal for this trick')
                      : 'Wait for your turn'
                  }
                >
                  <img
                    src={getCardImage(card)}
                    alt={card.value + card.suit}
                    className="h-full w-full object-contain"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
