import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useLoading } from './useLoading';

/**
 * Custom hook for displaying toast notifications with LoadingContext integration
 * @returns {Object} Toast notification methods
 */
export const useToast = () => {
  // Get loading context methods
  const { startLoading, stopLoading, setError: setLoadingError, withLoading } = useLoading();
  
  // Define loading keys for toast operations
  const LOADING_KEYS = {
    TOAST_PROMISE: 'toast.promise',
  };

  // Default toast options
  const defaultOptions = {
    duration: 4000,
    position: 'top-right',
  };

  // Success toast
  const success = useCallback((message, options = {}) => {
    return toast.success(message, {
      ...defaultOptions,
      ...options,
      className: `bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-100 ${options.className || ''}`,
      iconTheme: {
        primary: '#10B981',
        secondary: '#ECFDF5',
      },
    });
  }, []);

  // Error toast
  const error = useCallback((message, options = {}) => {
    return toast.error(message, {
      ...defaultOptions,
      ...options,
      className: `bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-100 ${options.className || ''}`,
      iconTheme: {
        primary: '#EF4444',
        secondary: '#FEF2F2',
      },
    });
  }, []);

  // Info toast
  const info = useCallback((message, options = {}) => {
    return toast(message, {
      ...defaultOptions,
      ...options,
      icon: '📢',
      className: `bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-100 ${options.className || ''}`,
    });
  }, []);

  // Warning toast
  const warning = useCallback((message, options = {}) => {
    return toast(message, {
      ...defaultOptions,
      ...options,
      icon: '⚠️',
      className: `bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 ${options.className || ''}`,
    });
  }, []);

  // Loading toast
  const loading = useCallback((message, options = {}) => {
    return toast.loading(message, {
      ...defaultOptions,
      ...options,
      className: `bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-100 ${options.className || ''}`,
    });
  }, []);

  // Custom toast with icon
  const custom = useCallback((message, icon, options = {}) => {
    return toast(message, {
      ...defaultOptions,
      ...options,
      icon,
    });
  }, []);

  // Promise toast that shows loading, success, or error based on promise resolution
  // Now integrated with LoadingContext
  const promise = useCallback((promise, messages = {}, options = {}, loadingKey = LOADING_KEYS.TOAST_PROMISE) => {
    // Start loading state
    startLoading(loadingKey);
    
    return toast.promise(
      promise.then(result => {
        // Stop loading on success
        stopLoading(loadingKey);
        return result;
      }).catch(err => {
        // Set error and stop loading on failure
        setLoadingError(loadingKey, err);
        stopLoading(loadingKey);
        throw err;
      }),
      {
        loading: messages.loading || 'Loading...',
        success: messages.success || 'Success!',
        error: messages.error || 'An error occurred',
      },
      {
        ...defaultOptions,
        ...options,
      }
    );
  }, [startLoading, stopLoading, setLoadingError]);

  // Promise with loading context - alternative approach using withLoading
  const promiseWithLoading = useCallback(async (asyncFn, messages = {}, options = {}, loadingKey = LOADING_KEYS.TOAST_PROMISE) => {
    const toastId = toast.loading(messages.loading || 'Loading...', {
      ...defaultOptions,
      ...options,
    });
    
    try {
      // Use withLoading to handle the async function
      const result = await withLoading(loadingKey, asyncFn);
      
      // Update toast on success
      toast.success(messages.success || 'Success!', {
        id: toastId,
        ...defaultOptions,
        ...options,
      });
      
      return result;
    } catch (err) {
      // Update toast on error
      toast.error(messages.error || err.message || 'An error occurred', {
        id: toastId,
        ...defaultOptions,
        ...options,
      });
      
      throw err;
    }
  }, [withLoading]);

  // Dismiss a specific toast by ID
  const dismiss = useCallback((toastId) => {
    toast.dismiss(toastId);
  }, []);

  // Dismiss all toasts
  const dismissAll = useCallback(() => {
    toast.dismiss();
  }, []);

  // Update an existing toast
  const update = useCallback((toastId, message, options = {}) => {
    toast.custom(
      (t) => (
        <div
          className={`${options.className || ''} ${t.visible ? 'animate-enter' : 'animate-leave'}`}
        >
          {message}
        </div>
      ),
      {
        id: toastId,
        ...options,
      }
    );
  }, []);

  return {
    success,
    error,
    info,
    warning,
    loading,
    custom,
    promise,
    promiseWithLoading,
    dismiss,
    dismissAll,
    update,
    LOADING_KEYS,
  };
};

export default useToast;