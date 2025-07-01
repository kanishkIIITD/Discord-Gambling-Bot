import { useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Custom hook for displaying toast notifications
 * @returns {Object} Toast notification methods
 */
export const useToast = () => {
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
  const promise = useCallback((promise, messages = {}, options = {}) => {
    return toast.promise(
      promise,
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
  }, []);

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
    dismiss,
    dismissAll,
    update,
  };
};

export default useToast;