import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * UI store for managing UI-related state
 * Centralizes UI state that was previously managed in ThemeContext, AnimationContext, and LoadingContext
 */
export const useUIStore = create(
  devtools(
    (set, get) => ({
      // Theme state
      theme: localStorage.getItem('theme') || 'dark',
      
      // Animation state
      animationsEnabled: localStorage.getItem('animationsEnabled') !== 'false',
      animationSpeed: localStorage.getItem('animationSpeed') || 'normal',
      
      // Loading states
      loadingStates: {},
      errors: {},
      
      // Theme actions
      initializeTheme: () => {
        const currentTheme = get().theme;
        // Apply theme to document using both data-theme attribute and dark class
        if (currentTheme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
          document.documentElement.classList.remove('dark');
        }
      },
      
      setTheme: (theme) => {
        localStorage.setItem('theme', theme);
        set({ theme });
        
        // Apply theme to document using both data-theme attribute and dark class
        if (theme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
          document.documentElement.classList.remove('dark');
        }
      },
      
      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        get().setTheme(newTheme);
      },
      
      // Animation actions
      setAnimationsEnabled: (enabled) => {
        localStorage.setItem('animationsEnabled', enabled);
        set({ animationsEnabled: enabled });
      },
      
      setAnimationSpeed: (speed) => {
        localStorage.setItem('animationSpeed', speed);
        set({ animationSpeed: speed });
      },
      
      // Loading state actions
      startLoading: (key) => {
        set(state => ({
          loadingStates: {
            ...state.loadingStates,
            [key]: true
          }
        }));
      },
      
      stopLoading: (key) => {
        set(state => ({
          loadingStates: {
            ...state.loadingStates,
            [key]: false
          }
        }));
      },
      
      setError: (key, error) => {
        set(state => ({
          errors: {
            ...state.errors,
            [key]: error
          }
        }));
      },
      
      clearError: (key) => {
        set(state => {
          const newErrors = { ...state.errors };
          delete newErrors[key];
          return { errors: newErrors };
        });
      },
      
      resetLoadingStates: () => {
        set({ loadingStates: {}, errors: {} });
      },
      
      // Utility functions
      isLoading: (key) => {
        return !!get().loadingStates[key];
      },
      
      isAnyLoading: () => {
        return Object.values(get().loadingStates).some(Boolean);
      },
      
      getError: (key) => {
        return get().errors[key] || null;
      },
      
      // Async operation wrapper with loading state management
      withLoading: async (key, asyncFn) => {
        const { startLoading, stopLoading, setError, clearError } = get();
        try {
          startLoading(key);
          clearError(key);
          return await asyncFn();
        } catch (error) {
          setError(key, error);
          throw error;
        } finally {
          stopLoading(key);
        }
      },
    }),
    { name: 'ui-store' }
  )
);