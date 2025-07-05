import React, { useState, Suspense } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

// Import loading state management components and hooks
// Note: LoadingProvider is no longer needed as we're using Zustand store
import { LoadingSpinner } from '../LoadingSpinner';
import { withLoading } from '../withLoading';
import { SuspenseWithLoading } from '../SuspenseWithLoading';
import { LoadingRoute, useLoadingNavigation } from '../LoadingRoute';
import { useLoadingQuery, useLoadingMutation } from '../../hooks/useLoadingQuery';
import { useLoadingInfiniteQuery } from '../../hooks/useLoadingInfiniteQuery';
import { usePrefetchOnHover } from '../../hooks/usePrefetchOnHover';
import { useOptimisticMutation } from '../../hooks/useOptimisticMutation';
import { useLoadingForm } from '../../hooks/useLoadingForm';
import { useLoadingInvalidation } from '../../hooks/useLoadingInvalidation';

// Create a new QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

// Mock API functions
const fetchDashboardData = async () => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return {
    username: 'Player123',
    balance: 5000,
    level: 42,
    lastLogin: new Date().toISOString(),
  };
};

const fetchGames = async ({ pageParam = 0 }) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const games = Array.from({ length: 6 }, (_, i) => ({
    id: pageParam * 6 + i + 1,
    name: `Game ${pageParam * 6 + i + 1}`,
    type: ['Slots', 'Poker', 'Blackjack', 'Roulette'][Math.floor(Math.random() * 4)],
    minBet: Math.floor(Math.random() * 10) * 5 + 5,
    maxBet: Math.floor(Math.random() * 20) * 50 + 100,
    popularity: Math.floor(Math.random() * 100),
  }));
  
  return {
    games,
    nextPage: pageParam + 1,
    hasMore: pageParam < 3, // Limit to 4 pages for demo
  };
};

const fetchGameDetails = async (gameId) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    id: gameId,
    name: `Game ${gameId}`,
    type: ['Slots', 'Poker', 'Blackjack', 'Roulette'][Math.floor(Math.random() * 4)],
    description: `This is a detailed description for Game ${gameId}. It includes all the rules and information about how to play and win.`,
    minBet: Math.floor(Math.random() * 10) * 5 + 5,
    maxBet: Math.floor(Math.random() * 20) * 50 + 100,
    popularity: Math.floor(Math.random() * 100),
    createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
    lastPlayed: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
    winRate: Math.random() * 0.3 + 0.4, // 40-70% win rate
  };
};

const placeBet = async ({ gameId, amount }) => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const win = Math.random() > 0.6; // 40% chance to win
  const winAmount = win ? amount * (Math.random() * 2 + 1) : 0;
  
  return {
    id: Math.floor(Math.random() * 1000000),
    gameId,
    betAmount: amount,
    outcome: win ? 'win' : 'loss',
    winAmount,
    timestamp: new Date().toISOString(),
  };
};

const updateUserProfile = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { ...data, updatedAt: new Date().toISOString() };
};

// Dashboard component with loading state
const Dashboard = () => {
  const { data: dashboardData, isLoading } = useLoadingQuery(
    'dashboardData',
    fetchDashboardData,
    {},
    'dashboardLoading'
  );
  
  const { invalidateWithLoading } = useLoadingInvalidation();
  
  const handleRefresh = () => {
    invalidateWithLoading('dashboardData');
  };
  
  if (isLoading) {
    return <LoadingSpinner size="lg" overlay={true} message="Loading dashboard..." />;
  }
  
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Player Dashboard</h2>
        <button
          onClick={handleRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Refresh
        </button>
      </div>
      
      {dashboardData && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 p-4 rounded-md">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">Account</h3>
            <p className="text-white text-xl font-bold">{dashboardData.username}</p>
            <p className="text-gray-400 text-sm">Level {dashboardData.level}</p>
          </div>
          
          <div className="bg-gray-700 p-4 rounded-md">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">Balance</h3>
            <p className="text-green-400 text-xl font-bold">${dashboardData.balance.toLocaleString()}</p>
            <p className="text-gray-400 text-sm">Last login: {new Date(dashboardData.lastLogin).toLocaleString()}</p>
          </div>
        </div>
      )}
      
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/games" className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-md text-center">
            Browse Games
          </Link>
          <Link to="/profile" className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-md text-center">
            Edit Profile
          </Link>
        </div>
      </div>
    </div>
  );
};

// Game list component with infinite loading
const GamesList = () => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    observerRef,
  } = useLoadingInfiniteQuery(
    'games',
    fetchGames,
    {
      getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    },
    'gamesInitialLoad',
    'gamesNextPage'
  );
  
  // Game card component with prefetch on hover
  const GameCard = ({ game }) => {
    const { prefetchProps, isPrefetching } = usePrefetchOnHover({
      queryKey: ['gameDetails', game.id],
      queryFn: () => fetchGameDetails(game.id),
      loadingKey: `prefetchGame_${game.id}`,
      hoverDelay: 300,
    });
    
    const navigate = useNavigate();
    
    return (
      <div
        {...prefetchProps}
        className="bg-gray-700 p-4 rounded-lg shadow-md hover:bg-gray-600 transition-colors cursor-pointer relative"
        onClick={() => navigate(`/games/${game.id}`)}
      >
        {isPrefetching && (
          <div className="absolute top-2 right-2">
            <LoadingSpinner size="sm" color="#9CA3AF" />
          </div>
        )}
        
        <h3 className="text-lg font-semibold text-white mb-2">{game.name}</h3>
        <p className="text-gray-300 text-sm mb-3">{game.type}</p>
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>Min: ${game.minBet}</span>
          <span>Max: ${game.maxBet}</span>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-green-500 h-full"
              style={{ width: `${game.popularity}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{game.popularity}% Popularity</p>
        </div>
      </div>
    );
  };
  
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6">Available Games</h2>
      
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.pages.map((page) =>
            page.games.map((game) => <GameCard key={game.id} game={game} />)
          )}
        </div>
      )}
      
      {hasNextPage && (
        <div
          ref={observerRef}
          className="mt-6 p-4 flex justify-center"
        >
          {isFetchingNextPage ? (
            <LoadingSpinner size="md" color="#9CA3AF" />
          ) : (
            <button
              onClick={() => fetchNextPage()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Load More Games
            </button>
          )}
        </div>
      )}
      
      {!hasNextPage && data && (
        <p className="text-center text-gray-400 mt-6">
          No more games to load
        </p>
      )}
    </div>
  );
};

// Game details component with optimistic updates
const GameDetails = ({ gameId }) => {
  const [betAmount, setBetAmount] = useState(10);
  const { data: gameDetails } = useLoadingQuery(
    ['gameDetails', gameId],
    () => fetchGameDetails(gameId),
    {},
    `gameDetails_${gameId}`
  );
  
  const { data: dashboardData, refetch: refetchDashboard } = useLoadingQuery(
    'dashboardData',
    fetchDashboardData,
    {},
    'dashboardLoading'
  );
  
  // Optimistic mutation for placing bets
  const placeBetMutation = useOptimisticMutation(
    (betData) => placeBet(betData),
    {
      queryKey: 'dashboardData',
      loadingKey: 'placeBet',
      onMutate: async ({ amount }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries('dashboardData');
        
        // Snapshot the previous value
        const previousData = queryClient.getQueryData('dashboardData');
        
        // Optimistically update the balance
        if (previousData) {
          queryClient.setQueryData('dashboardData', {
            ...previousData,
            balance: previousData.balance - amount,
          });
        }
        
        return { previousData };
      },
      onError: (err, { amount }, context) => {
        // If there was an error, roll back to the previous value
        queryClient.setQueryData('dashboardData', context.previousData);
      },
      onSuccess: async (result) => {
        // On success, update the balance with the actual result
        const currentData = queryClient.getQueryData('dashboardData');
        
        if (currentData && result) {
          const newBalance = result.outcome === 'win'
            ? currentData.balance + result.winAmount
            : currentData.balance;
          
          queryClient.setQueryData('dashboardData', {
            ...currentData,
            balance: newBalance,
          });
          
          // Refetch to ensure data consistency
          await refetchDashboard();
        }
      },
    }
  );
  
  const handlePlaceBet = () => {
    if (!gameDetails || !dashboardData) return;
    
    // Validate bet amount
    if (betAmount < gameDetails.minBet || betAmount > gameDetails.maxBet) {
      alert(`Bet amount must be between $${gameDetails.minBet} and $${gameDetails.maxBet}`);
      return;
    }
    
    if (betAmount > dashboardData.balance) {
      alert('Insufficient balance');
      return;
    }
    
    // Place bet
    placeBetMutation.mutate({
      gameId: gameDetails.id,
      amount: betAmount,
    });
  };
  
  if (!gameDetails) {
    return <LoadingSpinner size="lg" overlay={true} message={`Loading game ${gameId}...`} />;
  }
  
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-2">{gameDetails.name}</h2>
      <p className="text-gray-300 mb-6">{gameDetails.type}</p>
      
      <div className="bg-gray-700 p-4 rounded-md mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Game Details</h3>
        <p className="text-gray-400 mb-4">{gameDetails.description}</p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Min Bet: <span className="text-white">${gameDetails.minBet}</span></p>
            <p className="text-gray-400">Max Bet: <span className="text-white">${gameDetails.maxBet}</span></p>
            <p className="text-gray-400">Win Rate: <span className="text-white">{Math.round(gameDetails.winRate * 100)}%</span></p>
          </div>
          <div>
            <p className="text-gray-400">Created: <span className="text-white">{new Date(gameDetails.createdAt).toLocaleDateString()}</span></p>
            <p className="text-gray-400">Last Played: <span className="text-white">{new Date(gameDetails.lastPlayed).toLocaleDateString()}</span></p>
            <p className="text-gray-400">Popularity: <span className="text-white">{gameDetails.popularity}%</span></p>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-700 p-4 rounded-md">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">Place a Bet</h3>
        
        <div className="flex items-center mb-4">
          <label className="text-gray-400 mr-3">Bet Amount:</label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            min={gameDetails.minBet}
            max={gameDetails.maxBet}
            className="bg-gray-800 text-white px-3 py-2 rounded-md w-24"
          />
        </div>
        
        <button
          onClick={handlePlaceBet}
          disabled={placeBetMutation.isLoading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md w-full disabled:opacity-50"
        >
          {placeBetMutation.isLoading ? 'Processing...' : 'Place Bet'}
        </button>
        
        {placeBetMutation.data && (
          <div className={`mt-4 p-3 rounded-md ${placeBetMutation.data.outcome === 'win' ? 'bg-green-900' : 'bg-red-900'}`}>
            <p className="font-bold text-white">
              {placeBetMutation.data.outcome === 'win' ? 'You Won!' : 'You Lost'}
            </p>
            {placeBetMutation.data.outcome === 'win' && (
              <p className="text-green-300">+${placeBetMutation.data.winAmount.toFixed(2)}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Bet ID: {placeBetMutation.data.id}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Profile component with form loading state
const Profile = () => {
  const { data: userData } = useLoadingQuery(
    'dashboardData',
    fetchDashboardData,
    {},
    'profileLoading'
  );
  
  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    getFieldProps,
  } = useLoadingForm({
    initialValues: {
      username: userData?.username || '',
      email: 'user@example.com',
      notificationsEnabled: true,
    },
    validate: (values) => {
      const errors = {};
      
      if (!values.username) {
        errors.username = 'Username is required';
      }
      
      if (!values.email) {
        errors.email = 'Email is required';
      } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
        errors.email = 'Invalid email address';
      }
      
      return errors;
    },
    onSubmit: async (values) => {
      // Simulate API call
      await updateUserProfile(values);
      alert('Profile updated successfully!');
    },
    loadingKey: 'profileUpdate',
  });
  
  if (!userData) {
    return <LoadingSpinner size="lg" overlay={true} message="Loading profile..." />;
  }
  
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6">Edit Profile</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-300 mb-2">Username</label>
          <input
            {...getFieldProps('username')}
            type="text"
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-md"
          />
          {touched.username && errors.username && (
            <p className="text-red-500 text-sm mt-1">{errors.username}</p>
          )}
        </div>
        
        <div>
          <label className="block text-gray-300 mb-2">Email</label>
          <input
            {...getFieldProps('email')}
            type="email"
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-md"
          />
          {touched.email && errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email}</p>
          )}
        </div>
        
        <div className="flex items-center">
          <input
            {...getFieldProps('notificationsEnabled')}
            type="checkbox"
            className="mr-2"
          />
          <label className="text-gray-300">Enable notifications</label>
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md w-full disabled:opacity-50"
        >
          {isSubmitting ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
};

// Navigation component with loading state
const Navigation = () => {
  const { navigateWithLoading, isNavigating } = useLoadingNavigation();
  
  return (
    <nav className="bg-gray-900 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-white font-bold text-xl">Gambling App</div>
        
        <div className="flex space-x-4">
          <button
            onClick={() => navigateWithLoading('/')}
            className="text-gray-300 hover:text-white"
            disabled={isNavigating}
          >
            Dashboard
          </button>
          <button
            onClick={() => navigateWithLoading('/games')}
            className="text-gray-300 hover:text-white"
            disabled={isNavigating}
          >
            Games
          </button>
          <button
            onClick={() => navigateWithLoading('/profile')}
            className="text-gray-300 hover:text-white"
            disabled={isNavigating}
          >
            Profile
          </button>
        </div>
        
        {isNavigating && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-800">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
          </div>
        )}
      </div>
    </nav>
  );
};

// Main app component
const ComprehensiveLoadingExample = () => {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Note: LoadingProvider is no longer needed as we're using Zustand store */}
      <Router>
        <div className="min-h-screen bg-gray-900 text-white">
          <Navigation />
          
          <div className="container mx-auto py-8 px-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/games" element={<GamesList />} />
              <Route 
                path="/games/:gameId" 
                element={
                  <SuspenseWithLoading
                    loadingKey="gameDetailsLoad"
                    size="lg"
                    overlay={true}
                    message="Loading game details..."
                  >
                    <GameDetailsWrapper />
                  </SuspenseWithLoading>
                } 
              />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
};

// Wrapper for GameDetails to get the gameId from URL params
const GameDetailsWrapper = () => {
  const gameId = window.location.pathname.split('/').pop();
  return <GameDetails gameId={gameId} />;
};

export default ComprehensiveLoadingExample;