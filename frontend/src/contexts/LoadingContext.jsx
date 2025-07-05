import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Define action types
const LOADING_ACTIONS = {
  START_LOADING: 'START_LOADING',
  STOP_LOADING: 'STOP_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET_STATE: 'RESET_STATE'
};

// Initial state
const initialState = {
  loadingStates: {},
  errors: {}
};

// Reducer function
function loadingReducer(state, action) {
  switch (action.type) {
    case LOADING_ACTIONS.START_LOADING:
      return {
        ...state,
        loadingStates: {
          ...state.loadingStates,
          [action.payload.key]: true
        }
      };
    case LOADING_ACTIONS.STOP_LOADING:
      return {
        ...state,
        loadingStates: {
          ...state.loadingStates,
          [action.payload.key]: false
        }
      };
    case LOADING_ACTIONS.SET_ERROR:
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.key]: action.payload.error
        }
      };
    case LOADING_ACTIONS.CLEAR_ERROR:
      const newErrors = { ...state.errors };
      delete newErrors[action.payload.key];
      return {
        ...state,
        errors: newErrors
      };
    case LOADING_ACTIONS.RESET_STATE:
      return initialState;
    default:
      return state;
  }
}

// Create context
const LoadingContext = createContext();

/**
 * LoadingProvider component
 * Provides a centralized way to manage loading states and errors across the application
 * 
 * Integration with toast notifications:
 * - For toast integration, see useToast.js and useLoadingToast.js
 * - LoadingToast component provides visual feedback for loading states
 * - See docs/LoadingToastIntegration.md for detailed documentation
 */
export const LoadingProvider = ({ children }) => {
  const [state, dispatch] = useReducer(loadingReducer, initialState);

  // Start loading for a specific key
  const startLoading = useCallback((key) => {
    dispatch({
      type: LOADING_ACTIONS.START_LOADING,
      payload: { key }
    });
  }, []);

  // Stop loading for a specific key
  const stopLoading = useCallback((key) => {
    dispatch({
      type: LOADING_ACTIONS.STOP_LOADING,
      payload: { key }
    });
  }, []);

  // Set error for a specific key
  const setError = useCallback((key, error) => {
    dispatch({
      type: LOADING_ACTIONS.SET_ERROR,
      payload: { key, error }
    });
  }, []);

  // Clear error for a specific key
  const clearError = useCallback((key) => {
    dispatch({
      type: LOADING_ACTIONS.CLEAR_ERROR,
      payload: { key }
    });
  }, []);

  // Reset all loading states and errors
  const resetState = useCallback(() => {
    dispatch({ type: LOADING_ACTIONS.RESET_STATE });
  }, []);

  // Check if any loading state is active
  const isAnyLoading = useCallback(() => {
    return Object.values(state.loadingStates).some(Boolean);
  }, [state.loadingStates]);

  // Check if a specific key is loading
  const isLoading = useCallback((key) => {
    return !!state.loadingStates[key];
  }, [state.loadingStates]);

  // Get error for a specific key
  const getError = useCallback((key) => {
    return state.errors[key] || null;
  }, [state.errors]);

  // Utility function to wrap async operations with loading state management
  const withLoading = useCallback(async (key, asyncFn) => {
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
  }, [startLoading, stopLoading, setError, clearError]);

  const value = {
    loadingStates: state.loadingStates,
    errors: state.errors,
    startLoading,
    stopLoading,
    setError,
    clearError,
    resetState,
    isAnyLoading,
    isLoading,
    getError,
    withLoading
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

// Custom hook to use the loading context
export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};