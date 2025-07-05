import { QueryClient } from '@tanstack/react-query';

// Create a client with optimized cache settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // default: true
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 60, // 60 minutes (increased from 30)
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Define specific query configurations for critical data
const queryConfigs = {
  // Auth and guild data should stay fresh longer
  auth: {
    staleTime: 1000 * 60 * 15, // 15 minutes
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
  },
  guilds: {
    staleTime: 1000 * 60 * 15, // 15 minutes
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
  },
  // Wallet balance needs more frequent updates
  wallet: {
    staleTime: 1000 * 30, // 30 seconds
    cacheTime: 1000 * 60 * 30, // 30 minutes
  },
  // Active bets need frequent updates
  activeBets: {
    staleTime: 1000 * 30, // 30 seconds
    cacheTime: 1000 * 60 * 10, // 10 minutes
  }
};

export { queryConfigs };
export default queryClient;