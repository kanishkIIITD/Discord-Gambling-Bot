import React, { lazy, Suspense, useState, useEffect } from 'react';
import Ticker from './Ticker';
import { LazyChart } from '../utils/chartOptimizer';
import ChartLoadingSpinner from './charts/ChartLoadingSpinner';

// Lazy load chart components
const MiniBalanceHistoryChart = lazy(() => import('./charts/MiniBalanceHistoryChart'));
const MiniTopGamesByProfitChart = lazy(() => import('./charts/MiniTopGamesByProfitChart'));
const MiniDailyProfitLossChart = lazy(() => import('./charts/MiniDailyProfitLossChart'));
const MiniGamblingWinLossRatioChart = lazy(() => import('./charts/MiniGamblingWinLossRatioChart'));
const MiniFavoriteGameOverTimeChart = lazy(() => import('./charts/MiniFavoriteGameOverTimeChart'));

/**
 * ChartTicker Component
 * 
 * A component that uses the Ticker to display multiple charts in a rotating manner
 * with progressive loading to reduce initial load lag
 */
const ChartTicker = ({ duration = 10, pauseOnHover = true }) => {
  // Track which charts are ready to load progressively
  const [chartLoadStates, setChartLoadStates] = useState({
    balanceHistory: false,
    topGames: false,
    dailyProfit: false,
    winLossRatio: false,
    favoriteGame: false
  });
  
  // Progressive loading with staggered delays and requestIdleCallback
  useEffect(() => {
    const loadDelays = {
      balanceHistory: 100,    // First chart loads after 100ms
      topGames: 200,          // Second chart loads after 200ms
      dailyProfit: 300,       // Third chart loads after 300ms
      winLossRatio: 400,      // Fourth chart loads after 400ms
      favoriteGame: 500       // Fifth chart loads after 500ms
    };

    const timers = {};

    // Use requestIdleCallback for better performance
    const scheduleChartLoad = (chartKey, delay) => {
      if (window.requestIdleCallback) {
        const idleCallback = window.requestIdleCallback(
          () => {
            setChartLoadStates(prev => ({
              ...prev,
              [chartKey]: true
            }));
          },
          { timeout: delay + 1000 }
        );
        timers[chartKey] = () => window.cancelIdleCallback(idleCallback);
      } else {
        // Fallback to setTimeout
        timers[chartKey] = setTimeout(() => {
          setChartLoadStates(prev => ({
            ...prev,
            [chartKey]: true
          }));
        }, delay);
      }
    };

    // Set up progressive loading timers
    Object.entries(loadDelays).forEach(([chartKey, delay]) => {
      scheduleChartLoad(chartKey, delay);
    });

    // Cleanup timers on unmount
    return () => {
      Object.values(timers).forEach(timer => {
        if (typeof timer === 'function') {
          timer();
        } else {
          clearTimeout(timer);
        }
      });
    };
  }, []);
  
  // Create chart components with progressive loading
  const chartComponents = [
    // <div key="balance-history" className="min-w-[300px] px-4 py-2">
    //   {chartLoadStates.balanceHistory ? (
    //     <LazyChart 
    //       ChartComponent={MiniBalanceHistoryChart}
    //       fallback={<ChartLoadingFallback />}
    //     />
    //   ) : (
    //     <ChartLoadingFallback />
    //   )}
    // </div>,
    <div key="top-games" className="min-w-[300px] px-4 py-2">
      {chartLoadStates.topGames ? (
        <LazyChart 
          ChartComponent={MiniTopGamesByProfitChart}
          fallback={<ChartLoadingFallback />}
        />
      ) : (
        <ChartLoadingFallback />
      )}
    </div>,
    <div key="daily-profit" className="min-w-[300px] px-4 py-2">
      {chartLoadStates.dailyProfit ? (
        <LazyChart 
          ChartComponent={MiniDailyProfitLossChart}
          fallback={<ChartLoadingFallback />}
        />
      ) : (
        <ChartLoadingFallback />
      )}
    </div>,
    <div key="win-loss-ratio" className="min-w-[300px] px-4 py-2">
      {chartLoadStates.winLossRatio ? (
        <LazyChart 
          ChartComponent={MiniGamblingWinLossRatioChart}
          fallback={<ChartLoadingFallback />}
        />
      ) : (
        <ChartLoadingFallback />
      )}
    </div>,
    <div key="favorite-game" className="min-w-[300px] px-4 py-2">
      {chartLoadStates.favoriteGame ? (
        <LazyChart 
          ChartComponent={MiniFavoriteGameOverTimeChart}
          fallback={<ChartLoadingFallback />}
        />
      ) : (
        <ChartLoadingFallback />
      )}
    </div>
  ];
  
  // Descriptions for each chart to display on hover
  const chartDescriptions = [
    // "Balance history over time",
    "Top games by profit/loss",
    "Daily profit and loss",
    "Win/loss ratio statistics",
    "Favorite game trends"
  ];

  return (
    <div className="w-full overflow-hidden bg-card rounded-lg shadow-lg p-2">
      <Ticker 
        items={chartComponents}
        duration={duration}
        pauseOnHover={pauseOnHover}
        itemClassName="flex-shrink-0"
        itemDescriptions={chartDescriptions}
      />
    </div>
  );
};

// Loading fallback component for charts
const ChartLoadingFallback = () => (
  <div className="h-32 w-full">
    <ChartLoadingSpinner size="sm" message="Loading chart..." />
  </div>
);

export default React.memo(ChartTicker);