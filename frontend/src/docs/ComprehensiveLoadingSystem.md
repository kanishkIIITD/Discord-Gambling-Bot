# Comprehensive Loading State Management System

## Overview

This document provides a comprehensive guide to the loading state management system implemented in our application. The system integrates various loading patterns, error handling mechanisms, and UI components to create a seamless user experience during asynchronous operations.

## Core Components

### 1. LoadingContext

The foundation of our loading state management system is the `LoadingContext`, which provides a centralized store for managing loading states and errors across the application.

```jsx
// Usage example
import { LoadingProvider, useLoading } from '../contexts/LoadingContext';

// Wrap your application with the provider
<LoadingProvider>
  <App />
</LoadingProvider>

// Use the loading context in components
const { isLoading, startLoading, stopLoading, setError } = useLoading();
```

### 2. LoadingSpinner

A customizable loading indicator component that can be used standalone or integrated with other components.

```jsx
import { LoadingSpinner } from '../components/LoadingSpinner';

// Basic usage
<LoadingSpinner />

// Customized usage
<LoadingSpinner 
  size="lg" 
  color="#4F46E5" 
  overlay={true} 
  message="Loading data..." 
/>
```

### 3. LoadingToast

A toast notification component that integrates with LoadingContext to display non-blocking loading indicators.

```jsx
import { LoadingToast } from '../components/LoadingToast';

// Basic usage
<LoadingToast loadingKey="data.fetch" message="Loading data..." />

// Customized usage
<LoadingToast 
  loadingKey="user.update" 
  message="Updating user..." 
  size="md" 
  color="accent" 
  className="my-custom-toast"
/>
```

### 4. withLoading HOC

A higher-order component that integrates loading state management with any component.

```jsx
import { withLoading } from '../components/withLoading';

const MyComponentWithLoading = withLoading(MyComponent, {
  loadingKey: 'myComponentData',
  spinnerSize: 'md',
  spinnerColor: '#4F46E5',
  overlay: true,
  message: 'Loading component data...',
  showContentWhileLoading: false
});
```

### 5. SuspenseWithLoading

Integrates React Suspense with our loading state management system.

```jsx
import { SuspenseWithLoading } from '../components/SuspenseWithLoading';

<SuspenseWithLoading
  loadingKey="lazyComponentLoad"
  size="lg"
  overlay={true}
  message="Loading component..."
>
  <LazyLoadedComponent />
</SuspenseWithLoading>
```

### 6. LoadingRoute

Integrates React Router with our loading state management system.

```jsx
import { LoadingRoute } from '../components/LoadingRoute';

<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route 
    path="/profile" 
    element={
      <LoadingRoute 
        loadingKey="profileRoute"
        size="lg"
        overlay={true}
        message="Loading profile..."
      >
        <Profile />
      </LoadingRoute>
    } 
  />
</Routes>
```

## Data Fetching Hooks

### 1. useLoadingQuery

Integrates React Query's `useQuery` with our loading state management system.

```jsx
import { useLoadingQuery } from '../hooks/useLoadingQuery';

const { data, isLoading, error } = useLoadingQuery(
  'userData',
  fetchUserData,
  { staleTime: 60000 },
  'userDataLoading'
);
```

### 2. useLoadingMutation

Integrates React Query's `useMutation` with our loading state management system.

```jsx
import { useLoadingMutation } from '../hooks/useLoadingQuery';

const { mutate, isLoading } = useLoadingMutation(
  updateUserData,
  {
    onSuccess: (data) => {
      // Handle success
    },
    onError: (error) => {
      // Handle error
    }
  },
  'updateUserLoading'
);
```

### 3. useLoadingInfiniteQuery

Integrates React Query's `useInfiniteQuery` with our loading state management system.

```jsx
import { useLoadingInfiniteQuery } from '../hooks/useLoadingInfiniteQuery';

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  observerRef
} = useLoadingInfiniteQuery(
  'items',
  fetchItems,
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  },
  'itemsInitialLoad',
  'itemsNextPage'
);
```

### 4. useLoadingToast

Combines LoadingContext with toast notifications for a more integrated experience.

```jsx
import { useLoadingToast } from '../hooks/useLoadingToast';

const { withLoadingToast } = useLoadingToast();

// Execute an async function with loading state and toast notifications
const result = await withLoadingToast(
  'data.fetch',
  fetchData,
  {
    loading: 'Fetching data...',
    success: 'Data loaded successfully!',
    error: 'Failed to load data',
  }
);
```

## Advanced Patterns

### 1. Prefetching on Hover

Prefetches data when a user hovers over an element.

```jsx
import { usePrefetchOnHover } from '../hooks/usePrefetchOnHover';

const { prefetchProps, isPrefetching } = usePrefetchOnHover({
  queryKey: ['itemDetails', itemId],
  queryFn: () => fetchItemDetails(itemId),
  loadingKey: `prefetchItem_${itemId}`,
  hoverDelay: 300,
});

// Use in a component
<div {...prefetchProps}>
  {isPrefetching && <LoadingSpinner size="sm" />}
  Item {itemId}
</div>
```

### 2. Optimistic Updates

Performs optimistic updates with automatic rollback on error.

```jsx
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';

const updateItemMutation = useOptimisticMutation(
  (itemData) => updateItem(itemData),
  {
    queryKey: 'items',
    loadingKey: 'updateItem',
    onMutate: async (newItem) => {
      // Return context with previous data for potential rollback
      return { previousItems: [...] };
    },
    onError: (err, newItem, context) => {
      // Rollback to previous data on error
    },
    onSuccess: (result) => {
      // Handle successful update
    },
  }
);
```

### 3. Form Handling

Manages loading states during form submission.

```jsx
import { useLoadingForm } from '../hooks/useLoadingForm';

const {
  values,
  errors,
  touched,
  isSubmitting,
  handleChange,
  handleBlur,
  handleSubmit,
  getFieldProps,
} = useLoadingForm({
  initialValues: { name: '', email: '' },
  validate: (values) => {
    // Validation logic
    return errors;
  },
  onSubmit: async (values) => {
    // Submit form data
  },
  loadingKey: 'formSubmission',
});
```

### 4. WebSocket Integration

Manages loading states for WebSocket operations.

```jsx
import { useLoadingWebSocket } from '../hooks/useLoadingWebSocket';

const {
  socket,
  isConnected,
  isConnecting,
  connect,
  disconnect,
  sendMessage,
  lastMessage,
  error
} = useLoadingWebSocket({
  url: 'wss://example.com/socket',
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectInterval: 1000,
  loadingKeyPrefix: 'websocket',
});
```

### 5. Cache Invalidation

Manages loading states during cache invalidation operations.

```jsx
import { useLoadingInvalidation } from '../hooks/useLoadingInvalidation';

const { invalidateWithLoading, resetWithLoading } = useLoadingInvalidation();

// Invalidate a query with loading state
invalidateWithLoading('userData', 'invalidateUserData');

// Reset a query with loading state
resetWithLoading('userData', 'resetUserData');
```

### 6. Toast Integration

Integrates loading states with toast notifications for non-blocking feedback.

```jsx
import { useToast } from '../hooks/useToast';

const toast = useToast();

// Use promise with LoadingContext integration
toast.promise(
  fetchData(),
  {
    loading: 'Loading data...',
    success: 'Data loaded successfully!',
    error: 'Failed to load data',
  },
  {}, // Toast options
  'data.fetch' // Loading key
);

// Alternative approach with promiseWithLoading
const result = await toast.promiseWithLoading(
  () => fetchData(),
  {
    loading: 'Loading data...',
    success: 'Data loaded successfully!',
    error: 'Failed to load data',
  },
  {}, // Toast options
  'data.fetch' // Loading key
);
```

## Integration Example

The `ComprehensiveLoadingExample.jsx` component demonstrates how to integrate all these loading state management utilities in a complete application. It includes:

1. A dashboard with loading state management
2. A games list with infinite scrolling
3. Game details with prefetching on hover
4. Optimistic updates for placing bets
5. Form handling with loading states
6. Navigation with loading indicators
7. Toast notifications with loading states

```jsx
import { LoadingProvider } from '../contexts/LoadingContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { LoadingToast } from '../components/LoadingToast';
import { SuspenseWithLoading } from '../components/SuspenseWithLoading';
import { LoadingRoute, useLoadingNavigation } from '../components/LoadingRoute';
import { useLoadingQuery, useLoadingMutation } from '../hooks/useLoadingQuery';
import { useLoadingInfiniteQuery } from '../hooks/useLoadingInfiniteQuery';
import { usePrefetchOnHover } from '../hooks/usePrefetchOnHover';
import { useOptimisticMutation } from '../hooks/useOptimisticMutation';
import { useLoadingForm } from '../hooks/useLoadingForm';
import { useLoadingToast } from '../hooks/useLoadingToast';
import { useToast } from '../hooks/useToast';

// Wrap your application with the necessary providers
<QueryClientProvider client={queryClient}>
  <LoadingProvider>
    <Router>
      {/* Application components */}
    </Router>
  </LoadingProvider>
</QueryClientProvider>
```

## Best Practices

1. **Consistent Loading Keys**: Use descriptive and consistent loading keys across your application to make debugging easier.

2. **Component-Specific Loading States**: Use component-specific loading keys when the loading state only affects a single component.

3. **Global Loading States**: Use global loading keys for operations that affect multiple components or the entire application.

4. **Error Handling**: Always handle errors appropriately, either through the loading context or through React Query's error handling mechanisms.

5. **Loading UI Consistency**: Maintain consistent loading UI patterns across your application to provide a seamless user experience.

6. **Performance Optimization**: Use prefetching, caching, and optimistic updates to optimize the perceived performance of your application.

7. **Accessibility**: Ensure that loading indicators are accessible to all users, including those using screen readers.

8. **Toast vs. Spinner**: Use LoadingToast for non-blocking operations where the user can continue interacting with the UI, and LoadingSpinner for blocking operations that prevent user interaction until completion.

## Conclusion

This comprehensive loading state management system provides a flexible and powerful way to handle asynchronous operations in your React application. By integrating React Query, React Router, toast notifications, and custom hooks with a centralized loading context, you can create a seamless user experience with minimal boilerplate code.