import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Home from '@/pages/Home';
import Welcome from '@/pages/Welcome';
import BFFGame from '@/pages/BFFGame';
import SquareBizGame from '@/pages/SquareBizGame';
import HangmanGame from '@/pages/HangmanGame';
import SpadesGame from '@/pages/SpadesGame';
import GamePlaceholder from '@/pages/GamePlaceholder';
import JoinRoom from '@/pages/JoinRoom';
import PlaceholderPage from '@/pages/PlaceholderPage';
import HostPanel from '@/pages/HostPanel';
import Games from '@/pages/Games';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import WordSearchGame from '@/pages/WordSearchGame';
import ViralGame from '@/pages/ViralGame';
import NameThatTrackGame from '@/pages/NameThatTrackGame';
import SudokuGame from '@/pages/SudokuGame';
import SeeThatGame from '@/pages/SeeThatGame';
import WordWranglerGame from '@/pages/WordWranglerGame';
import DominoHost from '@/pages/DominoHost';
import DominoGame from '@/pages/DominoGame';
import NeonPlayerProfile from '@/pages/NeonPlayerProfile';
import Register from '@/pages/Register';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import TngOnboarding from '@/pages/TngOnboarding';
import GameDisplay from '@/pages/GameDisplay';
import { getPreviewTngProfile, isBase44Preview } from '@/lib/previewTngProfile';
import { isNeonStaging } from '@/lib/neonAuth';

function HomeGate() {
  const seen = localStorage.getItem('tn_welcome_seen');
  if (!seen) { window.location.replace('/welcome'); return null; }
  return <Home />;
}

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const profileGateEnabled = isBase44Preview || isNeonStaging;
  const [profileState, setProfileState] = useState('idle');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function checkPreviewProfile() {
      if (!profileGateEnabled || isLoadingAuth || isLoadingPublicSettings || !isAuthenticated || !user) {
        setProfileState('idle');
        setProfileError('');
        return;
      }

      setProfileState('checking');
      setProfileError('');

      try {
        const profile = await getPreviewTngProfile(user);
        if (cancelled) return;
        setProfileState(profile ? 'ready' : 'missing');
      } catch (error) {
        if (cancelled) return;
        console.error('[TNG Preview profile gate] profile check failed:', error);
        setProfileError(error.message || 'TNG could not verify your profile.');
        setProfileState('error');
      }
    }

    checkPreviewProfile();
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

  // Show loading spinner while checking app public settings, auth, or Preview TNG profile
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
    '/onboarding',
    '/forgot-password',
    '/reset-password',
  ]);

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
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<TngOnboarding />} />
      <Route path="/display" element={<GameDisplay />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
      <Route path="/games/name-that-track" element={<NameThatTrackGame />} />
      <Route path="/games/sudoku" element={<SudokuGame />} />
      <Route path="/games/see-that" element={<SeeThatGame />} />
      <Route path="/games/word-wrangler" element={<WordWranglerGame />} />
      <Route path="/games/dominoes/host" element={<DominoHost />} />
      <Route path="/games/dominoes" element={<DominoGame />} />
      <Route path="/profile" element={<NeonPlayerProfile />} />
      <Route path="/host" element={<HostPanel />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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