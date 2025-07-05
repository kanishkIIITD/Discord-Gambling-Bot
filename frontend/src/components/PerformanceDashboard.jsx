import React, { useState, useEffect } from 'react';
import { usePerformance } from '../contexts/PerformanceContext';
import ReactECharts from 'echarts-for-react';
import { useUIStore } from '../store';

/**
 * Component for displaying performance metrics in a dashboard
 * Only visible in development mode
 */
const PerformanceDashboard = () => {
  const { 
    metrics, 
    summary, 
    isMonitoringEnabled, 
    autoRefresh,
    refreshMetrics, 
    resetMetrics, 
    toggleMonitoring,
    toggleAutoRefresh
  } = usePerformance();
  const theme = useUIStore(state => state.theme);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  
  // Force refresh when dashboard is opened
  useEffect(() => {
    if (isOpen && isMonitoringEnabled) {
      refreshMetrics();
    }
  }, [isOpen, isMonitoringEnabled, refreshMetrics]);
  
  // Don't render anything in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  // Toggle dashboard visibility
  const toggleDashboard = () => {
    setIsOpen(prev => !prev);
  };
  
  // Render chart for component render times
  const renderTimesChart = () => {
    if (!metrics || !metrics.renders || Object.keys(metrics.renders).length === 0) {
      return (
        <div className="p-4 text-center text-text-secondary">
          No render data collected yet.
        </div>
      );
    }
    
    // Prepare data for chart
    const components = Object.keys(metrics.renders);
    const avgRenderTimes = components.map(name => ({
      name,
      value: metrics.renders[name].totalDuration / metrics.renders[name].count
    }));
    
    // Sort by average render time (descending)
    avgRenderTimes.sort((a, b) => b.value - a.value);
    
    // Take top 10 components
    const topComponents = avgRenderTimes.slice(0, 10);
    
    const options = {
      title: {
        text: 'Top 10 Component Render Times (avg ms)',
        left: 'center',
        textStyle: {
          color: theme === 'dark' ? '#e2e8f0' : '#334155',
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params) => {
          const data = params[0];
          const componentName = data.name;
          const avgTime = data.value.toFixed(2);
          const componentData = metrics.renders[componentName];
          
          return `
            <div>
              <strong>${componentName}</strong><br/>
              Average: ${avgTime} ms<br/>
              Count: ${componentData.count}<br/>
              Max: ${componentData.maxDuration.toFixed(2)} ms<br/>
              Slow renders: ${componentData.slowRenders}
            </div>
          `;
        }
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b'
        }
      },
      yAxis: {
        type: 'category',
        data: topComponents.map(item => item.name),
        axisLabel: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          formatter: (value) => {
            // Truncate long component names
            return value.length > 20 ? value.substring(0, 17) + '...' : value;
          }
        }
      },
      series: [
        {
          name: 'Average Render Time',
          type: 'bar',
          data: topComponents.map(item => item.value),
          itemStyle: {
            color: (params) => {
              // Color bars based on render time
              const value = params.value;
              if (value > 50) return '#ef4444'; // Red for slow
              if (value > 16) return '#f97316'; // Orange for medium
              return '#22c55e'; // Green for fast
            }
          }
        }
      ]
    };
    
    return (
      <ReactECharts 
        option={options} 
        style={{ height: '400px', width: '100%' }} 
        theme={theme === 'dark' ? 'dark' : undefined}
      />
    );
  };
  
  // Render chart for interaction times
  const interactionTimesChart = () => {
    if (!metrics || !metrics.interactions || Object.keys(metrics.interactions).length === 0) {
      return (
        <div className="p-4 text-center text-text-secondary">
          No interaction data collected yet.
        </div>
      );
    }
    
    // Prepare data for chart
    const interactions = Object.keys(metrics.interactions);
    const avgTimes = interactions.map(name => ({
      name,
      value: metrics.interactions[name].totalDuration / metrics.interactions[name].count
    }));
    
    // Sort by average time (descending)
    avgTimes.sort((a, b) => b.value - a.value);
    
    // Take top 10 interactions
    const topInteractions = avgTimes.slice(0, 10);
    
    const options = {
      title: {
        text: 'Top 10 Interaction Times (avg ms)',
        left: 'center',
        textStyle: {
          color: theme === 'dark' ? '#e2e8f0' : '#334155',
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params) => {
          const data = params[0];
          const name = data.name;
          const avgTime = data.value.toFixed(2);
          const interactionData = metrics.interactions[name];
          
          return `
            <div>
              <strong>${name}</strong><br/>
              Average: ${avgTime} ms<br/>
              Count: ${interactionData.count}<br/>
              Max: ${interactionData.maxDuration.toFixed(2)} ms<br/>
              Slow interactions: ${interactionData.slowInteractions}
            </div>
          `;
        }
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b'
        }
      },
      yAxis: {
        type: 'category',
        data: topInteractions.map(item => item.name),
        axisLabel: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          formatter: (value) => {
            // Truncate long names
            return value.length > 25 ? value.substring(0, 22) + '...' : value;
          }
        }
      },
      series: [
        {
          name: 'Average Time',
          type: 'bar',
          data: topInteractions.map(item => item.value),
          itemStyle: {
            color: (params) => {
              // Color bars based on time
              const value = params.value;
              if (value > 500) return '#ef4444'; // Red for very slow
              if (value > 100) return '#f97316'; // Orange for slow
              return '#22c55e'; // Green for fast
            }
          }
        }
      ]
    };
    
    return (
      <ReactECharts 
        option={options} 
        style={{ height: '400px', width: '100%' }} 
        theme={theme === 'dark' ? 'dark' : undefined}
      />
    );
  };
  
  // Render chart for resource loading times
  const resourceTimingChart = () => {
    if (!metrics || !metrics.resources || metrics.resources.length === 0) {
      return (
        <div className="p-4 text-center text-text-secondary">
          No resource timing data collected yet.
        </div>
      );
    }
    
    // Group resources by initiator type
    const resourcesByType = {};
    metrics.resources.forEach(resource => {
      const type = resource.initiatorType || 'other';
      if (!resourcesByType[type]) {
        resourcesByType[type] = [];
      }
      resourcesByType[type].push(resource);
    });
    
    // Calculate average duration by type
    const avgDurationByType = Object.entries(resourcesByType).map(([type, resources]) => {
      const totalDuration = resources.reduce((sum, r) => sum + r.duration, 0);
      return {
        name: type,
        value: totalDuration / resources.length
      };
    });
    
    // Sort by average duration (descending)
    avgDurationByType.sort((a, b) => b.value - a.value);
    
    const options = {
      title: {
        text: 'Resource Loading Times by Type (avg ms)',
        left: 'center',
        textStyle: {
          color: theme === 'dark' ? '#e2e8f0' : '#334155',
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const type = params.name;
          const resources = resourcesByType[type];
          const count = resources.length;
          const avgTime = params.value.toFixed(2);
          const totalSize = resources.reduce((sum, r) => sum + (r.size || 0), 0) / 1024;
          
          return `
            <div>
              <strong>${type}</strong><br/>
              Count: ${count}<br/>
              Average time: ${avgTime} ms<br/>
              Total size: ${totalSize.toFixed(2)} KB
            </div>
          `;
        }
      },
      series: [
        {
          name: 'Resource Types',
          type: 'pie',
          radius: ['40%', '70%'],
          itemStyle: {
            borderRadius: 4,
            borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {c} ms',
            color: theme === 'dark' ? '#e2e8f0' : '#334155',
          },
          data: avgDurationByType
        }
      ]
    };
    
    return (
      <ReactECharts 
        option={options} 
        style={{ height: '400px', width: '100%' }} 
        theme={theme === 'dark' ? 'dark' : undefined}
      />
    );
  };
  
  // Render summary statistics
  const renderSummary = () => {
    if (!summary) {
      return (
        <div className="p-4 text-center text-text-secondary">
          No performance data collected yet.
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Overall stats */}
        <div className="bg-card rounded-lg p-4 shadow-md">
          <h3 className="text-lg font-semibold mb-2">Overall Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-secondary text-sm">Average Render Time</p>
              <p className="text-xl font-bold">
                {summary.averageRenderTime.toFixed(2)} ms
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-sm">Slow Renders</p>
              <p className="text-xl font-bold">{summary.totalSlowRenders}</p>
            </div>
            <div>
              <p className="text-text-secondary text-sm">Slow Interactions</p>
              <p className="text-xl font-bold">{summary.totalSlowInteractions}</p>
            </div>
            <div>
              <p className="text-text-secondary text-sm">Long Tasks</p>
              <p className="text-xl font-bold">{summary.longestTasks.length}</p>
            </div>
          </div>
        </div>
        
        {/* Slowest components */}
        <div className="bg-card rounded-lg p-4 shadow-md">
          <h3 className="text-lg font-semibold mb-2">Slowest Components</h3>
          {summary.slowestRenders.length > 0 ? (
            <ul className="space-y-2">
              {summary.slowestRenders.map((item, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span className="truncate max-w-[70%]" title={item.name}>
                    {item.name}
                  </span>
                  <span className={`font-mono ${item.averageDuration > 16 ? 'text-error' : 'text-text-primary'}`}>
                    {item.averageDuration.toFixed(2)} ms
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">No component render data available</p>
          )}
        </div>
        
        {/* Slowest interactions */}
        <div className="bg-card rounded-lg p-4 shadow-md">
          <h3 className="text-lg font-semibold mb-2">Slowest Interactions</h3>
          {summary.slowestInteractions.length > 0 ? (
            <ul className="space-y-2">
              {summary.slowestInteractions.map((item, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span className="truncate max-w-[70%]" title={item.name}>
                    {item.name}
                  </span>
                  <span className={`font-mono ${item.averageDuration > 100 ? 'text-error' : 'text-text-primary'}`}>
                    {item.averageDuration.toFixed(2)} ms
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">No interaction data available</p>
          )}
        </div>
        
        {/* Longest tasks */}
        <div className="bg-card rounded-lg p-4 shadow-md">
          <h3 className="text-lg font-semibold mb-2">Longest Tasks</h3>
          {summary.longestTasks.length > 0 ? (
            <ul className="space-y-2">
              {summary.longestTasks.map((task, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span>Task #{index + 1}</span>
                  <span className={`font-mono ${task.duration > 100 ? 'text-error' : 'text-text-primary'}`}>
                    {task.duration.toFixed(2)} ms
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">No long tasks detected</p>
          )}
        </div>
      </div>
    );
  };
  
  // Render dashboard content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderSummary();
      case 'renders':
        return renderTimesChart();
      case 'interactions':
        return interactionTimesChart();
      case 'resources':
        return resourceTimingChart();
      default:
        return renderSummary();
    }
  };
  
  // Render tab button
  const TabButton = ({ id, label }) => (
    <button
      className={`px-4 py-2 text-sm font-medium ${activeTab === id ? 'bg-primary text-white' : 'bg-card hover:bg-card-hover'}`}
      onClick={() => setActiveTab(id)}
    >
      {label}
    </button>
  );
  
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggleDashboard}
        className="fixed bottom-4 right-4 z-50 bg-primary text-white p-2 rounded-full shadow-lg hover:bg-primary-dark transition-colors"
        title="Toggle Performance Dashboard"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
      
      {/* Dashboard panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold">Performance Dashboard</h2>
              <div className="flex space-x-2">
                <button
                  onClick={refreshMetrics}
                  className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark text-sm"
                  disabled={!isMonitoringEnabled}
                >
                  Refresh
                </button>
                <button
                  onClick={resetMetrics}
                  className="px-3 py-1 bg-error text-white rounded hover:bg-error-dark text-sm"
                  disabled={!isMonitoringEnabled}
                >
                  Reset
                </button>
                <button
                  onClick={toggleMonitoring}
                  className={`px-3 py-1 rounded text-sm ${isMonitoringEnabled ? 'bg-success text-white' : 'bg-card text-text-primary'}`}
                >
                  {isMonitoringEnabled ? 'Monitoring On' : 'Monitoring Off'}
                </button>
                <button
                  onClick={toggleAutoRefresh}
                  className={`px-3 py-1 rounded text-sm ${autoRefresh ? 'bg-info text-white' : 'bg-card text-text-primary'}`}
                  disabled={!isMonitoringEnabled}
                >
                  {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
                </button>
                <button
                  onClick={toggleDashboard}
                  className="px-3 py-1 bg-card hover:bg-card-hover rounded text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-border flex space-x-1 p-1 bg-card-alt">
              <TabButton id="summary" label="Summary" />
              <TabButton id="renders" label="Component Renders" />
              <TabButton id="interactions" label="Interactions" />
              <TabButton id="resources" label="Resources" />
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-auto">
              {isMonitoringEnabled ? (
                renderContent()
              ) : (
                <div className="p-8 text-center text-text-secondary">
                  <p className="text-lg">Performance monitoring is currently disabled.</p>
                  <p className="mt-2">Enable monitoring to collect and view performance metrics.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceDashboard;