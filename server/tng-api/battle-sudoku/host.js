import { and, eq, inArray } from 'drizzle-orm';
import { requireController } from '../../auth/require-controller.js';
import { db } from '../../db/client.js';
import { gameRooms, roomParticipants } from '../../db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../../http/respond.js';
import {
  ACTIVE_ROOM_STATUSES, G, activeCaptains, advanceBattleState, assignCaptainSeats, ensureBattleHost,
  findBattleRoom, makeCaptainRoster, makePublicPayload, persistBattleState, storedBattleState,
} from './shared.js';

async function findHostRoom(hostSessionId, executor = db) {
  return findBattleRoom(and(
    eq(gameRooms.hostSessionId, hostSessionId),
    eq(gameRooms.gameId, 'sudoku'),
    inArray(gameRooms.status, ACTIVE_ROOM_STATUSES),
  ), executor);
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(response, ['GET', 'POST']);
  try {
    const { account, device, hostSession } = await requireController(request, { hostSessionRequired: true });
    const room = await findHostRoom(hostSession.id);
    await ensureBattleHost(room, account.id, device.id);

    if (request.method === 'GET') {
      const result = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(gameRooms).where(eq(gameRooms.id, room.id)).limit(1).for('update');
        await ensureBattleHost(locked, account.id, device.id, tx);
        const captains = await assignCaptainSeats(locked.id, tx);
        const before = JSON.stringify(storedBattleState(locked));
        const state = advanceBattleState(storedBattleState(locked));
        const updated = before === JSON.stringify(state) ? locked : await persistBattleState(locked, state, tx);
        return { ...makePublicPayload(updated, state, account.id, captains), result: actionResult };
      });
      return sendJson(response, 200, result);
    }

    const action = String(request.body?.action || '').trim();
    const allowed = new Set(['start', 'settings', 'pause', 'resume', 'lobby', 'kick', 'shuffle', 'ready', 'moveShip', 'place', 'order', 'cancel']);
    if (!allowed.has(action)) {
      const error = new Error('Unknown Battleship Sudoku host action.');
      error.statusCode = 400; error.code = 'INVALID_BATTLE_SUDOKU_HOST_ACTION'; throw error;
    }

    const payload = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(gameRooms).where(eq(gameRooms.id, room.id)).limit(1).for('update');
      await ensureBattleHost(locked, account.id, device.id, tx);
      let captains = await assignCaptainSeats(locked.id, tx);
      let state = storedBattleState(locked) || { settings: { ...G.DEFAULTS }, game: null };
      let actionResult = { ok: true };
      state = advanceBattleState(state);

      if (action === 'start') {
        if (state.game && state.game.phase !== 'final') {
          const error = new Error('This battle has already started.'); error.statusCode = 409; error.code = 'BATTLE_ALREADY_STARTED'; throw error;
        }
        if (captains.length > 8) {
          const error = new Error('Battleship Sudoku supports up to 8 captains.'); error.statusCode = 409; error.code = 'BATTLE_ROOM_FULL'; throw error;
        }
        if (captains.length < 2) {
          const error = new Error('At least two captains must join before the battle can start.'); error.statusCode = 409; error.code = 'ROOM_NEEDS_PLAYERS'; throw error;
        }
        state.game = G.createGame({
          seed: `${locked.roomCode}-${Date.now()}`,
          settings: state.settings || G.DEFAULTS,
          now: Date.now(),
          players: makeCaptainRoster(captains),
        });
      } else if (action === 'settings') {
        if (state.game && state.game.phase !== 'final') {
          const error = new Error('Settings can only be changed before a battle starts.'); error.statusCode = 409; error.code = 'BATTLE_IN_PROGRESS'; throw error;
        }
        const next = request.body || {};
        const settings = { ...(state.settings || G.DEFAULTS) };
        if (['easy', 'normal', 'hard'].includes(next.difficulty)) settings.difficulty = next.difficulty;
        if ([30, 40, 60].includes(Number(next.solveSec))) settings.solveSec = Number(next.solveSec);
        if ([10, 15, 20].includes(Number(next.battleSec))) settings.battleSec = Number(next.battleSec);
        if ([6, 8, 10].includes(Number(next.volleys))) settings.volleys = Number(next.volleys);
        state.settings = settings;
      } else if (action === 'pause' || action === 'resume') {
        if (!state.game) {
          const error = new Error('There is no active battle.'); error.statusCode = 409; error.code = 'NO_ACTIVE_BATTLE'; throw error;
        }
        if (action === 'pause' && !state.game.pausedAt) {
          state.game.pausedAt = Date.now();
          state.game.pausedRemainingMs = Math.max(0, state.game.phaseEndsAt - Date.now());
        }
        if (action === 'resume' && state.game.pausedAt) {
          state.game.phaseEndsAt = Date.now() + Math.max(0, Number(state.game.pausedRemainingMs) || 0);
          delete state.game.pausedAt; delete state.game.pausedRemainingMs;
        }
      } else if (action === 'lobby') {
        state.game = null;
      } else if (action === 'kick') {
        const target = captains.find((p) => p.accountId === request.body?.playerId);
        if (target && target.accountId !== account.id) {
          await tx.update(roomParticipants).set({ leftAt: new Date() }).where(eq(roomParticipants.id, target.id));
          captains = await activeCaptains(locked.id, tx);
          if (state.game?.players?.[target.accountId]) {
            state.game.players[target.accountId].ghost = true;
          }
        }
      } else {
        if (!state.game) {
          const error = new Error('The host must start the battle first.'); error.statusCode = 409; error.code = 'NO_ACTIVE_BATTLE'; throw error;
        }
        actionResult = G.act(state.game, account.id, { ...request.body, type: action }, Date.now());
        if (actionResult?.ok === false) {
          const error = new Error(actionResult.error || 'That move could not be completed.'); error.statusCode = 409; error.code = 'BATTLE_MOVE_REJECTED'; throw error;
        }
      }

      const updated = await persistBattleState(locked, state, tx);
      return { ...makePublicPayload(updated, state, account.id, captains), result: actionResult };
    });
    return sendJson(response, 200, payload);
  } catch (error) { return sendError(response, error); }
}
