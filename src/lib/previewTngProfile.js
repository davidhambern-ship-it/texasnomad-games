import { base44 } from '@/api/base44Client';
import { TngApiError, tngApi } from '@/api/tngApi';

function previewHost() {
  if (typeof window === 'undefined') return false;

  const candidates = [
    window.location.href,
    document.referrer,
    window.localStorage.getItem('base44_from_url'),
    window.localStorage.getItem('base44_app_base_url'),
  ].filter(Boolean);

  return candidates.some((value) => {
    try {
      const url = new URL(value, window.location.origin);
      const host = url.hostname.toLowerCase();

      if (
        host.endsWith('.base44.app') &&
        (host.startsWith('preview--') || host.startsWith('preview-sandbox--'))
      ) return true;

      return host === 'app.base44.com' && url.pathname.includes('/editor/preview');
    } catch {
      return false;
    }
  });
}

export const isBase44Preview = previewHost();

async function getBase44Profile(user) {
  const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
  return profiles[0] || null;
}

async function getNeonProfile() {
  try {
    const payload = await tngApi.profile.get();
    return payload.profile || null;
  } catch (error) {
    if (error instanceof TngApiError && error.code === 'PROFILE_NOT_FOUND') return null;
    throw error;
  }
}

async function mirrorToNeon(base44Profile) {
  if (!base44Profile) return null;
  const displayName = base44Profile.username || 'Nomad';
  const handle = base44Profile.handle;
  if (!handle) return null;

  try {
    const payload = await tngApi.profile.create({ displayName, handle });
    return payload.profile || null;
  } catch (error) {
    if (error instanceof TngApiError && error.code === 'PROFILE_LOCKED') {
      return getNeonProfile();
    }
    throw error;
  }
}

export async function getPreviewTngProfile(user) {
  if (!user) return null;

  const neon = await getNeonProfile();
  if (neon) return neon;

  const legacy = await getBase44Profile(user);
  if (!legacy) return null;

  const synced = await mirrorToNeon(legacy);
  return synced || legacy;
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

  let neonProfile = await getNeonProfile();
  if (!neonProfile) {
    const payload = await tngApi.profile.create({
      displayName: cleanDisplayName,
      handle: cleanHandle,
    });
    neonProfile = payload.profile;
  }

  const existingProfile = await getBase44Profile(user);
  if (!existingProfile) {
    const existingHandle = await base44.entities.PlayerProfile.filter({ handle: cleanHandle });
    if (existingHandle.length > 0) throw new Error('That TNG handle is already taken.');

    await base44.entities.PlayerProfile.create({
      user_id: user.id,
      username: cleanDisplayName,
      handle: cleanHandle,
      onboarding_complete: true,
      profile_locked: true,
      total_games_played: 0,
      total_play_time_minutes: 0,
      game_stats: {},
      badges: [],
      favorite_games: [],
      playstyle_tags: [],
      ambassador_status: 'player',
      ambassador_path: 'none',
      has_seen_ambassador_reveal: false,
      referral_count: 0,
      subscription_status: 'free',
      member_since: new Date().toISOString(),
      host_stats: { total_sessions: 0, total_host_time_minutes: 0, last_hosted: null },
    });
  }

  return neonProfile;
}
