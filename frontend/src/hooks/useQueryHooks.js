import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as api from '../services/api';
import { useGuildStore } from '../store/useGuildStore';
import { useUserStore } from '../store/useUserStore';
import axios from '../services/axiosConfig';

// Hook to handle query invalidation when guild switching occurs
export const useGuildSwitchingEffect = () => {
  const queryClient = useQueryClient();
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const user = useUserStore(state => state.user);

  useEffect(() => {
    if (selectedGuildId && !isGuildSwitching) {
      // console.log('[useGuildSwitchingEffect] Guild switched to:', selectedGuildId);
      // console.log('[useGuildSwitchingEffect] Invalidating queries for new guild context');
      
      // Invalidate all queries that depend on guild context
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          return [
            'activeBets', 'userProfile', 'walletBalance', 'transactions',
            'userStats', 'leaderboard', 'upcomingBets', 'betDetails',
            'placedBets', 'placedBetsForBet', 'userPreferences', 'discordCommands',
            'balanceHistory', 'dailyProfitLoss', 'gamblingPerformance',
            'gameDistribution', 'topGamesByProfit', 'favoriteGameTrend',
            'guildMembers', 'allUsers'
          ].includes(queryKey);
        }
      });
      
      // Force a refresh of critical data for the new guild
      if (user?.discordId) {
        // console.log('[useGuildSwitchingEffect] Forcing refresh of user profile and wallet balance for user:', user.discordId);
        queryClient.refetchQueries(['userProfile', user.discordId, selectedGuildId]);
        queryClient.refetchQueries(['walletBalance', user.discordId, selectedGuildId]);
      }
    }
  }, [selectedGuildId, isGuildSwitching, queryClient, user?.discordId]);
};

// User Profile Hooks
export const useUserProfile = (discordId) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const pendingGuildSwitch = useGuildStore(state => state.pendingGuildSwitch);
  const completeGuildSwitch = useGuildStore(state => state.completeGuildSwitch);
  const updateUserProfile = useUserStore(state => state.updateUserProfile);
  const user = useUserStore(state => state.user);
  
  const query = useQuery({
    queryKey: ['userProfile', discordId, selectedGuildId],
    queryFn: () => api.getUserProfile(discordId),
    enabled: !!discordId && !!selectedGuildId, // Always enabled when we have the required data
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: false, // Disable automatic refetching
  });

  // Update user store when profile data changes (for role updates when switching guilds)
  useEffect(() => {
    if (query.data?.user) {
      // console.log('[useUserProfile] Updating user store with new profile data:', query.data.user);
      // console.log('[useUserProfile] Current guild ID:', selectedGuildId);
      // console.log('[useUserProfile] User role in new guild:', query.data.user.role);
      // console.log('[useUserProfile] Previous user role in store:', user?.role);
      // console.log('[useUserProfile] Is guild switching:', isGuildSwitching);
      updateUserProfile(query.data.user);
      // console.log('[useUserProfile] User store updated successfully');
    }
  }, [query.data?.user, updateUserProfile, selectedGuildId, user?.role, isGuildSwitching]);

  // Complete guild switching when user profile is updated during a guild switch
  useEffect(() => {
    if (query.data?.user && isGuildSwitching && pendingGuildSwitch === selectedGuildId) {
      // console.log('[useUserProfile] Profile updated during guild switch, completing switch');
      // console.log('[useUserProfile] New role:', query.data.user.role);
      // console.log('[useUserProfile] Pending guild switch:', pendingGuildSwitch);
      // console.log('[useUserProfile] Selected guild ID:', selectedGuildId);
      
      // Add a minimum delay to ensure the overlay has time to show
      // This prevents the guild switch from completing too quickly
      setTimeout(() => {
        // console.log('[useUserProfile] Completing guild switch after delay');
        completeGuildSwitch();
      }, 1000); // 1 second minimum delay
    }
  }, [query.data?.user, isGuildSwitching, pendingGuildSwitch, selectedGuildId, completeGuildSwitch]);

  return query;
};

// Wallet Balance Hook
export const useWalletBalance = (discordId) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['walletBalance', discordId, selectedGuildId],
    queryFn: () => api.getWalletBalance(discordId, selectedGuildId),
    enabled: !!discordId && !!selectedGuildId,
    // More frequent refetching for balance
    staleTime: 1000 * 30, // 30 seconds
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : 1000 * 60, // Refresh every minute when not switching
    // Force refetch when guild changes
    refetchOnReconnect: true,
  });
};

// Jackpot Pool Hook
export const useJackpotPool = (discordId) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['jackpotPool', discordId, selectedGuildId],
    queryFn: () => api.getJackpotPool(discordId),
    enabled: !!discordId && !!selectedGuildId,
    // More frequent refetching for jackpot pool
    staleTime: 1000 * 30, // 30 seconds
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : 1000 * 60, // Refresh every minute when not switching
  });
};

// Transaction History Hook
export const useTransactionHistory = (discordId, page = 1, limit = 20) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['transactions', discordId, page, limit, selectedGuildId],
    queryFn: () => api.getTransactionHistory(discordId, page, limit),
    enabled: !!discordId && !!selectedGuildId,
    keepPreviousData: true, // Useful for pagination
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};
// User Stats Hook
export const useUserStats = (discordId) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['userStats', discordId, selectedGuildId],
    queryFn: () => api.getUserStats(discordId),
    enabled: !!discordId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Active Bets Hook
export const useActiveBets = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['activeBets', selectedGuildId],
    queryFn: () => api.getActiveBets(selectedGuildId),
    enabled: !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : 1000 * 60, // Refetch every minute when not switching
  });
};

// Upcoming Bets Hook
export const useUpcomingBets = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['upcomingBets', selectedGuildId],
    queryFn: api.getUpcomingBets,
    enabled: !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Bet Details Hook
export const useBetDetails = (betId) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['betDetails', betId, selectedGuildId],
    queryFn: () => api.getBetDetails(betId),
    enabled: !!betId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Place Bet Hook
export const usePlaceBet = () => {
  const queryClient = useQueryClient();
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  return useMutation({
    mutationFn: ({ betId, amount, option, discordId }) => 
      api.placeBet(betId, amount, option, discordId),
    onSuccess: () => {
      // Don't invalidate queries while guild is switching to avoid unnecessary API calls
      if (!isGuildSwitching) {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['walletBalance']);
        queryClient.invalidateQueries(['activeBets']);
      }
      if (!isGuildSwitching) {
        queryClient.invalidateQueries(['betDetails']);
        queryClient.invalidateQueries(['myPlacedBets']);
      }
    },
  });
};

// Placed Bets for a Bet Hook
export const usePlacedBetsForBet = (betId, page = 1, limit = 20) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['placedBetsForBet', betId, page, limit, selectedGuildId],
    queryFn: () => api.getPlacedBetsForBet(betId, page, limit),
    enabled: !!betId && !!selectedGuildId,
    keepPreviousData: true,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Leaderboard Hook
export const useLeaderboard = (discordId, limit = 10) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['leaderboard', discordId, limit, selectedGuildId],
    queryFn: () => api.getLeaderboard(discordId, limit),
    enabled: !!discordId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Discord Commands Hook
export const useDiscordCommands = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['discordCommands', selectedGuildId],
    queryFn: api.getDiscordCommands,
    enabled: !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
    staleTime: Infinity, // Commands rarely change
  });
};

// User Preferences Hook
export const useUserPreferences = (discordId) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['userPreferences', discordId, selectedGuildId],
    queryFn: () => api.getUserPreferences(discordId),
    enabled: !!discordId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Update User Preferences Mutation
export const useUpdateUserPreferences = () => {
  const queryClient = useQueryClient();
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  return useMutation({
    mutationFn: ({ discordId, preferences }) => 
      api.updateUserPreferences(discordId, preferences),
    onSuccess: (_, variables) => {
      // Don't invalidate queries while guild is switching to avoid unnecessary API calls
      if (!isGuildSwitching) {
        queryClient.invalidateQueries(['userPreferences', variables.discordId, selectedGuildId]);
      }
    },
  });
};

// Daily Profit & Loss Hook
export const useDailyProfitLoss = (discordId, startDate, endDate) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['dailyProfitLoss', discordId, startDate, endDate, selectedGuildId],
    queryFn: () => api.getDailyProfitLoss(discordId, startDate, endDate),
    enabled: !!discordId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Balance History Hook
export const useBalanceHistory = (discordId, limit = 500, startDate, endDate) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['balanceHistory', discordId, limit, startDate, endDate, selectedGuildId],
    queryFn: () => api.getBalanceHistory(discordId, limit, startDate, endDate),
    enabled: !!discordId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Gambling Performance Hook
export const useGamblingPerformance = (discordId, startDate, endDate) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['gamblingPerformance', discordId, startDate, endDate, selectedGuildId],
    queryFn: () => api.getGamblingPerformance(discordId, startDate, endDate),
    enabled: !!discordId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Game Distribution Hook
export const useGameDistribution = (discordId, startDate, endDate) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['gameDistribution', discordId, startDate, endDate, selectedGuildId],
    queryFn: () => api.getGameDistribution(discordId, startDate, endDate),
    enabled: !!discordId && !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// My Placed Bets Hook
export const useMyPlacedBets = (discordId, page = 1, limit = 20, resultFilter = 'all', statusFilter = 'all', sortBy = 'placedAt', sortOrder = 'desc') => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['myPlacedBets', discordId, page, limit, resultFilter, statusFilter, sortBy, sortOrder, selectedGuildId],
    queryFn: async () => {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/${discordId}/bets`,
        {
          params: {
            page,
            limit,
            guildId: selectedGuildId,
            result: resultFilter,
            status: statusFilter,
            sortBy,
            sortOrder,
          },
          headers: { 'x-guild-id': selectedGuildId }
        }
      );
      return response.data;
    },
    enabled: !!discordId && !!selectedGuildId,
    keepPreviousData: true,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// export const useAllBets = () => {
export const useAllBets = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['allBets', selectedGuildId],
    queryFn: async () => {
      const [openBets, closedBets] = await Promise.all([
        api.getActiveBets(selectedGuildId),
        api.getClosedBets(selectedGuildId)
      ]);
      return [...openBets, ...closedBets];
    },
    enabled: !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Guild Settings Hook
export const useGuildSettings = () => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['guildSettings', selectedGuildId],
    queryFn: () => api.getGuildSettings(),
    enabled: !!selectedGuildId,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Win Streak Leaderboard Hook
export const useWinStreakLeaderboard = (page = 1, limit = 20, sortBy = 'max', sortOrder = 'desc') => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['winStreakLeaderboard', page, limit, sortBy, sortOrder, selectedGuildId],
    queryFn: async () => {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/leaderboard/winstreaks`,
        {
          params: { page, limit, sortBy, sortOrder, guildId: selectedGuildId },
          headers: { 'x-guild-id': selectedGuildId }
        }
      );
      return response.data;
    },
    enabled: !!selectedGuildId,
    keepPreviousData: true,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Top Players Leaderboard Hook
export const useTopPlayersLeaderboard = (page = 1, limit = 20, sortBy = 'balance', sortOrder = 'desc') => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const user = useUserStore(state => state.user);
  return useQuery({
    queryKey: ['topPlayersLeaderboard', page, limit, sortBy, sortOrder, selectedGuildId],
    queryFn: async () => {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/leaderboard`,
        {
          params: { page, limit, sortBy, sortOrder, guildId: selectedGuildId },
          headers: { 'x-guild-id': selectedGuildId }
        }
      );
      return response.data;
    },
    enabled: !!selectedGuildId && !!user?.discordId,
    keepPreviousData: true,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Guild Members Hook
export const useGuildMembers = (page = 1, limit = 20, sortBy = 'username', sortOrder = 'asc') => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['guildMembers', page, limit, sortBy, sortOrder, selectedGuildId],
    queryFn: () => api.getGuildMembers(page, limit, sortBy, sortOrder),
    enabled: !!selectedGuildId,
    keepPreviousData: true, // Useful for pagination
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Biggest Wins Leaderboard Hook
export const useBiggestWinsLeaderboard = (page = 1, limit = 20, sortBy = 'amount', sortOrder = 'desc') => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['biggestWinsLeaderboard', page, limit, sortBy, sortOrder, selectedGuildId],
    queryFn: async () => {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/leaderboard/biggest-wins`,
        {
          params: { page, limit: Math.min(limit, 500), sortBy, sortOrder, guildId: selectedGuildId },
          headers: { 'x-guild-id': selectedGuildId }
        }
      );
      return response.data;
    },
    enabled: !!selectedGuildId,
    keepPreviousData: true,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// User Search Hook
export const useUserSearch = (query, options = {}) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['userSearch', query, selectedGuildId],
    queryFn: async () => {
      if (!query || query.length < 2) return { data: [] };
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users/search-users`,
        {
          params: { q: encodeURIComponent(query), guildId: selectedGuildId },
          headers: { 'x-guild-id': selectedGuildId }
        }
      );
      return response.data;
    },
    enabled: !!selectedGuildId && !!query && query.length >= 2,
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
    ...options,
  });
};

// Gift Points Mutation
export const useGiftPoints = () => {
  const queryClient = useQueryClient();
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  return useMutation({
    mutationFn: async ({ senderDiscordId, recipientDiscordId, amount }) => {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users/${senderDiscordId}/gift`,
        {
          recipientDiscordId,
          amount,
          guildId: selectedGuildId
        },
        {
          headers: { 'x-guild-id': selectedGuildId }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      // Don't invalidate queries while guild is switching to avoid unnecessary API calls
      if (!isGuildSwitching) {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['walletBalance']);
        queryClient.invalidateQueries(['transactionHistory']);
      }
    }
  });
};

// Update User Role Mutation
export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  return useMutation({
    mutationFn: async ({ userId, newRole }) => {
      const response = await axios.patch(
        `${process.env.REACT_APP_API_URL}/api/admin/users/${userId}/role`,
        { 
          role: newRole, 
          guildId: selectedGuildId 
        },
        {
          headers: { 'x-guild-id': selectedGuildId }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      // Don't invalidate queries while guild is switching to avoid unnecessary API calls
      if (!isGuildSwitching) {
        // Invalidate guild members query to reflect role changes
        queryClient.invalidateQueries(['guildMembers']);
      }
      // If needed, you could invalidate a users list query
    }
  });
};

// Giveaway Points Mutation
export const useGiveawayPoints = () => {
  const queryClient = useQueryClient();
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  return useMutation({
    mutationFn: async ({ discordId, amount }) => {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users/${discordId}/giveaway`,
        { amount: Number(amount) },
        {
          headers: {
            'x-guild-id': selectedGuildId,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      // Don't invalidate queries while guild is switching to avoid unnecessary API calls
      if (!isGuildSwitching) {
        // Invalidate wallet balance and transaction history
        queryClient.invalidateQueries(['walletBalance']);
        queryClient.invalidateQueries(['transactionHistory']);
      }
    }
  });
};

// Fetch All Users Hook
export const useAllUsers = (limit = 10000) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  return useQuery({
    queryKey: ['allUsers', selectedGuildId],
    queryFn: async () => {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users`,
        { 
          params: { page: 1, limit, guildId: selectedGuildId }, 
          headers: { 'x-guild-id': selectedGuildId } 
        }
      );
      return response.data;
    },
    enabled: !!selectedGuildId,
    staleTime: 60000, // 1 minute
    // Refetch when guild switching is complete
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Don't refetch while guild is switching to avoid unnecessary API calls
    refetchInterval: isGuildSwitching ? false : undefined,
  });
};

// Daily Bonus Status Hook
export const useDailyBonusStatus = (discordId) => {
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  return useQuery({
    queryKey: ['dailyBonusStatus', discordId, selectedGuildId],
    queryFn: () => api.getDailyBonusStatus(discordId, selectedGuildId),
    enabled: !!discordId && !!selectedGuildId,
    staleTime: 1000 * 60, // 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: isGuildSwitching ? false : 1000 * 60, // Refresh every minute when not switching
  });
};

// Daily Bonus Claim Hook
export const useClaimDailyBonus = () => {
  const queryClient = useQueryClient();
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  
  return useMutation({
    mutationFn: ({ discordId }) => api.claimDailyBonus(discordId, selectedGuildId),
    onSuccess: () => {
      // Invalidate relevant queries to trigger refetches
      queryClient.invalidateQueries(['walletBalance']);
      queryClient.invalidateQueries(['dailyBonusStatus']);
    },
  });
};