import { useQuery, useMutation, useQueries } from 'react-query';
import { useLoading } from './useLoading';

/**
 * Custom hook that combines React Query with LoadingContext
 * 
 * @param {string} queryKey - The query key for React Query
 * @param {Function} queryFn - The query function
 * @param {Object} options - Additional options for useQuery
 * @param {string} loadingKey - The key to use for loading state in LoadingContext (defaults to queryKey)
 * @returns {Object} - The result of useQuery with additional loading state methods
 */
export const useLoadingQuery = (queryKey, queryFn, options = {}, loadingKey) => {
  const { startLoading, stopLoading, setError } = useLoading();
  const actualLoadingKey = loadingKey || (Array.isArray(queryKey) ? queryKey[0] : queryKey);

  // Enhanced query function that updates loading state
  const enhancedQueryFn = async (...args) => {
    try {
      startLoading(actualLoadingKey);
      const result = await queryFn(...args);
      return result;
    } catch (error) {
      setError(actualLoadingKey, error.message || 'An error occurred');
      throw error;
    } finally {
      stopLoading(actualLoadingKey);
    }
  };

  // Use React Query with the enhanced query function
  return useQuery(queryKey, enhancedQueryFn, options);
};

/**
 * Custom hook that combines React Query's useMutation with LoadingContext
 * 
 * @param {Function} mutationFn - The mutation function
 * @param {Object} options - Additional options for useMutation
 * @param {string} loadingKey - The key to use for loading state in LoadingContext
 * @returns {Object} - The result of useMutation with additional loading state methods
 */
export const useLoadingMutation = (mutationFn, options = {}, loadingKey) => {
  const { startLoading, stopLoading, setError } = useLoading();
  const actualLoadingKey = loadingKey || 'mutation';

  // Enhanced mutation function that updates loading state
  const enhancedMutationFn = async (...args) => {
    try {
      startLoading(actualLoadingKey);
      const result = await mutationFn(...args);
      return result;
    } catch (error) {
      setError(actualLoadingKey, error.message || 'An error occurred');
      throw error;
    } finally {
      stopLoading(actualLoadingKey);
    }
  };

  // Use React Query's useMutation with the enhanced mutation function
  return useMutation(enhancedMutationFn, options);
};

/**
 * Custom hook that combines multiple React Query hooks with LoadingContext
 * 
 * @param {Array} queries - Array of query configurations
 * @param {Object} options - Additional options for useQueries
 * @returns {Array} - Array of query results
 * 
 * @example
 * const results = useLoadingQueries([
 *   { queryKey: ['users'], queryFn: fetchUsers, loadingKey: 'users' },
 *   { queryKey: ['posts'], queryFn: fetchPosts, loadingKey: 'posts' }
 * ]);
 */
export const useLoadingQueries = (queries, options = {}) => {
  const { startLoading, stopLoading, setError } = useLoading();

  // Enhance each query with loading state management
  const enhancedQueries = queries.map(query => {
    const { queryKey, queryFn, loadingKey, ...restOptions } = query;
    const actualLoadingKey = loadingKey || (Array.isArray(queryKey) ? queryKey[0] : queryKey);

    return {
      queryKey,
      queryFn: async (...args) => {
        try {
          startLoading(actualLoadingKey);
          const result = await queryFn(...args);
          return result;
        } catch (error) {
          setError(actualLoadingKey, error.message || 'An error occurred');
          throw error;
        } finally {
          stopLoading(actualLoadingKey);
        }
      },
      ...restOptions
    };
  });

  // Use React Query's useQueries with the enhanced queries
  return useQueries(enhancedQueries);
};