import React, { useEffect, useState, useMemo } from 'react';
import { getTopGamesByProfit } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatDisplayNumber } from '../../utils/numberFormat';
import { subDays } from 'date-fns';
import { useDebounce } from '../../utils/chartOptimizer';
import useChartDataCache from '../../hooks/useChartDataCache';

const MiniTopGamesByProfitChart = () => {
  const { user } = useAuth();

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
    endDate
  }), [user?.discordId, startDate, endDate]);

  // Define the fetch function for top games by profit
  const fetchTopGamesByProfit = async (userId, startDate, endDate) => {
    return await getTopGamesByProfit(userId, startDate, endDate);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-wide font-heading">
        Top Games by Net Profit
      </h3>
      
      {formattedChartData.length > 0 ? (
        <div className="space-y-2">
          {formattedChartData.map((game, index) => {
            const colorClass = game.isPositive ? 'text-success' : 'text-error';
            
            return (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center">
                  <div className="w-6 text-center font-bold text-text-secondary">{index + 1}</div>
                  <div className="ml-3 font-medium">{game.formattedName}</div>
                </div>
                <div className={`font-bold ${colorClass}`}>
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

export default React.memo(MiniTopGamesByProfitChart);