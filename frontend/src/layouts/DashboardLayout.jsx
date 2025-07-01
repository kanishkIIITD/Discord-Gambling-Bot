import React, { useEffect, useState, useRef } from 'react';
import { Outlet } from 'react-router-dom'; // Import Outlet
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { DashboardNavigation } from '../components/DashboardNavigation';
import { getWalletBalance, getActiveBets, getClosedBets } from '../services/api'; // Import necessary API functions
import { DashboardContext } from '../contexts/DashboardContext'; // Assuming you have a DashboardContext
// import useWebSocket from '../hooks/useWebSocket';
import PerformanceDashboard from '../components/PerformanceDashboard';

export const DashboardLayout = () => {
  const { user } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0); // Wallet balance state
  const [activeBets, setActiveBets] = useState([]); // Add state for active bets
  // Add loading state for the layout's data fetches
  const [loading, setLoading] = useState(true);
  const [suppressWalletBalance, setSuppressWalletBalance] = useState(false);
  const [prevWalletBalance, setPrevWalletBalance] = useState(0);
  const [pendingWalletBalance, setPendingWalletBalance] = useState(null);
  const navRef = useRef(null);
  const [navHeight, setNavHeight] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false); // Track dropdown state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768); // Start collapsed on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // Track mobile state
  
  // Initialize WebSocket connection
  // const wsUrl = process.env.REACT_APP_WS_URL;
  // const { 
  //   isConnected: wsConnected, 
  //   lastMessage: wsMessage,
  //   connectionStatus: wsStatus,
  //   send: wsSend
  // } = useWebSocket(wsUrl, {
  //   reconnectAttempts: 10,
  //   debug: process.env.NODE_ENV === 'development'
  // });

  // When suppression is enabled, store the previous balance
  useEffect(() => {
    if (suppressWalletBalance) {
      setPrevWalletBalance(walletBalance);
    }
    // eslint-disable-next-line
  }, [suppressWalletBalance]);

  // When suppression is turned off, apply pendingWalletBalance if set
  useEffect(() => {
    if (!suppressWalletBalance && pendingWalletBalance !== null) {
      setWalletBalance(pendingWalletBalance);
      setPendingWalletBalance(null);
    }
  }, [suppressWalletBalance, pendingWalletBalance]);

  // Handle WebSocket messages
  // useEffect(() => {
  //   if (wsMessage) {
  //     try {
  //       // Process different message types
  //       switch (wsMessage.type) {
  //         case 'BALANCE_UPDATE':
  //           if (suppressWalletBalance) {
  //             // Store the update for later if balance updates are suppressed
  //             setPendingWalletBalance(wsMessage.data.balance);
  //           } else {
  //             setWalletBalance(wsMessage.data.balance);
  //           }
  //           break;
  //         case 'BET_UPDATE':
  //           // Refresh active bets when a bet is updated
  //           fetchActiveBets();
  //           break;
  //         case 'NOTIFICATION':
  //           // Handle notifications if needed
  //           break;
  //         default:
  //           // Handle unknown message types
  //           console.log('Unknown WebSocket message type:', wsMessage.type);
  //       }
  //     } catch (error) {
  //       console.error('Error processing WebSocket message:', error);
  //     }
  //   }
  // }, [wsMessage, suppressWalletBalance]);

  // Send authentication message when WebSocket connects
  // useEffect(() => {
  //   if (wsConnected && user?.discordId) {
  //     wsSend({
  //       type: 'AUTHENTICATE',
  //       data: {
  //         discordId: user.discordId,
  //         guildId: process.env.REACT_APP_MAIN_GUILD_ID
  //       }
  //     });
  //   }
  // }, [wsConnected, user, wsSend]);

  // Fetch active bets function
  const fetchActiveBets = async () => {
    if (!user?.discordId) return;
    try {
      const [openBets, closedBets] = await Promise.all([
        getActiveBets(),
        getClosedBets()
      ]);
      setActiveBets([...openBets, ...closedBets]); // Combine open and closed bets
    } catch (error) {
      console.error('Error fetching bets:', error);
    }
  };

  // Fetch initial data (balance and active bets)
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.discordId) return;
      try {
        setLoading(true); // Set loading before fetching
        const [balanceData, openBets, closedBets] = await Promise.all([
          getWalletBalance(user.discordId),
          getActiveBets(),
          getClosedBets()
        ]);
        setWalletBalance(balanceData.balance);
        setActiveBets([...openBets, ...closedBets]); // Combine open and closed bets
      } catch (error) {
        console.error('Error fetching initial dashboard data:', error);
      } finally {
        setLoading(false); // Unset loading after fetching
      }
    };
    fetchData();
  }, [user]); // Fetch when user changes

  // Listen for nav height changes on resize - simplified
  useEffect(() => {
    if (!navRef.current) return;
    
    // Simple height update without complex calculations
    const updateNavHeight = () => {
      const height = navRef.current.offsetHeight;
      setNavHeight(height);
    };
    
    // Initial set
    updateNavHeight();
    
    // Update on window resize
    window.addEventListener('resize', updateNavHeight);
    
    return () => {
      window.removeEventListener('resize', updateNavHeight);
    };
  }, []);
  
  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      
      // Only auto-collapse if switching from desktop to mobile for the first time
      if (isMobileView && !isMobile && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
      
      // Update CSS variable for sidebar width
      document.documentElement.style.setProperty('--sidebar-width', sidebarCollapsed ? '4rem' : '16rem');
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Call once on mount
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed, isMobile]);

  // Update CSS variable when sidebar collapse state changes
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', sidebarCollapsed ? '4rem' : '16rem');
  }, [sidebarCollapsed]);
  
  // Add loading screen for the layout
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Define a constant for the spacing between nav and content/sidebar
  const navContentSpacing = 0; // Remove spacing to prevent overlap

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation bar at the top */}
      <header ref={navRef} className="w-full sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <DashboardNavigation 
          walletBalance={walletBalance} 
          setWalletBalance={setWalletBalance} 
          onProfileMenuToggle={setProfileMenuOpen}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </header>
      
      <div className="flex flex-1 relative">

        {/* Sidebar */}
        <aside 
          className={`overflow-x-hidden fixed left-0 z-40 overflow-y-auto transition-all duration-300 ease-in-out bg-surface ${isMobile ? (sidebarCollapsed ? '-translate-x-full' : 'translate-x-0') : ''}`}
          style={{ 
            width: isMobile ? '16rem' : 'var(--sidebar-width)',
            top: '64px', // Use fixed height instead of dynamic
            height: 'calc(100vh - 64px)', // Use fixed height instead of dynamic
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        >
          <Sidebar 
            onCollapse={setSidebarCollapsed} 
            collapsed={sidebarCollapsed}
            isMobile={isMobile}
          />
        </aside>
      
        {/* Overlay for mobile sidebar */}
        {isMobile && !sidebarCollapsed && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300"
            onClick={() => setSidebarCollapsed(true)}
            aria-hidden="true"
            style={{ 
              top: '64px' // Use fixed height instead of dynamic
            }}
          />
        )}
        
        {/* Content area */}
        <div 
          className="flex-1 transition-all duration-300 ease-in-out" 
          style={{ 
            marginLeft: isMobile ? '0' : 'var(--sidebar-width)',
            width: isMobile ? '100%' : 'calc(100% - var(--sidebar-width))',
          }}
        >
          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-background min-h-screen">
            <div className="h-full rounded-lg">
              <DashboardContext.Provider value={{ walletBalance, activeBets, suppressWalletBalance, setSuppressWalletBalance, prevWalletBalance, setPrevWalletBalance }}>
                <Outlet />
              </DashboardContext.Provider>
            </div>
          </main>
        </div>
      </div>
      
      {/* Mobile sidebar toggle button */}
      {isMobile && sidebarCollapsed && (
        <button 
          className="fixed bottom-6 right-6 z-50 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary-dark transition-colors duration-200"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Open sidebar"
          style={{
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 50
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      
      {/* Performance Dashboard (only in development mode) */}
      {process.env.NODE_ENV === 'development' && <PerformanceDashboard />}
    </div>
  );
};