# Zustand State Management

## Overview

This directory contains Zustand stores that provide a more robust state management solution for the application. Zustand is a small, fast, and scalable state management library that uses hooks for accessing state. We've migrated from React Context API to Zustand for better performance, simpler usage patterns, and improved developer experience.

## Store Structure

The state management is organized into multiple store slices:

- **useUserStore**: Manages user authentication state
- **useWalletStore**: Manages wallet balance and transactions
- **useGuildStore**: Manages guild selection and related data
- **useUIStore**: Manages UI-related state like theme, animations, and loading states

## Migration Guide

### Installation

First, install Zustand:

```bash
npm install zustand
```

or

```bash
yarn add zustand
```

### Migrating from Context API

#### Before (using Context):

```jsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, login, logout } = useAuth();
  
  return (
    <div>
      {user ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={() => login()}>Login</button>
      )}
    </div>
  );
}
```

#### After (using Zustand):

```jsx
import { useUserStore } from '../store';

function MyComponent() {
  const user = useUserStore(state => state.user);
  const login = useUserStore(state => state.login);
  const logout = useUserStore(state => state.logout);
  
  return (
    <div>
      {user ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={() => login()}>Login</button>
      )}
    </div>
  );
}
```

### Migrating Loading States

A custom `useLoading` hook is provided to maintain compatibility with the previous LoadingContext API:

```jsx
import { useLoading } from '../hooks/useLoading';

function MyComponent() {
  const { isLoading, startLoading, stopLoading, withLoading } = useLoading();
  
  const handleClick = async () => {
    await withLoading('myOperation', async () => {
      // Your async operation here
    });
  };
  
  return (
    <div>
      {isLoading('myOperation') ? (
        <span>Loading...</span>
      ) : (
        <button onClick={handleClick}>Perform Operation</button>
      )}
    </div>
  );
}
```

## Benefits

- **Performance**: Zustand is more performant than Context API for complex state
- **Simplicity**: No providers needed, just import and use the store
- **Devtools**: Built-in Redux DevTools support for debugging
- **Middleware**: Support for middleware like persist for localStorage integration
- **Selective Updates**: Components only re-render when their specific slice of state changes
- **TypeScript Support**: Full TypeScript support with proper typing

## React Query Integration

We've created custom hooks that integrate React Query with our Zustand stores:

- `useZustandQuery`: For data fetching with loading state management
- `useZustandMutation`: For data mutations with loading state management
- `useZustandInfiniteQuery`: For paginated data fetching
- `useZustandQueryInvalidation`: For invalidating queries with loading state management

### Example Usage with React Query

```jsx
import { useZustandQuery } from '../hooks/useZustandQuery';

function UserStats() {
  const { data, isLoading, error } = useZustandQuery(
    'userStats',
    fetchUserStats,
    { staleTime: 60000 },
    'userStatsLoading'
  );
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      <h2>User Stats</h2>
      <p>Total Wins: {data.totalWins}</p>
      {/* More stats */}
    </div>
  );
}
```

## Best Practices

1. **Selective Subscriptions**: Only subscribe to the specific state pieces you need

```jsx
// Good - only re-renders when user.displayName changes
const displayName = useUserStore(state => state.user?.displayName);

// Bad - re-renders when any part of the user object changes
const user = useUserStore(state => state.user);
const displayName = user?.displayName;
```

2. **Computed Values**: Use selectors for computed values

```jsx
const isAdmin = useUserStore(state => state.user?.role === 'admin');
```

3. **Combine Multiple Stores**: Access multiple stores in a component when needed

```jsx
const user = useUserStore(state => state.user);
const balance = useWalletStore(state => state.balance);
const theme = useUIStore(state => state.theme);
```

4. **Use DevTools**: Enable Redux DevTools in your browser to debug state changes

## Resources

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Query Documentation](https://tanstack.com/query/latest)
- [ZustandMigrationGuide.md](../docs/ZustandMigrationGuide.md)
- [Example Components](../components/examples/)