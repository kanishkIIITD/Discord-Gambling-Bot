import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLoading } from '../hooks/useLoading';
import { hydrateQueryCache, persistQueryCache, clearPersistedQueryCache } from '../utils/cacheHydration';

/**
 * Hook to coordinate loading states across the application
 * Prevents UI flickering by ensuring all critical data is loaded before rendering
 * 
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.dependencyKeys - Loading keys to track
 * @param {Array<boolean>} options.dependencyStates - Boolean states to track
 * @param {number} options.stabilizationDelay - Delay in ms to ensure loading state is stable
 * @param {boolean} options.debug - Whether to log debug information
 * @returns {Object} - Coordinated loading state and utilities
 */
export const useCoordinatedLoading = (options = {}) => {
  const {
    dependencyKeys = [],
    dependencyStates = [],
    stabilizationDelay = 300, // Increased from 100ms to 300ms to reduce flickering
    debug = false
  } = options;
  
  const { isLoading } = useLoading();
  const [isStabilized, setIsStabilized] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [loadingTimerId, setLoadingTimerId] = useState(null);
  
  // Memoize dependency keys and states to prevent unnecessary re-computations
  const memoizedDependencyKeys = useMemo(() => dependencyKeys, [dependencyKeys]);
  const memoizedDependencyStates = useMemo(() => dependencyStates, [dependencyStates]);
  
  // Compute loading state directly from dependencies to avoid function calls during render
  const computeLoadingState = useCallback(() => {
    // Check loading keys
    const isAnyKeyLoading = memoizedDependencyKeys.some(key => isLoading(key));
    
    // Check explicit dependency states
    const isAnyStateLoading = memoizedDependencyStates.some(state => state === true);
    
    if (debug) {
      // console.log('[CoordinatedLoading] Dependencies status:', {
      //   keys: memoizedDependencyKeys.map(key => ({ key, loading: isLoading(key) })),
      //   states: memoizedDependencyStates,
      //   anyLoading: isAnyKeyLoading || isAnyStateLoading
      // });
    }
    
    return isAnyKeyLoading || isAnyStateLoading;
  }, [memoizedDependencyKeys, memoizedDependencyStates, isLoading, debug]);
  
  // Track the current loading state
  const [currentlyLoading, setCurrentlyLoading] = useState(false);
  
  // Update the loading state when dependencies change, using the memoized function
  useEffect(() => {
    const newLoadingState = computeLoadingState();
    setCurrentlyLoading(newLoadingState);
  }, [computeLoadingState]);
  
  // Combined loading state that prevents flickering
  const isCoordinatedLoading = !isInitialLoadComplete || currentlyLoading || !isStabilized;
  
  // Stabilize loading state to prevent flickering
  useEffect(() => {
    // Clear any existing timer
    if (loadingTimerId) {
      clearTimeout(loadingTimerId);
      setLoadingTimerId(null);
    }
    
    if (!currentlyLoading && !isStabilized) {
      // Set a timer to ensure loading state is stable
      const timerId = setTimeout(() => {
        // if (debug) console.log('[CoordinatedLoading] Loading stabilized');
        setIsStabilized(true);
        setIsInitialLoadComplete(true);
      }, stabilizationDelay);
      
      setLoadingTimerId(timerId);
    } else if (currentlyLoading && isStabilized) {
      // If loading starts again after stabilization, update state
      setIsStabilized(false);
    }
    
    return () => {
      if (loadingTimerId) {
        clearTimeout(loadingTimerId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentlyLoading, isStabilized]);
  
  return {
    isLoading: isCoordinatedLoading,
    isStabilized,
    isInitialLoadComplete,
    resetLoadingState: () => {
      setIsStabilized(false);
      setIsInitialLoadComplete(false);
    }
  };
};

/**
 * Hook to integrate LoadingContext with cache hydration
 * Provides loading states for cache operations
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.hydrateLoadingKey - Loading key for hydration operation
 * @param {string} options.persistLoadingKey - Loading key for persistence operation
 * @param {boolean} options.autoHydrate - Whether to hydrate cache automatically on mount
 * @param {boolean} options.autoPersist - Whether to persist cache automatically on unmount
 * @param {Array<string>} options.queryKeys - Query keys to persist/hydrate
 * @returns {Object} - Cache hydration methods with loading state integration
 */
export const useLoadingCacheHydration = (options = {}) => {
  const {
    hydrateLoadingKey = 'cacheHydration',
    persistLoadingKey = 'cachePersistence',
    autoHydrate = true,
    autoPersist = true,
    queryKeys = ['userProfile', 'userGuilds', 'walletBalance'],
  } = options;

  const queryClient = useQueryClient();
  const { startLoading, stopLoading, setError, withLoading } = useLoading();

  // Hydrate cache with loading state
  const hydrateCache = async () => {
    return withLoading(hydrateLoadingKey, async () => {
      return hydrateQueryCache(queryClient, queryKeys);
    });
  };

  // Persist cache with loading state
  const persistCache = async () => {
    return withLoading(persistLoadingKey, async () => {
      return persistQueryCache(queryClient, queryKeys);
    });
  };

  // Clear persisted cache with loading state
  const clearCache = async () => {
    return withLoading(persistLoadingKey, async () => {
      return clearPersistedQueryCache();
    });
  };

  // Auto-hydrate on mount if enabled
  useEffect(() => {
    if (autoHydrate) {
      hydrateCache().catch(error => {
        console.error('Failed to hydrate cache:', error);
      });
    }

    // Auto-persist on unmount if enabled
    return () => {
      if (autoPersist) {
        persistCache().catch(error => {
          console.error('Failed to persist cache:', error);
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoHydrate, autoPersist]);

  return {
    hydrateCache,
    persistCache,
    clearCache,
    hydrateLoadingKey,
    persistLoadingKey,
  };
};

/**
 * Utility to prefetch and cache data with loading state management
 * 
 * @param {Object} queryClient - React Query client
 * @param {Object} loadingContext - Loading context with withLoading method
 * @param {Object} options - Configuration options
 * @param {Array<Object>} options.queries - Queries to prefetch
 * @param {Function} options.onSuccess - Callback on successful prefetch
 * @param {Function} options.onError - Callback on prefetch error
 * @param {string} options.loadingKey - Loading key for prefetch operation
 * @returns {Promise<Array>} - Results of prefetched queries
 */
export const prefetchWithLoading = async (queryClient, loadingContext, options = {}) => {
  const {
    queries = [],
    onSuccess,
    onError,
    loadingKey = 'prefetch',
  } = options;

  const { withLoading } = loadingContext;

  return withLoading(loadingKey, async () => {
    try {
      const results = await Promise.all(
        queries.map(({ queryKey, queryFn, ...options }) =>
          queryClient.prefetchQuery(queryKey, queryFn, options)
        )
      );

      if (onSuccess) {
        onSuccess(results);
      }

      return results;
    } catch (error) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  });
};

/**
 * Hook to provide prefetch functionality with loading state
 * 
 * @param {Object} options - Configuration options
 * @returns {Function} - Function to prefetch queries with loading state
 */
export const usePrefetchWithLoading = (options = {}) => {
  const queryClient = useQueryClient();
  const loadingContext = useLoading();
  
  return (prefetchOptions) => prefetchWithLoading(
    queryClient,
    loadingContext,
    { ...options, ...prefetchOptions }
  );
};

/**
 * Utility to invalidate queries with loading state management
 * 
 * @param {Object} queryClient - React Query client
 * @param {Object} loadingContext - Loading context with withLoading method
 * @param {Object} options - Configuration options
 * @param {Array<string|Array>} options.queryKeys - Query keys to invalidate
 * @param {boolean} options.refetchActive - Whether to refetch active queries
 * @param {boolean} options.refetchInactive - Whether to refetch inactive queries
 * @param {string} options.loadingKey - Loading key for invalidation operation
 * @returns {Promise<void>} - Promise that resolves when invalidation is complete
 */
export const invalidateWithLoading = async (queryClient, loadingContext, options = {}) => {
  const {
    queryKeys = [],
    refetchActive = true,
    refetchInactive = false,
    loadingKey = 'invalidate',
  } = options;

  const { withLoading } = loadingContext;

  return withLoading(loadingKey, async () => {
    await Promise.all(
      queryKeys.map(queryKey =>
        queryClient.invalidateQueries(queryKey, {
          refetchActive,
          refetchInactive,
        })
      )
    );
  });
};

/**
 * Hook to provide invalidate functionality with loading state
 * 
 * @param {Object} options - Configuration options
 * @returns {Function} - Function to invalidate queries with loading state
 */
export const useInvalidateWithLoading = (options = {}) => {
  const queryClient = useQueryClient();
  const loadingContext = useLoading();
  
  return (invalidateOptions) => invalidateWithLoading(
    queryClient,
    loadingContext,
    { ...options, ...invalidateOptions }
  );
};