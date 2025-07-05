import React from 'react';
import { motion } from 'framer-motion';

/**
 * Themed Loading Spinner
 * A rotating ring spinner using Framer Motion and Tailwind theme variables.
 * 
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg' | 'xl'} props.size
 * @param {'primary' | 'secondary' | 'accent' | 'white'} props.color
 * @param {boolean} props.overlay
 * @param {string} props.message
 * @param {string} props.className
 */
const LoadingSpinner = ({
  size = 'md',
  color = 'primary',
  overlay = false,
  message = '',
  className = '',
}) => {
  const sizeMap = {
    sm: 'h-4 w-4 border-[2px]',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-[4px]',
    xl: 'h-16 w-16 border-[5px]'
  };

  const colorTopMap = {
    primary: 'border-t-primary',
    secondary: 'border-t-secondary',
    accent: 'border-t-accent',
    white: 'border-t-white'
  };

  const colorRestMap = {
    primary: 'border-divider',
    secondary: 'border-divider',
    accent: 'border-divider',
    white: 'border-white/20'
  };

  const spinner = (
    <motion.div
      className={`flex flex-col items-center justify-center ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        className={`
          rounded-full 
          ${sizeMap[size] || sizeMap.md} 
          border-solid 
          ${colorRestMap[color] || 'border-divider'} 
          ${colorTopMap[color] || 'border-t-primary'}
        `}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
      {message && (
        <motion.p
          className="mt-3 text-sm text-text-secondary font-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-surface rounded-lg p-6 shadow-surface dark:shadow-surface-dark">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

export { LoadingSpinner };
export default LoadingSpinner;
