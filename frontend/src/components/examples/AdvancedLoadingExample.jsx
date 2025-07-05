import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useLoading } from '../../hooks/useLoading';
import { LoadingSpinner } from '../LoadingSpinner';
import { withLoading } from '../withLoading';
import { useLoadingQuery, useLoadingMutation } from '../../hooks/useLoadingQuery';
import { usePrefetchOnHover } from '../../hooks/usePrefetchOnHover';
import { useOptimisticMutation } from '../../hooks/useOptimisticMutation';
import { useInfiniteScroll } from '../../hooks/useLoadingInfiniteQuery';

// Mock API functions
const fetchUserData = async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { id: 1, name: 'John Doe', balance: 1000 };
};

const fetchUserTransactions = async ({ pageParam = 0 }) => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const items = Array.from({ length: 10 }, (_, i) => ({
    id: pageParam * 10 + i + 1,
    amount: Math.floor(Math.random() * 1000),
    date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
    type: Math.random() > 0.5 ? 'deposit' : 'withdrawal'
  }));
  
  return {
    items,
    nextPage: pageParam + 1,
    hasMore: pageParam < 3 // Limit to 4 pages for demo
  };
};

const updateUserProfile = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { ...data, updatedAt: new Date().toISOString() };
};

// Component with loading spinner
const UserProfile = withLoading(({ userData }) => {
  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-md">
      <h3 className="text-xl font-bold text-white mb-2">{userData.name}</h3>
      <p className="text-green-400 font-semibold">Balance: ${userData.balance}</p>
      {userData.updatedAt && (
        <p className="text-xs text-gray-400 mt-2">Last updated: {new Date(userData.updatedAt).toLocaleString()}</p>
      )}
    </div>
  );
}, { size: 'md', overlay: false, message: 'Loading profile...' });

// Transaction item component
const TransactionItem = ({ transaction }) => {
  const isDeposit = transaction.type === 'deposit';
  
  return (
    <div className="p-3 border-b border-gray-700 flex justify-between items-center">
      <div>
        <p className="text-sm font-medium">
          {isDeposit ? 'Deposit' : 'Withdrawal'}
        </p>
        <p className="text-xs text-gray-400">
          {new Date(transaction.date).toLocaleString()}
        </p>
      </div>
      <p className={`font-bold ${isDeposit ? 'text-green-500' : 'text-red-500'}`}>
        {isDeposit ? '+' : '-'}${transaction.amount}
      </p>
    </div>
  );
};

// Main example component
const AdvancedLoadingExample = () => {
  const [showDetails, setShowDetails] = useState(false);
  const { isLoading, isAnyLoading } = useLoading();
  const queryClient = useQueryClient();
  
  // Basic user data query with loading state
  const { data: userData } = useLoadingQuery(
    'userData',
    fetchUserData,
    { staleTime: 30000 },
    'userDataLoading'
  );
  
  // Prefetch transactions on hover
  const { prefetchProps, isPrefetching, isPrefetched } = usePrefetchOnHover({
    queryKey: ['transactions', 0],
    queryFn: () => fetchUserTransactions({ pageParam: 0 }),
    loadingKey: 'prefetchTransactions',
    hoverDelay: 500
  });
  
  // Infinite scroll for transactions
  const {
    data: transactionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    observerRef
  } = useInfiniteScroll({
    queryKey: 'transactions',
    queryFn: fetchUserTransactions,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    enabled: showDetails,
    initialLoadingKey: 'transactionsInitialLoad',
    nextPageLoadingKey: 'transactionsNextPage'
  });
  
  // Optimistic update mutation
  const updateProfile = useOptimisticMutation(updateUserProfile, {
    queryKey: 'userData',
    loadingKey: 'updateProfile',
    onMutate: async (newUserData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries('userData');
      
      // Snapshot the previous value
      const previousUserData = queryClient.getQueryData('userData');
      
      // Optimistically update to the new value
      queryClient.setQueryData('userData', {
        ...previousUserData,
        ...newUserData,
      });
      
      return { previousUserData };
    },
    onError: (err, newUserData, context) => {
      // If there was an error, roll back to the previous value
      queryClient.setQueryData('userData', context.previousUserData);
    }
  });
  
  // Handle profile update
  const handleUpdateName = () => {
    if (!userData) return;
    
    const newName = prompt('Enter new name:', userData.name);
    if (newName && newName !== userData.name) {
      updateProfile.mutate({ ...userData, name: newName });
    }
  };
  
  // Handle balance update
  const handleUpdateBalance = (amount) => {
    if (!userData) return;
    
    updateProfile.mutate({
      ...userData,
      balance: userData.balance + amount
    });
  };
  
  return (
    <div className="max-w-md mx-auto bg-gray-900 text-white p-6 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">User Dashboard</h2>
        {isAnyLoading() && (
          <div className="text-xs text-gray-400 flex items-center">
            <LoadingSpinner size="sm" color="#9CA3AF" />
            <span className="ml-2">Loading...</span>
          </div>
        )}
      </div>
      
      {/* User profile section */}
      {userData && (
        <UserProfile userData={userData} isLoading={isLoading('updateProfile')} />
      )}
      
      {/* Action buttons */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleUpdateName}
          disabled={isLoading('updateProfile')}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg disabled:opacity-50"
        >
          Update Name
        </button>
        
        <button
          onClick={() => handleUpdateBalance(100)}
          disabled={isLoading('updateProfile')}
          className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg disabled:opacity-50"
        >
          Add $100
        </button>
      </div>
      
      {/* Transactions section with prefetch on hover */}
      <div className="mt-8">
        <button
          {...prefetchProps}
          onClick={() => setShowDetails(!showDetails)}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 px-4 rounded-lg flex justify-between items-center"
        >
          <span>Transaction History</span>
          <div className="flex items-center">
            {isPrefetching && <LoadingSpinner size="sm" color="#9CA3AF" />}
            <span className="ml-2">{showDetails ? '▲' : '▼'}</span>
          </div>
        </button>
        
        {/* Prefetch status indicator */}
        {!showDetails && isPrefetched && (
          <p className="text-xs text-gray-500 mt-1">Data prefetched and ready</p>
        )}
        
        {/* Transactions list with infinite scroll */}
        {showDetails && transactionsData && (
          <div className="mt-2 bg-gray-800 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            {transactionsData.pages.map((page) =>
              page.items.map((transaction) => (
                <TransactionItem key={transaction.id} transaction={transaction} />
              ))
            )}
            
            {/* Loading indicator for next page */}
            {hasNextPage && (
              <div
                ref={observerRef}
                className="p-4 flex justify-center"
              >
                {isFetchingNextPage ? (
                  <LoadingSpinner size="sm" color="#9CA3AF" />
                ) : (
                  <button
                    onClick={() => fetchNextPage()}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
            
            {/* End of list message */}
            {!hasNextPage && (
              <p className="p-4 text-center text-sm text-gray-500">
                No more transactions
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Global loading state debug info */}
      <div className="mt-8 pt-4 border-t border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Loading States:</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>User Data: {isLoading('userDataLoading') ? '🔄' : '✓'}</p>
          <p>Prefetch: {isLoading('prefetchTransactions') ? '🔄' : (isPrefetched ? '✓' : '-')}</p>
          <p>Transactions Initial: {isLoading('transactionsInitialLoad') ? '🔄' : (showDetails ? '✓' : '-')}</p>
          <p>Transactions Next Page: {isLoading('transactionsNextPage') ? '🔄' : '-'}</p>
          <p>Profile Update: {isLoading('updateProfile') ? '🔄' : '-'}</p>
        </div>
      </div>
    </div>
  );
};

export default AdvancedLoadingExample;