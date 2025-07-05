import React from 'react';
import { useLoading } from '../hooks/useLoading';
import LoadingSpinner from './LoadingSpinner';

/**
 * Higher-order component that adds loading state management to a component
 * 
 * @param {React.ComponentType} Component - The component to wrap
 * @param {Object} options - Configuration options
 * @param {string} options.loadingKey - The key to use for loading state
 * @param {string} options.size - Size of the loading spinner
 * @param {string} options.color - Color of the loading spinner
 * @param {boolean} options.overlay - Whether to show the spinner with a full-screen overlay
 * @param {string} options.message - Message to display with the spinner
 * @param {boolean} options.showContentWhileLoading - Whether to show the component while loading
 * @returns {React.FC} - Wrapped component with loading state management
 */
const withLoading = (Component, options = {}) => {
  const {
    loadingKey,
    size = 'md',
    color = 'primary',
    overlay = false,
    message = 'Loading...',
    showContentWhileLoading = false,
  } = options;

  const displayName = Component.displayName || Component.name || 'Component';

  const WithLoadingComponent = (props) => {
    const { isLoading } = useLoading();
    const isComponentLoading = loadingKey ? isLoading(loadingKey) : false;

    // If loading and not showing content while loading, show spinner only
    if (isComponentLoading && !showContentWhileLoading) {
      return (
        <LoadingSpinner
          size={size}
          color={color}
          overlay={overlay}
          message={message}
        />
      );
    }

    // If loading and showing content while loading, show both
    if (isComponentLoading && showContentWhileLoading) {
      return (
        <div className="relative">
          {overlay ? null : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface bg-opacity-70 z-10">
              <LoadingSpinner
                size={size}
                color={color}
                message={message}
              />
            </div>
          )}
          <Component {...props} isLoading={isComponentLoading} />
          {overlay && (
            <LoadingSpinner
              size={size}
              color={color}
              overlay={true}
              message={message}
            />
          )}
        </div>
      );
    }

    // If not loading, render the component normally
    return <Component {...props} isLoading={isComponentLoading} />;
  };

  WithLoadingComponent.displayName = `withLoading(${displayName})`;

  return WithLoadingComponent;
};

/**
 * Creates a component that displays a loading spinner when a condition is met
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.size - Size of the loading spinner
 * @param {string} options.color - Color of the loading spinner
 * @param {boolean} options.overlay - Whether to show the spinner with a full-screen overlay
 * @param {string} options.message - Message to display with the spinner
 * @returns {React.FC} - Loading component
 * 
 * @example
 * const PageLoader = createLoadingComponent({
 *   size: 'lg',
 *   message: 'Loading page...',
 *   overlay: true
 * });
 * 
 * // In your component:
 * return isLoading ? <PageLoader /> : <YourComponent />;
 */
export const createLoadingComponent = (options = {}) => {
  const {
    size = 'md',
    color = 'primary',
    overlay = false,
    message = 'Loading...',
  } = options;

  const LoadingComponent = () => (
    <LoadingSpinner
      size={size}
      color={color}
      overlay={overlay}
      message={message}
    />
  );

  LoadingComponent.displayName = 'LoadingComponent';

  return LoadingComponent;
};

export default withLoading;