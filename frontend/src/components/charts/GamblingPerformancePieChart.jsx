import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getGamblingPerformance } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDisplayNumber } from '../../utils/numberFormat';

const GamblingPerformancePieChart = ({ dateRange, targetUserId, guildId }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const userId = targetUserId || user?.discordId;
      if (!userId) return;
      try {
        setLoading(true);
        const response = await getGamblingPerformance(
          userId,
          dateRange ? dateRange.startDate : undefined,
          dateRange ? dateRange.endDate : undefined,
          guildId
        );
        if (response) {
          const wins = response.totalWon || 0;
          const losses = response.totalLost || 0;
          setChartData([
            { value: wins, name: 'Wins' },
            { value: losses, name: 'Losses' },
          ]);
        } else {
          setChartData([]);
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, dateRange, targetUserId, guildId]);

  const options = {
    title: {
      text: 'Gambling Win/Loss Ratio',
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
          name: `gambling-performance-${targetUserId || user?.discordId}`,
          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
        },
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: ({ name, value, percent }) => 
        `${name}: ${formatDisplayNumber(value)} (${percent}%)`,
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
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
      data: ['Wins', 'Losses'],
      textStyle: {
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'normal',
        color: theme === 'dark' ? '#94a3b8' : '#64748b',
      },
      itemStyle: {
        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
      },
    },
    series: [
      {
        name: 'Gambling Performance',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['65%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center',
          fontFamily: "'Inter', sans-serif",
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '24',
            fontWeight: 'bold',
            fontFamily: "'Inter', sans-serif",
            color: theme === 'dark' ? '#E0E0E0' : '#1e293b',
            formatter: ({ name, value }) => `${name}\n${formatDisplayNumber(value)}`,
          },
        },
        labelLine: {
          show: false,
        },
        data: chartData,
        color: ['#22c55e', '#ef4444'],
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDelay: (idx) => Math.random() * 200,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 rounded-lg shadow-lg">
      <div className="h-[300px] md:h-[350px] w-full">
        <ReactECharts option={options} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
      </div>
    </div>
  );
};

export default React.memo(GamblingPerformancePieChart);