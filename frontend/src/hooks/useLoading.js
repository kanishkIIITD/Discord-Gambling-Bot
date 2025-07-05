import { useUIStore } from '../store';

/**
 * Custom hook for using loading state management from the UI store
 * This provides a similar API to the previous useLoading hook that used LoadingContext
 * to make migration easier
 */
export const useLoading = () => {
  // Use individual selectors to prevent infinite re-renders
  const loadingStates = useUIStore(state => state.loadingStates);
  const errors = useUIStore(state => state.errors);
  const startLoading = useUIStore(state => state.startLoading);
  const stopLoading = useUIStore(state => state.stopLoading);
  const setError = useUIStore(state => state.setError);
  const clearError = useUIStore(state => state.clearError);
  const resetLoadingStates = useUIStore(state => state.resetLoadingStates);
  const isLoading = useUIStore(state => state.isLoading);
  const isAnyLoading = useUIStore(state => state.isAnyLoading);
  const getError = useUIStore(state => state.getError);
  const withLoading = useUIStore(state => state.withLoading);

  return {
    loadingStates,
    errors,
    startLoading,
    stopLoading,
    setError,
    clearError,
    resetState: resetLoadingStates,
    isLoading,
    isAnyLoading,
    getError,
    withLoading
  };
};