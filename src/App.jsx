import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Home from '@/pages/Home';
import Welcome from '@/pages/Welcome';
import BFFGame from '@/pages/BFFGame.jsx';
import SquareBizGame from '@/pages/SquareBizGame';
import HangmanGame from '@/pages/HangmanGame';
import GamePlaceholder from '@/pages/GamePlaceholder';
import JoinRoom from '@/pages/JoinRoom';
import PlaceholderPage from '@/pages/PlaceholderPage';
import HostPanel from '@/pages/HostPanel';

function HomeGate() {
  const seen = localStorage.getItem('tn_welcome_seen');
  if (!seen) { window.location.replace('/welcome'); return null; }
  return <Home />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
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

  // Render the main app
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/" element={<HomeGate />} />
      <Route path="/games" element={<PlaceholderPage />} />
      <Route path="/games/bff" element={<BFFGame />} />
      <Route path="/games/square-biz" element={<SquareBizGame />} />
      <Route path="/games/hangman" element={<HangmanGame />} />
      <Route path="/join/:roomCode" element={<JoinRoom />} />
      <Route path="/live-status" element={<PlaceholderPage />} />
      <Route path="/about" element={<PlaceholderPage />} />
      <Route path="/contact" element={<PlaceholderPage />} />
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
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App