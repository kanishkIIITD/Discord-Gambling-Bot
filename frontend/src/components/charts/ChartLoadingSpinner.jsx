import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

/**
 * ChartLoadingSpinner Component
 * 
 * A specialized loading spinner for chart components with consistent styling.
 * Uses the standard LoadingSpinner component with chart-specific defaults.
 * 
 * @param {Object} props
 * @param {string} props.size - Size of the spinner (sm, md, lg)
 * @param {string} props.message - Optional message to display below the spinner
 */
const ChartLoadingSpinner = ({ size = 'md', message = 'Loading chart data...' }) => {
  // Map sizes for chart contexts
  const sizeMap = {
    sm: 'sm', // For mini charts
    md: 'md', // For standard charts
    lg: 'lg'  // For large charts
  };

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[100px]">
      <LoadingSpinner 
        size={sizeMap[size] || 'md'} 
        color="primary" 
        message={message} 
      />
    </div>
  );
};

export default ChartLoadingSpinner;