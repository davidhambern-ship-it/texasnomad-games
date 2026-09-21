import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import SpadesTable from '@/components/spades/SpadesTable';
import SpadesShuffleAnimation from '@/components/spades/SpadesShuffleAnimation';
import SpadesDealAnimation from '@/components/spades/SpadesDealAnimation';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function isValidPlayerParticipant(participant) {
  const role = String(participant?.role || '').toLowerCase();
  const seatNumber = Number(participant?.seatNumber || 0);
  return role === 'player' && seatNumber !== 1;
}

export default function NeonSpadesPlayer({ roomCode }) {
  const [room, setRoom] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [hand, setHand] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dealVisualPhase, setDealVisualPhase] = useState('idle');
  const [visualCardCounts, setVisualCardCounts] = useState(null);
  const [visualHand, setVisualHand] = useState(null);
  const actionLockRef = useRef(false);
  const lastAnimatedHandRef = useRef(0);

  const deviceId = localStorage.getItem('tng_player_device_id');
  const gameState = room?.gameState || {};
  const mySeat = Number(participant?.seatNumber || 0);
  const phase = gameState.phase || 'setup';
  const handNumber = Number(gameState.handNumber || 0);
  const currentTurnSeat = Number(gameState.currentTurnSeat || 0);
  const currentBidderSeat = Number(gameState.currentBidderSeat || 0);
  const isMyTurn = mySeat > 0 && phase === 'playing' && currentTurnSeat === mySeat;
  const isMyBidTurn = mySeat > 0 && phase === 'bidding' && currentBidderSeat === mySeat;
  const playerStatusLabel =
    dealVisualPhase === 'shuffling'
      ? 'SHUFFLING'
      : dealVisualPhase === 'dealing'
        ? 'DEALING'
        : isMyBidTurn
          ? 'YOUR BID'
          : phase === 'bidding'
            ? `SEAT ${currentBidderSeat || '?'} BIDDING`
            : isMyTurn
              ? 'YOUR TURN'
              : String(phase).replace(/_/g, ' ');
  const neonPlayerId = 'neon-current-player';

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode) return;

    try {
      const payload = await tngApi.spades.getPlayerState(deviceId, roomCode);

      if (payload?.participant && !isValidPlayerParticipant(payload.participant)) {
        setRoom(payload.room || null);
        setParticipant(null);
        setHand([]);
        setError(
          'This TNG account is the Host for this room. Use a different TNG account to join as a player.',
        );
        return;
      }

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

      if (result?.participant && !isValidPlayerParticipant(result.participant)) {
        setParticipant(null);
        setHand([]);
        setError(
          'This TNG account is the Host for this room. Use a different TNG account to join as a player.',
        );
        return false;
      }

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

  useEffect(() => {
    const lastAnimatedHand = lastAnimatedHandRef.current;

    if (phase === 'setup' || handNumber < lastAnimatedHand) {
      lastAnimatedHandRef.current = handNumber;
      setDealVisualPhase('idle');
      setVisualCardCounts(null);
      setVisualHand(null);
      return;
    }

    if (phase === 'dealt' && handNumber > lastAnimatedHand) {
      lastAnimatedHandRef.current = handNumber;
      setVisualCardCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
      setVisualHand([]);
      setDealVisualPhase('shuffling');
    }
  }, [handNumber, phase]);

  const tableState = useMemo(() => {
    const sourcePlayers = Array.isArray(gameState.players) ? gameState.players : [];

    const players = sourcePlayers.map((player) => {
      const seatNumber = Number(player.seatNumber);
      const isMe = mySeat > 0 && seatNumber === mySeat;

      return {
        ...player,
        seatNumber,
        playerId: isMe ? neonPlayerId : `neon-seat-${seatNumber}`,
        hand: isMe ? hand : undefined,
        cardCount: isMe ? hand.length : Number(player.cardCount || 0),
      };
    });

    return {
      ...gameState,
      players,
      phase,
      current_turn_seat: gameState.currentTurnSeat ?? null,
      current_bidder_seat: gameState.currentBidderSeat ?? null,
      current_trick: Array.isArray(gameState.currentTrick) ? gameState.currentTrick : [],
      tricks_played: Number(gameState.tricksPlayed || 0),
      spades_broken: gameState.spadesBroken === true,
      first_hand_no_bid: gameState.firstHandNoBid === true,
      dealer_seat: Number(gameState.dealerSeat || 1),
      deal_start_seat: gameState.dealStartSeat ?? null,
      hand_number: Number(gameState.handNumber || 0),
    };
  }, [gameState, hand, mySeat, phase]);

  const joinableSeats = useMemo(() => {
    const players = tableState.players || [];

    return [2, 3, 4].filter((seat) => {
      const player = players.find((item) => Number(item.seatNumber) === seat);
      return !player || player.playerType === 'cpu';
    });
  }, [tableState.players]);

  const emptySeats = useMemo(() => {
    const players = tableState.players || [];
    return [2, 3, 4].filter(
      (seat) => !players.some((player) => Number(player.seatNumber) === seat),
    );
  }, [tableState.players]);

  const dealSequence = useMemo(() => {
    const seated = [...(tableState.players || [])]
      .filter((player) => player.seatNumber != null)
      .sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));

    if (seated.length === 0) return [];

    const dealStartSeat = Number(gameState.dealStartSeat || seated[0]?.seatNumber || 1);
    const startIndex = Math.max(
      0,
      seated.findIndex((player) => Number(player.seatNumber) === dealStartSeat),
    );
    const ordered = startIndex > 0
      ? [...seated.slice(startIndex), ...seated.slice(0, startIndex)]
      : seated;

    let myCardIndex = 0;

    return Array.from({ length: 52 }, (_, index) => {
      const targetSeat = Number(ordered[index % ordered.length]?.seatNumber || 0);

      if (targetSeat === mySeat) {
        const privateCard = hand[myCardIndex];
        myCardIndex += 1;
        return privateCard || { id: `player-deal-back-${handNumber}-${index}` };
      }

      return { id: `player-deal-back-${handNumber}-${index}` };
    });
  }, [gameState.dealStartSeat, hand, handNumber, mySeat, tableState.players]);

  const presentationTableState = useMemo(() => {
    if (!visualCardCounts) return tableState;

    const players = (tableState.players || []).map((player) => {
      const seatNumber = Number(player.seatNumber);
      const isMe = seatNumber === mySeat;

      return {
        ...player,
        cardCount: Number(visualCardCounts[seatNumber] || 0),
        hand: isMe ? (visualHand || []) : undefined,
      };
    });

    return {
      ...tableState,
      players,
    };
  }, [mySeat, tableState, visualCardCounts, visualHand]);

  const takeSeat = useCallback((seatNumber) => {
    if (busy) return;
    act('sit', { seatNumber });
  }, [act, busy]);

  const playCard = useCallback((card) => {
    if (!card?.id || busy) return;
    act('play_card', { cardId: card.id });
  }, [act, busy]);

  const placeBid = useCallback((bid) => {
    if (busy || !isMyBidTurn) return;
    act('place_bid', { bid });
  }, [act, busy, isMyBidTurn]);


  if (!deviceId) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <div className="mb-4 text-xl text-red-400">Player device not registered.</div>
          <Link to={`/join/${roomCode}`} className="text-[#FFD700] underline">
            Rejoin room {roomCode}
          </Link>
        </div>
      </div>
    );
  }

  if (error && !participant) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center px-4 text-center">
        <div className="max-w-lg rounded-2xl border border-red-500/35 bg-red-500/5 p-6">
          <div className="mb-3 text-sm font-bold tracking-widest text-red-400 uppercase" style={PS2}>
            PLAYER SESSION BLOCKED
          </div>
          <div className="text-sm leading-relaxed text-white/70">{error}</div>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={`/join/${roomCode}`}
              className="rounded-lg border border-[#FFD700]/60 px-4 py-2 text-[#FFD700]"
            >
              TRY PLAYER JOIN AGAIN
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-[#BC13FE]/60 px-4 py-2 text-[#BC13FE]"
            >
              SIGN IN WITH ANOTHER ACCOUNT
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!room && !error) {
    return (
      <div className="min-h-screen bg-[#070311] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#BC13FE]" />
          <div className="text-sm text-white/40">Connecting to room {roomCode}…</div>
        </div>
      </div>
    );
  }

  const teamOne = {
    name: gameState.team1Name || 'Team 1',
    score: Number(gameState.score1 || 0),
    bid: gameState.bid1 ?? 0,
    books: Number(gameState.books1 || 0),
  };
  const teamTwo = {
    name: gameState.team2Name || 'Team 2',
    score: Number(gameState.score2 || 0),
    bid: gameState.bid2 ?? 0,
    books: Number(gameState.books2 || 0),
  };
  const currentTrick = Array.isArray(gameState.currentTrick) ? gameState.currentTrick : [];
  const activeSuit = currentTrick[0]?.card?.suit || '—';
  const bookNumber = Math.min(13, Number(gameState.tricksPlayed || 0) + 1);

  return (
    <div className="min-h-screen bg-[#070311] text-white lg:h-screen lg:overflow-hidden">
      <main className="mx-auto flex min-h-screen max-w-[1700px] flex-col gap-3 p-3 lg:h-full lg:min-h-0 lg:flex-row lg:gap-4 lg:p-4">
        <section className="order-1 min-w-0 flex-1 lg:flex lg:h-full lg:items-center lg:justify-center lg:overflow-hidden">
          <div
            className="relative w-full mx-auto"
            style={{
              maxWidth: 'min(100%, calc((100dvh - 110px) * 8 / 7))',
            }}
          >
            <SpadesTable
              gs={presentationTableState}
              playerId={neonPlayerId}
              mySeatNumber={mySeat || null}
              myRole={mySeat ? 'player' : null}
              isPlayer={Boolean(mySeat)}
              isSpectator={false}
              updateState={() => {}}
              joinableSeats={joinableSeats}
              emptySeats={emptySeats}
              onSitInSeat={takeSeat}
              roomCode={roomCode}
              onPlayAgainstCPU={() => {}}
              onWaitForRealPlayers={() => {}}
              cpuChoiceShown={false}
              onChooseSpectate={() => {}}
              onChooseSit={() => {}}
              onPlayCard={playCard}
              onStandUp={() => {}}
              onTakeOverCPU={takeSeat}
              onBidTimeout={() => {}}
              showPlayerControls={false}
              showTableHud={false}
            />

            {dealVisualPhase !== 'idle' && (
              <div className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center">
                <div className="relative h-56 w-56 overflow-visible">
                  {dealVisualPhase === 'shuffling' ? (
                    <SpadesShuffleAnimation
                      phase="shuffling"
                      onComplete={() => setDealVisualPhase('dealing')}
                    />
                  ) : (
                    <SpadesDealAnimation
                      dealSequence={dealSequence}
                      seatedPlayers={tableState.players || []}
                      dealStartSeat={gameState.dealStartSeat || 1}
                      mySeatNumber={mySeat || null}
                      onCardDealt={(seatNumber, card) => {
                        setVisualCardCounts((current) => ({
                          ...(current || { 1: 0, 2: 0, 3: 0, 4: 0 }),
                          [seatNumber]: Math.min(
                            13,
                            Number(current?.[seatNumber] || 0) + 1,
                          ),
                        }));

                        if (
                          Number(seatNumber) === mySeat &&
                          card?.suit &&
                          card?.value
                        ) {
                          setVisualHand((current) => [...(current || []), card]);
                        }
                      }}
                      onComplete={() => {
                        setDealVisualPhase('idle');
                        setVisualCardCounts(null);
                        setVisualHand(null);
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="order-2 shrink-0 lg:flex lg:h-full lg:w-[390px] lg:items-center">
          <div className="grid w-full grid-cols-2 gap-2 self-center">
            <div className="col-span-2 rounded-xl border border-[#BC13FE]/30 bg-black/55 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[6px] uppercase tracking-[0.18em] text-white/25" style={PS2}>
                    ROOM
                  </div>
                  <div className="mt-1 font-mono text-xl tracking-[0.18em] text-[#FFD700]">
                    {roomCode}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[6px] uppercase tracking-[0.18em] text-[#BC13FE]" style={PS2}>
                    TEXASNOMAD SPADES
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/25">
                    Player View
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/45 p-3">
              <div className="text-[6px] uppercase tracking-[0.14em] text-white/25" style={PS2}>SEAT</div>
              <div className="mt-1 text-xl text-white">{mySeat || '—'}</div>
            </div>

            <div
              className="rounded-xl border bg-black/45 p-3"
              style={{ borderColor: isMyTurn ? 'rgba(74,222,128,.55)' : 'rgba(255,255,255,.10)' }}
            >
              <div className="text-[6px] uppercase tracking-[0.14em] text-white/25" style={PS2}>STATUS</div>
              <div className={`mt-1 text-xs uppercase ${isMyTurn ? 'text-green-400' : 'text-white/55'}`}>
                {playerStatusLabel}
              </div>
            </div>

            {phase === 'bidding' && (
              <div
                className="col-span-2 rounded-xl border bg-black/50 p-3"
                style={{
                  borderColor: isMyBidTurn
                    ? 'rgba(255,95,31,.65)'
                    : 'rgba(255,255,255,.10)',
                }}
              >
                <div className="text-center">
                  <div className="text-[6px] uppercase tracking-[0.14em] text-[#FF5F1F]" style={PS2}>
                    {isMyBidTurn
                      ? 'YOUR TURN TO BID'
                      : `WAITING FOR SEAT ${currentBidderSeat || '?'}`}
                  </div>

                  {isMyBidTurn && (
                    <div className="mt-3 grid grid-cols-7 gap-1.5">
                      {[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map((bid) => (
                        <button
                          key={bid}
                          type="button"
                          disabled={busy}
                          onClick={() => placeBid(bid)}
                          className="h-9 rounded-lg border border-[#FF5F1F]/55 bg-[#FF5F1F]/10 text-sm text-white transition hover:bg-[#FF5F1F]/25 disabled:opacity-40"
                        >
                          {bid}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              className="rounded-xl border-2 bg-black/50 p-3"
              style={{
                borderColor: mySeat === 1 || mySeat === 3 ? '#FFD700' : 'rgba(188,19,254,.35)',
              }}
            >
              <div className="text-[6px] uppercase tracking-[0.14em] text-[#BC13FE]" style={PS2}>
                {teamOne.name}
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="text-2xl font-bold text-[#BC13FE]">{teamOne.score}</div>
                <div className="text-right text-[9px] leading-4 text-white/30">
                  <div>Bid {teamOne.bid}</div>
                  <div>Books {teamOne.books}</div>
                </div>
              </div>
              <div className="mt-1 text-[8px] text-white/20">Seats 1 & 3</div>
            </div>

            <div
              className="rounded-xl border-2 bg-black/50 p-3"
              style={{
                borderColor: mySeat === 2 || mySeat === 4 ? '#FFD700' : 'rgba(255,95,31,.35)',
              }}
            >
              <div className="text-[6px] uppercase tracking-[0.14em] text-[#FF5F1F]" style={PS2}>
                {teamTwo.name}
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="text-2xl font-bold text-[#FF5F1F]">{teamTwo.score}</div>
                <div className="text-right text-[9px] leading-4 text-white/30">
                  <div>Bid {teamTwo.bid}</div>
                  <div>Books {teamTwo.books}</div>
                </div>
              </div>
              <div className="mt-1 text-[8px] text-white/20">Seats 2 & 4</div>
            </div>

            <div className="rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/5 p-3 text-center">
              <div className="text-[6px] uppercase tracking-[0.12em] text-white/25" style={PS2}>BOOK</div>
              <div className="mt-1 text-sm text-[#FFD700]">{bookNumber}/13</div>
            </div>

            <div className="rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/5 p-3 text-center">
              <div className="text-[6px] uppercase tracking-[0.12em] text-white/25" style={PS2}>SUIT</div>
              <div className="mt-1 text-lg text-[#FFD700]">{activeSuit}</div>
            </div>

            <div className="col-span-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[6px] uppercase tracking-[0.12em] text-white/25" style={PS2}>SPADES</div>
                <div className={`text-[10px] font-bold ${gameState.spadesBroken ? 'text-green-400' : 'text-red-400'}`}>
                  {gameState.spadesBroken ? 'BROKEN' : 'INTACT'}
                </div>
              </div>
            </div>

            {(presentationTableState.players || []).map((player) => {
              const seat = Number(player.seatNumber);
              const isMe = seat === mySeat;
              return (
                <div
                  key={seat}
                  className="rounded-xl border bg-black/45 p-2.5"
                  style={{
                    borderColor: isMe ? '#FFD700' : 'rgba(255,255,255,.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] text-white/70">
                        {isMe ? 'YOU' : (player.name || `Seat ${seat}`)}
                      </div>
                      <div className="mt-1 text-[8px] text-white/25">
                        S{seat} · {player.playerType === 'cpu' ? 'CPU' : seat === 1 ? 'HOST' : 'PLAYER'}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] text-[#FFD700]">
                      {Number(player.cardCount || 0)}
                    </div>
                  </div>
                </div>
              );
            })}

            {error && (
              <div className="col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {!mySeat && (
              <div className="col-span-2 rounded-xl border border-[#BC13FE]/30 bg-[#BC13FE]/5 p-3 text-center">
                <div className="text-[6px] uppercase leading-relaxed tracking-[0.14em] text-[#BC13FE]" style={PS2}>
                  CHOOSE SEAT 2, 3, OR 4 ON THE TABLE
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
