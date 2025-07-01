/**
 * Style Utilities for consistent styling across components
 * This helps reduce duplicate CSS classes and improves maintainability
 */

// Common button styles
export const buttonStyles = {
  primary: 'bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded transition-colors duration-200',
  secondary: 'bg-secondary hover:bg-secondary-dark text-white font-bold py-2 px-4 rounded transition-colors duration-200',
  danger: 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors duration-200',
  success: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition-colors duration-200',
  outline: 'border border-primary text-primary hover:bg-primary hover:text-white font-bold py-2 px-4 rounded transition-all duration-200',
  disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed font-bold py-2 px-4 rounded',
  icon: 'p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200',
  small: 'text-sm py-1 px-3',
  large: 'text-lg py-3 px-6',
};

// Common card styles
export const cardStyles = {
  base: 'bg-card rounded-lg shadow-md p-4 border border-border',
  hover: 'hover:shadow-lg transition-shadow duration-200',
  interactive: 'cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200',
};

// Common input styles
export const inputStyles = {
  base: 'w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200',
  error: 'border-red-500 focus:ring-red-500',
  disabled: 'bg-gray-100 text-gray-500 cursor-not-allowed',
};

// Common text styles
export const textStyles = {
  heading1: 'text-3xl font-bold text-text-primary',
  heading2: 'text-2xl font-bold text-text-primary',
  heading3: 'text-xl font-bold text-text-primary',
  body: 'text-base text-text-secondary',
  small: 'text-sm text-text-tertiary',
  error: 'text-sm text-red-500',
  success: 'text-sm text-green-500',
};

// Common layout styles
export const layoutStyles = {
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  section: 'py-8',
  flexRow: 'flex flex-row items-center',
  flexCol: 'flex flex-col',
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  grid2: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  grid3: 'grid grid-cols-1 md:grid-cols-3 gap-4',
  grid4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
};

// Common animation styles
export const animationStyles = {
  fadeIn: 'animate-fadeIn',
  slideIn: 'animate-slideIn',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  bounce: 'animate-bounce',
};

// Helper function to combine multiple styles
export const combineStyles = (...styles) => {
  return styles.filter(Boolean).join(' ');
};

// Helper function for conditional styles
export const conditionalStyle = (condition, trueStyle, falseStyle = '') => {
  return condition ? trueStyle : falseStyle;
};