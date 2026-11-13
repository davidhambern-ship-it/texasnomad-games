import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { accounts, playerProfiles } from '../db/schema.js';
import { requireUser } from './require-user.js';

function guestHandle(guestId) {
  const suffix = String(guestId || '').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-16) || 'visitor';
  return `guest_${suffix}`.slice(0, 24);
}

export async function findAccountForIdentity(identity, executor = db) {
  if (identity?.provider !== 'guest' || !identity?.subject || !identity?.email) return null;

  let [account] = await executor.select()
    .from(accounts)
    .where(eq(accounts.authSubject, identity.subject))
    .limit(1);

  if (!account) {
    const [created] = await executor.insert(accounts).values({
      authSubject: identity.subject,
      email: identity.email,
      emailVerified: false,
      status: 'active',
    }).onConflictDoNothing({ target: accounts.authSubject }).returning();
    account = created || (await executor.select()
      .from(accounts)
      .where(eq(accounts.authSubject, identity.subject))
      .limit(1))[0];
  }

  if (!account) return null;

  const [profile] = await executor.select({ accountId: playerProfiles.accountId })
    .from(playerProfiles)
    .where(eq(playerProfiles.accountId, account.id))
    .limit(1);

  if (!profile) {
    const handle = guestHandle(identity.guestId);
    await executor.insert(playerProfiles).values({
      accountId: account.id,
      displayName: String(identity.displayName || 'Guest').slice(0, 50),
      handle,
      normalizedHandle: handle,
      onboardingCompletedAt: new Date(),
    }).onConflictDoNothing({ target: playerProfiles.accountId });
  }

  return account;
}

export async function requireAccount(request, { profileRequired = true } = {}) {
  const identity = await requireUser(request);
  const account = await findAccountForIdentity(identity);

  if (!account || account.status !== 'active') {
    const error = new Error('Your guest profile could not be created. Please re-enter the game.');
    error.statusCode = 503;
    error.code = 'GUEST_PROFILE_UNAVAILABLE';
    throw error;
  }

  if (profileRequired) {
    const [profile] = await db.select({ accountId: playerProfiles.accountId })
      .from(playerProfiles)
      .where(eq(playerProfiles.accountId, account.id))
      .limit(1);
    if (!profile) {
      const error = new Error('Your guest profile is not ready yet.');
      error.statusCode = 503;
      error.code = 'GUEST_PROFILE_UNAVAILABLE';
      throw error;
    }
  }

  return account;
}
