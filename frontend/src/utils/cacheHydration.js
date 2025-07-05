/**
 * Cache Hydration Utilities
 * 
 * This module provides utilities for persisting and hydrating React Query cache
 * to/from localStorage to prevent cold loading states on app refresh.
 */

import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query';

// Key for storing the dehydrated cache in localStorage
const CACHE_STORAGE_KEY = 'app_query_cache';

// List of critical query keys that should be persisted
const CRITICAL_QUERY_KEYS = [
  ['userProfile'],
  ['userGuilds'],
  ['walletBalance']
];

/**
 * Persists specific queries from the React Query cache to localStorage
 * 
 * @param {QueryClient} queryClient - The React Query client instance
 */
export const persistQueryCache = (queryClient) => {
  try {
    // Create a new client to avoid modifying the original
    const tempQueryClient = queryClient.getQueryCache().getAll()
      .filter(query => {
        // Only persist queries in our critical list
        return CRITICAL_QUERY_KEYS.some(criticalKey => {
          const queryKey = Array.isArray(query.queryKey) ? query.queryKey : [query.queryKey];
          // Check if the query key starts with any of our critical keys
          return queryKey.length >= criticalKey.length && 
                 criticalKey.every((key, i) => key === queryKey[i]);
        });
      })
      .reduce((client, query) => {
        // Add each filtered query to our temporary client
        client.setQueryData(query.queryKey, query.state.data);
        return client;
      }, new QueryClient());

    // Dehydrate the temporary client and store in localStorage
    const dehydratedState = dehydrate(tempQueryClient);
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(dehydratedState));
  } catch (error) {
    console.error('Failed to persist query cache:', error);
  }
};

/**
 * Hydrates the React Query cache from localStorage
 * 
 * @param {QueryClient} queryClient - The React Query client instance
 * @returns {boolean} - Whether hydration was successful
 */
export const hydrateQueryCache = (queryClient) => {
  try {
    const cachedState = localStorage.getItem(CACHE_STORAGE_KEY);
    
    if (cachedState) {
      const dehydratedState = JSON.parse(cachedState);
      hydrate(queryClient, dehydratedState);
      return true;
    }
  } catch (error) {
    console.error('Failed to hydrate query cache:', error);
  }
  
  return false;
};

/**
 * Clears the persisted query cache from localStorage
 */
export const clearPersistedQueryCache = () => {
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear persisted query cache:', error);
  }
};