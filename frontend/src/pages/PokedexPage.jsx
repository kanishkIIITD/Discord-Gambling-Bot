import React from 'react';
import PokedexTracker from '../components/PokedexTracker';
import useDashboardData from '../hooks/useDashboardData';
import LoadingSpinner from '../components/LoadingSpinner';

const PokedexPage = () => {
  // Use the centralized dashboard data hook
  const { 
    isLoading: isDashboardLoading,
    user,
    isGuildSwitching
  } = useDashboardData();

  // Loading Spinner - only show if dashboard data is still loading
  // BUT don't show it during guild switching (let the guild switching overlay handle it)
  if (isDashboardLoading && !isGuildSwitching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading dashboard data..." />
      </div>
    );
  }

  return <PokedexTracker />;
};

export default PokedexPage; 