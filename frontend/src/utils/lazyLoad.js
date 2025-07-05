import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Default fallback component shown while the lazy component is loading
 */
const DefaultLoadingFallback = () => (
  <div className="flex items-center justify-center p-4 min-h-[200px]">
    <LoadingSpinner size="md" color="primary" />
  </div>
);

/**
 * Creates a lazy-loaded component with a custom loading fallback
 * 
 * @param {Function} importFunc - Dynamic import function that returns a promise
 * @param {React.ReactNode} [Fallback=DefaultLoadingFallback] - Component to show while loading
 * @returns {React.LazyExoticComponent} - Lazy-loaded component wrapped in Suspense
 * 
 * @example
 * // Basic usage
 * const LazyComponent = lazyLoad(() => import('./HeavyComponent'));
 * 
 * // With custom fallback
 * const LazyComponent = lazyLoad(
 *   () => import('./HeavyComponent'),
 *   <CustomLoader />
 * );
 */
export const lazyLoad = (importFunc, Fallback = DefaultLoadingFallback) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense fallback={<Fallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Creates a lazy-loaded component that only loads when it becomes visible in the viewport
 * 
 * @param {Function} importFunc - Dynamic import function that returns a promise
 * @param {React.ReactNode} [Fallback=DefaultLoadingFallback] - Component to show while loading
 * @param {Object} [options] - IntersectionObserver options
 * @returns {React.FC} - Component that lazy loads when visible
 * 
 * @example
 * // Basic usage
 * const VisibleComponent = lazyLoadOnVisible(() => import('./HeavyComponent'));
 * 
 * // With custom options
 * const VisibleComponent = lazyLoadOnVisible(
 *   () => import('./HeavyComponent'),
 *   <CustomLoader />,
 *   { rootMargin: '200px' }
 * );
 */
export const lazyLoadOnVisible = (importFunc, Fallback = DefaultLoadingFallback, options = {}) => {
  return (props) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
      const currentRef = containerRef.current;
      if (!currentRef) return;

      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      }, {
        rootMargin: '200px',
        threshold: 0,
        ...options
      });

      observer.observe(currentRef);

      return () => {
        if (currentRef) {
          observer.unobserve(currentRef);
        }
      };
    }, [options]);

    return (
      <div ref={containerRef} style={{ minHeight: '10px' }}>
        {isVisible ? (
          lazyLoad(importFunc, Fallback)(props)
        ) : (
          <div style={{ height: '200px', width: '100%' }} />
        )}
      </div>
    );
  };
};

/**
 * Creates a lazy-loaded component that only loads after the main page content has loaded
 * Useful for non-critical UI elements
 * 
 * @param {Function} importFunc - Dynamic import function that returns a promise
 * @param {number} [delay=1000] - Delay in ms before loading the component
 * @param {React.ReactNode} [Fallback=null] - Component to show while loading
 * @returns {React.FC} - Component that lazy loads after delay
 * 
 * @example
 * const LowPriorityComponent = lazyLoadAfterPageLoad(() => import('./LowPriorityComponent'));
 */
export const lazyLoadAfterPageLoad = (importFunc, delay = 1000, Fallback = null) => {
  return (props) => {
    const [shouldLoad, setShouldLoad] = React.useState(false);

    React.useEffect(() => {
      // Wait for page load and then additional delay
      const handleLoad = () => {
        setTimeout(() => setShouldLoad(true), delay);
      };

      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad);
        return () => window.removeEventListener('load', handleLoad);
      }
    }, [delay]);

    if (!shouldLoad) return Fallback;

    return lazyLoad(importFunc, Fallback)(props);
  };
};