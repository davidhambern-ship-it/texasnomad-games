import { eq, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  gameStatEvents,
  hostSessions,
  hostStats,
  playerGameStats,
} from '../db/schema.js';

function normalizeEntries(entries = []) {
  const seen = new Set();
  const cleaned = [];

  for (const entry of entries) {
    const accountId = entry?.accountId;
    if (!accountId || seen.has(accountId)) continue;
    seen.add(accountId);

    cleaned.push({
      accountId,
      score: Number.isFinite(Number(entry?.score)) ? Number(entry.score) : 0,
      won: entry?.won === true ? true : entry?.won === false ? false : null,
    });
  }

  return cleaned;
}

export async function recordGameStatEvent({
  room,
  statKey,
  entries,
  result = {},
  executor = db,
}) {
  if (!room?.id || !room?.gameId || !statKey) return { recorded: false };
  const players = normalizeEntries(entries);
  if (!players.length) return { recorded: false };

  const [event] = await executor.insert(gameStatEvents).values({
    roomId: room.id,
    gameId: room.gameId,
    statKey,
    result,
  }).onConflictDoNothing({
    target: [gameStatEvents.roomId, gameStatEvents.statKey],
  }).returning();

  if (!event) return { recorded: false };

  const now = new Date();

  for (const player of players) {
    const winDelta = player.won === true ? 1 : 0;
    const lossDelta = player.won === false ? 1 : 0;

    await executor.insert(playerGameStats).values({
      accountId: player.accountId,
      gameId: room.gameId,
      gamesPlayed: 1,
      wins: winDelta,
      losses: lossDelta,
      totalScore: player.score,
      bestScore: player.score,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [playerGameStats.accountId, playerGameStats.gameId],
      set: {
        gamesPlayed: sql`${playerGameStats.gamesPlayed} + 1`,
        wins: sql`${playerGameStats.wins} + ${winDelta}`,
        losses: sql`${playerGameStats.losses} + ${lossDelta}`,
        totalScore: sql`${playerGameStats.totalScore} + ${player.score}`,
        bestScore: sql`greatest(${playerGameStats.bestScore}, ${player.score})`,
        updatedAt: now,
      },
    });
  }

  const [hostSession] = await executor.select({
    hostAccountId: hostSessions.hostAccountId,
  }).from(hostSessions).where(eq(hostSessions.id, room.hostSessionId)).limit(1);

  if (hostSession?.hostAccountId) {
    const hostedPlayers = players.filter((player) => player.accountId !== hostSession.hostAccountId).length;

    await executor.insert(hostStats).values({
      accountId: hostSession.hostAccountId,
      gamesCompleted: 1,
      totalPlayersHosted: hostedPlayers,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: hostStats.accountId,
      set: {
        gamesCompleted: sql`${hostStats.gamesCompleted} + 1`,
        totalPlayersHosted: sql`${hostStats.totalPlayersHosted} + ${hostedPlayers}`,
        updatedAt: now,
      },
    });
  }

  return {
    recorded: true,
    eventId: event.id,
  };
}
