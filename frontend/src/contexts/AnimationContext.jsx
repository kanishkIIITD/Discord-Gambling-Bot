import React, { createContext, useContext, useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

// Create context
const AnimationContext = createContext(null);

/**
 * Animation variants for consistent animations across the application
 */
export const ANIMATION_VARIANTS = {
  // Page transitions
  PAGE_TRANSITION: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeInOut' }
  },
  
  // Component entry animations
  FADE_IN_UP: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' }
  },
  
  FADE_IN_DOWN: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' }
  },
  
  FADE_IN_LEFT: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, ease: 'easeOut' }
  },
  
  FADE_IN_RIGHT: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, ease: 'easeOut' }
  },
  
  // Scale animations
  SCALE_IN: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] }
  },
  
  // Staggered children animations
  STAGGER_CHILDREN: {
    animate: { transition: { staggerChildren: 0.1 } }
  },
  
  // Child animations for staggered containers
  CHILD_FADE_IN: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  
  // Hover animations
  HOVER_SCALE: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: { type: 'spring', stiffness: 400, damping: 10 }
  },
  
  // Button animations
  BUTTON_TAP: {
    whileTap: { scale: 0.95 },
    transition: { duration: 0.1 }
  },
  
  // Card animations
  CARD_HOVER: {
    whileHover: { y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' },
    transition: { duration: 0.2 }
  }
};

/**
 * Animation provider component
 * Manages animation preferences and provides animation utilities to the application
 */
export const AnimationProvider = ({ children }) => {
  // Check if user prefers reduced motion
  const prefersReducedMotion = useReducedMotion();
  
  // State for animation enabled/disabled
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    // Try to get the animation preference from localStorage
    const savedPreference = localStorage.getItem('animationsEnabled');
    // Default to true unless user prefers reduced motion or has explicitly disabled
    return savedPreference !== null ? savedPreference === 'true' : !prefersReducedMotion;
  });

  // Effect to save animation preference to localStorage
  useEffect(() => {
    localStorage.setItem('animationsEnabled', animationsEnabled.toString());
  }, [animationsEnabled]);

  // Toggle animations on/off
  const toggleAnimations = () => {
    setAnimationsEnabled(prev => !prev);
  };

  // Get appropriate variants based on animation preferences
  const getVariants = (variant) => {
    if (!animationsEnabled) {
      // Return empty variants if animations are disabled
      return {
        initial: {},
        animate: {},
        exit: {},
        transition: { duration: 0 }
      };
    }
    return ANIMATION_VARIANTS[variant] || {};
  };

  // Context value
  const contextValue = {
    animationsEnabled,
    toggleAnimations,
    getVariants,
    variants: ANIMATION_VARIANTS
  };

  return <AnimationContext.Provider value={contextValue}>{children}</AnimationContext.Provider>;
};

/**
 * Custom hook to use the animation context
 * @returns {Object} Animation context value
 * @throws {Error} If used outside of an AnimationProvider
 */
export const useAnimation = () => {
  const context = useContext(AnimationContext);
  if (context === null) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
};

export default AnimationContext;