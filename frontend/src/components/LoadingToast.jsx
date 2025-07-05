import React from 'react';
import { motion } from 'framer-motion';
import { useLoading } from '../hooks/useLoading';

/**
 * LoadingToast Component
 * 
 * A toast notification component that integrates with LoadingContext
 * to display loading states with customizable appearance.
 * 
 * @param {Object} props
 * @param {string} props.loadingKey - The key to track in LoadingContext
 * @param {string} props.message - Message to display during loading
 * @param {string} props.size - Size of the spinner (sm, md, lg)
 * @param {string} props.color - Color of the spinner (primary, secondary, white, accent)
 * @param {string} props.className - Additional CSS classes
 */
const LoadingToast = ({
  loadingKey,
  message = 'Loading...',
  size = 'sm',
  color = 'primary',
  className = '',
}) => {
  const { isLoading } = useLoading();
  const loading = isLoading(loadingKey);
  
  // Size mappings
  const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  // Color mappings with theme-aware colors
  const colorMap = {
    primary: 'border-primary',
    secondary: 'border-secondary',
    white: 'border-white',
    accent: 'border-accent'
  };
  
  if (!loading) return null;
  
  return (
    <motion.div 
      className={`flex items-center gap-3 bg-surface p-3 rounded-md shadow-md ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={`animate-spin rounded-full border-b-2 ${sizeMap[size] || sizeMap.sm} ${colorMap[color] || colorMap.primary}`}
        animate={{ rotate: 360 }}
        transition={{ 
          duration: 1, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      />
      <span className="text-sm text-text-primary">{message}</span>
    </motion.div>
  );
};

export default LoadingToast;