import React from 'react';

/**
 * Higher-order component (HOC) that adds memoization to a component
 * with configurable comparison function
 * 
 * @param {React.ComponentType} Component - The component to memoize
 * @param {Function} [areEqual] - Custom comparison function (optional)
 * @returns {React.MemoExoticComponent} - Memoized component
 */
const withMemoization = (Component, areEqual) => {
  // Use displayName from the wrapped component or fallback to its name
  const displayName = Component.displayName || Component.name || 'Component';
  
  // Create the memoized version of the component
  const MemoizedComponent = React.memo(Component, areEqual);
  
  // Set a proper displayName for debugging
  MemoizedComponent.displayName = `Memoized(${displayName})`;
  
  return MemoizedComponent;
};

/**
 * Utility function to create a props comparison function that only compares
 * specific props, ignoring others
 * 
 * @param {string[]} propsToCompare - Array of prop names to compare
 * @returns {Function} - Comparison function for React.memo
 */
export const createPropsComparator = (propsToCompare) => {
  return (prevProps, nextProps) => {
    // If no props specified, compare all props
    if (!propsToCompare || propsToCompare.length === 0) {
      return Object.keys(prevProps).every(key => {
        return prevProps[key] === nextProps[key];
      });
    }
    
    // Only compare the specified props
    return propsToCompare.every(prop => {
      return prevProps[prop] === nextProps[prop];
    });
  };
};

/**
 * Utility function to create a deep comparison function for complex objects
 * 
 * @param {string[]} deepCompareProps - Array of prop names to deep compare
 * @returns {Function} - Comparison function for React.memo
 */
export const createDeepPropsComparator = (deepCompareProps) => {
  return (prevProps, nextProps) => {
    // For props not in the deepCompareProps array, do a shallow comparison
    const shallowProps = Object.keys(prevProps).filter(
      prop => !deepCompareProps.includes(prop)
    );
    
    // Check shallow props first (for performance)
    const shallowEqual = shallowProps.every(prop => {
      return prevProps[prop] === nextProps[prop];
    });
    
    if (!shallowEqual) return false;
    
    // Then do deep comparison for specified props
    return deepCompareProps.every(prop => {
      return JSON.stringify(prevProps[prop]) === JSON.stringify(nextProps[prop]);
    });
  };
};

export default withMemoization;