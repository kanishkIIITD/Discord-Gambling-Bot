import React, { useMemo, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { getFavoriteGameTrend } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';

const FavoriteGameTrendChart = ({ dateRange, targetUserId, guildId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('FavoriteGameTrendChart');
  
  // Define the fetch function for favorite game trend
  const fetchFavoriteGameTrend = async (userId, startDate, endDate, guildId) => {
    return await getFavoriteGameTrend(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchFavoriteGameTrend, params);

  // Use the processed data from the cache
  const chartData = useMemo(() => response && response.favoriteGameTrend ? response.favoriteGameTrend : [], [response]);
  
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
  const formatGameName = useMemo(() => {
    return (name) => name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  // Generate colors for each game type
  const getGameColors = useMemo(() => {
    const baseColors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Purple
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#f97316', // Orange
    ];

    // If dark theme, adjust colors to be slightly brighter
    if (theme === 'dark') {
      return baseColors.map(color => {
        // This is a simple way to make colors brighter for dark theme
        // A more sophisticated approach would use HSL conversion
        return color;
      });
    }

    return baseColors;
  }, [theme]);
  
  // Format date for display - converts YYYY-WW format to a more readable format
  const formatDateLabel = useMemo(() => {
    return (dateLabel) => {
      // Check if the date is in YYYY-WW (week) format
      if (/^\d{4}-\d{1,2}$/.test(dateLabel)) {
        const [year, week] = dateLabel.split('-');
        return `Week ${week}, ${year}`;
      }
      // For daily format (assuming YYYY-MM-DD)
      else if (/^\d{4}-\d{2}-\d{2}$/.test(dateLabel)) {
        const date = new Date(dateLabel);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      // Return as is if format is unknown
      return dateLabel;
    };
  }, []);

  const options = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const colors = getGameColors;
    
    return {
      title: {
        text: 'Favorite Game Over Time',
        left: 'center',
        textStyle: {
          fontFamily: "'Inter', sans-serif",
          fontSize: 16,
          fontWeight: 'bold',
          color: theme === 'dark' ? '#E0E0E0' : '#212121',
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
        formatter: function (params) {
          const dateLabel = formatDateLabel(params[0].axisValue);
          let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${dateLabel}</div>`;
          
          // Sort params by value in descending order to show most played games first
          params.sort((a, b) => b.value - a.value);
          
          params.forEach(param => {
            if (param.value > 0) { // Only show games that were played
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
      legend: {
        data: gameTypes.map(formatGameName),
        top: 30,
        textStyle: {
          fontFamily: "'Inter', sans-serif",
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
        },
        // Add color swatches for each game type
        icon: 'circle',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 10,
        bottom: 0,
        show: true,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%', // Increased to accommodate rotated x-axis labels
        top: 80,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartData.map(item => item.week),
        axisLabel: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          fontFamily: "'Inter', sans-serif",
          formatter: function(value) {
            return formatDateLabel(value);
          },
          interval: 0, // Show all labels
          rotate: 45, // Rotate labels to prevent overlap
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
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#334155' : '#e2e8f0'
          }
        },
        splitLine: {
          lineStyle: {
            color: theme === 'dark' ? '#1e293b' : '#f1f5f9'
          }
        }
      },
      series: gameTypes.map((game, index) => ({
        name: formatGameName(game),
        type: 'line',
        data: chartData.map(item => {
          const originalGameKey = game; // lowercase
          return item.allGames ? item.allGames[originalGameKey] || 0 : 0;
        }),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: colors[index % colors.length]
        },
        itemStyle: {
          color: colors[index % colors.length],
          borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
          borderWidth: 2
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            borderWidth: 3
          }
        }
      })),
      toolbox: {
        feature: {
          saveAsImage: {
            title: 'Save as PNG',
            name: `favorite-game-trend-${targetUserId || user?.discordId}`,
            backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
          },
        }
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
    };
  }, [chartData, theme, gameTypes, formatGameName, formatDateLabel, getGameColors, targetUserId, user]);

  useEffect(() => {
    if (!loading && chartData.length > 0) {
      startRenderTimer();
    }
    // No cleanup needed for startRenderTimer
  }, [loading, chartData.length, startRenderTimer]);

  // Memoize the chart render event handler
  const onChartRender = useCallback(() => {
    stopRenderTimer();
  }, [stopRenderTimer]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-center">Error loading favorite game trend data.</p>
      </div>
    );
  }

  // Render no data state
  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-center">No favorite game trend data available for the selected time period.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactECharts 
        option={options} 
        style={{ height: '400px', width: '100%' }} 
        className="bg-card rounded-lg p-2"
        onEvents={{
          rendered: onChartRender
        }}
      />
    </div>
  );
};

export default withOptimizedChart(FavoriteGameTrendChart, {
  chartId: 'favorite-game-trend-chart',
  memoizedProps: ['dateRange', 'targetUserId', 'guildId'],
  lazyLoad: true
});