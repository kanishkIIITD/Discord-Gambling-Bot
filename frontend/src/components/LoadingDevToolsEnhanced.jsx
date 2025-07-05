import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

// Import loading hook from Zustand store
import { useLoading } from '../hooks/useLoading';

/**
 * Enhanced development tools for monitoring loading states and React Query cache
 * Only renders in development mode
 */
const LoadingDevToolsEnhancedContent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('loading');
  const [expandedQueries, setExpandedQueries] = useState({});
  const [expandedLoadingKeys, setExpandedLoadingKeys] = useState({});
  const [filter, setFilter] = useState('');
  const [queryFilter, setQueryFilter] = useState('');
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Get loading state from context
  const { loadingStates: loadingState, errors: errorState, startLoading, stopLoading, setError } = useLoading();
  
  // Get query client for accessing React Query cache
  const queryClient = useQueryClient();
  
  // Get all queries from React Query cache
  const queries = queryClient.getQueryCache().getAll();

  // Filter loading keys based on search input
  const filteredLoadingKeys = Object.keys(loadingState)
    .filter(key => loadingState[key] && key.toLowerCase().includes(filter.toLowerCase()))
    .sort();

  // Filter error keys based on search input
  const filteredErrorKeys = Object.keys(errorState)
    .filter(key => errorState[key] && key.toLowerCase().includes(filter.toLowerCase()))
    .sort();

  // Filter queries based on search input
  const filteredQueries = queries
    .filter(query => {
      const queryKeyString = JSON.stringify(query.queryKey);
      return queryKeyString.toLowerCase().includes(queryFilter.toLowerCase());
    })
    .sort((a, b) => {
      // Sort by status (loading first, then error, then success)
      if (a.state.status !== b.state.status) {
        if (a.state.status === 'loading') return -1;
        if (b.state.status === 'loading') return 1;
        if (a.state.status === 'error') return -1;
        if (b.state.status === 'error') return 1;
      }
      // Then sort by query key
      return JSON.stringify(a.queryKey).localeCompare(JSON.stringify(b.queryKey));
    });

  // Handle mouse down for dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  // Handle mouse up for dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Toggle expanded state for a query
  const toggleQueryExpanded = (queryHash) => {
    setExpandedQueries(prev => ({
      ...prev,
      [queryHash]: !prev[queryHash]
    }));
  };

  // Toggle expanded state for a loading key
  const toggleLoadingKeyExpanded = (key) => {
    setExpandedLoadingKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Format data for display
  const formatData = (data) => {
    if (data === undefined) return 'undefined';
    if (data === null) return 'null';
    if (typeof data === 'function') return 'function() {...}';
    if (typeof data === 'object') {
      try {
        return JSON.stringify(data, null, 2);
      } catch (e) {
        return 'Error formatting data';
      }
    }
    return String(data);
  };

  // Render query status badge
  const renderStatusBadge = (status) => {
    const statusColors = {
      loading: 'bg-blue-500',
      error: 'bg-red-500',
      success: 'bg-green-500',
      idle: 'bg-gray-500'
    };

    return (
      <span className={`${statusColors[status]} text-white text-xs px-2 py-1 rounded-full`}>
        {status}
      </span>
    );
  };

  // Create test loading state
  const createTestLoading = useCallback(() => {
    const testKey = `test_${Date.now()}`;
    startLoading(testKey);
    setTimeout(() => {
      stopLoading(testKey);
    }, 3000);
  }, [startLoading, stopLoading]);

  // Create test error
  const createTestError = useCallback(() => {
    const testKey = `test_error_${Date.now()}`;
    setError(testKey, new Error('Test error'));
  }, [setError]);

  // Render loading state tab
  const renderLoadingTab = () => (
    <div className="p-4">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter loading keys..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md bg-gray-800 text-white"
        />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2 text-white">Active Loading States ({filteredLoadingKeys.length})</h3>
        {filteredLoadingKeys.length > 0 ? (
          <div className="space-y-2">
            {filteredLoadingKeys.map(key => (
              <div key={key} className="bg-gray-700 p-3 rounded-md">
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => toggleLoadingKeyExpanded(key)}
                >
                  <span className="text-white font-medium">{key}</span>
                  <span className="text-xs text-blue-400">
                    {expandedLoadingKeys[key] ? '▼' : '▶'}
                  </span>
                </div>
                
                {expandedLoadingKeys[key] && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-gray-300 text-sm">
                      <p>Started: {new Date(loadingState[key]).toLocaleTimeString()}</p>
                      <p>Duration: {Math.round((Date.now() - loadingState[key]) / 1000)}s</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No active loading states</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-white">Active Errors ({filteredErrorKeys.length})</h3>
        {filteredErrorKeys.length > 0 ? (
          <div className="space-y-2">
            {filteredErrorKeys.map(key => (
              <div key={key} className="bg-gray-700 p-3 rounded-md">
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => toggleLoadingKeyExpanded(`error_${key}`)}
                >
                  <span className="text-white font-medium">{key}</span>
                  <span className="text-xs text-red-400">
                    {expandedLoadingKeys[`error_${key}`] ? '▼' : '▶'}
                  </span>
                </div>
                
                {expandedLoadingKeys[`error_${key}`] && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-gray-300 text-sm">
                      <p className="text-red-400 font-medium">Error:</p>
                      <pre className="bg-gray-800 p-2 rounded-md overflow-x-auto text-xs mt-1">
                        {formatData(errorState[key])}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No active errors</p>
        )}
      </div>
    </div>
  );

  // Render query cache tab
  const renderQueryCacheTab = () => (
    <div className="p-4">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter queries..."
          value={queryFilter}
          onChange={(e) => setQueryFilter(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md bg-gray-800 text-white"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-white">Queries ({filteredQueries.length})</h3>
        {filteredQueries.length > 0 ? (
          <div className="space-y-2">
            {filteredQueries.map(query => (
              <div key={query.queryHash} className="bg-gray-700 p-3 rounded-md">
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => toggleQueryExpanded(query.queryHash)}
                >
                  <div className="flex items-center">
                    <span className="text-white font-medium mr-2">
                      {JSON.stringify(query.queryKey)}
                    </span>
                    {renderStatusBadge(query.state.status)}
                  </div>
                  <span className="text-xs text-blue-400">
                    {expandedQueries[query.queryHash] ? '▼' : '▶'}
                  </span>
                </div>
                
                {expandedQueries[query.queryHash] && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-gray-300 text-sm space-y-2">
                      <p>Status: {query.state.status}</p>
                      <p>Last Updated: {new Date(query.state.dataUpdatedAt).toLocaleTimeString()}</p>
                      <p>Stale: {query.state.isStale ? 'Yes' : 'No'}</p>
                      <p>Fetching: {query.state.isFetching ? 'Yes' : 'No'}</p>
                      
                      {query.state.error && (
                        <div>
                          <p className="text-red-400 font-medium">Error:</p>
                          <pre className="bg-gray-800 p-2 rounded-md overflow-x-auto text-xs mt-1">
                            {formatData(query.state.error)}
                          </pre>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-blue-400 font-medium">Data:</p>
                        <pre className="bg-gray-800 p-2 rounded-md overflow-x-auto text-xs mt-1">
                          {formatData(query.state.data)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No queries found</p>
        )}
      </div>
    </div>
  );

  // Render actions tab
  const renderActionsTab = () => (
    <div className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-white">Query Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => queryClient.invalidateQueries()}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
            >
              Invalidate All
            </button>
            <button
              onClick={() => queryClient.resetQueries()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-md"
            >
              Reset All
            </button>
            <button
              onClick={() => queryClient.refetchQueries()}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md"
            >
              Refetch All
            </button>
            <button
              onClick={() => queryClient.clear()}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md"
            >
              Clear Cache
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2 text-white">Loading Context Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={createTestLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md"
            >
              Create Test Loading
            </button>
            <button
              onClick={createTestError}
              className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-md"
            >
              Create Test Error
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 9999,
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden"
          >
            <div 
              className="bg-gray-800 p-3 flex justify-between items-center cursor-move"
              onMouseDown={handleMouseDown}
            >
              <h2 className="text-white font-bold">Loading DevTools</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="flex border-b border-gray-700">
              <button
                className={`px-4 py-2 ${activeTab === 'loading' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('loading')}
              >
                Loading
              </button>
              <button
                className={`px-4 py-2 ${activeTab === 'queries' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('queries')}
              >
                Queries
              </button>
              <button
                className={`px-4 py-2 ${activeTab === 'actions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setActiveTab('actions')}
              >
                Actions
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'loading' && renderLoadingTab()}
              {activeTab === 'queries' && renderQueryCacheTab()}
              {activeTab === 'actions' && renderActionsTab()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      )}
    </div>
  );
};

const LoadingDevToolsEnhanced = () => {
  // Only render in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return <LoadingDevToolsEnhancedContent />;
};

export default LoadingDevToolsEnhanced;