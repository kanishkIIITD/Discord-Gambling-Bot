import { ANIMATION_VARIANTS } from '../contexts/AnimationContext';

/**
 * Animation utility functions for consistent animations across the application
 */

/**
 * Creates staggered animation variants for a list of items
 * @param {number} staggerDelay - Delay between each item animation in seconds
 * @param {number} duration - Duration of each item animation in seconds
 * @returns {Object} Animation variants object for parent container
 */
export const createStaggeredAnimation = (staggerDelay = 0.1, duration = 0.3) => {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
        duration
      }
    }
  };
};

/**
 * Creates animation variants for a child item in a staggered animation
 * @param {number} y - Y offset for the animation
 * @param {number} duration - Duration of the animation in seconds
 * @returns {Object} Animation variants object for child item
 */
export const createChildAnimation = (y = 20, duration = 0.3) => {
  return {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 15,
        stiffness: 300,
        duration
      }
    }
  };
};

/**
 * Creates a page transition animation
 * @param {string} direction - Direction of the animation ('up', 'down', 'left', 'right')
 * @returns {Object} Animation variants object for page transition
 */
export const createPageTransition = (direction = 'up') => {
  const offset = 30;
  let initial = {};
  
  switch (direction) {
    case 'up':
      initial = { opacity: 0, y: offset };
      break;
    case 'down':
      initial = { opacity: 0, y: -offset };
      break;
    case 'left':
      initial = { opacity: 0, x: offset };
      break;
    case 'right':
      initial = { opacity: 0, x: -offset };
      break;
    default:
      initial = { opacity: 0 };
  }
  
  return {
    initial,
    animate: { 
      opacity: 1, 
      y: 0, 
      x: 0,
      transition: { 
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1]
      }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };
};

/**
 * Creates a hover animation for interactive elements
 * @param {number} scale - Scale factor for the hover effect
 * @param {number} y - Y offset for the hover effect
 * @returns {Object} Animation variants object for hover animation
 */
export const createHoverAnimation = (scale = 1.05, y = -5) => {
  return {
    whileHover: { 
      scale, 
      y,
      transition: { 
        type: 'spring', 
        stiffness: 400, 
        damping: 10 
      }
    },
    whileTap: { 
      scale: 0.95,
      transition: { 
        type: 'spring', 
        stiffness: 400, 
        damping: 10 
      }
    }
  };
};

/**
 * Creates a fade-in animation with a specified direction
 * @param {string} direction - Direction of the animation ('up', 'down', 'left', 'right', 'none')
 * @param {number} distance - Distance to travel in pixels
 * @param {number} duration - Duration of the animation in seconds
 * @returns {Object} Animation variants object for fade-in animation
 */
export const createFadeInAnimation = (direction = 'up', distance = 20, duration = 0.5) => {
  let initial = { opacity: 0 };
  
  switch (direction) {
    case 'up':
      initial = { ...initial, y: distance };
      break;
    case 'down':
      initial = { ...initial, y: -distance };
      break;
    case 'left':
      initial = { ...initial, x: distance };
      break;
    case 'right':
      initial = { ...initial, x: -distance };
      break;
    case 'none':
    default:
      // Just fade in without movement
      break;
  }
  
  return {
    initial,
    animate: { 
      opacity: 1, 
      y: 0, 
      x: 0,
      transition: { 
        duration,
        ease: 'easeOut'
      }
    }
  };
};

/**
 * Get predefined animation variants from the ANIMATION_VARIANTS object
 * @param {string} variantName - Name of the variant to get
 * @returns {Object} Animation variants object
 */
export const getAnimationVariant = (variantName) => {
  return ANIMATION_VARIANTS[variantName] || {};
};

/**
 * Creates a custom animation sequence
 * @param {Array} keyframes - Array of keyframe objects
 * @param {Object} transition - Transition options
 * @returns {Object} Animation variants object
 */
export const createCustomAnimation = (keyframes, transition = { duration: 0.5 }) => {
  return {
    initial: keyframes[0],
    animate: {
      ...keyframes[keyframes.length - 1],
      transition
    },
    keyframes
  };
};