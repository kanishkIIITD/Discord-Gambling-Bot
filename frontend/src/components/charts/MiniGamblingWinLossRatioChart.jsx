import React, { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { getGamblingPerformance } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import { createOptimizedChartOptions } from '../../utils/chartOptimizer';
import useChartDataCache from '../../hooks/useChartDataCache';

const MiniGamblingWinLossRatioChart = () => {
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

  // Define the fetch function for gambling performance
  const fetchGamblingPerformance = async (userId, startDate, endDate) => {
    return await getGamblingPerformance(userId, startDate, endDate);
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

  // Memoize chart options to prevent unnecessary recalculations
  const options = useMemo(() => createOptimizedChartOptions({
    tooltip: {
      trigger: 'item',
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
        return `${params.name}<br/><span style="font-weight: 600;">${formatDisplayNumber(params.value)} (${params.percent}%)</span>`;
      },
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: {
        color: theme === 'dark' ? '#e2e8f0' : '#334155',
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
      },
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
    },
    series: [
      {
        name: 'Win/Loss Ratio',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
          borderWidth: 2
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: false,
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        data: [
          { value: chartData.wins, name: 'Wins', itemStyle: { color: '#10b981' } },
          { value: chartData.losses, name: 'Losses', itemStyle: { color: '#ef4444' } }
        ]
      }
    ]
  }), [chartData, theme]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (chartData.wins === 0 && chartData.losses === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
        <p className="text-center">No gambling data available.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
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
      />
    </div>
  );
};

export default React.memo(MiniGamblingWinLossRatioChart);