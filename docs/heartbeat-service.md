# Heartbeat Service & Performance Optimizations

## Overview

This document describes the implementation of the heartbeat service and related performance optimizations for the application. These changes aim to improve loading times, reduce unnecessary API calls, and provide a smoother user experience.

## Heartbeat Service

### Purpose

The heartbeat service provides a lightweight mechanism to verify authentication status and guild membership without loading the full user profile and guild data. This is particularly useful for:

- Quick authentication checks when navigating between pages
- Background verification of session validity
- Prefetching guild data when hovering over the guild selector

### Implementation

#### Backend

A new `/heartbeat` endpoint has been added to `authRoutes.js` that returns minimal user data and guild information:

```javascript
router.get('/heartbeat', verifyToken, async (req, res) => {
  try {
    // Return minimal user data and guilds for quick verification
    return res.json({
      authenticated: true,
      userId: req.user.discordId,
      guilds: req.user.guilds || []
    });
  } catch (error) {
    console.error('Heartbeat check failed:', error);
    return res.status(401).json({ authenticated: false });
  }
});
```

#### Frontend

The heartbeat service is implemented in `frontend/src/services/heartbeat.js` with three main functions:

1. `checkHeartbeat()` - Validates user authentication and guild membership
2. `setupHeartbeatInterval()` - Runs background checks at specified intervals
3. `prefetchHeartbeat()` - Prefetches data when hovering over the guild switcher

## Performance Optimizations

### AppLayout Component

A new `AppLayout` component centralizes authentication and guild data fetching for all dashboard routes. This component:

- Uses the heartbeat service for quick initialization
- Falls back to full data fetching if needed
- Sets up background heartbeat checks
- Persists critical data to localStorage

### useDashboardData Hook

The `useDashboardData` hook centralizes data loading for dashboard components, providing:

- Unified loading state to prevent UI flicker
- Optimized data fetching with heartbeat integration
- Consistent access to user, guild, wallet, and bet data

### Guild Context Optimizations

The `GuildContext` has been updated to:

- Use the heartbeat service for faster guild data loading
- Expose the `fetchUserGuilds` function for manual refreshes
- Optimize guild switching with prefetching

### Guild Selector Prefetching

The `GuildSelector` component now prefetches guild data when hovered, reducing the perceived loading time when switching guilds.

## Benefits

- **Faster Initial Load**: The heartbeat service provides a quick authentication check without loading full user profiles
- **Reduced API Calls**: Prefetching and optimized data loading reduce redundant API calls
- **Smoother Guild Switching**: Prefetching guild data improves the guild switching experience
- **Better Error Handling**: Centralized authentication and guild checks provide more consistent error handling
- **Improved Perceived Performance**: Loading indicators are shown only when necessary, improving perceived performance

## Future Improvements

- Implement more granular data prefetching based on user navigation patterns
- Add offline support with service workers for critical functionality
- Optimize image loading with lazy loading and progressive enhancement
- Implement request batching to reduce the number of API calls