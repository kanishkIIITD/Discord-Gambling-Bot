import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import axios from '../services/axiosConfig';

/**
 * User store for managing authentication state
 * Replaces the AuthContext with a more robust state management solution
 */
export const useUserStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      loading: false,
      error: null,
      
      // Actions
      login: () => {
        // Redirect to Discord OAuth URL
        window.location.href = `${process.env.REACT_APP_API_URL}/api/auth/discord`;
      },
      
      logout: async () => {
        try {
          set({ loading: true });
          await axios.post('/api/auth/logout');
          set({ user: null, loading: false, error: null });
          // Clear token from localStorage and axios headers
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        } catch (error) {
          set({ 
            error: error.response?.data?.message || 'Logout failed', 
            loading: false 
          });
        }
      },
      
      checkAuth: async () => {
        try {
          set({ loading: true });
          const response = await axios.get('/api/auth/me');
          set({ user: response.data, loading: false });
          return response.data;
        } catch (error) {
          set({ user: null, loading: false });
          // Don't set error on check auth to avoid showing error messages on initial load
        }
      },
      
      // Add setToken function that was in AuthContext but missing in Zustand implementation
      setToken: (token) => {
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },
      
      updateUserProfile: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },
      
      clearError: () => set({ error: null }),
    }),
    {
      name: 'user-storage', // unique name for localStorage
      partialize: (state) => ({ user: state.user }), // only persist user data, not loading/error states
    }
  )
);

// Export a selector that uses shallow comparison to prevent infinite loops
export const useUserStoreShallow = (selector) => useUserStore(selector, shallow);