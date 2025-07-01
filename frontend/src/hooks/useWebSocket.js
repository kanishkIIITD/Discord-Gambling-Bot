import { useState, useEffect, useRef, useCallback } from 'react';
import WebSocketService from '../services/WebSocketService';

/**
 * Custom hook for WebSocket connections
 * Provides a React-friendly interface to the WebSocketService
 * 
 * @param {string} url - WebSocket server URL
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Whether to connect automatically (default: true)
 * @param {number} options.reconnectAttempts - Maximum reconnection attempts (default: 5)
 * @param {number} options.reconnectInterval - Initial reconnection interval in ms (default: 1000)
 * @param {number} options.maxReconnectInterval - Maximum reconnection interval in ms (default: 30000)
 * @param {number} options.reconnectDecay - Exponential backoff factor (default: 1.5)
 * @param {boolean} options.debug - Enable debug logging (default: development mode)
 * @returns {Object} WebSocket interface
 */
const useWebSocket = (url, options = {}) => {
  const {
    autoConnect = true,
    ...serviceOptions
  } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    reconnectAttempt: 0,
    readyState: -1
  });
  
  // Use ref to maintain the same service instance across renders
  const serviceRef = useRef(null);
  
  // Initialize the WebSocket service
  useEffect(() => {
    serviceRef.current = new WebSocketService(url, serviceOptions);
    
    // Set up event listeners
    const handleOpen = () => {
      setIsConnected(true);
      setConnectionStatus(prev => ({
        ...prev,
        reconnectAttempt: 0,
        readyState: WebSocket.OPEN
      }));
    };
    
    const handleClose = () => {
      setIsConnected(false);
      setConnectionStatus(prev => ({
        ...prev,
        readyState: WebSocket.CLOSED
      }));
    };
    
    const handleMessage = (data) => {
      setLastMessage(data);
    };
    
    const handleReconnecting = (data) => {
      setConnectionStatus(prev => ({
        ...prev,
        reconnectAttempt: data.attempt,
        readyState: WebSocket.CONNECTING
      }));
    };
    
    // Register event listeners
    const service = serviceRef.current;
    service.addEventListener('open', handleOpen);
    service.addEventListener('close', handleClose);
    service.addEventListener('message', handleMessage);
    service.addEventListener('reconnecting', handleReconnecting);
    
    // Connect if autoConnect is true
    if (autoConnect) {
      service.connect().catch(error => {
        console.error('Failed to connect to WebSocket:', error);
      });
    }
    
    // Cleanup on unmount
    return () => {
      service.removeEventListener('open', handleOpen);
      service.removeEventListener('close', handleClose);
      service.removeEventListener('message', handleMessage);
      service.removeEventListener('reconnecting', handleReconnecting);
      service.disconnect();
    };
  }, [url]); // Only recreate the service if the URL changes
  
  // Memoize the connect function
  const connect = useCallback(() => {
    if (serviceRef.current) {
      return serviceRef.current.connect();
    }
    return Promise.reject(new Error('WebSocket service not initialized'));
  }, []);
  
  // Memoize the disconnect function
  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
  }, []);
  
  // Memoize the send function
  const send = useCallback((data, queueIfDisconnected = true) => {
    if (serviceRef.current) {
      return serviceRef.current.send(data, queueIfDisconnected);
    }
    return false;
  }, []);
  
  // Memoize the getStatus function
  const getStatus = useCallback(() => {
    if (serviceRef.current) {
      return serviceRef.current.getStatus();
    }
    return {
      isConnected: false,
      readyState: -1,
      reconnectAttempt: 0,
      queuedMessages: 0
    };
  }, []);
  
  // Memoize the addEventListener function
  const addEventListener = useCallback((event, callback) => {
    if (serviceRef.current) {
      serviceRef.current.addEventListener(event, callback);
      return () => serviceRef.current?.removeEventListener(event, callback);
    }
    return () => {};
  }, []);
  
  return {
    isConnected,
    lastMessage,
    connectionStatus,
    connect,
    disconnect,
    send,
    getStatus,
    addEventListener
  };
};

export default useWebSocket;