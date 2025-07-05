import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { getGamblingPerformance } from '../../services/api';
import { useUserStore, useUIStore, useGuildStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import { createOptimizedChartOptions } from '../../utils/chartOptimizer';
import useChartDataCache from '../../hooks/useChartDataCache';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const MiniGamblingWinLossRatioChart = () => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);

  // Intersection Observer for lazy loading
  const chartRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Memoize date range to prevent re-creation on every render
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 30);
    return { startDate: start, endDate: end };
  }, []);

  // Memoize params to prevent infinite re-fetching
  const params = useMemo(() => ({
    userId: user?.discordId || '',
    startDate,
    endDate,
    guildId: selectedGuildId
  }), [user?.discordId, startDate, endDate, selectedGuildId]);

  // Define the fetch function for gambling performance
  const fetchGamblingPerformance = async (userId, startDate, endDate, guildId) => {
    return await getGamblingPerformance(userId, startDate, endDate, guildId);
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading } = useChartDataCache(fetchGamblingPerformance, params);

  // Memoize chart data
  const chartData = useMemo(() => {
    if (response && response.totalWon !== undefined && response.totalLost !== undefined) {
      const wins = response.totalWon || 0;
      const losses = response.totalLost || 0;
      const ratio = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;
      return { wins, losses, ratio };
    }
    return { wins: 0, losses: 0, ratio: 0 };
  }, [response]);

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
  const options = useMemo(() => createOptimizedChartOptions({
    // Performance optimizations
    animation: false, // Disable animations for mini charts
    useUTC: false, // Disable UTC for better performance
    
    // Canvas renderer for better performance
    renderer: 'canvas',
    
    // Simplified tooltip for faster rendering
    tooltip: {
      trigger: 'item',
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
        return `${params.name}<br/><span style="font-weight: 600;">${formatDisplayNumber(params.value)} (${params.percent}%)</span>`;
      },
      // Faster tooltip positioning
      confine: true,
      enterable: false,
    },
    
    // Simplified legend
    legend: {
      orient: 'vertical',
      right: 5,
      top: 'center',
      textStyle: {
        color: theme === 'dark' ? '#e2e8f0' : '#334155',
        fontFamily: "'Inter', sans-serif",
        fontSize: 10, // Smaller font
      },
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
    },
    
    // Optimized series
    series: [
      {
        name: 'Win/Loss Ratio',
        type: 'pie',
        radius: ['35%', '65%'], // Smaller radius for mini chart
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 2, // Smaller border radius
          borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
          borderWidth: 1, // Thinner border
        },
        label: {
          show: false, // Hide labels for better performance
        },
        emphasis: {
          label: {
            show: false,
          },
          itemStyle: {
            shadowBlur: 5, // Reduced shadow
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        },
        data: [
          { value: chartData.wins, name: 'Wins', itemStyle: { color: '#10b981' } },
          { value: chartData.losses, name: 'Losses', itemStyle: { color: '#ef4444' } }
        ],
        // Performance optimizations
        progressive: 500, // Progressive rendering
        progressiveThreshold: 3000,
      }
    ],
    
    // Remove unnecessary features for mini charts
    toolbox: { show: false },
    dataZoom: { show: false },
  }), [chartData, theme]);

  // Don't render if not visible or not ready
  if (!isVisible || !shouldRender) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Win/Loss Ratio
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
          Win/Loss Ratio
        </h3>
        <div className="h-32">
          <ChartLoadingSpinner size="sm" message="Loading win/loss data..." />
        </div>
      </div>
    );
  }

  if (chartData.wins === 0 && chartData.losses === 0) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Win/Loss Ratio
        </h3>
        <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
          <p className="text-center">No gambling data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Win/Loss Ratio
      </h3>
      <div className="flex items-center justify-between mb-2">
        <div className="text-center">
          <span className="block text-sm text-text-secondary">Ratio</span>
          <span className="block text-xl font-bold text-primary">
            {chartData.ratio === Infinity ? '∞' : formatDisplayNumber(chartData.ratio)}
          </span>
        </div>
        <div className="text-center">
          <span className="block text-sm text-text-secondary">Wins</span>
          <span className="block text-xl font-bold text-success">{formatDisplayNumber(chartData.wins)}</span>
        </div>
        <div className="text-center">
          <span className="block text-sm text-text-secondary">Losses</span>
          <span className="block text-xl font-bold text-error">{formatDisplayNumber(chartData.losses)}</span>
        </div>
      </div>
      <ReactECharts 
        option={options} 
        style={{ height: '180px', width: '100%' }} 
        className="mt-2"
        notMerge={true}
        lazyUpdate={true}
        opts={{
          renderer: 'canvas',
          useDirtyRect: true, // Enable dirty rectangle optimization
        }}
      />
    </div>
  );
};

export default React.memo(MiniGamblingWinLossRatioChart, (prevProps, nextProps) => {
  // Since this component doesn't take props, always return true to prevent re-renders
  return true;
});