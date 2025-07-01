import React, { useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { getTransactionAnalysis } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';

const TransactionTypeAnalysisChart = ({ dateRange, targetUserId, guildId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('TransactionTypeAnalysisChart');

  // A professional, harmonious color palette using our theme colors
  const proColors = [
    '#3b82f6', // primary blue
    '#22c55e', // green-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#8b5cf6', // violet-500
    '#f97316', // orange-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
  ];

  // Define the fetch function for transaction type analysis
  const fetchTransactionAnalysis = async (userId, startDate, endDate, guildId) => {
    return await getTransactionAnalysis(
          userId,
          undefined,
      startDate,
      endDate,
          guildId
        );
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange ? dateRange.startDate : undefined,
    endDate: dateRange ? dateRange.endDate : undefined,
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchTransactionAnalysis, params);
  
  // Process the data with useMemo to avoid recalculations
  const { sortedDates, transactionTypes, series } = useMemo(() => {
    if (!response || !response.transactionsByType) {
      return { sortedDates: [], transactionTypes: [], series: [] };
    }
    
          const transactionsByDate = {};
    const types = new Set();

          Object.entries(response.transactionsByType).forEach(([type, transactions]) => {
      types.add(type);
            transactions.forEach(tx => {
              const date = new Date(tx.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
              if (!transactionsByDate[date]) transactionsByDate[date] = {};
              if (!transactionsByDate[date][type]) transactionsByDate[date][type] = 0;
              transactionsByDate[date][type] += Math.abs(tx.amount);
            });
          });

    const dates = Object.keys(transactionsByDate).sort((a, b) => new Date(a) - new Date(b));
    const typesArray = Array.from(types);

    const seriesData = typesArray.map((type, index) => {
            const color = proColors[index % proColors.length];
            return {
              name: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
              type: 'line',
              stack: 'Total',
              smooth: true,
        data: dates.map(date => transactionsByDate[date][type] || 0),
        areaStyle: { color, opacity: 0.15 }, // Lower opacity for less overdraw
        lineStyle: { width: 2, color },
        itemStyle: { color },
        emphasis: { focus: 'series', areaStyle: { opacity: 0.3 } },
            };
          });

    return { 
      sortedDates: dates, 
      transactionTypes: typesArray, 
      series: seriesData 
    };
  }, [response, proColors]);

  const options = useMemo(() => ({
    // Only generate options if we have data
    ...(series.length === 0 ? {} : {
            title: {
              text: 'Transaction Type Analysis',
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
                  name: `transaction-analysis-${targetUserId || user?.discordId}`,
                  backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
                },
              }
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'cross', label: { backgroundColor: '#3b82f6' } },
              backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
              borderRadius: 6,
              padding: 10,
              textStyle: {
                fontFamily: "'Inter', sans-serif",
                color: theme === 'dark' ? '#f8fafc' : '#1e293b',
                fontSize: 13,
                fontWeight: 'normal',
              },
              formatter: (params) => {
                let tooltipText = `${params[0].axisValue}<br/>`;
                params.forEach(p => {
                  tooltipText += `${p.marker} ${p.seriesName}: <span style="font-weight: 600;">${formatDisplayNumber(p.value)}</span><br/>`;
                });
                return tooltipText;
              },
            },
            legend: {
      data: transactionTypes.map(type => type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')),
              bottom: 10,
              type: 'scroll',
              textStyle: {
                fontFamily: "'Inter', sans-serif",
                color: theme === 'dark' ? '#94a3b8' : '#64748b',
                fontSize: 12,
              },
              pageTextStyle: {
                color: theme === 'dark' ? '#94a3b8' : '#64748b',
              },
              pageIconColor: '#3b82f6',
              pageIconInactiveColor: theme === 'dark' ? '#334155' : '#e2e8f0',
            },
            grid: { left: '3%', right: '4%', bottom: 60, containLabel: true },
            xAxis: [{
              type: 'category',
              boundaryGap: false,
              data: sortedDates,
              axisLabel: {
                fontFamily: "'Inter', sans-serif",
                color: theme === 'dark' ? '#94a3b8' : '#64748b',
              },
              axisLine: {
                lineStyle: {
                  color: theme === 'dark' ? '#334155' : '#e2e8f0',
                },
              },
              axisTick: { show: false },
            }],
            yAxis: [{
              type: 'value',
              axisLabel: {
                formatter: val => formatDisplayNumber(val),
                fontFamily: "'Inter', sans-serif",
                color: theme === 'dark' ? '#94a3b8' : '#64748b',
              },
              splitLine: {
                lineStyle: {
                  color: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.5)',
                },
              },
            }],
            series,
            dataZoom: [
              { type: 'inside', start: 0, end: 100 },
              {
                type: 'slider',
                start: 0,
                end: 100,
                bottom: 35,
                height: 15,
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
              }
            ],
    animationDuration: 400, // Reduced for snappier feel
    progressive: sortedDates.length > 20 ? 200 : 0, // Enable progressive rendering for large data
    progressiveThreshold: 500,
    renderer: 'canvas',
  })}), [theme, targetUserId, user, series, sortedDates, transactionTypes]);

  useEffect(() => {
    if (!loading && series.length > 0) {
      startRenderTimer();
    }
    // No cleanup needed for startRenderTimer
    // If you want to stop timer on unmount, you can add: return () => stopRenderTimer();
  }, [loading, series.length, startRenderTimer]);

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
          <p className="text-center">Error loading transaction analysis data. Please try again later.</p>
        </div>
      ) : series.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-center">No transaction data available for the selected time period.</p>
        </div>
      ) : (
    <div className="bg-card p-4 rounded-lg shadow-lg">
      <div className="h-[300px] md:h-[350px] w-full">
            <ReactECharts 
              option={options} 
              style={{ height: '100%', width: '100%' }} 
            />
          </div>
      </div>
      )}
    </div>
  );
};

export default withOptimizedChart(TransactionTypeAnalysisChart, {
  chartId: 'transaction-type-analysis',
  memoizedProps: ['dateRange', 'targetUserId', 'guildId'],
  lazyLoad: true
});