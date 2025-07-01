/**
 * Chart Optimization Utilities
 * 
 * This module provides utilities to optimize chart loading and rendering performance.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Hook to determine if a component is visible in the viewport
 * Used to delay loading charts until they're actually visible
 * 
 * @param {Object} options - IntersectionObserver options
 * @returns {Object} - ref to attach to the element and a boolean indicating if it's visible
 */
export const useInView = (options = {}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, {
      threshold: 0.1,
      rootMargin: '0px',
      ...options
    });

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options]);

  return { ref, isInView };
};

/**
 * Hook to debounce chart rendering to prevent excessive re-renders
 * 
 * @param {Function} value - The function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook to throttle chart rendering to limit the rate of execution
 * 
 * @param {Function} callback - The function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Throttled function
 */
export const useThrottle = (callback, delay) => {
  const lastRan = useRef(Date.now());

  return (...args) => {
    const now = Date.now();
    if (now - lastRan.current >= delay) {
      callback(...args);
      lastRan.current = now;
    }
  };
};

/**
 * Creates optimized chart options with performance considerations
 * 
 * @param {Object} baseOptions - Base ECharts options
 * @param {boolean} isVisible - Whether the chart is visible
 * @returns {Object} - Optimized chart options
 */
export const createOptimizedChartOptions = (baseOptions, isVisible = true) => {
  return {
    ...baseOptions,
    animation: isVisible, // Disable animations when not visible
    progressive: 500, // Enable progressive rendering for large datasets
    progressiveThreshold: 3000,
    renderer: 'canvas', // Canvas renderer is generally faster than SVG
    // Optimize tooltip performance
    tooltip: {
      ...(baseOptions.tooltip || {}),
      enterable: false, // Disable hovering on tooltip to improve performance
      confine: true, // Confine tooltip within chart area to reduce layout calculations
      appendToBody: false, // Keep tooltip in chart DOM to reduce DOM operations
    }
  };
};

/**
 * Wrapper component for lazy loading charts only when they become visible
 * 
 * @param {Object} props - Component props
 * @param {React.Component} props.ChartComponent - The chart component to render
 * @param {Object} props.chartProps - Props to pass to the chart component
 * @returns {JSX.Element} - The wrapped component
 */
export const LazyChart = ({ ChartComponent, chartProps, fallback }) => {
  const { ref, isInView } = useInView();
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (isInView && !hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [isInView, hasBeenVisible]);

  return (
    <div ref={ref} className="w-full h-full">
      {(isInView || hasBeenVisible) ? (
        <ChartComponent {...chartProps} />
      ) : (
        fallback || (
          <div className="flex justify-center items-center h-full w-full">
            <div className="animate-pulse bg-card/50 rounded-lg w-full h-full" />
          </div>
        )
      )}
    </div>
  );
};