import React, { Component } from 'react';

/**
 * ErrorBoundary component to catch JavaScript errors in child component tree
 * and display a fallback UI instead of crashing the whole app
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
    
    // If onError prop is provided, call it with the error details
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback({ error, errorInfo, resetError: this.resetError })
          : fallback;
      }

      // Default error UI
      return (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 my-4">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="mb-4">The application encountered an unexpected error.</p>
          
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
          
          <button
            onClick={this.resetError}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

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
 *   fallback: <p>Something went wrong with MyComponent</p>,
 *   onError: (error) => logErrorToService(error)
 * });
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`;
  
  return WrappedComponent;
};

export default ErrorBoundary;