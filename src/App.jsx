import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { getTngProfile } from '@/lib/tngProfile';
import { getStoredGuestIdentity } from '@/lib/guestIdentity';
import { isNeonStaging } from '@/lib/neonAuth';

const Home = lazy(() => import('@/pages/Home'));
const Welcome = lazy(() => import('@/pages/Welcome'));
const BFFGame = lazy(() => import('@/pages/BFFGame'));
const SquareBizGame = lazy(() => import('@/pages/SquareBizGame'));
const HangmanGame = lazy(() => import('@/pages/HangmanGame'));
const SpadesGame = lazy(() => import('@/pages/SpadesGame'));
const JoinRoom = lazy(() => import('@/pages/JoinRoom'));
const PlaceholderPage = lazy(() => import('@/pages/PlaceholderPage'));
const SharedRoomPage = lazy(() => import('@/pages/SharedRoomPage'));
const SharedGamePage = lazy(() => import('@/pages/SharedGamePage'));
const Games = lazy(() => import('@/pages/Games'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const WordSearchGame = lazy(() => import('@/pages/WordSearchGame'));
const ViralGame = lazy(() => import('@/pages/ViralGame'));
const SudokuGame = lazy(() => import('@/pages/SudokuGame'));
const RodeoRumbleGame = lazy(() => import('@/pages/RodeoRumbleGame'));
const SeeThatGame = lazy(() => import('@/pages/SeeThatGame'));
const WordWranglerGame = lazy(() => import('@/pages/WordWranglerGame'));
const DominoGame = lazy(() => import('@/pages/DominoGame'));
const OutGame = lazy(() => import('@/pages/OutGame'));
const NeonPlayerProfile = lazy(() => import('@/pages/NeonPlayerProfile'));

function RouteFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#05030b]">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-[#FFD700] rounded-full animate-spin" />
    </div>
  );
}

function HomeGate() {
  // The public home page must never require a welcome flag or player session.
  return <Home />;
}

function RoomRoute() {
  const [params] = useSearchParams();
  const gameId = String(params.get('game') || '').trim().toLowerCase();
  const guestEngineGames = new Set(['out', 'viral', 'dominoes', 'see-that', 'word-wrangler', 'sudoku', 'rodeo-rumble']);
  return guestEngineGames.has(gameId) ? <SharedGamePage gameId={gameId} /> : <SharedRoomPage />;
}

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const profileGateEnabled = isNeonStaging;
  const [profileState, setProfileState] = useState('idle');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function checkTngProfile() {
      if (!profileGateEnabled || isLoadingAuth || isLoadingPublicSettings || !isAuthenticated || !user) {
        setProfileState('idle');
        setProfileError('');
        return;
      }

      setProfileState('checking');
      setProfileError('');

      try {
        const profile = await getTngProfile(user);
        if (cancelled) return;
        setProfileState(profile ? 'ready' : 'missing');
      } catch (error) {
        if (cancelled) return;
        console.error('[TNG profile gate] profile check failed:', error);
        setProfileError(error.message || 'TNG could not verify your profile.');
        setProfileState('error');
      }
    }

    checkTngProfile();
    return () => { cancelled = true; };
  }, [
    user?.id,
    user?.email,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    location.pathname,
    profileGateEnabled,
  ]);

  // Show loading spinner while checking app public settings, auth, or TNG profile
  if (
    isLoadingPublicSettings ||
    isLoadingAuth ||
    (profileGateEnabled && isAuthenticated && profileState === 'checking')
  ) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  const onboardingExemptPaths = new Set([
    '/login',
    '/register',
    '/welcome',
    '/onboarding',
    '/forgot-password',
    '/reset-password',
  ]);

  const publicUnauthenticatedPaths = new Set([
    '/',
    '/welcome',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ]);

  let hasGuestIdentity = false;
  try {
    hasGuestIdentity = Boolean(getStoredGuestIdentity());
  } catch {}

  const guestHostGameIds = new Set([
    'bff',
    'square-biz',
    'hangman',
    'spades',
    'word-search',
    'out',
    'dominoes',
    'viral',
    'see-that',
    'word-wrangler',
    'sudoku',
    'rodeo-rumble',
  ]);
  const requestedHostGameId = new URLSearchParams(location.search).get('game');
  const isGuestHostRoute =
    (location.pathname === '/room' || location.pathname === '/host') &&
    guestHostGameIds.has(String(requestedHostGameId || '').trim().toLowerCase());

  const isGuestEntryRoute =
    location.pathname === '/games' ||
    location.pathname.startsWith('/games/') ||
    location.pathname.startsWith('/join/') ||
    isGuestHostRoute ||
    (hasGuestIdentity && (
      location.pathname === '/' ||
      location.pathname === '/games' ||
      location.pathname.startsWith('/games/')
    ));

  if (
    !isAuthenticated &&
    !publicUnauthenticatedPaths.has(location.pathname) &&
    !isGuestEntryRoute
  ) {
    return <Navigate to="/login" replace />;
  }


  if (
    profileGateEnabled &&
    isAuthenticated &&
    profileState === 'missing' &&
    !onboardingExemptPaths.has(location.pathname)
  ) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/onboarding?next=${next}`} replace />;
  }

  if (
    profileGateEnabled &&
    isAuthenticated &&
    profileState === 'error' &&
    location.pathname !== '/onboarding'
  ) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#05030b] px-4 text-center text-white">
        <div className="max-w-md">
          <div className="mb-3 text-sm text-red-400">{profileError}</div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-[#BC13FE] px-4 py-2 text-sm text-[#BC13FE]"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  // Render the main app
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
      <Route path="/register" element={<Navigate to="/welcome" replace />} />
      <Route path="/login" element={<Navigate to="/welcome" replace />} />
      <Route path="/onboarding" element={<Navigate to="/welcome" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/welcome" replace />} />
      <Route path="/reset-password" element={<Navigate to="/welcome" replace />} />
      <Route path="/" element={<HomeGate />} />
      <Route path="/games" element={<Games />} />
      <Route path="/games/bff" element={<BFFGame />} />
      <Route path="/games/square-biz" element={<SquareBizGame />} />
      <Route path="/games/hangman" element={<HangmanGame />} />
      <Route path="/games/spades" element={<SpadesGame />} />
      <Route path="/join/:roomCode" element={<JoinRoom />} />
      <Route path="/live-status" element={<PlaceholderPage />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/games/word-search" element={<WordSearchGame />} />
      <Route path="/games/viral" element={<ViralGame />} />
      <Route path="/games/sudoku" element={<SudokuGame />} />
      <Route path="/games/rodeo-rumble" element={<RodeoRumbleGame />} />
      <Route path="/games/see-that" element={<SeeThatGame />} />
      <Route path="/games/word-wrangler" element={<WordWranglerGame />} />
      <Route path="/games/dominoes" element={<DominoGame />} />
      <Route path="/games/out" element={<OutGame />} />
      <Route path="/profile" element={<NeonPlayerProfile />} />
      <Route path="/room" element={<RoomRoute />} />
      <Route path="/host" element={<Navigate to="/games" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
          <Toaster />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App