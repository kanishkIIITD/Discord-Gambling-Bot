import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * VirtualScroll component for efficiently rendering large lists
 * Only renders items that are visible in the viewport plus a buffer
 */
const VirtualScroll = ({
  items = [],
  itemHeight = 50,
  height = 400,
  width = '100%',
  overscan = 5,
  renderItem,
  keyExtractor,
  className = '',
  onEndReached,
  onEndReachedThreshold = 0.8,
  onScroll,
  scrollToIndex,
  scrollToAlignment = 'start',
  estimatedItemSize,
  ...props
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimeoutRef = useRef(null);
  const lastOnEndReachedIndex = useRef(-1);

  // Calculate the range of visible items
  const getVisibleRange = useCallback(() => {
    if (!containerRef.current) return { startIndex: 0, endIndex: overscan * 2 };

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + height) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, height, itemHeight, items.length, overscan]);

  const { startIndex, endIndex } = getVisibleRange();

  // Handle scroll events
  const handleScroll = useCallback(
    (event) => {
      const { scrollTop: newScrollTop } = event.currentTarget;
      setScrollTop(newScrollTop);
      setIsScrolling(true);

      // Clear previous timeout
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }

      // Set a timeout to stop isScrolling after scrolling stops
      scrollingTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      // Call onScroll prop if provided
      if (onScroll) {
        onScroll(event);
      }

      // Check if we need to load more items
      if (onEndReached) {
        const visibleHeight = height;
        const contentHeight = items.length * itemHeight;
        const scrolledToPercentage = (newScrollTop + visibleHeight) / contentHeight;

        if (
          scrolledToPercentage > onEndReachedThreshold &&
          lastOnEndReachedIndex.current !== items.length
        ) {
          lastOnEndReachedIndex.current = items.length;
          onEndReached();
        }
      }
    },
    [height, itemHeight, items.length, onEndReached, onEndReachedThreshold, onScroll]
  );

  // Scroll to a specific item index
  useEffect(() => {
    if (scrollToIndex !== undefined && containerRef.current) {
      let scrollPosition;

      switch (scrollToAlignment) {
        case 'center':
          scrollPosition = scrollToIndex * itemHeight - height / 2 + itemHeight / 2;
          break;
        case 'end':
          scrollPosition = (scrollToIndex + 1) * itemHeight - height;
          break;
        case 'start':
        default:
          scrollPosition = scrollToIndex * itemHeight;
          break;
      }

      containerRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [scrollToIndex, scrollToAlignment, itemHeight, height]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, []);

  // Render only the visible items
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex && i < items.length; i++) {
    const item = items[i];
    const key = keyExtractor ? keyExtractor(item, i) : i;
    const style = {
      position: 'absolute',
      top: `${i * itemHeight}px`,
      height: `${itemHeight}px`,
      left: 0,
      right: 0,
      willChange: isScrolling ? 'transform' : undefined,
    };

    visibleItems.push(
      <div key={key} style={style} data-index={i}>
        {renderItem({ item, index: i, isScrolling })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll-container ${className}`}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
        willChange: 'transform',
        ...props.style,
      }}
      onScroll={handleScroll}
      {...props}
    >
      <div
        className="virtual-scroll-content"
        style={{
          height: `${items.length * itemHeight}px`,
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
};

/**
 * VirtualScrollWithVariableHeights component for efficiently rendering large lists with variable item heights
 * Uses a more complex algorithm to handle items of different heights
 */
export const VirtualScrollWithVariableHeights = ({
  items = [],
  estimatedItemSize = 50,
  height = 400,
  width = '100%',
  overscan = 5,
  renderItem,
  keyExtractor,
  className = '',
  onEndReached,
  onEndReachedThreshold = 0.8,
  onScroll,
  scrollToIndex,
  scrollToAlignment = 'start',
  ...props
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimeoutRef = useRef(null);
  const lastOnEndReachedIndex = useRef(-1);
  
  // Store measured item heights
  const [itemHeights, setItemHeights] = useState({});
  const [totalHeight, setTotalHeight] = useState(items.length * estimatedItemSize);
  
  // Calculate item positions based on known heights or estimates
  const getItemPosition = useCallback(
    (index) => {
      let position = 0;
      for (let i = 0; i < index; i++) {
        position += itemHeights[i] || estimatedItemSize;
      }
      return position;
    },
    [itemHeights, estimatedItemSize]
  );
  
  // Calculate the range of visible items
  const getVisibleRange = useCallback(() => {
    if (!containerRef.current) return { startIndex: 0, endIndex: overscan * 2 };
    
    // Binary search to find the first visible item
    let low = 0;
    let high = items.length - 1;
    let startIndex = 0;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const position = getItemPosition(mid);
      
      if (position <= scrollTop) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    // Find the end index by scanning forward
    let endIndex = startIndex;
    let currentPosition = getItemPosition(startIndex);
    
    while (
      endIndex < items.length - 1 &&
      currentPosition < scrollTop + height
    ) {
      endIndex++;
      currentPosition += itemHeights[endIndex] || estimatedItemSize;
    }
    
    // Add overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(items.length - 1, endIndex + overscan);
    
    return { startIndex, endIndex };
  }, [scrollTop, height, items.length, overscan, getItemPosition]);
  
  const { startIndex, endIndex } = getVisibleRange();
  
  // Handle item measurement
  const measureItem = useCallback(
    (index, height) => {
      setItemHeights((prev) => {
        if (prev[index] === height) return prev;
        
        const newHeights = { ...prev, [index]: height };
        
        // Recalculate total height
        let newTotalHeight = 0;
        for (let i = 0; i < items.length; i++) {
          newTotalHeight += newHeights[i] || estimatedItemSize;
        }
        setTotalHeight(newTotalHeight);
        
        return newHeights;
      });
    },
    [items.length, estimatedItemSize]
  );
  
  // Handle scroll events
  const handleScroll = useCallback(
    (event) => {
      const { scrollTop: newScrollTop } = event.currentTarget;
      setScrollTop(newScrollTop);
      setIsScrolling(true);
      
      // Clear previous timeout
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
      
      // Set a timeout to stop isScrolling after scrolling stops
      scrollingTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
      
      // Call onScroll prop if provided
      if (onScroll) {
        onScroll(event);
      }
      
      // Check if we need to load more items
      if (onEndReached) {
        const scrolledToPercentage = (newScrollTop + height) / totalHeight;
        
        if (
          scrolledToPercentage > onEndReachedThreshold &&
          lastOnEndReachedIndex.current !== items.length
        ) {
          lastOnEndReachedIndex.current = items.length;
          onEndReached();
        }
      }
    },
    [height, items.length, onEndReached, onEndReachedThreshold, onScroll, totalHeight]
  );
  
  // Scroll to a specific item index
  useEffect(() => {
    if (scrollToIndex !== undefined && containerRef.current) {
      const itemPosition = getItemPosition(scrollToIndex);
      const itemHeight = itemHeights[scrollToIndex] || estimatedItemSize;
      
      let scrollPosition;
      
      switch (scrollToAlignment) {
        case 'center':
          scrollPosition = itemPosition - height / 2 + itemHeight / 2;
          break;
        case 'end':
          scrollPosition = itemPosition + itemHeight - height;
          break;
        case 'start':
        default:
          scrollPosition = itemPosition;
          break;
      }
      
      containerRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [scrollToIndex, scrollToAlignment, getItemPosition, itemHeights, estimatedItemSize, height]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, []);
  
  // Render only the visible items
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex && i < items.length; i++) {
    const item = items[i];
    const key = keyExtractor ? keyExtractor(item, i) : i;
    const itemPosition = getItemPosition(i);
    
    const ItemWrapper = ({ children }) => {
      const itemRef = useRef(null);
      
      useEffect(() => {
        if (itemRef.current) {
          const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
              measureItem(i, entry.contentRect.height);
            }
          });
          
          observer.observe(itemRef.current);
          return () => observer.disconnect();
        }
      }, []);
      
      return (
        <div
          ref={itemRef}
          style={{
            position: 'absolute',
            top: `${itemPosition}px`,
            left: 0,
            right: 0,
            willChange: isScrolling ? 'transform' : undefined,
          }}
          data-index={i}
        >
          {children}
        </div>
      );
    };
    
    visibleItems.push(
      <ItemWrapper key={key}>
        {renderItem({ item, index: i, isScrolling })}
      </ItemWrapper>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className={`virtual-scroll-container ${className}`}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
        willChange: 'transform',
        ...props.style,
      }}
      onScroll={handleScroll}
      {...props}
    >
      <div
        className="virtual-scroll-content"
        style={{
          height: `${totalHeight}px`,
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
};

export default React.memo(VirtualScroll);