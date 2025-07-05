import React, { useState } from 'react';
import { useUserStore, useWalletStore, useGuildStore, useUIStore } from '../../store';
import { useZustandQuery } from '../../hooks/useZustandQuery';
import { useZustandMutation } from '../../hooks/useZustandQuery';
import { useZustandInfiniteQuery } from '../../hooks/useZustandInfiniteQuery';
import { useZustandQueryInvalidation } from '../../hooks/useZustandQueryInvalidation';
import { ChartLoadingSpinner } from '../ui/ChartLoadingSpinner';

/**
 * Example component demonstrating the integration of Zustand stores with React Query
 * Shows how to fetch data, handle loading states, and manage UI state
 */
const ZustandQueryExample = () => {
  const [page, setPage] = useState(1);
  
  // User store selectors
  const user = useUserStore(state => state.user);
  const login = useUserStore(state => state.login);
  const logout = useUserStore(state => state.logout);
  
  // Wallet store selectors
  const balance = useWalletStore(state => state.balance);
  const transactions = useWalletStore(state => state.transactions);
  const fetchBalance = useWalletStore(state => state.fetchBalance);
  
  // Guild store selectors
  const guilds = useGuildStore(state => state.guilds);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const selectGuild = useGuildStore(state => state.selectGuild);
  
  // UI store selectors
  const theme = useUIStore(state => state.theme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  const loadingStates = useUIStore(state => state.loadingStates);
  const errors = useUIStore(state => state.errors);
  
  // Query invalidation hook
  const { invalidateQuery, invalidateQueries } = useZustandQueryInvalidation();

  // Example query using Zustand integration
  const { data: userData, isLoading: isUserLoading } = useZustandQuery(
    ['user', user?.id],
    async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { ...user, lastActive: new Date().toISOString() };
    },
    {
      enabled: !!user?.id,
      staleTime: 60000,
    },
    'userProfileLoading'
  );

  // Example mutation using Zustand integration
  const { mutate: updateProfile, isLoading: isUpdating } = useZustandMutation(
    async (newData) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { ...user, ...newData };
    },
    {
      onSuccess: (data) => {
        // Update user store with new data
        useUserStore.getState().updateUserProfile(data);
        // Invalidate user query
        invalidateQuery(['user', user?.id]);
      },
    },
    'updateProfileLoading'
  );

  // Example infinite query using Zustand integration
  const {
    data: transactionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isTransactionsLoading,
  } = useZustandInfiniteQuery(
    ['transactions', selectedGuildId],
    async ({ pageParam = 1 }) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        data: Array(10).fill(0).map((_, i) => ({
          id: `tx-${pageParam}-${i}`,
          amount: Math.floor(Math.random() * 1000),
          type: Math.random() > 0.5 ? 'deposit' : 'withdrawal',
          timestamp: new Date().toISOString(),
        })),
        nextPage: pageParam < 5 ? pageParam + 1 : undefined,
      };
    },
    {
      enabled: !!selectedGuildId,
      getNextPageParam: (lastPage) => lastPage.nextPage,
    },
    'transactionsInfiniteLoading'
  );

  // Handle login
  const handleLogin = async () => {
    await login('user@example.com', 'password');
    fetchBalance(); // Fetch wallet balance after login
  };

  // Handle profile update
  const handleUpdateProfile = () => {
    updateProfile({ displayName: `User ${Math.floor(Math.random() * 1000)}` });
  };

  // Handle guild selection
  const handleSelectGuild = (guildId) => {
    selectGuild(guildId);
    // Invalidate multiple queries related to guild change
    invalidateQueries(
      [['transactions', guildId], ['stats', guildId]],
      {},
      'guildChangeInvalidation'
    );
  };

  // Render loading spinner for specific loading state
  const renderLoadingState = (key, message) => {
    if (loadingStates[key]) {
      return <ChartLoadingSpinner size="sm" message={message} />;
    }
    return null;
  };

  // Render error message for specific error state
  const renderError = (key) => {
    if (errors[key]) {
      return <div className="text-red-500">{errors[key].message}</div>;
    }
    return null;
  };

  return (
    <div className={`p-6 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <h1 className="text-2xl font-bold mb-6">Zustand + React Query Example</h1>
      
      {/* Theme Toggle */}
      <div className="mb-6">
        <button 
          onClick={toggleTheme}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Toggle Theme (Current: {theme})
        </button>
      </div>
      
      {/* User Authentication */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">User Authentication</h2>
        {user ? (
          <>
            <p>Welcome, {userData?.displayName || user.email}</p>
            <p>Last active: {userData?.lastActive || 'Loading...'}</p>
            {renderLoadingState('userProfileLoading', 'Loading user profile...')}
            {renderError('userProfileLoading')}
            <div className="mt-2 flex space-x-2">
              <button 
                onClick={handleUpdateProfile}
                disabled={isUpdating}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Update Profile
              </button>
              <button 
                onClick={logout}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
            {renderLoadingState('updateProfileLoading', 'Updating profile...')}
            {renderError('updateProfileLoading')}
          </>
        ) : (
          <>
            <p>Please login to continue</p>
            <button 
              onClick={handleLogin}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Login
            </button>
          </>
        )}
      </div>
      
      {/* Guild Selection */}
      {user && (
        <div className="mb-6 p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Guild Selection</h2>
          <div className="flex space-x-2">
            {['guild-1', 'guild-2', 'guild-3'].map(guildId => (
              <button
                key={guildId}
                onClick={() => handleSelectGuild(guildId)}
                className={`px-3 py-1 rounded ${selectedGuildId === guildId ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-800'}`}
              >
                {guildId}
              </button>
            ))}
          </div>
          {renderLoadingState('guildChangeInvalidation', 'Updating guild data...')}
        </div>
      )}
      
      {/* Wallet Information */}
      {user && (
        <div className="mb-6 p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Wallet</h2>
          <p>Balance: {balance !== null ? `$${balance.toFixed(2)}` : 'Loading...'}</p>
          <button 
            onClick={fetchBalance}
            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Balance
          </button>
        </div>
      )}
      
      {/* Transactions List with Infinite Query */}
      {user && selectedGuildId && (
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Transactions</h2>
          
          {isTransactionsLoading ? (
            <ChartLoadingSpinner size="md" message="Loading transactions..." />
          ) : (
            <>
              <div className="space-y-2">
                {transactionsData?.pages.map((page, i) => (
                  <React.Fragment key={i}>
                    {page.data.map(transaction => (
                      <div 
                        key={transaction.id} 
                        className={`p-2 rounded ${transaction.type === 'deposit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        <span className="font-medium">${transaction.amount}</span> - 
                        {transaction.type} - 
                        {new Date(transaction.timestamp).toLocaleTimeString()}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isFetchingNextPage ? 'Loading more...' : 'Load More'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ZustandQueryExample;