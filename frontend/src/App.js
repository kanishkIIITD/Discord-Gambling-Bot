import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AuthCallback } from './pages/AuthCallback';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Landing } from './pages/Landing';
import { BotPermissions } from './pages/BotPermissions';
import { BetDetails } from './pages/BetDetails';
import { useScrollToTop } from './hooks/useScrollToTop';
import "./App.css";
import { DashboardLayout } from './layouts/DashboardLayout';
import { Transactions } from './pages/Transactions';
import { GiftPoints } from './pages/GiftPoints';
import { TopPlayers } from './pages/TopPlayers';
import { Help } from './pages/Help';
import { Profile } from './pages/Profile';
import { Preferences } from './pages/Preferences';
import { CoinFlip } from './pages/CoinFlip';
import { DiceRoll } from './pages/DiceRoll';
import { Slots } from './pages/Slots';
import { Roulette } from './pages/Roulette';
import { Blackjack } from './pages/Blackjack';
import { WinStreakLeaderboard } from './pages/WinStreakLeaderboard';
import { BiggestWinsLeaderboard } from './pages/BiggestWinsLeaderboard';
import { SuperAdmin } from './pages/SuperAdmin';
import CreateBetPage from './pages/CreateBetPage';
import ViewBetPage from './pages/ViewBetPage';
import ActiveBetsPage from './pages/ActiveBetsPage';
import MyBetsPage from './pages/MyBetsPage';
import BetHistoryPage from './pages/BetHistoryPage';
import { Toaster } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

function AppRoutes() {
  useScrollToTop();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/bot-permissions" element={<BotPermissions />} />
      <Route 
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="betting/:betId" element={<BetDetails />} />
        <Route path="wallet/transactions" element={<Transactions />} />
        <Route path="wallet/gift" element={<GiftPoints />} />
        <Route path="leaderboard/top" element={<TopPlayers />} />
        <Route path="leaderboard/streaks" element={<WinStreakLeaderboard />} />
        <Route path="leaderboard/wins" element={<BiggestWinsLeaderboard />} />
        <Route path="games/coinflip" element={<CoinFlip />} />
        <Route path="games/diceroll" element={<DiceRoll />} />
        <Route path="games/slots" element={<Slots />} />
        <Route path="games/roulette" element={<Roulette />} />
        <Route path="games/blackjack" element={<Blackjack />} />
        <Route path="settings/help" element={<Help />} />
        <Route path="settings/profile" element={<Profile />} />
        <Route path="settings/preferences" element={<Preferences />} />
        <Route path="superadmin" element={<SuperAdmin />} />
        <Route path="betting/create" element={<CreateBetPage />} />
        <Route path="betting/view" element={<ViewBetPage />} />
        <Route path="betting/view/:betId" element={<ViewBetPage />} />
        <Route path="betting/active" element={<ActiveBetsPage />} />
        <Route path="betting/my" element={<MyBetsPage />} />
        <Route path="betting/history" element={<BetHistoryPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <>
      <Toaster position="top-right" containerClassName="z-[9999]" />
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
