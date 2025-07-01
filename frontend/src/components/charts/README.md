# Chart Components Optimization Guide

## Overview

This directory contains chart components for the Gambling Analytics Dashboard. All charts have been optimized for performance using various techniques to ensure smooth rendering and efficient data loading.

## Optimization Techniques

### 1. Component Memoization

All chart components use React's memoization to prevent unnecessary re-renders:

```jsx
// Basic memoization
export default React.memo(ChartComponent);

// Advanced memoization with custom comparison
export default withMemoization(ChartComponent, createPropsComparator(['dateRange', 'userId']));
```

### 2. Data and Computation Optimization

- **useMemo**: Used to memoize expensive calculations and chart options
- **useChartDataCache**: Custom hook for fetching and caching chart data
- **Data Processing**: Performed within useMemo to avoid redundant calculations

```jsx
const options = useMemo(() => ({
  // Chart options here
}), [dependencies]);

const { data, loading } = useChartDataCache(fetchFunction, params);
```

### 3. Rendering Optimization

- **Lazy Loading**: Charts are loaded only when they become visible
- **LazyChart Component**: Wrapper that renders charts only when in viewport
- **withOptimizedChart**: HOC that combines multiple optimization techniques

```jsx
export default withOptimizedChart(ChartComponent, {
  memoizeProps: ['dateRange', 'userId'],
  useLazyLoading: true,
  optimizeOptions: true
});
```

### 4. ECharts-specific Optimizations

- **lazyUpdate**: Defers chart updates for better performance
- **notMerge**: Completely redraws the chart instead of merging data
- **createOptimizedChartOptions**: Utility for optimizing ECharts options

```jsx
<ReactECharts 
  option={options} 
  notMerge={true}
  lazyUpdate={true}
/>
```

## Best Practices

1. **Always memoize chart components** using React.memo or withMemoization
2. **Use useMemo for chart options** to prevent unnecessary recalculations
3. **Implement data caching** with useChartDataCache for API calls
4. **Apply lazy loading** for charts that are not immediately visible
5. **Optimize ECharts options** for better rendering performance
6. **Use withOptimizedChart** for new chart components to apply all optimizations

## Utility Files

- **chartOptimizer.js**: Provides utilities for chart optimization
- **withMemoization.js**: HOC for memoizing components with custom comparison
- **withOptimizedChart.js**: Combined HOC for all optimization techniques
- **useChartDataCache.js**: Hook for data fetching and caching

## Dashboard Components

- **ChartDashboard.jsx**: Main dashboard with lazy-loaded charts
- **ChartTicker.jsx**: Rotating display of mini charts

## Performance Monitoring

Use the PerformanceDashboard component (available in development mode) to monitor chart rendering times and identify optimization opportunities.