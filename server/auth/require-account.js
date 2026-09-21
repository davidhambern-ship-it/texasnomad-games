import { eq, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import { accounts, playerProfiles } from '../db/schema.js';
import { requireUser } from './require-user.js';

export async function findAccountForIdentity(identity, executor = db) {
  const [bySubject] = await executor.select()
    .from(accounts)
    .where(eq(accounts.authSubject, identity.subject))
    .limit(1);

  if (bySubject) return bySubject;

  // During the Base44 -> Neon Auth transition, the same verified person can
  // legitimately arrive with a different provider subject. The email column
  // is unique in TNG, so a verified email is the safe bridge to the existing
  // account UUID/profile/stats without rewriting the original auth subject.
  if (identity.emailVerified === true && typeof identity.email === 'string') {
    const normalizedEmail = identity.email.trim().toLowerCase();
    const [byVerifiedEmail] = await executor.select()
      .from(accounts)
      .where(sql`lower(${accounts.email}) = ${normalizedEmail}`)
      .limit(1);

    if (byVerifiedEmail) return byVerifiedEmail;
  }

  return null;
}

export async function requireAccount(request, { profileRequired = true } = {}) {
  const identity = await requireUser(request);
  const account = await findAccountForIdentity(identity);

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
