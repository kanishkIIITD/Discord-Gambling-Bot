import React, { useState } from 'react';
import { useLoading } from '../../hooks/useLoading';
import { useLoadingQuery, useLoadingMutation } from '../../hooks/useLoadingQuery';
import LoadingSpinner from '../LoadingSpinner';
import withLoading from '../withLoading';
import { withErrorBoundary } from '../ErrorBoundary';

/**
 * Example component demonstrating various loading state patterns
 */
const LoadingExample = () => {
  const [userId, setUserId] = useState(1);
  const { withLoading, isLoading, getError } = useLoading();

  // Example of using useLoadingQuery
  const { data: userData, refetch: refetchUser } = useLoadingQuery(
    ['user', userId],
    async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { id: userId, name: `User ${userId}`, email: `user${userId}@example.com` };
    },
    {
      staleTime: 5000,
      enabled: !!userId,
    },
    'fetchUser' // Loading key
  );

  // Example of using useLoadingMutation
  const { mutate: updateUser } = useLoadingMutation(
    async (userData) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { ...userData, updatedAt: new Date().toISOString() };
    },
    {
      onSuccess: (data) => {
        // console.log('User updated:', data);
      },
    },
    'updateUser' // Loading key
  );

  // Example of using withLoading directly
  const handleManualLoading = () => {
    withLoading('manualOperation', async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return 'Operation completed';
    }, {
      onSuccess: (result) => {
        // console.log(result);
      },
      onError: (error) => {
        console.error('Operation failed:', error);
      }
    });
  };

  // Example of triggering an error
  const handleErrorExample = () => {
    withLoading('errorOperation', async () => {
      await new Promise((_, reject) => setTimeout(() => reject(new Error('Example error')), 1000));
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Loading State Examples</h1>
      
      {/* React Query with LoadingContext integration */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">React Query Integration</h2>
        <div className="flex items-center space-x-4 mb-4">
          <button 
            onClick={() => setUserId(prev => Math.max(1, prev - 1))}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Previous User
          </button>
          <button 
            onClick={() => setUserId(prev => prev + 1)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Next User
          </button>
          <button 
            onClick={() => refetchUser()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refetch User
          </button>
        </div>
        
        <div className="p-4 border rounded-lg relative min-h-[100px]">
          {isLoading('fetchUser') ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner size="md" message="Loading user data..." />
            </div>
          ) : (
            userData && (
              <div>
                <h3 className="font-medium">{userData.name}</h3>
                <p className="text-gray-600">{userData.email}</p>
              </div>
            )
          )}
        </div>
      </section>
      
      {/* Mutation example */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Mutation Example</h2>
        <button 
          onClick={() => userData && updateUser(userData)}
          disabled={!userData || isLoading('updateUser')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading('updateUser') ? (
            <span className="flex items-center">
              <LoadingSpinner size="sm" color="white" className="mr-2" />
              Updating...
            </span>
          ) : (
            'Update User'
          )}
        </button>
      </section>
      
      {/* Manual loading example */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Manual Loading Example</h2>
        <button 
          onClick={handleManualLoading}
          disabled={isLoading('manualOperation')}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading('manualOperation') ? (
            <span className="flex items-center">
              <LoadingSpinner size="sm" color="white" className="mr-2" />
              Processing...
            </span>
          ) : (
            'Start Operation'
          )}
        </button>
      </section>
      
      {/* Error handling example */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Error Handling Example</h2>
        <button 
          onClick={handleErrorExample}
          disabled={isLoading('errorOperation')}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Trigger Error
        </button>
        
        {getError('errorOperation') && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
            Error: {getError('errorOperation')}
          </div>
        )}
      </section>
    </div>
  );
};

// Example of using withLoading HOC
const LoadingExampleWithLoading = withLoading(LoadingExample, {
  loadingKey: 'loadingExample',
  overlay: true,
  message: 'Loading example component...',
});

// Example of combining withErrorBoundary and withLoading
const EnhancedLoadingExample = withErrorBoundary(LoadingExampleWithLoading, {
  componentName: 'LoadingExample',
  enableAutoRetry: true,
  maxRetries: 3,
  onError: (error, errorInfo, context) => {
    console.error('LoadingExample error:', error, context);
  }
});

export default EnhancedLoadingExample;