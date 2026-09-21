import { base44 } from '@/api/base44Client';
import { TngApiError, tngApi } from '@/api/tngApi';
import { backendMigration } from '@/config/backendMigration';

function normalizeHandle(value) {
  return String(value || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export async function getCurrentTngProfile(user) {
  if (!user) return null;

  if (backendMigration.tngBackendEnabled) {
    try {
      const payload = await tngApi.profile.get();
      return payload.profile || null;
    } catch (error) {
      if (error instanceof TngApiError && error.code === 'PROFILE_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  const profiles = await base44.entities.PlayerProfile.filter({ user_id: user.id });
  return profiles[0] || null;
}

export async function createCurrentTngProfile(user, { displayName, handle }) {
  if (!user) throw new Error('You must be signed in before creating a TNG profile.');

  if (backendMigration.tngBackendEnabled) {
    return tngApi.profile.create({ displayName, handle });
  }

  const cleanDisplayName = String(displayName || '').trim();
  const cleanHandle = normalizeHandle(handle);

  if (cleanDisplayName.length < 2 || cleanDisplayName.length > 50) {
    throw new Error('Display name must be between 2 and 50 characters.');
  }

  if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
    throw new Error('Handle must be 3–24 characters using letters, numbers, or underscores.');
  }

  const existingHandle = await base44.entities.PlayerProfile.filter({ handle: cleanHandle });
  if (existingHandle.length > 0) {
    throw new Error('That TNG handle is already taken.');
  }

  const existingProfile = await base44.entities.PlayerProfile.filter({ user_id: user.id });
  if (existingProfile.length > 0) {
    return { profile: existingProfile[0] };
  }

  const profile = await base44.entities.PlayerProfile.create({
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
    host_stats: {
      total_sessions: 0,
      total_host_time_minutes: 0,
      last_hosted: null,
    },
  });

  return { profile };
}

export async function registerCurrentDeviceRole(role) {
  localStorage.setItem('tng_connection_role', role);

  if (!backendMigration.tngBackendEnabled) {
    return { role, device: null };
  }

  const { device } = await tngApi.devices.create({
    role,
    deviceLabel: role === 'host_controller' ? 'Host Controller' : 'Player Device',
  });

  localStorage.setItem('tng_device_id', device.id);

  if (role === 'host_controller') {
    await tngApi.host.startSession(device.id);
  }

  return { role, device };
}
