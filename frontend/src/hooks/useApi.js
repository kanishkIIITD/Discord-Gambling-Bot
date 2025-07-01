import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for handling API requests with better error handling and loading states
 * @param {Function} apiFunction - The API function to call
 * @param {Object} options - Configuration options
 * @returns {Object} - API request state and execution function
 */
const useApi = (apiFunction, options = {}) => {
  const {
    initialData = null,
    onSuccess = () => {},
    onError = () => {},
    autoAbortOnUnmount = true,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use AbortController for cancelling requests
  const abortControllerRef = useRef(null);

  // Function to execute the API call
  const execute = useCallback(async (...args) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create a new AbortController
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setLoading(true);
    setError(null);

    try {
      // Add the signal to the last argument if it's an object
      const lastArg = args[args.length - 1];
      if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
        args[args.length - 1] = { ...lastArg, signal };
      } else {
        args.push({ signal });
      }

      const result = await apiFunction(...args);
      setData(result);
      onSuccess(result);
      return result;
    } catch (err) {
      // Don't set error state if the request was aborted
      if (err.name !== 'AbortError') {
        setError(err);
        onError(err);
      }
      throw err;
    } finally {
      // Only set loading to false if the component is still mounted
      // and the request wasn't aborted
      if (abortControllerRef.current?.signal?.aborted === false) {
        setLoading(false);
      }
    }
  }, [apiFunction, onSuccess, onError]);

  // Abort any in-flight request when the component unmounts
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Clean up on unmount
  const cleanup = useCallback(() => {
    if (autoAbortOnUnmount) {
      abort();
    }
  }, [abort, autoAbortOnUnmount]);

  return {
    data,
    loading,
    error,
    execute,
    abort,
    cleanup,
    // Additional helpers
    reset: useCallback(() => {
      setData(initialData);
      setError(null);
      setLoading(false);
    }, [initialData]),
  };
};

export default useApi;