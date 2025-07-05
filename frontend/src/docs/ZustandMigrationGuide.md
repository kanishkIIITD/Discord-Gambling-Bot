# Zustand Migration Guide

## Introduction

This guide outlines the process of migrating from React Context API to Zustand for state management in our gambling platform frontend. Zustand provides a more robust, performant, and scalable solution for managing application state.

## Why Zustand?

- **Performance**: Zustand is more performant than Context API for complex state
- **Simplicity**: No providers needed, just import and use the store
- **Devtools**: Built-in Redux DevTools support for debugging
- **Middleware**: Support for middleware like persist for localStorage integration
- **Selective Updates**: Components only re-render when their specific slice of state changes

## Installation

```bash
npm install zustand
```

or

```bash
yarn add zustand
```

## Store Structure

We've organized our Zustand stores into multiple slices:

- **useUserStore**: Manages user authentication state (replaces AuthContext)
- **useWalletStore**: Manages wallet balance and transactions
- **useGuildStore**: Manages guild selection and related data (replaces GuildContext)
- **useUIStore**: Manages UI-related state like theme, animations, and loading states (replaces ThemeContext, AnimationContext, and LoadingContext)

## Migration Steps

### 1. Replace Context Providers

#### Before:

```jsx
// App.js
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider } from './contexts/LoadingContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LoadingProvider>
          <AppRoutes />
        </LoadingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

#### After:

```jsx
// App.js
function App() {
  return <AppRoutes />;
}
```

With Zustand, you don't need providers. The stores are globally accessible.

### 2. Replace Context Consumers

#### Before (using Context):

```jsx
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoading } from '../contexts/LoadingContext';

function MyComponent() {
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isLoading, startLoading, stopLoading } = useLoading();
  
  // Component logic
}
```

#### After (using Zustand):

```jsx
import { useUserStore, useUIStore } from '../store';
import { useLoading } from '../hooks/useLoading'; // Compatibility hook

function MyComponent() {
  // Only subscribe to the specific state pieces you need
  const user = useUserStore(state => state.user);
  const login = useUserStore(state => state.login);
  const logout = useUserStore(state => state.logout);
  
  const theme = useUIStore(state => state.theme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  
  // Use the compatibility hook for loading states
  const { isLoading, startLoading, stopLoading } = useLoading();
  
  // Component logic
}
```

### 3. Handling Async Operations

#### Before:

```jsx
import { useLoading } from '../contexts/LoadingContext';

function MyComponent() {
  const { withLoading } = useLoading();
  
  const handleFetchData = async () => {
    await withLoading('fetchData', async () => {
      // Fetch data
    });
  };
}
```

#### After:

```jsx
import { useLoading } from '../hooks/useLoading';

function MyComponent() {
  const { withLoading } = useLoading();
  
  const handleFetchData = async () => {
    await withLoading('fetchData', async () => {
      // Fetch data
    });
  };
}
```

The API remains the same, but the implementation uses Zustand under the hood.

### 4. Migrating React Query Integration

For components using React Query with loading states:

#### Before:

```jsx
import { useLoadingQuery } from '../hooks/useLoadingQuery';

function MyComponent() {
  const { data, isLoading, error } = useLoadingQuery(
    'userData',
    fetchUserData,
    { staleTime: 60000 },
    'userDataLoading'
  );
}
```

#### After:

Create a new hook that integrates React Query with Zustand:

```jsx
// hooks/useZustandQuery.js
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '../store';

export const useZustandQuery = (queryKey, queryFn, options = {}, loadingKey) => {
  const { startLoading, stopLoading, setError, clearError } = useUIStore();
  const actualLoadingKey = loadingKey || (Array.isArray(queryKey) ? queryKey[0] : queryKey);

  return useQuery({
    ...options,
    queryKey,
    queryFn,
    onSuccess: () => {
      stopLoading(actualLoadingKey);
      clearError(actualLoadingKey);
      if (options.onSuccess) options.onSuccess();
    },
    onError: (error) => {
      stopLoading(actualLoadingKey);
      setError(actualLoadingKey, error);
      if (options.onError) options.onError(error);
    },
    onSettled: (data, error) => {
      if (options.onSettled) options.onSettled(data, error);
    },
  });
};
```

Then use it in your components:

```jsx
import { useZustandQuery } from '../hooks/useZustandQuery';

function MyComponent() {
  const { data, isLoading, error } = useZustandQuery(
    'userData',
    fetchUserData,
    { staleTime: 60000 },
    'userDataLoading'
  );
}
```

## Best Practices

1. **Selective Subscriptions**: Only subscribe to the specific state pieces you need to avoid unnecessary re-renders.

```jsx
// Good - only re-renders when user changes
const user = useUserStore(state => state.user);

// Bad - re-renders when any part of the store changes
const { user } = useUserStore();
```

2. **Computed Values**: Use selectors for computed values.

```jsx
const isLoggedIn = useUserStore(state => !!state.user);
```

3. **Action Composition**: Create complex actions that combine multiple simpler actions.

```jsx
const logoutAndClearData = () => {
  useUserStore.getState().logout();
  useWalletStore.getState().resetWallet();
};
```

4. **Use DevTools**: Enable Redux DevTools in your browser to debug state changes.

## Example Component

See `src/components/examples/ZustandExample.jsx` for a complete example of using Zustand stores.

## Gradual Migration

You can gradually migrate to Zustand by:

1. Start with one context (e.g., AuthContext → useUserStore)
2. Update components that use that context
3. Move to the next context
4. Eventually remove all context providers

## Migration Progress

### Completed Components

- **Profile.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useUIStore`
- **Login.jsx**: Replaced `AuthContext` and `LoadingContext` with `useUserStore` and `useUIStore`
- **AuthCallback.jsx**: Replaced `AuthContext` with `useUserStore`
- **AppLayout.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useUIStore`
- **DashboardNavigation.jsx**: Replaced `AuthContext`, `DashboardContext`, and `GuildContext` with `useUserStore`, `useGuildStore`, `useWalletStore`, and `useUIStore`
- **DashboardLayout.jsx**: Replaced `DashboardContext` with `useWalletStore` and `useUIStore`
- **GuildSelector.jsx**: Replaced `GuildContext` and `LoadingContext` with `useGuildStore` and `useUIStore`
- **GiftPoints.jsx**: Replaced `AuthContext`, `DashboardContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useWalletStore`, `useGuildStore`, and `useUIStore`
- **Dashboard.jsx**: Replaced `AuthContext`, `DashboardContext`, and `LoadingContext` with `useUserStore`, `useWalletStore`, and `useUIStore`
- **useDashboardData.js**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useUIStore`
- **BetDetails.jsx**: Replaced `AuthContext`, `DashboardContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useWalletStore`, `useGuildStore`, and `useUIStore`
- **ViewBetPage.jsx**: Replaced `LoadingContext` with `useUIStore`
- **CreateBetPage.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useUIStore`
- **ActiveBetsPage.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useUIStore`
- **MyBetsPage.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useUIStore`
- **BetHistoryPage.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useUIStore`
- **DiceRoll.jsx**: Replaced `AuthContext`, `DashboardContext`, `GuildContext`, `LoadingContext`, and `AnimationContext` with `useUserStore`, `useWalletStore`, `useGuildStore`, `useLoading` hook, and `useAnimation` hook
- **Roulette.jsx**: Replaced `AuthContext`, `DashboardContext`, `GuildContext`, `LoadingContext`, and `AnimationContext` with `useUserStore`, `useWalletStore`, `useGuildStore`, `useLoading` hook, and `useAnimation` hook
- **Slots.jsx**: Replaced `AuthContext`, `DashboardContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useWalletStore`, `useGuildStore`, `useLoading` hook, and `useAnimation` hook
- **Blackjack.jsx**: Replaced `AuthContext`, `DashboardContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useWalletStore`, `useGuildStore`, `useLoading` hook, and `useAnimation` hook
- **CoinFlip.jsx**: Replaced `AuthContext`, `DashboardContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useWalletStore`, `useGuildStore`, `useLoading` hook, and `useAnimation` hook
- **WinStreakLeaderboard.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useLoading` hook
- **BiggestWinsLeaderboard.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useLoading` hook
- **TopPlayers.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useLoading` hook
- **LoadingDevTools.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **LoadingDevToolsEnhanced.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **SuspenseWithLoading.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **LoadingToast.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **LoadingRoute.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **withLoading.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **LoadingExample.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **AdvancedLoadingExample.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **LoadingToastDemoPage.jsx**: Replaced `LoadingContext` with `useLoading` hook from Zustand store
- **Preferences.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useLoading` hook
- **SuperAdmin.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useLoading` hook
- **StatisticsDashboard.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useLoading` hook
- **Transactions.jsx**: Replaced `AuthContext`, `GuildContext`, and `LoadingContext` with `useUserStore`, `useGuildStore`, and `useLoading` hook
- **GuildSwitchingOverlay.jsx**: Replaced `GuildContext` with `useGuildStore`
- **MiniBalanceHistoryChart.jsx**: Replaced `AuthContext`, `ThemeContext`, and `GuildContext` with `useUserStore`, `useUIStore`, and `useGuildStore`
- **BotPermissions.jsx**: Replaced `LoadingContext` with `useLoading` hook
- **NoGuildsPage.jsx**: Replaced `AuthContext` and `LoadingContext` with `useUserStore` and `useLoading` hook
- **Sidebar.jsx**: Replaced `AuthContext` with `useUserStore`
- **Navigation.jsx**: Replaced `AuthContext` with `useUserStore`
- **GameTypeDistributionChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **MiniGamblingWinLossRatioChart.jsx**: Replaced `AuthContext`, `ThemeContext`, and `GuildContext` with `useUserStore`, `useUIStore`, and `useGuildStore`
- **ThemeToggle.jsx**: Replaced `ThemeContext` with `useUIStore`
- **useLoadingQuery.js**: Replaced `LoadingContext` with `useLoading` hook
- **useQueryHooks.js**: Replaced `AuthContext` and `GuildContext` with `useUserStore` and `useGuildStore`
- **MiniFavoriteGameOverTimeChart.jsx**: Replaced `AuthContext`, `ThemeContext`, and `GuildContext` with `useUserStore`, `useUIStore`, and `useGuildStore`
- **DailyProfitLossChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **BalanceHistoryGraph.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **FavoriteGameTrendChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **RiskScoreTrendChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **TopGamesByProfitChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **GamblingPerformancePieChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **GameComparisonMatrixChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **TimeOfDayHeatmapChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **TransactionTypeAnalysisChart.jsx**: Replaced `AuthContext` and `ThemeContext` with `useUserStore` and `useUIStore`
- **MiniDailyProfitLossChart.jsx**: Replaced `AuthContext`, `ThemeContext`, and `GuildContext` with `useUserStore`, `useUIStore`, and `useGuildStore`
- **PerformanceDashboard.jsx**: Replaced `ThemeContext` with `useUIStore`
- **MiniTopGamesByProfitChart.jsx**: Replaced `AuthContext` and `GuildContext` with `useUserStore` and `useGuildStore`
- **GameTypeDistributionChart.jsx**: Already using `useUserStore` and `useUIStore`

### Pending Components
- Other components using Context API (if any)

## Troubleshooting

### Components not updating when state changes

Ensure you're subscribing to the specific state pieces you need:

```jsx
// This won't update when only user.name changes
const user = useUserStore(state => state.user);

// This will update when user.name changes
const userName = useUserStore(state => state.user?.name);
```

### Multiple instances of the same store

Zustand creates a single store instance per module. If you're seeing multiple instances, check your import paths.

## Resources

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand Middleware](https://github.com/pmndrs/zustand#middleware)
- [Redux DevTools Extension](https://github.com/zalmoxisus/redux-devtools-extension)