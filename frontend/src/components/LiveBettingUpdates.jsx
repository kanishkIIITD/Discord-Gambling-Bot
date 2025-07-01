// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import useWebSocket from '../hooks/useWebSocket';
// import { usePerformance } from '../contexts/PerformanceContext';

// /**
//  * Component for displaying real-time betting updates via WebSocket
//  * Shows recent bets, resolutions, and other betting-related events
//  */
// const LiveBettingUpdates = () => {
//   const [updates, setUpdates] = useState([]);
//   const [isExpanded, setIsExpanded] = useState(false);
//   const navigate = useNavigate();
//   const { trackInteraction } = usePerformance();
  
//   // Initialize WebSocket connection
//   const wsUrl = process.env.REACT_APP_WS_URL;
//   const { 
//     isConnected, 
//     lastMessage,
//     connectionStatus
//   } = useWebSocket(wsUrl, {
//     reconnectAttempts: 5,
//     debug: process.env.NODE_ENV === 'development'
//   });
  
//   // Process incoming WebSocket messages
//   useEffect(() => {
//     if (lastMessage && lastMessage.type === 'BETTING_UPDATE') {
//       // Track performance of processing betting updates
//       trackInteraction('processBettingUpdate', () => {
//         const { data } = lastMessage;
        
//         // Add new update to the list
//         setUpdates(prev => {
//           // Add the new update with a timestamp
//           const newUpdate = {
//             ...data,
//             id: Date.now(), // Use timestamp as ID
//             timestamp: new Date().toISOString()
//           };
          
//           // Keep only the most recent 50 updates
//           const updatedList = [newUpdate, ...prev].slice(0, 50);
//           return updatedList;
//         });
//       });
//     }
//   }, [lastMessage, trackInteraction]);
  
//   // Handle clicking on a bet update
//   const handleBetClick = (betId) => {
//     trackInteraction('clickBettingUpdate', () => {
//       navigate(`/dashboard/betting/view/${betId}`);
//     });
//   };
  
//   // Format timestamp to a readable format
//   const formatTimestamp = (timestamp) => {
//     const date = new Date(timestamp);
//     return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//   };
  
//   // Render a single update
//   const renderUpdate = (update) => {
//     const { type, betId, betTitle, username, amount, option, timestamp, id } = update;
    
//     // Different styling based on update type
//     let bgColor = 'bg-card';
//     let icon = null;
//     let content = null;
    
//     switch (type) {
//       case 'NEW_BET':
//         bgColor = 'bg-info/10';
//         icon = (
//           <div className="flex-shrink-0 w-8 h-8 rounded-full bg-info/20 flex items-center justify-center">
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info" viewBox="0 0 20 20" fill="currentColor">
//               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
//             </svg>
//           </div>
//         );
//         content = (
//           <>
//             <span className="font-medium">{username}</span> created a new bet: 
//             <span className="font-medium">{betTitle}</span>
//           </>
//         );
//         break;
        
//       case 'PLACED_BET':
//         bgColor = 'bg-success/10';
//         icon = (
//           <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor">
//               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
//             </svg>
//           </div>
//         );
//         content = (
//           <>
//             <span className="font-medium">{username}</span> placed a bet of 
//             <span className="font-medium">{amount} points</span> on 
//             <span className="font-medium">{option}</span> in 
//             <span className="font-medium">{betTitle}</span>
//           </>
//         );
//         break;
        
//       case 'RESOLVED_BET':
//         bgColor = 'bg-warning/10';
//         icon = (
//           <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warning" viewBox="0 0 20 20" fill="currentColor">
//               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
//             </svg>
//           </div>
//         );
//         content = (
//           <>
//             <span className="font-medium">{betTitle}</span> was resolved with 
//             <span className="font-medium">{option}</span> as the winner
//           </>
//         );
//         break;
        
//       case 'CANCELLED_BET':
//         bgColor = 'bg-error/10';
//         icon = (
//           <div className="flex-shrink-0 w-8 h-8 rounded-full bg-error/20 flex items-center justify-center">
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-error" viewBox="0 0 20 20" fill="currentColor">
//               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
//             </svg>
//           </div>
//         );
//         content = (
//           <>
//             <span className="font-medium">{betTitle}</span> was cancelled by 
//             <span className="font-medium">{username}</span>
//           </>
//         );
//         break;
        
//       default:
//         icon = (
//           <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
//             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
//               <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
//             </svg>
//           </div>
//         );
//         content = (
//           <>
//             <span className="font-medium">Update</span> for bet: 
//             <span className="font-medium">{betTitle}</span>
//           </>
//         );
//     }
    
//     return (
//       <div 
//         key={id} 
//         className={`${bgColor} p-3 rounded-lg shadow-sm mb-2 cursor-pointer hover:shadow-md transition-shadow`}
//         onClick={() => handleBetClick(betId)}
//       >
//         <div className="flex items-start space-x-3">
//           {icon}
//           <div className="flex-1 min-w-0">
//             <p className="text-sm text-text-primary">
//               {content}
//             </p>
//             <p className="text-xs text-text-secondary mt-1">
//               {formatTimestamp(timestamp)}
//             </p>
//           </div>
//         </div>
//       </div>
//     );
//   };
  
//   return (
//     <div className="bg-surface rounded-lg shadow-md overflow-hidden">
//       <div 
//         className="p-4 bg-surface-alt border-b border-border flex justify-between items-center cursor-pointer"
//         onClick={() => setIsExpanded(!isExpanded)}
//       >
//         <div className="flex items-center space-x-2">
//           <h3 className="font-semibold">Live Betting Updates</h3>
//           {isConnected ? (
//             <span className="inline-block w-2 h-2 bg-success rounded-full"></span>
//           ) : (
//             <span className="inline-block w-2 h-2 bg-error rounded-full"></span>
//           )}
//         </div>
//         <button className="text-text-secondary hover:text-text-primary">
//           <svg 
//             xmlns="http://www.w3.org/2000/svg" 
//             className={`h-5 w-5 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} 
//             viewBox="0 0 20 20" 
//             fill="currentColor"
//           >
//             <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
//           </svg>
//         </button>
//       </div>
      
//       {isExpanded && (
//         <div className="p-4 max-h-96 overflow-y-auto">
//           {updates.length > 0 ? (
//             updates.map(renderUpdate)
//           ) : (
//             <div className="text-center py-6 text-text-secondary">
//               <p>No betting updates yet.</p>
//               <p className="text-sm mt-1">
//                 {isConnected ? 
//                   'Waiting for betting activity...' : 
//                   'Connecting to server...'}
//               </p>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default LiveBettingUpdates;