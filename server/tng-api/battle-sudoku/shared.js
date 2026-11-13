import { and, eq, inArray, isNull } from 'drizzle-orm';
import * as G from '../../../src/lib/battleSudoku/game.js';
import { db } from '../../db/client.js';
import { gameRooms, playerProfiles, roomParticipants } from '../../db/schema.js';

export const ACTIVE_ROOM_STATUSES = ['lobby', 'live', 'paused'];
export const COLORS = ['#ffd23f', '#ff5f6d', '#3ec5ff', '#3ef08a', '#c77dff', '#ff9f1c', '#f15bb5', '#e5e7eb'];

export function fail(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

export async function findBattleRoom(where, executor = db) {
  const [room] = await executor.select().from(gameRooms).where(where).limit(1);
  if (!room) fail(404, 'BATTLE_SUDOKU_ROOM_NOT_FOUND', 'This Battleship Sudoku room is no longer active.');
  return room;
}

export async function activeCaptains(roomId, executor = db) {
  const rows = await executor.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, roomId),
    isNull(roomParticipants.leftAt),
  ));
  const accountIds = rows.map((row) => row.accountId).filter(Boolean);
  const profiles = accountIds.length ? await executor.select({
    accountId: playerProfiles.accountId,
    displayName: playerProfiles.displayName,
    handle: playerProfiles.handle,
  }).from(playerProfiles).where(inArray(playerProfiles.accountId, accountIds)) : [];
  const byAccount = new Map(profiles.map((profile) => [profile.accountId, profile]));
  return rows.map((row) => {
    const profile = byAccount.get(row.accountId);
    return {
      ...row,
      name: profile?.displayName || profile?.handle || (row.role === 'host_player' ? 'HOST' : 'Captain'),
      handle: profile?.handle || null,
      seatNumber: Number(row.seatNumber || 0),
    };
  }).sort((a, b) => a.seatNumber - b.seatNumber);
}

export async function ensureBattleHost(room, accountId, deviceId, executor = db) {
  const captains = await activeCaptains(room.id, executor);
  const seatOne = captains.find((p) => p.seatNumber === 1);
  if (seatOne && seatOne.accountId !== accountId) {
    fail(409, 'BATTLE_SUDOKU_HOST_SEAT_TAKEN', 'The host captain seat belongs to another player.');
  }
  const [existing] = await executor.select().from(roomParticipants).where(and(
    eq(roomParticipants.roomId, room.id),
    eq(roomParticipants.accountId, accountId),
  )).limit(1);
  if (existing) {
    const [updated] = await executor.update(roomParticipants).set({
      deviceSessionId: deviceId, role: 'host_player', seatNumber: 1,
      leftAt: null, lastHeartbeatAt: new Date(),
    }).where(eq(roomParticipants.id, existing.id)).returning();
    return updated;
  }
  const [created] = await executor.insert(roomParticipants).values({
    roomId: room.id, accountId, deviceSessionId: deviceId,
    role: 'host_player', seatNumber: 1, lastHeartbeatAt: new Date(),
  }).returning();
  return created;
}

export async function assignCaptainSeats(roomId, executor = db) {
  const captains = await activeCaptains(roomId, executor);
  const used = new Set(captains.map((p) => p.seatNumber).filter((n) => n > 0));
  let next = 1;
  for (const captain of captains) {
    if (captain.seatNumber > 0) continue;
    while (used.has(next)) next += 1;
    await executor.update(roomParticipants).set({
      seatNumber: next, lastHeartbeatAt: new Date(),
    }).where(eq(roomParticipants.id, captain.id));
    used.add(next++);
  }
  return activeCaptains(roomId, executor);
}

export function storedBattleState(room) {
  const value = room?.displayState?.gameState?.battleSudoku;
  return value && typeof value === 'object' ? value : null;
}

export async function persistBattleState(room, battleState, executor = db) {
  const current = room.displayState || {};
  const status = battleState.game ? 'live' : 'lobby';
  const [updated] = await executor.update(gameRooms).set({
    displayState: {
      ...current, screen: 'game', gameId: 'sudoku',
      gameState: { ...(current.gameState || {}), battleSudoku: battleState },
    },
    status,
    revision: Number(room.revision || 0) + 1,
    startedAt: room.startedAt || (status === 'live' ? new Date() : null),
    updatedAt: new Date(),
  }).where(eq(gameRooms.id, room.id)).returning();
  return updated;
}

export function makeCaptainRoster(captains) {
  return captains.map((p, index) => ({
    id: p.accountId,
    name: p.name,
    color: COLORS[Math.max(0, p.seatNumber - 1) % COLORS.length] || COLORS[index % COLORS.length],
    cpu: 0,
  }));
}

export function makePublicPayload(room, battleState, accountId, captains) {
  const state = battleState || { settings: { ...G.DEFAULTS }, game: null };
  const now = Date.now();
  return {
    room: {
      id: room.id,
      roomCode: room.roomCode,
      code: room.roomCode,
      gameId: 'sudoku',
      status: room.status,
      revision: room.revision,
      updatedAt: room.updatedAt,
      settings: state.settings || { ...G.DEFAULTS },
      roster: captains.map((p) => ({
        id: p.accountId,
        name: p.name,
        color: COLORS[Math.max(0, p.seatNumber - 1) % COLORS.length],
        online: true,
        seatNumber: p.seatNumber,
      })),
      game: state.game ? G.view(state.game, accountId, now) : null,
    },
    participant: captains.find((p) => p.accountId === accountId) ? {
      id: captains.find((p) => p.accountId === accountId).id,
      seatNumber: captains.find((p) => p.accountId === accountId).seatNumber,
      role: captains.find((p) => p.accountId === accountId).role,
    } : null,
    you: { id: accountId },
  };
}

export function advanceBattleState(state, now = Date.now()) {
  if (!state?.game) return state || { settings: { ...G.DEFAULTS }, game: null };
  G.tick(state.game, now);
  return state;
}

export { G };
