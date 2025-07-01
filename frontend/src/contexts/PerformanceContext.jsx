import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPerformanceMetrics, getPerformanceSummary, clearPerformanceMetrics } from '../utils/performanceMonitor';

// Create context
const PerformanceContext = createContext(null);

/**
 * Provider component for performance monitoring context
 * Makes performance metrics and controls available throughout the app
 */
export const PerformanceProvider = ({ children }) => {
  const [metrics, setMetrics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(
    process.env.NODE_ENV !== 'production'
  );
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Update metrics periodically if auto-refresh is enabled
  useEffect(() => {
    if (!isMonitoringEnabled || !autoRefresh) return;
    
    const updateMetrics = () => {
      setMetrics(getPerformanceMetrics());
      setSummary(getPerformanceSummary());
    };
    
    // Initial update
    updateMetrics();
    
    // Set up interval for updates
    const intervalId = setInterval(updateMetrics, 5000); // Update every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [isMonitoringEnabled, autoRefresh]);
  
  // Refresh metrics on demand
  const refreshMetrics = () => {
    if (!isMonitoringEnabled) return;
    
    setMetrics(getPerformanceMetrics());
    setSummary(getPerformanceSummary());
  };
  
  // Clear all collected metrics
  const resetMetrics = () => {
    clearPerformanceMetrics();
    setMetrics(getPerformanceMetrics());
    setSummary(getPerformanceSummary());
  };
  
  // Toggle monitoring on/off
  const toggleMonitoring = () => {
    setIsMonitoringEnabled(prev => !prev);
  };
  
  // Toggle auto-refresh on/off
  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };
  
  const value = {
    metrics,
    summary,
    isMonitoringEnabled,
    autoRefresh,
    refreshMetrics,
    resetMetrics,
    toggleMonitoring,
    toggleAutoRefresh,
  };
  
  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};

/**
 * Hook for accessing performance monitoring context
 * @returns {Object} Performance context value
 */
export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  
  if (context === null) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  
  return context;
};

export default PerformanceContext;