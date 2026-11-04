import { clearGuestIdentity, getStoredGuestIdentity } from '@/lib/guestIdentity';

export const NEON_AUTH_URL = '';
export const isNeonStaging = false;
export const TNG_BROWSER_SESSION_KEY = 'tng_browser_session';
export const TNG_LAST_ACTIVITY_KEY = 'tng_last_activity_at';
export const TNG_PAGEHIDE_KEY = 'tng_pagehide_at';
export const TNG_WELCOME_COMPLETE_KEY = 'tng_welcome_complete';

export function clearNeonSessionCache() {}
export function startTngBrowserSession() {
  try {
    sessionStorage.setItem(TNG_BROWSER_SESSION_KEY, '1');
    sessionStorage.setItem(TNG_LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {}
}
export function clearTngBrowserSession() {
  try {
    sessionStorage.removeItem(TNG_BROWSER_SESSION_KEY);
    sessionStorage.removeItem(TNG_LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(TNG_PAGEHIDE_KEY);
    sessionStorage.removeItem(TNG_WELCOME_COMPLETE_KEY);
  } catch {}
}
export function hasTngBrowserSession() {
  try { return sessionStorage.getItem(TNG_BROWSER_SESSION_KEY) === '1'; } catch { return false; }
}
export function restoreTngBrowserSession() { startTngBrowserSession(); }
export async function getNeonSession() { return null; }
export async function waitForNeonSession() { return null; }
export async function getNeonAuthToken() { return getStoredGuestIdentity()?.token || null; }
export function mapNeonUser(user) { return user || null; }
export const authClient = {
  signOut: async () => {
    clearGuestIdentity();
    return { data: { success: true } };
  },
};
