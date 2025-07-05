import React, { useEffect, useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import queryClient from '../services/queryClient';
import { persistQueryCache } from '../utils/cacheHydration';
import { checkHeartbeat, setupHeartbeatInterval } from '../services/heartbeat';
import { useCoordinatedLoading } from '../utils/loadingCacheUtils';

// Import Zustand stores
import { useUserStore } from '../store/useUserStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';

/**
 * AppLayout serves as a centralized layout component that:
 * 1. Runs authentication checks
 * 2. Fetches guild data
 * 3. Holds off rendering children until both are complete
 * 
 * This prevents individual pages from triggering their own fetch and redirect logic.
 */
const AppLayout = () => {
  // Use Zustand stores instead of Context
  const { checkAuth, user, loading: authLoading } = useUserStore();
  const { 
    userGuilds, 
    isLoadingGuilds, 
    fetchUserGuilds, 
    selectedGuild,
    guildError,
    isGuildSwitching
  } = useGuildStore();
  const { startLoading, stopLoading, setError } = useUIStore();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Define loading keys for app initialization
  const APP_LOADING_KEYS = {
    APP_INIT: 'app-initialization',
    HEARTBEAT: 'app-heartbeat-check',
    AUTH_CHECK: 'app-auth-check',
    GUILD_FETCH: 'app-guild-fetch'
  };

  // On mount, ensure auth is checked and guilds are fetched
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Start loading for app initialization
        startLoading(APP_LOADING_KEYS.APP_INIT);
        try {
          // First try the lightweight heartbeat check
          try {
            startLoading(APP_LOADING_KEYS.HEARTBEAT);
            const heartbeatData = await checkHeartbeat();
            stopLoading(APP_LOADING_KEYS.HEARTBEAT);
            
            if (heartbeatData?.user && heartbeatData?.guilds?.length > 0) {
              // If heartbeat succeeds, we can skip the full auth check
              setIsInitialized(true);
              stopLoading(APP_LOADING_KEYS.APP_INIT);
              return;
            }
          } catch (heartbeatError) {
            stopLoading(APP_LOADING_KEYS.HEARTBEAT);
            // If heartbeat fails, fall back to full auth check
            // console.log('Heartbeat check failed, falling back to full auth check');
          }
          
          // Fall back to full auth check and guild fetch in parallel
          startLoading(APP_LOADING_KEYS.AUTH_CHECK);
          startLoading(APP_LOADING_KEYS.GUILD_FETCH);
          
          const [authResult] = await Promise.all([
            checkAuth(),
            fetchUserGuilds()
          ]);
          
          stopLoading(APP_LOADING_KEYS.AUTH_CHECK);
          stopLoading(APP_LOADING_KEYS.GUILD_FETCH);

          // Persist critical data to localStorage
          if (authResult && userGuilds?.length > 0) {
            persistQueryCache(queryClient);
          }

          setIsInitialized(true);
          stopLoading(APP_LOADING_KEYS.APP_INIT);
        } catch (innerError) {
          setError(APP_LOADING_KEYS.APP_INIT, innerError);
          throw innerError;
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        stopLoading(APP_LOADING_KEYS.APP_INIT);
        setIsInitialized(true); // Still mark as initialized so we don't get stuck
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
    
    // Set up background heartbeat checks
    const cleanupHeartbeat = setupHeartbeatInterval();
    
    // Clean up interval on unmount
    return () => cleanupHeartbeat();
  }, [checkAuth, fetchUserGuilds, isInitialized]);

  // Memoize the dependency keys and states to prevent unnecessary re-renders
  const dependencyKeys = useMemo(() => [
    APP_LOADING_KEYS.APP_INIT,
    APP_LOADING_KEYS.HEARTBEAT,
    APP_LOADING_KEYS.AUTH_CHECK,
    APP_LOADING_KEYS.GUILD_FETCH
  ], [APP_LOADING_KEYS.APP_INIT, APP_LOADING_KEYS.HEARTBEAT, APP_LOADING_KEYS.AUTH_CHECK, APP_LOADING_KEYS.GUILD_FETCH]);
  
  const dependencyStates = useMemo(() => [
    !isInitialized,
    authLoading,
    isLoadingGuilds
  ], [isInitialized, authLoading, isLoadingGuilds]);
  
  // Use coordinated loading to prevent flickering
  const { isLoading: isAppLoading, isInitialLoadComplete } = useCoordinatedLoading({
    dependencyKeys,
    dependencyStates,
    stabilizationDelay: 600, // Increased delay to reduce flickering
    debug: false
  });
  
  // Track if we've shown the app at least once
  const [hasShownApp, setHasShownApp] = useState(false);
  
  // Once we've shown the app, don't go back to the loading screen
  useEffect(() => {
    if (isInitialLoadComplete && !hasShownApp) {
      setHasShownApp(true);
    }
  }, [isInitialLoadComplete, hasShownApp]);
  
  // Only show loading screen for initial load
  const shouldShowLoadingScreen = isAppLoading && !hasShownApp;
  
  // Show loading spinner while app is initializing
  // BUT don't show it during guild switching (let the guild switching overlay handle it)
  if (shouldShowLoadingScreen && !isGuildSwitching) {
    // console.log('[AppLayout] Showing loading spinner - app initializing');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Initializing application..." />
      </div>
    );
  }

  // Render children (via Outlet) once everything is loaded
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ 
        duration: 0.6,
        ease: "easeOut",
        delay: 0.1
      }}
    >
      <Outlet />
    </motion.div>
  );
};

export default AppLayout;