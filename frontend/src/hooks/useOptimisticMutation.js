import { useMutation, useQueryClient } from 'react-query';
import { useLoading } from './useLoading';

/**
 * Custom hook for optimistic mutations with loading state management
 * 
 * @param {Function} mutationFn - The mutation function to execute
 * @param {Object} options - Configuration options
 * @param {string|Array} options.queryKey - The query key to invalidate after mutation
 * @param {Function} options.onMutate - Function to run before mutation, returns context for rollback
 * @param {Function} options.onSuccess - Function to run on successful mutation
 * @param {Function} options.onError - Function to run on mutation error
 * @param {Function} options.onSettled - Function to run after mutation regardless of outcome
 * @param {string} options.loadingKey - Loading key for the mutation operation
 * @returns {Object} - The result of useMutation with additional loading state methods
 */
export const useOptimisticMutation = (mutationFn, options = {}) => {
  const {
    queryKey,
    onMutate: userOnMutate,
    onSuccess: userOnSuccess,
    onError: userOnError,
    onSettled: userOnSettled,
    loadingKey = 'optimisticMutation',
    ...mutationOptions
  } = options;

  const queryClient = useQueryClient();
  const { startLoading, stopLoading, setError, clearError } = useLoading();

  // Enhanced onMutate function with optimistic update
  const onMutate = async (variables) => {
    // Start loading state
    startLoading(loadingKey);
    clearError(loadingKey);

    // Cancel any outgoing refetches to avoid overwriting optimistic update
    if (queryKey) {
      await queryClient.cancelQueries(queryKey);
    }

    // Save previous data for rollback
    let previousData;
    if (queryKey) {
      previousData = queryClient.getQueryData(queryKey);
    }

    // Run user's onMutate function if provided
    let context = { previousData };
    if (userOnMutate) {
      const userContext = await userOnMutate(variables);
      context = { ...context, ...userContext };
    }

    return context;
  };

  // Enhanced onSuccess function
  const onSuccess = async (data, variables, context) => {
    // Run user's onSuccess function if provided
    if (userOnSuccess) {
      await userOnSuccess(data, variables, context);
    }

    // Invalidate related queries to refetch fresh data
    if (queryKey) {
      queryClient.invalidateQueries(queryKey);
    }

    // Stop loading state
    stopLoading(loadingKey);
  };

  // Enhanced onError function with rollback
  const onError = (error, variables, context) => {
    // If we have previous data, roll back to it
    if (queryKey && context?.previousData !== undefined) {
      queryClient.setQueryData(queryKey, context.previousData);
    }

    // Set error in loading context
    setError(loadingKey, error.message || 'Mutation failed');

    // Run user's onError function if provided
    if (userOnError) {
      userOnError(error, variables, context);
    }

    // Stop loading state
    stopLoading(loadingKey);
  };

  // Enhanced onSettled function
  const onSettled = (data, error, variables, context) => {
    // Run user's onSettled function if provided
    if (userOnSettled) {
      userOnSettled(data, error, variables, context);
    }

    // Ensure loading state is stopped
    stopLoading(loadingKey);
  };

  // Use React Query's useMutation with enhanced callbacks
  return useMutation(mutationFn, {
    onMutate,
    onSuccess,
    onError,
    onSettled,
    ...mutationOptions,
  });
};

/**
 * Custom hook for optimistic list mutations with loading state management
 * Handles common list operations like add, update, and remove
 * 
 * @param {Object} options - Configuration options
 * @param {string|Array} options.queryKey - The query key for the list
 * @param {Function} options.mutationFn - The mutation function to execute
 * @param {Function} options.getItemId - Function to get the unique ID from an item
 * @param {string} options.loadingKey - Loading key for the mutation operation
 * @returns {Object} - Methods for optimistic list operations
 */
export const useOptimisticListMutation = (options = {}) => {
  const {
    queryKey,
    mutationFn,
    getItemId = (item) => item.id,
    loadingKey = 'optimisticListMutation',
  } = options;

  const queryClient = useQueryClient();

  // Add item to list
  const addItem = useOptimisticMutation(
    (newItem) => mutationFn({ type: 'add', item: newItem }),
    {
      queryKey,
      loadingKey: `${loadingKey}_add`,
      onMutate: async (newItem) => {
        // Get current data
        const previousData = queryClient.getQueryData(queryKey);

        // Optimistically update the list
        if (previousData) {
          queryClient.setQueryData(queryKey, [...previousData, newItem]);
        }

        return { previousData };
      },
    }
  );

  // Update item in list
  const updateItem = useOptimisticMutation(
    (updatedItem) => mutationFn({ type: 'update', item: updatedItem }),
    {
      queryKey,
      loadingKey: `${loadingKey}_update`,
      onMutate: async (updatedItem) => {
        // Get current data
        const previousData = queryClient.getQueryData(queryKey);

        // Optimistically update the list
        if (previousData) {
          const updatedData = previousData.map((item) =>
            getItemId(item) === getItemId(updatedItem) ? updatedItem : item
          );
          queryClient.setQueryData(queryKey, updatedData);
        }

        return { previousData };
      },
    }
  );

  // Remove item from list
  const removeItem = useOptimisticMutation(
    (itemToRemove) => mutationFn({ type: 'remove', item: itemToRemove }),
    {
      queryKey,
      loadingKey: `${loadingKey}_remove`,
      onMutate: async (itemToRemove) => {
        // Get current data
        const previousData = queryClient.getQueryData(queryKey);

        // Optimistically update the list
        if (previousData) {
          const updatedData = previousData.filter(
            (item) => getItemId(item) !== getItemId(itemToRemove)
          );
          queryClient.setQueryData(queryKey, updatedData);
        }

        return { previousData };
      },
    }
  );

  return {
    addItem,
    updateItem,
    removeItem,
  };
};