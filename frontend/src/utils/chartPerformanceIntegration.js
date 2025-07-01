/**
 * Chart Performance Integration Utility
 * 
 * This utility integrates the chart performance monitoring system with the application's
 * main performance monitoring system. It allows chart rendering metrics to be included
 * in the overall performance dashboard and analytics.
 */

import { chartPerformanceStore } from '../hooks/useChartPerformance';

/**
 * Registers chart performance metrics with the main performance monitoring system
 * @param {Function} registerMetric - Function from the main performance system to register metrics
 */
export const registerChartPerformanceMonitoring = (registerMetric) => {
  if (!registerMetric || typeof registerMetric !== 'function') {
    console.warn('Chart performance integration: registerMetric is not a function');
    return;
  }
  
  // Register a function to collect chart metrics
  registerMetric('chartRendering', () => {
    const metrics = chartPerformanceStore.getMetrics();
    const chartIds = Object.keys(metrics);
    
    // Calculate summary statistics
    const summary = {
      totalCharts: chartIds.length,
      averageRenderTime: 0,
      slowestChart: { id: null, time: 0 },
      fastestChart: { id: null, time: Infinity },
      totalRenderCount: 0
    };
    
    // Process each chart's metrics
    chartIds.forEach(chartId => {
      const chartMetrics = metrics[chartId];
      if (!chartMetrics || chartMetrics.length === 0) return;
      
      const avgTime = chartMetrics.reduce((sum, metric) => sum + metric.renderTime, 0) / chartMetrics.length;
      summary.totalRenderCount += chartMetrics.length;
      
      if (avgTime > summary.slowestChart.time) {
        summary.slowestChart = { id: chartId, time: avgTime };
      }
      
      if (avgTime < summary.fastestChart.time) {
        summary.fastestChart = { id: chartId, time: avgTime };
      }
    });
    
    // Calculate overall average
    if (summary.totalCharts > 0) {
      const totalTime = chartIds.reduce((sum, chartId) => {
        const chartMetrics = metrics[chartId];
        if (!chartMetrics || chartMetrics.length === 0) return sum;
        
        const avgTime = chartMetrics.reduce((s, metric) => s + metric.renderTime, 0) / chartMetrics.length;
        return sum + avgTime;
      }, 0);
      
      summary.averageRenderTime = totalTime / summary.totalCharts;
    }
    
    // Return both raw metrics and summary
    return {
      raw: metrics,
      summary
    };
  });
};

/**
 * Initializes chart performance monitoring integration
 * This should be called during application startup
 */
export const initChartPerformanceIntegration = () => {
  // Only initialize in development mode
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  try {
    // Dynamically import the performance monitor to avoid circular dependencies
    import('./performanceMonitor').then(({ registerMetricCollector }) => {
      if (registerMetricCollector) {
        registerChartPerformanceMonitoring(registerMetricCollector);
        console.log('Chart performance monitoring integrated successfully');
      }
    }).catch(err => {
      console.warn('Failed to integrate chart performance monitoring:', err);
    });
  } catch (error) {
    console.warn('Error initializing chart performance integration:', error);
  }
};