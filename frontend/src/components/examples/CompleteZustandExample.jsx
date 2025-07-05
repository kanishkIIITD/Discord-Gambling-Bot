import React, { useState, useEffect } from 'react';
import { useUserStore, useWalletStore, useGuildStore, useUIStore } from '../../store';
import { useZustandQuery } from '../../hooks/useZustandQuery';
import { useZustandMutation } from '../../hooks/useZustandQuery';
import { useZustandInfiniteQuery } from '../../hooks/useZustandInfiniteQuery';
import { useZustandQueryInvalidation } from '../../hooks/useZustandQueryInvalidation';
import { useLoading } from '../../hooks/useLoading';
import { ChartLoadingSpinner } from '../ui/ChartLoadingSpinner';

/**
 * CompleteZustandExample - A comprehensive example showing how to use Zustand stores
 * with React Query integration for a complete feature implementation.
 * 
 * This example demonstrates:
 * 1. Authentication with Zustand
 * 2. Guild selection with Zustand
 * 3. Data fetching with React Query + Zustand
 * 4. Loading state management
 * 5. Error handling
 * 6. Optimistic updates
 * 7. Theme switching
 */
const CompleteZustandExample = () => {
  // Local state
  const [betAmount, setBetAmount] = useState(100);
  const [gameSelection, setGameSelection] = useState('coinflip');
  
  // User store selectors
  const user = useUserStore(state => state.user);
  const login = useUserStore(state => state.login);
  const logout = useUserStore(state => state.logout);
  const isAuthenticated = useUserStore(state => !!state.user);
  
  // Wallet store selectors
  const balance = useWalletStore(state => state.balance);
  const fetchBalance = useWalletStore(state => state.fetchBalance);
  const updateBalanceOptimistically = useWalletStore(state => state.updateBalanceOptimistically);
  const addTransactionOptimistically = useWalletStore(state => state.addTransactionOptimistically);
  
  // Guild store selectors
  const guilds = useGuildStore(state => state.guilds);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const selectGuild = useGuildStore(state => state.selectGuild);
  const getSelectedGuild = useGuildStore(state => state.getSelectedGuild);
  
  // UI store selectors
  const theme = useUIStore(state => state.theme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  const enableAnimations = useUIStore(state => state.enableAnimations);
  const disableAnimations = useUIStore(state => state.disableAnimations);
  const animations = useUIStore(state => state.animations);
  
  // Loading hook (compatibility layer)
  const { isLoading, withLoading } = useLoading();
  
  // Query invalidation hook
  const { invalidateQuery } = useZustandQueryInvalidation();
  
  // Selected guild data
  const selectedGuild = getSelectedGuild();

  // Fetch user stats with React Query + Zustand integration
  const { 
    data: userStats,
    refetch: refetchUserStats
  } = useZustandQuery(
    ['userStats', selectedGuildId, user?.id],
    async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        totalBets: 120,
        winRate: 0.52,
        favoriteGame: 'coinflip',
        biggestWin: 5000,
        recentGames: [
          { id: 1, game: 'coinflip', amount: 100, outcome: 'win', timestamp: new Date().toISOString() },
          { id: 2, game: 'roulette', amount: 200, outcome: 'loss', timestamp: new Date().toISOString() },
          { id: 3, game: 'slots', amount: 50, outcome: 'win', timestamp: new Date().toISOString() },
        ]
      };
    },
    {
      enabled: isAuthenticated && !!selectedGuildId,
      staleTime: 60000, // 1 minute
    },
    'userStatsLoading'
  );

  // Place bet mutation with optimistic updates
  const { mutate: placeBet } = useZustandMutation(
    async ({ game, amount, choice }) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate game outcome (win/lose)
      const isWin = Math.random() > 0.5;
      const winAmount = isWin ? amount * 2 : 0;
      const netChange = isWin ? amount : -amount;
      
      return {
        id: `bet-${Date.now()}`,
        game,
        amount,
        choice,
        outcome: isWin ? 'win' : 'loss',
        winAmount,
        netChange,
        timestamp: new Date().toISOString()
      };
    },
    {
      // Before mutation runs
      onMutate: ({ game, amount }) => {
        // Optimistically update balance
        updateBalanceOptimistically(-amount);
        
        // Add pending transaction
        addTransactionOptimistically({
          id: `pending-${Date.now()}`,
          type: 'bet',
          amount: -amount,
          game,
          status: 'pending',
          timestamp: new Date().toISOString()
        });
      },
      // On successful bet
      onSuccess: (data) => {
        // Update balance with actual result
        updateBalanceOptimistically(data.netChange + data.amount); // Add back the original bet amount
        
        // Add completed transaction
        addTransactionOptimistically({
          id: data.id,
          type: 'bet_result',
          amount: data.netChange,
          game: data.game,
          status: 'completed',
          outcome: data.outcome,
          timestamp: data.timestamp
        });
        
        // Invalidate user stats to refresh
        invalidateQuery(['userStats', selectedGuildId, user?.id]);
      },
      // On error
      onError: (error, { amount }) => {
        // Revert optimistic balance update
        updateBalanceOptimistically(amount);
        
        // Show error toast or notification
        console.error('Bet failed:', error);
      }
    },
    'placeBetLoading'
  );

  // Initialize data when component mounts
  useEffect(() => {
    if (isAuthenticated && !balance) {
      fetchBalance();
    }
  }, [isAuthenticated, balance, fetchBalance]);

  // Handle login
  const handleLogin = async () => {
    await withLoading('login', async () => {
      await login('user@example.com', 'password');
    });
  };

  // Handle placing a bet
  const handlePlaceBet = () => {
    if (!isAuthenticated) {
      alert('Please login first');
      return;
    }
    
    if (betAmount > balance) {
      alert('Insufficient balance');
      return;
    }
    
    placeBet({
      game: gameSelection,
      amount: betAmount,
      choice: gameSelection === 'coinflip' ? 'heads' : 'red'
    });
  };

  return (
    <div className={`p-6 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header with theme toggle and auth */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Gambling Platform</h1>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={toggleTheme}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            
            <button 
              onClick={animations ? disableAnimations : enableAnimations}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              {animations ? '🚫 Disable Animations' : '✨ Enable Animations'}
            </button>
            
            {isAuthenticated ? (
              <button 
                onClick={logout}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Logout
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                disabled={isLoading('login')}
              >
                {isLoading('login') ? 'Logging in...' : 'Login'}
              </button>
            )}
          </div>
        </div>
        
        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column - User info and guild selection */}
          <div className="md:col-span-1">
            <div className="bg-opacity-10 bg-blue-500 p-4 rounded-lg shadow-md">
              {isAuthenticated ? (
                <>
                  <h2 className="text-xl font-semibold mb-4">User Profile</h2>
                  <p className="mb-2"><strong>Username:</strong> {user.displayName || user.email}</p>
                  <p className="mb-4"><strong>Balance:</strong> ${balance?.toFixed(2) || '0.00'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Select Guild</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {guilds?.map(guild => (
                      <button
                        key={guild.id}
                        onClick={() => selectGuild(guild.id)}
                        className={`px-2 py-1 text-sm rounded ${selectedGuildId === guild.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
                      >
                        {guild.name}
                      </button>
                    )) || 'No guilds available'}
                  </div>
                  
                  {selectedGuild && (
                    <div className="mt-4">
                      <h3 className="text-lg font-semibold">Current Guild</h3>
                      <p>{selectedGuild.name}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="mb-4">Please login to view your profile</p>
                  <button 
                    onClick={handleLogin}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Login
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Middle column - Game interface */}
          <div className="md:col-span-1">
            <div className="bg-opacity-10 bg-purple-500 p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Place a Bet</h2>
              
              <div className="mb-4">
                <label className="block mb-2">Game</label>
                <select
                  value={gameSelection}
                  onChange={(e) => setGameSelection(e.target.value)}
                  className="w-full p-2 rounded bg-opacity-50 bg-white text-gray-800"
                >
                  <option value="coinflip">Coin Flip</option>
                  <option value="roulette">Roulette</option>
                  <option value="slots">Slots</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block mb-2">Bet Amount</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  min="10"
                  max={balance || 1000}
                  className="w-full p-2 rounded bg-opacity-50 bg-white text-gray-800"
                />
              </div>
              
              <button
                onClick={handlePlaceBet}
                disabled={!isAuthenticated || isLoading('placeBetLoading')}
                className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading('placeBetLoading') ? 'Placing Bet...' : 'Place Bet'}
              </button>
            </div>
          </div>
          
          {/* Right column - Stats */}
          <div className="md:col-span-1">
            <div className="bg-opacity-10 bg-green-500 p-4 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Your Stats</h2>
                <button
                  onClick={refetchUserStats}
                  className="text-sm px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Refresh
                </button>
              </div>
              
              {isLoading('userStatsLoading') ? (
                <div className="flex justify-center py-8">
                  <ChartLoadingSpinner size="md" message="Loading stats..." />
                </div>
              ) : userStats ? (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-opacity-20 bg-blue-500 p-3 rounded">
                      <p className="text-sm">Total Bets</p>
                      <p className="text-2xl font-bold">{userStats.totalBets}</p>
                    </div>
                    <div className="bg-opacity-20 bg-green-500 p-3 rounded">
                      <p className="text-sm">Win Rate</p>
                      <p className="text-2xl font-bold">{(userStats.winRate * 100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-opacity-20 bg-purple-500 p-3 rounded">
                      <p className="text-sm">Favorite Game</p>
                      <p className="text-xl font-bold capitalize">{userStats.favoriteGame}</p>
                    </div>
                    <div className="bg-opacity-20 bg-yellow-500 p-3 rounded">
                      <p className="text-sm">Biggest Win</p>
                      <p className="text-2xl font-bold">${userStats.biggestWin}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2">Recent Games</h3>
                  <div className="space-y-2">
                    {userStats.recentGames.map(game => (
                      <div 
                        key={game.id}
                        className={`p-2 rounded flex justify-between ${game.outcome === 'win' ? 'bg-green-100 bg-opacity-20' : 'bg-red-100 bg-opacity-20'}`}
                      >
                        <span className="capitalize">{game.game}</span>
                        <span className={game.outcome === 'win' ? 'text-green-400' : 'text-red-400'}>
                          {game.outcome === 'win' ? '+' : '-'}${game.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center py-8">
                  {isAuthenticated ? 
                    'Select a guild to view your stats' : 
                    'Login to view your stats'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteZustandExample;