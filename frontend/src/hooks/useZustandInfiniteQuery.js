import { useInfiniteQuery } from '@tanstack/react-query';
import { useUIStore } from '../store';

/**
 * Custom hook that integrates React Query's useInfiniteQuery with Zustand's UI store
 * Provides loading states for infinite queries and automatically manages loading indicators
 * 
 * @param {string|Array} queryKey - The query key for React Query
 * @param {Function} queryFn - The query function that accepts a pageParam
 * @param {Object} options - Additional options for useInfiniteQuery
 * @param {string} loadingKey - The key to use for loading state in UIStore (defaults to queryKey)
 * @returns {Object} - The result of useInfiniteQuery with additional loading state methods
 */
export const useZustandInfiniteQuery = (queryKey, queryFn, options = {}, loadingKey) => {
  const startLoading = useUIStore(state => state.startLoading);
  const stopLoading = useUIStore(state => state.stopLoading);
  const setError = useUIStore(state => state.setError);
  const clearError = useUIStore(state => state.clearError);
  
  const actualLoadingKey = loadingKey || (Array.isArray(queryKey) ? queryKey[0] : queryKey);
  const fetchMoreLoadingKey = `${actualLoadingKey}_fetchMore`;

  // Set initial loading state
  const onStarted = () => {
    startLoading(actualLoadingKey);
    clearError(actualLoadingKey);
  };

  // Handle query success
  const onSuccess = (data) => {
    stopLoading(actualLoadingKey);
    stopLoading(fetchMoreLoadingKey);
    if (options.onSuccess) {
      options.onSuccess(data);
    }
  };

  // Handle query error
  const onError = (error) => {
    stopLoading(actualLoadingKey);
    stopLoading(fetchMoreLoadingKey);
    setError(actualLoadingKey, error);
    if (options.onError) {
      options.onError(error);
    }
  };

  // Set loading state when query starts
  onStarted();

  const result = useInfiniteQuery({
    ...options,
    queryKey,
    queryFn,
    onSuccess,
    onError,
  });

  // Enhanced fetchNextPage that updates loading state
  const fetchNextPage = async (...args) => {
    startLoading(fetchMoreLoadingKey);
    try {
      await result.fetchNextPage(...args);
    } catch (error) {
      setError(fetchMoreLoadingKey, error);
    }
  };

  return {
    ...result,
    fetchNextPage,
    isFetchingNextPage: result.isFetchingNextPage || useUIStore(state => state.loadingStates[fetchMoreLoadingKey]),
  };
};