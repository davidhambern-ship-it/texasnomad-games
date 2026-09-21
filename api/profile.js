import { eq, sql } from 'drizzle-orm';

import { requireUser } from '../server/auth/require-user.js';
import { db } from '../server/db/client.js';
import { accounts, hostStats, playerGameStats, playerProfiles } from '../server/db/schema.js';
import { methodNotAllowed, sendError, sendJson } from '../server/http/respond.js';

const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

function normalizeHandle(value) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

function validateProfileInput(body) {
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  const handle = typeof body?.handle === 'string' ? body.handle.trim().replace(/^@/, '') : '';
  const normalizedHandle = normalizeHandle(handle);

  if (displayName.length < 2 || displayName.length > 50) {
    const error = new Error('Display name must be between 2 and 50 characters.');
    error.statusCode = 400;
    error.code = 'INVALID_DISPLAY_NAME';
    throw error;
  }
  if (!HANDLE_PATTERN.test(normalizedHandle)) {
    const error = new Error('Handle must be 3–24 characters using letters, numbers, or underscores.');
    error.statusCode = 400;
    error.code = 'INVALID_HANDLE';
    throw error;
  }

  return { displayName, handle, normalizedHandle };
}

async function findAccount(identity) {
  const [account] = await db.select().from(accounts).where(eq(accounts.authSubject, identity.subject)).limit(1);
  return account;
}

async function getProfile(identity) {
  const account = await findAccount(identity);
  if (!account) return null;

  const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.accountId, account.id)).limit(1);
  if (!profile) return null;

  const playerStats = await db.select().from(playerGameStats).where(eq(playerGameStats.accountId, account.id));
  const [hosting] = await db.select().from(hostStats).where(eq(hostStats.accountId, account.id)).limit(1);

  return {
    id: account.id,
    displayName: profile.displayName,
    handle: profile.handle,
    joinedAt: profile.createdAt,
    playerStats,
    hostStats: hosting || {
      sessionsHosted: 0,
      gamesCompleted: 0,
      uniquePlayersHosted: 0,
      totalPlayersHosted: 0,
    },
  };
}

async function createProfile(identity, body) {
  const profileInput = validateProfileInput(body);

  try {
    return await db.transaction(async (transaction) => {
      const [account] = await transaction.insert(accounts).values({
        authSubject: identity.subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
      }).onConflictDoUpdate({
        target: accounts.authSubject,
        set: {
          email: identity.email,
          emailVerified: identity.emailVerified,
          updatedAt: sql`now()`,
        },
      }).returning();

      const [existing] = await transaction.select({ accountId: playerProfiles.accountId })
        .from(playerProfiles)
        .where(eq(playerProfiles.accountId, account.id))
        .limit(1);

      if (existing) {
        const error = new Error('TNG profiles are locked after onboarding.');
        error.statusCode = 409;
        error.code = 'PROFILE_LOCKED';
        throw error;
      }

      const [profile] = await transaction.insert(playerProfiles).values({
        accountId: account.id,
        ...profileInput,
      }).returning();

      await transaction.insert(hostStats).values({ accountId: account.id }).onConflictDoNothing();

      return {
        id: account.id,
        displayName: profile.displayName,
        handle: profile.handle,
        joinedAt: profile.createdAt,
        playerStats: [],
        hostStats: {
          sessionsHosted: 0,
          gamesCompleted: 0,
          uniquePlayersHosted: 0,
          totalPlayersHosted: 0,
        },
      };
    });
  } catch (error) {
    if (error.code === '23505') {
      const conflict = new Error('That TNG handle is already taken.');
      conflict.statusCode = 409;
      conflict.code = 'HANDLE_TAKEN';
      throw conflict;
    }
    throw error;
  }
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return methodNotAllowed(response, ['GET', 'POST']);
  }

  try {
    const identity = await requireUser(request);

    if (request.method === 'GET') {
      const profile = await getProfile(identity);
      return profile
        ? sendJson(response, 200, { profile })
        : sendJson(response, 404, { error: { code: 'PROFILE_NOT_FOUND', message: 'Complete TNG onboarding first.' } });
    }

    const profile = await createProfile(identity, request.body);
    return sendJson(response, 201, { profile });
  } catch (error) {
    return sendError(response, error);
  }
}
