/**
 * useChartPerformance Hook
 * 
 * A custom hook for monitoring chart rendering performance.
 * This hook helps track render times, identify slow charts,
 * and measure the impact of optimization techniques.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Global performance store to track metrics across components
const performanceStore = {
  metrics: {},
  addMetric: (chartId, renderTime) => {
    if (!performanceStore.metrics[chartId]) {
      performanceStore.metrics[chartId] = [];
    }
    
    // Keep only the last 10 render times
    if (performanceStore.metrics[chartId].length >= 10) {
      performanceStore.metrics[chartId].shift();
    }
    
    performanceStore.metrics[chartId].push({
      timestamp: Date.now(),
      renderTime
    });
  },
  getMetrics: () => performanceStore.metrics,
  getAverageRenderTime: (chartId) => {
    const metrics = performanceStore.metrics[chartId];
    if (!metrics || metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, metric) => acc + metric.renderTime, 0);
    return sum / metrics.length;
  },
  clearMetrics: () => {
    performanceStore.metrics = {};
  }
};

/**
 * Hook for monitoring chart rendering performance
 * 
 * @param {string} chartId - Unique identifier for the chart
 * @returns {Object} - Performance monitoring utilities
 */
const useChartPerformance = (chartId) => {
  const renderStartTime = useRef(null);
  const [lastRenderTime, setLastRenderTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  
  // Start timing the render
  const startRenderTimer = useCallback(() => {
    renderStartTime.current = performance.now();
    setIsRendering(true);
  }, []);
  
  // Stop timing and record the render time
  const stopRenderTimer = useCallback(() => {
    if (renderStartTime.current) {
      const endTime = performance.now();
      const renderTime = endTime - renderStartTime.current;
      
      // Update local state
      setLastRenderTime(renderTime);
      setIsRendering(false);
      
      // Add to global performance store
      performanceStore.addMetric(chartId, renderTime);
      
      // Reset the start time
      renderStartTime.current = null;
      
      return renderTime;
    }
    return 0;
  }, [chartId]);
  
  // Automatically start timing on mount
  useEffect(() => {
    startRenderTimer();
    
    // Clean up on unmount
    return () => {
      if (renderStartTime.current) {
        stopRenderTimer();
      }
    };
  }, [startRenderTimer, stopRenderTimer]);
  
  // Get the average render time for this chart
  const getAverageRenderTime = useCallback(() => {
    return performanceStore.getAverageRenderTime(chartId);
  }, [chartId]);
  
  return {
    startRenderTimer,
    stopRenderTimer,
    lastRenderTime,
    isRendering,
    getAverageRenderTime
  };
};

// Export the global performance store for use in monitoring components
export const chartPerformanceStore = performanceStore;

export default useChartPerformance;