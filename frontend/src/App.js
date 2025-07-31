import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useScrollToTop } from './hooks/useScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import "./App.css";
import { Toaster } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
// Import lazyLoad utility
import { lazyLoad } from './utils/lazyLoad';
import { GuildSwitchingOverlay } from './components/GuildSwitchingOverlay';
import AppLayout from './layouts/AppLayout';
import LoadingSpinner from './components/LoadingSpinner';
// Import Zustand stores
import { useUserStore, useGuildStore, useUIStore } from './store';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import queryClient from './services/queryClient';
// Import guild switching effect hook
import { useGuildSwitchingEffect, useUserProfile } from './hooks/useQueryHooks';

// Import performance monitoring
import { initPerformanceMonitor } from './utils/performanceMonitor';

// Core components that are needed for initial render
import { DashboardLayout } from './layouts/DashboardLayout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { NoGuildsPage } from './pages/NoGuildsPage';

// Import chart performance dashboard (only used in development)
const PerformanceDashboard = process.env.NODE_ENV === 'development' 
  ? lazy(() => import('./components/performance/PerformanceDashboard'))
  : () => null;

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen z-10">
    <LoadingSpinner size="lg" color="primary" message="Loading..." />
  </div>
);

// Initialize performance monitoring in development mode
initPerformanceMonitor({
  enabled: process.env.NODE_ENV !== 'production',
  logToConsole: process.env.NODE_ENV === 'development',
  samplingRate: 0.5, // Only track 50% of events to reduce overhead
});

// Lazy loaded components using our custom utility
const Dashboard = lazyLoad(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Terms = lazyLoad(() => import('./pages/Terms').then(module => ({ default: module.Terms })));
const Privacy = lazyLoad(() => import('./pages/Privacy').then(module => ({ default: module.Privacy })));
const BotPermissions = lazyLoad(() => import('./pages/BotPermissions').then(module => ({ default: module.BotPermissions })));
const BetDetails = lazyLoad(() => import('./pages/BetDetails').then(module => ({ default: module.BetDetails })));
const Transactions = lazyLoad(() => import('./pages/Transactions').then(module => ({ default: module.Transactions })));
const GiftPoints = lazyLoad(() => import('./pages/GiftPoints').then(module => ({ default: module.GiftPoints })));
const TopPlayers = lazyLoad(() => import('./pages/TopPlayers').then(module => ({ default: module.TopPlayers })));
const Help = lazyLoad(() => import('./pages/Help').then(module => ({ default: module.Help })));
const Profile = lazyLoad(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const Preferences = lazyLoad(() => import('./pages/Preferences').then(module => ({ default: module.Preferences })));
const HelpMenu = lazyLoad(() => import('./components/HelpMenu').then(module => ({ default: module.default })));
const Support = lazyLoad(() => import('./pages/Support').then(module => ({ default: module.default })));
const StatisticsDashboard = lazyLoad(() => import('./pages/StatisticsDashboard').then(module => ({ default: module.StatisticsDashboard })));

// Game components - lazy loaded with higher priority
const CoinFlip = lazyLoad(() => import('./pages/CoinFlip').then(module => ({ default: module.CoinFlip })));
const DiceRoll = lazyLoad(() => import('./pages/DiceRoll').then(module => ({ default: module.DiceRoll })));
const Slots = lazyLoad(() => import('./pages/Slots').then(module => ({ default: module.Slots })));
const Roulette = lazyLoad(() => import('./pages/Roulette').then(module => ({ default: module.Roulette })));
const Blackjack = lazyLoad(() => import('./pages/Blackjack').then(module => ({ default: module.Blackjack })));

// Leaderboard components - lazy loaded with lower priority (load after page load)
const WinStreakLeaderboard = lazyLoad(() => import('./pages/WinStreakLeaderboard').then(module => ({ default: module.WinStreakLeaderboard })));
const BiggestWinsLeaderboard = lazyLoad(() => import('./pages/BiggestWinsLeaderboard').then(module => ({ default: module.BiggestWinsLeaderboard })));

// Admin and betting components - lazy loaded
const SuperAdmin = lazyLoad(() => import('./pages/SuperAdmin').then(module => ({ default: module.SuperAdmin })));
const CreateBetPage = lazyLoad(() => import('./pages/CreateBetPage').then(module => ({ default: module.default })));
const ViewBetPage = lazyLoad(() => import('./pages/ViewBetPage').then(module => ({ default: module.default })));
const ActiveBetsPage = lazyLoad(() => import('./pages/ActiveBetsPage').then(module => ({ default: module.default })));
const MyBetsPage = lazyLoad(() => import('./pages/MyBetsPage').then(module => ({ default: module.default })));
const BetHistoryPage = lazyLoad(() => import('./pages/BetHistoryPage').then(module => ({ default: module.default })));

// Pokémon components - lazy loaded
const PokedexPage = lazyLoad(() => import('./pages/PokedexPage').then(module => ({ default: module.default })));

function AppRoutes() {
  useScrollToTop();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/bot-permissions" element={<BotPermissions />} />
      <Route path="/commands" element={<HelpMenu />} />
      <Route path="/support" element={<Support />} />
      <Route path="/no-guilds" element={<NoGuildsPage />} />
      
      {/* Protected dashboard routes */}
      <Route 
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route 
          element={<DashboardLayout />}
        >
        <Route index element={<Dashboard />} />
        <Route path="betting/:betId" element={<BetDetails />} />
        <Route path="wallet/transactions" element={<Transactions />} />
        <Route path="wallet/gift" element={<GiftPoints />} />
        
        {/* Leaderboard routes */}
        <Route path="leaderboard/top" element={<TopPlayers />} />
        <Route path="leaderboard/streaks" element={<WinStreakLeaderboard />} />
        <Route path="leaderboard/wins" element={<BiggestWinsLeaderboard />} />
        
        {/* Game routes */}
        <Route path="games/coinflip" element={<CoinFlip />} />
        <Route path="games/diceroll" element={<DiceRoll />} />
        <Route path="games/slots" element={<Slots />} />
        <Route path="games/roulette" element={<Roulette />} />
        <Route path="games/blackjack" element={<Blackjack />} />
        
        {/* Settings routes */}
        <Route path="settings/help" element={<Help />} />
        <Route path="settings/profile" element={<Profile />} />
        <Route path="settings/preferences" element={<Preferences />} />
        
        {/* Admin routes */}
        <Route path="superadmin" element={<SuperAdmin />} />
        
        {/* Betting routes */}
        <Route path="betting/create" element={<CreateBetPage />} />
        <Route path="betting/view" element={<ViewBetPage />} />
        <Route path="betting/view/:betId" element={<ViewBetPage />} />
        <Route path="betting/active" element={<ActiveBetsPage />} />
        <Route path="betting/my" element={<MyBetsPage />} />
        <Route path="betting/history" element={<BetHistoryPage />} />
        
        {/* Statistics route */}
        <Route path="statistics" element={<StatisticsDashboard />} />
        
        {/* Pokémon routes */}
        <Route path="pokedex" element={<PokedexPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  // Initialize stores and check authentication on app load
  const checkAuth = useUserStore(state => state.checkAuth);
  const fetchGuilds = useGuildStore(state => state.fetchGuilds);
  const initializeTheme = useUIStore(state => state.initializeTheme);
  const initializeGuildStore = useGuildStore(state => state.initialize);
  
  // Use guild switching effect to handle query invalidation
  useGuildSwitchingEffect();
  
  // Get user data for profile fetching
  const user = useUserStore(state => state.user);
  
  // Use user profile hook to ensure role is updated when switching guilds
  useUserProfile(user?.discordId);
  
  // Fetch guilds when user is authenticated
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const guilds = useGuildStore(state => state.guilds);
  
  // Debug guild switching state
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const pendingGuildSwitch = useGuildStore(state => state.pendingGuildSwitch);
  
  useEffect(() => {
    // console.log('[App] Guild switching state changed:', {
    //   isGuildSwitching,
    //   selectedGuildId,
    //   pendingGuildSwitch
    // });
  }, [isGuildSwitching, selectedGuildId, pendingGuildSwitch]);
  
  useEffect(() => {
    // Check authentication status when app loads
    checkAuth();
    
    // Initialize theme from Zustand store to document (only once on mount)
    initializeTheme();
    
    // Initialize guild store
    initializeGuildStore();
  }, []); // Remove store functions from dependency array to prevent infinite loops
  
  // Fetch guilds when user is authenticated
  useEffect(() => {
    // console.log('[App] User state:', { 
    //   user: user?.discordId, 
    //   selectedGuildId, 
    //   guildsCount: guilds.length 
    // });
    
    if (user?.discordId) {
      // console.log('[App] Fetching guilds for user:', user.discordId);
      fetchGuilds(user.discordId);
    }
  }, [user?.discordId, selectedGuildId, guilds.length]); // Remove fetchGuilds from dependency array
  
  return (
    <>
      <Toaster position="top-right" containerClassName="z-[9999]" />
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          {/* Guild switching overlay - highest priority, outside Suspense */}
          <GuildSwitchingOverlay />
          <Suspense fallback={<LoadingFallback />}>
            <AppRoutes />
            {process.env.NODE_ENV === 'development' && <PerformanceDashboard />}
          </Suspense>
          {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
        </ErrorBoundary>
      </QueryClientProvider>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
