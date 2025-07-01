import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';

// User Profile Hooks
export const useUserProfile = (discordId) => {
  return useQuery({
    queryKey: ['userProfile', discordId],
    queryFn: () => api.getUserProfile(discordId),
    enabled: !!discordId,
  });
};

// Wallet Balance Hook
export const useWalletBalance = (discordId) => {
  return useQuery({
    queryKey: ['walletBalance', discordId],
    queryFn: () => api.getWalletBalance(discordId),
    enabled: !!discordId,
    // More frequent refetching for balance
    staleTime: 1000 * 30, // 30 seconds
  });
};

// Transaction History Hook
export const useTransactionHistory = (discordId, page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['transactions', discordId, page, limit],
    queryFn: () => api.getTransactionHistory(discordId, page, limit),
    enabled: !!discordId,
    keepPreviousData: true, // Useful for pagination
  });
};

// User Stats Hook
export const useUserStats = (discordId) => {
  return useQuery({
    queryKey: ['userStats', discordId],
    queryFn: () => api.getUserStats(discordId),
    enabled: !!discordId,
  });
};

// Active Bets Hook
export const useActiveBets = () => {
  return useQuery({
    queryKey: ['activeBets'],
    queryFn: api.getActiveBets,
    refetchInterval: 1000 * 60, // Refetch every minute
  });
};

// Upcoming Bets Hook
export const useUpcomingBets = () => {
  return useQuery({
    queryKey: ['upcomingBets'],
    queryFn: api.getUpcomingBets,
  });
};

// Bet Details Hook
export const useBetDetails = (betId) => {
  return useQuery({
    queryKey: ['betDetails', betId],
    queryFn: () => api.getBetDetails(betId),
    enabled: !!betId,
  });
};

// Place Bet Mutation
export const usePlaceBet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ betId, amount, option, discordId }) => 
      api.placeBet(betId, amount, option, discordId),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries(['walletBalance']);
      queryClient.invalidateQueries(['activeBets']);
      queryClient.invalidateQueries(['betDetails']);
      queryClient.invalidateQueries(['myPlacedBets']);
    },
  });
};

// Placed Bets for a Bet Hook
export const usePlacedBetsForBet = (betId, page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['placedBetsForBet', betId, page, limit],
    queryFn: () => api.getPlacedBetsForBet(betId, page, limit),
    enabled: !!betId,
    keepPreviousData: true,
  });
};

// Leaderboard Hook
export const useLeaderboard = (discordId, limit = 10) => {
  return useQuery({
    queryKey: ['leaderboard', discordId, limit],
    queryFn: () => api.getLeaderboard(discordId, limit),
    enabled: !!discordId,
  });
};

// Discord Commands Hook
export const useDiscordCommands = () => {
  return useQuery({
    queryKey: ['discordCommands'],
    queryFn: api.getDiscordCommands,
    staleTime: Infinity, // Commands rarely change
  });
};

// User Preferences Hook
export const useUserPreferences = (discordId) => {
  return useQuery({
    queryKey: ['userPreferences', discordId],
    queryFn: () => api.getUserPreferences(discordId),
    enabled: !!discordId,
  });
};

// Update User Preferences Mutation
export const useUpdateUserPreferences = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ discordId, preferences }) => 
      api.updateUserPreferences(discordId, preferences),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['userPreferences', variables.discordId]);
    },
  });
};

// Daily Profit & Loss Hook
export const useDailyProfitLoss = (discordId, startDate, endDate) => {
  return useQuery({
    queryKey: ['dailyProfitLoss', discordId, startDate, endDate],
    queryFn: () => api.getDailyProfitLoss(discordId, startDate, endDate),
    enabled: !!discordId,
  });
};

// Balance History Hook
export const useBalanceHistory = (discordId, limit = 500, startDate, endDate) => {
  return useQuery({
    queryKey: ['balanceHistory', discordId, limit, startDate, endDate],
    queryFn: () => api.getBalanceHistory(discordId, limit, startDate, endDate),
    enabled: !!discordId,
  });
};

// Gambling Performance Hook
export const useGamblingPerformance = (discordId, startDate, endDate) => {
  return useQuery({
    queryKey: ['gamblingPerformance', discordId, startDate, endDate],
    queryFn: () => api.getGamblingPerformance(discordId, startDate, endDate),
    enabled: !!discordId,
  });
};

// Game Distribution Hook
export const useGameDistribution = (discordId, startDate, endDate) => {
  return useQuery({
    queryKey: ['gameDistribution', discordId, startDate, endDate],
    queryFn: () => api.getGameDistribution(discordId, startDate, endDate),
    enabled: !!discordId,
  });
};

// My Placed Bets Hook
export const useMyPlacedBets = (discordId, page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['myPlacedBets', discordId, page, limit],
    queryFn: () => api.getMyPlacedBets(discordId, page, limit),
    enabled: !!discordId,
    keepPreviousData: true,
  });
};