import React, { Component } from 'react';

/**
 * ErrorBoundary component to catch JavaScript errors in child component tree
 * and display a fallback UI instead of crashing the whole app.
 * 
 * Enhanced with:
 * - Improved error reporting
 * - Retry mechanism
 * - Component-specific error handling
 * - Error logging capabilities
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ errorInfo });
    
    // Capture component stack and additional context
    const errorContext = {
      componentStack: errorInfo?.componentStack,
      location: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      componentName: this.props.componentName || 'Unknown',
      additionalInfo: this.props.additionalInfo || {}
    };
    
    // If onError prop is provided, call it with the error details and context
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorContext);
    }
    
    // Log to a centralized error logging service if configured
    if (this.props.errorLogger) {
      this.props.errorLogger(error, errorContext);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // Call onReset callback if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
    
    // Attempt to recover by refreshing data if needed
    if (this.props.refreshData) {
      this.props.refreshData();
    }
  };
  
  // Retry with exponential backoff
  retryWithBackoff = (retryCount = 0) => {
    const maxRetries = this.props.maxRetries || 3;
    const baseDelay = this.props.baseRetryDelay || 1000;
    
    if (retryCount >= maxRetries) {
      // Max retries reached, stay in error state
      return;
    }
    
    // Calculate delay with exponential backoff and jitter
    const delay = Math.min(
      30000, // max 30 seconds
      baseDelay * Math.pow(2, retryCount) * (0.5 + Math.random() * 0.5)
    );
    
    // Notify about retry attempt
    if (this.props.onRetry) {
      this.props.onRetry({
        error: this.state.error,
        retryCount,
        delay,
        maxRetries
      });
    }
    
    // Schedule retry
    setTimeout(() => {
      this.resetError();
    }, delay);
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { 
      fallback, 
      children,
      showReset = true,
      showRetry = true,
      componentName,
      enableAutoRetry = false
    } = this.props;

    // If error occurs and auto-retry is enabled, attempt to recover automatically
    if (hasError && enableAutoRetry && !this._autoRetryAttempted) {
      this._autoRetryAttempted = true;
      this.retryWithBackoff(0);
    }

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback({ 
              error, 
              errorInfo, 
              resetError: this.resetError,
              retryWithBackoff: this.retryWithBackoff,
              componentName
            })
          : fallback;
      }

      // Default error UI
      return (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 my-4">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="mb-4">
            {componentName 
              ? `The ${componentName} component encountered an error.` 
              : "The application encountered an unexpected error."}
          </p>
          
          {/* Show error details in development */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-2">
              <details className="whitespace-pre-wrap text-sm">
                <summary className="cursor-pointer font-medium mb-2">Error details</summary>
                <p className="mt-2 font-mono bg-red-100 p-2 rounded overflow-auto">
                  {error?.toString()}
                </p>
                {errorInfo && (
                  <p className="mt-2 font-mono bg-red-100 p-2 rounded overflow-auto max-h-48">
                    {errorInfo.componentStack}
                  </p>
                )}
              </details>
            </div>
          )}
          
          <div className="mt-4 flex space-x-3">
            {showReset && (
              <button
                onClick={this.resetError}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Try again
              </button>
            )}
            
            {showRetry && (
              <button
                onClick={() => this.retryWithBackoff(0)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry with backoff
              </button>
            )}
          </div>
        </div>
      );
    }

    // Reset auto-retry flag when component renders successfully
    this._autoRetryAttempted = false;

    // When there's no error, render children normally
    return children;
  }
}

/**
 * Higher-order component that wraps a component with an ErrorBoundary
 * 
 * @param {React.ComponentType} Component - The component to wrap
 * @param {Object} errorBoundaryProps - Props to pass to the ErrorBoundary
 * @returns {React.FC} - Wrapped component with error handling
 * 
 * @example
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   componentName: 'MyComponent',
 *   fallback: <p>Something went wrong with MyComponent</p>,
 *   onError: (error, errorInfo, context) => logErrorToService(error, context),
 *   enableAutoRetry: true,
 *   maxRetries: 3
 * });
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const displayName = Component.displayName || Component.name || 'Component';
  
  // Automatically set componentName if not provided
  const enhancedProps = {
    ...errorBoundaryProps,
    componentName: errorBoundaryProps.componentName || displayName
  };
  
  const WrappedComponent = (props) => (
    <ErrorBoundary {...enhancedProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`;
  
  return WrappedComponent;
};

/**
 * Creates a component-specific error boundary
 * 
 * @param {Object} options - Configuration options
 * @returns {React.ComponentType} - Configured ErrorBoundary component
 * 
 * @example
 * const DashboardErrorBoundary = createErrorBoundary({
 *   componentName: 'Dashboard',
 *   enableAutoRetry: true,
 *   fallback: ({ resetError }) => (
 *     <div>
 *       <h2>Dashboard Error</h2>
 *       <button onClick={resetError}>Reload Dashboard</button>
 *     </div>
 *   )
 * });
 */
export const createErrorBoundary = (options = {}) => {
  return (props) => <ErrorBoundary {...options} {...props} />;
};

export default ErrorBoundary;