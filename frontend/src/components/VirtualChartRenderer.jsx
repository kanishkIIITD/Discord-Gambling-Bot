import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChartWorker } from '../hooks/useChartWorker';

/**
 * Virtual Chart Renderer
 * 
 * Only renders charts when they're visible and uses requestIdleCallback
 * to prevent long tasks on the main thread
 */
const VirtualChartRenderer = ({ 
  children, 
  isVisible, 
  shouldRender, 
  chartType, 
  rawData, 
  theme,
  onChartReady 
}) => {
  const [processedData, setProcessedData] = useState(null);
  const [chartOptions, setChartOptions] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { sendToWorker, isWorkerReady } = useChartWorker();
  const processingRef = useRef(false);
  const idleCallbackRef = useRef(null);

  // Process data when raw data changes
  useEffect(() => {
    if (!rawData || !isVisible || !shouldRender || processingRef.current) return;

    const processData = async () => {
      processingRef.current = true;
      setIsProcessing(true);

      try {
        // Use requestIdleCallback to process data during idle time
        if (window.requestIdleCallback) {
          idleCallbackRef.current = window.requestIdleCallback(
            async (deadline) => {
              if (deadline.timeRemaining() > 10) {
                await performDataProcessing();
              } else {
                // If not enough time, schedule for next idle period
                idleCallbackRef.current = window.requestIdleCallback(
                  async () => await performDataProcessing(),
                  { timeout: 1000 }
                );
              }
            },
            { timeout: 2000 }
          );
        } else {
          // Fallback for browsers without requestIdleCallback
          await performDataProcessing();
        }
      } catch (error) {
        console.error('Error processing chart data:', error);
        setIsProcessing(false);
        processingRef.current = false;
      }
    };

    const performDataProcessing = async () => {
      try {
        // Process data using worker or main thread
        const processed = await sendToWorker(`process${chartType}`, rawData, theme);
        setProcessedData(processed);

        // Generate chart options
        const options = await sendToWorker('createChartOptions', {
          chartType: chartType.toLowerCase(),
          chartData: processed
        }, theme);
        setChartOptions(options);

        if (onChartReady) {
          onChartReady(processed, options);
        }
      } catch (error) {
        console.error('Error in data processing:', error);
      } finally {
        setIsProcessing(false);
        processingRef.current = false;
      }
    };

    processData();

    // Cleanup function
    return () => {
      if (idleCallbackRef.current && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleCallbackRef.current);
      }
      processingRef.current = false;
    };
  }, [rawData, isVisible, shouldRender, chartType, theme, sendToWorker, onChartReady]);

  // Don't render if not visible or not ready
  if (!isVisible || !shouldRender) {
    return (
      <div className="w-full h-full">
        <div className="h-32 bg-card rounded-lg animate-pulse">
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Show loading state while processing
  if (isProcessing || !processedData || !chartOptions) {
    return (
      <div className="w-full h-full">
        <div className="h-32 bg-card rounded-lg animate-pulse">
          <div className="h-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Render children with processed data and options
  return React.cloneElement(children, {
    processedData,
    chartOptions,
    isWorkerReady
  });
};

export default React.memo(VirtualChartRenderer); 