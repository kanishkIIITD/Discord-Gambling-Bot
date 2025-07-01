/**
 * Performance monitoring utility for tracking and analyzing application performance
 * Provides functions to measure component render times, network requests, and user interactions
 */

// Store for performance metrics
let metrics = {
  renders: {},
  interactions: {},
  resources: [],
  navigation: [],
  longestTasks: [],
};

// Configuration options with defaults
let config = {
  maxMetricsCount: 100,
  longestTaskThreshold: 50, // ms
  slowRenderThreshold: 16, // ms (1 frame at 60fps)
  slowInteractionThreshold: 100, // ms
  enabled: process.env.NODE_ENV !== 'production',
  logToConsole: process.env.NODE_ENV !== 'production',
  samplingRate: 1.0, // 1.0 = 100% of events are tracked
};

/**
 * Initialize the performance monitor with custom configuration
 * @param {Object} customConfig - Custom configuration options
 */
export const initPerformanceMonitor = (customConfig = {}) => {
  config = { ...config, ...customConfig };
  
  if (!config.enabled) return;
  
  // Set up Performance Observer for long tasks
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      // Track long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (entry.duration >= config.longestTaskThreshold) {
            trackLongTask(entry);
          }
        });
      });
      
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      
      // Track resource timing (network requests)
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (shouldSampleEvent()) {
            trackResourceTiming(entry);
          }
        });
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      
      // Track navigation timing (page loads)
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          trackNavigationTiming(entry);
        });
      });
      
      navigationObserver.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.error('Error setting up PerformanceObserver:', e);
    }
  }
};

/**
 * Determine if an event should be sampled based on sampling rate
 * @returns {boolean} - Whether to sample this event
 */
const shouldSampleEvent = () => {
  return Math.random() <= config.samplingRate;
};

/**
 * Track component render time
 * @param {string} componentName - Name of the component being rendered
 * @param {number} duration - Time taken to render in milliseconds
 */
export const trackRender = (componentName, duration) => {
  if (!config.enabled || !shouldSampleEvent()) return;
  
  if (!metrics.renders[componentName]) {
    metrics.renders[componentName] = {
      count: 0,
      totalDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      slowRenders: 0,
    };
  }
  
  const stats = metrics.renders[componentName];
  stats.count++;
  stats.totalDuration += duration;
  stats.maxDuration = Math.max(stats.maxDuration, duration);
  stats.minDuration = Math.min(stats.minDuration, duration);
  
  if (duration > config.slowRenderThreshold) {
    stats.slowRenders++;
    
    if (config.logToConsole) {
      console.warn(`Slow render detected: ${componentName} took ${duration.toFixed(2)}ms`);
    }
  }
};

/**
 * Create a render tracker for use with React's useEffect
 * @param {string} componentName - Name of the component to track
 * @returns {Function} - Function to call at the start of rendering
 * 
 * @example
 * // In a React component:
 * const MyComponent = () => {
 *   const trackComponentRender = useRenderTracker('MyComponent');
 *   
 *   useEffect(() => {
 *     return trackComponentRender();
 *   });
 *   
 *   return <div>Content</div>;
 * };
 */
export const useRenderTracker = (componentName) => {
  return () => {
    if (!config.enabled) return () => {};
    
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      trackRender(componentName, duration);
    };
  };
};

/**
 * Track user interaction time (clicks, form submissions, etc.)
 * @param {string} interactionName - Name/description of the interaction
 * @param {number} duration - Time taken to complete in milliseconds
 */
export const trackInteraction = (interactionName, duration) => {
  if (!config.enabled || !shouldSampleEvent()) return;
  
  if (!metrics.interactions[interactionName]) {
    metrics.interactions[interactionName] = {
      count: 0,
      totalDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      slowInteractions: 0,
    };
  }
  
  const stats = metrics.interactions[interactionName];
  stats.count++;
  stats.totalDuration += duration;
  stats.maxDuration = Math.max(stats.maxDuration, duration);
  stats.minDuration = Math.min(stats.minDuration, duration);
  
  if (duration > config.slowInteractionThreshold) {
    stats.slowInteractions++;
    
    if (config.logToConsole) {
      console.warn(`Slow interaction detected: ${interactionName} took ${duration.toFixed(2)}ms`);
    }
  }
};

/**
 * Measure the time taken for a function to execute
 * @param {Function} fn - Function to measure
 * @param {string} name - Name to identify this measurement
 * @returns {any} - Return value from the function
 * 
 * @example
 * const result = measureFunction(
 *   () => expensiveCalculation(a, b),
 *   'expensiveCalculation'
 * );
 */
export const measureFunction = (fn, name) => {
  if (!config.enabled) return fn();
  
  const startTime = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - startTime;
    
    trackInteraction(name, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackInteraction(`${name} (error)`, duration);
    throw error;
  }
};

/**
 * Create a higher-order function that measures execution time
 * @param {Function} fn - Function to wrap with measurement
 * @param {string} name - Name to identify this measurement
 * @returns {Function} - Wrapped function that measures execution time
 * 
 * @example
 * const expensiveFunction = (a, b) => a * b * 1000000;
 * const measuredFunction = createMeasuredFunction(expensiveFunction, 'multiplication');
 * 
 * // Later:
 * const result = measuredFunction(5, 10);
 */
export const createMeasuredFunction = (fn, name) => {
  return (...args) => {
    if (!config.enabled) return fn(...args);
    
    const startTime = performance.now();
    try {
      const result = fn(...args);
      const duration = performance.now() - startTime;
      
      trackInteraction(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      trackInteraction(`${name} (error)`, duration);
      throw error;
    }
  };
};

/**
 * Track a long-running task
 * @param {PerformanceEntry} entry - Performance entry for the long task
 */
const trackLongTask = (entry) => {
  metrics.longestTasks.push({
    duration: entry.duration,
    startTime: entry.startTime,
    timestamp: Date.now(),
  });
  
  // Keep only the longest tasks
  if (metrics.longestTasks.length > config.maxMetricsCount) {
    metrics.longestTasks.sort((a, b) => b.duration - a.duration);
    metrics.longestTasks = metrics.longestTasks.slice(0, config.maxMetricsCount);
  }
  
  if (config.logToConsole) {
    console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
  }
};

/**
 * Track resource timing (network requests)
 * @param {PerformanceResourceTiming} entry - Resource timing entry
 */
const trackResourceTiming = (entry) => {
  // Skip tracking for certain resource types if needed
  if (entry.initiatorType === 'beacon' || entry.initiatorType === 'ping') {
    return;
  }
  
  const resourceMetric = {
    name: entry.name,
    initiatorType: entry.initiatorType,
    duration: entry.duration,
    size: entry.transferSize,
    startTime: entry.startTime,
    timestamp: Date.now(),
  };
  
  metrics.resources.push(resourceMetric);
  
  // Keep array size under control
  if (metrics.resources.length > config.maxMetricsCount) {
    metrics.resources.shift();
  }
};

/**
 * Track navigation timing (page loads)
 * @param {PerformanceNavigationTiming} entry - Navigation timing entry
 */
const trackNavigationTiming = (entry) => {
  const navigationMetric = {
    type: entry.type,
    domComplete: entry.domComplete,
    domInteractive: entry.domInteractive,
    loadEventEnd: entry.loadEventEnd,
    loadEventStart: entry.loadEventStart,
    domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
    domContentLoadedEventStart: entry.domContentLoadedEventStart,
    timestamp: Date.now(),
  };
  
  metrics.navigation.push(navigationMetric);
  
  // Keep array size under control
  if (metrics.navigation.length > 5) { // Keep only recent navigations
    metrics.navigation.shift();
  }
};

/**
 * Get all collected performance metrics
 * @returns {Object} - All performance metrics
 */
export const getPerformanceMetrics = () => {
  return { ...metrics };
};

/**
 * Clear all collected performance metrics
 */
export const clearPerformanceMetrics = () => {
  metrics = {
    renders: {},
    interactions: {},
    resources: [],
    navigation: [],
    longestTasks: [],
  };
};

/**
 * Get a summary of performance metrics
 * @returns {Object} - Summary of performance metrics
 */
export const getPerformanceSummary = () => {
  const summary = {
    slowestRenders: [],
    slowestInteractions: [],
    longestTasks: [...metrics.longestTasks].slice(0, 5),
    averageRenderTime: 0,
    totalSlowRenders: 0,
    totalSlowInteractions: 0,
  };
  
  // Process render metrics
  let totalRenderTime = 0;
  let totalRenderCount = 0;
  
  Object.entries(metrics.renders).forEach(([name, stats]) => {
    totalRenderTime += stats.totalDuration;
    totalRenderCount += stats.count;
    summary.totalSlowRenders += stats.slowRenders;
    
    summary.slowestRenders.push({
      name,
      averageDuration: stats.totalDuration / stats.count,
      maxDuration: stats.maxDuration,
      count: stats.count,
      slowCount: stats.slowRenders,
    });
  });
  
  // Process interaction metrics
  Object.entries(metrics.interactions).forEach(([name, stats]) => {
    summary.totalSlowInteractions += stats.slowInteractions;
    
    summary.slowestInteractions.push({
      name,
      averageDuration: stats.totalDuration / stats.count,
      maxDuration: stats.maxDuration,
      count: stats.count,
      slowCount: stats.slowInteractions,
    });
  });
  
  // Sort by average duration
  summary.slowestRenders.sort((a, b) => b.averageDuration - a.averageDuration);
  summary.slowestInteractions.sort((a, b) => b.averageDuration - a.averageDuration);
  
  // Limit to top 5
  summary.slowestRenders = summary.slowestRenders.slice(0, 5);
  summary.slowestInteractions = summary.slowestInteractions.slice(0, 5);
  
  // Calculate overall average render time
  summary.averageRenderTime = totalRenderCount > 0 
    ? totalRenderTime / totalRenderCount 
    : 0;
  
  return summary;
};

// Initialize with default settings
initPerformanceMonitor();