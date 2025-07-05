/**
 * Chart Performance Monitor
 * 
 * Specialized performance monitoring for chart rendering to identify
 * and resolve long tasks caused by chart operations
 */

class ChartPerformanceMonitor {
  constructor() {
    this.metrics = {
      chartRenders: {},
      longTasks: [],
      renderTimes: [],
      workerUsage: {
        enabled: false,
        fallbacks: 0,
        errors: 0
      }
    };
    
    this.config = {
      enabled: process.env.NODE_ENV !== 'production',
      logToConsole: process.env.NODE_ENV !== 'production',
      longTaskThreshold: 50, // ms
      slowRenderThreshold: 100, // ms
      maxMetricsCount: 50
    };
    
    this.init();
  }

  init() {
    if (!this.config.enabled) return;

    // Monitor long tasks specifically for chart operations
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          
          entries.forEach((entry) => {
            if (entry.duration >= this.config.longTaskThreshold) {
              this.trackLongTask(entry);
            }
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.error('Error setting up chart performance observer:', e);
      }
    }
  }

  trackChartRender(chartName, duration) {
    if (!this.config.enabled) return;

    if (!this.metrics.chartRenders[chartName]) {
      this.metrics.chartRenders[chartName] = {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        minDuration: Infinity,
        slowRenders: 0,
        averageDuration: 0
      };
    }

    const stats = this.metrics.chartRenders[chartName];
    stats.count++;
    stats.totalDuration += duration;
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.averageDuration = stats.totalDuration / stats.count;

    if (duration > this.config.slowRenderThreshold) {
      stats.slowRenders++;
      
      if (this.config.logToConsole) {
        console.warn(`Slow chart render detected: ${chartName} took ${duration.toFixed(2)}ms`);
      }
    }

    // Keep track of recent render times
    this.metrics.renderTimes.push({
      chartName,
      duration,
      timestamp: Date.now()
    });

    // Keep only recent render times
    if (this.metrics.renderTimes.length > this.config.maxMetricsCount) {
      this.metrics.renderTimes.shift();
    }
  }

  trackLongTask(entry) {
    this.metrics.longTasks.push({
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now(),
    });
    
    // Keep only the longest tasks
    if (this.metrics.longTasks.length > this.config.maxMetricsCount) {
      this.metrics.longTasks.sort((a, b) => b.duration - a.duration);
      this.metrics.longTasks = this.metrics.longTasks.slice(0, this.config.maxMetricsCount);
    }
    
    if (this.config.logToConsole) {
      console.warn(`Chart long task detected: ${entry.duration.toFixed(2)}ms`);
    }
  }

  trackWorkerUsage(enabled, fallback = false, error = false) {
    this.metrics.workerUsage.enabled = enabled;
    if (fallback) this.metrics.workerUsage.fallbacks++;
    if (error) this.metrics.workerUsage.errors++;
  }

  measureChartRender(chartName, renderFn) {
    if (!this.config.enabled) return renderFn();

    const startTime = performance.now();
    try {
      const result = renderFn();
      const duration = performance.now() - startTime;
      this.trackChartRender(chartName, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.trackChartRender(`${chartName} (error)`, duration);
      throw error;
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getSummary() {
    const summary = {
      slowestCharts: [],
      averageRenderTime: 0,
      totalSlowRenders: 0,
      longestTasks: this.metrics.longTasks.slice(0, 5),
      workerUsage: this.metrics.workerUsage
    };

    // Process chart render metrics
    let totalRenderTime = 0;
    let totalRenderCount = 0;

    Object.entries(this.metrics.chartRenders).forEach(([name, stats]) => {
      totalRenderTime += stats.totalDuration;
      totalRenderCount += stats.count;
      summary.totalSlowRenders += stats.slowRenders;

      summary.slowestCharts.push({
        name,
        averageDuration: stats.averageDuration,
        maxDuration: stats.maxDuration,
        count: stats.count,
        slowCount: stats.slowRenders,
      });
    });

    // Sort by average duration
    summary.slowestCharts.sort((a, b) => b.averageDuration - a.averageDuration);
    summary.slowestCharts = summary.slowestCharts.slice(0, 5);

    // Calculate overall average render time
    summary.averageRenderTime = totalRenderCount > 0 
      ? totalRenderTime / totalRenderCount 
      : 0;

    return summary;
  }

  clear() {
    this.metrics = {
      chartRenders: {},
      longTasks: [],
      renderTimes: [],
      workerUsage: {
        enabled: false,
        fallbacks: 0,
        errors: 0
      }
    };
  }

  // Performance recommendations based on metrics
  getRecommendations() {
    const summary = this.getSummary();
    const recommendations = [];

    if (summary.averageRenderTime > 100) {
      recommendations.push('Consider using web workers for chart data processing');
    }

    if (summary.totalSlowRenders > 10) {
      recommendations.push('Implement virtual rendering for charts');
    }

    if (summary.longestTasks.length > 0) {
      const avgLongTaskDuration = summary.longestTasks.reduce((sum, task) => sum + task.duration, 0) / summary.longestTasks.length;
      if (avgLongTaskDuration > 200) {
        recommendations.push('Use requestIdleCallback for chart rendering');
      }
    }

    if (summary.workerUsage.fallbacks > 5) {
      recommendations.push('Web worker fallbacks detected - check worker implementation');
    }

    return recommendations;
  }
}

// Create singleton instance
const chartPerformanceMonitor = new ChartPerformanceMonitor();

export default chartPerformanceMonitor; 