import React, { useMemo, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useUserStore, useUIStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { getGameComparison } from '../../services/api';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const GameComparisonMatrixChart = ({ dateRange, targetUserId, guildId }) => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('GameComparisonMatrixChart');
  
  // Define the fetch function for game comparison
  const fetchGameComparison = async (userId, startDate, endDate, guildId) => {
    return await getGameComparison(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchGameComparison, params);

  // Process the data with useMemo to avoid recalculations
  const { gameNames, winRates, plays } = useMemo(() => {
    if (!response || !response.gameStats) {
      return { gameNames: [], winRates: [], plays: [] };
    }
    
    const gameStats = response.gameStats;
    const gameNames = Object.keys(gameStats).map(game =>
      game.charAt(0).toUpperCase() + game.slice(1)
    );
    
    const winRates = Object.values(gameStats).map(stats => parseFloat(stats.winRate));
    const plays = Object.values(gameStats).map(stats => stats.plays);
    
    return { gameNames, winRates, plays };
  }, [response]);

  // Create chart options with useMemo to avoid unnecessary recalculations
  const chartOptions = useMemo(() => {
    if (!gameNames.length) return {};
    
    return {
      title: {
        text: 'Game Comparison Matrix',
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
            name: `game-comparison-${targetUserId || user?.discordId}`,
            backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
          },
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
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
        formatter: (params) => {
          const winRateData = params.find(p => p.seriesName === 'Win Rate');
          const playsData = params.find(p => p.seriesName === 'Games Played');
          
          return `<b>${params[0].name}</b><br/>
                  Win Rate: <span style="font-weight: 600;">${winRateData.value.toFixed(1)}%</span><br/>
                  Games Played: <span style="font-weight: 600;">${formatDisplayNumber(playsData.value)}</span>`;
        }
      },
      legend: {
        data: ['Win Rate', 'Games Played'],
        bottom: 10,
        textStyle: {
          fontFamily: "'Inter', sans-serif",
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          fontSize: 12,
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: gameNames,
        axisLabel: {
          fontFamily: "'Inter', sans-serif",
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          interval: 0,
          rotate: 45
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#334155' : '#e2e8f0',
          }
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Win Rate (%)',
          min: 0,
          max: 100,
          position: 'left',
          axisLine: {
            show: true,
            lineStyle: {
              color: '#3b82f6'
            }
          },
          axisLabel: {
            formatter: '{value}%',
            fontFamily: "'Inter', sans-serif",
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
          },
          splitLine: {
            lineStyle: {
              color: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.5)',
            }
          }
        },
        {
          type: 'value',
          name: 'Games Played',
          position: 'right',
          axisLine: {
            show: true,
            lineStyle: {
              color: '#ef4444'
            }
          },
          axisLabel: {
            formatter: value => formatDisplayNumber(value),
            fontFamily: "'Inter', sans-serif",
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: [
        {
          name: 'Win Rate',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          data: winRates,
          lineStyle: {
            width: 3,
            color: '#3b82f6'
          },
          itemStyle: {
            color: '#3b82f6'
          }
        },
        {
          name: 'Games Played',
          type: 'bar',
          yAxisIndex: 1,
          data: plays,
          itemStyle: {
            color: '#ef4444',
            borderRadius: [3, 3, 0, 0]
          },
          emphasis: {
            itemStyle: {
              color: '#dc2626'
            }
          }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          show: gameNames.length > 8,
          start: 0,
          end: 100,
          height: 20,
          bottom: 50,
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
      animationDuration: 900,
      animationEasing: 'cubicOut'
    };
  }, [gameNames, winRates, plays, theme, targetUserId, user?.discordId]);

  // Memoize the chart render event handler
  const onChartRender = useCallback(() => {
    stopRenderTimer();
  }, [stopRenderTimer]);

  useEffect(() => {
    if (!loading && gameNames.length > 0) {
      startRenderTimer();
    }
    // No cleanup needed for startRenderTimer
  }, [loading, gameNames.length, startRenderTimer]);

  return (
    <div className="bg-card p-4 rounded-lg shadow-lg">
      <div className="h-[400px] w-full">
        {loading ? (
          <ChartLoadingSpinner size="lg" message="Loading game comparison data..." />
        ) : error ? (
          <div className="flex flex-col justify-center items-center h-full text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-center">Error loading game comparison data. Please try again later.</p>
          </div>
        ) : gameNames.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-center">No game comparison data available for the selected period.</p>
          </div>
        ) : (
          <ReactECharts 
            option={chartOptions} 
            style={{ height: '100%', width: '100%' }} 
            className="react-echarts"
            onEvents={{
              rendered: onChartRender
            }}
          />
        )}
      </div>
    </div>
  );
};

// Export with the optimized chart HOC
export default withOptimizedChart(GameComparisonMatrixChart, {
  chartId: 'game-comparison-matrix',
  memoizedProps: ['dateRange', 'targetUserId', 'guildId'],
  lazyLoad: true
});