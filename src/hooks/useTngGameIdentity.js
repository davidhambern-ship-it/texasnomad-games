import { useEffect, useState } from 'react';

import { tngApi } from '@/api/tngApi';
import { useAuth } from '@/lib/AuthContext';
import { getPublicTngName } from '@/lib/publicTngName';

let cachedIdentity = null;
let pendingIdentity = null;

async function loadIdentity(user) {
  if (cachedIdentity) return cachedIdentity;

  if (!pendingIdentity) {
    pendingIdentity = tngApi.profile.get()
      .then((payload) => {
        const profile = payload?.profile || payload || {};
        const publicName = getPublicTngName(
          profile,
          user?.full_name || user?.name || 'Nomad',
        );

        cachedIdentity = {
          profile,
          publicName,
          handle: String(profile?.handle || profile?.normalizedHandle || profile?.normalized_handle || '')
            .trim()
            .replace(/^@/, ''),
        };
        return cachedIdentity;
      })
      .finally(() => {
        pendingIdentity = null;
      });
  }

  return pendingIdentity;
}

export function clearTngGameIdentityCache() {
  cachedIdentity = null;
  pendingIdentity = null;
}

export function useTngGameIdentity() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [state, setState] = useState(() => ({
    loading: true,
    error: '',
    profile: cachedIdentity?.profile || null,
    publicName: cachedIdentity?.publicName || '',
    handle: cachedIdentity?.handle || '',
  }));

  useEffect(() => {
    let alive = true;

    if (isLoadingAuth) return () => { alive = false; };

    if (!isAuthenticated) {
      setState({
        loading: false,
        error: 'Sign in to TNG to play online.',
        profile: null,
        publicName: '',
        handle: '',
      });
      return () => { alive = false; };
    }

    if (cachedIdentity) {
      setState({
        loading: false,
        error: '',
        ...cachedIdentity,
      });
      return () => { alive = false; };
    }

    setState((current) => ({ ...current, loading: true, error: '' }));

    loadIdentity(user)
      .then((identity) => {
        if (!alive) return;
        setState({
          loading: false,
          error: '',
          ...identity,
        });
      })
      .catch((error) => {
        if (!alive) return;
        setState({
          loading: false,
          error: error?.message || 'TNG could not load your player profile.',
          profile: null,
          publicName: '',
          handle: '',
        });
      });

    return () => { alive = false; };
  }, [isAuthenticated, isLoadingAuth, user?.id]);

  return state;
}
