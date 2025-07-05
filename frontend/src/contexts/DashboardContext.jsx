import { createContext, useContext } from 'react';

// Create the context with a default value (optional but good practice)
export const DashboardContext = createContext({
  walletBalance: 0,
  activeBets: [],
  suppressWalletBalance: false,
  setSuppressWalletBalance: () => {},
  prevWalletBalance: 0,
  setPrevWalletBalance: () => {},
  // Loading state management
  loadingKeys: {},
  isLoading: () => false,
  getError: () => null,
  withLoading: async (key, fn) => await fn(),
});

// Custom hook to use the DashboardContext
export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};