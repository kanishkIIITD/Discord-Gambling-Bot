// /**
//  * WebSocket Service
//  * Provides a centralized service for WebSocket connections with reconnection logic,
//  * event handling, and proper cleanup.
//  */

// class WebSocketService {
//   constructor(url, options = {}) {
//     this.url = url;
//     this.options = {
//       reconnectAttempts: 5,
//       reconnectInterval: 1000,
//       maxReconnectInterval: 30000,
//       reconnectDecay: 1.5, // Exponential backoff factor
//       debug: process.env.NODE_ENV === 'development',
//       ...options
//     };
    
//     this.socket = null;
//     this.isConnected = false;
//     this.reconnectAttempt = 0;
//     this.reconnectTimeout = null;
//     this.eventListeners = new Map();
//     this.messageQueue = [];
//     this.manualClose = false;
//   }

//   /**
//    * Connect to the WebSocket server
//    * @returns {Promise} Resolves when connected, rejects on error
//    */
//   connect() {
//     return new Promise((resolve, reject) => {
//       if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
//         this.log('WebSocket already connected or connecting');
//         resolve(this.socket);
//         return;
//       }

//       this.manualClose = false;
      
//       try {
//         this.socket = new WebSocket(this.url);
        
//         this.socket.onopen = () => {
//           this.isConnected = true;
//           this.reconnectAttempt = 0;
//           this.log('WebSocket connected');
          
//           // Process any queued messages
//           this._processQueue();
          
//           // Notify listeners
//           this._dispatchEvent('open', {});
          
//           resolve(this.socket);
//         };
        
//         this.socket.onclose = (event) => {
//           this.isConnected = false;
//           this.log(`WebSocket closed: ${event.code} ${event.reason}`);
          
//           // Notify listeners
//           this._dispatchEvent('close', event);
          
//           // Attempt to reconnect unless manually closed
//           if (!this.manualClose) {
//             this._reconnect();
//           }
//         };
        
//         this.socket.onerror = (error) => {
//           this.log('WebSocket error:', error);
          
//           // Notify listeners
//           this._dispatchEvent('error', error);
          
//           // Only reject if we're in the initial connection attempt
//           if (this.reconnectAttempt === 0) {
//             reject(error);
//           }
//         };
        
//         this.socket.onmessage = (event) => {
//           let parsedData;
          
//           try {
//             parsedData = JSON.parse(event.data);
//           } catch (e) {
//             parsedData = event.data;
//           }
          
//           // Notify listeners
//           this._dispatchEvent('message', parsedData);
//         };
//       } catch (error) {
//         this.log('WebSocket connection error:', error);
//         reject(error);
        
//         // Attempt to reconnect
//         if (!this.manualClose) {
//           this._reconnect();
//         }
//       }
//     });
//   }

//   /**
//    * Disconnect from the WebSocket server
//    */
//   disconnect() {
//     this.manualClose = true;
    
//     if (this.reconnectTimeout) {
//       clearTimeout(this.reconnectTimeout);
//       this.reconnectTimeout = null;
//     }
    
//     if (this.socket) {
//       this.socket.close();
//       this.socket = null;
//     }
    
//     this.isConnected = false;
//     this.log('WebSocket manually disconnected');
//   }

//   /**
//    * Send a message to the WebSocket server
//    * @param {Object|string} data - Data to send
//    * @param {boolean} queueIfDisconnected - Whether to queue the message if disconnected
//    * @returns {boolean} - Whether the message was sent or queued
//    */
//   send(data, queueIfDisconnected = true) {
//     if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
//       const message = typeof data === 'string' ? data : JSON.stringify(data);
//       this.socket.send(message);
//       return true;
//     } else if (queueIfDisconnected) {
//       this.messageQueue.push(data);
//       this.log('Message queued for later delivery');
//       return true;
//     }
    
//     return false;
//   }

//   /**
//    * Add an event listener
//    * @param {string} event - Event name ('open', 'message', 'close', 'error')
//    * @param {Function} callback - Callback function
//    */
//   addEventListener(event, callback) {
//     if (!this.eventListeners.has(event)) {
//       this.eventListeners.set(event, new Set());
//     }
    
//     this.eventListeners.get(event).add(callback);
//   }

//   /**
//    * Remove an event listener
//    * @param {string} event - Event name
//    * @param {Function} callback - Callback function to remove
//    */
//   removeEventListener(event, callback) {
//     if (this.eventListeners.has(event)) {
//       this.eventListeners.get(event).delete(callback);
//     }
//   }

//   /**
//    * Clear all event listeners
//    */
//   clearEventListeners() {
//     this.eventListeners.clear();
//   }

//   /**
//    * Get connection status
//    * @returns {boolean} - Whether the WebSocket is connected
//    */
//   getStatus() {
//     return {
//       isConnected: this.isConnected,
//       readyState: this.socket ? this.socket.readyState : -1,
//       reconnectAttempt: this.reconnectAttempt,
//       queuedMessages: this.messageQueue.length
//     };
//   }

//   /**
//    * Process queued messages
//    * @private
//    */
//   _processQueue() {
//     if (this.messageQueue.length > 0 && this.isConnected) {
//       this.log(`Processing ${this.messageQueue.length} queued messages`);
      
//       while (this.messageQueue.length > 0) {
//         const data = this.messageQueue.shift();
//         this.send(data, false);
//       }
//     }
//   }

//   /**
//    * Attempt to reconnect with exponential backoff
//    * @private
//    */
//   _reconnect() {
//     if (this.manualClose) return;
    
//     if (this.reconnectTimeout) {
//       clearTimeout(this.reconnectTimeout);
//     }
    
//     if (this.reconnectAttempt >= this.options.reconnectAttempts) {
//       this.log('Maximum reconnection attempts reached');
//       this._dispatchEvent('reconnect_failed', { attempts: this.reconnectAttempt });
//       return;
//     }
    
//     this.reconnectAttempt++;
    
//     // Calculate backoff delay with exponential decay
//     const delay = Math.min(
//       this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.reconnectAttempt - 1),
//       this.options.maxReconnectInterval
//     );
    
//     this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt} of ${this.options.reconnectAttempts})`);
//     this._dispatchEvent('reconnecting', { attempt: this.reconnectAttempt, delay });
    
//     this.reconnectTimeout = setTimeout(() => {
//       this.log(`Attempting reconnect ${this.reconnectAttempt}`);
//       this.connect().catch(error => {
//         this.log('Reconnection failed:', error);
//       });
//     }, delay);
//   }

//   /**
//    * Dispatch an event to all registered listeners
//    * @param {string} event - Event name
//    * @param {any} data - Event data
//    * @private
//    */
//   _dispatchEvent(event, data) {
//     if (this.eventListeners.has(event)) {
//       this.eventListeners.get(event).forEach(callback => {
//         try {
//           callback(data);
//         } catch (error) {
//           console.error(`Error in WebSocket ${event} listener:`, error);
//         }
//       });
//     }
//   }

//   /**
//    * Log a message if debug is enabled
//    * @private
//    */
//   log(...args) {
//     if (this.options.debug) {
//       console.log('[WebSocketService]', ...args);
//     }
//   }
// }

// export default WebSocketService;