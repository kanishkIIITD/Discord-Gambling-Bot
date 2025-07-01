import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for tracking window dimensions and responsive breakpoints
 * @param {Object} options - Configuration options
 * @param {number} options.debounceDelay - Debounce delay in milliseconds
 * @param {Object} options.breakpoints - Custom breakpoints object
 * @returns {Object} Window size information and responsive helpers
 */
export const useWindowSize = (options = {}) => {
  const {
    debounceDelay = 250,
    breakpoints = {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536,
    },
  } = options;

  // Initialize with undefined to trigger a first render with actual values
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
    breakpoint: undefined,
  });

  // Get current breakpoint based on window width
  const getBreakpoint = useCallback(
    (width) => {
      // Convert breakpoints object to array and sort by size
      const breakpointEntries = Object.entries(breakpoints).sort(
        (a, b) => a[1] - b[1]
      );

      // Find the largest breakpoint that is smaller than or equal to the current width
      for (let i = breakpointEntries.length - 1; i >= 0; i--) {
        const [name, minWidth] = breakpointEntries[i];
        if (width >= minWidth) return name;
      }

      // Default to the smallest breakpoint
      return breakpointEntries[0][0];
    },
    [breakpoints]
  );

  // Update window size with debounce
  useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      // Set window width/height to state
      const width = window.innerWidth;
      const height = window.innerHeight;
      const breakpoint = getBreakpoint(width);

      setWindowSize({
        width,
        height,
        breakpoint,
      });
    }

    // Add event listener with debounce
    let timeoutId = null;
    const debouncedHandleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, debounceDelay);
    };

    // Call handler right away so state gets updated with initial window size
    handleResize();

    window.addEventListener('resize', debouncedHandleResize);

    // Remove event listener on cleanup
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedHandleResize);
    };
  }, [debounceDelay, getBreakpoint]);

  // Helper functions for responsive design
  const isBreakpoint = useCallback(
    (breakpoint) => windowSize.breakpoint === breakpoint,
    [windowSize.breakpoint]
  );

  const isAtLeastBreakpoint = useCallback(
    (breakpoint) => {
      if (!windowSize.width) return false;
      return windowSize.width >= breakpoints[breakpoint];
    },
    [windowSize.width, breakpoints]
  );

  const isAtMostBreakpoint = useCallback(
    (breakpoint) => {
      if (!windowSize.width) return false;
      
      // Get the next larger breakpoint
      const breakpointEntries = Object.entries(breakpoints).sort(
        (a, b) => a[1] - b[1]
      );
      const currentIndex = breakpointEntries.findIndex(
        ([name]) => name === breakpoint
      );
      
      if (currentIndex === breakpointEntries.length - 1) {
        // This is already the largest breakpoint
        return true;
      }
      
      const nextBreakpoint = breakpointEntries[currentIndex + 1][1];
      return windowSize.width < nextBreakpoint;
    },
    [windowSize.width, breakpoints]
  );

  // Check if the window is in landscape or portrait orientation
  const isLandscape = windowSize.width > windowSize.height;
  const isPortrait = !isLandscape;

  return {
    width: windowSize.width,
    height: windowSize.height,
    breakpoint: windowSize.breakpoint,
    isBreakpoint,
    isAtLeastBreakpoint,
    isAtMostBreakpoint,
    isLandscape,
    isPortrait,
  };
};

export default useWindowSize;