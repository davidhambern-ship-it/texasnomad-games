import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  authClient,
  getNeonSession,
  mapNeonUser,
} from '@/lib/neonAuth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Preserve the old context surface so pages that were built around the
  // Base44 provider do not need to care which auth system staging uses.
  const isLoadingPublicSettings = false;
  const appPublicSettings = null;

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const isAuthHandoff =
        window.location.pathname.startsWith('/onboarding') ||
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register');

      const attempts = isAuthHandoff ? 5 : 1;
      let session = null;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        session = await getNeonSession();
        if (session?.user) break;

        if (attempt < attempts - 1) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, 250 + (attempt * 350))
          );
        }
      }

      const neonUser = session?.user || null;

      if (neonUser) {
        setUser(mapNeonUser(neonUser));
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[TNG staging auth] session check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'unknown',
        message: error?.message || 'TNG could not verify your staging session.',
      });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkAppState = checkUserAuth;

  useEffect(() => {
    checkUserAuth();
  }, []);

  const logout = async (shouldRedirect = true) => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error('[TNG staging auth] sign out failed:', error);
    }

    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);

    try {
      localStorage.removeItem('tng_device_id');
      localStorage.removeItem('tng_connection_role');
      localStorage.removeItem('tng_player_test_mode');
      localStorage.removeItem('tng_player_device_id');
      localStorage.removeItem('tng_player_device_owner');
    } catch {}

    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const next = encodeURIComponent(current.startsWith('/') ? current : '/');
    window.location.href = `/login?next=${next}`;
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
