import React, { useMemo, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useUserStore, useUIStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { getBalanceHistory } from '../../services/api';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const BalanceHistoryGraph = ({ dateRange, targetUserId, guildId }) => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('BalanceHistoryGraph');
  
  // Define the fetch function for balance history
  const fetchBalanceHistory = async (userId, startDate, endDate, guildId) => {
    return await getBalanceHistory(userId, undefined, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchBalanceHistory, params);

  // Process the data with useMemo to avoid recalculations
  const chartData = useMemo(() => {
    if (!response || !response.balanceHistory || response.balanceHistory.length === 0) {
      return { labels: [], data: [] };
    }
    
          const sortedTransactions = [...response.balanceHistory].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
    
          const balanceHistory = sortedTransactions.map(tx => ({
            timestamp: new Date(tx.timestamp),
            balance: tx.balance
          }));
    
          const labels = balanceHistory.map(item =>
            item.timestamp.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })
          );
    
          const data = balanceHistory.map(item => item.balance);
    
    return { labels, data };
  }, [response]);

  const options = useMemo(() => ({
    title: {
      text: 'Balance History',
      left: 'center',
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 16,
        fontWeight: 'bold',
        color: theme === 'dark' ? '#E0E0E0' : '#212121',
      }
    },
    toolbox: {
      feature: {
        saveAsImage: {
          title: 'Save as PNG',
          name: `balance-history-${targetUserId || user?.discordId}`,
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        },
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
      formatter: params => {
        if (!params.length) return '';
        const p = params[0];
        return `${p.axisValue}<br/><span style=\"font-weight: 600;\">Balance: ${formatDisplayNumber(p.data)}</span>`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: 70,
      top: 60,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartData.labels,
      axisLabel: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0',
        },
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: value => formatDisplayNumber(value),
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
      },
      splitLine: {
        lineStyle: {
          color: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.5)',
        },
      },
    },
    series: [
      {
        name: 'Balance',
        type: 'line',
        data: chartData.data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          color: '#3b82f6',
          width: 3,
        },
        itemStyle: {
          color: '#3b82f6',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: chartData.data.length > 0 ? chartData.data.reduce((a, b) => a + b, 0) / chartData.data.length : 0,
              name: 'Average',
              lineStyle: {
                color: '#f97316',
                type: 'dashed',
              },
              label: {
                formatter: 'Avg: {c}',
                position: 'insideEndTop',
                fontFamily: "'Inter', sans-serif",
                color: '#f97316',
                padding: [2, 4],
                borderRadius: 4,
                backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              }
            }
          ]
        }
      },
    ],
    animationDuration: 900,
    animationEasing: 'cubicOut',
    legend: {
      show: false,
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
        bottom: 10,
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
  }), [theme, chartData.labels, chartData.data, user, targetUserId]);

  useEffect(() => {
    if (!loading && chartData.labels.length > 0) {
      startRenderTimer();
    }
    // No cleanup needed for startRenderTimer
    // If you want to stop timer on unmount, you can add: return () => stopRenderTimer();
  }, [loading, chartData.labels.length, startRenderTimer]);

  // Memoize the chart render event handler
  const onChartRender = useCallback(() => {
    stopRenderTimer();
  }, [stopRenderTimer]);

  if (loading) {
    return (
      <div className="h-64">
        <ChartLoadingSpinner size="lg" message="Loading balance history..." />
      </div>
    );
  }

  if (chartData.labels.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-center">No balance history available for the selected time period.</p>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 rounded-lg shadow-lg">
      <div className="h-[300px] md:h-[350px] w-full">
        <ReactECharts 
          option={options} 
          style={{ height: '100%', width: '100%' }} 
          onEvents={{
            rendered: onChartRender
          }}
        />
      </div>
    </div>
  );
};

// Apply the withOptimizedChart HOC to combine memoization and lazy loading
export default withOptimizedChart(BalanceHistoryGraph, {
  memoizeProps: ['dateRange', 'targetUserId', 'guildId'],
  chartId: 'balance-history',
  useLazyLoading: true
});