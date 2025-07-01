import React, { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { getBalanceHistory } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import useChartDataCache from '../../hooks/useChartDataCache';

const MiniBalanceHistoryChart = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

  // Memoize date range to prevent re-creation on every render
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 7);
    return { startDate: start, endDate: end };
  }, []);

  // Memoize params to prevent infinite re-fetching
  const params = useMemo(() => ({
    userId: user?.discordId || '',
    startDate,
    endDate
  }), [user?.discordId, startDate, endDate]);

  // Define the fetch function for balance history
  const fetchBalanceHistory = async (userId, startDate, endDate) => {
    return await getBalanceHistory(userId, undefined, startDate, endDate);
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
        fontSize: 13,
        fontWeight: 'normal',
      },
      formatter: params => {
        if (!params.length) return '';
        const p = params[0];
        return `${p.axisValue}<br/><span style="font-weight: 600;">Balance: ${formatDisplayNumber(p.data)}</span>`;
      },
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
      data: chartData.labels,
      axisLabel: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontSize: 10,
        interval: Math.floor(chartData.labels.length / 4)
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
        fontSize: 10
      },
      splitLine: {
        lineStyle: {
          color: theme === 'dark' ? 'rgba(51, 65, 85, 0.2)' : 'rgba(226, 232, 240, 0.5)',
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
        symbolSize: 4,
        lineStyle: {
          color: '#3b82f6',
          width: 2,
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
        }
      },
    ],
    animationDuration: 900,
    animationEasing: 'cubicOut',
  }), [theme, chartData.labels, chartData.data]);

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
        <p className="text-center">Error loading balance history.</p>
      </div>
    );
  }

  if (chartData.data.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
        <p className="text-center">No balance history available.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Balance History
      </h3>
      <ReactECharts 
        option={options} 
        style={{ height: '120px', width: '100%' }} 
        className="bg-card rounded-lg"
      />
    </div>
  );
};

// Use React.memo to prevent unnecessary re-renders
export default React.memo(MiniBalanceHistoryChart);