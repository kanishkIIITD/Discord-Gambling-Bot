import axios from './axiosConfig';
import queryClient from './queryClient';
import { persistQueryCache } from '../utils/cacheHydration';

/**
 * Heartbeat service for lightweight auth and guild validation
 * 
 * This service provides a way to quickly check if the user's authentication
 * and guild membership are still valid without making multiple API calls.
 */

/**
 * Checks user authentication and guild membership status with a lightweight API call
 * @returns {Promise<{user: Object, guilds: Array}>} User data and guilds
 */
export const checkHeartbeat = async (retryCount = 0) => {
  try {
    // console.log('[Heartbeat] Making request to heartbeat endpoint');
    const API_URL = process.env.REACT_APP_API_URL;
    
    if (!API_URL) {
      console.error('[Heartbeat] API_URL is not defined in environment variables');
      throw new Error('API_URL is not defined');
    }
    
    // console.log(`[Heartbeat] Using API URL: ${API_URL}`);
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[Heartbeat] No authentication token found');
      throw new Error('No authentication token found');
    }
    
    // Use the API_URL from environment variables to ensure correct endpoint
    const response = await axios.get(`${API_URL}/api/auth/heartbeat`, {
      // Add timeout to prevent hanging requests
      timeout: 8000, // Reduced timeout for faster failure
      // Ensure we're sending the auth token
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data) {
      // console.log('[Heartbeat] Received successful response');
      // console.log(`[Heartbeat] User: ${response.data.user?.username || 'unknown'}`);
      // console.log(`[Heartbeat] Guilds count: ${response.data.guilds?.length || 0}`);
      
      // Update the user data in the cache
      queryClient.setQueryData(['currentUser'], response.data.user);
      
      // Update the guilds data in the cache
      queryClient.setQueryData(['userGuilds'], response.data.guilds);
      
      // Persist the updated cache to localStorage
      persistQueryCache(queryClient);
      
      return response.data;
    }
    
    console.warn('[Heartbeat] Response received but no data');
    return null;
  } catch (error) {
    console.error('[Heartbeat] Check failed:', error.message);
    
    // Enhanced error logging
    if (error.response) {
      console.error('[Heartbeat] Response status:', error.response.status);
      console.error('[Heartbeat] Response data:', error.response.data);
    } else if (error.request) {
      console.error('[Heartbeat] No response received, request was:', error.request);
    }
    
    // Implement retry logic for network errors or timeouts
    if ((error.code === 'ECONNABORTED' || !error.response) && retryCount < 2) {
      // console.log(`[Heartbeat] Retrying (${retryCount + 1}/2)...`);
      return new Promise(resolve => {
        // Exponential backoff
        setTimeout(() => {
          resolve(checkHeartbeat(retryCount + 1));
        }, 1000 * Math.pow(2, retryCount));
      });
    }
    
    // If we've exhausted retries or it's not a network error, throw
    throw error;
  }
};

/**
 * Sets up a background heartbeat check that runs at specified intervals
 * @param {number} intervalMs - Interval in milliseconds (default: 5 minutes)
 * @returns {Function} Cleanup function to stop the interval
 */
export const setupHeartbeatInterval = (intervalMs = 5 * 60 * 1000) => {
  // Don't run heartbeat checks too frequently
  if (intervalMs < 60000) {
    console.warn('Heartbeat interval should be at least 1 minute to avoid excessive API calls');
    intervalMs = 60000;
  }
  
  // console.log(`[Heartbeat] Setting up heartbeat interval every ${intervalMs/1000} seconds`);
  
  const intervalId = setInterval(async () => {
    try {
      // console.log('[Heartbeat] Running scheduled heartbeat check');
      const result = await checkHeartbeat();
      // console.log(`[Heartbeat] Scheduled check completed with ${result?.guilds?.length || 0} guilds`);
    } catch (error) {
      // More detailed error logging
      console.error('[Heartbeat] Background heartbeat check failed:', error);
      console.error('[Heartbeat] Error details:', error.message);
      if (error.response) {
        console.error('[Heartbeat] Response status:', error.response.status);
        console.error('[Heartbeat] Response data:', error.response.data);
      }
    }
  }, intervalMs);
  
  // Return cleanup function
  return () => {
    // console.log('[Heartbeat] Cleaning up heartbeat interval');
    clearInterval(intervalId);
  };
};

/**
 * Prefetches heartbeat data when user hovers over guild switcher
 * @returns {Promise<void>}
 */
export const prefetchHeartbeat = async () => {
  try {
    // Check if we already have cached data
    const cachedUser = queryClient.getQueryData(['currentUser']);
    const cachedGuilds = queryClient.getQueryData(['userGuilds']);
    
    // If we don't have cached data or it's stale, prefetch
    if (!cachedUser || !cachedGuilds) {
      // console.log('[Heartbeat] No cached data found, prefetching...');
      
      try {
        const data = await checkHeartbeat();
        
        if (data && data.guilds && data.guilds.length > 0) {
          // console.log(`[Heartbeat] Prefetched ${data.guilds.length} guilds`);
          return data;
        } else {
          console.warn('[Heartbeat] Prefetch returned no guilds, falling back to direct API call');
        }
      } catch (heartbeatError) {
        console.error('[Heartbeat] Prefetch via heartbeat failed, falling back to direct API call:', heartbeatError.message);
      }
      
      // If heartbeat fails or returns no guilds, try direct API call
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('[Heartbeat] No token available for fallback guild fetch');
          return null;
        }
        
        // Get user ID from cached user or from JWT token
        let userId = cachedUser?.id;
        if (!userId && token) {
          try {
            // Try to extract user ID from JWT token
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            userId = tokenData.id || tokenData.sub;
          } catch (e) {
            console.error('[Heartbeat] Failed to extract user ID from token:', e.message);
          }
        }
        
        if (userId) {
          // console.log(`[Heartbeat] Attempting direct guild fetch for user ${userId}`);
          const { getUserGuilds } = await import('./api');
          const guilds = await getUserGuilds(userId);
          
          if (guilds && guilds.length > 0) {
            // console.log(`[Heartbeat] Direct fetch successful, found ${guilds.length} guilds`);
            // Update the cache with the fetched guilds
            queryClient.setQueryData(['userGuilds'], guilds);
            persistQueryCache(queryClient);
            return { user: cachedUser, guilds };
          } else {
            console.warn('[Heartbeat] Direct fetch returned no guilds');
          }
        }
      } catch (apiError) {
        console.error('[Heartbeat] Direct guild fetch failed:', apiError.message);
      }
      
      return null;
    }
    
    // console.log(`[Heartbeat] Using cached data with ${cachedGuilds.length} guilds`);
    return { user: cachedUser, guilds: cachedGuilds };
  } catch (error) {
    console.error('[Heartbeat] Prefetch failed:', error.message);
    if (error.response) {
      console.error('[Heartbeat] Response status:', error.response.status);
      console.error('[Heartbeat] Response data:', error.response.data);
    }
    return null;
  }
};