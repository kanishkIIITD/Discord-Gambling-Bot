import React, { useState } from 'react';
import { useLoading } from '../../hooks/useLoading';
import LoadingToast from '../LoadingToast';
import useLoadingToast from '../../hooks/useLoadingToast';
import useToast from '../../hooks/useToast';

/**
 * Demo page showcasing different ways to use LoadingToast and toast integration
 */
const LoadingToastDemoPage = () => {
  const [result, setResult] = useState(null);
  const { startLoading, stopLoading, setError, withLoading } = useLoading();
  const { withLoadingToast } = useLoadingToast();
  const toast = useToast();
  
  // Define loading keys
  const LOADING_KEYS = {
    MANUAL: 'demo.manual',
    WITH_LOADING: 'demo.withLoading',
    WITH_TOAST: 'demo.withToast',
    PROMISE: 'demo.promise',
    PROMISE_WITH_LOADING: 'demo.promiseWithLoading',
  };
  
  // Simulated API call that succeeds
  const simulateSuccessfulApiCall = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, message: 'Operation completed successfully', timestamp: new Date().toISOString() };
  };
  
  // Simulated API call that fails
  const simulateFailedApiCall = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    throw new Error('Operation failed due to server error');
  };
  
  // 1. Manual loading state management
  const handleManualLoading = async (shouldFail = false) => {
    try {
      // Start loading
      startLoading(LOADING_KEYS.MANUAL);
      
      // Simulate API call
      const data = shouldFail 
        ? await simulateFailedApiCall()
        : await simulateSuccessfulApiCall();
      
      // Update result
      setResult({
        method: 'Manual Loading',
        data,
        timestamp: new Date().toISOString()
      });
      
      // Show success toast
      toast.success('Operation completed successfully!');
    } catch (error) {
      // Set error in loading context
      setError(LOADING_KEYS.MANUAL, error);
      
      // Show error toast
      toast.error(`Error: ${error.message}`);
    } finally {
      // Stop loading
      stopLoading(LOADING_KEYS.MANUAL);
    }
  };
  
  // 2. Using withLoading utility
  const handleWithLoading = async (shouldFail = false) => {
    try {
      const data = await withLoading(LOADING_KEYS.WITH_LOADING, async () => {
        return shouldFail 
          ? await simulateFailedApiCall()
          : await simulateSuccessfulApiCall();
      });
      
      // Update result
      setResult({
        method: 'With Loading',
        data,
        timestamp: new Date().toISOString()
      });
      
      // Show success toast
      toast.success('Operation completed successfully!');
    } catch (error) {
      // Error is already set in loading context by withLoading
      
      // Show error toast
      toast.error(`Error: ${error.message}`);
    }
  };
  
  // 3. Using withLoadingToast utility
  const handleWithLoadingToast = async (shouldFail = false) => {
    try {
      const data = await withLoadingToast(
        LOADING_KEYS.WITH_TOAST,
        async () => {
          return shouldFail 
            ? await simulateFailedApiCall()
            : await simulateSuccessfulApiCall();
        },
        {
          loading: 'Processing your request...',
          success: 'Operation completed successfully!',
          error: 'Operation failed. Please try again.'
        }
      );
      
      // Update result
      setResult({
        method: 'With Loading Toast',
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Error is already handled by withLoadingToast
      console.error('Error details:', error);
    }
  };
  
  // 4. Using toast.promise with LoadingContext
  const handlePromise = (shouldFail = false) => {
    const promise = shouldFail 
      ? simulateFailedApiCall()
      : simulateSuccessfulApiCall();
    
    toast.promise(
      promise.then(data => {
        // Update result
        setResult({
          method: 'Toast Promise',
          data,
          timestamp: new Date().toISOString()
        });
        return data;
      }),
      {
        loading: 'Processing with toast.promise...',
        success: 'Promise resolved successfully!',
        error: (err) => `Promise rejected: ${err.message}`
      },
      {}, // Toast options
      LOADING_KEYS.PROMISE // Loading key
    );
  };
  
  // 5. Using toast.promiseWithLoading
  const handlePromiseWithLoading = async (shouldFail = false) => {
    try {
      const data = await toast.promiseWithLoading(
        async () => {
          return shouldFail 
            ? await simulateFailedApiCall()
            : await simulateSuccessfulApiCall();
        },
        {
          loading: 'Processing with promiseWithLoading...',
          success: 'Promise resolved successfully!',
          error: 'Promise rejected. Please try again.'
        },
        {}, // Toast options
        LOADING_KEYS.PROMISE_WITH_LOADING // Loading key
      );
      
      // Update result
      setResult({
        method: 'Toast Promise With Loading',
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Error is already handled by promiseWithLoading
      console.error('Error details:', error);
    }
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto bg-surface rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-text-primary">Loading Toast Demo</h1>
      
      {/* Display loading toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <LoadingToast 
          loadingKey={LOADING_KEYS.MANUAL} 
          message="Manual loading..." 
          color="primary" 
        />
        <LoadingToast 
          loadingKey={LOADING_KEYS.WITH_LOADING} 
          message="Using withLoading..." 
          color="secondary" 
        />
        <LoadingToast 
          loadingKey={LOADING_KEYS.WITH_TOAST} 
          message="Using withLoadingToast..." 
          color="accent" 
        />
        <LoadingToast 
          loadingKey={LOADING_KEYS.PROMISE} 
          message="Using toast.promise..." 
          color="primary" 
        />
        <LoadingToast 
          loadingKey={LOADING_KEYS.PROMISE_WITH_LOADING} 
          message="Using promiseWithLoading..." 
          color="secondary" 
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Manual loading */}
        <div className="p-4 border border-outline rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-text-primary">Manual Loading</h2>
          <p className="mb-4 text-text-secondary">Manually manage loading states with LoadingContext</p>
          <div className="flex space-x-2">
            <button
              onClick={() => handleManualLoading(false)}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Success
            </button>
            <button
              onClick={() => handleManualLoading(true)}
              className="px-4 py-2 bg-error text-white rounded hover:bg-error-dark"
            >
              Error
            </button>
          </div>
        </div>
        
        {/* withLoading */}
        <div className="p-4 border border-outline rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-text-primary">withLoading</h2>
          <p className="mb-4 text-text-secondary">Use the withLoading utility from LoadingContext</p>
          <div className="flex space-x-2">
            <button
              onClick={() => handleWithLoading(false)}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Success
            </button>
            <button
              onClick={() => handleWithLoading(true)}
              className="px-4 py-2 bg-error text-white rounded hover:bg-error-dark"
            >
              Error
            </button>
          </div>
        </div>
        
        {/* withLoadingToast */}
        <div className="p-4 border border-outline rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-text-primary">withLoadingToast</h2>
          <p className="mb-4 text-text-secondary">Use the withLoadingToast utility for integrated experience</p>
          <div className="flex space-x-2">
            <button
              onClick={() => handleWithLoadingToast(false)}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Success
            </button>
            <button
              onClick={() => handleWithLoadingToast(true)}
              className="px-4 py-2 bg-error text-white rounded hover:bg-error-dark"
            >
              Error
            </button>
          </div>
        </div>
        
        {/* toast.promise */}
        <div className="p-4 border border-outline rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-text-primary">toast.promise</h2>
          <p className="mb-4 text-text-secondary">Use toast.promise with LoadingContext integration</p>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePromise(false)}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Success
            </button>
            <button
              onClick={() => handlePromise(true)}
              className="px-4 py-2 bg-error text-white rounded hover:bg-error-dark"
            >
              Error
            </button>
          </div>
        </div>
        
        {/* toast.promiseWithLoading */}
        <div className="p-4 border border-outline rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-text-primary">toast.promiseWithLoading</h2>
          <p className="mb-4 text-text-secondary">Use toast.promiseWithLoading for a cleaner approach</p>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePromiseWithLoading(false)}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Success
            </button>
            <button
              onClick={() => handlePromiseWithLoading(true)}
              className="px-4 py-2 bg-error text-white rounded hover:bg-error-dark"
            >
              Error
            </button>
          </div>
        </div>
      </div>
      
      {/* Result display */}
      {result && (
        <div className="mt-8 p-4 bg-surface-variant rounded-lg border border-outline">
          <h2 className="text-xl font-semibold mb-3 text-text-primary">Result</h2>
          <div className="bg-code-bg p-4 rounded overflow-auto">
            <pre className="text-sm text-text-primary">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingToastDemoPage;