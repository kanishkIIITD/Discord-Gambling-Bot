import React, { useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { getTimeOfDayHeatmap } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';

const TimeOfDayHeatmapChart = ({ dateRange, targetUserId, guildId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('TimeOfDayHeatmapChart');
  
  // Define the fetch function for time of day heatmap
  const fetchTimeOfDayHeatmap = async (userId, startDate, endDate, guildId) => {
    return await getTimeOfDayHeatmap(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchTimeOfDayHeatmap, params);
  
  // Process the data with useMemo to avoid unnecessary recalculations
  const { chartData, dayLabels, hourLabels } = useMemo(() => {
    if (!response || !response.heatmapData) {
      return { chartData: [], dayLabels: [], hourLabels: [] };
    }
    
    const flippedData = response.heatmapData.map(([day, hour, count]) => [hour, day, count]);
    return {
      chartData: flippedData,
      dayLabels: response.dayLabels || [],
      hourLabels: response.hourLabels || []
    };
  }, [response]);

  // Memoize chart options to prevent unnecessary recalculations
  const options = useMemo(() => ({
    title: {
      text: 'Activity by Time of Day',
      left: 'center',
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 16,
        fontWeight: 'bold',
        color: theme === 'dark' ? '#E0E0E0' : '#212121',
      }
    },
    tooltip: {
      position: 'top',
      formatter: function (params) {
        const day = dayLabels[params.value[1]];
        const hour = params.value[0];
        const count = params.value[2];
        return `${day}, ${hour}:00 - ${hour}:59<br/>Activity: ${count} transactions`;
      },
      backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 6,
      padding: 10,
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        color: theme === 'dark' ? '#f8fafc' : '#1e293b',
        fontSize: 13,
        fontWeight: 'normal',
      },
    },
    grid: {
      top: 60,
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: hourLabels.map(hour => `${hour}:00`),
      splitArea: {
        show: true
      },
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0'
        }
      },
    },
    yAxis: {
      type: 'category',
      data: dayLabels,
      splitArea: {
        show: true
      },
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0'
        }
      },
    },
    visualMap: {
      min: 0,
      max: chartData.length > 0 ? Math.max(...chartData.map(item => item[2])) : 10,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      textStyle: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
      },
      inRange: {
        color: theme === 'dark' 
          ? ['#1e293b', '#0f766e', '#059669', '#10b981', '#34d399']
          : ['#f0fdfa', '#99f6e4', '#2dd4bf', '#14b8a6', '#0d9488']
      }
    },
    series: [{
      name: 'Activity',
      type: 'heatmap',
      data: chartData,
      label: {
        show: false
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }],
    toolbox: {
      feature: {
        saveAsImage: {
          title: 'Save as PNG',
          name: `time-of-day-heatmap-${targetUserId || user?.discordId}`,
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        },
      }
    },
  }), [chartData, dayLabels, hourLabels, theme, targetUserId, user]);

  useEffect(() => {
    if (!loading && chartData.length > 0) {
      startRenderTimer();
    }
  }, [loading, chartData.length, startRenderTimer]);

  return (
    <div className="w-full h-full">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-center">Error loading activity data. Please try again later.</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-center">No activity data available for the selected time period.</p>
        </div>
      ) : (
        <>
          <ReactECharts 
            option={options} 
            style={{ height: '400px', width: '100%' }} 
            className="bg-card rounded-lg p-2"
          />
        </>
      )}
    </div>
  );
};

// Apply the withOptimizedChart HOC with custom options
export default withOptimizedChart(TimeOfDayHeatmapChart, {
  chartId: 'time-of-day-heatmap',
  memoizedProps: ['dateRange', 'targetUserId', 'guildId'],
  lazyLoad: true
});