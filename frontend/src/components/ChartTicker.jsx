import React, { lazy, Suspense, useState, useEffect } from 'react';
import Ticker from './Ticker';
import { LazyChart } from '../utils/chartOptimizer';

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
 */
const ChartTicker = ({ duration = 10, pauseOnHover = true }) => {
  // Define the chart components to be displayed in the ticker with LazyChart for optimization
  const [chartsReady, setChartsReady] = useState(false);
  
  // Delay chart loading to improve initial page performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setChartsReady(true);
    }, 300); // Small delay to prioritize UI rendering first
    
    return () => clearTimeout(timer);
  }, []);
  
  const chartComponents = [
    <div key="balance-history" className="min-w-[300px] px-4 py-2">
      {chartsReady && (
        <LazyChart 
          ChartComponent={MiniBalanceHistoryChart}
          fallback={<ChartLoadingFallback />}
        />
      )}
    </div>,
    <div key="top-games" className="min-w-[300px] px-4 py-2">
      {chartsReady && (
        <LazyChart 
          ChartComponent={MiniTopGamesByProfitChart}
          fallback={<ChartLoadingFallback />}
        />
      )}
    </div>,
    <div key="daily-profit" className="min-w-[300px] px-4 py-2">
      {chartsReady && (
        <LazyChart 
          ChartComponent={MiniDailyProfitLossChart}
          fallback={<ChartLoadingFallback />}
        />
      )}
    </div>,
    <div key="win-loss-ratio" className="min-w-[300px] px-4 py-2">
      {chartsReady && (
        <LazyChart 
          ChartComponent={MiniGamblingWinLossRatioChart}
          fallback={<ChartLoadingFallback />}
        />
      )}
    </div>,
    <div key="favorite-game" className="min-w-[300px] px-4 py-2">
      {chartsReady && (
        <LazyChart 
          ChartComponent={MiniFavoriteGameOverTimeChart}
          fallback={<ChartLoadingFallback />}
        />
      )}
    </div>
  ];
  
  // Descriptions for each chart to display on hover
  const chartDescriptions = [
    "Balance history over time",
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
  <div className="flex justify-center items-center h-32 w-full">
    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
  </div>
);

export default React.memo(ChartTicker);