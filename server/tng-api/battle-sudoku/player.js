import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { requireAccount } from '../../auth/require-account.js';
import { db } from '../../db/client.js';
import { deviceSessions, gameRooms, roomParticipants } from '../../db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../http/respond.js';
import {
  ACTIVE_ROOM_STATUSES, G, activeCaptains, advanceBattleState, assignCaptainSeats,
  findBattleRoom, makePublicPayload, persistBattleState, storedBattleState,
} from './shared.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function header(request, name) {
  return request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '';
}

async function requirePlayerDevice(request, accountId) {
  const deviceId = header(request, 'x-tng-device-id');
  if (!UUID_PATTERN.test(deviceId)) {
    const error = new Error('A Player device is required.'); error.statusCode = 401; error.code = 'PLAYER_DEVICE_REQUIRED'; throw error;
  }
  const [device] = await db.select().from(deviceSessions).where(and(
    eq(deviceSessions.id, deviceId), eq(deviceSessions.accountId, accountId),
    eq(deviceSessions.role, 'player'), eq(deviceSessions.status, 'connected'),
    gt(deviceSessions.expiresAt, new Date()),
  )).limit(1);
  if (!device) {
    const error = new Error('This device is not an active Player device.'); error.statusCode = 403; error.code = 'INVALID_PLAYER_DEVICE'; throw error;
  }
  return device;
}

async function findRoom(code, executor = db) {
  return findBattleRoom(and(
    sql`upper(${gameRooms.roomCode}) = ${code}`,
    eq(gameRooms.gameId, 'sudoku'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  ), executor);
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(response, ['GET', 'POST']);
  try {
    const account = await requireAccount(request);
    const device = await requirePlayerDevice(request, account.id);
    const code = String(header(request, 'x-tng-room-code') || request.body?.roomCode || '').trim().toUpperCase();
    if (!/^TN[A-Z0-9]{4}$/.test(code)) {
      const error = new Error('Enter a valid TNG room code.'); error.statusCode = 400; error.code = 'INVALID_ROOM_CODE'; throw error;
    }
    const room = await findRoom(code);

    const payload = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(gameRooms).where(eq(gameRooms.id, room.id)).limit(1).for('update');
      let captains = await activeCaptains(locked.id, tx);
      let participant = captains.find((p) => p.accountId === account.id);
      if (!participant) {
        const error = new Error('Join the shared room before opening Battleship Sudoku.'); error.statusCode = 409; error.code = 'ROOM_JOIN_REQUIRED'; throw error;
      }
      await tx.update(roomParticipants).set({ deviceSessionId: device.id, lastHeartbeatAt: new Date() })
        .where(eq(roomParticipants.id, participant.id));
      if (captains.length > 8) {
        const error = new Error('This Battleship Sudoku room is full (8 captains maximum).'); error.statusCode = 409; error.code = 'BATTLE_ROOM_FULL'; throw error;
      }
      captains = await assignCaptainSeats(locked.id, tx);
      participant = captains.find((p) => p.accountId === account.id);
      let state = storedBattleState(locked) || { settings: { ...G.DEFAULTS }, game: null };
      let actionResult = { ok: true };
      state = advanceBattleState(state);

      if (request.method === 'POST') {
        if (!state.game) {
          const error = new Error('The host has not started this battle yet.'); error.statusCode = 409; error.code = 'BATTLE_NOT_STARTED'; throw error;
        }
        const action = String(request.body?.action || '').trim();
        if (!['shuffle', 'ready', 'moveShip', 'place', 'order', 'cancel'].includes(action)) {
          const error = new Error('Unknown Battleship Sudoku player action.'); error.statusCode = 400; error.code = 'INVALID_BATTLE_SUDOKU_PLAYER_ACTION'; throw error;
        }
        actionResult = G.act(state.game, account.id, { ...request.body, type: action }, Date.now());
        if (actionResult?.ok === false) {
          const error = new Error(actionResult.error || 'That move could not be completed.'); error.statusCode = 409; error.code = 'BATTLE_MOVE_REJECTED'; throw error;
        }
      }

      const before = JSON.stringify(storedBattleState(locked));
      const updated = before === JSON.stringify(state) ? locked : await persistBattleState(locked, state, tx);
      return { ...makePublicPayload(updated, state, account.id, captains), result: actionResult };
    });
    return sendJson(response, 200, payload);
  } catch (error) { return sendError(response, error); }
}
