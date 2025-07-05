import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from '../services/axiosConfig';
import { useAuth } from './AuthContext';
import { getUserGuilds, getWalletBalance, getUserProfile } from '../services/api';
import { persistQueryCache } from '../utils/cacheHydration';
import { checkHeartbeat } from '../services/heartbeat';
import queryClient, { queryConfigs } from '../services/queryClient';

// Create the Guild context
const GuildContext = createContext();

// Custom hook to use the Guild context
export const useGuild = () => {
  const context = useContext(GuildContext);
  if (!context) {
    throw new Error('useGuild must be used within a GuildProvider');
  }
  return context;
};

// Guild Provider component
export const GuildProvider = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Get stored guild ID immediately for optimistic rendering
  const storedGuildId = localStorage.getItem('selectedGuildId');
  
  // State for guild management
  const [userGuilds, setUserGuilds] = useState(() => {
    // Try to get guilds from React Query cache first
    const cachedGuilds = queryClient.getQueryData(['userGuilds']);
    // console.log('[GuildProvider] Initializing with cached guilds:', cachedGuilds);
    return cachedGuilds || [];
  });
  
  // Log the stored guild ID for debugging
  // console.log('[GuildProvider] Stored guild ID from localStorage:', storedGuildId);
  
  // Keep userGuilds state in sync with React Query cache
  useEffect(() => {
    // Subscribe to changes in the userGuilds query cache
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.query.queryKey[0] === 'userGuilds') {
        const updatedGuilds = queryClient.getQueryData(['userGuilds']);
        // console.log('[GuildProvider] Detected userGuilds cache update:', updatedGuilds);
        if (updatedGuilds) {
          setUserGuilds(updatedGuilds);
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  // Initialize selectedGuildId with the stored value, ensuring it's properly logged
  const [selectedGuildId, setSelectedGuildId] = useState(() => {
    // console.log('[GuildProvider] Initializing selectedGuildId with:', storedGuildId);
    return storedGuildId;
  });
  const [isGuildSwitching, setIsGuildSwitching] = useState(false);
  const [isLoadingGuilds, setIsLoadingGuilds] = useState(false);
  const [guildError, setGuildError] = useState(null);
  
  // Ref to track if we've already fetched guilds
  const hasLoadedGuildsRef = useRef(false);
  
  // Set axios header immediately if we have a stored guild ID
  useEffect(() => {
    if (storedGuildId) {
      axios.defaults.headers.common['x-guild-id'] = storedGuildId;
    }
  }, []);

  // Add after state declarations and before useEffect for fetchUserGuilds
  useEffect(() => {
    if (userGuilds.length > 0) {
      // If selectedGuildId is not set or not in the list, set to first guild
      if (!selectedGuildId || !userGuilds.some(g => g.id === selectedGuildId)) {
        // Check if there's a stored guild ID first
        const storedGuildId = localStorage.getItem('selectedGuildId');
        
        // Use stored guild ID if it exists and is valid, otherwise use first guild
        if (storedGuildId && userGuilds.some(g => g.id === storedGuildId)) {
          setSelectedGuildId(storedGuildId);
          axios.defaults.headers.common['x-guild-id'] = storedGuildId;
        } else {
          const firstGuildId = userGuilds[0].id;
          setSelectedGuildId(firstGuildId);
          localStorage.setItem('selectedGuildId', firstGuildId);
          axios.defaults.headers.common['x-guild-id'] = firstGuildId;
        }
      }
    }
  }, [userGuilds]);

  // Function to fetch user guilds - extracted from useEffect for reusability
  const fetchUserGuilds = async () => {
      // console.log('GuildContext: fetchUserGuilds called');
      // console.log('Auth state:', { isAuthenticated, authLoading });
      // console.log('User:', user);
    
    if (!isAuthenticated || !user || authLoading) {
      // console.log('Not authenticated or still loading auth, skipping guild fetch');
      setIsLoadingGuilds(false);
      return null;
    }
    
    // Check if we already have guilds in the cache first
    const cachedGuilds = queryClient.getQueryData(['userGuilds']);
    if (cachedGuilds && cachedGuilds.length > 0) {
      // console.log('Using guilds from React Query cache:', cachedGuilds);
      setUserGuilds(cachedGuilds);
      hasLoadedGuildsRef.current = true;
      setIsLoadingGuilds(false);
      return cachedGuilds;
    }
    
    // Prevent refetching if we've already loaded guilds
    if (hasLoadedGuildsRef.current && userGuilds.length > 0) {
      setIsLoadingGuilds(false);
      return userGuilds;
    }
    
    setIsLoadingGuilds(true);
    setGuildError(null);
    
    try {
      // First try to get guilds from heartbeat for faster response
      try {
        // First check if we have cached guilds that we can use immediately
        const cachedGuilds = queryClient.getQueryData(['userGuilds']);
        if (cachedGuilds && cachedGuilds.length > 0) {
          // console.log('Using cached guilds:', cachedGuilds);
          setUserGuilds(cachedGuilds);
          
          // We'll still try to refresh in the background
          setTimeout(() => {
            // console.log('Background refreshing guilds data...');
            checkHeartbeat().catch(e => {
              // console.log('Background refresh failed:', e.message)
            });
          }, 2000);
          
          setIsLoadingGuilds(false);
          hasLoadedGuildsRef.current = true;
          return cachedGuilds;
        }
        
        // console.log('Attempting to fetch guilds via heartbeat');
        const heartbeatData = await checkHeartbeat();
        if (heartbeatData?.guilds?.length > 0) {
          // console.log('Using guilds from heartbeat:', heartbeatData.guilds);
          // Update state directly
          setUserGuilds(heartbeatData.guilds);
          // Also ensure the React Query cache is updated
          queryClient.setQueryData(['userGuilds'], heartbeatData.guilds);
          // Persist the cache
          persistQueryCache(queryClient);
          
          setIsLoadingGuilds(false);
          hasLoadedGuildsRef.current = true;
          return heartbeatData.guilds;
        } else {
          // console.log('Heartbeat returned no guilds, will try full guild fetch');
        }
      } catch (heartbeatError) {
        // console.log('Heartbeat check failed, falling back to full guild fetch', heartbeatError);
      }
      
      // If we reach here, heartbeat failed or returned no guilds
      try {
        // console.log('Fetching guilds for user:', user.discordId);
        
        // Use React Query to fetch and cache guilds with longer staleTime
        const guilds = await queryClient.fetchQuery({
          queryKey: ['userGuilds'],
          queryFn: () => getUserGuilds(user.discordId),
          staleTime: queryConfigs.guilds.staleTime,
          cacheTime: queryConfigs.guilds.cacheTime,
          retry: 2,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
        });
        
        // console.log('Fetched guilds:', guilds);
        // console.log('Guilds length:', guilds ? guilds.length : 0);
        setUserGuilds(guilds);
        
        // Mark that we've loaded guilds
        hasLoadedGuildsRef.current = true;
        
        // Persist the guild data to localStorage via our cache utility
        persistQueryCache(queryClient);
        
        // If no guilds are available, set error and clear any stored guild ID
        if (!guilds || guilds.length === 0) {
          setGuildError('No Discord servers found. Please join a server with the bot or invite the bot to your server.');
          localStorage.removeItem('selectedGuildId');
          setSelectedGuildId(null);
          delete axios.defaults.headers.common['x-guild-id'];
          setIsLoadingGuilds(false);
          return null;
        }
        
        // Get the stored guild ID (we already have this from initialization)
        const currentStoredGuildId = localStorage.getItem('selectedGuildId');
        
        // Determine which guild ID to use
        let guildIdToUse = null;
        
        // If stored guild ID exists and is valid, use it
        if (currentStoredGuildId && guilds.some(guild => guild.id === currentStoredGuildId)) {
          guildIdToUse = currentStoredGuildId;
          // console.log('Using stored guild ID:', guildIdToUse);
        } 
        // Otherwise use the first available guild
        else if (guilds.length > 0) {
          guildIdToUse = guilds[0].id;
          // console.log('Using first available guild ID:', guildIdToUse);
          // Store this as the new selected guild ID
          localStorage.setItem('selectedGuildId', guildIdToUse);
        }
        // If no guilds are found, use a fallback guild ID
        else {
          // Use the DEFAULT_GUILD_ID from backend .env
          guildIdToUse = '1374554796932988959'; // Default guild ID from .env
          // console.log('Using fallback guild ID:', guildIdToUse);
          
          // Create a fallback guild object for the UI
          setUserGuilds([{
            id: guildIdToUse,
            name: 'Default Server',
            icon: null // No icon available
          }]);
        }
        
        // Update selected guild ID and store it
        if (guildIdToUse) {
          setSelectedGuildId(guildIdToUse);
          localStorage.setItem('selectedGuildId', guildIdToUse);
          
          // Update axios headers immediately
          axios.defaults.headers.common['x-guild-id'] = guildIdToUse;
        }
      } catch (error) {
        console.error('Error fetching user guilds:', error);
        setGuildError('Failed to load your Discord servers. Please try again later.');
        
        // If we have a stored guild ID but failed to fetch guilds,
        // we'll keep using the stored guild ID optimistically
        if (storedGuildId) {
          // console.log('Using stored guild ID despite fetch error:', storedGuildId);
        }
      } finally {
        setIsLoadingGuilds(false);
      }
    } catch (error) {
      // Catch any unexpected errors in the whole fetchUserGuilds flow
      console.error('Unexpected error in fetchUserGuilds:', error);
      setGuildError('Unexpected error occurred while loading your Discord servers.');
      setIsLoadingGuilds(false);
    }
  };

  // Background refresh interval for guild data
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Set up background refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      // console.log('[GuildProvider] Background guild refresh...');
      // Only refresh if we're not currently loading
      if (!isLoadingGuilds) {
        fetchUserGuilds();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, user, isLoadingGuilds]);

  // Load user guilds when authenticated
  useEffect(() => {
    // Only fetch guilds if we haven't loaded them yet and user is authenticated
    if (isAuthenticated && user && !authLoading && !hasLoadedGuildsRef.current) {
      // console.log('[GuildProvider] User authenticated, fetching guilds...');
      fetchUserGuilds();
    } else if (isAuthenticated && user && !authLoading && hasLoadedGuildsRef.current) {
      // console.log('[GuildProvider] Guilds already loaded, skipping fetch');
      setIsLoadingGuilds(false);
    } else if (!isAuthenticated && !authLoading) {
      // console.log('[GuildProvider] User not authenticated, clearing guilds');
      setUserGuilds([]);
      setSelectedGuildId(null);
      setIsLoadingGuilds(false);
      hasLoadedGuildsRef.current = false;
    }
  }, [isAuthenticated, user, authLoading]); // Remove fetchUserGuilds from dependencies to prevent infinite loops

  // Update axios headers when guild changes
  useEffect(() => {
    if (selectedGuildId) {
      axios.defaults.headers.common['x-guild-id'] = selectedGuildId;
      localStorage.setItem('selectedGuildId', selectedGuildId);
    }
  }, [selectedGuildId]);

  // Reset guild state when user logs out
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      setUserGuilds([]);
      setSelectedGuildId(null);
      setGuildError(null);
      hasLoadedGuildsRef.current = false;
      delete axios.defaults.headers.common['x-guild-id'];
    }
  }, [isAuthenticated, authLoading]);

  // Function to switch guilds
  const switchGuild = async (guildId) => {
    if (guildId === selectedGuildId) return; // No change needed
    
    // console.log(`Switching guild from ${selectedGuildId} to ${guildId}`);
    setIsGuildSwitching(true);
    
    try {
      // Update the selected guild
      setSelectedGuildId(guildId);
      localStorage.setItem('selectedGuildId', guildId);
      
      // Update axios headers
      axios.defaults.headers.common['x-guild-id'] = guildId;
      
      // Prefetch critical data for the new guild
      if (user?.discordId) {
        // Prefetch wallet balance and user profile in the background
        queryClient.prefetchQuery({
          queryKey: ['walletBalance', user.discordId, guildId],
          queryFn: () => getWalletBalance(user.discordId),
          staleTime: queryConfigs.wallet.staleTime
        });
        
        queryClient.prefetchQuery({
          queryKey: ['userProfile', user.discordId, guildId],
          queryFn: () => getUserProfile(user.discordId),
          staleTime: queryConfigs.auth.staleTime
        });
      }
      
      // Invalidate all queries to force refetch with new guild ID
      // console.log('Invalidating queries after guild switch to:', guildId);
      
      // Batch invalidations to reduce render cycles
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return [
            'activeBets', 'userProfile', 'walletBalance', 'transactions',
            'userStats', 'leaderboard', 'upcomingBets', 'betDetails',
            'placedBets', 'placedBetsForBet', 'userPreferences', 'discordCommands',
            'balanceHistory', 'dailyProfitLoss', 'gamblingPerformance',
            'gameDistribution', 'topGamesByProfit', 'favoriteGameTrend'
          ].includes(queryKey);
        }
      });
      
      // Force a refresh of the wallet balance
      if (user?.discordId) {
        queryClient.refetchQueries(['walletBalance', user.discordId, guildId]);
      }
      
      // Clear the chart cache to force fresh data fetching
      import('../hooks/useChartDataCache').then(module => {
        if (module.globalChartCache) {
          // console.log('Clearing chart cache after guild switch');
          module.globalChartCache.clear();
        }
      });
      
      // Persist the updated guild selection
      persistQueryCache(queryClient);
      
      // Set guild switching to false after data operations are complete
      setIsGuildSwitching(false);
    } catch (error) {
      console.error('Error switching guilds:', error);
      setIsGuildSwitching(false);
    }
  };

  // The context value
  const value = {
    userGuilds,
    selectedGuildId,
    switchGuild,
    fetchUserGuilds, // Expose the fetch function for manual refreshes
    isGuildSwitching,
    isLoadingGuilds,
    guildError,
    hasGuilds: userGuilds.length > 0,
    selectedGuild: userGuilds.find(guild => guild.id === selectedGuildId) || null
  };

  return <GuildContext.Provider value={value}>{children}</GuildContext.Provider>;
};