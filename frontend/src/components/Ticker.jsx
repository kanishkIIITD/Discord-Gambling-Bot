import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Ticker Component
 * 
 * A reusable component that creates an infinitely-scrolling marquee effect
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of items to display in the ticker
 * @param {number} props.duration - Duration of one complete cycle in seconds (default: 20)
 * @param {boolean} props.reverse - Whether to reverse the animation direction (default: false)
 * @param {string} props.className - Additional CSS classes for the container
 * @param {string} props.itemClassName - Additional CSS classes for each item
 * @param {boolean} props.pauseOnHover - Whether to pause the animation on hover (default: false)
 * @param {boolean} props.vertical - Whether to animate vertically instead of horizontally (default: false)
 * @param {Array} props.itemDescriptions - Optional short descriptions for each item to show on hover
 */
const Ticker = ({
  items = [],
  duration = 20,
  reverse = false,
  className = '',
  itemClassName = '',
  pauseOnHover = false,
  vertical = false,
  itemDescriptions = [],
}) => {
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const [repeats, setRepeats] = React.useState(1);

  // Memoize the calculation function to prevent unnecessary recalculations
  const calculateRepeats = useCallback(() => {
    if (!containerRef.current || !innerRef.current) return;
    
    if (vertical) {
      const containerHeight = containerRef.current.offsetHeight;
      const innerHeight = innerRef.current.offsetHeight;
      setHeight(innerHeight);
      setRepeats(Math.max(2, Math.ceil((containerHeight * 2) / innerHeight)));
    } else {
      const containerWidth = containerRef.current.offsetWidth;
      const innerWidth = innerRef.current.offsetWidth;
      setWidth(innerWidth);
      setRepeats(Math.max(2, Math.ceil((containerWidth * 2) / innerWidth)));
    }
  }, [vertical]);

  // Calculate how many repeats we need to fill the container
  useEffect(() => {
    if (!containerRef.current || !innerRef.current) return;

    calculateRepeats();

    // Use ResizeObserver to recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to throttle calculations during resize
      window.requestAnimationFrame(calculateRepeats);
    });
    
    resizeObserver.observe(containerRef.current);
    resizeObserver.observe(innerRef.current);

    return () => resizeObserver.disconnect();
  }, [items, vertical, calculateRepeats]);

  // Animation variants
  const tickerVariants = {
    animate: {
      x: vertical ? 0 : reverse ? width : -width,
      y: vertical ? (reverse ? height : -height) : 0,
      transition: {
        duration: duration,
        repeat: Infinity,
        repeatType: 'loop',
        ease: 'linear',
      },
    },
  };

  // Generate repeated items
  const repeatedItems = [];
  for (let i = 0; i < repeats; i++) {
    repeatedItems.push(...items);
  }

  return (
    <div 
      ref={containerRef}
      className={`ticker-container overflow-hidden ${vertical ? 'h-full' : 'w-full'} ${className}`}
      style={{ position: 'relative' }}
    >
      <motion.div
        className="ticker-wrapper flex"
        style={{
          flexDirection: vertical ? 'column' : 'row',
          width: vertical ? '100%' : 'fit-content',
          height: vertical ? 'fit-content' : '100%',
        }}
        variants={tickerVariants}
        animate="animate"
        initial={false}
        whileHover={pauseOnHover ? { animationPlayState: 'paused' } : undefined}
      >
        <div 
          ref={innerRef} 
          className="ticker-original"
          style={{
            display: 'flex',
            flexDirection: vertical ? 'column' : 'row',
          }}
        >
          {items.map((item, index) => (
            <div 
              key={`original-${index}`} 
              className={`ticker-item relative ${itemClassName} border-r border-gray-200 dark:border-gray-700 last:border-r-0 transition-all duration-300 hover:scale-95 group`}
              style={{ padding: '0 12px' }}
            >
              <div className="group-hover:blur-sm transition-all duration-300">
                {item}
              </div>
              <AnimatePresence>
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center text-text-primary rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-center text-sm font-medium px-4">
                    {itemDescriptions[index] || `Item ${index + 1}`}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          ))}
        </div>

        {Array.from({ length: repeats - 1 }).map((_, repeatIndex) => (
          <div 
            key={`repeat-${repeatIndex}`} 
            className="ticker-repeat"
            style={{
              display: 'flex',
              flexDirection: vertical ? 'column' : 'row',
            }}
          >
            {items.map((item, itemIndex) => (
              <div 
                key={`repeat-${repeatIndex}-${itemIndex}`} 
                className={`ticker-item relative ${itemClassName} border-r border-gray-200 dark:border-gray-700 last:border-r-0 transition-all duration-300 hover:scale-95 group`}
                style={{ padding: '0 12px' }}
              >
                <div className="group-hover:blur-sm transition-all duration-300">
                  {item}
                </div>
                <AnimatePresence>
                  <motion.div 
                    className="absolute inset-0 flex items-center justify-center text-text-primary rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-center text-sm font-medium px-4">
                      {itemDescriptions[itemIndex] || `Item ${itemIndex + 1}`}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default memo(Ticker);