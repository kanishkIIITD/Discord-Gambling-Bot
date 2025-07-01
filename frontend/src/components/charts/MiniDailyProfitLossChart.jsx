import React, { useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { subDays } from 'date-fns';
import { getDailyProfitLoss } from '../../services/api';

const MiniDailyProfitLossChart = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('MiniDailyProfitLossChart');
  
  // Get the dates for the last 7 days
  const dates = useMemo(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    return {
      startDate: sevenDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  }, []);

  // Define the fetch function for mini daily profit/loss
  const fetchMiniDailyProfitLoss = async (userId, startDate, endDate) => {
    return await getDailyProfitLoss(userId, startDate, endDate);
  };

  const params = {
    userId: user?.discordId || '',
    startDate: dates.startDate,
    endDate: dates.endDate
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: rawData = [], loading, error: queryError } = useChartDataCache(fetchMiniDailyProfitLoss, params);

  // Ensure chartData is always an array
  const chartData = useMemo(() => {
    if (Array.isArray(rawData)) return rawData;
    if (rawData && Array.isArray(rawData.profitData)) return rawData.profitData;
    return [];
  }, [rawData]);

  // Error state derived from query error
  const error = queryError ? 'Failed to load chart data' : null;

  // Memoize chart options to prevent unnecessary recalculations
  const options = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 6,
      padding: 10,
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        color: theme === 'dark' ? '#f8fafc' : '#1e293b',
        fontSize: 12,
        fontWeight: 'normal',
      },
      formatter: function (params) {
        const date = params[0].axisValue;
        let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${date}</div>`;
        
        // Calculate net profit/loss
        const netValue = params[0].value;
        const netColor = netValue >= 0 ? '#10b981' : '#ef4444';
        
        tooltipText += `<div style="font-weight: bold; color: ${netColor};">Net: ${formatDisplayNumber(netValue)}</div>`;
        
        return tooltipText;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      }),
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
        fontSize: 10,
        interval: Math.floor(chartData.length / 4)
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
        },
        fontSize: 10
      },
      splitLine: {
        lineStyle: {
          color: theme === 'dark' ? 'rgba(51, 65, 85, 0.2)' : 'rgba(226, 232, 240, 0.5)'
        }
      }
    },
    series: [
      {
        name: 'Net Profit/Loss',
        type: 'line',
        data: chartData.map(item => item.net),
        areaStyle: {
          color: function(params) {
            // Use gradient with appropriate color based on value
            // const color = params.value >= 0 ? '#10b981' : '#ef4444';
            return {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: params.value >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)' },
                { offset: 1, color: params.value >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)' }
              ]
            };
          }
        },
        lineStyle: {
          width: 2,
          color: function(params) {
            return params.value >= 0 ? '#10b981' : '#ef4444';
          }
        },
        symbol: 'circle',
        symbolSize: 4,
        itemStyle: {
          color: function(params) {
            return params.value >= 0 ? '#10b981' : '#ef4444';
          }
        }
      }
    ],
    animationDuration: 900,
    animationEasing: 'cubicOut',
  }), [theme, chartData]);

  useEffect(() => {
    if (!loading && chartData.length > 0) {
      startRenderTimer();
    }
    // No cleanup needed for startRenderTimer
    // If you want to stop timer on unmount, you can add: return () => stopRenderTimer();
  }, [loading, chartData.length, startRenderTimer]);

  if (loading) {
    return (
      <div className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Daily Profit & Loss
        </h3>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Daily Profit & Loss
        </h3>
        <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
          <p className="text-center">No profit/loss data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Daily Profit & Loss
      </h3>
      <ReactECharts 
        option={options} 
        style={{ height: '120px', width: '100%' }} 
        className="bg-card rounded-lg"
        notMerge={true}
        lazyUpdate={true}
        onEvents={{
          // Stop timing when the chart has finished rendering
          'rendered': stopRenderTimer
        }}
      />
    </div>
  );
};

// Apply the withOptimizedChart HOC to combine memoization and lazy loading
export default withOptimizedChart(MiniDailyProfitLossChart, {
  chartId: 'mini-daily-profit-loss',
  useLazyLoading: true
});