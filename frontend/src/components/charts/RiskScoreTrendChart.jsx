import React, { useMemo, useEffect, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { getRiskScoreTrend } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import useChartDataCache from '../../hooks/useChartDataCache';
import withOptimizedChart from '../../utils/withOptimizedChart';
import useChartPerformance from '../../hooks/useChartPerformance';
import { Checkbox } from '../../components/Checkbox';

const RiskScoreTrendChart = ({ dateRange, targetUserId, guildId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startRenderTimer, stopRenderTimer } = useChartPerformance('RiskScoreTrendChart');
  const [useLogScale, setUseLogScale] = useState(true); // Toggle for log/linear
  
  // Define the fetch function for risk score trend
  const fetchRiskScoreTrend = async (userId, startDate, endDate, guildId) => {
    return await getRiskScoreTrend(userId, startDate, endDate, guildId);
  };

  const params = {
    userId: targetUserId || user?.discordId || '',
    startDate: dateRange ? dateRange.startDate : undefined,
    endDate: dateRange ? dateRange.endDate : undefined,
    guildId: guildId || ''
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchRiskScoreTrend, params);
  const chartData = response && response.riskScores ? response.riskScores : [];

  // Define risk zones - memoize to prevent recreation on each render
  const riskZones = useMemo(() => [
    { value: 0.1, color: '#10b981', name: 'Low Risk' },    // Green - Conservative
    { value: 0.25, color: '#22c55e', name: 'Low Risk' },    // Light Green - Still safe
    { value: 0.4, color: '#facc15', name: 'Medium Risk' },  // Yellow - Moderate
    { value: 0.6, color: '#f97316', name: 'High Risk' },    // Orange - Risky
    { value: 1, color: '#ef4444', name: 'Extreme Risk' },   // Red - Dangerous
    { value: 10, color: '#7c3aed', name: 'Reckless' },      // Purple - Beyond extreme
    { value: 100, color: '#6b21a8', name: 'Catastrophic' }, // Dark Purple - Catastrophic
    { value: 999999, color: '#3b0764', name: 'Apocalyptic' } // Deeper Purple - Apocalyptic
  ], []);

  // Sanitize chartData to ensure all riskScore values are valid numbers
  const sanitizedChartData = useMemo(() =>
    (chartData || []).map(item => ({
      ...item,
      riskScore:
        typeof item.riskScore === 'number' && isFinite(item.riskScore) && !isNaN(item.riskScore) && item.riskScore > 0
          ? item.riskScore
          : 0.01,
    })),
    [chartData]
  );

  // Memoize chart options to prevent unnecessary recalculations
  const options = useMemo(() => sanitizedChartData.length > 0 ? {
    title: {
      text: 'Risk Score Trend',
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
        const date = params[0].axisValue;
        const riskScore = params[0].value;
        
        // Determine risk level based on score
        let riskLevel = 'Apocalyptic';
        let riskColor = '#3b0764';
        
        for (let i = 0; i < riskZones.length; i++) {
          if (riskScore <= riskZones[i].value) {
            riskLevel = riskZones[i].name;
            riskColor = riskZones[i].color;
            break;
          }
        }
        
        // Find the corresponding data point to get bet amount and balance
        const dataPoint = chartData.find(item => item.date === date);
        const betAmount = dataPoint && dataPoint.avgBetAmount ? dataPoint.avgBetAmount : 0;
        const balance = dataPoint && dataPoint.avgBalance ? dataPoint.avgBalance : 0;
        
        let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${date}</div>`;
        
        tooltipText += `<div style="margin: 3px 0;">
          <span>Risk Score: <span style="color: ${riskColor}; font-weight: bold;">${formatDisplayNumber(riskScore * 100)}%</span></span>
          ${riskScore > 10 ? `<span style="margin-left: 5px; font-size: 11px; color: ${theme === 'dark' ? '#94a3b8' : '#64748b'};">(Extremely High)</span>` : ''}
        </div>`;
        
        tooltipText += `<div style="margin: 3px 0;">
          <span>Risk Level: <span style="color: ${riskColor}; font-weight: bold;">${riskLevel}</span></span>
        </div>`;
        
        tooltipText += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed ${theme === 'dark' ? '#475569' : '#cbd5e1'}">
          <div>Avg Bet: ${betAmount ? formatDisplayNumber(betAmount) : '0'} coins</div>
          <div>Avg Balance: ${balance ? formatDisplayNumber(balance) : '0'} coins</div>
        </div>`;
        
        return tooltipText;
      }
    },
    legend: {
      data: ['Risk Score'],
      top: 30,
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: 60,
      top: 80,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.map(item => item.date),
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
        formatter: function (value) {
          // Format date to be more readable (e.g., "Jan 01")
          const date = new Date(value);
          return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        }
      },
      axisLine: {
        lineStyle: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0'
        }
      },
    },
    yAxis: {
      type: useLogScale ? 'log' : 'value',
      min: useLogScale ? 0.01 : 0,
      max: function(value) {
        const maxValue = value.max;
        if (useLogScale) {
          // For log scale, set max to next power of 10
          return Math.pow(10, Math.ceil(Math.log10(maxValue)));
        }
        // For linear, keep previous logic
        if (maxValue > 100) {
          return maxValue > 100 ? maxValue * 1.2 : Math.max(1, Math.ceil(maxValue * 1.1));
        }
        return Math.max(1, Math.ceil(maxValue * 1.1));
      },
      interval: useLogScale ? undefined : function(value) {
        const max = Math.max(1, Math.ceil(value.max * 1.1));
        if (max > 100) return Math.pow(10, Math.floor(Math.log10(max)));
        else if (max > 50) return 10;
        else if (max > 10) return 5;
        else if (max <= 1) return 0.2;
        else if (max <= 2) return 0.5;
        else if (max <= 5) return 1;
        else return Math.ceil(max / 5);
      },
      axisLabel: {
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
        fontFamily: "'Inter', sans-serif",
        formatter: function (value) {
          if (useLogScale) {
            // Show as percent for values < 2, otherwise show as x multiplier
            if (value < 2) return (value * 100) + '%';
            return value + 'x';
          } else {
            if (value >= 10) {
              return formatDisplayNumber(value * 100) + '%';
            }
            return (value * 100) + '%';
          }
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
      }
    },
    visualMap: {
      show: false,
      dimension: 1,
      pieces: riskZones.map((zone, index) => {
        return {
          gt: index > 0 ? riskZones[index - 1].value : 0,
          lte: zone.value,
          color: zone.color || '#3b82f6', // fallback color
        };
      }),
      min: 0,
      max: riskZones[riskZones.length - 1].value,
    },
    series: [
      {
        name: 'Risk Score',
        type: 'line',
        data: sanitizedChartData.map(item => item.riskScore),
        smooth: true,
        lineStyle: {
          width: 4,
          color: '#3b82f6', // fallback color
        },
        symbol: 'circle',
        symbolSize: function(value) {
          return value > 10 ? 12 : value > 1 ? 10 : 8;
        },
        markLine: {
          silent: true,
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
            type: 'dashed'
          },
          data: riskZones.map(zone => {
            return {
              yAxis: zone.value,
              label: {
                formatter: zone.name,
                position: 'insideEndTop',
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: theme === 'dark' ? '#e2e8f0' : '#475569'
              }
            };
          })
        },
        areaStyle: {
          opacity: 0.2,
          color: '#3b82f6', // fallback color for area
        }
      }
    ],
    toolbox: {
      feature: {
        saveAsImage: {
          title: 'Save as PNG',
          name: `risk-score-trend-${targetUserId || user?.discordId}`,
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
        bottom: 20,
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
  }

  : null, [sanitizedChartData, theme, riskZones, targetUserId, user, useLogScale]);

  useEffect(() => {
    if (!loading && chartData.length > 0) {
      startRenderTimer();
    }
  }, [loading, chartData.length, startRenderTimer]);

  // Handle chart render event to stop the timer
  const onChartRender = useCallback(() => {
    stopRenderTimer();
  }, [stopRenderTimer]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-center">Error loading risk score data. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="flex items-center mb-2">
        <Checkbox
          checked={useLogScale}
          onCheckedChange={() => setUseLogScale(v => !v)}
          label="Log Scale"
        />
      </div>
      {sanitizedChartData.length > 0 ? (
        <>
          <ReactECharts 
            option={options} 
            style={{ height: '400px', width: '100%' }} 
            className="bg-card rounded-lg p-2"
            onEvents={{
              rendered: onChartRender
            }}
          />
        </>
      ) : (
        <div className="flex flex-col justify-center items-center h-64 text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-center">No risk score data available for the selected time period.</p>
        </div>
      )}
    </div>
  );
};

// Export with optimization HOC
export default withOptimizedChart(RiskScoreTrendChart, {
  chartId: 'RiskScoreTrendChart',
  memoizedProps: ['dateRange', 'targetUserId', 'guildId'],
  lazyLoad: true
});