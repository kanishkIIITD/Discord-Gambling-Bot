import React, { useMemo, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { getDailyProfitLoss } from '../../services/api';

const DailyProfitLossChart = ({ dateRange, targetUserId, guildId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('DailyProfitLossChart');
  
  // Get the dates for the last 30 days
  const dates = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    return {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  }, []);

  // Define the fetch function for daily profit/loss
  const fetchDailyProfitLoss = async (userId, startDate, endDate, guildId) => {
    return await getDailyProfitLoss(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange?.startDate || dates.startDate,
    endDate: dateRange?.endDate || dates.endDate,
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchDailyProfitLoss, params);

  // Extract and process chart data with useMemo
  const chartData = useMemo(() => {
    return response?.profitData ?? [];
  }, [response]);

  // Memoize chart options to prevent unnecessary recalculations
  const options = useMemo(() => ({
    title: {
      text: 'Daily Profit & Loss',
      left: 'center',
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 16,
        fontWeight: 'bold',
        color: theme === 'dark' ? '#E0E0E0' : '#212121',
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 6,
      padding: 10,
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        color: theme === 'dark' ? '#f8fafc' : '#1e293b',
        fontSize: 13,
        fontWeight: 'normal',
      },
      formatter: function (params) {
        const date = params[0].axisValue;
        let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${date}</div>`;
        
        params.forEach(param => {
          const color = param.color;
          const value = formatDisplayNumber(param.value);
          const name = param.seriesName;
          tooltipText += `<div style="display: flex; align-items: center; margin: 3px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 50%; margin-right: 5px;"></span>
            <span>${name}: ${value}</span>
          </div>`;
        });
        
        // Add net profit/loss if we have both won and lost data
        if (params.length >= 2) {
          const wonValue = params.find(p => p.seriesName === 'Won')?.value || 0;
          const lostValue = params.find(p => p.seriesName === 'Lost')?.value || 0;
          const netValue = wonValue - lostValue;
          const netColor = netValue >= 0 ? '#10b981' : '#ef4444';
          
          tooltipText += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed ${theme === 'dark' ? '#475569' : '#cbd5e1'};">
            <span style="font-weight: bold; color: ${netColor};">Net: ${formatDisplayNumber(netValue)}</span>
          </div>`;
        }
        
        return tooltipText;
      }
    },
    legend: {
      data: ['Won', 'Lost', 'Net Profit/Loss'],
      top: 30,
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: 60,
      top: 80,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.map(item => item.date),
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
        formatter: function (value) {
          // Format date to be more readable (e.g., "Jan 01")
          const date = new Date(value);
          return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        }
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0'
        }
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
        formatter: function (value) {
          return formatDisplayNumber(value);
        }
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0'
        }
      },
      splitLine: {
        lineStyle: {
          color: theme === 'dark' ? '#1e293b' : '#f1f5f9'
        }
      }
    },
    series: [
      {
        name: 'Won',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: chartData.map(item => item.won),
        itemStyle: {
          color: '#10b981' // Green for wins
        }
      },
      {
        name: 'Lost',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: chartData.map(item => item.lost),
        itemStyle: {
          color: '#ef4444' // Red for losses
        }
      },
      {
        name: 'Net Profit/Loss',
        type: 'line',
        emphasis: { focus: 'series' },
        data: chartData.map(item => item.net),
        lineStyle: {
          width: 3,
          color: theme === 'dark' ? '#60a5fa' : '#3b82f6' // Blue for net
        },
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: function(params) {
            return params.value >= 0 ? '#10b981' : '#ef4444';
          },
          borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }
      }
    ],
    toolbox: {
      feature: {
        saveAsImage: {
          title: 'Save as PNG',
          name: `daily-profit-loss-${targetUserId || user?.discordId}`,
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        },
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        type: 'slider',
        height: 20,
        bottom: 20,
        start: 0,
        end: 100,
        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
        backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
        fillerColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
        handleStyle: {
          color: '#3b82f6',
        },
        textStyle: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          fontFamily: "'Inter', sans-serif",
        },
      },
    ],
  }), [chartData, theme, user, targetUserId]);

  useEffect(() => {
    if (!loading && chartData.length > 0) {
      startRenderTimer();
    }
    // No cleanup needed for startRenderTimer
    // If you want to stop timer on unmount, you can add: return () => stopRenderTimer();
  }, [loading, chartData.length, startRenderTimer]);

  // Memoize the chart render event handler
  const onChartRender = useCallback(() => {
    stopRenderTimer();
  }, [stopRenderTimer]);

    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (chartData.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-center">No profit/loss data available for the selected time period.</p>
        </div>
      );
    }
    
    return (
    <div className="w-full h-full">
      <ReactECharts 
        option={options} 
        style={{ height: '400px', width: '100%' }} 
        className="bg-card rounded-lg p-2"
        onEvents={{
          rendered: onChartRender
        }}
      />
    </div>
  );
};

// Apply the withOptimizedChart HOC to combine memoization and lazy loading
export default withOptimizedChart(DailyProfitLossChart, {
  memoizeProps: ['dateRange', 'targetUserId', 'guildId'],
  chartId: 'daily-profit-loss',
  useLazyLoading: true
});