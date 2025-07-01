/**
 * withOptimizedChart Higher-Order Component
 * 
 * A HOC that combines multiple optimization techniques for chart components:
 * - Memoization with custom prop comparison
 * - Lazy loading when the chart becomes visible
 * - Optimized chart options
 */

import React from 'react';
import { LazyChart, createOptimizedChartOptions } from './chartOptimizer';
import withMemoization, { createPropsComparator } from './withMemoization';

/**
 * Higher-order component that applies multiple optimization techniques to a chart component
 * 
 * @param {React.ComponentType} ChartComponent - The chart component to optimize
 * @param {Object} options - Configuration options
 * @param {string[]} options.memoizeProps - Props to include in memoization comparison
 * @param {boolean} options.useLazyLoading - Whether to apply lazy loading (default: true)
 * @param {boolean} options.optimizeOptions - Whether to optimize chart options (default: true)
 * @param {React.ComponentType} options.fallback - Custom loading component
 * @returns {React.ComponentType} - The optimized chart component
 */
const withOptimizedChart = (ChartComponent, options = {}) => {
  const {
    memoizeProps = [],
    useLazyLoading = true,
    optimizeOptions = true,
    fallback = null
  } = options;
  
  // Step 1: Create a component that applies optimized chart options if needed
  const OptimizedChartComponent = (props) => {
    // Apply optimized chart options if requested
    if (optimizeOptions && props.option) {
      const optimizedProps = {
        ...props,
        option: createOptimizedChartOptions(props.option)
      };
      return <ChartComponent {...optimizedProps} />;
    }
    
    return <ChartComponent {...props} />;
  };
  
  // Step 2: Apply memoization with custom prop comparison
  const MemoizedChart = withMemoization(
    OptimizedChartComponent,
    memoizeProps.length > 0 ? createPropsComparator(memoizeProps) : undefined
  );
  
  // Step 3: Apply lazy loading if requested
  if (useLazyLoading) {
    return (props) => (
      <LazyChart
        ChartComponent={MemoizedChart}
        chartProps={props}
        fallback={fallback}
      />
    );
  }
  
  // If lazy loading is not requested, just return the memoized component
  return MemoizedChart;
};

export default withOptimizedChart;