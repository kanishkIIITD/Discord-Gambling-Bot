import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAnimation } from '../contexts/AnimationContext';

/**
 * PageTransition component
 * Wraps page content with consistent animations
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to animate
 * @param {string} props.variant - Animation variant to use (default: 'PAGE_TRANSITION')
 * @param {string} props.className - Additional CSS classes
 */
const PageTransition = ({ 
  children, 
  variant = 'PAGE_TRANSITION',
  className = '',
  ...props 
}) => {
  const { getVariants, animationsEnabled } = useAnimation();
  const pageRef = useRef(null);
  
  // Get the appropriate animation variants
  const animationVariants = getVariants(variant);
  
  // Add stagger-container class to enable CSS animations if needed
  useEffect(() => {
    if (pageRef.current) {
      // Find all stagger containers and add the animate class after a short delay
      const staggerContainers = pageRef.current.querySelectorAll('.stagger-container');
      
      if (staggerContainers.length > 0) {
        const timer = setTimeout(() => {
          staggerContainers.forEach(container => {
            container.classList.add('animate');
          });
        }, 100); // Small delay to ensure the page has rendered
        
        return () => clearTimeout(timer);
      }
    }
  }, []);
  
  // If animations are disabled, render without motion
  if (!animationsEnabled) {
    return (
      <div ref={pageRef} className={className} {...props}>
        {children}
      </div>
    );
  }
  
  return (
    <motion.div
      ref={pageRef}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={animationVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;