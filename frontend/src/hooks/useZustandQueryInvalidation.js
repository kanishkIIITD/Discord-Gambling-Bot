import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store';

/**
 * Custom hook that provides methods for invalidating queries with loading state management
 * Integrates React Query's invalidation with Zustand's UI store
 * 
 * @returns {Object} - Methods for invalidating queries with loading state management
 */
export const useZustandQueryInvalidation = () => {
  const queryClient = useQueryClient();
  const startLoading = useUIStore(state => state.startLoading);
  const stopLoading = useUIStore(state => state.stopLoading);
  const setError = useUIStore(state => state.setError);
  const clearError = useUIStore(state => state.clearError);

  /**
   * Invalidates a query and manages loading state
   * 
   * @param {string|Array} queryKey - The query key to invalidate
   * @param {Object} options - Options for invalidation
   * @param {string} loadingKey - The key to use for loading state (defaults to queryKey)
   * @returns {Promise} - A promise that resolves when invalidation is complete
   */
  const invalidateQuery = async (queryKey, options = {}, loadingKey) => {
    const actualLoadingKey = loadingKey || (Array.isArray(queryKey) ? queryKey[0] : queryKey);
    const invalidationKey = `invalidate_${actualLoadingKey}`;
    
    try {
      startLoading(invalidationKey);
      clearError(invalidationKey);
      
      await queryClient.invalidateQueries({
        queryKey,
        ...options
      });
      
      stopLoading(invalidationKey);
    } catch (error) {
      stopLoading(invalidationKey);
      setError(invalidationKey, error);
      throw error;
    }
  };

  /**
   * Invalidates multiple queries and manages loading state
   * 
   * @param {Array} queryKeys - Array of query keys to invalidate
   * @param {Object} options - Options for invalidation
   * @param {string} loadingKey - The key to use for loading state
   * @returns {Promise} - A promise that resolves when all invalidations are complete
   */
  const invalidateQueries = async (queryKeys, options = {}, loadingKey = 'batch_invalidation') => {
    try {
      startLoading(loadingKey);
      clearError(loadingKey);
      
      await Promise.all(
        queryKeys.map(queryKey =>
          queryClient.invalidateQueries({
            queryKey,
            ...options
          })
        )
      );
      
      stopLoading(loadingKey);
    } catch (error) {
      stopLoading(loadingKey);
      setError(loadingKey, error);
      throw error;
    }
  };

  /**
   * Resets a query and manages loading state
   * 
   * @param {string|Array} queryKey - The query key to reset
   * @param {string} loadingKey - The key to use for loading state (defaults to queryKey)
   * @returns {Promise} - A promise that resolves when reset is complete
   */
  const resetQuery = async (queryKey, loadingKey) => {
    const actualLoadingKey = loadingKey || (Array.isArray(queryKey) ? queryKey[0] : queryKey);
    const resetKey = `reset_${actualLoadingKey}`;
    
    try {
      startLoading(resetKey);
      clearError(resetKey);
      
      await queryClient.resetQueries({ queryKey });
      
      stopLoading(resetKey);
    } catch (error) {
      stopLoading(resetKey);
      setError(resetKey, error);
      throw error;
    }
  };

  return {
    invalidateQuery,
    invalidateQueries,
    resetQuery,
    queryClient, // Expose the queryClient for advanced use cases
  };
};