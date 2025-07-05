import React, { useState, useEffect } from 'react';
import { useQueryClient } from 'react-query';
import { useLoading } from '../hooks/useLoading';

/**
 * LoadingDevTools component
 * Provides a development tool for monitoring loading states and errors
 * Only renders in development mode
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.initialOpen - Whether the devtools should be initially open
 * @param {string} props.position - Position of the devtools panel ('bottom-right', 'bottom-left', 'top-right', 'top-left')
 * @returns {React.ReactElement|null} - The devtools component or null in production
 */
const LoadingDevToolsContent = ({ initialOpen = false, position = 'bottom-right' }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [activeTab, setActiveTab] = useState('loading');
  const { loadingStates, errors } = useLoading();
  const queryClient = useQueryClient();
  const [queryCache, setQueryCache] = useState([]);

  // Position styles
  const positionStyles = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  // Update query cache state
  useEffect(() => {
    const updateQueryCache = () => {
      const queries = queryClient.getQueryCache().getAll();
      setQueryCache(queries.map(query => ({
        queryKey: JSON.stringify(query.queryKey),
        status: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        error: query.state.error,
        isFetching: query.state.isFetching,
      })));
    };

    // Initial update
    updateQueryCache();

    // Subscribe to query cache changes
    const unsubscribe = queryClient.getQueryCache().subscribe(updateQueryCache);

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  // Toggle devtools visibility
  const toggleDevTools = () => {
    setIsOpen(prev => !prev);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString();
  };

  // Render loading states tab
  const renderLoadingStates = () => {
    const loadingKeys = Object.keys(loadingStates);

    if (loadingKeys.length === 0) {
      return <p className="text-gray-500 italic">No active loading states</p>;
    }

    return (
      <div className="space-y-2">
        {loadingKeys.map(key => (
          <div 
            key={key} 
            className={`p-2 rounded ${loadingStates[key] ? 'bg-blue-100' : 'bg-gray-100'}`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{key}</span>
              <span 
                className={`px-2 py-1 text-xs rounded ${loadingStates[key] 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-300 text-gray-700'}`}
              >
                {loadingStates[key] ? 'LOADING' : 'IDLE'}
              </span>
            </div>
            {errors[key] && (
              <div className="mt-1 text-sm text-red-600">
                Error: {errors[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render query cache tab
  const renderQueryCache = () => {
    if (queryCache.length === 0) {
      return <p className="text-gray-500 italic">No queries in cache</p>;
    }

    return (
      <div className="space-y-2">
        {queryCache.map((query, index) => (
          <div 
            key={index} 
            className={`p-2 rounded ${query.isFetching 
              ? 'bg-blue-100' 
              : query.status === 'error' 
                ? 'bg-red-100' 
                : 'bg-gray-100'}`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium truncate max-w-[200px]">{query.queryKey}</span>
              <span 
                className={`px-2 py-1 text-xs rounded ${query.isFetching 
                  ? 'bg-blue-500 text-white' 
                  : query.status === 'error' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-green-500 text-white'}`}
              >
                {query.isFetching ? 'FETCHING' : query.status.toUpperCase()}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Updated: {formatTime(query.dataUpdatedAt)}
            </div>
            {query.error && (
              <div className="mt-1 text-sm text-red-600">
                Error: {query.error.message || 'Unknown error'}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Toggle button
  const toggleButton = (
    <button
      onClick={toggleDevTools}
      className={`fixed ${positionStyles[position]} z-50 p-2 rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700 focus:outline-none`}
      aria-label="Toggle Loading DevTools"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" 
        />
      </svg>
    </button>
  );

  // If closed, only render the toggle button
  if (!isOpen) {
    return toggleButton;
  }

  // Full devtools panel
  return (
    <>
      {toggleButton}
      <div 
        className={`fixed ${positionStyles[position]} z-40 w-80 bg-white rounded-lg shadow-xl border border-gray-200 transform translate-y-[-60px] mr-16`}
      >
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium ${activeTab === 'loading' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('loading')}
          >
            Loading States
          </button>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium ${activeTab === 'queries' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('queries')}
          >
            Query Cache
          </button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          {activeTab === 'loading' ? renderLoadingStates() : renderQueryCache()}
        </div>
      </div>
    </>
  );
};

const LoadingDevTools = (props) => {
  // Only render in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return <LoadingDevToolsContent {...props} />;
};

export default LoadingDevTools;