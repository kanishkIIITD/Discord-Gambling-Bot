# Loading State Management System

## Overview

This document describes the loading state management system implemented in the application. The system provides a centralized way to manage loading states, errors, and retry logic across the application.

## Components

### LoadingContext

The `LoadingContext` provides a centralized way to manage loading states and errors across the application. It uses React's Context API and `useReducer` to maintain a global state of loading indicators and errors.

**Key features:**
- Track multiple loading states by key
- Store and retrieve error messages
- Utility functions for managing loading states
- Integration with async operations

**Usage:**

```jsx
import { useLoading } from '../contexts/LoadingContext';

function MyComponent() {
  const { 
    isLoading, 
    startLoading, 
    stopLoading, 
    setError, 
    getError, 
    withLoading 
  } = useLoading();

  // Check if a specific operation is loading
  const isUserLoading = isLoading('fetchUser');

  // Manually control loading state
  const handleClick = async () => {
    startLoading('fetchUser');
    try {
      const data = await fetchUserData();
      // Handle success
    } catch (error) {
      setError('fetchUser', error.message);
    } finally {
      stopLoading('fetchUser');
    }
  };

  // Use the withLoading utility
  const handleFetch = () => {
    withLoading('fetchUser', async () => {
      const data = await fetchUserData();
      return data;
    }, {
      onSuccess: (data) => {
        // Handle success
      },
      onError: (error) => {
        // Handle error
      }
    });
  };

  // Display error if present
  const userError = getError('fetchUser');

  return (
    <div>
      {isUserLoading && <LoadingSpinner />}
      {userError && <ErrorMessage message={userError} />}
      <button onClick={handleFetch}>Fetch User</button>
    </div>
  );
}
```

### LoadingSpinner

The `LoadingSpinner` component provides a reusable loading indicator with customizable size, color, and overlay options.

**Key features:**
- Multiple size options (sm, md, lg, xl)
- Multiple color options (primary, secondary, white)
- Optional overlay mode
- Optional loading message
- Integration with LoadingContext

**Usage:**

```jsx
import LoadingSpinner from '../components/LoadingSpinner';

// Basic usage
<LoadingSpinner />

// With custom size and color
<LoadingSpinner size="lg" color="secondary" />

// With overlay and message
<LoadingSpinner overlay={true} message="Loading data..." />

// With LoadingContext integration
<LoadingSpinner loadingKey="fetchUser" />
```

### withLoading HOC

The `withLoading` higher-order component wraps a component with loading state management, automatically showing a loading spinner when the specified loading key is active.

**Key features:**
- Automatically shows/hides loading spinner based on loading state
- Configurable spinner appearance
- Option to show content while loading
- Passes loading state to wrapped component

**Usage:**

```jsx
import withLoading from '../components/withLoading';

function UserProfile({ user }) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// Wrap component with loading state management
const UserProfileWithLoading = withLoading(UserProfile, {
  loadingKey: 'fetchUser',
  size: 'lg',
  message: 'Loading user profile...',
  overlay: true
});

// Use the wrapped component
function App() {
  return <UserProfileWithLoading user={user} />;
}
```

### useLoadingQuery and useLoadingMutation

These custom hooks integrate React Query with the LoadingContext, automatically managing loading states for queries and mutations.

**Key features:**
- Automatic loading state management for React Query
- Error handling integration
- Simplified API for common patterns

**Usage:**

```jsx
import { useLoadingQuery, useLoadingMutation } from '../hooks/useLoadingQuery';

function UserProfile() {
  // Query with loading state management
  const { data: user } = useLoadingQuery(
    'user',
    fetchUser,
    { staleTime: 5000 },
    'fetchUser' // Loading key
  );

  // Mutation with loading state management
  const { mutate: updateUser } = useLoadingMutation(
    updateUserData,
    {
      onSuccess: () => {
        // Handle success
      }
    },
    'updateUser' // Loading key
  );

  return (
    <div>
      {user && (
        <>
          <h1>{user.name}</h1>
          <button onClick={() => updateUser({ ...user, name: 'New Name' })}>
            Update Name
          </button>
        </>
      )}
    </div>
  );
}
```

## API Utils

The `apiUtils.js` module provides utilities for making API requests with retry logic, error handling, and loading state management.

**Key features:**
- Retry logic with exponential backoff
- Configurable retry conditions
- Enhanced API client with retry capabilities
- Prefetch function for data loading

**Usage:**

```js
import { withRetry, createApiClient, createPrefetchFn } from '../utils/apiUtils';

// Use withRetry for a single API call
const fetchData = async () => {
  return withRetry(
    () => axios.get('/api/data'),
    {
      maxRetries: 3,
      onRetry: ({ attempt }) => {
        console.log(`Retrying (${attempt})...`);
      }
    }
  );
};

// Create an API client with retry capabilities
const apiClient = createApiClient({
  baseURL: '/api',
  retryConfig: {
    maxRetries: 2,
    retryableErrors: [500, 502, 503, 504]
  }
});

// Use the API client
const fetchUsers = async () => {
  const response = await apiClient.get('/users');
  return response.data;
};

// Create a prefetch function
const prefetchUsers = createPrefetchFn(
  fetchUsers,
  (data) => console.log('Users loaded:', data),
  (error) => console.error('Failed to load users:', error)
);
```

## Error Handling

The system includes comprehensive error handling through the `ErrorBoundary` component and integration with the LoadingContext.

**Key features:**
- React error boundary for catching component errors
- Integration with loading state management
- Retry mechanism with exponential backoff
- Detailed error reporting

**Usage:**

```jsx
import { withErrorBoundary } from '../components/ErrorBoundary';

function MyComponent() {
  // Component implementation
}

// Wrap component with error boundary
const SafeComponent = withErrorBoundary(MyComponent, {
  componentName: 'MyComponent',
  enableAutoRetry: true,
  maxRetries: 3,
  onError: (error, errorInfo, context) => {
    console.error('Component error:', error, context);
  }
});
```

## Best Practices

1. **Use consistent loading keys**: Use descriptive and consistent keys for loading states to make them easier to track and debug.

2. **Prefer withLoading over manual management**: Use the `withLoading` utility function instead of manually managing loading states when possible.

3. **Integrate with React Query**: Use `useLoadingQuery` and `useLoadingMutation` to integrate with React Query for data fetching.

4. **Handle errors appropriately**: Always handle errors and display appropriate error messages to users.

5. **Use retry logic for network requests**: Use the retry utilities for network requests to handle transient failures.

6. **Provide feedback for long operations**: Always show loading indicators for operations that take longer than 300ms.

7. **Use error boundaries**: Wrap components with error boundaries to prevent the entire application from crashing due to component errors.