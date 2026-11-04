import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearGuestIdentity, getStoredGuestIdentity } from '@/lib/guestIdentity';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const guest = getStoredGuestIdentity();
      if (guest) {
        setUser({
          id: guest.id || 'guest',
          name: guest.name,
          full_name: guest.name,
          email: null,
          isGuest: true,
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'guest_session', message: error?.message || 'Guest session unavailable.' });
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  const logout = useCallback(async (shouldRedirect = true) => {
    clearGuestIdentity();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.replace('/welcome');
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.replace('/welcome');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked: !isLoadingAuth,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
