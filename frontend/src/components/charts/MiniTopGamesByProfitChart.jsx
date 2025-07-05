import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getTopGamesByProfit } from '../../services/api';
import { useUserStore, useGuildStore } from '../../store';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import { useDebounce } from '../../utils/chartOptimizer';
import useChartDataCache from '../../hooks/useChartDataCache';
import ChartLoadingSpinner from './ChartLoadingSpinner';

const MiniTopGamesByProfitChart = () => {
  const user = useUserStore(state => state.user);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);

  // Intersection Observer for lazy loading
  const chartRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Memoize date range to prevent re-creation on every render
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 30);
    return { startDate: start, endDate: end };
  }, []);

  // Memoize params to prevent infinite re-fetching
  const params = useMemo(() => ({
    userId: user?.discordId || '',
    startDate,
    endDate,
    guildId: selectedGuildId
  }), [user?.discordId, startDate, endDate, selectedGuildId]);

  // Define the fetch function for top games by profit
  const fetchTopGamesByProfit = async (userId, startDate, endDate, guildId) => {
    return await getTopGamesByProfit(userId, startDate, endDate, guildId);
  };

  // Use the chart data cache hook for optimized data fetching
  const { data: response, loading } = useChartDataCache(fetchTopGamesByProfit, params);

  // Memoize chart data
  const chartData = useMemo(() => {
    if (response && response.profitByGame) {
      // Sort by net profit and take top 3
      return [...response.profitByGame]
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, 3);
    }
    return [];
  }, [response]);

  // Capitalize first letter of game name
  const formatGameName = (name) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  
  // Debounce chart data to prevent excessive re-renders
  const debouncedChartData = useDebounce(chartData, 300);
  
  // Memoize the formatted chart data
  const formattedChartData = useMemo(() => {
    return debouncedChartData.map(game => ({
      ...game,
      formattedName: formatGameName(game.game),
      isPositive: game.netProfit >= 0,
      formattedProfit: formatDisplayNumber(game.netProfit, true)
    }));
  }, [debouncedChartData]);

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

  // Don't render if not visible or not ready
  if (!isVisible || !shouldRender) {
    return (
      <div ref={chartRef} className="w-full h-full">
        <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
          Top Games by Net Profit
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
          Top Games by Net Profit
        </h3>
        <div className="h-32">
          <ChartLoadingSpinner size="sm" message="Loading top games..." />
        </div>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Top Games by Net Profit
      </h3>
      
      {formattedChartData.length > 0 ? (
        <div className="space-y-1.5"> {/* Reduced spacing for mini chart */}
          {formattedChartData.map((game, index) => {
            const colorClass = game.isPositive ? 'text-success' : 'text-error';
            
            return (
              <div 
                key={index} 
                className="flex items-center justify-between p-2 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center">
                  <div className="w-5 text-center font-bold text-text-secondary text-sm">{index + 1}</div>
                  <div className="ml-2 font-medium text-sm">{game.formattedName}</div>
                </div>
                <div className={`font-bold text-sm ${colorClass}`}>
                  {game.formattedProfit}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center h-32 text-text-secondary">
          <p className="text-center">No game profit data available.</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(MiniTopGamesByProfitChart, (prevProps, nextProps) => {
  // Since this component doesn't take props, always return true to prevent re-renders
  return true;
});