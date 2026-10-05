import { TngApiError, tngApi } from '@/api/tngApi';

// Legacy export kept for compatibility with callers that still branch on it.
// TNG no longer uses Base44 preview/runtime profile storage.
export const isBase44Preview = false;

async function getNeonProfile() {
  try {
    const payload = await tngApi.profile.get();
    return payload.profile || null;
  } catch (error) {
    if (error instanceof TngApiError && error.code === 'PROFILE_NOT_FOUND') return null;
    throw error;
  }
}

export async function getPreviewTngProfile(user) {
  if (!user) return null;
  return getNeonProfile();
}

export async function createPreviewTngProfile(user, { displayName, handle }) {
  if (!user) throw new Error('You must be signed in before creating a TNG profile.');

  const cleanDisplayName = String(displayName || '').trim();
  const cleanHandle = String(handle || '').trim().replace(/^@/, '').toLowerCase();

  if (cleanDisplayName.length < 2 || cleanDisplayName.length > 50) {
    throw new Error('Display name must be between 2 and 50 characters.');
  }

  if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
    throw new Error('Handle must be 3–24 characters using letters, numbers, or underscores.');
  }

  const existing = await getNeonProfile();
  if (existing) return existing;

  const payload = await tngApi.profile.create({
    displayName: cleanDisplayName,
    handle: cleanHandle,
  });

  return payload.profile;
}
