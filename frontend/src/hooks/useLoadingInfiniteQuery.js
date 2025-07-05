import { useInfiniteQuery } from 'react-query';
import { useLoading } from './useLoading';

/**
 * Custom hook that combines React Query's useInfiniteQuery with LoadingContext
 * Provides loading states for initial load, next page fetching, and errors
 * 
 * @param {string|Array} queryKey - The query key for React Query
 * @param {Function} queryFn - The query function that fetches a page of data
 * @param {Object} options - Additional options for useInfiniteQuery
 * @param {string} initialLoadingKey - Loading key for initial data fetch
 * @param {string} nextPageLoadingKey - Loading key for fetching next page
 * @returns {Object} - The result of useInfiniteQuery with additional loading state methods
 */
export const useLoadingInfiniteQuery = (
  queryKey,
  queryFn,
  options = {},
  initialLoadingKey,
  nextPageLoadingKey
) => {
  const { startLoading, stopLoading, setError, clearError } = useLoading();
  
  // Determine loading keys
  const baseKey = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  const actualInitialLoadingKey = initialLoadingKey || `${baseKey}Initial`;
  const actualNextPageLoadingKey = nextPageLoadingKey || `${baseKey}NextPage`;

  // Enhanced query function that updates loading state
  const enhancedQueryFn = async (context) => {
    const { pageParam, queryKey } = context;
    
    // Determine if this is the initial load or a next page request
    const isInitialLoad = !pageParam || pageParam === options.getNextPageParam?.(undefined, []);
    const loadingKey = isInitialLoad ? actualInitialLoadingKey : actualNextPageLoadingKey;
    
    try {
      startLoading(loadingKey);
      clearError(loadingKey);
      
      const result = await queryFn(context);
      return result;
    } catch (error) {
      setError(loadingKey, error.message || 'Failed to fetch data');
      throw error;
    } finally {
      stopLoading(loadingKey);
    }
  };

  // Use React Query's useInfiniteQuery with the enhanced query function
  const infiniteQueryResult = useInfiniteQuery(queryKey, enhancedQueryFn, options);
  
  // Enhanced fetchNextPage function with loading state
  const fetchNextPageWithLoading = async (options) => {
    if (infiniteQueryResult.isFetchingNextPage) return;
    
    try {
      startLoading(actualNextPageLoadingKey);
      clearError(actualNextPageLoadingKey);
      
      await infiniteQueryResult.fetchNextPage(options);
    } catch (error) {
      setError(actualNextPageLoadingKey, error.message || 'Failed to fetch next page');
      throw error;
    } finally {
      stopLoading(actualNextPageLoadingKey);
    }
  };

  return {
    ...infiniteQueryResult,
    fetchNextPage: fetchNextPageWithLoading,
    initialLoadingKey: actualInitialLoadingKey,
    nextPageLoadingKey: actualNextPageLoadingKey,
  };
};

/**
 * Custom hook for creating an infinite scroll component with loading states
 * 
 * @param {Object} options - Configuration options
 * @param {string|Array} options.queryKey - The query key for React Query
 * @param {Function} options.queryFn - The query function that fetches a page of data
 * @param {Function} options.getNextPageParam - Function to get the next page parameter
 * @param {number} options.threshold - IntersectionObserver threshold for triggering next page load
 * @param {string} options.initialLoadingKey - Loading key for initial data fetch
 * @param {string} options.nextPageLoadingKey - Loading key for fetching next page
 * @returns {Object} - Handlers and state for infinite scrolling
 */
export const useInfiniteScroll = (options = {}) => {
  const {
    queryKey,
    queryFn,
    getNextPageParam,
    threshold = 0.5,
    initialLoadingKey,
    nextPageLoadingKey,
    ...queryOptions
  } = options;

  // Use the enhanced infinite query hook
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    ...rest
  } = useLoadingInfiniteQuery(
    queryKey,
    queryFn,
    {
      getNextPageParam,
      ...queryOptions,
    },
    initialLoadingKey,
    nextPageLoadingKey
  );

  // Create a ref callback for the intersection observer
  const observerRef = (node) => {
    if (!node) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        // If the element is visible and we have more pages to load
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold }
    );
    
    observer.observe(node);
    
    // Cleanup function
    return () => {
      observer.disconnect();
    };
  };

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    observerRef,
    ...rest,
  };
};