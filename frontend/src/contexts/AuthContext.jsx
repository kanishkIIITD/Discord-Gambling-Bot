import { createContext, useContext, useState, useEffect } from 'react';
import axios from '../services/axiosConfig';
import queryClient from '../services/queryClient';
import { persistQueryCache, clearPersistedQueryCache } from '../utils/cacheHydration';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Set up axios defaults
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  const checkAuth = async () => {
    // console.log('[AuthContext] Starting auth check');
    try {
      const token = localStorage.getItem('token');
      // console.log('[AuthContext] Token exists:', !!token);
      if (!token) {
        // console.log('[AuthContext] No token found, aborting auth check');
        throw new Error('No token found');
      }

      // Don't include guild ID for the /me endpoint - we want to authenticate regardless of guild
      // console.log('[AuthContext] Sending auth request to /api/auth/me');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      // console.log('[AuthContext] Auth request successful');
      // The returned user object contains the Discord username (from OAuth),
      // which is used to update the backend username after login.
      setUser(response.data);
      // console.log('[AuthContext] User state updated:', response.data.username || response.data.discordId);
      
      // Store user data in React Query cache
      queryClient.setQueryData(['currentUser'], response.data);
      // console.log('[AuthContext] User data stored in React Query cache');
      
      // Persist critical queries to localStorage
      persistQueryCache(queryClient);
      // console.log('[AuthContext] Query cache persisted to localStorage');
      
      return response.data;
    } catch (error) {
      console.error('[AuthContext] Auth check failed:', error);
      setUser(null);
      localStorage.removeItem('token');
      // console.log('[AuthContext] User state cleared and token removed');
      throw error;
    } finally {
      setLoading(false);
      // console.log('[AuthContext] Auth check completed, loading=false');
    }
  };

  useEffect(() => {
    checkAuth().catch(() => {
      // Silent fail on initial load
    });
  }, []);

  const login = () => {
    window.location.href = `${process.env.REACT_APP_API_URL}/api/auth/discord`;
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Simple logout request - no guild ID needed
        await axios.post(
          `${process.env.REACT_APP_API_URL}/api/auth/logout`, 
          {}, 
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      }
      localStorage.removeItem('token');
      localStorage.removeItem('selectedGuildId');
      delete axios.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['x-guild-id'];
      setUser(null);
      
      // Clear React Query cache
      queryClient.clear();
      
      // Clear persisted cache in localStorage
      clearPersistedQueryCache();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const setToken = (token) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  // Compute isAuthenticated based on user state
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, setToken, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};