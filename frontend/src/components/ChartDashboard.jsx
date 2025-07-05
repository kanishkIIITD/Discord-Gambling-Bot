import React, { Suspense, lazy } from 'react';
import { LazyChart } from '../utils/chartOptimizer';
import ChartLoadingSpinner from './charts/ChartLoadingSpinner';

// Lazy load chart components
const DailyProfitLossChart = lazy(() => import('./charts/DailyProfitLossChart'));
const BalanceHistoryGraph = lazy(() => import('./charts/BalanceHistoryGraph'));
const GameComparisonMatrixChart = lazy(() => import('./charts/GameComparisonMatrixChart'));
const TopGamesByProfitChart = lazy(() => import('./charts/TopGamesByProfitChart'));
const FavoriteGameTrendChart = lazy(() => import('./charts/FavoriteGameTrendChart'));
const GamblingPerformancePieChart = lazy(() => import('./charts/GamblingPerformancePieChart'));
const TimeOfDayHeatmapChart = lazy(() => import('./charts/TimeOfDayHeatmapChart'));
const GameTypeDistributionChart = lazy(() => import('./charts/GameTypeDistributionChart'));
const TransactionTypeAnalysisChart = lazy(() => import('./charts/TransactionTypeAnalysisChart'));

/**
 * ChartDashboard Component
 * 
 * A dashboard that displays multiple charts with optimization techniques:
 * - Lazy loading of chart components
 * - LazyChart wrapper to render charts only when visible
 * - Suspense for loading fallbacks
 */
const ChartDashboard = ({ dateRange, targetUserId, guildId }) => {
  // Common props for all charts
  const chartProps = {
    dateRange,
    targetUserId,
    guildId
  };

  // Loading fallback component for charts
  const ChartLoadingFallback = () => (
    <div className="h-64 w-full">
      <ChartLoadingSpinner size="lg" />
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-8 font-heading">Gambling Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Daily Profit/Loss Chart */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <DailyProfitLossChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
        
        {/* Balance History Graph */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <BalanceHistoryGraph {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Top Games By Profit */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <TopGamesByProfitChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
        
        {/* Gambling Performance Pie Chart */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <GamblingPerformancePieChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
        
        {/* Game Type Distribution */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <GameTypeDistributionChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Game Comparison Matrix */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <GameComparisonMatrixChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
        
        {/* Favorite Game Trend */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <FavoriteGameTrendChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time of Day Heatmap */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <TimeOfDayHeatmapChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
        
        {/* Transaction Type Analysis */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <LazyChart
            ChartComponent={() => (
              <Suspense fallback={<ChartLoadingFallback />}>
                <TransactionTypeAnalysisChart {...chartProps} />
              </Suspense>
            )}
            fallback={<ChartLoadingFallback />}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChartDashboard);