import { Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useUserStore, useGuildStore } from '../store';
import queryClient from '../services/queryClient';
import { prefetchHeartbeat } from '../services/heartbeat';
import LoadingSpinner from '../components/LoadingSpinner';

export const ProtectedRoute = ({ children }) => {
  // Get user state from Zustand store
  const user = useUserStore(state => state.user);
  const loading = useUserStore(state => state.loading);
  const isAuthenticated = useUserStore(state => !!state.user);
  
  // Get guild state from Zustand store
  const userGuilds = useGuildStore(state => state.guilds);
  const isLoadingGuilds = useGuildStore(state => state.loading);
  const guildError = useGuildStore(state => state.error);
  const [shouldRedirect, setShouldRedirect] = useState(null);
  const [manuallyFetchedGuilds, setManuallyFetchedGuilds] = useState(null);
  const guildLoadTimeoutRef = useRef(null);
  const hasAttemptedManualFetch = useRef(false);
  
  // Use an effect to determine redirects only after loading is complete
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // console.log('ProtectedRoute: Checking redirect conditions');
    // console.log('Auth state:', { loading, isAuthenticated, user: user ? 'exists' : 'null' });
    // console.log('Guild state:', { 
    //   isLoadingGuilds, 
    //   userGuilds: userGuilds ? userGuilds.length : 0, 
    //   guildError 
    // });
    
    // Log the actual userGuilds data for debugging
    // if (userGuilds) {
    //   console.log('ProtectedRoute: Current userGuilds data:', JSON.stringify(userGuilds));
    // }
    
    // Also check the React Query cache directly
    const cachedGuilds = queryClient.getQueryData(['userGuilds']);
    // console.log('ProtectedRoute: React Query cached guilds:', 
    //   cachedGuilds ? `${cachedGuilds.length} guilds` : 'none');
    
    // Clear any existing timeout
    if (guildLoadTimeoutRef.current) {
      clearTimeout(guildLoadTimeoutRef.current);
      guildLoadTimeoutRef.current = null;
    }
    
    // Only make redirect decisions when loading states are settled
    if (!loading && (!isAuthenticated || !user)) {
      // console.log('ProtectedRoute: Redirecting to /login - Not authenticated or no user');
      setShouldRedirect('/login');
    } else if (!loading && isAuthenticated) {
      // If authenticated, check for guilds in either state or cache or our manual fetch
      const hasGuildsInState = userGuilds && userGuilds.length > 0;
      const hasGuildsInCache = cachedGuilds && cachedGuilds.length > 0;
      const hasManuallyFetchedGuilds = manuallyFetchedGuilds && manuallyFetchedGuilds.length > 0;
      
      if (hasGuildsInState || hasGuildsInCache || hasManuallyFetchedGuilds) {
        // If we have guilds in any source, no redirect needed
        // console.log('ProtectedRoute: No redirect needed - Found guilds');
        setShouldRedirect(null);
        
        // If we have manually fetched guilds but they're not in the cache, update the cache
        if (hasManuallyFetchedGuilds && !hasGuildsInCache && !hasGuildsInState) {
          // console.log('ProtectedRoute: Updating cache with manually fetched guilds');
          queryClient.setQueryData(['userGuilds'], manuallyFetchedGuilds);
        }
      } else if (isLoadingGuilds) {
        // Still loading guilds, set a timeout to prevent infinite loading
        // console.log('ProtectedRoute: Still loading guilds, setting timeout');
        guildLoadTimeoutRef.current = setTimeout(() => {
          // console.log('ProtectedRoute: Guild loading timeout reached, attempting manual fetch');
          // Try to manually fetch guilds as a last resort
          if (!hasAttemptedManualFetch.current && user?.discordId) {
            hasAttemptedManualFetch.current = true;
            prefetchHeartbeat().then(data => {
              if (data?.guilds?.length > 0) {
                // console.log('ProtectedRoute: Manual fetch successful:', data.guilds);
                setManuallyFetchedGuilds(data.guilds);
              } else {
                // console.log('ProtectedRoute: Manual fetch returned no guilds, redirecting');
                setShouldRedirect('/no-guilds');
              }
            }).catch(error => {
              console.error('ProtectedRoute: Manual fetch failed:', error);
              setShouldRedirect('/no-guilds');
            });
          } else {
            // If we've already tried manual fetch or don't have a user ID, redirect
            // console.log('ProtectedRoute: Cannot attempt manual fetch, redirecting');
            setShouldRedirect('/no-guilds');
          }
        }, 8000); // 8 second timeout for guild loading
      } else if (!isLoadingGuilds) {
        // If not loading guilds but still no guilds, try manual fetch once
        if (!hasAttemptedManualFetch.current && user?.discordId) {
          // console.log('ProtectedRoute: Attempting manual guild fetch');
          hasAttemptedManualFetch.current = true;
          prefetchHeartbeat().then(data => {
            if (data?.guilds?.length > 0) {
              // console.log('ProtectedRoute: Manual fetch successful:', data.guilds);
              setManuallyFetchedGuilds(data.guilds);
            } else {
              // console.log('ProtectedRoute: Manual fetch returned no guilds, redirecting');
              setShouldRedirect('/no-guilds');
            }
          }).catch(error => {
            console.error('ProtectedRoute: Manual fetch failed:', error);
            setShouldRedirect('/no-guilds');
          });
        } else {
          // If we've already tried manual fetch or don't have a user ID, redirect
          // console.log('ProtectedRoute: Redirecting to /no-guilds - No guilds found after all attempts');
          setShouldRedirect('/no-guilds');
        }
      }
    } else {
      // console.log('ProtectedRoute: Still loading auth, not making redirect decision yet');
    }
    
    // Cleanup function to clear timeout
    return () => {
      if (guildLoadTimeoutRef.current) {
        clearTimeout(guildLoadTimeoutRef.current);
      }
    };
  // Removed manuallyFetchedGuilds from dependency array to prevent infinite loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, user, isLoadingGuilds, userGuilds]);

  // Get guild switching state to avoid showing loading spinner during guild switches
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  // Show loading spinner while auth or guilds are loading
  // or while we're determining if a redirect is needed
  // BUT don't show it during guild switching (let the guild switching overlay handle it)
  if ((loading || (isAuthenticated && isLoadingGuilds) || shouldRedirect === undefined) && !isGuildSwitching) {
    // console.log('[ProtectedRoute] Showing loading spinner - auth/guilds loading');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading authentication..." />
      </div>
    );
  }

  // Handle redirects after loading is complete
  if (shouldRedirect) {
    return <Navigate to={shouldRedirect} replace />;
  }

  return children;
};