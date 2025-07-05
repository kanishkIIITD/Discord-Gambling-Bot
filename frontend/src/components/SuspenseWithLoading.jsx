import React, { Suspense, useEffect, useRef } from 'react';
import { useLoading } from '../hooks/useLoading';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Default fallback component for Suspense
 * Uses LoadingSpinner with customizable props
 */
const DefaultSuspenseFallback = ({
  size = 'md',
  color,
  overlay = false,
  message = 'Loading...',
}) => (
  <LoadingSpinner
    size={size}
    color={color}
    overlay={overlay}
    message={message}
  />
);

/**
 * SuspenseWithLoading component that integrates React Suspense with LoadingContext
 * Automatically manages loading state in LoadingContext when Suspense is active
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that may suspend
 * @param {React.ReactNode|Function} props.fallback - Fallback component to show while suspended
 * @param {string} props.loadingKey - Key to use for the loading state in LoadingContext
 * @param {string} props.size - Size of the loading spinner (sm, md, lg, xl)
 * @param {string} props.color - Color of the loading spinner
 * @param {boolean} props.overlay - Whether to show the spinner as an overlay
 * @param {string} props.message - Message to display with the spinner
 */
export const SuspenseWithLoading = ({
  children,
  fallback,
  loadingKey = 'suspense',
  size,
  color,
  overlay,
  message,
  ...props
}) => {
  const { startLoading, stopLoading } = useLoading();
  
  // Default fallback if none provided
  const defaultFallback = (
    <DefaultSuspenseFallback
      size={size}
      color={color}
      overlay={overlay}
      message={message}
    />
  );
  
  // Use provided fallback or default
  const suspenseFallback = fallback || defaultFallback;
  
  // Wrapper component to manage loading state
  const FallbackWithLoading = () => {
    // Start loading when fallback is shown
    useEffect(() => {
      startLoading(loadingKey);
      
      // Stop loading when component unmounts (suspended component is ready)
      return () => stopLoading(loadingKey);
    }, []);
    
    return typeof fallback === 'function' ? fallback() : suspenseFallback;
  };
  
  return (
    <Suspense fallback={<FallbackWithLoading />} {...props}>
      {children}
    </Suspense>
  );
};

/**
 * Higher-order component that wraps a component with SuspenseWithLoading
 * 
 * @param {React.Component} Component - Component to wrap
 * @param {Object} options - Options for SuspenseWithLoading
 * @returns {React.Component} - Wrapped component
 */
export const withSuspense = (Component, options = {}) => {
  const {
    loadingKey,
    fallback,
    size,
    color,
    overlay,
    message,
    ...suspenseProps
  } = options;
  
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WithSuspense = (props) => (
    <SuspenseWithLoading
      loadingKey={loadingKey || `suspense_${displayName}`}
      fallback={fallback}
      size={size}
      color={color}
      overlay={overlay}
      message={message}
      {...suspenseProps}
    >
      <Component {...props} />
    </SuspenseWithLoading>
  );
  
  WithSuspense.displayName = `WithSuspense(${displayName})`;
  
  return WithSuspense;
};

/**
 * Creates a lazy-loaded component with integrated loading state
 * 
 * @param {Function} importFn - Dynamic import function
 * @param {Object} options - Options for SuspenseWithLoading
 * @returns {React.Component} - Lazy-loaded component with suspense
 */
export const createLazySuspenseComponent = (importFn, options = {}) => {
  const LazyComponent = React.lazy(importFn);
  
  return withSuspense(LazyComponent, options);
};

/**
 * Creates a resource that can be used with Suspense
 * Integrates with LoadingContext to provide loading state
 * 
 * @param {Function} fetchFn - Function that returns a promise
 * @param {string} loadingKey - Key to use for the loading state
 * @returns {Object} - Resource with read method
 */
export const createSuspenseResource = (fetchFn, loadingKey) => {
  let status = 'pending';
  let result;
  let error;

  const suspender = fetchFn()
    .then(
      (data) => {
        status = 'success';
        result = data;
      },
      (err) => {
        status = 'error';
        error = err;
      }
    );

  return {
    read() {
      if (status === 'pending') {
        throw suspender;
      } else if (status === 'error') {
        throw error;
      } else if (status === 'success') {
        return result;
      }
    },
  };
};