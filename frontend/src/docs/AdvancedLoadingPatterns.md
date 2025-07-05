# Advanced Loading Patterns

This document describes advanced loading patterns and utilities available in the application for managing loading states, optimistic updates, and data prefetching.

## Table of Contents

1. [Prefetching on Hover](#prefetching-on-hover)
2. [Infinite Scrolling with Loading States](#infinite-scrolling-with-loading-states)
3. [Optimistic Updates](#optimistic-updates)
4. [Integration Examples](#integration-examples)

## Prefetching on Hover

The `usePrefetchOnHover` hook enables data prefetching when a user hovers over an element, improving perceived performance by loading data before it's needed.

### Basic Usage

```jsx
const { prefetchProps, isPrefetching, isPrefetched, prefetchNow } = usePrefetchOnHover({
  queryKey: 'userData',
  queryFn: fetchUserData,
  hoverDelay: 300, // ms
  loadingKey: 'prefetchUser'
});

// Apply the prefetch props to any element
return (
  <button {...prefetchProps} onClick={handleClick}>
    {isPrefetching ? 'Loading...' : 'View User'}
  </button>
);
```

### Multiple Queries

For prefetching multiple related queries at once, use `usePrefetchQueriesOnHover`:

```jsx
const { prefetchProps } = usePrefetchQueriesOnHover([
  {
    queryKey: 'userData',
    queryFn: fetchUserData
  },
  {
    queryKey: 'userTransactions',
    queryFn: fetchUserTransactions
  }
], { loadingKey: 'prefetchUserData' });
```

## Infinite Scrolling with Loading States

The `useLoadingInfiniteQuery` and `useInfiniteScroll` hooks provide infinite scrolling functionality with integrated loading states.

### Basic Infinite Query

```jsx
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  initialLoadingKey,
  nextPageLoadingKey
} = useLoadingInfiniteQuery(
  'items',
  fetchItems,
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor
  },
  'itemsInitialLoad',
  'itemsNextPage'
);
```

### Infinite Scroll with Intersection Observer

```jsx
const {
  data,
  hasNextPage,
  isFetchingNextPage,
  observerRef
} = useInfiniteScroll({
  queryKey: 'items',
  queryFn: fetchItems,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  threshold: 0.5 // Intersection observer threshold
});

// In your JSX:
return (
  <div>
    {data.pages.map(page => (
      page.items.map(item => <ItemComponent key={item.id} item={item} />)
    ))}
    
    {/* This element triggers loading when it becomes visible */}
    {hasNextPage && <div ref={observerRef}>Loading more...</div>}
  </div>
);
```

## Optimistic Updates

The `useOptimisticMutation` hook provides optimistic UI updates with automatic rollback on errors.

### Basic Optimistic Update

```jsx
const updateUser = useOptimisticMutation(
  (userData) => api.updateUser(userData),
  {
    queryKey: 'userData',
    loadingKey: 'updateUser',
    onMutate: async (newUserData) => {
      // Get current data for potential rollback
      const previousUserData = queryClient.getQueryData('userData');
      
      // Optimistically update the UI
      queryClient.setQueryData('userData', {
        ...previousUserData,
        ...newUserData
      });
      
      return { previousUserData };
    }
  }
);

// Use the mutation
updateUser.mutate({ name: 'New Name' });
```

### List Operations

For common list operations (add, update, remove), use `useOptimisticListMutation`:

```jsx
const {
  addItem,
  updateItem,
  removeItem
} = useOptimisticListMutation({
  queryKey: 'todos',
  mutationFn: (operation) => api.updateTodos(operation),
  getItemId: (item) => item.id
});

// Add an item
addItem.mutate(newTodo);

// Update an item
updateItem.mutate(updatedTodo);

// Remove an item
removeItem.mutate(todoToRemove);
```

## Integration Examples

See the `AdvancedLoadingExample.jsx` component for a complete example that demonstrates:

1. Basic data loading with `useLoadingQuery`
2. Prefetching data on hover with `usePrefetchOnHover`
3. Infinite scrolling with `useInfiniteScroll`
4. Optimistic updates with `useOptimisticMutation`
5. Integration with the `LoadingContext` for centralized loading state management

### Key Integration Points

```jsx
// Prefetch on hover and show details on click
<button
  {...prefetchProps}
  onClick={() => setShowDetails(!showDetails)}
>
  {isPrefetching ? 'Loading...' : 'Show Details'}
</button>

// Infinite scroll with loading indicator
{hasNextPage && (
  <div ref={observerRef} className="loading-trigger">
    {isFetchingNextPage ? <LoadingSpinner /> : 'Load more'}
  </div>
)}

// Optimistic update with loading state
<button
  onClick={handleUpdate}
  disabled={isLoading('updateProfile')}
>
  Update Profile
</button>
```

By combining these patterns, you can create a highly responsive UI that provides immediate feedback to users while handling data loading and updates efficiently.