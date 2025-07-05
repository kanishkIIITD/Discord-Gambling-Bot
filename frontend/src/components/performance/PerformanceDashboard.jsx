import React, { useState, useEffect, useMemo } from 'react';
import { chartPerformanceStore } from '../../hooks/useChartPerformance';
import { useUIStore } from '../../store';
import ReactECharts from 'echarts-for-react';
import './PerformanceDashboard.css';

/**
 * PerformanceDashboard Component
 * 
 * A dashboard for visualizing chart rendering performance metrics.
 * This component is only available in development mode.
 */
const PerformanceDashboard = () => {
  const theme = useUIStore(state => state.theme);
  const [metrics, setMetrics] = useState({});
  const [showDashboard, setShowDashboard] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(2000);
  
  // Refresh metrics at the specified interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (showDashboard) {
        setMetrics({...chartPerformanceStore.getMetrics()});
      }
    }, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [showDashboard, refreshInterval]);
  
  // Calculate performance statistics
  const stats = useMemo(() => {
    const result = {
      totalCharts: Object.keys(metrics).length,
      slowestChart: { id: null, time: 0 },
      fastestChart: { id: null, time: Infinity },
      averageRenderTime: 0,
      totalRenderTime: 0,
      renderCount: 0
    };
    
    Object.entries(metrics).forEach(([chartId, renderTimes]) => {
      if (renderTimes.length === 0) return;
      
      const avgTime = renderTimes.reduce((sum, metric) => sum + metric.renderTime, 0) / renderTimes.length;
      
      result.totalRenderTime += avgTime;
      result.renderCount++;
      
      if (avgTime > result.slowestChart.time) {
        result.slowestChart = { id: chartId, time: avgTime };
      }
      
      if (avgTime < result.fastestChart.time) {
        result.fastestChart = { id: chartId, time: avgTime };
      }
    });
    
    result.averageRenderTime = result.renderCount > 0 ? result.totalRenderTime / result.renderCount : 0;
    
    return result;
  }, [metrics]);
  
  // Chart options for the performance visualization
  const chartOptions = useMemo(() => {
    const chartIds = Object.keys(metrics);
    const renderTimes = chartIds.map(id => {
      const times = metrics[id] || [];
      return times.length > 0 ? 
        times.reduce((sum, metric) => sum + metric.renderTime, 0) / times.length : 
        0;
    });
    
    // Sort charts by render time (descending)
    const sortedData = chartIds.map((id, index) => ({ id, time: renderTimes[index] }))
      .sort((a, b) => b.time - a.time);
    
    const sortedIds = sortedData.map(item => item.id);
    const sortedTimes = sortedData.map(item => item.time);
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: '{b}: {c} ms'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Render Time (ms)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          color: theme === 'dark' ? '#ddd' : '#333'
        }
      },
      yAxis: {
        type: 'category',
        data: sortedIds,
        axisLabel: {
          color: theme === 'dark' ? '#ddd' : '#333'
        }
      },
      series: [{
        name: 'Average Render Time',
        type: 'bar',
        data: sortedTimes,
        itemStyle: {
          color: (params) => {
            // Color based on render time
            const value = params.value;
            if (value < 50) return '#52c41a'; // Fast (green)
            if (value < 150) return '#faad14'; // Medium (yellow)
            return '#f5222d'; // Slow (red)
          }
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c} ms'
        }
      }]
    };
  }, [metrics, theme]);
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className={`performance-dashboard ${theme} ${showDashboard ? 'expanded' : 'collapsed'}`}>
      <div className="dashboard-header" onClick={() => setShowDashboard(!showDashboard)}>
        <h3>Performance Dashboard {showDashboard ? '▼' : '▲'}</h3>
      </div>
      
      {showDashboard && (
        <div className="dashboard-content">
          <div className="stats-container">
            <div className="stat-box">
              <h4>Charts Monitored</h4>
              <p>{stats.totalCharts}</p>
            </div>
            <div className="stat-box">
              <h4>Average Render Time</h4>
              <p>{stats.averageRenderTime.toFixed(2)} ms</p>
            </div>
            <div className="stat-box">
              <h4>Slowest Chart</h4>
              <p>{stats.slowestChart.id || 'N/A'}</p>
              <p>{stats.slowestChart.time.toFixed(2)} ms</p>
            </div>
            <div className="stat-box">
              <h4>Fastest Chart</h4>
              <p>{stats.fastestChart.id || 'N/A'}</p>
              <p>{stats.fastestChart.time < Infinity ? stats.fastestChart.time.toFixed(2) : 0} ms</p>
            </div>
          </div>
          
          <div className="chart-container">
            <ReactECharts 
              option={chartOptions} 
              style={{ height: '400px', width: '100%' }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
          
          <div className="controls">
            <button onClick={() => chartPerformanceStore.clearMetrics()}>Clear Metrics</button>
            <div>
              <label>Refresh Interval: </label>
              <select 
                value={refreshInterval} 
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
              >
                <option value={1000}>1 second</option>
                <option value={2000}>2 seconds</option>
                <option value={5000}>5 seconds</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;