import React, { useMemo, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useUserStore, useUIStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { getGameDistribution } from '../../services/api';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const GameTypeDistributionChart = ({ dateRange, targetUserId, guildId }) => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const chartId = 'game-type-distribution';
  const { startRenderTimer, stopRenderTimer } = useChartPerformance(chartId);
  
  // Define the fetch function for game type distribution
  const fetchGameDistribution = async (userId, startDate, endDate, guildId) => {
    return await getGameDistribution(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchGameDistribution, params);
  
  // Process the data with useMemo to avoid unnecessary recalculations
  const { labels, data } = useMemo(() => {
    if (!response || !response.gameCounts) {
      return { labels: [], data: [] };
    }
    // Convert the object to an array and sort by count descending
    const sortedEntries = Object.entries(response.gameCounts)
      .map(([gameType, count]) => ({ gameType, count }))
      .sort((a, b) => b.count - a.count);

    return {
      labels: sortedEntries.map(item => item.gameType),
      data: sortedEntries.map(item => item.count)
    };
  }, [response]);

  // Memoize chart options to prevent unnecessary recalculations
  const options = useMemo(() => ({
    title: {
      text: 'Game Type Distribution',
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
          name: `game-distribution-${targetUserId || user?.discordId}`,
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        },
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const p = params[0];
        return `${p.name}: ${formatDisplayNumber(p.value)} plays`;
      },
      backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 6,
      padding: 10,
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        color: theme === 'dark' ? '#f8fafc' : '#1e293b',
        fontSize: 13,
        fontWeight: 'normal',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      boundaryGap: [0, 0.01],
      axisLabel: {
        formatter: val => formatDisplayNumber(val),
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
      },
      splitLine: {
        lineStyle: {
          color: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.5)',
        },
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0',
        },
      },
    },
    yAxis: {
      type: 'category',
      data: labels,
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
    },
    series: [
      {
        name: 'Games Played',
        type: 'bar',
        data: data,
        itemStyle: {
          borderRadius: [0, 5, 5, 0],
          color: '#3b82f6',
        },
        emphasis: {
          itemStyle: {
            color: '#2563eb',
          },
        },
        showBackground: true,
        backgroundStyle: {
          color: theme === 'dark' ? 'rgba(51, 65, 85, 0.2)' : 'rgba(226, 232, 240, 0.2)',
        },
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        yAxisIndex: 0,
        start: 0,
        end: 100,
        filterMode: 'empty',
      },
      {
        type: 'slider',
        yAxisIndex: 0,
        show: labels.length > 10,
        width: 15,
        right: 10,
        start: 0,
        end: 100,
        filterMode: 'empty',
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
    animationDuration: 900,
    animationEasing: 'cubicOut',
    // Progressive rendering for better performance with large datasets
    progressive: labels.length > 20 ? 200 : 0,
    progressiveThreshold: 500,
    // Use canvas renderer for better performance
    renderer: 'canvas',
  }), [theme, labels, data, targetUserId, user?.discordId]);

  useEffect(() => {
    if (!loading && data.length > 0) {
      startRenderTimer();
    }
  }, [loading, data.length, startRenderTimer]);

  // Memoize the chart render event handler
  const onChartRender = useCallback(() => {
    stopRenderTimer();
  }, [stopRenderTimer]);

  if (loading) {
    return (
      <div className="h-64">
        <ChartLoadingSpinner size="lg" message="Loading game distribution..." />
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
export default withOptimizedChart(GameTypeDistributionChart, {
  memoizeProps: ['dateRange', 'targetUserId', 'guildId'],
  chartId: 'game-type-distribution',
  useLazyLoading: true
});