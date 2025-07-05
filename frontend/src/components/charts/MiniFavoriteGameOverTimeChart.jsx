import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { getFavoriteGameTrend } from '../../services/api';
import { useUserStore, useGuildStore, useUIStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import useChartDataCache from '../../hooks/useChartDataCache';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const MiniFavoriteGameOverTimeChart = () => {
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

  // Define the fetch function for favorite game trend
  const fetchFavoriteGameTrend = async (userId, startDate, endDate, guildId) => {
    return await getFavoriteGameTrend(userId, startDate, endDate, guildId);
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchFavoriteGameTrend, params);

  // Memoize chart data
  const chartData = useMemo(() => {
    if (!response || !Array.isArray(response.favoriteGameTrend)) return [];
    return response.favoriteGameTrend;
  }, [response]);

  // Extract unique game types from the chart data
  const gameTypes = useMemo(() => {
    const gameTypesSet = new Set();
    chartData.forEach(item => {
      if (item.allGames) {
        Object.keys(item.allGames).forEach(game => gameTypesSet.add(game));
      }
    });
    return Array.from(gameTypesSet);
  }, [chartData]);

  // Capitalize first letter of game name
  const formatGameName = (name) => name.charAt(0).toUpperCase() + name.slice(1);

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
        const dateLabel = params[0].axisValue;
        let tooltipText = `<div style="font-weight: bold; margin-bottom: 3px;">${dateLabel}</div>`;
        params.forEach(param => {
          if (param.value > 0) {
            const color = param.color;
            const gameName = formatGameName(param.seriesName);
            const count = param.value;
            tooltipText += `<div style="display: flex; align-items: center; margin: 2px 0;">
              <span style="display: inline-block; width: 8px; height: 8px; background: ${color}; border-radius: 50%; margin-right: 4px;"></span>
              <span>${gameName}: ${count}</span>
            </div>`;
          }
        });
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
      containLabel: true,
    },
    
    // Simplified x-axis
    xAxis: {
      type: 'category',
      data: chartData.map(item => item.week),
      axisLabel: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontSize: 9, // Smaller font
        interval: Math.max(0, Math.floor(chartData.length / 3)), // Show fewer labels
        showMaxLabel: false,
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0',
          width: 1,
        },
      },
      axisTick: { show: false },
      splitLine: { show: false }, // Remove grid lines for performance
    },
    
    // Simplified y-axis
    yAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
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
    series: gameTypes.map(game => ({
      name: formatGameName(game),
      type: 'line',
      data: chartData.map(item => item.allGames ? item.allGames[game] || 0 : 0),
      smooth: false, // Disable smooth for better performance
      symbol: 'none', // Remove symbols for better performance
      symbolSize: 0,
      lineStyle: {
        width: 1.5, // Thinner line
      },
      itemStyle: {
        borderWidth: 1, // Thinner border
      },
      // Performance optimizations
      sampling: 'lttb', // Use LTTB sampling for large datasets
      progressive: 500, // Progressive rendering
      progressiveThreshold: 3000,
    })),
    
    // Remove unnecessary features for mini charts
    legend: { show: false },
    toolbox: { show: false },
    dataZoom: { show: false },
  }), [theme, chartData, gameTypes]);

  // Don't render if not visible or not ready
  if (!isVisible || !shouldRender) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Favorite Game Trend
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
          Favorite Game Trend
        </h3>
        <div className="h-32">
          <ChartLoadingSpinner size="sm" message="Loading game trends..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Favorite Game Trend
        </h3>
        <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
          <p className="text-center">Error loading favorite game trend.</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Favorite Game Trend
        </h3>
        <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
          <p className="text-center">No favorite game trend data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Favorite Game Trend
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
      />
    </div>
  );
};

export default React.memo(MiniFavoriteGameOverTimeChart, (prevProps, nextProps) => {
  // Since this component doesn't take props, always return true to prevent re-renders
  return true;
});