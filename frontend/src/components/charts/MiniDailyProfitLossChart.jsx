import React, { useMemo, useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useUserStore, useGuildStore, useUIStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { subDays } from 'date-fns';
import { getDailyProfitLoss } from '../../services/api';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const MiniDailyProfitLossChart = () => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('MiniDailyProfitLossChart');
  
  // Intersection Observer for lazy loading
  const chartRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
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
  const fetchMiniDailyProfitLoss = async (userId, startDate, endDate, guildId) => {
    return await getDailyProfitLoss(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: user?.discordId || '',
    startDate: dates.startDate,
    endDate: dates.endDate,
    guildId: selectedGuildId
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

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && !shouldRender) {
          // Debounce the render to prevent excessive re-renders
          const timer = setTimeout(() => {
            setShouldRender(true);
          }, 100);
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => {
      if (chartRef.current) {
        observer.unobserve(chartRef.current);
      }
    };
  }, [shouldRender]);

  // Optimized chart options with performance improvements
  const options = useMemo(() => ({
    // Performance optimizations
    animation: false, // Disable animations for mini charts
    useUTC: false, // Disable UTC for better performance
    
    // Canvas renderer for better performance
    renderer: 'canvas',
    
    // Simplified tooltip for faster rendering
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      borderRadius: 4,
      padding: 6,
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        color: theme === 'dark' ? '#f8fafc' : '#1e293b',
        fontSize: 11, // Smaller font for mini charts
        fontWeight: 'normal',
      },
      formatter: function (params) {
        const date = params[0].axisValue;
        let tooltipText = `<div style="font-weight: bold; margin-bottom: 3px;">${date}</div>`;
        
        // Calculate net profit/loss
        const netValue = params[0].value;
        const netColor = netValue >= 0 ? '#10b981' : '#ef4444';
        
        tooltipText += `<div style="font-weight: bold; color: ${netColor};">${formatDisplayNumber(netValue)}</div>`;
        
        return tooltipText;
      },
      // Faster tooltip positioning
      confine: true,
      enterable: false,
    },
    
    // Simplified grid
    grid: {
      left: '8%',
      right: '8%',
      bottom: '15%',
      top: '15%',
      containLabel: true
    },
    
    // Simplified x-axis
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
        fontSize: 9, // Smaller font
        interval: Math.max(0, Math.floor(chartData.length / 3)), // Show fewer labels
        showMaxLabel: false,
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0',
          width: 1,
        }
      },
      axisTick: { show: false },
      splitLine: { show: false }, // Remove grid lines for performance
    },
    
    // Simplified y-axis
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
        formatter: function (value) {
          return formatDisplayNumber(value);
        },
        fontSize: 9, // Smaller font
        showMaxLabel: false,
      },
      splitLine: {
        show: false, // Remove grid lines for performance
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    
    // Optimized series
    series: [
      {
        name: 'Net Profit/Loss',
        type: 'line',
        data: chartData.map(item => item.net),
        smooth: false, // Disable smooth for better performance
        symbol: 'none', // Remove symbols for better performance
        symbolSize: 0,
        areaStyle: {
          color: function(params) {
            return {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: params.value >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' },
                { offset: 1, color: params.value >= 0 ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)' }
              ]
            };
          }
        },
        lineStyle: {
          width: 1.5, // Thinner line
          color: function(params) {
            return params.value >= 0 ? '#10b981' : '#ef4444';
          }
        },
        itemStyle: {
          color: function(params) {
            return params.value >= 0 ? '#10b981' : '#ef4444';
          }
        },
        // Performance optimizations
        sampling: 'lttb', // Use LTTB sampling for large datasets
        progressive: 500, // Progressive rendering
        progressiveThreshold: 3000,
      }
    ],
    
    // Remove unnecessary features for mini charts
    legend: { show: false },
    toolbox: { show: false },
    dataZoom: { show: false },
  }), [theme, chartData]);

  useEffect(() => {
    if (!loading && chartData.length > 0 && shouldRender) {
      startRenderTimer();
    }
  }, [loading, chartData.length, startRenderTimer, shouldRender]);

  // Don't render if not visible or not ready
  if (!isVisible || !shouldRender) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Daily Profit & Loss
        </h3>
        <div className="h-32 bg-card rounded-lg animate-pulse">
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Daily Profit & Loss
        </h3>
        <div className="h-32">
          <ChartLoadingSpinner size="sm" message="Loading profit data..." />
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div ref={chartRef} className="w-full h-full">
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
    <div ref={chartRef} className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Daily Profit & Loss
      </h3>
      <ReactECharts 
        option={options} 
        style={{ height: '120px', width: '100%' }} 
        className="bg-card rounded-lg"
        notMerge={true}
        lazyUpdate={true}
        opts={{
          renderer: 'canvas',
          useDirtyRect: true, // Enable dirty rectangle optimization
        }}
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