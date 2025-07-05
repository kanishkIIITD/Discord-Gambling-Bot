import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getBalanceHistory } from '../../services/api';
import { useUserStore, useGuildStore, useUIStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import useChartDataCache from '../../hooks/useChartDataCache';
import { useChartWorker } from '../../hooks/useChartWorker';
import VirtualChartRenderer from '../VirtualChartRenderer';
import UltraLightChart from './UltraLightChart';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const MiniBalanceHistoryChart = () => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  
  // Intersection Observer for lazy loading
  const chartRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [chartOptions, setChartOptions] = useState(null);
  
  // Chart worker for heavy computations
  const { sendToWorker, isWorkerReady } = useChartWorker();

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
    endDate,
    guildId: selectedGuildId
  }), [user?.discordId, startDate, endDate, selectedGuildId]);

  // Define the fetch function for balance history
  const fetchBalanceHistory = async (userId, startDate, endDate, guildId) => {
    return await getBalanceHistory(userId, undefined, startDate, endDate, guildId);
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading, error } = useChartDataCache(fetchBalanceHistory, params);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && !shouldRender) {
          // Debounce the render to prevent excessive re-renders
          const timer = setTimeout(() => {
            setShouldRender(true);
          }, 100);
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => {
      if (chartRef.current) {
        observer.unobserve(chartRef.current);
      }
    };
  }, [shouldRender]);

  // Process data using worker when response changes
  useEffect(() => {
    if (!response || !isVisible || !shouldRender || !isWorkerReady) return;

    const processData = async () => {
      try {
        // Process data using worker
        const processed = await sendToWorker('processBalanceHistory', response, theme);
        setProcessedData(processed);

        // Generate chart options
        const options = await sendToWorker('createChartOptions', {
          chartType: 'balanceHistory',
          chartData: processed
        }, theme);
        setChartOptions(options);
      } catch (error) {
        console.error('Error processing balance history data:', error);
        // Fallback to main thread processing
        processInMainThread();
      }
    };

    const processInMainThread = () => {
      if (!response || !response.balanceHistory || response.balanceHistory.length === 0) {
        setProcessedData({ labels: [], data: [] });
        return;
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
      
      const processed = { labels, data };
      setProcessedData(processed);

      // Create chart options
      const options = {
        animation: false,
        useUTC: false,
        renderer: 'canvas',
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
            return `${p.axisValue}<br/><span style="font-weight: 600;">${formatDisplayNumber(p.data)}</span>`;
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
          data: labels,
          axisLabel: {
            fontFamily: "'Inter', sans-serif",
            fontWeight: 'normal',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            fontSize: 9,
            interval: Math.max(0, Math.floor(labels.length / 3)),
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
            formatter: function (value) {
              return formatDisplayNumber(value);
            },
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
          data: data,
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
        legend: { show: false },
        toolbox: { show: false },
        dataZoom: { show: false },
      };
      setChartOptions(options);
    };

    // Use requestIdleCallback for better performance
    if (window.requestIdleCallback) {
      window.requestIdleCallback(
        () => processData(),
        { timeout: 2000 }
      );
    } else {
      processData();
    }
  }, [response, isVisible, shouldRender, theme, sendToWorker, isWorkerReady]);

  // Don't render if not visible or not ready
  if (!isVisible || !shouldRender) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Balance History
        </h3>
        <div className="h-32 bg-card rounded-lg animate-pulse">
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Balance History
        </h3>
        <div className="h-32">
          <ChartLoadingSpinner size="sm" message="Loading balance history..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Balance History
        </h3>
        <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
          <p className="text-center">Error loading balance history.</p>
        </div>
      </div>
    );
  }

  if (!processedData || !chartOptions || processedData.data.length === 0) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Balance History
        </h3>
        <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
          <p className="text-center">No balance history available.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Balance History
      </h3>
      <VirtualChartRenderer
        isVisible={isVisible}
        shouldRender={shouldRender}
        chartType="BalanceHistory"
        rawData={response}
        theme={theme}
        onChartReady={(data, options) => {
          setProcessedData(data);
          setChartOptions(options);
        }}
      >
        <UltraLightChart
          options={chartOptions}
          height="120px"
          width="100%"
          className="bg-card rounded-lg"
          // onRender={() => console.log('Balance history chart rendered')}
        />
      </VirtualChartRenderer>
    </div>
  );
};

// Use React.memo with custom comparison for better performance
export default React.memo(MiniBalanceHistoryChart, (prevProps, nextProps) => {
  // Since this component doesn't take props, always return true to prevent re-renders
  return true;
});