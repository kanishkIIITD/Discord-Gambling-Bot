/**
 * useChartDataCache Hook
 * 
 * A custom hook for fetching and caching chart data to prevent redundant API calls
 * and optimize chart rendering performance.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Creates a cache key based on the provided parameters
 * 
 * @param {string} endpoint - The API endpoint
 * @param {Object} params - The parameters for the API call
 * @returns {string} - A unique cache key
 */
const createCacheKey = (endpoint, params = {}) => {
  // Include the current guild ID in the cache key to ensure different guilds have separate caches
  const selectedGuildId = localStorage.getItem('selectedGuildId') || 'default';
  return `${endpoint}:${selectedGuildId}:${JSON.stringify(params)}`;
};

/**
 * Hook for fetching and caching chart data
 * 
 * @param {Function} fetchFunction - The API function to call
 * @param {Object} params - Parameters for the API call
 * @param {number} cacheTime - Time in milliseconds to keep data in cache (default: 5 minutes)
 * @returns {Object} - { data, loading, error, refetch }
 */
const useChartDataCache = (fetchFunction, params = {}, cacheTime = 5 * 60 * 1000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use a ref for the cache to persist between renders
  const cacheRef = useRef({});
  
  // Create a cache key based on the function name and params
  const cacheKey = createCacheKey(fetchFunction.name, params);
  
  // Function to fetch data and update cache
  const fetchData = useCallback(async (skipCache = false) => {
    // Check if we have cached data and it's not expired
    const cachedItem = cacheRef.current[cacheKey];
    const now = Date.now();
    
    if (!skipCache && cachedItem && (now - cachedItem.timestamp) < cacheTime) {
      setData(cachedItem.data);
      setLoading(false);
      return;
    }
    
    // If no cache or expired, fetch new data
    try {
      setLoading(true);
      setError(null);
      
      const result = await fetchFunction(...Object.values(params));
      
      // Update the cache
      cacheRef.current[cacheKey] = {
        data: result,
        timestamp: now
      };
      
      setData(result);
    } catch (err) {
      console.error(`Error fetching chart data: ${err.message}`);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, cacheKey, cacheTime, params]);
  
  // Fetch data on mount or when dependencies change
  useEffect(() => {
    fetchData();
    
    // Cleanup function to handle component unmount
    return () => {
      // Optionally implement cache cleanup logic here
    };
  }, [fetchData]);
  
  // Function to force a refresh of the data
  const refetch = useCallback(() => fetchData(true), [fetchData]);
  
  return { data, loading, error, refetch };
};

/**
 * Global chart data cache for sharing cache between components
 */
export const globalChartCache = {
  cache: {},
  set: (key, data) => {
    globalChartCache.cache[key] = {
      data,
      timestamp: Date.now()
    };
  },
  get: (key, maxAge = 5 * 60 * 1000) => {
    const cachedItem = globalChartCache.cache[key];
    if (cachedItem && (Date.now() - cachedItem.timestamp) < maxAge) {
      return cachedItem.data;
    }
    return null;
  },
  clear: () => {
    globalChartCache.cache = {};
  }
};

export default useChartDataCache;