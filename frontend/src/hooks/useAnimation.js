import { useUIStore } from '../store';
import { ANIMATION_VARIANTS } from '../contexts/AnimationContext';

/**
 * Custom hook for using animation state management from the UI store
 * This provides a similar API to the previous useAnimation hook that used AnimationContext
 * to make migration easier
 */
export const useAnimation = () => {
  const {
    animationsEnabled,
    animationSpeed,
    setAnimationsEnabled,
    setAnimationSpeed
  } = useUIStore();

  // Toggle animations on/off
  const toggleAnimations = () => {
    setAnimationsEnabled(!animationsEnabled);
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

  return {
    animationsEnabled,
    animationSpeed,
    toggleAnimations,
    setAnimationsEnabled,
    setAnimationSpeed,
    getVariants,
    variants: ANIMATION_VARIANTS
  };
};