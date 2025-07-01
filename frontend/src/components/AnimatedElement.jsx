import React from 'react';
import { motion } from 'framer-motion';
import { useAnimation } from '../contexts/AnimationContext';

/**
 * AnimatedElement component
 * Wraps elements with consistent animations
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to animate
 * @param {string} props.variant - Animation variant to use
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.as - HTML element or component to render as
 * @param {number} props.delay - Delay before animation starts (in seconds)
 */
const AnimatedElement = ({ 
  children, 
  variant = 'FADE_IN_UP',
  className = '',
  as = 'div',
  delay = 0,
  ...props 
}) => {
  const { getVariants, animationsEnabled } = useAnimation();
  
  // Get the appropriate animation variants
  const animationVariants = getVariants(variant);
  
  // Add delay to the transition if specified
  const transition = {
    ...animationVariants.transition,
    delay
  };
  
  // If animations are disabled, render without motion
  if (!animationsEnabled) {
    const Component = as;
    return (
      <Component className={className} {...props}>
        {children}
      </Component>
    );
  }
  
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover={animationVariants.whileHover}
      whileTap={animationVariants.whileTap}
      variants={animationVariants}
      transition={transition}
      className={className}
      as={as}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedElement;