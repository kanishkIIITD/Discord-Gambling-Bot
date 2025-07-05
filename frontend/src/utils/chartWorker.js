/**
 * Web Worker for Chart Processing
 * 
 * Handles heavy chart computations off the main thread to prevent long tasks
 */

// Chart data processing functions
const processBalanceHistoryData = (response) => {
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
};

const processDailyProfitLossData = (response) => {
  if (!response || !Array.isArray(response)) return [];
  
  return response.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
    net: item.net
  }));
};

const processGamblingPerformanceData = (response) => {
  if (response && response.totalWon !== undefined && response.totalLost !== undefined) {
    const wins = response.totalWon || 0;
    const losses = response.totalLost || 0;
    const ratio = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;
    return { wins, losses, ratio };
  }
  return { wins: 0, losses: 0, ratio: 0 };
};

const processTopGamesData = (response) => {
  if (response && response.profitByGame) {
    return [...response.profitByGame]
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 3);
  }
  return [];
};

const processFavoriteGameData = (response) => {
  if (!response || !Array.isArray(response.favoriteGameTrend)) return [];
  
  const chartData = response.favoriteGameTrend;
  const gameTypes = new Set();
  
  chartData.forEach(item => {
    if (item.allGames) {
      Object.keys(item.allGames).forEach(game => gameTypes.add(game));
    }
  });
  
  return {
    chartData,
    gameTypes: Array.from(gameTypes)
  };
};

// Chart options generation functions
const createMiniChartOptions = (chartType, data, theme) => {
  const baseOptions = {
    animation: false,
    useUTC: false,
    renderer: 'canvas',
    legend: { show: false },
    toolbox: { show: false },
    dataZoom: { show: false },
  };

  switch (chartType) {
    case 'balanceHistory':
      return {
        ...baseOptions,
        tooltip: {
          trigger: 'axis',
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: 4,
          padding: 6,
          textStyle: {
            fontFamily: "'Inter', sans-serif",
            color: theme === 'dark' ? '#f8fafc' : '#1e293b',
            fontSize: 11,
            fontWeight: 'normal',
          },
          formatter: params => {
            if (!params.length) return '';
            const p = params[0];
            return `${p.axisValue}<br/><span style="font-weight: 600;">${p.data}</span>`;
          },
          confine: true,
          enterable: false,
        },
        grid: {
          left: '8%',
          right: '8%',
          bottom: '15%',
          top: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: data.labels,
          axisLabel: {
            fontFamily: "'Inter', sans-serif",
            fontWeight: 'normal',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            fontSize: 9,
            interval: Math.max(0, Math.floor(data.labels.length / 3)),
            showMaxLabel: false,
          },
          axisLine: {
            lineStyle: {
              color: theme === 'dark' ? '#334155' : '#e2e8f0',
              width: 1,
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            fontFamily: "'Inter', sans-serif",
            fontWeight: 'normal',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            fontSize: 9,
            showMaxLabel: false,
          },
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [{
          name: 'Balance',
          type: 'line',
          data: data.data,
          smooth: false,
          symbol: 'none',
          symbolSize: 0,
          lineStyle: {
            color: '#3b82f6',
            width: 1.5,
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
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.02)' }
              ]
            }
          },
          sampling: 'lttb',
          progressive: 500,
          progressiveThreshold: 3000,
        }],
      };

    case 'dailyProfitLoss':
      return {
        ...baseOptions,
        tooltip: {
          trigger: 'axis',
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: 4,
          padding: 6,
          textStyle: {
            fontFamily: "'Inter', sans-serif",
            color: theme === 'dark' ? '#f8fafc' : '#1e293b',
            fontSize: 11,
            fontWeight: 'normal',
          },
          formatter: function (params) {
            const date = params[0].axisValue;
            const netValue = params[0].value;
            const netColor = netValue >= 0 ? '#10b981' : '#ef4444';
            return `<div style="font-weight: bold; margin-bottom: 3px;">${date}</div>
                    <div style="font-weight: bold; color: ${netColor};">${netValue}</div>`;
          },
          confine: true,
          enterable: false,
        },
        grid: {
          left: '8%',
          right: '8%',
          bottom: '15%',
          top: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: data.map(item => item.date),
          axisLabel: {
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            interval: Math.max(0, Math.floor(data.length / 3)),
            showMaxLabel: false,
          },
          axisLine: {
            lineStyle: {
              color: theme === 'dark' ? '#334155' : '#e2e8f0',
              width: 1,
            }
          },
          axisTick: { show: false },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            showMaxLabel: false,
          },
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [{
          name: 'Net Profit/Loss',
          type: 'line',
          data: data.map(item => item.net),
          smooth: false,
          symbol: 'none',
          symbolSize: 0,
          areaStyle: {
            color: function(params) {
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: params.value >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' },
                  { offset: 1, color: params.value >= 0 ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)' }
                ]
              };
            }
          },
          lineStyle: {
            width: 1.5,
            color: function(params) {
              return params.value >= 0 ? '#10b981' : '#ef4444';
            }
          },
          itemStyle: {
            color: function(params) {
              return params.value >= 0 ? '#10b981' : '#ef4444';
            }
          },
          sampling: 'lttb',
          progressive: 500,
          progressiveThreshold: 3000,
        }],
      };

    case 'winLossRatio':
      return {
        ...baseOptions,
        tooltip: {
          trigger: 'item',
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: 4,
          padding: 6,
          textStyle: {
            fontFamily: "'Inter', sans-serif",
            color: theme === 'dark' ? '#f8fafc' : '#1e293b',
            fontSize: 11,
            fontWeight: 'normal',
          },
          formatter: function (params) {
            return `${params.name}<br/><span style="font-weight: 600;">${params.value} (${params.percent}%)</span>`;
          },
          confine: true,
          enterable: false,
        },
        legend: {
          orient: 'vertical',
          right: 5,
          top: 'center',
          textStyle: {
            color: theme === 'dark' ? '#e2e8f0' : '#334155',
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
          },
          itemWidth: 8,
          itemHeight: 8,
          icon: 'circle',
        },
        series: [{
          name: 'Win/Loss Ratio',
          type: 'pie',
          radius: ['35%', '65%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 2,
            borderColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            borderWidth: 1,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
            itemStyle: {
              shadowBlur: 5,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.3)'
            }
          },
          data: [
            { value: data.wins, name: 'Wins', itemStyle: { color: '#10b981' } },
            { value: data.losses, name: 'Losses', itemStyle: { color: '#ef4444' } }
          ],
          progressive: 500,
          progressiveThreshold: 3000,
        }],
      };

    default:
      return baseOptions;
  }
};

// Worker message handler
// eslint-disable-next-line no-restricted-globals
self.onmessage = function(e) {
  const { type, data, theme } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'processBalanceHistory':
        result = processBalanceHistoryData(data);
        break;
        
      case 'processDailyProfitLoss':
        result = processDailyProfitLossData(data);
        break;
        
      case 'processGamblingPerformance':
        result = processGamblingPerformanceData(data);
        break;
        
      case 'processTopGames':
        result = processTopGamesData(data);
        break;
        
      case 'processFavoriteGame':
        result = processFavoriteGameData(data);
        break;
        
      case 'createChartOptions':
        result = createMiniChartOptions(data.chartType, data.chartData, theme);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'success',
      originalType: type,
      result
    });
    
  } catch (error) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      type: 'error',
      originalType: type,
      error: error.message
    });
  }
}; 