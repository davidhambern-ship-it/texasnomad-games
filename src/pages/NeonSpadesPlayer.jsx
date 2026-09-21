import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';

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

export default function NeonSpadesPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [hand, setHand] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionLockRef = useRef(false);

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const players = gameState.players || [];
  const mySeat = Number(participant?.seatNumber || 0);
  const sortedHand = useMemo(() => sortHand(hand), [hand]);
  const phase = gameState.phase || 'setup';
  const currentTurnSeat = Number(gameState.currentTurnSeat || 0);
  const currentTrick = gameState.currentTrick || [];
  const activeSuit = getActiveSuit(currentTrick);
  const isMyTurn = mySeat > 0 && phase === 'playing' && currentTurnSeat === mySeat;

  const legalCardIds = useMemo(() => {
    if (!isMyTurn) return new Set();

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
    isMyTurn,
    sortedHand,
  ]);

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode) return;

    try {
      const payload = await tngApi.spades.getPlayerState(deviceId, roomCode);
      setRoom(payload.room);
      setParticipant(payload.participant);
      setHand(payload.hand || []);
      setError('');
    } catch (stateError) {
      setError(stateError.message || 'The live Spades room could not be loaded.');
    }
  }, [deviceId, roomCode]);

  const act = useCallback(async (action, payload = {}) => {
    if (!deviceId || actionLockRef.current) return false;

    actionLockRef.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await tngApi.spades.playerAction(
        deviceId,
        roomCode,
        action,
        payload,
      );
      setRoom(result.room);
      setParticipant(result.participant);
      setHand(result.hand || []);
      return true;
    } catch (actionError) {
      setError(actionError.message || 'That player action could not be completed.');
      return false;
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }, [deviceId, roomCode]);

  useEffect(() => {
    if (!deviceId) return undefined;

    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [deviceId, refresh]);

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <div className="text-xl text-red-400 mb-4">Player device not registered.</div>
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
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#BC13FE]" />
          <div className="text-sm text-white/40">Connecting to room {roomCode}…</div>
        </div>
      </div>
    );
  }

  const seatPlayer = (seat) => players.find((player) => Number(player.seatNumber) === seat);

  return (
    <div className="min-h-screen bg-[#070311] text-white">
      <header className="sticky top-0 z-40 border-b border-[#BC13FE]/30 bg-[#070311]/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <div className="text-[8px] uppercase tracking-[0.22em] text-[#BC13FE]" style={PS2}>
              TEXASNOMAD SPADES · PLAYER
            </div>
            <div className="mt-1 font-mono text-lg tracking-[0.18em] text-[#FFD700]">
              ROOM {roomCode}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[7px] uppercase tracking-[0.16em] text-white/30" style={PS2}>
              {mySeat ? `SEAT ${mySeat}` : 'NOT SEATED'}
            </div>
            <div className={`mt-1 text-sm ${isMyTurn ? 'text-green-400' : 'text-white/45'}`}>
              {isMyTurn ? 'YOUR TURN' : String(phase).replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[#BC13FE]/30 bg-black/45 p-5">
          <div className="mb-4 flex items-center gap-2 text-[#BC13FE]">
            <Users className="h-4 w-4" />
            <span className="text-[8px] uppercase tracking-[0.18em]" style={PS2}>
              LIVE TABLE
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((seat) => {
              const player = seatPlayer(seat);
              const isMe = seat === mySeat;
              const isHostSeat = seat === 1;
              const canTakeSeat = !isHostSeat && !isMe && (
                !player || player.playerType === 'cpu'
              );

              return (
                <div
                  key={seat}
                  className="rounded-xl border bg-black/60 p-4"
                  style={{
                    borderColor: isMe
                      ? '#FFD700'
                      : currentTurnSeat === seat
                        ? '#4ade80'
                        : 'rgba(255,255,255,.12)',
                    boxShadow: isMe ? '0 0 24px rgba(255,215,0,.12)' : 'none',
                  }}
                >
                  <div className="text-[7px] uppercase tracking-[0.16em] text-white/30" style={PS2}>
                    SEAT {seat} · TEAM {seat === 1 || seat === 3 ? 1 : 2}
                  </div>
                  <div className="mt-2 text-lg">
                    {player?.name || (isHostSeat ? 'HOST' : 'Empty')}
                  </div>
                  <div className="mt-1 text-xs text-white/35">
                    {isHostSeat
                      ? 'Host Player'
                      : player?.playerType === 'cpu'
                        ? 'CPU'
                        : player
                          ? 'Player'
                          : 'Open Seat'}
                  </div>

                  {isMe && (
                    <div className="mt-3 rounded-md border border-[#FFD700]/35 bg-[#FFD700]/10 px-2 py-2 text-center text-[7px] text-[#FFD700]" style={PS2}>
                      YOU
                    </div>
                  )}

                  {canTakeSeat && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act('sit', { seatNumber: seat })}
                      className="mt-3 w-full rounded-lg border border-[#BC13FE]/50 px-3 py-2 text-[7px] uppercase tracking-widest text-[#BC13FE] disabled:opacity-40"
                      style={PS2}
                    >
                      TAKE SEAT
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/45 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#FFD700]" style={PS2}>
                YOUR HAND
              </div>
              <div className="mt-2 text-xs text-white/35">
                {mySeat
                  ? `Seat ${mySeat} · ${sortedHand.length} cards`
                  : 'Take a seat to receive a private hand.'}
              </div>
            </div>

            {isMyTurn && (
              <div className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-2 text-[7px] uppercase tracking-[0.14em] text-green-400" style={PS2}>
                SELECT A LEGAL CARD
              </div>
            )}
          </div>

          {sortedHand.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/25">
              {!mySeat
                ? 'Choose Seat 2, 3, or 4.'
                : phase === 'setup'
                  ? 'Waiting for the Host to set the table and deal.'
                  : 'No cards in your hand yet.'}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {sortedHand.map((card) => {
                const legal = legalCardIds.has(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={busy || !legal}
                    onClick={() => act('play_card', { cardId: card.id })}
                    className="overflow-hidden rounded-md border bg-black transition disabled:cursor-default"
                    style={{
                      width: 64,
                      height: 92,
                      borderColor: legal ? 'rgba(74,222,128,.75)' : 'rgba(255,255,255,.15)',
                      opacity: isMyTurn ? (legal ? 1 : 0.28) : 0.72,
                      transform: legal ? 'translateY(-3px)' : 'none',
                      boxShadow: legal
                        ? '0 8px 22px rgba(74,222,128,.14)'
                        : '0 6px 16px rgba(0,0,0,.35)',
                    }}
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
        </section>

        {currentTrick.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-black/45 p-5">
            <div className="mb-4 text-[8px] uppercase tracking-[0.18em] text-white/35" style={PS2}>
              CURRENT TRICK
            </div>
            <div className="flex flex-wrap justify-center gap-5">
              {currentTrick.map((play, index) => (
                <div key={play.card?.id || index} className="text-center">
                  <img
                    src={getCardImage(play.card)}
                    alt=""
                    className="h-24 w-16 rounded-md object-contain"
                  />
                  <div className="mt-2 text-[7px] text-white/35" style={PS2}>
                    SEAT {play.seatNumber}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
