/**
 * API Utilities
 * 
 * This module provides utilities for making API requests with retry logic,
 * error handling, and loading state management.
 */

import axios from '../services/axiosConfig';

/**
 * Creates an API request with retry logic
 * 
 * @param {Function} apiCall - The API call function to execute
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Initial delay in ms before retrying (default: 300)
 * @param {number} options.maxDelay - Maximum delay in ms between retries (default: 5000)
 * @param {Function} options.onRetry - Callback function executed before each retry
 * @param {Array} options.retryableErrors - Array of error status codes that should trigger a retry
 * @returns {Promise} - Promise that resolves with the API response or rejects with an error
 */
export const withRetry = async (apiCall, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 300,
    maxDelay = 5000,
    onRetry = () => {},
    retryableErrors = [408, 429, 500, 502, 503, 504, 'ECONNABORTED', 'Network Error']
  } = options;

  let lastError = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      attempt++;

      // Check if we've used all retry attempts
      if (attempt > maxRetries) {
        break;
      }

      // Check if the error is retryable
      const isRetryable = 
        (error.response && retryableErrors.includes(error.response.status)) ||
        (error.code && retryableErrors.includes(error.code)) ||
        (error.message && retryableErrors.some(e => error.message.includes(e)));

      if (!isRetryable) {
        break;
      }

      // Calculate exponential backoff delay with jitter
      const delay = Math.min(
        maxDelay,
        baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5)
      );

      // Execute onRetry callback with attempt information
      onRetry({
        error,
        attempt,
        delay,
        maxRetries
      });

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError;
};

/**
 * Creates an enhanced API client with retry logic and error handling
 * 
 * @param {Object} options - Configuration options for the API client
 * @returns {Object} - Enhanced API client with retry capabilities
 */
export const createApiClient = (options = {}) => {
  const {
    baseURL,
    timeout = 10000,
    headers = {},
    retryConfig = {}
  } = options;

  // Create axios instance
  const axiosInstance = axios.create({
    baseURL,
    timeout,
    headers
  });

  // Enhanced get method with retry logic
  const get = (url, config = {}) => {
    return withRetry(
      () => axiosInstance.get(url, config),
      retryConfig
    );
  };

  // Enhanced post method with retry logic
  const post = (url, data, config = {}) => {
    return withRetry(
      () => axiosInstance.post(url, data, config),
      retryConfig
    );
  };

  // Enhanced put method with retry logic
  const put = (url, data, config = {}) => {
    return withRetry(
      () => axiosInstance.put(url, data, config),
      retryConfig
    );
  };

  // Enhanced delete method with retry logic
  const del = (url, config = {}) => {
    return withRetry(
      () => axiosInstance.delete(url, config),
      retryConfig
    );
  };

  return {
    instance: axiosInstance,
    get,
    post,
    put,
    delete: del
  };
};

/**
 * Creates a prefetch function that can be used to prefetch data
 * 
 * @param {Function} queryFn - The query function to execute
 * @param {Function} onSuccess - Callback function executed on successful prefetch
 * @param {Function} onError - Callback function executed on prefetch error
 * @returns {Function} - Prefetch function
 */
export const createPrefetchFn = (queryFn, onSuccess = () => {}, onError = () => {}) => {
  return async (...args) => {
    try {
      const result = await queryFn(...args);
      onSuccess(result);
      return result;
    } catch (error) {
      onError(error);
      throw error;
    }
  };
};