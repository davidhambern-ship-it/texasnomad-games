import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  authClient,
  clearTngBrowserSession,
  getNeonSession,
  hasTngBrowserSession,
  mapNeonUser,
  TNG_LAST_ACTIVITY_KEY,
  TNG_PAGEHIDE_KEY,
  waitForNeonSession,
} from '@/lib/neonAuth';

const AuthContext = createContext();

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const RETURN_GRACE_MS = 15 * 1000;
const SESSION_LIFECYCLE_URL =
  'https://tng-live-production.up.railway.app/tng-session';

function currentDeviceIds() {
  try {
    return Array.from(new Set([
      localStorage.getItem('tng_device_id'),
      localStorage.getItem('tng_player_device_id'),
    ].filter(Boolean)));
  } catch {
    return [];
  }
}

function sessionToken(session) {
  return session?.token || session?.session?.token || null;
}

async function syncBrowserDevices(action, token, { keepalive = false } = {}) {
  const deviceIds = currentDeviceIds();
  if (!token || deviceIds.length === 0) return;

  await fetch(SESSION_LIFECYCLE_URL, {
    method: 'POST',
    keepalive,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, deviceIds }),
  }).catch(() => {});
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const sessionTokenRef = useRef(null);
  const logoutInFlightRef = useRef(false);

  const isLoadingPublicSettings = false;
  const appPublicSettings = null;

  const setSignedOutState = useCallback(() => {
    sessionTokenRef.current = null;
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      // A Neon cookie may outlive the browser tab. TNG does not. If this
      // browser session was not explicitly started by Login/Register, treat
      // the visitor as signed out even if Neon still has a server session.
      if (!hasTngBrowserSession()) {
        setSignedOutState();
        return;
      }

      try {
        const hiddenAt = Number(sessionStorage.getItem(TNG_PAGEHIDE_KEY) || 0);
        if (hiddenAt) {
          const awayFor = Date.now() - hiddenAt;
          sessionStorage.removeItem(TNG_PAGEHIDE_KEY);

          // A quick unload/reload is a refresh. A longer trip away from TNG is
          // a new visit and must start at Login.
          if (awayFor > RETURN_GRACE_MS) {
            clearTngBrowserSession();
            setSignedOutState();
            return;
          }
        }
      } catch {}

      const isAuthHandoff =
        window.location.pathname.startsWith('/onboarding') ||
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register');

      const session = isAuthHandoff
        ? await waitForNeonSession({ attempts: 12, initialDelayMs: 150 })
        : await getNeonSession();

      const neonUser = session?.user || null;
      const token = sessionToken(session);

      if (neonUser && token) {
        sessionTokenRef.current = token;
        await syncBrowserDevices('heartbeat', token);
        setUser(mapNeonUser(neonUser));
        setIsAuthenticated(true);
      } else {
        clearTngBrowserSession();
        setSignedOutState();
      }
    } catch (error) {
      console.error('[TNG auth] session check failed:', error);
      setSignedOutState();
      setAuthError({
        type: 'unknown',
        message: error?.message || 'TNG could not verify your session.',
      });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [setSignedOutState]);

  const checkAppState = checkUserAuth;

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = useCallback(async (shouldRedirect = true, reason = 'manual') => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    const token = sessionTokenRef.current;

    try {
      await syncBrowserDevices('logout', token);
    } catch {}

    try {
      await authClient.signOut();
    } catch (error) {
      console.error('[TNG auth] sign out failed:', error);
    }

    clearTngBrowserSession();
    setSignedOutState();

    try {
      localStorage.removeItem('tng_device_id');
      localStorage.removeItem('tng_connection_role');
      localStorage.removeItem('tng_player_test_mode');
      localStorage.removeItem('tng_player_device_id');
      localStorage.removeItem('tng_player_device_owner');
    } catch {}

    logoutInFlightRef.current = false;

    if (shouldRedirect) {
      const suffix = reason === 'inactive' ? '?reason=inactive' : '';
      window.location.replace(`/login${suffix}`);
    }
  }, [setSignedOutState]);

  // One TNG sign-in covers the entire site. Activity anywhere in the app keeps
  // that browser session alive; 30 minutes with no user activity ends it.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const markActivity = () => {
      try {
        sessionStorage.setItem(TNG_LAST_ACTIVITY_KEY, String(Date.now()));
      } catch {}
    };

    try {
      if (!sessionStorage.getItem(TNG_LAST_ACTIVITY_KEY)) markActivity();
    } catch {}

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((eventName) =>
      window.addEventListener(eventName, markActivity, { passive: true })
    );

    const interval = window.setInterval(() => {
      let lastActivity = Date.now();
      try {
        lastActivity = Number(
          sessionStorage.getItem(TNG_LAST_ACTIVITY_KEY) || Date.now()
        );
      } catch {}

      if (Date.now() - lastActivity >= INACTIVITY_LIMIT_MS) {
        logout(true, 'inactive');
      }
    }, 15000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, markActivity)
      );
      window.clearInterval(interval);
    };
  }, [isAuthenticated, logout]);

  // Leaving/closing TNG immediately disconnects this browser's TNG device IDs.
  // On a normal refresh the same IDs are reconnected during checkUserAuth.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const handlePageHide = () => {
      try {
        sessionStorage.setItem(TNG_PAGEHIDE_KEY, String(Date.now()));
      } catch {}

      const token = sessionTokenRef.current;
      if (token) {
        syncBrowserDevices('disconnect', token, { keepalive: true });
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [isAuthenticated]);

  const navigateToLogin = () => {
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
