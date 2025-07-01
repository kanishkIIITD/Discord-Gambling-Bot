import React, { useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { getTopGamesByProfit } from '../../services/api';
import { Checkbox } from '../../components/Checkbox';

// Symlog transformation helpers
function symlog(x) {
  if (x === 0) return 0;
  return Math.sign(x) * Math.log10(1 + Math.abs(x));
}
function invSymlog(y) {
  if (y === 0) return 0;
  return Math.sign(y) * (Math.pow(10, Math.abs(y)) - 1);
}

const TopGamesByProfitChart = ({ dateRange, targetUserId, guildId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('TopGamesByProfitChart');
  
  const [useLogScale, setUseLogScale] = React.useState(true);

  // Define the fetch function for top games by profit
  const fetchTopGamesByProfit = async (userId, startDate, endDate, guildId) => {
    return await getTopGamesByProfit(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchTopGamesByProfit, params);
  
  // Process the data with useMemo to avoid recalculations
  const chartData = useMemo(() => {
    if (!response || !response.profitByGame) {
      return [];
    }
    return response.profitByGame;
  }, [response]);

  // Symlog transformed data for log scale
  const symlogData = useMemo(() => {
    return chartData.map(item => ({
      ...item,
      symlogNetProfit: symlog(item.netProfit)
    }));
  }, [chartData]);

  // Capitalize first letter of game name
  const formatGameName = (name) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Find max/min for symlog axis
  const symlogMin = useMemo(() => {
    if (!symlogData.length) return -1;
    return Math.min(0, Math.floor(Math.min(...symlogData.map(item => item.symlogNetProfit))));
  }, [symlogData]);
  const symlogMax = useMemo(() => {
    if (!symlogData.length) return 1;
    return Math.max(0, Math.ceil(Math.max(...symlogData.map(item => item.symlogNetProfit))));
  }, [symlogData]);

  // Create chart options with useMemo to avoid unnecessary recalculations
  const options = useMemo(() => ({
    ...(chartData.length === 0 ? {} : {
    title: {
      text: 'Top Games by Net Profit',
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
      axisPointer: {
        type: 'shadow'
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
      formatter: function (params) {
        const idx = params[0].dataIndex;
        const item = chartData[idx];
        const game = formatGameName(item.game);
        const netProfit = item.netProfit;
        const color = netProfit >= 0 ? '#10b981' : '#ef4444';
        let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${game}</div>`;
        tooltipText += `<div style="margin: 3px 0;">
          <span style="color: #10b981;">Won: ${formatDisplayNumber(item?.winnings || 0)}</span>
        </div>`;
        tooltipText += `<div style="margin: 3px 0;">
          <span style="color: #ef4444;">Lost: ${formatDisplayNumber(item?.losses || 0)}</span>
        </div>`;
        tooltipText += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed ${theme === 'dark' ? '#475569' : '#cbd5e1'};">
          <span style="font-weight: bold; color: ${color};">Net Profit: ${formatDisplayNumber(netProfit)}</span>
        </div>`;
        return tooltipText;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 60,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      min: useLogScale ? symlogMin : undefined,
      max: useLogScale ? symlogMax : undefined,
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
        formatter: function (value) {
          // Show original value for symlog axis
          return useLogScale ? formatDisplayNumber(invSymlog(value)) : formatDisplayNumber(value);
        }
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
      },
      name: useLogScale ? 'Net Profit (symlog)' : 'Net Profit',
      nameLocation: 'middle',
      nameGap: 32
    },
    yAxis: {
      type: 'category',
      data: chartData.map(item => formatGameName(item.game)),
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0'
        }
      },
    },
    series: [
      {
        name: 'Net Profit',
        type: 'bar',
        data: useLogScale ? symlogData.map(item => item.symlogNetProfit) : chartData.map(item => item.netProfit),
        itemStyle: {
          color: function(params) {
            const value = useLogScale ? invSymlog(params.value) : params.value;
            return value >= 0 ? '#10b981' : '#ef4444';
          },
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: function (params) {
            const value = useLogScale ? invSymlog(params.value) : params.value;
            const colorKey = value >= 0 ? 'green' : 'red';
            return `{${colorKey}|${formatDisplayNumber(value)}}`;
          },
          rich: {
            green: {
              color: '#10b981',
              fontWeight: 'bold',
              fontSize: 12,
              fontFamily: "'Inter', sans-serif",
            },
            red: {
              color: '#ef4444',
              fontWeight: 'bold',
              fontSize: 12,
              fontFamily: "'Inter', sans-serif",
            }
          }
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ],
    toolbox: {
      feature: {
        saveAsImage: {
          title: 'Save as PNG',
          name: `top-games-profit-${targetUserId || user?.discordId}`,
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        },
      }
    },
  })
  }), [chartData, symlogData, theme, targetUserId, user, useLogScale, symlogMin, symlogMax]);

  useEffect(() => {
    if (!loading && chartData.length > 0) {
      startRenderTimer();
    }
  }, [loading, chartData.length, startRenderTimer]);

  return (
    <div className="w-full h-full">
      <div className="flex items-center mb-2">
        <Checkbox
          checked={useLogScale}
          onCheckedChange={() => setUseLogScale(v => !v)}
          label="Log Scale"
        />
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-center">Error loading game profit data. Please try again later.</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-center">No game profit data available for the selected time period.</p>
        </div>
      ) : (
        <>
          <ReactECharts 
            option={options} 
            style={{ height: '400px', width: '100%' }} 
            className="bg-card rounded-lg p-2"
          />
        </>
      )}
    </div>
  );
};

// Export with the optimized chart HOC
export default withOptimizedChart(TopGamesByProfitChart, {
  chartId: 'top-games-profit',
  memoizedProps: ['dateRange', 'targetUserId', 'guildId'],
  lazyLoad: true
});