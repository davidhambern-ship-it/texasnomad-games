import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { accounts, playerProfiles } from '../db/schema.js';
import { requireUser } from './require-user.js';

export async function requireAccount(request, { profileRequired = true } = {}) {
  const identity = await requireUser(request);
  const [account] = await db.select().from(accounts).where(eq(accounts.authSubject, identity.subject)).limit(1);

  if (!account || account.status !== 'active') {
    const error = new Error('Complete TNG onboarding before continuing.');
    error.statusCode = 403;
    error.code = 'ACCOUNT_REQUIRED';
    throw error;
  }

  if (profileRequired) {
    const [profile] = await db.select({ accountId: playerProfiles.accountId })
      .from(playerProfiles)
      .where(eq(playerProfiles.accountId, account.id))
      .limit(1);

    if (!profile) {
      const error = new Error('Complete TNG onboarding before continuing.');
      error.statusCode = 403;
      error.code = 'PROFILE_REQUIRED';
      throw error;
    }
  }

  return account;
}
