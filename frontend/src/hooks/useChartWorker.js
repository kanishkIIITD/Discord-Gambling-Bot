import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for using chart processing web worker
 * Moves heavy chart computations off the main thread to prevent long tasks
 */
export const useChartWorker = () => {
  const [worker, setWorker] = useState(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const pendingRequests = useRef(new Map());
  const requestId = useRef(0);

  // Initialize worker
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      try {
        const chartWorker = new Worker(new URL('../utils/chartWorker.js', import.meta.url));
        
        chartWorker.onmessage = (e) => {
          const { type, originalType, result, error } = e.data;
          
          if (type === 'success') {
            const request = pendingRequests.current.get(originalType);
            if (request) {
              request.resolve(result);
              pendingRequests.current.delete(originalType);
            }
          } else if (type === 'error') {
            const request = pendingRequests.current.get(originalType);
            if (request) {
              request.reject(new Error(error));
              pendingRequests.current.delete(originalType);
            }
          }
        };

        chartWorker.onerror = (error) => {
          console.error('Chart worker error:', error);
          // Reject all pending requests
          pendingRequests.current.forEach((request) => {
            request.reject(error);
          });
          pendingRequests.current.clear();
        };

        setWorker(chartWorker);
        setIsWorkerReady(true);

        return () => {
          chartWorker.terminate();
        };
      } catch (error) {
        console.error('Failed to create chart worker:', error);
        setIsWorkerReady(false);
      }
    } else {
      console.warn('Web Workers not supported, falling back to main thread');
      setIsWorkerReady(false);
    }
  }, []);

  // Send message to worker
  const sendToWorker = useCallback((type, data, theme = 'light') => {
    return new Promise((resolve, reject) => {
      if (!isWorkerReady || !worker) {
        // Fallback to main thread processing
        resolve(processInMainThread(type, data, theme));
        return;
      }

      const id = requestId.current++;
      pendingRequests.current.set(id, { resolve, reject });

      worker.postMessage({
        type,
        data,
        theme,
        id
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        const request = pendingRequests.current.get(id);
        if (request) {
          request.reject(new Error('Worker timeout'));
          pendingRequests.current.delete(id);
        }
      }, 5000);
    });
  }, [isWorkerReady, worker]);

  // Main thread fallback processing
  const processInMainThread = (type, data, theme) => {
    // Simplified processing for main thread fallback
    switch (type) {
      case 'processBalanceHistory':
        if (!data || !data.balanceHistory || data.balanceHistory.length === 0) {
          return { labels: [], data: [] };
        }
        const sortedTransactions = [...data.balanceHistory].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        const balanceHistory = sortedTransactions.map(tx => ({
          timestamp: new Date(tx.timestamp),
          balance: tx.balance
        }));
        const labels = balanceHistory.map(item =>
          item.timestamp.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })
        );
        const chartData = balanceHistory.map(item => item.balance);
        return { labels, data: chartData };

      case 'processDailyProfitLoss':
        if (!data || !Array.isArray(data)) return [];
        return data.map(item => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          net: item.net
        }));

      case 'processGamblingPerformance':
        if (data && data.totalWon !== undefined && data.totalLost !== undefined) {
          const wins = data.totalWon || 0;
          const losses = data.totalLost || 0;
          const ratio = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;
          return { wins, losses, ratio };
        }
        return { wins: 0, losses: 0, ratio: 0 };

      case 'processTopGames':
        if (data && data.profitByGame) {
          return [...data.profitByGame]
            .sort((a, b) => b.netProfit - a.netProfit)
            .slice(0, 3);
        }
        return [];

      case 'processFavoriteGame':
        if (!data || !Array.isArray(data.favoriteGameTrend)) return { chartData: [], gameTypes: [] };
        const favoriteGameData = data.favoriteGameTrend;
        const gameTypes = new Set();
        favoriteGameData.forEach(item => {
          if (item.allGames) {
            Object.keys(item.allGames).forEach(game => gameTypes.add(game));
          }
        });
        return {
          chartData: favoriteGameData,
          gameTypes: Array.from(gameTypes)
        };

      default:
        throw new Error(`Unknown processing type: ${type}`);
    }
  };

  return {
    sendToWorker,
    isWorkerReady,
    processInMainThread
  };
}; 