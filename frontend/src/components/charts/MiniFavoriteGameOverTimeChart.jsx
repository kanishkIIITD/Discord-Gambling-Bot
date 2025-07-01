import React, { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { getFavoriteGameTrend } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import useChartDataCache from '../../hooks/useChartDataCache';

const MiniFavoriteGameOverTimeChart = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

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
    endDate
  }), [user?.discordId, startDate, endDate]);

  // Define the fetch function for favorite game trend
  const fetchFavoriteGameTrend = async (userId, startDate, endDate) => {
    return await getFavoriteGameTrend(userId, startDate, endDate);
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
        const dateLabel = params[0].axisValue;
        let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${dateLabel}</div>`;
        params.forEach(param => {
          if (param.value > 0) {
            const color = param.color;
            const gameName = formatGameName(param.seriesName);
            const count = param.value;
            tooltipText += `<div style="display: flex; align-items: center; margin: 3px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 50%; margin-right: 5px;"></span>
              <span>${gameName}: ${count} plays</span>
            </div>`;
          }
        });
        return tooltipText;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartData.map(item => item.week),
      axisLabel: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontSize: 10,
        interval: Math.floor(chartData.length / 4)
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
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontSize: 10
      },
      splitLine: {
        lineStyle: {
          color: theme === 'dark' ? 'rgba(51, 65, 85, 0.2)' : 'rgba(226, 232, 240, 0.5)',
        },
      },
    },
    series: gameTypes.map(game => ({
      name: formatGameName(game),
      type: 'line',
      data: chartData.map(item => item.allGames ? item.allGames[game] || 0 : 0),
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: {
        width: 2,
      },
      itemStyle: {
        borderWidth: 2
      }
    })),
    animationDuration: 900,
    animationEasing: 'cubicOut',
  }), [theme, chartData, gameTypes]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
        <p className="text-center">Error loading favorite game trend.</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
        <p className="text-center">No favorite game trend data available.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Favorite Game Trend
      </h3>
      <ReactECharts 
        option={options} 
        style={{ height: '120px', width: '100%' }} 
        className="bg-card rounded-lg"
      />
    </div>
  );
};

export default React.memo(MiniFavoriteGameOverTimeChart);