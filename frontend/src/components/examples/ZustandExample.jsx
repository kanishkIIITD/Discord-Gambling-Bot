import React, { useEffect } from 'react';
import { useUserStore, useWalletStore, useGuildStore, useUIStore } from '../../store';
import { useLoading } from '../../hooks/useLoading';

/**
 * Example component demonstrating how to use Zustand stores
 */
const ZustandExample = () => {
  // User store
  const user = useUserStore(state => state.user);
  const logout = useUserStore(state => state.logout);
  
  // Wallet store
  const balance = useWalletStore(state => state.balance);
  const fetchBalance = useWalletStore(state => state.fetchBalance);
  const walletLoading = useWalletStore(state => state.loading.balance);
  
  // Guild store
  const guilds = useGuildStore(state => state.guilds);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const selectGuild = useGuildStore(state => state.selectGuild);
  const fetchGuilds = useGuildStore(state => state.fetchGuilds);
  
  // UI store
  const theme = useUIStore(state => state.theme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  
  // Loading hook (compatible with previous LoadingContext API)
  const { isLoading, withLoading } = useLoading();
  
  // Fetch guilds when component mounts
  useEffect(() => {
    if (user) {
      fetchGuilds(user.discordId);
    }
  }, [user, fetchGuilds]);
  
  // Fetch wallet balance when user or selected guild changes
  useEffect(() => {
    if (user && selectedGuildId) {
      fetchBalance(user.discordId, selectedGuildId);
    }
  }, [user, selectedGuildId, fetchBalance]);
  
  // Example of using withLoading for async operations
  const handleRefreshData = async () => {
    await withLoading('refreshData', async () => {
      if (user && selectedGuildId) {
        await fetchBalance(user.discordId, selectedGuildId);
        await fetchGuilds(user.discordId);
      }
    });
  };
  
  if (!user) {
    return (
      <div className="p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Zustand Example</h2>
        <p>Please log in to see this example.</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-card rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Zustand Example</h2>
      
      {/* User section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">User</h3>
        <p>Username: {user.username}</p>
        <button 
          onClick={logout}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
      
      {/* Wallet section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Wallet</h3>
        {walletLoading ? (
          <p>Loading balance...</p>
        ) : (
          <p>Balance: {balance}</p>
        )}
      </div>
      
      {/* Guild section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Guilds</h3>
        <div className="flex flex-wrap gap-2">
          {guilds.map(guild => (
            <button
              key={guild.id}
              onClick={() => selectGuild(guild.id)}
              className={`px-3 py-1 rounded ${selectedGuildId === guild.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              {guild.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Theme section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Theme</h3>
        <p>Current theme: {theme}</p>
        <button 
          onClick={toggleTheme}
          className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Toggle Theme
        </button>
      </div>
      
      {/* Loading example */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Loading Example</h3>
        <button 
          onClick={handleRefreshData}
          disabled={isLoading('refreshData')}
          className={`px-4 py-2 rounded ${isLoading('refreshData') ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
        >
          {isLoading('refreshData') ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
};

export default ZustandExample;