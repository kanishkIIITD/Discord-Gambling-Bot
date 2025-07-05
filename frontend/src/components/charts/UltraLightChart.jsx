import React, { useRef, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import chartPerformanceMonitor from '../../utils/chartPerformanceMonitor';

/**
 * Ultra Light Chart Component
 * 
 * Uses minimal ECharts options and aggressive performance optimizations
 * to prevent long tasks and improve rendering speed
 */
const UltraLightChart = ({ 
  options, 
  height = '120px', 
  width = '100%',
  className = '',
  onRender 
}) => {
  const chartRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const renderTimeoutRef = useRef(null);

  // Handle chart render completion
  const handleChartRender = () => {
    if (!isRendered) {
      setIsRendered(true);
      // Track chart render performance
      chartPerformanceMonitor.trackChartRender('UltraLightChart', 0); // Duration tracked separately
      if (onRender) {
        onRender();
      }
    }
  };

  // Use requestIdleCallback for chart rendering
  useEffect(() => {
    if (options && !isRendered) {
      if (window.requestIdleCallback) {
        renderTimeoutRef.current = window.requestIdleCallback(
          () => {
            // Chart will render when ReactECharts mounts
          },
          { timeout: 1000 }
        );
      }
    }

    return () => {
      if (renderTimeoutRef.current && window.cancelIdleCallback) {
        window.cancelIdleCallback(renderTimeoutRef.current);
      }
    };
  }, [options, isRendered]);

  if (!options) {
    return (
      <div 
        ref={chartRef}
        style={{ height, width }} 
        className={`bg-card rounded-lg animate-pulse ${className}`}
      >
        <div className="h-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div ref={chartRef} style={{ height, width }} className={className}>
      <ReactECharts 
        option={options} 
        style={{ height: '100%', width: '100%' }} 
        className="bg-card rounded-lg"
        notMerge={true}
        lazyUpdate={true}
        opts={{
          renderer: 'canvas',
          useDirtyRect: true,
          // Additional performance options
          throttle: 70, // Throttle rendering to 70ms
          progressive: 500,
          progressiveThreshold: 3000,
        }}
        onEvents={{
          rendered: handleChartRender
        }}
      />
    </div>
  );
};

export default React.memo(UltraLightChart); 