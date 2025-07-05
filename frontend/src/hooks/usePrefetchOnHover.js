import { useCallback, useState } from 'react';
import { useQueryClient } from 'react-query';
import { useLoading } from './useLoading';

/**
 * Custom hook for prefetching data on hover
 * Integrates with LoadingContext to provide loading states
 * 
 * @param {Object} options - Configuration options
 * @param {string|Array} options.queryKey - The query key to prefetch
 * @param {Function} options.queryFn - The query function to execute
 * @param {Object} options.queryOptions - Additional options for the query
 * @param {number} options.hoverDelay - Delay in ms before prefetching starts on hover
 * @param {string} options.loadingKey - Loading key for the prefetch operation
 * @param {boolean} options.enabled - Whether prefetching is enabled
 * @returns {Object} - Handlers and state for prefetching
 */
export const usePrefetchOnHover = (options = {}) => {
  const {
    queryKey,
    queryFn,
    queryOptions = {},
    hoverDelay = 300,
    loadingKey = Array.isArray(queryKey) ? queryKey[0] : queryKey,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const { startLoading, stopLoading, setError, isLoading } = useLoading();
  const [timer, setTimer] = useState(null);
  const [isPrefetched, setIsPrefetched] = useState(false);

  // Handle mouse enter - start prefetch after delay
  const handleMouseEnter = useCallback(() => {
    if (!enabled || isPrefetched) return;

    // Clear any existing timer
    if (timer) clearTimeout(timer);

    // Set new timer
    const newTimer = setTimeout(() => {
      startLoading(loadingKey);

      queryClient.prefetchQuery(queryKey, queryFn, {
        staleTime: Infinity,
        ...queryOptions,
      })
        .then(() => {
          setIsPrefetched(true);
          stopLoading(loadingKey);
        })
        .catch(error => {
          setError(loadingKey, error.message || 'Failed to prefetch data');
          stopLoading(loadingKey);
        });
    }, hoverDelay);

    setTimer(newTimer);
  }, [
    enabled,
    isPrefetched,
    timer,
    queryKey,
    queryFn,
    queryOptions,
    hoverDelay,
    loadingKey,
    queryClient,
    startLoading,
    stopLoading,
    setError,
  ]);

  // Handle mouse leave - cancel prefetch if not started
  const handleMouseLeave = useCallback(() => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  }, [timer]);

  // Force prefetch immediately
  const prefetchNow = useCallback(() => {
    if (!enabled || isPrefetched) return;

    // Clear any existing timer
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }

    startLoading(loadingKey);

    return queryClient.prefetchQuery(queryKey, queryFn, {
      staleTime: Infinity,
      ...queryOptions,
    })
      .then(() => {
        setIsPrefetched(true);
        stopLoading(loadingKey);
      })
      .catch(error => {
        setError(loadingKey, error.message || 'Failed to prefetch data');
        stopLoading(loadingKey);
        throw error;
      });
  }, [
    enabled,
    isPrefetched,
    timer,
    queryKey,
    queryFn,
    queryOptions,
    loadingKey,
    queryClient,
    startLoading,
    stopLoading,
    setError,
  ]);

  // Reset prefetch state
  const resetPrefetch = useCallback(() => {
    setIsPrefetched(false);
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  }, [timer]);

  return {
    prefetchProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleMouseEnter,
      onBlur: handleMouseLeave,
    },
    isPrefetching: isLoading(loadingKey),
    isPrefetched,
    prefetchNow,
    resetPrefetch,
    loadingKey,
  };
};

/**
 * Custom hook for prefetching multiple queries on hover
 * 
 * @param {Array} queriesConfig - Array of query configurations
 * @param {Object} options - Global options for all queries
 * @returns {Object} - Handlers and state for prefetching
 */
export const usePrefetchQueriesOnHover = (queriesConfig = [], options = {}) => {
  const {
    hoverDelay = 300,
    loadingKey = 'batchPrefetch',
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const { startLoading, stopLoading, setError, isLoading } = useLoading();
  const [timer, setTimer] = useState(null);
  const [isPrefetched, setIsPrefetched] = useState(false);

  // Handle mouse enter - start prefetch after delay
  const handleMouseEnter = useCallback(() => {
    if (!enabled || isPrefetched || queriesConfig.length === 0) return;

    // Clear any existing timer
    if (timer) clearTimeout(timer);

    // Set new timer
    const newTimer = setTimeout(() => {
      startLoading(loadingKey);

      Promise.all(
        queriesConfig.map(({ queryKey, queryFn, queryOptions = {} }) =>
          queryClient.prefetchQuery(queryKey, queryFn, {
            staleTime: Infinity,
            ...queryOptions,
          })
        )
      )
        .then(() => {
          setIsPrefetched(true);
          stopLoading(loadingKey);
        })
        .catch(error => {
          setError(loadingKey, error.message || 'Failed to prefetch data');
          stopLoading(loadingKey);
        });
    }, hoverDelay);

    setTimer(newTimer);
  }, [
    enabled,
    isPrefetched,
    queriesConfig,
    timer,
    hoverDelay,
    loadingKey,
    queryClient,
    startLoading,
    stopLoading,
    setError,
  ]);

  // Handle mouse leave - cancel prefetch if not started
  const handleMouseLeave = useCallback(() => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  }, [timer]);

  // Force prefetch immediately
  const prefetchNow = useCallback(() => {
    if (!enabled || isPrefetched || queriesConfig.length === 0) return;

    // Clear any existing timer
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }

    startLoading(loadingKey);

    return Promise.all(
      queriesConfig.map(({ queryKey, queryFn, queryOptions = {} }) =>
        queryClient.prefetchQuery(queryKey, queryFn, {
          staleTime: Infinity,
          ...queryOptions,
        })
      )
    )
      .then(() => {
        setIsPrefetched(true);
        stopLoading(loadingKey);
      })
      .catch(error => {
        setError(loadingKey, error.message || 'Failed to prefetch data');
        stopLoading(loadingKey);
        throw error;
      });
  }, [
    enabled,
    isPrefetched,
    queriesConfig,
    timer,
    loadingKey,
    queryClient,
    startLoading,
    stopLoading,
    setError,
  ]);

  return {
    prefetchProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleMouseEnter,
      onBlur: handleMouseLeave,
    },
    isPrefetching: isLoading(loadingKey),
    isPrefetched,
    prefetchNow,
    resetPrefetch: () => setIsPrefetched(false),
    loadingKey,
  };
};