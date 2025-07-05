import React, { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUIStore } from '../store';

/**
 * Custom hook that integrates React Query with Zustand's UI store
 * Provides loading states for queries and automatically manages loading indicators
 * 
 * @param {string|Array} queryKey - The query key for React Query
 * @param {Function} queryFn - The query function
 * @param {Object} options - Additional options for useQuery
 * @param {string} loadingKey - The key to use for loading state in UIStore (defaults to queryKey)
 * @returns {Object} - The result of useQuery with additional loading state methods
 */
export const useZustandQuery = (queryKey, queryFn, options = {}, loadingKey) => {
  const startLoading = useUIStore(state => state.startLoading);
  const stopLoading = useUIStore(state => state.stopLoading);
  const setError = useUIStore(state => state.setError);
  const clearError = useUIStore(state => state.clearError);
  
  const actualLoadingKey = loadingKey || (Array.isArray(queryKey) ? queryKey[0] : queryKey);
  const isFetchingRef = useRef(false);
  
  // Store store functions in refs to avoid dependency issues
  const storeFunctionsRef = useRef({ startLoading, stopLoading, setError, clearError });
  
  // Update refs when store functions change
  useEffect(() => {
    storeFunctionsRef.current = { startLoading, stopLoading, setError, clearError };
  }, [startLoading, stopLoading, setError, clearError]);

  // Memoize the callbacks to prevent infinite loops
  const onSuccess = useCallback((data) => {
    storeFunctionsRef.current.stopLoading(actualLoadingKey);
    if (options.onSuccess) {
      options.onSuccess(data);
    }
  }, [actualLoadingKey, options.onSuccess]);

  // Handle query error
  const onError = useCallback((error) => {
    storeFunctionsRef.current.stopLoading(actualLoadingKey);
    storeFunctionsRef.current.setError(actualLoadingKey, error);
    if (options.onError) {
      options.onError(error);
    }
  }, [actualLoadingKey, options.onError]);
  
  // Memoize the onSettled callback
  const onSettled = useCallback(() => {
    // Ensure loading state is cleared in all cases
    storeFunctionsRef.current.stopLoading(actualLoadingKey);
  }, [actualLoadingKey]);
  
  // Create a modified options object with our callbacks
  const modifiedOptions = {
    ...options,
    onSuccess,
    onError,
    onSettled: options.onSettled || onSettled
  };

  // Use React Query with our modified options
  const queryResult = useQuery({
    ...modifiedOptions,
    queryKey,
    queryFn,
  });
  
  // Set loading state when query is fetching, but only once per render cycle
  useEffect(() => {
    const isCurrentlyFetching = queryResult.isFetching;
    const isEnabled = options.enabled !== false; // Check if query is enabled
    
    // Only update if the fetching state has actually changed
    if (isCurrentlyFetching !== isFetchingRef.current) {
      isFetchingRef.current = isCurrentlyFetching;
      
      if (isCurrentlyFetching && isEnabled) {
        storeFunctionsRef.current.startLoading(actualLoadingKey);
        storeFunctionsRef.current.clearError(actualLoadingKey);
      } else if (!isCurrentlyFetching) {
        // Stop loading when query is no longer fetching
        storeFunctionsRef.current.stopLoading(actualLoadingKey);
      }
    }
    
    // If query is disabled, ensure loading state is cleared
    if (!isEnabled) {
      storeFunctionsRef.current.stopLoading(actualLoadingKey);
      storeFunctionsRef.current.clearError(actualLoadingKey);
    }
  }, [queryResult.isFetching, actualLoadingKey, options.enabled]);
  
  // Cleanup effect to clear loading state when component unmounts or query is disabled
  useEffect(() => {
    const isEnabled = options.enabled !== false;
    
    // If query is disabled, clear loading state
    if (!isEnabled) {
      storeFunctionsRef.current.stopLoading(actualLoadingKey);
      storeFunctionsRef.current.clearError(actualLoadingKey);
    }
    
    // Cleanup function to clear loading state on unmount
    return () => {
      storeFunctionsRef.current.stopLoading(actualLoadingKey);
      storeFunctionsRef.current.clearError(actualLoadingKey);
    };
  }, [options.enabled, actualLoadingKey]);
  
  // Return the query result
  return queryResult;
};

/**
 * Custom hook that integrates React Query's useMutation with Zustand's UI store
 * Provides loading states for mutations and automatically manages loading indicators
 * 
 * @param {Function} mutationFn - The mutation function
 * @param {Object} options - Additional options for useMutation
 * @param {string} loadingKey - The key to use for loading state in UIStore
 * @returns {Object} - The result of useMutation with additional loading state methods
 */
export const useZustandMutation = (mutationFn, options = {}, loadingKey) => {
  const startLoading = useUIStore(state => state.startLoading);
  const stopLoading = useUIStore(state => state.stopLoading);
  const setError = useUIStore(state => state.setError);
  const clearError = useUIStore(state => state.clearError);
  
  const actualLoadingKey = loadingKey || 'mutation';
  
  // Store store functions in refs to avoid dependency issues
  const storeFunctionsRef = useRef({ startLoading, stopLoading, setError, clearError });
  
  // Update refs when store functions change
  useEffect(() => {
    storeFunctionsRef.current = { startLoading, stopLoading, setError, clearError };
  }, [startLoading, stopLoading, setError, clearError]);

  // Handle mutation loading state
  const onMutate = useCallback((variables) => {
    storeFunctionsRef.current.startLoading(actualLoadingKey);
    storeFunctionsRef.current.clearError(actualLoadingKey);
    if (options.onMutate) {
      return options.onMutate(variables);
    }
  }, [actualLoadingKey, options.onMutate]);

  // Handle mutation success
  const onSuccess = useCallback((data, variables, context) => {
    storeFunctionsRef.current.stopLoading(actualLoadingKey);
    if (options.onSuccess) {
      options.onSuccess(data, variables, context);
    }
  }, [actualLoadingKey, options.onSuccess]);

  // Handle mutation error
  const onError = useCallback((error, variables, context) => {
    storeFunctionsRef.current.stopLoading(actualLoadingKey);
    storeFunctionsRef.current.setError(actualLoadingKey, error);
    if (options.onError) {
      options.onError(error, variables, context);
    }
  }, [actualLoadingKey, options.onError]);

  // Handle mutation completion
  const onSettled = useCallback((data, error, variables, context) => {
    if (options.onSettled) {
      options.onSettled(data, error, variables, context);
    }
  }, [options.onSettled]);

  // Return the mutation result
  return useMutation({
    ...options,
    mutationFn,
    onMutate,
    onSuccess,
    onError,
    onSettled,
  });
};