import { useCallback } from 'react';
import { useQueryClient } from 'react-query';
import { useLoading } from './useLoading';

/**
 * Custom hook for invalidating queries with loading state management
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.loadingKeyPrefix - Prefix for loading keys
 * @returns {Object} - Methods for invalidating queries with loading state
 */
export const useLoadingInvalidation = (options = {}) => {
  const { loadingKeyPrefix = 'invalidate' } = options;
  
  const queryClient = useQueryClient();
  const { startLoading, stopLoading, setError, clearError } = useLoading();
  
  /**
   * Invalidate a query with loading state
   * 
   * @param {string|Array} queryKey - Query key to invalidate
   * @param {Object} options - Options for invalidation
   * @param {string} options.loadingKey - Custom loading key
   * @param {Object} options.refetchOptions - Options for refetch
   * @returns {Promise} - Promise that resolves when invalidation is complete
   */
  const invalidateWithLoading = useCallback(
    async (queryKey, options = {}) => {
      const {
        loadingKey = Array.isArray(queryKey)
          ? `${loadingKeyPrefix}_${queryKey[0]}`
          : `${loadingKeyPrefix}_${queryKey}`,
        refetchOptions = {},
      } = options;
      
      try {
        startLoading(loadingKey);
        clearError(loadingKey);
        
        await queryClient.invalidateQueries(queryKey, refetchOptions);
      } catch (error) {
        setError(loadingKey, error.message || 'Failed to invalidate query');
        throw error;
      } finally {
        stopLoading(loadingKey);
      }
    },
    [queryClient, startLoading, stopLoading, setError, clearError, loadingKeyPrefix]
  );
  
  /**
   * Reset a query with loading state
   * 
   * @param {string|Array} queryKey - Query key to reset
   * @param {Object} options - Options for reset
   * @param {string} options.loadingKey - Custom loading key
   * @returns {Promise} - Promise that resolves when reset is complete
   */
  const resetWithLoading = useCallback(
    async (queryKey, options = {}) => {
      const {
        loadingKey = Array.isArray(queryKey)
          ? `${loadingKeyPrefix}_reset_${queryKey[0]}`
          : `${loadingKeyPrefix}_reset_${queryKey}`,
      } = options;
      
      try {
        startLoading(loadingKey);
        clearError(loadingKey);
        
        await queryClient.resetQueries(queryKey);
      } catch (error) {
        setError(loadingKey, error.message || 'Failed to reset query');
        throw error;
      } finally {
        stopLoading(loadingKey);
      }
    },
    [queryClient, startLoading, stopLoading, setError, clearError, loadingKeyPrefix]
  );
  
  /**
   * Refetch a query with loading state
   * 
   * @param {string|Array} queryKey - Query key to refetch
   * @param {Object} options - Options for refetch
   * @param {string} options.loadingKey - Custom loading key
   * @param {Object} options.refetchOptions - Options for refetch
   * @returns {Promise} - Promise that resolves when refetch is complete
   */
  const refetchWithLoading = useCallback(
    async (queryKey, options = {}) => {
      const {
        loadingKey = Array.isArray(queryKey)
          ? `${loadingKeyPrefix}_refetch_${queryKey[0]}`
          : `${loadingKeyPrefix}_refetch_${queryKey}`,
        refetchOptions = {},
      } = options;
      
      try {
        startLoading(loadingKey);
        clearError(loadingKey);
        
        await queryClient.refetchQueries(queryKey, refetchOptions);
      } catch (error) {
        setError(loadingKey, error.message || 'Failed to refetch query');
        throw error;
      } finally {
        stopLoading(loadingKey);
      }
    },
    [queryClient, startLoading, stopLoading, setError, clearError, loadingKeyPrefix]
  );
  
  /**
   * Batch invalidate multiple queries with a single loading state
   * 
   * @param {Array} queryKeys - Array of query keys to invalidate
   * @param {Object} options - Options for batch invalidation
   * @param {string} options.loadingKey - Custom loading key
   * @param {Object} options.refetchOptions - Options for refetch
   * @returns {Promise} - Promise that resolves when all invalidations are complete
   */
  const batchInvalidateWithLoading = useCallback(
    async (queryKeys, options = {}) => {
      const {
        loadingKey = `${loadingKeyPrefix}_batch`,
        refetchOptions = {},
      } = options;
      
      try {
        startLoading(loadingKey);
        clearError(loadingKey);
        
        await Promise.all(
          queryKeys.map((queryKey) =>
            queryClient.invalidateQueries(queryKey, refetchOptions)
          )
        );
      } catch (error) {
        setError(loadingKey, error.message || 'Failed to batch invalidate queries');
        throw error;
      } finally {
        stopLoading(loadingKey);
      }
    },
    [queryClient, startLoading, stopLoading, setError, clearError, loadingKeyPrefix]
  );
  
  /**
   * Clear the query cache with loading state
   * 
   * @param {Object} options - Options for clearing cache
   * @param {string} options.loadingKey - Custom loading key
   * @returns {Promise} - Promise that resolves when cache is cleared
   */
  const clearCacheWithLoading = useCallback(
    async (options = {}) => {
      const { loadingKey = `${loadingKeyPrefix}_clearCache` } = options;
      
      try {
        startLoading(loadingKey);
        clearError(loadingKey);
        
        await queryClient.clear();
      } catch (error) {
        setError(loadingKey, error.message || 'Failed to clear query cache');
        throw error;
      } finally {
        stopLoading(loadingKey);
      }
    },
    [queryClient, startLoading, stopLoading, setError, clearError, loadingKeyPrefix]
  );
  
  return {
    invalidateWithLoading,
    resetWithLoading,
    refetchWithLoading,
    batchInvalidateWithLoading,
    clearCacheWithLoading,
  };
};

/**
 * Custom hook for managing loading states during query cache operations
 * Provides methods for invalidating, refetching, and resetting queries with loading states
 * 
 * @returns {Object} - Methods for query cache operations with loading state
 */
export const useQueryCacheWithLoading = () => {
  const queryClient = useQueryClient();
  const { startLoading, stopLoading, setError, clearError } = useLoading();
  
  /**
   * Set query data with loading state
   * 
   * @param {string|Array} queryKey - Query key to set data for
   * @param {*} newData - New data to set
   * @param {Object} options - Options for setting data
   * @param {string} options.loadingKey - Custom loading key
   * @param {Object} options.queryOptions - Options for the query
   * @returns {*} - The new data
   */
  const setQueryDataWithLoading = useCallback(
    (queryKey, newData, options = {}) => {
      const {
        loadingKey = Array.isArray(queryKey)
          ? `setData_${queryKey[0]}`
          : `setData_${queryKey}`,
        queryOptions = {},
      } = options;
      
      try {
        startLoading(loadingKey);
        clearError(loadingKey);
        
        const result = queryClient.setQueryData(queryKey, newData, queryOptions);
        stopLoading(loadingKey);
        return result;
      } catch (error) {
        setError(loadingKey, error.message || 'Failed to set query data');
        stopLoading(loadingKey);
        throw error;
      }
    },
    [queryClient, startLoading, stopLoading, setError, clearError]
  );
  
  /**
   * Get query data with loading state
   * 
   * @param {string|Array} queryKey - Query key to get data for
   * @param {Object} options - Options for getting data
   * @param {string} options.loadingKey - Custom loading key
   * @returns {*} - The query data
   */
  const getQueryDataWithLoading = useCallback(
    (queryKey, options = {}) => {
      const {
        loadingKey = Array.isArray(queryKey)
          ? `getData_${queryKey[0]}`
          : `getData_${queryKey}`,
      } = options;
      
      try {
        startLoading(loadingKey);
        clearError(loadingKey);
        
        const result = queryClient.getQueryData(queryKey);
        stopLoading(loadingKey);
        return result;
      } catch (error) {
        setError(loadingKey, error.message || 'Failed to get query data');
        stopLoading(loadingKey);
        throw error;
      }
    },
    [queryClient, startLoading, stopLoading, setError, clearError]
  );
  
  // Get the invalidation methods
  const {
    invalidateWithLoading,
    resetWithLoading,
    refetchWithLoading,
    batchInvalidateWithLoading,
    clearCacheWithLoading,
  } = useLoadingInvalidation();
  
  return {
    setQueryDataWithLoading,
    getQueryDataWithLoading,
    invalidateWithLoading,
    resetWithLoading,
    refetchWithLoading,
    batchInvalidateWithLoading,
    clearCacheWithLoading,
  };
};