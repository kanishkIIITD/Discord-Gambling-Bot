import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

// Import components
import ErrorBoundary from './components/ErrorBoundary';
import LoadingDevToolsEnhanced from './components/LoadingDevToolsEnhanced';
// Note: LoadingProvider is no longer needed as we're using Zustand store

// We're using the QueryClient from index.js instead of creating a new one here

/**
 * LoadingSystemIntegration component
 * 
 * This component sets up the application with error boundaries and router.
 * Loading state management is now handled by the Zustand store (useUIStore)
 * instead of the previous LoadingContext provider.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {React.ReactElement} The wrapped application
 */
const LoadingSystemIntegration = ({ children }) => {
  return (
    <ErrorBoundary
      componentName="RootErrorBoundary"
      enableAutoRetry={true}
      maxRetries={3}
      retryDelay={1000}
      showReset={true}
      showRetry={true}
      fallback={({ error, resetErrorBoundary, retryErrorBoundary }) => (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Application Error</h2>
            <div className="bg-red-900/30 border border-red-700 rounded-md p-4 mb-6">
              <p className="text-red-400 font-medium">{error.message || 'An unexpected error occurred'}</p>
              {error.stack && (
                <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">
                  {error.stack}
                </pre>
              )}
            </div>
            <div className="flex space-x-4">
              <button
                onClick={resetErrorBoundary}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
              >
                Reset Application
              </button>
              <button
                onClick={retryErrorBoundary}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    >
      <Router>
        {children}
        
        {/* Development Tools */}
        {process.env.NODE_ENV !== 'production' && (
          <>
            <LoadingDevToolsEnhanced />
          </>
        )}
      </Router>
    </ErrorBoundary>
  );
};

export default LoadingSystemIntegration;

/**
 * Example usage in your main App.jsx or index.jsx:
 * 
 * import LoadingSystemIntegration from './LoadingSystemIntegration';
 * import AppRoutes from './routes';
 * import { QueryClientProvider } from '@tanstack/react-query';
 * import { queryClient } from './services/queryClient';
 * 
 * const App = () => {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       {/* Note: LoadingProvider is no longer needed as we're using Zustand store 
 *       <LoadingSystemIntegration>
 *         <AppRoutes />
 *       </LoadingSystemIntegration>
 *     </QueryClientProvider>
 *   );
 * };
 * 
 * export default App;
 */