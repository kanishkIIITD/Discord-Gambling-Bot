import { useCallback } from 'react';
import { useLoading } from './useLoading';
import useToast from './useToast';

/**
 * Custom hook that combines LoadingContext with toast notifications
 * for a more integrated loading and notification experience.
 * 
 * @returns {Object} Methods for managing loading states with toast notifications
 */
const useLoadingToast = () => {
  const { startLoading, stopLoading, setError, withLoading, isLoading } = useLoading();
  const toast = useToast();
  
  /**
   * Starts a loading state and shows a loading toast
   * @param {string} loadingKey - The loading key to track
   * @param {string} message - Toast message
   * @param {Object} options - Toast options
   * @returns {string} Toast ID
   */
  const startLoadingWithToast = useCallback((loadingKey, message = 'Loading...', options = {}) => {
    startLoading(loadingKey);
    return toast.loading(message, options);
  }, [startLoading, toast]);
  
  /**
   * Stops a loading state and updates the toast
   * @param {string} loadingKey - The loading key to stop
   * @param {string} toastId - The toast ID to update
   * @param {string} message - Success message
   * @param {Object} options - Toast options
   */
  const stopLoadingWithToast = useCallback((loadingKey, toastId, message = 'Success!', options = {}) => {
    stopLoading(loadingKey);
    toast.success(message, { id: toastId, ...options });
  }, [stopLoading, toast]);
  
  /**
   * Sets an error state and updates the toast
   * @param {string} loadingKey - The loading key
   * @param {Error} error - The error object
   * @param {string} toastId - The toast ID to update
   * @param {string} message - Error message (defaults to error.message)
   * @param {Object} options - Toast options
   */
  const setErrorWithToast = useCallback((loadingKey, error, toastId, message, options = {}) => {
    setError(loadingKey, error);
    stopLoading(loadingKey);
    toast.error(message || error.message || 'An error occurred', { id: toastId, ...options });
  }, [setError, stopLoading, toast]);
  
  /**
   * Executes an async function with loading state and toast notifications
   * @param {string} loadingKey - The loading key to track
   * @param {Function} asyncFn - The async function to execute
   * @param {Object} messages - Toast messages for loading, success, and error states
   * @param {Object} options - Toast options
   * @returns {Promise<any>} The result of the async function
   */
  const withLoadingToast = useCallback(async (loadingKey, asyncFn, messages = {}, options = {}) => {
    const toastId = toast.loading(messages.loading || 'Loading...', options);
    
    try {
      const result = await withLoading(loadingKey, asyncFn);
      toast.success(messages.success || 'Success!', { id: toastId, ...options });
      return result;
    } catch (error) {
      toast.error(messages.error || error.message || 'An error occurred', { id: toastId, ...options });
      throw error;
    }
  }, [withLoading, toast]);
  
  return {
    startLoadingWithToast,
    stopLoadingWithToast,
    setErrorWithToast,
    withLoadingToast,
    isLoading,
    // Re-export base methods for convenience
    startLoading,
    stopLoading,
    setError,
    withLoading,
  };
};

export default useLoadingToast;