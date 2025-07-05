import React, { useEffect } from 'react';
import { Route, useLocation, useNavigate } from 'react-router-dom';
import { useLoading } from '../hooks/useLoading';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * LoadingRoute component that integrates React Router with LoadingContext
 * Manages loading state during route transitions and data loading
 * 
 * @param {Object} props - Component props
 * @param {string} props.path - Route path
 * @param {React.Component} props.component - Component to render for the route
 * @param {Function} props.loader - Data loading function to run before rendering the component
 * @param {string} props.loadingKey - Key to use for the loading state in LoadingContext
 * @param {Object} props.spinnerProps - Props to pass to the LoadingSpinner component
 * @param {boolean} props.showContentWhileLoading - Whether to show the component while loading
 * @param {Object} props.routeProps - Additional props to pass to the Route component
 */
export const LoadingRoute = ({
  path,
  component: Component,
  loader,
  loadingKey = `route_${path.replace(/\//g, '_')}`,
  spinnerProps = {},
  showContentWhileLoading = false,
  ...routeProps
}) => {
  const { startLoading, stopLoading, setError, isLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Default spinner props
  const defaultSpinnerProps = {
    size: 'md',
    overlay: true,
    message: 'Loading...',
    ...spinnerProps,
  };
  
  // Wrapped component that handles loading state
  const RouteComponent = (routeComponentProps) => {
    // Load data when the route is accessed
    useEffect(() => {
      let isMounted = true;
      
      const loadData = async () => {
        if (!loader) return;
        
        try {
          startLoading(loadingKey);
          
          // Call the loader function with route params and location
          const result = await loader({
            ...routeComponentProps,
            location,
            navigate,
          });
          
          // Only update state if component is still mounted
          if (isMounted) {
            stopLoading(loadingKey);
            return result;
          }
        } catch (error) {
          // Only update state if component is still mounted
          if (isMounted) {
            setError(loadingKey, error.message || 'Failed to load route data');
            stopLoading(loadingKey);
          }
        }
      };
      
      loadData();
      
      // Cleanup function
      return () => {
        isMounted = false;
        stopLoading(loadingKey);
      };
    }, [location.pathname]);
    
    // Determine what to render based on loading state
    const isCurrentlyLoading = isLoading(loadingKey);
    
    if (isCurrentlyLoading && !showContentWhileLoading) {
      return <LoadingSpinner {...defaultSpinnerProps} />;
    }
    
    return (
      <>
        {isCurrentlyLoading && <LoadingSpinner {...defaultSpinnerProps} />}
        <Component {...routeComponentProps} />
      </>
    );
  };
  
  return <Route path={path} element={<RouteComponent />} {...routeProps} />;
};

/**
 * Higher-order component that wraps a component with loading state for routes
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.loader - Data loading function
 * @param {string} options.loadingKey - Key for the loading state
 * @param {Object} options.spinnerProps - Props for the LoadingSpinner
 * @param {boolean} options.showContentWhileLoading - Whether to show content while loading
 * @returns {Function} - HOC that wraps a component
 */
export const withRouteLoading = (options = {}) => {
  return (Component) => {
    const {
      loader,
      loadingKey,
      spinnerProps,
      showContentWhileLoading,
    } = options;
    
    const displayName = Component.displayName || Component.name || 'Component';
    
    const WithRouteLoading = (props) => {
      const { startLoading, stopLoading, setError, isLoading } = useLoading();
      const location = useLocation();
      const navigate = useNavigate();
      const actualLoadingKey = loadingKey || `route_${displayName}`;
      
      // Default spinner props
      const defaultSpinnerProps = {
        size: 'md',
        overlay: true,
        message: 'Loading...',
        ...spinnerProps,
      };
      
      // Load data when the component mounts or location changes
      useEffect(() => {
        let isMounted = true;
        
        const loadData = async () => {
          if (!loader) return;
          
          try {
            startLoading(actualLoadingKey);
            
            // Call the loader function with props and router objects
            const result = await loader({
              ...props,
              location,
              navigate,
            });
            
            // Only update state if component is still mounted
            if (isMounted) {
              stopLoading(actualLoadingKey);
              return result;
            }
          } catch (error) {
            // Only update state if component is still mounted
            if (isMounted) {
              setError(actualLoadingKey, error.message || 'Failed to load route data');
              stopLoading(actualLoadingKey);
            }
          }
        };
        
        loadData();
        
        // Cleanup function
        return () => {
          isMounted = false;
          stopLoading(actualLoadingKey);
        };
      }, [location.pathname]);
      
      // Determine what to render based on loading state
      const isCurrentlyLoading = isLoading(actualLoadingKey);
      
      if (isCurrentlyLoading && !showContentWhileLoading) {
        return <LoadingSpinner {...defaultSpinnerProps} />;
      }
      
      return (
        <>
          {isCurrentlyLoading && <LoadingSpinner {...defaultSpinnerProps} />}
          <Component {...props} />
        </>
      );
    };
    
    WithRouteLoading.displayName = `WithRouteLoading(${displayName})`;
    
    return WithRouteLoading;
  };
};

/**
 * Hook for managing loading state during navigation
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.loadingKey - Key for the loading state
 * @param {number} options.minimumLoadingTime - Minimum time to show loading state in ms
 * @returns {Object} - Navigation functions with loading state
 */
export const useLoadingNavigation = (options = {}) => {
  const {
    loadingKey = 'navigation',
    minimumLoadingTime = 300,
  } = options;
  
  const { startLoading, stopLoading } = useLoading();
  const navigate = useNavigate();
  
  // Navigate with loading state
  const navigateWithLoading = (to, options = {}) => {
    startLoading(loadingKey);
    
    // Ensure loading state is shown for at least minimumLoadingTime
    const startTime = Date.now();
    
    // Schedule navigation
    setTimeout(() => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minimumLoadingTime - elapsedTime);
      
      setTimeout(() => {
        navigate(to, options);
        stopLoading(loadingKey);
      }, remainingTime);
    }, 0);
  };
  
  return {
    navigateWithLoading,
    isNavigating: useLoading().isLoading(loadingKey),
  };
};