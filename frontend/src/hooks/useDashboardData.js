import React, { useEffect, useState, useMemo } from 'react';
import { checkHeartbeat } from '../services/heartbeat';

// Import Zustand stores
import { useUserStore } from '../store/useUserStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';

// Import Zustand-integrated React Query hooks
import { useZustandQuery } from '../hooks/useZustandQuery';
import * as api from '../services/api';

// Define loading keys outside the component to prevent recreation
const LOADING_KEYS = {
  DASHBOARD_DATA: 'dashboard-data',
  WALLET_BALANCE: 'wallet-balance',
  ACTIVE_BETS: 'active-bets',
  HEARTBEAT: 'heartbeat-check'
};

/**
 * Custom hook for optimized dashboard data loading
 * 
 * This hook centralizes the loading of critical dashboard data and provides
 * a unified loading state to prevent UI flicker and multiple loading indicators.
 * 
 * It uses the heartbeat service for quick auth/guild checks and manages
 * the loading of wallet balance and active bets data.
 * 
 * This hook now integrates with Zustand stores for better state management.
 */
const useDashboardData = () => {
  // Use Zustand stores with individual selectors to prevent infinite loops
  const user = useUserStore(state => state.user);
  const isAuthenticated = useUserStore(state => !!state.user);
  const authLoading = useUserStore(state => state.loading);
  
  // Use individual selectors instead of object selector to prevent infinite loops
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const isLoadingGuilds = useGuildStore(state => state.loading);
  const guilds = useGuildStore(state => state.guilds);
  
  const hasGuilds = guilds && guilds.length > 0;
  
  // Use individual selectors for UI store to prevent infinite loops
  const withLoading = useUIStore(state => state.withLoading);
  const isLoading = useUIStore(state => state.isLoading);
  const getError = useUIStore(state => state.getError);
  
  // Get wallet balance and active bets data using Zustand-integrated React Query hooks
  const walletBalanceQuery = useZustandQuery(
    ['walletBalance', user?.discordId, selectedGuildId],
    () => api.getWalletBalance(user?.discordId, selectedGuildId),
    {
      enabled: !!user?.discordId && !!selectedGuildId,
      staleTime: 1000 * 30, // 30 seconds
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchInterval: isGuildSwitching ? false : 1000 * 60, // Refresh every minute when not switching
      refetchOnReconnect: true
    },
    LOADING_KEYS.WALLET_BALANCE
  );
  
  const { data: walletBalance, isLoading: walletLoading, refetch: refetchWalletBalance } = walletBalanceQuery;
  
  // Refetch wallet balance when guild changes
  useEffect(() => {
    if (user?.discordId && selectedGuildId && !isGuildSwitching) {
      withLoading(LOADING_KEYS.WALLET_BALANCE, async () => {
        await refetchWalletBalance();
      });
    }
  }, [user?.discordId, selectedGuildId, isGuildSwitching, refetchWalletBalance, withLoading]);
  
  const { data: activeBets = [], isLoading: betsLoading } = useZustandQuery(
    ['activeBets', selectedGuildId],
    () => api.getActiveBets(selectedGuildId),
    {
      enabled: !!selectedGuildId,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchInterval: isGuildSwitching ? false : 1000 * 60 // Refetch every minute when not switching
    },
    LOADING_KEYS.ACTIVE_BETS
  );
  
  // Track if heartbeat check has been attempted
  const [heartbeatChecked, setHeartbeatChecked] = useState(false);
  
  // Perform heartbeat check on mount
  useEffect(() => {
    const performHeartbeatCheck = async () => {
      if (heartbeatChecked) return;
      
      try {
        await withLoading(LOADING_KEYS.HEARTBEAT, async () => {
          await checkHeartbeat();
        });
      } catch (error) {
        // console.log('Dashboard heartbeat check failed:', error);
      } finally {
        setHeartbeatChecked(true);
      }
    };
    
    performHeartbeatCheck();
  }, [heartbeatChecked, withLoading]);
  
  // Simple loading state calculation
  const isDashboardLoading = useMemo(() => {
    // If we don't have a user yet, we're loading
    if (!user) return true;
    
    // If we're loading guilds, we're loading
    if (isLoadingGuilds) return true;
    
    // If we're switching guilds, we're loading
    // BUT we don't want to show loading state during guild switching
    // because the guild switching overlay handles that
    // if (isGuildSwitching) return true;
    
    // If we don't have a selected guild yet, we're loading
    if (!selectedGuildId) return true;
    
    // If we're loading wallet balance and we have a guild, we're loading
    if (walletLoading && selectedGuildId) return true;
    
    // If we're loading bets and we have a guild, we're loading
    if (betsLoading && selectedGuildId) return true;
    
    // If heartbeat hasn't been checked yet, we're loading
    if (!heartbeatChecked) return true;
    
    return false;
  }, [user, isLoadingGuilds, selectedGuildId, walletLoading, betsLoading, heartbeatChecked]);
  
  // Debug logging
  // useEffect(() => {
  //   console.log('[useDashboardData] Debug state:', {
  //     user: !!user,
  //     userDiscordId: user?.discordId,
  //     selectedGuildId,
  //     hasGuilds,
  //     isGuildSwitching,
  //   authLoading,
  //   isLoadingGuilds,
  //   walletLoading,
  //   betsLoading,
  //     heartbeatChecked,
  //     isDashboardLoading
  //   });
  // }, [user, selectedGuildId, hasGuilds, isGuildSwitching, authLoading, isLoadingGuilds, walletLoading, betsLoading, heartbeatChecked, isDashboardLoading]);
  
  return {
    isLoading: isDashboardLoading,
    isInitialLoadComplete: !isDashboardLoading,
    isAuthenticated,
    hasGuilds,
    user,
    selectedGuildId,
    walletBalance,
    activeBets,
    isGuildSwitching,
    walletBalanceQuery, // Expose the full query object for DashboardLayout
    loadingKeys: LOADING_KEYS, // Expose loading keys for components to use
    getLoadingState: isLoading, // Expose the isLoading function from LoadingContext
    getErrorState: getError, // Expose the getError function from LoadingContext
    withLoadingState: withLoading // Expose the withLoading function from LoadingContext
  };
};

export default useDashboardData;